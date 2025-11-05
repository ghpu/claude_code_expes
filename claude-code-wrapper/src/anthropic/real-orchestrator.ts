/**
 * Real Orchestrator - Coordinates Manager and Worker using Anthropic API
 */

import { RealManager, RealManagerConfig } from './real-manager';
import { RealWorker, RealWorkerConfig, ToolApprovalRequest } from './real-worker';
import { Task, Implementation, Review } from '../types';

export interface RealOrchestratorConfig {
  apiKey: string;
  workingDirectory: string;
  manager: Omit<RealManagerConfig, 'apiKey' | 'workingDirectory'>;
  worker: Omit<RealWorkerConfig, 'apiKey' | 'workingDirectory'>;
  debug?: boolean;
}

/**
 * Orchestrates the Manager and Worker instances
 */
export class RealOrchestrator {
  private manager: RealManager;
  private worker: RealWorker;
  private config: RealOrchestratorConfig;

  constructor(config: RealOrchestratorConfig) {
    this.config = config;

    // Initialize Manager
    this.manager = new RealManager({
      ...config.manager,
      apiKey: config.apiKey,
      workingDirectory: config.workingDirectory,
      debug: config.debug,
    });

    // Initialize Worker
    this.worker = new RealWorker({
      ...config.worker,
      apiKey: config.apiKey,
      workingDirectory: config.workingDirectory,
      debug: config.debug,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup event handlers between Manager and Worker
   */
  private setupEventHandlers(): void {
    // Handle tool approval requests from Worker
    this.worker.on('tool_approval_request', async (request: ToolApprovalRequest) => {
      try {
        const approval = await this.manager.approveToolUse(request);
        this.worker.approveToolCall(
          request.toolCall.id,
          approval.approved,
          approval.reason,
          approval.modifiedInput
        );
      } catch (error) {
        console.error('[Orchestrator] Error approving tool use:', error);
        this.worker.approveToolCall(request.toolCall.id, false, 'Error during approval');
      }
    });

    // Handle errors
    this.manager.on('error', (error) => {
      console.error('[Orchestrator] Manager error:', error);
    });

    this.worker.on('error', (error) => {
      console.error('[Orchestrator] Worker error:', error);
    });
  }

  /**
   * Run a task with Manager supervision
   */
  async run(taskDescription: string): Promise<void> {
    console.log('\n' + '='.repeat(80));
    console.log('  REAL DUAL-INSTANCE ORCHESTRATOR');
    console.log('='.repeat(80) + '\n');
    console.log(`Task: "${taskDescription}"\n`);

    try {
      // Step 1: Manager plans the task
      console.log('[Orchestrator] Phase 1: Planning');
      const plan = await this.manager.planTask(taskDescription);

      // Step 2: Execute subtasks
      console.log('\n[Orchestrator] Phase 2: Implementation');
      for (let i = 0; i < plan.subtasks.length; i++) {
        const subtask = plan.subtasks[i];
        console.log(`\n[Orchestrator] Subtask ${i + 1}/${plan.subtasks.length}: ${subtask.description}`);

        await this.executeTaskWithReview(subtask);
      }

      // Step 3: Final summary
      console.log('\n' + '='.repeat(80));
      console.log('  TASK COMPLETE');
      console.log('='.repeat(80));

      this.printTokenUsage();

    } catch (error: any) {
      console.error('\n[Orchestrator] ✗ Task failed:', error.message);
      throw error;
    }
  }

  /**
   * Execute a single task with review iterations
   */
  private async executeTaskWithReview(task: Task): Promise<Implementation> {
    const maxIterations = this.config.manager.maxIterations || 5;
    let iteration = 0;
    let implementation: Implementation | null = null;
    let review: Review | null = null;

    while (iteration < maxIterations) {
      iteration++;
      console.log(`\n[Orchestrator] Iteration ${iteration}/${maxIterations}`);

      try {
        // Step 1: Worker implements
        console.log('[Orchestrator] → Worker: Implement task');
        implementation = await this.worker.executeTask(task);

        console.log(`[Orchestrator] ← Worker: Implementation complete`);
        console.log(`   Files: ${implementation.files.length}`);
        console.log(`   Tests: ${implementation.tests.length}`);

        // Step 2: Manager reviews
        console.log('[Orchestrator] → Manager: Review implementation');
        review = await this.manager.reviewImplementation(implementation, task);

        console.log(`[Orchestrator] ← Manager: Review complete`);
        console.log(`   Score: ${review.score}/100`);
        console.log(`   Status: ${review.approved ? '✓ APPROVED' : '✗ REJECTED'}`);

        // Step 3: Check if approved
        if (review.approved) {
          console.log('[Orchestrator] ✓ Implementation approved!');
          return implementation;
        }

        // Step 4: Provide feedback for retry
        console.log(`[Orchestrator] ✗ Implementation rejected`);
        console.log(`   Issues: ${review.feedback.length}`);
        console.log(`   Required changes: ${review.requiredChanges.length}`);

        // Show feedback
        if (review.requiredChanges.length > 0) {
          console.log('\n[Orchestrator] Required changes:');
          review.requiredChanges.forEach((change, i) => {
            console.log(`   ${i + 1}. ${change}`);
          });
        }

        // Provide feedback to Worker
        const feedback = this.formatFeedback(review);
        console.log('\n[Orchestrator] → Worker: Providing feedback for revision');
        await this.worker.provideFeedback(feedback);

      } catch (error: any) {
        console.error(`[Orchestrator] Error in iteration ${iteration}:`, error.message);

        if (iteration >= maxIterations) {
          throw new Error(`Failed after ${maxIterations} iterations: ${error.message}`);
        }

        // Provide error feedback to Worker
        await this.worker.provideFeedback(
          `An error occurred: ${error.message}\nPlease fix the issue and try again.`
        );
      }
    }

    // Max iterations exceeded
    console.log(`\n[Orchestrator] ✗ Maximum iterations (${maxIterations}) exceeded`);

    if (review) {
      console.log('\nLast review feedback:');
      console.log(`Score: ${review.score}/100`);
      review.requiredChanges.forEach((change, i) => {
        console.log(`${i + 1}. ${change}`);
      });
    }

    throw new Error(`Implementation not approved after ${maxIterations} iterations`);
  }

  /**
   * Format review feedback for Worker
   */
  private formatFeedback(review: Review): string {
    let feedback = `# Code Review Feedback\n\n`;
    feedback += `**Score**: ${review.score}/100\n`;
    feedback += `**Status**: REJECTED\n\n`;

    if (review.feedback.length > 0) {
      feedback += `## Issues Found\n\n`;
      review.feedback.forEach((item, i) => {
        feedback += `${i + 1}. **[${item.severity.toUpperCase()}]** ${item.message}\n`;
        if (item.file) {
          feedback += `   File: ${item.file}${item.line ? `:${item.line}` : ''}\n`;
        }
      });
      feedback += `\n`;
    }

    if (review.requiredChanges.length > 0) {
      feedback += `## Required Changes\n\n`;
      feedback += `You MUST address these issues:\n\n`;
      review.requiredChanges.forEach((change, i) => {
        feedback += `${i + 1}. ${change}\n`;
      });
      feedback += `\n`;
    }

    if (review.suggestions.length > 0) {
      feedback += `## Suggestions\n\n`;
      review.suggestions.forEach((suggestion, i) => {
        feedback += `${i + 1}. ${suggestion}\n`;
      });
      feedback += `\n`;
    }

    feedback += `## Next Steps\n\n`;
    feedback += `1. Address ALL required changes\n`;
    feedback += `2. Ensure ALL tests pass\n`;
    feedback += `3. Verify code quality\n`;
    feedback += `4. Re-submit for review\n\n`;
    feedback += `This is iteration feedback - fix these issues and the implementation will be reviewed again.`;

    return feedback;
  }

  /**
   * Print token usage statistics
   */
  private printTokenUsage(): void {
    const managerTokens = this.manager.getTokenUsage();
    const workerTokens = this.worker.getTokenUsage();
    const total = {
      input: managerTokens.input + workerTokens.input,
      output: managerTokens.output + workerTokens.output,
      total: managerTokens.total + workerTokens.total,
    };

    console.log('\n' + '-'.repeat(80));
    console.log('Token Usage:');
    console.log('-'.repeat(80));
    console.log(`Manager:  ${managerTokens.input.toLocaleString()} in / ${managerTokens.output.toLocaleString()} out = ${managerTokens.total.toLocaleString()} total`);
    console.log(`Worker:   ${workerTokens.input.toLocaleString()} in / ${workerTokens.output.toLocaleString()} out = ${workerTokens.total.toLocaleString()} total`);
    console.log(`Total:    ${total.input.toLocaleString()} in / ${total.output.toLocaleString()} out = ${total.total.toLocaleString()} total`);
    console.log('-'.repeat(80));
  }
}
