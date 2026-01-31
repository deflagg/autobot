import { WebSocketServer } from 'ws';
import {
  EnvelopeSchema,
  StatusGetSchema,
  AuthLoginStartSchema,
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
  loadOAuthTokens,
  saveOAuthTokens,
  isRefreshable,
  updateDir,
  updatesDir,
  ensureCleanTree,
  appendAudit,
  getOpenClawClientId,
} from '@autobot/core';
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { ulid } from 'ulid';
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

function base64url(input: Buffer) {
  return input
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generatePKCE() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash('sha256').update(verifier).digest());
  return { verifier, challenge, method: 'S256' as const };
}

async function createUpdateArtifacts(repoPath: string, goal: string) {
  const updateId = `${new Date().toISOString().replace(/[:.]/g, '-')}-${ulid()}`;
  const dir = updateDir(repoPath, updateId);
  mkdirSync(updatesDir(repoPath), { recursive: true });
  mkdirSync(dir, { recursive: true });

  const request = { id: updateId, goal, createdAt: new Date().toISOString() };
  const plan = { goal, steps: ['(stub) derive plan from goal'] };
  const patch = `# patch for ${updateId}\n# (stub)\n`;

  writeFileSync(join(dir, 'request.json'), JSON.stringify(request, null, 2));
  writeFileSync(join(dir, 'plan.json'), JSON.stringify(plan, null, 2));
  writeFileSync(join(dir, 'patch.diff'), patch);

  return { updateId, dir, patch };
}

function hash(str: string) {
  return createHash('sha256').update(str).digest('hex');
}

export function startDaemon() {
  const cfg = loadConfig();
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

      const { updateId, patch } = await createUpdateArtifacts(cfg.repoPath, loopState.goal);
      loopState.lastUpdateId = updateId;

      const patchHash = hash(patch);
      if (loopState.lastPatchHash && loopState.lastPatchHash === patchHash) {
        loopState.running = false;
        ws.send(JSON.stringify({
          id: loopState.loopId,
          type: 'loop.stopped',
          ok: false,
          error: { code: 'STAGNATION', message: 'Patch unchanged across iterations' },
        }));
        break;
      }
      loopState.lastPatchHash = patchHash;

      let attempt = 0;
      let applied = false;
      while (attempt <= loopState.retry) {
        try {
          await ensureCleanTree(cfg.repoPath, git);
          const dir = updateDir(cfg.repoPath, updateId);
          const patchPath = join(dir, 'patch.diff');
          const patchText = readFileSync(patchPath, 'utf8');

          await git.applyPatch(patchText);
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
        const tokens = loadOAuthTokens();
        ws.send(
          JSON.stringify({
            id: authStatusGet.data.id,
            type: 'auth.status.result',
            ok: true,
            payload: {
              provider: 'openai-codex',
              configured: !!tokens,
              refreshable: isRefreshable(tokens),
            },
          })
        );
        return;
      }

      const authLoginStart = AuthLoginStartSchema.safeParse(msg);
      if (authLoginStart.success) {
        const pkce = generatePKCE();
        const state = base64url(randomBytes(16));
        const redirectPort = cfg.oauth?.redirectPort ?? 7777;
        const callbackUrl = `http://127.0.0.1:${redirectPort}/oauth/callback`;
        const authorizeUrl = cfg.oauth?.authorizeUrl || 'https://auth.openai.com/authorize';
        const clientId = cfg.oauth?.clientId || getOpenClawClientId() || '';

        if (!clientId) {
          ws.send(JSON.stringify({
            id: authLoginStart.data.id,
            type: 'error',
            ok: false,
            error: { code: 'OAUTH_CLIENT_ID_MISSING', message: 'OAuth client id not found; set oauth.clientId or install OpenClaw OAuth' },
          }));
          return;
        }

        const server = createServer(async (req, res) => {
          if (!req.url) return;
          const url = new URL(req.url, callbackUrl);
          if (url.pathname !== '/oauth/callback') {
            res.writeHead(404).end();
            return;
          }

          const code = url.searchParams.get('code');
          const rstate = url.searchParams.get('state');
          if (!code || rstate !== state) {
            res.writeHead(400).end('Invalid state or missing code');
            return;
          }

          try {
            const tokenUrl = cfg.oauth?.tokenUrl || 'https://auth.openai.com/token';
            const body = new URLSearchParams({
              grant_type: 'authorization_code',
              code,
              redirect_uri: callbackUrl,
              client_id: clientId,
              code_verifier: pkce.verifier,
            });

            const resp = await fetch(tokenUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body,
            });

            const json = await resp.json();
            if (!resp.ok) {
              res.writeHead(500).end('Token exchange failed');
              return;
            }

            saveOAuthTokens({
              access_token: json.access_token,
              refresh_token: json.refresh_token,
              expires_in: json.expires_in,
              token_type: json.token_type,
              scope: json.scope,
            });

            res.writeHead(200).end('Login complete. You can return to the CLI.');
          } catch (e) {
            res.writeHead(500).end('Token exchange error');
          } finally {
            server.close();
          }
        });

        server.listen(redirectPort, '127.0.0.1');

        const authUrl = new URL(authorizeUrl);
        authUrl.searchParams.set('response_type', 'code');
        authUrl.searchParams.set('client_id', clientId);
        authUrl.searchParams.set('redirect_uri', callbackUrl);
        authUrl.searchParams.set('scope', 'openid');
        authUrl.searchParams.set('state', state);
        authUrl.searchParams.set('code_challenge', pkce.challenge);
        authUrl.searchParams.set('code_challenge_method', pkce.method);

        ws.send(
          JSON.stringify({
            id: authLoginStart.data.id,
            type: 'auth.login.started',
            ok: true,
            payload: {
              authUrl: authUrl.toString(),
              callbackUrl,
              state,
              pkce: { method: pkce.method },
            },
          })
        );
        return;
      }

      const updateCreate = UpdateCreateSchema.safeParse(msg);
      if (updateCreate.success) {
        const { updateId, dir } = await createUpdateArtifacts(cfg.repoPath, updateCreate.data.payload.goal);
        ws.send(
          JSON.stringify({
            id: updateCreate.data.id,
            type: 'update.created',
            ok: true,
            payload: { updateId, path: dir },
          })
        );
        return;
      }

      const updateApply = UpdateApplySchema.safeParse(msg);
      if (updateApply.success) {
        try {
          await ensureCleanTree(cfg.repoPath, git);
          const dir = updateDir(cfg.repoPath, updateApply.data.payload.updateId);
          const patchPath = join(dir, 'patch.diff');
          const patch = readFileSync(patchPath, 'utf8');

          await git.applyPatch(patch);
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
