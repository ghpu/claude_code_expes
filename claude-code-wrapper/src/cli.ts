#!/usr/bin/env node

/**
 * CLI entry point for Claude Code Wrapper
 */

import { run } from './orchestrator';
import { WrapperConfig } from './types';
import * as fs from 'fs';
import * as path from 'path';

interface CLIOptions {
  config?: string;
  debug?: boolean;
  strictness?: 'low' | 'medium' | 'high' | 'extreme';
  allowMocks?: boolean;
  requireTests?: boolean;
  workingDir?: string;
}

function printUsage(): void {
  console.log(`
Claude Code Wrapper - Dual Instance Mode

Usage:
  claude-wrapper [options] "<task description>"

Options:
  --config <file>         Path to config JSON file
  --debug                 Enable debug mode
  --strictness <level>    Quality strictness: low, medium, high, extreme (default: high)
  --allow-mocks          Allow mock implementations
  --no-tests             Don't require tests
  --working-dir <dir>    Working directory (default: current)
  --help                 Show this help message

Examples:
  claude-wrapper "Build a REST API with authentication"
  claude-wrapper --strictness extreme "Implement user management system"
  claude-wrapper --config myconfig.json "Add feature X"

The wrapper uses two Claude Code instances:
  1. Manager: Plans, tracks, and critiques
  2. Worker: Implements under strict supervision

This ensures complete, tested, working code with no shortcuts.
`);
}

function parseArgs(): { options: CLIOptions; task: string | null } {
  const args = process.argv.slice(2);
  const options: CLIOptions = {};
  let task: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;

      case '--config':
        options.config = args[++i];
        break;

      case '--debug':
        options.debug = true;
        break;

      case '--strictness':
        options.strictness = args[++i] as any;
        break;

      case '--allow-mocks':
        options.allowMocks = true;
        break;

      case '--no-tests':
        options.requireTests = false;
        break;

      case '--working-dir':
        options.workingDir = args[++i];
        break;

      default:
        if (!arg.startsWith('--')) {
          task = arg;
        }
    }
  }

  return { options, task };
}

function loadConfig(configPath: string): Partial<WrapperConfig> {
  try {
    const fullPath = path.resolve(configPath);
    const content = fs.readFileSync(fullPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading config file: ${error}`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         CLAUDE CODE WRAPPER - DUAL INSTANCE MODE              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const { options, task } = parseArgs();

  if (!task) {
    console.error('Error: Task description is required\n');
    printUsage();
    process.exit(1);
  }

  // Load config
  let config: Partial<WrapperConfig> = {};

  if (options.config) {
    config = loadConfig(options.config);
  }

  // Apply CLI options
  if (!config.manager) config.manager = {};
  if (!config.worker) config.worker = {};
  if (!config.logging) config.logging = {};

  if (options.strictness) {
    config.manager.strictness = options.strictness;
  }

  if (options.allowMocks !== undefined) {
    config.manager.allowMocks = options.allowMocks;
  }

  if (options.requireTests !== undefined) {
    config.manager.requireTests = options.requireTests;
  }

  if (options.workingDir) {
    config.worker.workingDirectory = options.workingDir;
  }

  if (options.debug) {
    config.logging.level = 'debug';
  }

  // Display configuration
  console.log('Configuration:');
  console.log(`  Strictness: ${config.manager.strictness || 'high'}`);
  console.log(`  Allow Mocks: ${config.manager.allowMocks || false}`);
  console.log(`  Require Tests: ${config.manager.requireTests !== false}`);
  console.log(`  Working Dir: ${config.worker.workingDirectory || process.cwd()}`);
  console.log('');

  try {
    await run(task, config);
    process.exit(0);
  } catch (error) {
    console.error('\n✗ Fatal error:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
  process.exit(1);
});

// Handle SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  console.log('\n\nInterrupted by user');
  process.exit(130);
});

// Run CLI
main();
