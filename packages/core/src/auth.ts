import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type OAuthTokens = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  obtained_at?: number; // unix ms
  expires_at?: number; // unix ms
};

export function credentialsDir(): string {
  return join(homedir(), '.autobot', 'credentials');
}

export function oauthPath(): string {
  return join(credentialsDir(), 'openai-codex.oauth.json');
}

export function loadOAuthTokens(): OAuthTokens | null {
  const path = oauthPath();
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8')) as OAuthTokens;
}

export function saveOAuthTokens(tokens: OAuthTokens): void {
  mkdirSync(credentialsDir(), { recursive: true });
  const payload = { ...tokens, obtained_at: tokens.obtained_at ?? Date.now() };
  writeFileSync(oauthPath(), JSON.stringify(payload, null, 2), { mode: 0o600 });
}

export function isRefreshable(tokens: OAuthTokens | null): boolean {
  return !!tokens?.refresh_token;
}

export function isExpired(tokens: OAuthTokens | null, skewSeconds = 60): boolean {
  if (!tokens?.expires_in) return false;
  const obtainedAt = tokens.obtained_at ?? 0;
  const expiresAt = obtainedAt + tokens.expires_in * 1000;
  return Date.now() >= expiresAt - skewSeconds * 1000;
}
