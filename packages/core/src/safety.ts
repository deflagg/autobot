import { simpleGit, SimpleGit } from 'simple-git';
import { resolve, sep } from 'node:path';

export const DEFAULT_DENYLIST = ['.git/**', '.env', '*.pem', '*.key', '**/*token*', '**/*credentials*'];

export async function ensureCleanTree(repoPath: string, git?: SimpleGit) {
  const g = git || simpleGit(repoPath);
  const status = await g.status();
  if (!status.isClean()) {
    throw new Error('GIT_DIRTY');
  }
}

function normalizeRelPath(repoPath: string, targetPath: string): string {
  const rel = resolve(targetPath).replace(resolve(repoPath), '').replace(/^[/\\]/, '');
  return rel.split(sep).join('/');
}

function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  const regex = escaped
    .replace(/\\\*\\\*/g, '.*')
    .replace(/\\\*/g, '[^/]*');
  return new RegExp(`^${regex}$`, 'i');
}

function matchesAny(path: string, patterns: string[] = []): boolean {
  return patterns.some((p) => globToRegex(p).test(path));
}

export function isPathAllowed(repoPath: string, targetPath: string, allowlist: string[] = [], denylist: string[] = DEFAULT_DENYLIST): boolean {
  const rel = normalizeRelPath(repoPath, targetPath);
  if (allowlist.length > 0 && !matchesAny(rel, allowlist)) return false;
  if (matchesAny(rel, denylist)) return false;
  return true;
}

export function extractPatchPaths(patchText: string): string[] {
  const paths = new Set<string>();
  for (const line of patchText.split('\n')) {
    if (line.startsWith('+++ b/')) {
      const p = line.slice(6).trim();
      if (p && p !== '/dev/null') paths.add(p);
    }
    if (line.startsWith('--- a/')) {
      const p = line.slice(6).trim();
      if (p && p !== '/dev/null') paths.add(p);
    }
  }
  return Array.from(paths);
}

export function ensurePatchPathsAllowed(repoPath: string, patchText: string, allowlist: string[] = [], denylist: string[] = DEFAULT_DENYLIST) {
  const paths = extractPatchPaths(patchText);
  for (const p of paths) {
    const full = resolve(repoPath, p);
    if (!isPathAllowed(repoPath, full, allowlist, denylist)) {
      throw new Error(`FORBIDDEN_PATH:${p}`);
    }
  }
}
