#!/usr/bin/env node

/**
 * CLI entry point for Real Claude Code Wrapper using Anthropic API
 */

import { RealOrchestrator } from './anthropic/real-orchestrator';
import * as fs from 'fs';
import * as path from 'path';

interface CLIOptions {
  config?: string;
  apiKey?: string;
  debug?: boolean;
  strictness?: 'low' | 'medium' | 'high' | 'extreme';
  allowMocks?: boolean;
  requireTests?: boolean;
  workingDir?: string;
}

function printUsage(): void {
  console.log(`
Claude Code Wrapper - REAL Dual Instance Mode (Anthropic API)

Usage:
  claude-wrapper [options] "<task description>"

Options:
  --config <file>         Path to config JSON file
  --api-key <key>         Anthropic API key (or set ANTHROPIC_API_KEY env var)
  --debug                 Enable debug mode
  --strictness <level>    Quality strictness: low, medium, high, extreme (default: high)
  --allow-mocks          Allow mock implementations
  --no-tests             Don't require tests
  --working-dir <dir>    Working directory (default: current)
  --help                 Show this help message

Environment Variables:
  ANTHROPIC_API_KEY      Your Anthropic API key

Examples:
  claude-wrapper "Build a REST API with authentication"
  claude-wrapper --strictness extreme "Implement user management system"
  claude-wrapper --api-key sk-... "Add feature X"

This wrapper uses TWO REAL Claude instances via the Anthropic API:
  1. Manager: Plans, tracks, and provides strict code review
  2. Worker: Implements under Manager's supervision

This ensures complete, tested, working code with NO SHORTCUTS.
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

      case '--api-key':
        options.apiKey = args[++i];
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

function getApiKey(options: CLIOptions): string {
  // Try command line option
  if (options.apiKey) {
    return options.apiKey;
  }

  // Try environment variable
  if (process.env.ANTHROPIC_API_KEY) {
    return process.env.ANTHROPIC_API_KEY;
  }

  // Try reading from config file
  if (options.config) {
    try {
      const fullPath = path.resolve(options.config);
      const content = fs.readFileSync(fullPath, 'utf-8');
      const config = JSON.parse(content);
      if (config.apiKey) {
        return config.apiKey;
      }
    } catch (error) {
      // Config file not found or doesn't have apiKey
    }
  }

  // Try reading from ~/.claude-wrapper/config.json
  try {
    const homeDir = process.env.HOME || process.env.USERPROFILE;
    if (homeDir) {
      const configPath = path.join(homeDir, '.claude-wrapper', 'config.json');
      if (fs.existsSync(configPath)) {
        const content = fs.readFileSync(configPath, 'utf-8');
        const config = JSON.parse(content);
        if (config.apiKey) {
          return config.apiKey;
        }
      }
    }
  } catch (error) {
    // No config file in home directory
  }

  console.error('Error: Anthropic API key is required');
  console.error('');
  console.error('Provide it via:');
  console.error('  1. --api-key flag');
  console.error('  2. ANTHROPIC_API_KEY environment variable');
  console.error('  3. apiKey field in config JSON');
  console.error('  4. ~/.claude-wrapper/config.json file');
  console.error('');
  console.error('Get your API key from: https://console.anthropic.com/');
  process.exit(1);
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║      CLAUDE WRAPPER - REAL DUAL INSTANCE MODE (API)          ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const { options, task } = parseArgs();

  if (!task) {
    console.error('Error: Task description is required\n');
    printUsage();
    process.exit(1);
  }

  // Get API key
  const apiKey = getApiKey(options);

  // Build configuration
  const workingDirectory = options.workingDir || process.cwd();
  const strictness = options.strictness || 'high';
  const allowMocks = options.allowMocks !== undefined ? options.allowMocks : false;
  const requireTests = options.requireTests !== undefined ? options.requireTests : true;

  console.log('Configuration:');
  console.log(`  Strictness: ${strictness}`);
  console.log(`  Allow Mocks: ${allowMocks}`);
  console.log(`  Require Tests: ${requireTests}`);
  console.log(`  Working Dir: ${workingDirectory}`);
  console.log(`  Debug: ${options.debug || false}`);
  console.log('');

  try {
    // Create orchestrator
    const orchestrator = new RealOrchestrator({
      apiKey,
      workingDirectory,
      manager: {
        strictness: strictness as any,
        allowMocks,
        requireTests,
        requireDocumentation: true,
        maxIterations: 5,
        qualityGates: ['tests', 'type-checking'],
        reviewTimeout: 300000,
        autoApproveSimpleChanges: false,
      },
      worker: {
        model: 'claude-sonnet-4-20250514',
      },
      debug: options.debug,
    });

    // Run the task
    await orchestrator.run(task);

    console.log('\n✓ Task completed successfully!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n✗ Fatal error:', error.message);
    if (options.debug) {
      console.error(error.stack);
    }
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
