/**
 * Progress tracking for tasks
 */

import { Task } from '../types';

export class Tracker {
  private tasks: Map<string, Task> = new Map();
  private toolUsageStats: Map<string, { total: number; successful: number }> = new Map();

  /**
   * Add a task to track
   */
  addTask(task: Task): void {
    this.tasks.set(task.id, task);
  }

  /**
   * Update task status
   */
  updateTaskStatus(taskId: string, status: Task['status']): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      task.updatedAt = Date.now();
      this.tasks.set(taskId, task);
    }
  }

  /**
   * Complete a task
   */
  completeTask(taskId: string): void {
    this.updateTaskStatus(taskId, 'completed');
  }

  /**
   * Block a task
   */
  blockTask(taskId: string): void {
    this.updateTaskStatus(taskId, 'blocked');
  }

  /**
   * Get a task by ID
   */
  getTask(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all tasks
   */
  getAllTasks(): Task[] {
    return Array.from(this.tasks.values());
  }

  /**
   * Get tasks by status
   */
  getTasksByStatus(status: Task['status']): Task[] {
    return Array.from(this.tasks.values()).filter(task => task.status === status);
  }

  /**
   * Get next pending task
   */
  getNextPendingTask(): Task | undefined {
    const pending = this.getTasksByStatus('pending');
    if (pending.length === 0) return undefined;

    // Sort by priority
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    pending.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    return pending[0];
  }

  /**
   * Record tool usage
   */
  recordToolUse(toolName: string, success: boolean): void {
    const stats = this.toolUsageStats.get(toolName) || { total: 0, successful: 0 };
    stats.total++;
    if (success) stats.successful++;
    this.toolUsageStats.set(toolName, stats);
  }

  /**
   * Get tool usage statistics
   */
  getToolUsageStats(): Map<string, { total: number; successful: number; successRate: number }> {
    const stats = new Map();
    for (const [tool, data] of this.toolUsageStats.entries()) {
      stats.set(tool, {
        ...data,
        successRate: data.total > 0 ? (data.successful / data.total) * 100 : 0,
      });
    }
    return stats;
  }

  /**
   * Get progress summary
   */
  getProgressSummary(): {
    total: number;
    completed: number;
    inProgress: number;
    pending: number;
    blocked: number;
    percentComplete: number;
  } {
    const total = this.tasks.size;
    const completed = this.getTasksByStatus('completed').length;
    const inProgress = this.getTasksByStatus('in_progress').length;
    const pending = this.getTasksByStatus('pending').length;
    const blocked = this.getTasksByStatus('blocked').length;

    return {
      total,
      completed,
      inProgress,
      pending,
      blocked,
      percentComplete: total > 0 ? (completed / total) * 100 : 0,
    };
  }

  /**
   * Generate progress report
   */
  generateReport(): string {
    const summary = this.getProgressSummary();
    const lines: string[] = [];

    lines.push('=== Task Progress Report ===');
    lines.push(`Total Tasks: ${summary.total}`);
    lines.push(`Completed: ${summary.completed} (${summary.percentComplete.toFixed(1)}%)`);
    lines.push(`In Progress: ${summary.inProgress}`);
    lines.push(`Pending: ${summary.pending}`);
    lines.push(`Blocked: ${summary.blocked}`);

    if (this.toolUsageStats.size > 0) {
      lines.push('');
      lines.push('=== Tool Usage Statistics ===');
      const stats = this.getToolUsageStats();
      for (const [tool, data] of stats.entries()) {
        lines.push(`${tool}: ${data.successful}/${data.total} (${data.successRate.toFixed(1)}%)`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Clear all tracking data
   */
  clear(): void {
    this.tasks.clear();
    this.toolUsageStats.clear();
  }
}
