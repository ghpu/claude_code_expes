/**
 * Real Worker Implementation using Anthropic API
 * Implements tasks under Manager supervision with real Claude intelligence
 */

import { EventEmitter } from 'events';
import { ClaudeProcess, ClaudeResponse, ToolCall } from './claude-process';
import { ToolExecutor, ToolExecutionResult } from './tool-executor';
import { Task, Implementation } from '../types';

export interface RealWorkerConfig {
  apiKey: string;
  workingDirectory: string;
  model?: string;
  debug?: boolean;
}

export interface ToolApprovalRequest {
  toolCall: ToolCall;
  taskId: string;
  reason?: string;
}

export interface ToolApprovalResponse {
  approved: boolean;
  reason?: string;
  modifiedInput?: Record<string, any>;
}

/**
 * Real Worker that uses Claude API to implement tasks
 */
export class RealWorker extends EventEmitter {
  private claude: ClaudeProcess;
  private toolExecutor: ToolExecutor;
  private config: RealWorkerConfig;
  private currentTask: Task | null = null;
  private implementation: Implementation | null = null;
  private pendingToolCalls: Map<string, ToolCall> = new Map();

  constructor(config: RealWorkerConfig) {
    super();
    this.config = config;

    // Initialize Claude process with Worker system prompt
    this.claude = new ClaudeProcess({
      apiKey: config.apiKey,
      workingDirectory: config.workingDirectory,
      model: config.model || 'claude-sonnet-4-20250514',
      systemPrompt: this.getWorkerSystemPrompt(),
    });

    // Initialize tool executor
    this.toolExecutor = new ToolExecutor(config.workingDirectory);

    this.setupEventHandlers();
  }

