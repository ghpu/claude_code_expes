/**
 * Real Manager Implementation using Anthropic API
 * Provides strict code review and task management with real Claude intelligence
 */

import { EventEmitter } from 'events';
import { ClaudeProcess } from './claude-process';
import { ToolExecutor } from './tool-executor';
import { Task, Implementation, Review, PlanningResult, ManagerConfig } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { ToolApprovalRequest, ToolApprovalResponse } from './real-worker';

export interface RealManagerConfig extends ManagerConfig {
  apiKey: string;
  workingDirectory: string;
  model?: string;
  debug?: boolean;
}

/**
 * Real Manager that uses Claude API for planning and code review
 */
export class RealManager extends EventEmitter {
  private claude: ClaudeProcess;
  private toolExecutor: ToolExecutor;
  private config: RealManagerConfig;
  private currentPlan: PlanningResult | null = null;

  constructor(config: RealManagerConfig) {
    super();
    this.config = config;

    // Initialize Claude process with Manager system prompt
    this.claude = new ClaudeProcess({
      apiKey: config.apiKey,
      workingDirectory: config.workingDirectory,
      model: config.model || 'claude-sonnet-4-20250514',
      systemPrompt: this.getManagerSystemPrompt(),
    });

    // Initialize tool executor for reviewing files
    this.toolExecutor = new ToolExecutor(config.workingDirectory);

    this.setupEventHandlers();
  }

  /**
   * Get the system prompt for the Manager
   */
  private getManagerSystemPrompt(): string {
    return `You are a strict Engineering Manager and Code Reviewer with impossibly high standards.

YOUR ROLE:
- Plan and break down complex tasks into subtasks
- Review all code implementations with extreme scrutiny
- REJECT incomplete, sloppy, or shortcut-filled code
- Enforce testing requirements
- Ensure documentation quality

CODE REVIEW STANDARDS (${this.config.strictness.toUpperCase()}):

${this.getStrictnessGuidelines()}

REJECTION CRITERIA (automatic REJECT if any found):

1. **SHORTCUTS & INCOMPLETE CODE**
   ${this.config.allowMocks ? '- Mocks are allowed if clearly marked' : '- ANY mock implementations → INSTANT REJECT'}
   - TODO comments → INSTANT REJECT
   - "Implement this later" → INSTANT REJECT
   - Placeholder code → INSTANT REJECT
   - "Left as exercise" → INSTANT REJECT

2. **MISSING TESTS**
   ${this.config.requireTests ? `- No tests → INSTANT REJECT
   - Tests not passing → INSTANT REJECT
   - Insufficient test coverage → INSTANT REJECT
   - Tests don't actually verify behavior → INSTANT REJECT` : '- Tests are optional'}

3. **POOR ERROR HANDLING**
   - No error handling → REJECT
   - Swallowed errors → REJECT
   - Generic error messages → REJECT

4. **DOCUMENTATION**
   ${this.config.requireDocumentation ? `- Missing documentation → REJECT
   - Unclear documentation → REJECT
   - No usage examples → REJECT` : '- Documentation is optional'}

5. **CODE QUALITY**
   - Doesn't follow language conventions → REJECT
   - Unclear variable names → REJECT
   - Functions too complex → REJECT
   - Duplicate code → REJECT

APPROVAL CRITERIA:
- ALL requirements implemented completely
- ALL tests written and passing
- Comprehensive error handling
- Clear documentation
- Clean, maintainable code
- No shortcuts or TODOs
- Actually works as specified

Be ruthless. Better to reject 10 times and get it perfect than approve mediocre code.

Available tools for review: Read, Glob, Grep, Bash
Working directory: ${this.config.workingDirectory}`;
  }

  /**
   * Get strictness-specific guidelines
   */
  private getStrictnessGuidelines(): string {
    switch (this.config.strictness) {
      case 'extreme':
        return `- Perfect code or REJECT
- 100% test coverage required
- Every edge case handled
- Production-grade documentation
- Zero technical debt`;

      case 'high':
        return `- High-quality code required
- Comprehensive tests
- All errors handled
- Good documentation
- No shortcuts`;

      case 'medium':
        return `- Solid code quality
- Key functionality tested
- Main errors handled
- Basic documentation`;

      case 'low':
        return `- Working code
- Some tests
- Basic error handling`;

      default:
        return '- Code must work';
    }
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers(): void {
    this.claude.on('response', (response) => {
      if (this.config.debug) {
        console.log('[Manager] Claude response received');
      }
    });

    this.claude.on('error', (error) => {
      console.error('[Manager] Claude API error:', error);
      this.emit('error', error);
    });
  }

  /**
   * Plan a task - break it down into subtasks
   */
  async planTask(description: string): Promise<PlanningResult> {
    console.log('[Manager] Planning task...');

    const prompt = `# Task Planning Request\n\n` +
      `Task: ${description}\n\n` +
      `Please analyze this task and create a detailed implementation plan.\n\n` +
      `Provide:\n` +
      `1. Main task breakdown\n` +
      `2. Subtasks in order of execution\n` +
      `3. Dependencies between tasks\n` +
      `4. Estimated complexity\n` +
      `5. Potential risks\n\n` +
      `Use Read/Glob/Grep tools to understand the existing codebase if needed.\n` +
      `Be thorough - this plan will guide the implementation.`;

    const response = await this.claude.sendMessage(prompt);

    // Parse the planning response
    const plan = this.parsePlanningResponse(description, response.text);
    this.currentPlan = plan;

    console.log(`[Manager] Plan created:`);
    console.log(`  Main task: ${plan.mainTask.description}`);
    console.log(`  Subtasks: ${plan.subtasks.length}`);
    console.log(`  Risks: ${plan.risks.length}`);

    return plan;
  }

