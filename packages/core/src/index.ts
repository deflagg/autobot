import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

export * from './auth.js';
export * from './updates.js';

export const ConfigSchema = z.object({
  repoPath: z.string(),
  ws: z.object({ port: z.number() }),
  auth: z.object({ token: z.string() }),
  oauth: z
    .object({
      clientId: z.string().optional(),
      authorizeUrl: z.string().optional(),
      tokenUrl: z.string().optional(),
      redirectPort: z.number().optional(),
    })
    .optional(),
});

export type AutobotConfig = z.infer<typeof ConfigSchema>;

export const CONFIG_DEFAULTS: AutobotConfig = {
  repoPath: process.cwd(),
  ws: { port: 18790 },
  auth: { token: 'dev-token' },
  oauth: {
    authorizeUrl: 'https://auth.openai.com/authorize',
    tokenUrl: 'https://auth.openai.com/token',
    redirectPort: 7777,
  },
};

export function stateDir(): string {
  return join(homedir(), '.autobot');
}

export function configPath(): string {
  return join(stateDir(), 'config.json');
}

export function ensureStateDir(): void {
  mkdirSync(stateDir(), { recursive: true });
}

export function loadConfig(): AutobotConfig {
  const path = configPath();
  if (!existsSync(path)) return CONFIG_DEFAULTS;
  const raw = readFileSync(path, 'utf8');
  const parsed = JSON.parse(raw);
  const merged = {
    ...CONFIG_DEFAULTS,
    ...parsed,
    ws: { ...CONFIG_DEFAULTS.ws, ...(parsed.ws || {}) },
    auth: { ...CONFIG_DEFAULTS.auth, ...(parsed.auth || {}) },
    oauth: { ...CONFIG_DEFAULTS.oauth, ...(parsed.oauth || {}) },
  };
  return ConfigSchema.parse(merged);
}