  /**
   * Get the system prompt for the Worker
   */
  private getWorkerSystemPrompt(): string {
    return `You are a meticulous software engineer implementing tasks with the highest quality standards.

CRITICAL RULES - NO EXCEPTIONS:

1. **NO SHORTCUTS EVER**
   - Write complete, production-ready code
   - Never use placeholders, TODOs, or "implement this later" comments
   - Never use mock implementations unless explicitly requested
   - Never skip error handling

2. **TESTS ARE MANDATORY**
   - Write comprehensive tests for ALL code
   - Tests must actually run and pass
   - Include unit tests and integration tests
   - Test edge cases and error conditions

3. **COMPLETE IMPLEMENTATION**
   - Implement every feature completely
   - Handle all edge cases
   - Add proper error handling and validation
   - Include logging where appropriate

4. **DOCUMENTATION**
   - Document all functions and complex logic
   - Include usage examples
   - Write clear commit messages
   - Add README/setup instructions if needed

5. **CODE QUALITY**
   - Follow language best practices
   - Write clean, readable code
   - Use meaningful variable names
   - Keep functions focused and small

6. **VERIFICATION**
   - After writing code, use tools to verify it works
   - Run tests and show passing results
   - Check for syntax errors
   - Verify all dependencies are in place

Your work will be reviewed by a strict Manager who will REJECT incomplete work.
Take your time, be thorough, and do it right the first time.

Available tools: Read, Write, Edit, Bash, Glob, Grep
Working directory: ${this.config.workingDirectory}`;
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.claude.on('response', (response: ClaudeResponse) => {
      if (this.config.debug) {
        console.log('[Worker] Claude response received');
        console.log(`  Text: ${response.text.substring(0, 200)}...`);
        console.log(`  Tool calls: ${response.toolCalls.length}`);
      }
    });

    this.claude.on('error', (error) => {
      console.error('[Worker] Claude API error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Execute a task
   */
  async executeTask(task: Task): Promise<Implementation> {
    this.currentTask = task;
    this.implementation = {
      taskId: task.id,
      files: [],
      tests: [],
      documentation: '',
      completionNotes: '',
    };

    console.log(`\n[Worker] Starting task: ${task.description}`);
    console.log(`[Worker] Requirements: ${task.requirements.length}`);
    console.log(`[Worker] Constraints: ${task.constraints.length}`);

    // Send initial task to Claude
    const initialPrompt = this.buildTaskPrompt(task);
    let response = await this.claude.sendMessage(initialPrompt);

    // Main execution loop
    let maxIterations = 50; // Prevent infinite loops
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;

      // Process response text
      if (response.text) {
        console.log(`[Worker] ${response.text.substring(0, 150)}...`);
      }

      // Check if task is complete
      if (this.isTaskComplete(response)) {
        console.log('[Worker] Task execution complete');
        break;
      }

      // Process tool calls
      if (response.toolCalls.length > 0) {
        const toolResults = await this.processToolCalls(response.toolCalls);
        response = await this.claude.sendMessage('', toolResults);
      } else {
        // No tool calls and not complete - prompt for action
        response = await this.claude.sendMessage(
          'Please continue with the implementation. Use tools to write code, run tests, and verify your work.'
        );
      }
    }

    if (iteration >= maxIterations) {
      throw new Error('Worker exceeded maximum iterations');
    }

    return this.implementation!;
  }

  /**
   * Build the initial task prompt
   */
  private buildTaskPrompt(task: Task): string {
    let prompt = `# Task Assignment\n\n`;
    prompt += `**Description**: ${task.description}\n\n`;

    if (task.requirements.length > 0) {
      prompt += `## Requirements\n`;
      task.requirements.forEach((req, i) => {
        prompt += `${i + 1}. ${req}\n`;
      });
      prompt += `\n`;
    }

    if (task.constraints.length > 0) {
      prompt += `## Constraints\n`;
      task.constraints.forEach((constraint, i) => {
        prompt += `${i + 1}. ${constraint}\n`;
      });
      prompt += `\n`;
    }

    if (task.deliverables.length > 0) {
      prompt += `## Deliverables\n`;
      task.deliverables.forEach((deliverable, i) => {
        prompt += `${i + 1}. ${deliverable}\n`;
      });
      prompt += `\n`;
    }

    prompt += `## Instructions\n\n`;
    prompt += `1. Implement this task COMPLETELY - no shortcuts\n`;
    prompt += `2. Write comprehensive tests that actually run and pass\n`;
    prompt += `3. Document your code properly\n`;
    prompt += `4. Verify everything works before submitting\n\n`;
    prompt += `Use the available tools to:\n`;
    prompt += `- Read existing code (Read, Glob, Grep)\n`;
    prompt += `- Write new code (Write, Edit)\n`;
    prompt += `- Run tests (Bash)\n`;
    prompt += `- Verify your work (Bash, Read)\n\n`;
    prompt += `Begin implementation now.`;

    return prompt;
  }

  /**
   * Process tool calls - request approval and execute
   */
  private async processToolCalls(
    toolCalls: ToolCall[]
  ): Promise<Array<{ toolUseId: string; content: string; isError?: boolean }>> {
    const results: Array<{ toolUseId: string; content: string; isError?: boolean }> = [];

    for (const toolCall of toolCalls) {
      console.log(`[Worker] Tool call: ${toolCall.name}`);

      // Store pending tool call
      this.pendingToolCalls.set(toolCall.id, toolCall);

      // Request approval from Manager
      const approvalRequest: ToolApprovalRequest = {
        toolCall,
        taskId: this.currentTask!.id,
        reason: `Executing ${toolCall.name} for task implementation`,
      };

      this.emit('tool_approval_request', approvalRequest);

      // Wait for approval (handled by orchestrator)
      const approval = await this.waitForApproval(toolCall.id);

      if (!approval.approved) {
        console.log(`[Worker] ✗ Tool call blocked: ${approval.reason}`);
        results.push({
          toolUseId: toolCall.id,
          content: `Tool execution blocked by Manager: ${approval.reason || 'No reason provided'}`,
          isError: true,
        });
        continue;
      }

      console.log(`[Worker] ✓ Tool call approved`);

      // Execute the tool
      const input = approval.modifiedInput || toolCall.input;
      const result = await this.toolExecutor.executeTool(toolCall.name, input);

      if (result.success) {
        console.log(`[Worker] Tool executed successfully (${result.duration}ms)`);
        results.push({
          toolUseId: toolCall.id,
          content: result.output || 'Success',
          isError: false,
        });

        // Track file operations
        this.trackFileOperation(toolCall.name, input, result);
      } else {
        console.log(`[Worker] Tool execution failed: ${result.error}`);
        results.push({
          toolUseId: toolCall.id,
          content: `Error: ${result.error}`,
          isError: true,
        });
      }

      this.pendingToolCalls.delete(toolCall.id);
    }

    return results;
  }

  /**
   * Wait for tool approval from Manager
   */
  private waitForApproval(toolCallId: string): Promise<ToolApprovalResponse> {
    return new Promise((resolve) => {
      const handler = (response: ToolApprovalResponse & { toolCallId: string }) => {
        if (response.toolCallId === toolCallId) {
          this.removeListener('tool_approval_response', handler);
          resolve(response);
        }
      };
      this.on('tool_approval_response', handler);
    });
  }

  /**
   * Approve a tool call (called by orchestrator)
   */
  approveToolCall(toolCallId: string, approved: boolean, reason?: string, modifiedInput?: Record<string, any>): void {
    this.emit('tool_approval_response', {
      toolCallId,
      approved,
      reason,
      modifiedInput,
    });
  }

  /**
   * Track file operations for implementation
   */
  private trackFileOperation(toolName: string, input: Record<string, any>, result: ToolExecutionResult): void {
    if (!this.implementation) return;

    if (toolName === 'Write' && result.success) {
      this.implementation.files.push({
        path: input.file_path,
        action: 'created',
        content: input.content,
      });
    } else if (toolName === 'Edit' && result.success) {
      this.implementation.files.push({
        path: input.file_path,
        action: 'modified',
      });
    }

    // Track test execution
    if (toolName === 'Bash' && result.success) {
      const command = input.command.toLowerCase();
      if (command.includes('test') || command.includes('jest') || command.includes('pytest')) {
        const passed = !result.output?.toLowerCase().includes('failed');
        this.implementation.tests.push({
          path: 'tests',
          passed,
          results: result.output,
        });
      }
    }
  }

  /**
   * Check if task is complete
   */
  private isTaskComplete(response: ClaudeResponse): boolean {
    const text = response.text.toLowerCase();

    // Check for completion indicators
    const completionPhrases = [
      'task complete',
      'implementation complete',
      'all tests passing',
      'ready for review',
      'implementation finished',
    ];

    return completionPhrases.some((phrase) => text.includes(phrase)) && response.toolCalls.length === 0;
  }

  /**
   * Get current implementation
   */
  getImplementation(): Implementation | null {
    return this.implementation;
  }

  /**
   * Get token usage
   */
  getTokenUsage(): { input: number; output: number; total: number } {
    return this.claude.getTokenUsage();
  }

  /**
   * Provide feedback from Manager
   */
  async provideFeedback(feedback: string): Promise<void> {
    console.log('[Worker] Received feedback from Manager');
    await this.claude.sendMessage(`\n# Manager Feedback\n\n${feedback}\n\nPlease address these issues and continue.`);
  }
}
