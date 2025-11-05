/**
 * Orchestrator - coordinates Manager and Worker instances
 */

import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { Manager } from './manager/manager';
import { Worker } from './worker/worker';
import { WrapperConfig } from './types';

export class Orchestrator {
  private config: WrapperConfig;
  private channelPath: string;
  private manager: Manager | null = null;
  private worker: Worker | null = null;
  private managerProcess: ChildProcess | null = null;
  private workerProcess: ChildProcess | null = null;

  constructor(config: WrapperConfig, channelPath?: string) {
    this.config = config;
    this.channelPath = channelPath || `/tmp/claude-wrapper-${Date.now()}`;
  }

  /**
   * Initialize the orchestrator
   */
  async initialize(): Promise<void> {
    console.log('[Orchestrator] Initializing...');

    // Create channel directory
    await fs.mkdir(this.channelPath, { recursive: true });
    await fs.mkdir(path.join(this.channelPath, 'manager-inbox'), { recursive: true });
    await fs.mkdir(path.join(this.channelPath, 'worker-inbox'), { recursive: true });

    console.log(`[Orchestrator] Channel created at: ${this.channelPath}`);

    // Initialize Manager
    console.log('[Orchestrator] Starting Manager instance...');
    this.manager = new Manager(this.channelPath, this.config.manager);
    await this.manager.initialize();

    // Setup Manager event handlers
    this.setupManagerHandlers();

    // Initialize Worker
    console.log('[Orchestrator] Starting Worker instance...');
    this.worker = new Worker(this.channelPath, this.config.worker);
    await this.worker.initialize();

    // Setup Worker event handlers
    this.setupWorkerHandlers();

    console.log('[Orchestrator] Initialization complete\n');
  }

  /**
   * Setup Manager event handlers
   */
  private setupManagerHandlers(): void {
    if (!this.manager) return;

    this.manager.on('task-assigned', (task) => {
      console.log(`[Orchestrator] Task assigned to Worker: ${task.description}`);
    });

    this.manager.on('workflow-completed', (state) => {
      console.log('\n[Orchestrator] Workflow completed!');
      const tracker = this.manager!.getTracker();
      console.log(tracker.generateReport());
    });

    this.manager.on('workflow-failed', (reason) => {
      console.error(`\n[Orchestrator] Workflow failed: ${reason}`);
    });

    this.manager.on('error', (error) => {
      console.error('[Orchestrator] Manager error:', error);
    });
  }

  /**
   * Setup Worker event handlers
   */
  private setupWorkerHandlers(): void {
    if (!this.worker) return;

    this.worker.on('implementation-approved', () => {
      console.log('[Orchestrator] Worker implementation approved');
    });

    this.worker.on('implementation-rejected', (feedback) => {
      console.log('[Orchestrator] Worker implementation rejected, retrying...');
    });

    this.worker.on('error', (error) => {
      console.error('[Orchestrator] Worker error:', error);
    });
  }

  /**
   * Execute a user request
   */
  async execute(userRequest: string): Promise<void> {
    if (!this.manager) {
      throw new Error('Orchestrator not initialized');
    }

    console.log('='.repeat(80));
    console.log('  CLAUDE CODE WRAPPER - DUAL INSTANCE MODE');
    console.log('='.repeat(80));
    console.log(`\nUser Request: "${userRequest}"\n`);
    console.log('='.repeat(80));

    // Start workflow
    await this.manager.startWorkflow(userRequest);

    // Wait for completion
    await this.waitForCompletion();
  }

  /**
   * Wait for workflow completion
   */
  private async waitForCompletion(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.manager) {
        reject(new Error('Manager not initialized'));
        return;
      }

      const checkInterval = setInterval(() => {
        const state = this.manager!.getWorkflowStatus();

        if (state?.currentPhase === 'completed') {
          clearInterval(checkInterval);
          resolve();
        } else if (state?.currentPhase === 'failed') {
          clearInterval(checkInterval);
          reject(new Error('Workflow failed'));
        }
      }, 1000);

      // Timeout after 30 minutes
      setTimeout(() => {
        clearInterval(checkInterval);
        reject(new Error('Workflow timeout'));
      }, 30 * 60 * 1000);
    });
  }

  /**
   * Get current status
   */
  getStatus(): any {
    return {
      manager: this.manager?.getWorkflowStatus(),
      tracker: this.manager?.getTracker().getProgressSummary(),
    };
  }

  /**
   * Cleanup and shutdown
   */
  async shutdown(): Promise<void> {
    console.log('\n[Orchestrator] Shutting down...');

    if (this.manager) {
      await this.manager.close();
    }

    if (this.worker) {
      await this.worker.close();
    }

    // Cleanup channel directory
    try {
      await fs.rm(this.channelPath, { recursive: true, force: true });
    } catch (error) {
      console.error('Error cleaning up channel directory:', error);
    }

    console.log('[Orchestrator] Shutdown complete');
  }
}

/**
 * Run the orchestrator with a user request
 */
export async function run(userRequest: string, config?: Partial<WrapperConfig>): Promise<void> {
  // Default configuration
  const defaultConfig: WrapperConfig = {
    manager: {
      strictness: 'high',
      allowMocks: false,
      requireTests: true,
      requireDocumentation: true,
      maxIterations: 5,
      qualityGates: ['no-mocks', 'no-todos', 'tests-pass', 'documented'],
      reviewTimeout: 30000,
      autoApproveSimpleChanges: false,
    },
    worker: {
      enableHooks: true,
      hookTimeout: 30000,
      maxRetries: 3,
      requestApprovalFor: ['Write', 'Edit', 'Bash'],
      autoSubmitAfterTools: ['Write', 'Edit'],
      workingDirectory: process.cwd(),
    },
    communication: {
      channelType: 'file',
      messageQueueSize: 100,
      heartbeatInterval: 5000,
      timeout: 30000,
    },
    logging: {
      level: 'info',
    },
  };

  // Merge with provided config
  const finalConfig: WrapperConfig = {
    ...defaultConfig,
    ...config,
    manager: { ...defaultConfig.manager, ...config?.manager },
    worker: { ...defaultConfig.worker, ...config?.worker },
    communication: { ...defaultConfig.communication, ...config?.communication },
    logging: { ...defaultConfig.logging, ...config?.logging },
  };

  const orchestrator = new Orchestrator(finalConfig);

  try {
    await orchestrator.initialize();
    await orchestrator.execute(userRequest);

    console.log('\n✓ Task completed successfully!');
  } catch (error) {
    console.error('\n✗ Task failed:', error);
    throw error;
  } finally {
    await orchestrator.shutdown();
  }
}
