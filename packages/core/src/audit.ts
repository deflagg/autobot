import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export function auditLogPath(): string {
  return join(homedir(), '.autobot', 'logs', 'audit.jsonl');
}

export function appendAudit(event: Record<string, unknown>) {
  const path = auditLogPath();
  mkdirSync(join(homedir(), '.autobot', 'logs'), { recursive: true });
  appendFileSync(path, JSON.stringify({ ts: Date.now(), ...event }) + '\n');
}
