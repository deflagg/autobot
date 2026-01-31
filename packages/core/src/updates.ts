import { join } from 'node:path';

export function updatesDir(repoPath: string): string {
  return join(repoPath, 'updates');
}

export function updateDir(repoPath: string, updateId: string): string {
  return join(updatesDir(repoPath), updateId);
}