  /**
   * Parse planning response into structured format
   */
  private parsePlanningResponse(description: string, responseText: string): PlanningResult {
    // Create main task
    const mainTask: Task = {
      id: uuidv4(),
      description,
      requirements: [],
      constraints: [],
      deliverables: [],
      priority: 'high',
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Extract subtasks (looking for numbered lists)
    const subtasks: Task[] = [];
    const subtaskMatches = responseText.match(/^\d+\.\s+(.+)$/gm);

    if (subtaskMatches) {
      subtaskMatches.slice(0, 10).forEach((match, index) => {
        const desc = match.replace(/^\d+\.\s+/, '').trim();
        subtasks.push({
          id: uuidv4(),
          description: desc,
          requirements: [],
          constraints: [],
          deliverables: [],
          priority: index < 3 ? 'high' : 'medium',
          status: 'pending',
          parentTaskId: mainTask.id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
    }

    // If no subtasks found, create a single subtask
    if (subtasks.length === 0) {
      subtasks.push({
        id: uuidv4(),
        description: `Implement: ${description}`,
        requirements: [],
        constraints: [],
        deliverables: [],
        priority: 'high',
        status: 'pending',
        parentTaskId: mainTask.id,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    // Extract risks
    const risks: string[] = [];
    const riskSection = responseText.match(/risk[s]?:([\s\S]*?)(?=\n\n|\n#|$)/i);
    if (riskSection) {
      const riskLines = riskSection[1].match(/[-*]\s+(.+)/g);
      if (riskLines) {
        risks.push(...riskLines.map(line => line.replace(/[-*]\s+/, '').trim()));
      }
    }

    return {
      mainTask,
      subtasks,
      dependencies: [],
      estimatedDuration: subtasks.length * 30, // Rough estimate: 30 min per subtask
      risks,
    };
  }

  /**
   * Review an implementation
   */
  async reviewImplementation(implementation: Implementation, task: Task): Promise<Review> {
    console.log('[Manager] Reviewing implementation...');
    console.log(`  Files: ${implementation.files.length}`);
    console.log(`  Tests: ${implementation.tests.length}`);

    // Build review prompt with actual file contents
    const prompt = await this.buildReviewPrompt(implementation, task);

    const response = await this.claude.sendMessage(prompt);

    // Parse review response
    const review = this.parseReviewResponse(implementation, response.text);

    console.log(`[Manager] Review complete - Score: ${review.score}/100`);
    console.log(`  Status: ${review.approved ? '✓ APPROVED' : '✗ REJECTED'}`);
    console.log(`  Issues: ${review.feedback.length}`);
    console.log(`  Required changes: ${review.requiredChanges.length}`);

    return review;
  }

  /**
   * Build review prompt with actual file contents
   */
  private async buildReviewPrompt(implementation: Implementation, task: Task): Promise<string> {
    let prompt = `# Code Review Request\n\n`;
    prompt += `## Task\n${task.description}\n\n`;

    // Add file contents
    if (implementation.files.length > 0) {
      prompt += `## Files Modified/Created (${implementation.files.length})\n\n`;

      for (const file of implementation.files) {
        prompt += `### ${file.path} (${file.action})\n\n`;

        // Read actual file content
        try {
          const result = await this.toolExecutor.executeTool('Read', { file_path: file.path });
          if (result.success) {
            prompt += `\`\`\`\n${result.output}\n\`\`\`\n\n`;
          } else {
            prompt += `*Could not read file: ${result.error}*\n\n`;
          }
        } catch (error) {
          prompt += `*Error reading file: ${error}*\n\n`;
        }
      }
    }

    // Add test results
    if (implementation.tests.length > 0) {
      prompt += `## Test Results (${implementation.tests.length})\n\n`;
      for (const test of implementation.tests) {
        prompt += `### ${test.path}\n`;
        prompt += `Status: ${test.passed ? '✓ PASSED' : '✗ FAILED'}\n\n`;
        if (test.results) {
          prompt += `\`\`\`\n${test.results}\n\`\`\`\n\n`;
        }
      }
    } else {
      prompt += `## Test Results\n**NO TESTS FOUND** ${this.config.requireTests ? '→ AUTOMATIC REJECT' : ''}\n\n`;
    }

    // Add documentation
    if (implementation.documentation) {
      prompt += `## Documentation\n${implementation.documentation}\n\n`;
    } else {
      prompt += `## Documentation\n**NO DOCUMENTATION** ${this.config.requireDocumentation ? '→ AUTOMATIC REJECT' : ''}\n\n`;
    }

    prompt += `## Review Instructions\n\n`;
    prompt += `Perform a thorough code review using ${this.config.strictness} strictness standards.\n\n`;
    prompt += `Check for:\n`;
    prompt += `1. Completeness - Is everything implemented?\n`;
    prompt += `2. Quality - Is the code well-written?\n`;
    prompt += `3. Tests - Are there comprehensive tests that pass?\n`;
    prompt += `4. Shortcuts - Any mocks, TODOs, placeholders?\n`;
    prompt += `5. Error handling - Are errors properly handled?\n`;
    prompt += `6. Documentation - Is it well-documented?\n\n`;
    prompt += `Provide:\n`;
    prompt += `- APPROVE or REJECT decision\n`;
    prompt += `- Score out of 100\n`;
    prompt += `- Specific issues found\n`;
    prompt += `- Required changes if rejected\n`;
    prompt += `- Suggestions for improvement\n\n`;
    prompt += `Be strict and thorough. This code must meet the highest standards.`;

    return prompt;
  }

  /**
   * Parse review response
   */
  private parseReviewResponse(implementation: Implementation, responseText: string): Review {
    const review: Review = {
      implementationId: implementation.taskId,
      approved: false,
      score: 0,
      feedback: [],
      requiredChanges: [],
      suggestions: [],
      reviewedAt: Date.now(),
    };

    // Check for approval/rejection
    const lowerText = responseText.toLowerCase();
    review.approved =
      lowerText.includes('approve') &&
      !lowerText.includes('reject') &&
      !lowerText.includes('not approve');

    // Extract score
    const scoreMatch = responseText.match(/score[:\s]+(\d+)/i);
    if (scoreMatch) {
      review.score = parseInt(scoreMatch[1]);
    } else {
      // Estimate score based on keywords
      if (review.approved) {
        review.score = 85;
      } else {
        review.score = 40;
      }
    }

    // Extract issues (looking for problems mentioned)
    const issueKeywords = ['issue', 'problem', 'error', 'missing', 'incomplete', 'todo', 'mock', 'shortcut'];
    const lines = responseText.split('\n');

    for (const line of lines) {
      const lowerLine = line.toLowerCase();
      if (issueKeywords.some((keyword) => lowerLine.includes(keyword))) {
        const severity = lowerLine.includes('critical') || lowerLine.includes('must')
          ? 'critical'
          : lowerLine.includes('error')
          ? 'error'
          : lowerLine.includes('warning')
          ? 'warning'
          : 'info';

        review.feedback.push({
          category: 'quality',
          severity: severity as any,
          message: line.trim(),
        });
      }
    }

    // Extract required changes
    const changesMatch = responseText.match(/(?:required changes?|must fix|needs?|changes? needed)[:\s]+([\s\S]*?)(?=\n\n|###|$)/i);
    if (changesMatch) {
      const changeLines = changesMatch[1].match(/[-*]\s+(.+)/g);
      if (changeLines) {
        review.requiredChanges.push(...changeLines.map((line) => line.replace(/[-*]\s+/, '').trim()));
      }
    }

    // Extract suggestions
    const suggestionsMatch = responseText.match(/(?:suggestions?|recommendations?|improvements?)[:\s]+([\s\S]*?)(?=\n\n|###|$)/i);
    if (suggestionsMatch) {
      const suggestionLines = suggestionsMatch[1].match(/[-*]\s+(.+)/g);
      if (suggestionLines) {
        review.suggestions.push(...suggestionLines.map((line) => line.replace(/[-*]\s+/, '').trim()));
      }
    }

    // If no specific changes but rejected, add generic requirement
    if (!review.approved && review.requiredChanges.length === 0) {
      review.requiredChanges.push('Address all issues mentioned in the feedback');
      review.requiredChanges.push('Ensure all tests pass');
      review.requiredChanges.push('Complete all documentation');
    }

    return review;
  }

  /**
   * Approve or reject a tool use request
   */
  async approveToolUse(request: ToolApprovalRequest): Promise<ToolApprovalResponse> {
    const { toolCall, taskId } = request;

    // Auto-approve read-only tools
    if (['Read', 'Glob', 'Grep'].includes(toolCall.name)) {
      return { approved: true };
    }

    // For write operations, check if they seem reasonable
    if (toolCall.name === 'Write' || toolCall.name === 'Edit') {
      // Could add more sophisticated checks here
      // For now, approve most write operations
      return { approved: true };
    }

    // For Bash commands, check for dangerous operations
    if (toolCall.name === 'Bash') {
      const command = toolCall.input.command as string;
      const dangerous = ['rm -rf', 'dd ', 'mkfs', ':(){:|:&};:', '> /dev/'];

      if (dangerous.some((pattern) => command.includes(pattern))) {
        return {
          approved: false,
          reason: 'Dangerous command blocked',
        };
      }

      return { approved: true };
    }

    return { approved: true };
  }

  /**
   * Get token usage
   */
  getTokenUsage(): { input: number; output: number; total: number } {
    return this.claude.getTokenUsage();
  }
}
