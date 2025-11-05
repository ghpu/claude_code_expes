#!/usr/bin/env node

/**
 * CLI for Claude Code Max users - checks for API key and provides guidance
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
  useClaudeCodeAuth?: boolean;
}

function printUsage(): void {
  console.log(`
Claude Code Wrapper - REAL Dual Instance Mode

Usage:
  claude-wrapper [options] "<task description>"

Options:
  --config <file>           Path to config JSON file
  --api-key <key>           Anthropic API key
  --use-claude-code-auth    Try to use Claude Code's authentication (experimental)
  --debug                   Enable debug mode
  --strictness <level>      Quality strictness: low, medium, high, extreme (default: high)
  --allow-mocks            Allow mock implementations
  --no-tests               Don't require tests
  --working-dir <dir>      Working directory (default: current)
  --help                   Show this help message

Environment Variables:
  ANTHROPIC_API_KEY        Your Anthropic API key

Getting Your API Key (for Claude Code Max users):
  1. Go to: https://console.anthropic.com/
  2. Sign in with the same account as your Claude Code subscription
  3. Navigate to "API Keys" section
  4. Create a new key (you may have free credits!)
  5. Set it: export ANTHROPIC_API_KEY="sk-ant-..."

Note: Claude Code subscription and Anthropic API are separate services,
      but you can use the same account for both.

Examples:
  claude-wrapper --api-key sk-ant-... "Build a REST API"
  claude-wrapper "Your task"  # Uses ANTHROPIC_API_KEY env var

This wrapper uses TWO REAL Claude instances to enforce code quality.
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

      case '--use-claude-code-auth':
        options.useClaudeCodeAuth = true;
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

function getApiKey(options: CLIOptions): string | null {
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

  return null;
}

function printApiKeyHelp(): void {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║             API KEY REQUIRED                                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  console.log('You have Claude Code Max, but need an Anthropic API key for dual-instance mode.\n');

  console.log('📝 Quick Setup (2 minutes):\n');
  console.log('1. Open: https://console.anthropic.com/');
  console.log('   → Sign in with your Claude account');
  console.log('');
  console.log('2. Go to "API Keys" section');
  console.log('   → Click "Create Key"');
  console.log('   → Name it "Claude Wrapper"');
  console.log('   → Copy the key (starts with sk-ant-)');
  console.log('');
  console.log('3. Set the key:');
  console.log('   export ANTHROPIC_API_KEY="sk-ant-your-key-here"');
  console.log('');
  console.log('4. Run again:');
  console.log('   npm start -- "your task"');
  console.log('');
  console.log('💡 Benefits of using the API:');
  console.log('   ✓ Two REAL Claude instances working together');
  console.log('   ✓ Manager enforces NO SHORTCUTS policy');
  console.log('   ✓ Automatic code review and rejection of lazy work');
  console.log('   ✓ Iteration until code meets high standards');
  console.log('');
  console.log('💰 Cost: ~$0.30-$0.90 per task (you may have free credits!)');
  console.log('');
  console.log('═══════════════════════════════════════════════════════════════\n');
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║      CLAUDE WRAPPER - REAL DUAL INSTANCE MODE                 ║');
  console.log('║      For Claude Code Max Users                                 ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  const { options, task } = parseArgs();

  if (!task) {
    console.error('Error: Task description is required\n');
    printUsage();
    process.exit(1);
  }

  // Get API key
  const apiKey = getApiKey(options);

  if (!apiKey) {
    printApiKeyHelp();
    process.exit(1);
  }

  console.log('✓ API key found');
  console.log('');

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
