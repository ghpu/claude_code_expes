/**
 * Manager instance - handles planning, tracking, and critique
 */

import { EventEmitter } from 'events';
import {
  Task,
  Message,
  MessageType,
  ManagerConfig,
  WorkflowState,
  Implementation,
  Review,
  ToolUseRequest,
} from '../types';
import { FileChannel } from '../communication/channel';
import { Protocol } from '../communication/protocol';
import { Planner } from './planner';
import { Critic } from './critic';
import { Tracker } from './tracker';

export class Manager extends EventEmitter {
  private config: ManagerConfig;
  private channel: FileChannel;
  private tracker: Tracker;
  private critic: Critic;
  private workflowState: WorkflowState | null = null;
  private pendingApprovals: Map<string, ToolUseRequest> = new Map();

  constructor(channelPath: string, config: ManagerConfig) {
    super();
    this.config = config;
    this.channel = new FileChannel(channelPath, 'manager', {
      type: 'file',
      queueSize: 100,
      timeout: 30000,
      heartbeatInterval: 5000,
      channelPath,
    });
    this.tracker = new Tracker();
    this.critic = new Critic(config);
  }

  async initialize(): Promise<void> {
    await this.channel.initialize();
    this.setupMessageHandlers();
  }

  /**
   * Setup message handlers for Worker communication
   */
  private setupMessageHandlers(): void {
    this.channel.on('message', async (message: Message) => {
      try {
        await this.handleMessage(message);
      } catch (error) {
        console.error('Error handling message:', error);
        this.emit('error', error);
      }
    });
  }

  /**
   * Handle incoming messages from Worker
   */
  private async handleMessage(message: Message): Promise<void> {
    switch (message.type) {
      case MessageType.TOOL_USE_REQUEST:
        await this.handleToolUseRequest(message);
        break;

      case MessageType.TOOL_USE_COMPLETED:
        await this.handleToolUseCompleted(message);
        break;

      case MessageType.IMPLEMENTATION_SUBMITTED:
        await this.handleImplementationSubmitted(message);
        break;

      case MessageType.STATUS_UPDATE:
        await this.handleStatusUpdate(message);
        break;

      case MessageType.ERROR_REPORT:
        await this.handleErrorReport(message);
        break;

      case MessageType.QUESTION:
        await this.handleQuestion(message);
        break;

      case MessageType.HEARTBEAT:
        // Worker is alive
        this.emit('worker-heartbeat');
        break;

      default:
        console.log(`Unhandled message type: ${message.type}`);
    }
  }

  /**
   * Handle tool use request from Worker
   */
  private async handleToolUseRequest(message: Message): Promise<void> {
    const request: ToolUseRequest = message.payload.request;

    console.log(`\n[Manager] Tool use request: ${request.toolName}`);
    console.log(`  Reason: ${request.reason}`);
    console.log(`  Impact: ${request.impact}`);

    // Store pending approval
    this.pendingApprovals.set(message.id, request);

    // Decide whether to approve
    const approval = await this.evaluateToolUseRequest(request);

    // Send response
    const response = Protocol.toolUseApproval(message.id, approval.approved, approval.reason);
    await this.channel.send(response);

    if (approval.approved) {
      console.log(`[Manager] ✓ Approved`);
    } else {
      console.log(`[Manager] ✗ Blocked: ${approval.reason}`);
    }
  }

  /**
   * Evaluate whether to approve tool use
   */
  private async evaluateToolUseRequest(
    request: ToolUseRequest
  ): Promise<{ approved: boolean; reason?: string }> {
    // Check if tool use is appropriate for current task
    if (!this.workflowState?.currentTaskId) {
      return {
        approved: false,
        reason: 'No active task - cannot approve tool use',
      };
    }

    const currentTask = this.tracker.getTask(this.workflowState.currentTaskId);
    if (!currentTask) {
      return {
        approved: false,
        reason: 'Current task not found',
      };
    }

    // Check for potentially destructive operations
    const destructiveTools = ['Write', 'Edit', 'Bash'];
    if (destructiveTools.includes(request.toolName) && request.impact === 'high') {
      // Require explicit approval for high-impact operations
      console.log(`[Manager] High-impact ${request.toolName} requires review...`);

      // In a real implementation, this could pause and ask the user
      // For now, we'll approve if it seems reasonable
      return {
        approved: true,
        reason: 'High-impact operation approved',
      };
    }

    // Auto-approve low-impact operations
    if (request.impact === 'low') {
      return { approved: true };
    }

    // Default: approve with monitoring
    return { approved: true };
  }

  /**
   * Handle tool use completion
   */
  private async handleToolUseCompleted(message: Message): Promise<void> {
    const { toolName, success, output } = message.payload;

    console.log(`[Manager] Tool completed: ${toolName} - ${success ? 'Success' : 'Failed'}`);

    // Track tool usage
    this.tracker.recordToolUse(toolName, success);

    // Remove from pending approvals
    if (message.replyTo) {
      this.pendingApprovals.delete(message.replyTo);
    }
  }

