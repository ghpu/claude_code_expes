/**
 * Worker instance - handles implementation under Manager supervision
 */

import { EventEmitter } from 'events';
import {
  Message,
  MessageType,
  Task,
  WorkerConfig,
  ToolUseRequest,
  ToolUseResult,
  Implementation,
} from '../types';
import { FileChannel } from '../communication/channel';
import { Protocol } from '../communication/protocol';
import { v4 as uuidv4 } from 'uuid';

export class Worker extends EventEmitter {
  private config: WorkerConfig;
  private channel: FileChannel;
  private currentTask: Task | null = null;
  private pendingApprovals: Map<string, { resolve: Function; reject: Function }> = new Map();
  private toolResults: Map<string, ToolUseResult> = new Map();
  private implementation: Implementation | null = null;

  constructor(channelPath: string, config: WorkerConfig) {
    super();
    this.config = config;
    this.channel = new FileChannel(channelPath, 'worker', {
      type: 'file',
      queueSize: 100,
      timeout: 30000,
      heartbeatInterval: 5000,
      channelPath,
    });
  }

  async initialize(): Promise<void> {
    await this.channel.initialize();
    this.setupMessageHandlers();
    console.log('[Worker] Initialized and ready to receive tasks');
  }

  /**
   * Setup message handlers for Manager communication
   */
  private setupMessageHandlers(): void {
    this.channel.on('message', async (message: Message) => {
      try {
        await this.handleMessage(message);
      } catch (error) {
        console.error('[Worker] Error handling message:', error);
        await this.reportError(error);
      }
    });
  }

  /**
   * Handle incoming messages from Manager
   */
  private async handleMessage(message: Message): Promise<void> {
    switch (message.type) {
      case MessageType.TASK_ASSIGNED:
        await this.handleTaskAssignment(message);
        break;

      case MessageType.TOOL_USE_APPROVED:
      case MessageType.TOOL_USE_BLOCKED:
        await this.handleToolUseApproval(message);
        break;

      case MessageType.REVIEW_FEEDBACK:
        await this.handleReviewFeedback(message);
        break;

      case MessageType.IMPLEMENTATION_APPROVED:
        await this.handleImplementationApproved(message);
        break;

      case MessageType.IMPLEMENTATION_REJECTED:
        await this.handleImplementationRejected(message);
        break;

      case MessageType.TERMINATE:
        await this.handleTerminate();
        break;

      default:
        console.log(`[Worker] Unhandled message type: ${message.type}`);
    }
  }

  /**
   * Handle task assignment from Manager
   */
  private async handleTaskAssignment(message: Message): Promise<void> {
    const task: Task = message.payload.task;

    console.log(`\n[Worker] Received task: ${task.description}`);
    console.log(`[Worker] Priority: ${task.priority}`);

    if (message.payload.checklist) {
      console.log(`[Worker] Checklist items: ${message.payload.checklist.length}`);
    }

    this.currentTask = task;

    // Initialize implementation tracking
    this.implementation = {
      taskId: task.id,
      files: [],
      tests: [],
      documentation: '',
      completionNotes: '',
    };

    // Send status update
    await this.sendStatusUpdate({
      taskId: task.id,
      phase: 'started',
      message: `Started working on: ${task.description}`,
    });

    // Start working on the task
    // In a real implementation, this would invoke Claude Code SDK
    // For now, we'll simulate the workflow
    await this.executeTask(task, message.payload);
  }

  /**
   * Execute a task
   */
  private async executeTask(task: Task, taskPayload: any): Promise<void> {
    console.log(`[Worker] Executing task...`);

    // Simulate task execution phases
    try {
      // Phase 1: Analysis
      console.log(`[Worker] Phase 1: Analyzing requirements...`);
      await this.requestToolUse('Read', { file_path: '/some/file' }, 'Read existing code', task.id, 'low');

      // Phase 2: Implementation
      console.log(`[Worker] Phase 2: Implementing...`);
      await this.requestToolUse(
        'Write',
        { file_path: '/some/new/file', content: 'implementation' },
        'Create implementation file',
        task.id,
        'high'
      );

      // Phase 3: Testing
      console.log(`[Worker] Phase 3: Writing tests...`);
      await this.requestToolUse(
        'Write',
        { file_path: '/some/test/file', content: 'tests' },
        'Create test file',
        task.id,
        'medium'
      );

      // Phase 4: Documentation
      console.log(`[Worker] Phase 4: Documenting...`);
      this.implementation!.documentation = 'Comprehensive documentation for the implementation';

      // Add completion notes
      this.implementation!.completionNotes = `Task completed: ${task.description}`;

      // Submit for review
      await this.submitImplementation();
    } catch (error) {
      console.error(`[Worker] Error executing task:`, error);
      await this.reportError(error);
    }
  }

