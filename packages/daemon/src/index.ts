import { WebSocketServer } from 'ws';
import {
  EnvelopeSchema,
  StatusGetSchema,
  DoctorRunSchema,
  AuthLoginStartSchema,
  AuthLoginCompleteSchema,
  AuthStatusGetSchema,
  UpdateCreateSchema,
  UpdateApplySchema,
  UpdateRollbackSchema,
  LoopStartSchema,
  LoopStatusSchema,
  LoopStopSchema,
} from '@autobot/protocol';
import {
  loadConfig,
  updateDir,
  updatesDir,
  ensureCleanTree,
  ensureChangePathsAllowed,
  appendAudit,
  DEFAULT_PROVIDER_ID,
  isProviderId,
} from '@autobot/core';
import type { AuthProvider } from '@autobot/core';
import { stateDir } from '@autobot/core';
import { mkdirSync, writeFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
import { createOpenAICodexOAuthProvider } from './providers/openaiCodexOAuth.js';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { execa } from 'execa';

const start = Date.now();

type LoopState = {
  loopId: string;
  goal: string;
  running: boolean;
  iteration: number;
  retry: number;
  maxIterations?: number;
  maxMinutes?: number;
  startedAt: number;
  lastUpdateId?: string;
  lastPatchHash?: string;
};

let loopState: LoopState | null = null;

async function createUpdateArtifacts(repoPath: string, goal: string) {
  const updateId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${ulid()}`;
  const dir = updateDir(repoPath, updateId);
  mkdirSync(updatesDir(repoPath), { recursive: true });
  mkdirSync(dir, { recursive: true });

  const request = { id: updateId, goal, createdAt: new Date().toISOString() };
  writeFileSync(join(dir, 'request.json'), JSON.stringify(request, null, 2));

  return { updateId, dir };
}

function hash(str: string) {
  return createHash('sha256').update(str).digest('hex');
}

function extractBetween(text: string, start: string, end: string): string | null {
  const s = text.indexOf(start);
  const e = text.indexOf(end);
  if (s === -1 || e === -1 || e <= s) return null;
  return text.slice(s + start.length, e).trim();
}

async function generateChangeWithLlm(goal: string, cfg: ReturnType<typeof loadConfig>, provider: AuthProvider) {
  if (!provider.ensureValidToken) throw new Error('LLM provider missing ensureValidToken');
  const { accessToken } = await provider.ensureValidToken();

  const model = cfg.llm?.model || 'gpt-4.1';
  const endpoint = cfg.llm?.endpoint || 'https://chatgpt.com/backend-api/codex/responses';

  const system = `You are Codex, based on GPT-5. You are running as a coding agent in the Codex CLI on a user's machine. Produce two artifacts: a JSON plan and a unified diff. Use the strict tags <PLAN_JSON>...</PLAN_JSON> and <CHANGE_DIFF>...</CHANGE_DIFF>. The diff must be relative to repo root.`;
  const user = `Goal: ${goal}`;

  const resp = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      model,
      input: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.2,
    }),
  });

  const json = await resp.json();
  if (!resp.ok) throw new Error(`LLM request failed: ${json?.error?.message || resp.statusText}`);

  const text = json?.output_text || json?.output?.[0]?.content?.[0]?.text || '';
  const planRaw = extractBetween(text, '<PLAN_JSON>', '</PLAN_JSON>');
  const changeRaw = extractBetween(text, '<CHANGE_DIFF>', '</CHANGE_DIFF>');
  if (!planRaw || !changeRaw) throw new Error('LLM output missing plan or change');

  const plan = JSON.parse(planRaw);
  return { plan, change: changeRaw, model };
}

