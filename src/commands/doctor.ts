import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

export async function doctor(): Promise<void> {
  const checks: Array<[string, boolean, string?]> = [];

  checks.push(['git repo initialized', existsSync('.git')]);
  checks.push(['package.json present', existsSync('package.json')]);

  try {
    execSync('git status --porcelain=v1', { stdio: 'ignore' });
    checks.push(['git executable', true]);
  } catch (e) {
    checks.push(['git executable', false, String(e)]);
  }

  for (const [name, ok, detail] of checks) {
    const prefix = ok ? 'OK ' : 'FAIL';
    console.log(`${prefix} - ${name}`);
    if (!ok && detail) console.log(`       ${detail}`);
  }

  const failed = checks.some((c) => !c[1]);
  if (failed) process.exitCode = 1;
}
