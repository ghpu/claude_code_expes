/**
 * Claude Code CLI Process Spawner
 * Spawns actual `claude` CLI processes using existing Claude Code Max authentication
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import * as path from 'path';

export interface ClaudeCLIConfig {
  workingDirectory: string;
  claudePath?: string;
  debug?: boolean;
}

export interface ClaudeCLIResponse {
  text: string;
  isComplete: boolean;
  containsToolUse: boolean;
}

/**
 * Manages a Claude Code CLI process
 */
export class ClaudeCLIProcess extends EventEmitter {
  private process: ChildProcess | null = null;
  private config: ClaudeCLIConfig;
  private outputBuffer: string = '';
  private isReady: boolean = false;
  private currentPrompt: string = '';

  constructor(config: ClaudeCLIConfig) {
    super();
    this.config = {
      claudePath: '/opt/node22/bin/claude',
      ...config,
    };
  }

  /**
   * Start the Claude CLI process
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Spawn claude process in interactive mode
        this.process = spawn(this.config.claudePath!, [], {
          cwd: this.config.workingDirectory,
          stdio: ['pipe', 'pipe', 'pipe'],
          env: {
            ...process.env,
            // Ensure Claude Code authentication is passed through
            CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR: process.env.CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR,
            CLAUDE_CODE_WEBSOCKET_AUTH_FILE_DESCRIPTOR: process.env.CLAUDE_CODE_WEBSOCKET_AUTH_FILE_DESCRIPTOR,
            CLAUDE_CODE_CONTAINER_ID: process.env.CLAUDE_CODE_CONTAINER_ID,
            // Disable interactive prompts
            NO_COLOR: '1',
          },
        });

        if (!this.process.stdout || !this.process.stderr || !this.process.stdin) {
          throw new Error('Failed to setup process stdio');
        }

        // Handle stdout
        this.process.stdout.on('data', (data: Buffer) => {
          const text = data.toString();
          this.outputBuffer += text;

          if (this.config.debug) {
            console.log('[CLI Process] Output:', text);
          }

          this.emit('output', text);

          // Check if Claude is ready for input
          if (text.includes('>') || text.includes('?')) {
            this.isReady = true;
            this.emit('ready');
          }
        });

        // Handle stderr
        this.process.stderr.on('data', (data: Buffer) => {
          const text = data.toString();
          if (this.config.debug) {
            console.error('[CLI Process] Error:', text);
          }
          this.emit('error_output', text);
        });

        // Handle process exit
        this.process.on('exit', (code) => {
          if (this.config.debug) {
            console.log(`[CLI Process] Exited with code ${code}`);
          }
          this.emit('exit', code);
        });

        // Handle process errors
        this.process.on('error', (error) => {
          console.error('[CLI Process] Process error:', error);
          reject(error);
        });

        // Wait for initial ready state
        const readyTimeout = setTimeout(() => {
          if (!this.isReady) {
            console.log('[CLI Process] Assuming ready after timeout');
            this.isReady = true;
            resolve();
          }
        }, 3000);

        this.once('ready', () => {
          clearTimeout(readyTimeout);
          resolve();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Send a prompt to Claude
   */
  async sendPrompt(prompt: string): Promise<ClaudeCLIResponse> {
    if (!this.process || !this.process.stdin) {
      throw new Error('Process not started');
    }

    this.currentPrompt = prompt;
    this.outputBuffer = '';

    // Write prompt to stdin
    this.process.stdin.write(prompt + '\n');

    if (this.config.debug) {
      console.log('[CLI Process] Sent prompt:', prompt.substring(0, 100) + '...');
    }

    // Wait for response
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        // Check if we have a complete response
        // Claude typically ends with a prompt character or completion marker
        if (this.isResponseComplete(this.outputBuffer)) {
          clearInterval(checkInterval);

          const response: ClaudeCLIResponse = {
            text: this.outputBuffer,
            isComplete: true,
            containsToolUse: this.containsToolUse(this.outputBuffer),
          };

          resolve(response);
        }
      }, 500);

      // Timeout after 2 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve({
          text: this.outputBuffer,
          isComplete: false,
          containsToolUse: false,
        });
      }, 120000);
    });
  }

  /**
   * Check if response is complete
   */
  private isResponseComplete(output: string): boolean {
    // Look for completion indicators
    const indicators = [
      'Task complete',
      'Implementation complete',
      'done',
      // Claude often ends responses with these
      '```\n',
      '\n\n>',
      'What would you like',
    ];

    return indicators.some((indicator) => output.toLowerCase().includes(indicator.toLowerCase()));
  }

  /**
   * Check if output contains tool use
   */
  private containsToolUse(output: string): boolean {
    const toolPatterns = [
      /<function_calls>/,
      /\[Tool:/,
      /Using tool:/,
      /Executing:/,
    ];

    return toolPatterns.some((pattern) => pattern.test(output));
  }

  /**
   * Stop the process
   */
  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = null;
      this.isReady = false;
    }
  }

  /**
   * Check if process is running
   */
  isRunning(): boolean {
    return this.process !== null && !this.process.killed;
  }

  /**
   * Get current output buffer
   */
  getOutput(): string {
    return this.outputBuffer;
  }

  /**
   * Clear output buffer
   */
  clearOutput(): void {
    this.outputBuffer = '';
  }
}
