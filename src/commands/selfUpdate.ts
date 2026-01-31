import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createTwoFilesPatch } from 'diff';

export type SelfUpdateOpts = {
  goal?: string;
  apply: boolean;
};

/**
 * v0 behavior:
 * - requires a goal
 * - proposes a trivial, safe change (updates docs/NEXT.md) to prove the pipeline
 * Next iteration will:
 * - ask an LLM to draft a change plan + file edits
 * - run tests
 * - commit
 */
export async function selfUpdate(opts: SelfUpdateOpts): Promise<void> {
  if (!opts.goal) {
    console.error('Missing required --goal "..."');
    process.exitCode = 2;
    return;
  }

  // For v0: demonstrate the mutation pipeline by appending to LOG.md.
  const path = 'LOG.md';
  const before = readFileSync(path, 'utf8');
  const addition = `\n- Self-update requested (v0 no-op implementation): ${opts.goal}\n`;
  const after = before + addition;

  const patch = createTwoFilesPatch(path, path, before, after, 'before', 'after');

  console.log('SELF-UPDATE PLAN (v0)');
  console.log(`Goal: ${opts.goal}`);
  console.log('Change: append a line to LOG.md (prove apply/diff flow)');
  console.log('\nDIFF');
  console.log(patch);

  if (!opts.apply) {
    console.log('\nNot applied. Re-run with --apply to write changes.');
    return;
  }

  writeFileSync(path, after, 'utf8');

  // Stage but do not commit automatically in v0.
  execSync(`git add ${path}`);
  console.log(`\nApplied and staged: ${path}`);
  console.log('Next: run tests/build then commit.');
}