  /**
   * Handle implementation submission
   */
  private async handleImplementationSubmitted(message: Message): Promise<void> {
    const implementation: Implementation = message.payload.implementation;

    console.log(`\n[Manager] Implementation submitted for task: ${implementation.taskId}`);
    console.log(`  Files: ${implementation.files.length}`);
    console.log(`  Tests: ${implementation.tests.length}`);

    // Perform code review
    console.log(`[Manager] Reviewing implementation...`);
    const review = await this.critic.reviewImplementation(implementation);

    console.log(`[Manager] Review complete - Score: ${review.score}/100`);
    console.log(`[Manager] Status: ${review.approved ? '✓ APPROVED' : '✗ REJECTED'}`);

    if (review.feedback.length > 0) {
      console.log(`[Manager] Feedback:`);
      for (const feedback of review.feedback.slice(0, 5)) {
        console.log(`  ${feedback.severity.toUpperCase()}: ${feedback.message}`);
      }
    }

    // Send review feedback
    await this.channel.send(Protocol.reviewFeedback(review));

    // Send approval/rejection
    const resultMessage = Protocol.implementationResult(
      review.approved,
      implementation.taskId,
      review
    );
    await this.channel.send(resultMessage);

    // Update task status
    if (review.approved) {
      this.tracker.completeTask(implementation.taskId);

      // Move to next task if available
      await this.assignNextTask();
    } else {
      // Mark task as needs revision
      this.tracker.updateTaskStatus(implementation.taskId, 'blocked');

      // Increment iteration counter
      if (this.workflowState) {
        this.workflowState.iterations++;

        // Check if we've exceeded max iterations
        if (this.workflowState.iterations >= this.config.maxIterations) {
          console.log(`[Manager] Max iterations reached - failing workflow`);
          this.workflowState.currentPhase = 'failed';
          this.emit('workflow-failed', 'Maximum iterations exceeded');
        }
      }
    }
  }

  /**
   * Handle status update from Worker
   */
  private async handleStatusUpdate(message: Message): Promise<void> {
    const { status } = message.payload;
    console.log(`[Manager] Worker status: ${JSON.stringify(status)}`);
    this.emit('worker-status', status);
  }

  /**
   * Handle error report from Worker
   */
  private async handleErrorReport(message: Message): Promise<void> {
    const { error } = message.payload;
    console.error(`[Manager] Worker error:`, error);
    this.emit('worker-error', error);
  }

  /**
   * Handle question from Worker
   */
  private async handleQuestion(message: Message): Promise<void> {
    const { question } = message.payload;
    console.log(`[Manager] Worker question: ${question}`);

    // In a real implementation, this would prompt the user
    // For now, send a default response
    const response = Protocol.createMessage(
      MessageType.ACK,
      'manager',
      { answer: 'Please proceed with your best judgment' },
      message.id
    );
    await this.channel.send(response);
  }

  /**
   * Start a workflow for a user request
   */
  async startWorkflow(userRequest: string): Promise<void> {
    console.log(`\n[Manager] Starting workflow for: "${userRequest}"\n`);

    // Create planning phase
    console.log(`[Manager] Planning phase started...`);
    const planningResult = await Planner.planTask(userRequest);

    console.log(`[Manager] Plan created:`);
    console.log(`  Main task: ${planningResult.mainTask.description}`);
    console.log(`  Subtasks: ${planningResult.subtasks.length}`);
    console.log(`  Estimated duration: ${Math.round(planningResult.estimatedDuration / 60000)} minutes`);

    if (planningResult.risks.length > 0) {
      console.log(`  Risks identified: ${planningResult.risks.length}`);
    }

    // Initialize workflow state
    this.workflowState = {
      taskId: planningResult.mainTask.id,
      currentPhase: 'planning',
      tasks: [planningResult.mainTask, ...planningResult.subtasks],
      iterations: 0,
      startTime: Date.now(),
      metadata: {
        dependencies: planningResult.dependencies,
        risks: planningResult.risks,
      },
    };

    // Add tasks to tracker
    this.tracker.addTask(planningResult.mainTask);
    for (const subtask of planningResult.subtasks) {
      this.tracker.addTask(subtask);
    }

    // Prioritize tasks
    const prioritized = Planner.prioritizeTasks(
      planningResult.subtasks,
      planningResult.dependencies
    );

    console.log(`\n[Manager] Task execution order:`);
    prioritized.forEach((task, index) => {
      console.log(`  ${index + 1}. ${task.description}`);
    });

    // Move to implementation phase
    this.workflowState.currentPhase = 'implementation';

    // Assign first task to Worker
    await this.assignNextTask();
  }

  /**
   * Assign next task to Worker
   */
  private async assignNextTask(): Promise<void> {
    if (!this.workflowState) return;

    // Find next pending task
    const nextTask = this.tracker.getNextPendingTask();

    if (!nextTask) {
      // All tasks completed
      console.log(`\n[Manager] All tasks completed!`);
      this.workflowState.currentPhase = 'completed';
      this.workflowState.endTime = Date.now();
      this.emit('workflow-completed', this.workflowState);
      return;
    }

    // Update workflow state
    this.workflowState.currentTaskId = nextTask.id;

    // Mark task as in progress
    this.tracker.updateTaskStatus(nextTask.id, 'in_progress');

    // Create detailed task assignment
    const checklist = Planner.createChecklist(nextTask);

    console.log(`\n[Manager] Assigning task to Worker:`);
    console.log(`  Task: ${nextTask.description}`);
    console.log(`  Priority: ${nextTask.priority}`);
    console.log(`  Requirements: ${nextTask.requirements.length}`);
    console.log(`  Checklist items: ${checklist.length}`);

    // Send task to Worker
    const message = Protocol.taskAssignment({
      ...nextTask,
      checklist,
      strictMode: this.config.strictness,
      allowMocks: this.config.allowMocks,
      requireTests: this.config.requireTests,
    });

    await this.channel.send(message);

    this.emit('task-assigned', nextTask);
  }

  /**
   * Get current workflow status
   */
  getWorkflowStatus(): WorkflowState | null {
    return this.workflowState;
  }

  /**
   * Get tracker for monitoring
   */
  getTracker(): Tracker {
    return this.tracker;
  }

  /**
   * Close manager and cleanup
   */
  async close(): Promise<void> {
    await this.channel.close();
    this.removeAllListeners();
  }
}
