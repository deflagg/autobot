import { simpleGit, SimpleGit } from 'simple-git';
import { resolve } from 'node:path';

export const DEFAULT_DENYLIST = [
  '.git/',
  '.env',
  '.pem',
  '.key',
  'token',
  'credentials',
];

export async function ensureCleanTree(repoPath: string, git?: SimpleGit) {
  const g = git || simpleGit(repoPath);
  const status = await g.status();
  if (!status.isClean()) {
    throw new Error('GIT_DIRTY');
  }
}

export function isPathAllowed(repoPath: string, targetPath: string): boolean {
  const rel = resolve(targetPath).replace(resolve(repoPath), '').toLowerCase();
  return !DEFAULT_DENYLIST.some((d) => rel.includes(d));
}
