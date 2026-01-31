#!/usr/bin/env node
import { Command } from 'commander';
import { doctor } from './commands/doctor.js';
import { selfUpdate } from './commands/selfUpdate.js';

const program = new Command();
program
  .name('autobot')
  .description('Self-modifying CLI agent (local codegen self-updates).')
  .version('0.0.1');

program
  .command('doctor')
  .description('Sanity checks for the environment and repo.')
  .action(async () => {
    await doctor();
  });

program
  .command('self-update')
  .description('Generate and apply code changes to add new features (guardrailed).')
  .option('-g, --goal <text>', 'What capability to add')
  .option('--apply', 'Apply changes after presenting a plan and diff', false)
  .action(async (opts) => {
    await selfUpdate({ goal: opts.goal, apply: !!opts.apply });
  });

program.parseAsync(process.argv);
