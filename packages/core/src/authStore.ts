import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, openSync, closeSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type AuthProfile = {
  provider: 'openai-codex';
  type: 'oauth';
  access: string;
  refresh: string;
  expires: number; // epoch ms
  accountId?: string | null;
  createdAt: number;
  scopes?: string[];
};

export type AuthProfilesFile = {
  profiles: Record<string, AuthProfile>;
};

export function stateDir(): string {
  return join(homedir(), '.autobot');
}

export function authProfilesPath(): string {
  return join(stateDir(), 'auth-profiles.json');
}

export function authLockPath(): string {
  return join(stateDir(), 'auth.lock');
}

export function ensureStateDir() {
  mkdirSync(stateDir(), { recursive: true });
}

export function loadAuthProfiles(): AuthProfilesFile {
  ensureStateDir();
  const p = authProfilesPath();
  if (!existsSync(p)) return { profiles: {} };
  return JSON.parse(readFileSync(p, 'utf8')) as AuthProfilesFile;
}

export function saveAuthProfiles(data: AuthProfilesFile) {
  ensureStateDir();
  const p = authProfilesPath();
  const tmp = `${p}.tmp.${process.pid}.${Date.now()}`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  renameSync(tmp, p);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function withAuthLock<T>(fn: () => Promise<T> | T, opts?: { timeoutMs?: number; retryMs?: number }): Promise<T> {
  ensureStateDir();
  const lock = authLockPath();
  const timeoutMs = opts?.timeoutMs ?? 10_000;
  const retryMs = opts?.retryMs ?? 50;
  const start = Date.now();

  while (true) {
    try {
      const fd = openSync(lock, 'wx', 0o600);
      try {
        return await fn();
      } finally {
        closeSync(fd);
        try { unlinkSync(lock); } catch {}
      }
    } catch (e: any) {
      if (Date.now() - start > timeoutMs) throw new Error('AUTH_LOCK_TIMEOUT');
      await sleep(retryMs);
    }
  }
}