  /**
   * Request tool use approval from Manager
   */
  private async requestToolUse(
    toolName: string,
    parameters: Record<string, any>,
    reason: string,
    taskId: string,
    impact: 'low' | 'medium' | 'high'
  ): Promise<boolean> {
    console.log(`[Worker] Requesting approval for ${toolName}...`);

    // Create request
    const request: ToolUseRequest = {
      toolName,
      parameters,
      reason,
      taskId,
      impact,
    };

    // Send request to Manager
    const message = Protocol.toolUseRequest(request);

    try {
      // Wait for approval
      const response = await this.channel.sendAndWaitForReply(message, this.config.hookTimeout);

      if (response.type === MessageType.TOOL_USE_APPROVED) {
        console.log(`[Worker] ✓ Tool use approved`);

        // Execute the tool (simulated)
        const result = await this.executeTool(toolName, parameters);

        // Report completion
        await this.reportToolUseCompleted(toolName, result);

        return true;
      } else {
        console.log(`[Worker] ✗ Tool use blocked: ${response.payload.reason}`);
        return false;
      }
    } catch (error) {
      console.error(`[Worker] Error requesting tool approval:`, error);
      return false;
    }
  }

  /**
   * Execute a tool (simulated)
   */
  private async executeTool(toolName: string, parameters: Record<string, any>): Promise<ToolUseResult> {
    console.log(`[Worker] Executing ${toolName}...`);

    // Simulate tool execution
    const startTime = Date.now();

    // In a real implementation, this would call Claude Code SDK tools
    // For now, we simulate success

    // Track in implementation
    if (this.implementation) {
      if (toolName === 'Write' || toolName === 'Edit') {
        this.implementation.files.push({
          path: parameters.file_path,
          action: toolName === 'Write' ? 'created' : 'modified',
          content: parameters.content,
        });
      }
    }

    const result: ToolUseResult = {
      toolName,
      success: true,
      output: 'Tool executed successfully',
      duration: Date.now() - startTime,
    };

    this.toolResults.set(toolName, result);

    return result;
  }

  /**
   * Report tool use completion
   */
  private async reportToolUseCompleted(toolName: string, result: ToolUseResult): Promise<void> {
    const message = Protocol.createMessage(MessageType.TOOL_USE_COMPLETED, 'worker', {
      toolName,
      success: result.success,
      output: result.output,
    });

    await this.channel.send(message);
  }

  /**
   * Handle tool use approval/blocking
   */
  private async handleToolUseApproval(message: Message): Promise<void> {
    // Handled by sendAndWaitForReply in requestToolUse
    // This is a fallback handler
  }

  /**
   * Submit implementation for review
   */
  private async submitImplementation(): Promise<void> {
    if (!this.implementation) {
      throw new Error('No implementation to submit');
    }

    console.log(`\n[Worker] Submitting implementation for review...`);
    console.log(`[Worker] Files: ${this.implementation.files.length}`);
    console.log(`[Worker] Tests: ${this.implementation.tests.length}`);

    const message = Protocol.implementationSubmission(this.implementation);
    await this.channel.send(message);
  }

  /**
   * Handle review feedback from Manager
   */
  private async handleReviewFeedback(message: Message): Promise<void> {
    const review = message.payload.review;

    console.log(`\n[Worker] Received review feedback:`);
    console.log(`  Score: ${review.score}/100`);
    console.log(`  Issues: ${review.feedback.length}`);

    if (review.requiredChanges.length > 0) {
      console.log(`  Required changes: ${review.requiredChanges.length}`);
    }

    this.emit('review-received', review);
  }

  /**
   * Handle implementation approval
   */
  private async handleImplementationApproved(message: Message): Promise<void> {
    console.log(`\n[Worker] ✓ Implementation APPROVED!`);

    // Clear current task
    this.currentTask = null;
    this.implementation = null;

    // Ready for next task
    await this.sendStatusUpdate({
      phase: 'ready',
      message: 'Ready for next task',
    });

    this.emit('implementation-approved');
  }

  /**
   * Handle implementation rejection
   */
  private async handleImplementationRejected(message: Message): Promise<void> {
    const feedback = message.payload.feedback;

    console.log(`\n[Worker] ✗ Implementation REJECTED`);
    console.log(`[Worker] Required changes: ${feedback.requiredChanges.length}`);

    // Show required changes
    if (feedback.requiredChanges.length > 0) {
      console.log(`[Worker] Must fix:`);
      for (const change of feedback.requiredChanges) {
        console.log(`  - ${change}`);
      }
    }

    // Retry with corrections
    console.log(`\n[Worker] Retrying with corrections...`);

    // In a real implementation, this would analyze feedback and make corrections
    // For now, we'll simulate retrying
    if (this.currentTask) {
      await this.executeTask(this.currentTask, {});
    }

    this.emit('implementation-rejected', feedback);
  }

  /**
   * Send status update to Manager
   */
  private async sendStatusUpdate(status: any): Promise<void> {
    const message = Protocol.statusUpdate(status);
    await this.channel.send(message);
  }

  /**
   * Report error to Manager
   */
  private async reportError(error: any): Promise<void> {
    const message = Protocol.errorReport({
      message: error.message || String(error),
      stack: error.stack,
      taskId: this.currentTask?.id,
    });

    await this.channel.send(message);
  }

  /**
   * Handle termination request
   */
  private async handleTerminate(): Promise<void> {
    console.log('[Worker] Termination requested');
    await this.close();
    process.exit(0);
  }

  /**
   * Close worker and cleanup
   */
  async close(): Promise<void> {
    await this.channel.close();
    this.removeAllListeners();
  }
}
