/**
 * Task planning and breakdown
 */

import { Task, PlanningResult } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class Planner {
  /**
   * Break down a complex task into subtasks
   */
  static async planTask(
    description: string,
    requirements: string[] = [],
    constraints: string[] = []
  ): Promise<PlanningResult> {
    const mainTask: Task = {
      id: uuidv4(),
      description,
      requirements,
      constraints,
      deliverables: [],
      priority: 'high',
      status: 'pending',
      assignedTo: 'manager',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Analyze task and create subtasks
    const subtasks = this.breakdownTask(mainTask);

    // Identify dependencies
    const dependencies = this.identifyDependencies(subtasks);

    // Estimate duration
    const estimatedDuration = this.estimateDuration(subtasks);

    // Identify risks
    const risks = this.identifyRisks(mainTask, subtasks);

    return {
      mainTask,
      subtasks,
      dependencies,
      estimatedDuration,
      risks,
    };
  }

  /**
   * Break down a task into smaller subtasks
   */
  private static breakdownTask(mainTask: Task): Task[] {
    const subtasks: Task[] = [];

    // Standard software development phases
    const phases = [
      {
        name: 'Requirements Analysis',
        description: 'Analyze and document detailed requirements',
        priority: 'critical' as const,
      },
      {
        name: 'Design',
        description: 'Design architecture and data structures',
        priority: 'critical' as const,
      },
      {
        name: 'Test Planning',
        description: 'Plan test cases and testing strategy',
        priority: 'high' as const,
      },
      {
        name: 'Implementation',
        description: 'Implement the core functionality',
        priority: 'high' as const,
      },
      {
        name: 'Unit Testing',
        description: 'Write and pass unit tests',
        priority: 'high' as const,
      },
      {
        name: 'Integration',
        description: 'Integrate with existing systems',
        priority: 'medium' as const,
      },
      {
        name: 'Integration Testing',
        description: 'Write and pass integration tests',
        priority: 'high' as const,
      },
      {
        name: 'Documentation',
        description: 'Write comprehensive documentation',
        priority: 'medium' as const,
      },
      {
        name: 'Code Review',
        description: 'Review code quality and completeness',
        priority: 'high' as const,
      },
      {
        name: 'Final Testing',
        description: 'Run all tests and verify everything works',
        priority: 'critical' as const,
      },
    ];

    for (const phase of phases) {
      subtasks.push({
        id: uuidv4(),
        description: `${phase.name}: ${phase.description}`,
        requirements: mainTask.requirements,
        constraints: mainTask.constraints,
        deliverables: [],
        parentTaskId: mainTask.id,
        priority: phase.priority,
        status: 'pending',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {
          phase: phase.name,
        },
      });
    }

    return subtasks;
  }

  /**
   * Identify dependencies between subtasks
   */
  private static identifyDependencies(subtasks: Task[]): Array<{
    taskId: string;
    dependsOn: string[];
  }> {
    const dependencies: Array<{ taskId: string; dependsOn: string[] }> = [];

    // Sequential dependencies based on phase
    for (let i = 1; i < subtasks.length; i++) {
      dependencies.push({
        taskId: subtasks[i].id,
        dependsOn: [subtasks[i - 1].id],
      });
    }

    return dependencies;
  }

  /**
   * Estimate duration for subtasks
   */
  private static estimateDuration(subtasks: Task[]): number {
    // Simple estimation: 30 minutes per subtask
    // In a real implementation, this would be more sophisticated
    return subtasks.length * 30 * 60 * 1000; // milliseconds
  }

  /**
   * Identify potential risks
   */
  private static identifyRisks(mainTask: Task, subtasks: Task[]): string[] {
    const risks: string[] = [];

    // Check for complex requirements
    if (mainTask.requirements.length > 5) {
      risks.push('High number of requirements may increase complexity');
    }

    // Check for strict constraints
    if (mainTask.constraints.length > 3) {
      risks.push('Multiple constraints may limit implementation options');
    }

    // Check for insufficient information
    if (mainTask.requirements.length === 0) {
      risks.push('No explicit requirements - may need clarification');
    }

    // Generic risks
    risks.push('Worker may attempt shortcuts or incomplete implementations');
    risks.push('Tests may not cover all edge cases');
    risks.push('Integration issues may arise');

    return risks;
  }

  /**
   * Create a detailed checklist for a task
   */
  static createChecklist(task: Task): string[] {
    const checklist: string[] = [];

    // Ensure proper implementation
    checklist.push('Code is complete and fully functional');
    checklist.push('No mock implementations (unless explicitly allowed)');
    checklist.push('No TODO comments or placeholder code');
    checklist.push('All edge cases are handled');
    checklist.push('Error handling is comprehensive');

    // Testing requirements
    checklist.push('Unit tests are written and passing');
    checklist.push('Integration tests are written and passing');
    checklist.push('Test coverage is adequate');
    checklist.push('All tests pass without errors');

    // Documentation requirements
    checklist.push('Code has clear comments');
    checklist.push('Functions have documentation');
    checklist.push('Complex logic is explained');
    checklist.push('API documentation is complete');

    // Quality requirements
    checklist.push('Code follows project conventions');
    checklist.push('No code duplication');
    checklist.push('Performance is acceptable');
    checklist.push('Security considerations addressed');

    return checklist;
  }

  /**
   * Prioritize tasks based on dependencies and importance
   */
  static prioritizeTasks(tasks: Task[], dependencies: Array<{ taskId: string; dependsOn: string[] }>): Task[] {
    const prioritized: Task[] = [];
    const completed = new Set<string>();

    while (prioritized.length < tasks.length) {
      // Find tasks with no unsatisfied dependencies
      const available = tasks.filter(task => {
        if (completed.has(task.id)) return false;

        const deps = dependencies.find(d => d.taskId === task.id);
        if (!deps) return true;

        return deps.dependsOn.every(depId => completed.has(depId));
      });

      if (available.length === 0) {
        // Circular dependency or error
        throw new Error('Unable to prioritize tasks - circular dependency detected');
      }

      // Sort by priority
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      available.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

      // Add highest priority available task
      const next = available[0];
      prioritized.push(next);
      completed.add(next.id);
    }

    return prioritized;
  }
}
