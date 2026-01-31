import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function base64urlDecode(input: string): string {
  const pad = '='.repeat((4 - (input.length % 4)) % 4);
  const b64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64').toString('utf8');
}

export function openclawAuthProfilesPath(): string {
  return join(homedir(), '.openclaw', 'agents', 'main', 'agent', 'auth-profiles.json');
}

export function getOpenClawClientId(): string | null {
  const path = openclawAuthProfilesPath();
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf8');
  const json = JSON.parse(raw);
  const profile = json?.profiles?.['openai-codex:default'];
  const access = profile?.access;
  if (!access || typeof access !== 'string') return null;
  try {
    const payload = access.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(base64urlDecode(payload));
    return decoded?.client_id ?? null;
  } catch {
    return null;
  }
}