export function startDaemon() {
  const cfg = loadConfig();

  const pidPath = join(stateDir(), 'daemon.pid');
  mkdirSync(stateDir(), { recursive: true });
  if (existsSync(pidPath)) {
    const existing = Number(readFileSync(pidPath, 'utf8'));
    if (existing) {
      try {
        process.kill(existing, 0);
        throw new Error(`Daemon already running (pid ${existing}). Stop it before starting a new one.`);
      } catch {
        // stale pid, continue
      }
    }
  }
  writeFileSync(pidPath, String(process.pid));
  const cleanup = () => {
    try { unlinkSync(pidPath); } catch {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', () => { cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });

  const loginWaiters = new Map<string, Set<import('ws').WebSocket>>();
  const providers: Record<string, AuthProvider> = {
    [DEFAULT_PROVIDER_ID]: createOpenAICodexOAuthProvider(cfg, {
      onLoginComplete: () => {
        const waiters = loginWaiters.get(DEFAULT_PROVIDER_ID);
        if (!waiters) return;
        for (const client of waiters) {
          try {
            client.send(JSON.stringify({
              id: 'auth.login.completed',
              type: 'auth.login.completed',
              ok: true,
              payload: { providerId: DEFAULT_PROVIDER_ID },
            }));
          } catch {
            // ignore
          }
        }
        waiters.clear();
      },
    }),
  };
  const wss = new WebSocketServer({ host: '127.0.0.1', port: cfg.ws.port });
  const git = simpleGit(cfg.repoPath);

  async function runLoop(ws: import('ws').WebSocket) {
    if (!loopState) return;

    while (loopState.running) {
      if (loopState.maxIterations && loopState.iteration >= loopState.maxIterations) {
        loopState.running = false;
        break;
      }
      if (loopState.maxMinutes && (Date.now() - loopState.startedAt) / 60000 >= loopState.maxMinutes) {
        loopState.running = false;
        break;
      }

      loopState.iteration += 1;

      const { updateId, dir } = await createUpdateArtifacts(cfg.repoPath, loopState.goal);
      loopState.lastUpdateId = updateId;

      const provider = providers[DEFAULT_PROVIDER_ID];
      const { plan, change } = await generateChangeWithLlm(loopState.goal, cfg, provider);
      writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan, null, 2));
      writeFileSync(join(dir, 'change.diff'), change);

      const changeHash = hash(change);
      if (loopState.lastPatchHash && loopState.lastPatchHash === changeHash) {
        loopState.running = false;
        ws.send(JSON.stringify({
          id: loopState.loopId,
          type: 'loop.stopped',
          ok: false,
          error: { code: 'STAGNATION', message: 'Patch unchanged across iterations' },
        }));
        break;
      }
      loopState.lastPatchHash = changeHash;

      let attempt = 0;
      let applied = false;
      while (attempt <= loopState.retry) {
        try {
          await ensureCleanTree(cfg.repoPath, git);
          const dir = updateDir(cfg.repoPath, updateId);
          const changePath = join(dir, 'change.diff');
          const changeText = readFileSync(changePath, 'utf8');

          ensureChangePathsAllowed(cfg.repoPath, changeText, cfg.safety?.allowlist, cfg.safety?.denylist);

          await git.applyPatch(changeText);
          await execa('npm', ['run', 'build'], { cwd: cfg.repoPath, stdio: 'inherit' });
          await execa('npm', ['test'], { cwd: cfg.repoPath, stdio: 'inherit' });

          await git.add('.');
          await git.commit(`autobot(loop:${loopState.loopId}): ${updateId}`);
          const head = await git.revparse(['HEAD']);

          appendAudit({ type: 'loop.iteration.completed', loopId: loopState.loopId, updateId, commit: head });

          ws.send(JSON.stringify({
            id: loopState.loopId,
            type: 'loop.iteration.completed',
            ok: true,
            payload: { updateId, commit: head, iteration: loopState.iteration },
          }));

          applied = true;
          break;
        } catch (e: any) {
          await git.reset(['--hard', 'HEAD']);
          ws.send(JSON.stringify({
            id: loopState.loopId,
            type: 'loop.iteration.failed',
            ok: false,
            error: { code: 'VERIFY_FAILED', message: String(e?.message || e) },
            payload: { attempt },
          }));
          attempt += 1;
        }
      }

      if (!applied) {
        loopState.running = false;
        break;
      }
    }

    ws.send(JSON.stringify({
      id: loopState?.loopId,
      type: 'loop.stopped',
      ok: true,
      payload: { loopId: loopState?.loopId },
    }));
  }

  wss.on('connection', (ws: import('ws').WebSocket) => {
    let authed = false;

    ws.on('close', () => {
      for (const waiters of loginWaiters.values()) {
        waiters.delete(ws);
      }
    });

    ws.on('message', async (data: import('ws').RawData) => {
      let msg: unknown;
      try {
        msg = JSON.parse(String(data));
      } catch {
        ws.send(JSON.stringify({ type: 'error', ok: false, error: { code: 'BAD_JSON', message: 'Invalid JSON' } }));
        return;
      }

      const envelope = EnvelopeSchema.safeParse(msg);
      if (!envelope.success) {
        ws.send(JSON.stringify({ type: 'error', ok: false, error: { code: 'BAD_ENVELOPE', message: 'Invalid envelope' } }));
        return;
      }

      if (envelope.data.type === 'auth') {
        const token = (envelope.data.payload as any)?.token;
        if (token && token === cfg.auth.token) {
          authed = true;
          ws.send(JSON.stringify({ id: envelope.data.id, type: 'auth.ok', ok: true }));
        } else {
          ws.send(JSON.stringify({ id: envelope.data.id, type: 'auth.error', ok: false, error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }));
        }
        return;
      }

      if (!authed) {
        ws.send(JSON.stringify({ id: envelope.data.id, type: 'error', ok: false, error: { code: 'AUTH_REQUIRED', message: 'Authenticate first' } }));
        return;
      }

      const statusGet = StatusGetSchema.safeParse(msg);
      if (statusGet.success) {
        ws.send(
          JSON.stringify({
            id: statusGet.data.id,
            type: 'status.result',
            ok: true,
            payload: { daemon: { pid: process.pid, uptimeMs: Date.now() - start } },
          })
        );
        return;
      }

      const authStatusGet = AuthStatusGetSchema.safeParse(msg);
      if (authStatusGet.success) {
        const providerId = authStatusGet.data.payload?.providerId ?? DEFAULT_PROVIDER_ID;
        if (!isProviderId(providerId)) {
          ws.send(JSON.stringify({
            id: authStatusGet.data.id,
            type: 'error',
            ok: false,
            error: { code: 'PROVIDER_NOT_FOUND', message: `Unknown provider: ${providerId}` },
          }));
          return;
        }

        const status = await providers[providerId].getStatus();

        ws.send(
          JSON.stringify({
            id: authStatusGet.data.id,
            type: 'auth.status.result',
            ok: true,
            payload: status,
          })
        );
        return;
      }

      const doctorRun = DoctorRunSchema.safeParse(msg);
      if (doctorRun.success) {
        const checks: { name: string; ok: boolean; message?: string }[] = [];
        const providerId = DEFAULT_PROVIDER_ID;
        if (!isProviderId(providerId)) {
          checks.push({ name: 'oauth.provider', ok: false, message: `Unknown provider: ${providerId}` });
        } else {
          checks.push({ name: 'oauth.provider', ok: true });
          const status = await providers[providerId].getStatus();
          checks.push({ name: 'oauth.configured', ok: status.configured, message: status.configured ? undefined : 'No tokens found. Run autobot auth login.' });
          if (typeof status.refreshable === 'boolean') {
            checks.push({ name: 'oauth.refreshable', ok: status.refreshable, message: status.refreshable ? undefined : 'No refresh token present' });
          }
          if (typeof status.expired === 'boolean') {
            checks.push({ name: 'oauth.expired', ok: !status.expired, message: status.expired ? 'Token expired or near expiry' : undefined });
          }
        }

        try {
          const status = await git.status();
          checks.push({ name: 'git.clean', ok: status.isClean() });
        } catch (e: any) {
          checks.push({ name: 'git.clean', ok: false, message: String(e?.message || e) });
        }

        ws.send(
          JSON.stringify({
            id: doctorRun.data.id,
            type: 'doctor.result',
            ok: true,
            payload: { checks },
          })
        );
        return;
      }

      const authLoginStart = AuthLoginStartSchema.safeParse(msg);
      if (authLoginStart.success) {
        const providerId = authLoginStart.data.payload?.providerId ?? DEFAULT_PROVIDER_ID;
        if (!isProviderId(providerId)) {
          ws.send(JSON.stringify({
            id: authLoginStart.data.id,
            type: 'error',
            ok: false,
            error: { code: 'PROVIDER_NOT_FOUND', message: `Unknown provider: ${providerId}` },
          }));
          return;
        }

        let waiters = loginWaiters.get(providerId);
        if (!waiters) {
          waiters = new Set();
          loginWaiters.set(providerId, waiters);
        }
        waiters.add(ws);

        const result = await providers[providerId].startLogin();

        ws.send(
          JSON.stringify({
            id: authLoginStart.data.id,
            type: 'auth.login.started',
            ok: true,
            payload: { providerId, ...result },
          })
        );
        return;
      }

      const authLoginComplete = AuthLoginCompleteSchema.safeParse(msg);
      if (authLoginComplete.success) {
        const providerId = authLoginComplete.data.payload.providerId ?? DEFAULT_PROVIDER_ID;
        if (!isProviderId(providerId)) {
          ws.send(JSON.stringify({
            id: authLoginComplete.data.id,
            type: 'error',
            ok: false,
            error: { code: 'PROVIDER_NOT_FOUND', message: `Unknown provider: ${providerId}` },
          }));
          return;
        }

        const { redirectUrl, code, state } = authLoginComplete.data.payload;
        let input: any = null;
        if (redirectUrl) {
          input = { redirectUrl };
        } else if (code && state) {
          input = { code, state };
        } else {
          ws.send(JSON.stringify({
            id: authLoginComplete.data.id,
            type: 'error',
            ok: false,
            error: { code: 'OAUTH_MISSING_FIELDS', message: 'Missing redirectUrl or code/state' },
          }));
          return;
        }

        const result = await providers[providerId].completeLogin(input);

        if (!result.ok) {
          ws.send(JSON.stringify({
            id: authLoginComplete.data.id,
            type: 'error',
            ok: false,
            error: { code: 'OAUTH_EXCHANGE_FAILED', message: result.error },
          }));
          return;
        }

        ws.send(JSON.stringify({
          id: authLoginComplete.data.id,
          type: 'auth.login.completed',
          ok: true,
        }));
        return;
      }

      const updateCreate = UpdateCreateSchema.safeParse(msg);
      if (updateCreate.success) {
        try {
          const { updateId, dir } = await createUpdateArtifacts(cfg.repoPath, updateCreate.data.payload.goal);
          const provider = providers[DEFAULT_PROVIDER_ID];
          const { plan, change, model } = await generateChangeWithLlm(updateCreate.data.payload.goal, cfg, provider);

          writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan, null, 2));
          writeFileSync(join(dir, 'change.diff'), change);
          appendAudit({ type: 'update.created', updateId, model });

          ws.send(
            JSON.stringify({
              id: updateCreate.data.id,
              type: 'update.created',
              ok: true,
              payload: { updateId, path: dir },
            })
          );
        } catch (e: any) {
          ws.send(
            JSON.stringify({
              id: updateCreate.data.id,
              type: 'error',
              ok: false,
              error: { code: 'LLM_FAILED', message: String(e?.message || e) },
            })
          );
        }
        return;
      }

      const updateApply = UpdateApplySchema.safeParse(msg);
      if (updateApply.success) {
        try {
          await ensureCleanTree(cfg.repoPath, git);
          const dir = updateDir(cfg.repoPath, updateApply.data.payload.updateId);
          const changePath = join(dir, 'change.diff');
          const change = readFileSync(changePath, 'utf8');

          ensureChangePathsAllowed(cfg.repoPath, change, cfg.safety?.allowlist, cfg.safety?.denylist);

          await git.applyPatch(change);
          await execa('npm', ['run', 'build'], { cwd: cfg.repoPath, stdio: 'inherit' });
          await execa('npm', ['test'], { cwd: cfg.repoPath, stdio: 'inherit' });

          await git.add('.');
          await git.commit(`autobot(update): ${updateApply.data.payload.updateId}`);
          const head = await git.revparse(['HEAD']);

          appendAudit({ type: 'update.applied', updateId: updateApply.data.payload.updateId, commit: head });

          ws.send(
            JSON.stringify({
              id: updateApply.data.id,
              type: 'update.applied',
              ok: true,
              payload: { updateId: updateApply.data.payload.updateId, commit: head },
            })
          );
        } catch (e: any) {
          ws.send(
            JSON.stringify({
              id: updateApply.data.id,
              type: 'error',
              ok: false,
              error: { code: 'APPLY_FAILED', message: String(e?.message || e) },
            })
          );
        }
        return;
      }

      const updateRollback = UpdateRollbackSchema.safeParse(msg);
      if (updateRollback.success) {
        try {
          const ref = updateRollback.data.payload.ref || 'HEAD~1';
          await git.reset(['--hard', ref]);
          const head = await git.revparse(['HEAD']);
          appendAudit({ type: 'update.rolledBack', ref, head });
          ws.send(
            JSON.stringify({
              id: updateRollback.data.id,
              type: 'update.rolledBack',
              ok: true,
              payload: { head },
            })
          );
        } catch (e: any) {
          ws.send(
            JSON.stringify({
              id: updateRollback.data.id,
              type: 'error',
              ok: false,
              error: { code: 'ROLLBACK_FAILED', message: String(e?.message || e) },
            })
          );
        }
        return;
      }

      const loopStart = LoopStartSchema.safeParse(msg);
      if (loopStart.success) {
        const loopId = ulid();
        loopState = {
          loopId,
          goal: loopStart.data.payload.goal,
          running: true,
          iteration: 0,
          retry: loopStart.data.payload.retry ?? 1,
          maxIterations: loopStart.data.payload.maxIterations,
          maxMinutes: loopStart.data.payload.maxMinutes,
          startedAt: Date.now(),
        };

        ws.send(JSON.stringify({ id: loopStart.data.id, type: 'loop.started', ok: true, payload: { loopId } }));
        runLoop(ws);
        return;
      }

      const loopStatus = LoopStatusSchema.safeParse(msg);
      if (loopStatus.success) {
        ws.send(JSON.stringify({
          id: loopStatus.data.id,
          type: 'loop.status.result',
          ok: true,
          payload: loopState
            ? {
                loopId: loopState.loopId,
                state: loopState.running ? 'running' : 'stopped',
                iteration: loopState.iteration,
                lastUpdateId: loopState.lastUpdateId,
              }
            : { loopId: null, state: 'stopped' },
        }));
        return;
      }

      const loopStop = LoopStopSchema.safeParse(msg);
      if (loopStop.success && loopState && loopState.loopId === loopStop.data.payload.loopId) {
        loopState.running = false;
        ws.send(JSON.stringify({ id: loopStop.data.id, type: 'loop.stopped', ok: true, payload: { loopId: loopState.loopId } }));
        return;
      }

      ws.send(JSON.stringify({
        id: envelope.data.id,
        type: 'error',
        ok: false,
        error: { code: 'UNKNOWN_TYPE', message: `Unknown type: ${envelope.data.type}` },
      }));
    });
  });

  return wss;
}

if (process.argv.includes('--run')) {
  startDaemon();
  console.log('autobot daemon listening');
}
