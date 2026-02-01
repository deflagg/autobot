import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

export * from './auth.js';
export * from './updates.js';
export * from './safety.js';
export * from './audit.js';
export * from './providers.js';
export * from './authStore.js';
export * from './tokenProvider.js';

export const ConfigSchema = z.object({
  repoPath: z.string(),
  ws: z.object({ port: z.number() }),
  auth: z.object({ token: z.string() }),
  llm: z
    .object({
      model: z.string().optional(),
      endpoint: z.string().optional(),
    })
    .optional(),
  safety: z
    .object({
      allowlist: z.array(z.string()).optional(),
      denylist: z.array(z.string()).optional(),
    })
    .optional(),
  oauth: z
    .object({
      clientId: z.string().optional(),
      authorizeUrl: z.string().optional(),
      tokenUrl: z.string().optional(),
      redirectHost: z.string().optional(),
      redirectPort: z.number().optional(),
      redirectPath: z.string().optional(),
      scopes: z.string().optional(),
    })
    .optional(),
});

export type AutobotConfig = z.infer<typeof ConfigSchema>;

export const CONFIG_DEFAULTS: AutobotConfig = {
  repoPath: process.cwd(),
  ws: { port: 18790 },
  auth: { token: 'dev-token' },
  llm: {
    model: 'openai-codex/gpt-5.2',
    endpoint: 'https://chatgpt.com/backend-api/codex/responses',
  },
  safety: {
    denylist: ['.git/**', '.env', '*.pem', '*.key', '**/*token*', '**/*credentials*'],
  },
  oauth: {
    authorizeUrl: 'https://auth.openai.com/oauth/authorize',
    tokenUrl: 'https://auth.openai.com/oauth/token',
    redirectPort: 1455,
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
    llm: { ...CONFIG_DEFAULTS.llm, ...(parsed.llm || {}) },
    safety: { ...CONFIG_DEFAULTS.safety, ...(parsed.safety || {}) },
    oauth: { ...CONFIG_DEFAULTS.oauth, ...(parsed.oauth || {}) },
  };
  return ConfigSchema.parse(merged);
}
