/**
 * Code review and critique
 */

import { Implementation, Review, CritiqueResult, ManagerConfig } from '../types';
import * as fs from 'fs/promises';
import * as path from 'path';

export class Critic {
  private config: ManagerConfig;

  constructor(config: ManagerConfig) {
    this.config = config;
  }

  /**
   * Perform comprehensive code review
   */
  async reviewImplementation(implementation: Implementation): Promise<Review> {
    const feedback: Review['feedback'] = [];
    let score = 100;

    // Run all quality checks
    const critiqueResult = await this.critique(implementation);

    // Check for shortcuts and lazy implementations
    if (critiqueResult.hasShortcuts) {
      feedback.push({
        category: 'quality',
        severity: 'critical',
        message: 'Implementation contains shortcuts or incomplete code',
      });
      score -= 30;
    }

    // Check for mocks (unless allowed)
    if (!this.config.allowMocks && critiqueResult.hasMocks) {
      feedback.push({
        category: 'completeness',
        severity: 'critical',
        message: 'Mock implementations found - complete implementations required',
      });
      score -= 40;
    }

    // Check for TODOs
    if (critiqueResult.hasTodos) {
      feedback.push({
        category: 'completeness',
        severity: 'error',
        message: 'TODO comments found - all code must be complete',
      });
      score -= 20;
    }

    // Check for incomplete code
    if (critiqueResult.hasIncompleteCode) {
      feedback.push({
        category: 'completeness',
        severity: 'critical',
        message: 'Incomplete code detected - implementation must be finished',
      });
      score -= 35;
    }

    // Check tests (if required)
    if (this.config.requireTests && !critiqueResult.testsPassed) {
      feedback.push({
        category: 'testing',
        severity: 'critical',
        message: 'Tests are missing or not passing',
      });
      score -= 30;
    }

    // Check documentation (if required)
    if (this.config.requireDocumentation && !critiqueResult.isDocumented) {
      feedback.push({
        category: 'documentation',
        severity: 'error',
        message: 'Documentation is missing or incomplete',
      });
      score -= 15;
    }

    // Add specific issues from critique
    for (const issue of critiqueResult.issues) {
      feedback.push({
        category: this.mapIssueTypeToCategory(issue.type),
        severity: this.mapSeverity(issue.severity),
        message: issue.message,
        file: issue.location,
      });
    }

    // Ensure score doesn't go negative
    score = Math.max(0, score);

    // Determine approval
    const approved = score >= this.getMinimumScore() && feedback.filter(f => f.severity === 'critical').length === 0;

    // Generate required changes and suggestions
    const requiredChanges = this.generateRequiredChanges(critiqueResult, feedback);
    const suggestions = critiqueResult.recommendations;

    return {
      implementationId: implementation.taskId,
      approved,
      score,
      feedback,
      requiredChanges,
      suggestions,
      reviewedAt: Date.now(),
    };
  }

  /**
   * Critique implementation for quality issues
   */
  private async critique(implementation: Implementation): Promise<CritiqueResult> {
    const issues: CritiqueResult['issues'] = [];
    let hasMocks = false;
    let hasTodos = false;
    let hasIncompleteCode = false;

    // Check each file
    for (const file of implementation.files) {
      if (!file.content) continue;

      const content = file.content;
      const lines = content.split('\n');

      // Check for mocks
      if (this.containsMocks(content)) {
        hasMocks = true;
        issues.push({
          type: 'mock',
          severity: 'high',
          message: `Mock implementation detected in ${file.path}`,
          location: file.path,
        });
      }

      // Check for TODOs
      const todoLines = this.findTodos(lines);
      if (todoLines.length > 0) {
        hasTodos = true;
        issues.push({
          type: 'todo',
          severity: 'medium',
          message: `TODO comments found in ${file.path} at lines: ${todoLines.join(', ')}`,
          location: file.path,
        });
      }

      // Check for incomplete code
      if (this.hasIncompleteCode(content)) {
        hasIncompleteCode = true;
        issues.push({
          type: 'incomplete',
          severity: 'high',
          message: `Incomplete code detected in ${file.path}`,
          location: file.path,
        });
      }

      // Check for poor quality patterns
      const qualityIssues = this.checkQuality(content, file.path);
      issues.push(...qualityIssues);
    }

    // Check tests
    const testsPassed: boolean = implementation.tests.length > 0 && implementation.tests.every(t => t.passed);
    if (implementation.tests.length === 0) {
      issues.push({
        type: 'test_failure',
        severity: 'high',
        message: 'No tests found',
      });
    } else if (!testsPassed) {
      issues.push({
        type: 'test_failure',
        severity: 'high',
        message: 'Some tests are failing',
      });
    }

    // Check documentation
    const isDocumented: boolean = !!(implementation.documentation && implementation.documentation.length > 100);
    if (!isDocumented) {
      issues.push({
        type: 'missing_docs',
        severity: 'medium',
        message: 'Documentation is missing or too brief',
      });
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(issues);

    // Calculate score
    const score = this.calculateScore(issues, testsPassed, isDocumented);

    return {
      score,
      hasShortcuts: hasMocks || hasIncompleteCode,
      hasMocks,
      hasTodos,
      hasIncompleteCode,
      testsPassed,
      isDocumented,
      issues,
      recommendations,
    };
  }

  /**
   * Check if content contains mock implementations
   */
  private containsMocks(content: string): boolean {
    const mockPatterns = [
      /mock\s*[=:]/i,
      /\{\s*\/\/\s*mock/i,
      /return\s+null\s*;?\s*\/\/.*mock/i,
      /throw\s+new\s+Error\s*\(\s*['"]not\s+implemented/i,
      /function\s+\w+\s*\([^)]*\)\s*\{\s*\}/,
      /=>\s*\{\s*\}/,
      /jest\.mock/,
      /sinon\.stub/,
      /createMock/i,
    ];

    return mockPatterns.some(pattern => pattern.test(content));
  }

  /**
   * Find TODO comments
   */
  private findTodos(lines: string[]): number[] {
    const todoLines: number[] = [];
    const todoPattern = /\/\/\s*TODO|\/\*\s*TODO|#\s*TODO|\/\/\s*FIXME|\/\*\s*FIXME/i;

    lines.forEach((line, index) => {
      if (todoPattern.test(line)) {
        todoLines.push(index + 1);
      }
    });

    return todoLines;
  }

  /**
   * Check for incomplete code
   */
  private hasIncompleteCode(content: string): boolean {
    const incompletePatterns = [
      /\.\.\./,  // Ellipsis
      /throw\s+new\s+Error\s*\(\s*['"]not\s+implemented['"]?\s*\)/i,
      /return\s+undefined\s*;?\s*\/\//,
      /\/\/\s*implementation\s+here/i,
      /\/\/\s*to\s+be\s+implemented/i,
      /console\.log\s*\(\s*['"]TODO/i,
    ];

    return incompletePatterns.some(pattern => pattern.test(content));
  }

  /**
   * Check code quality
   */
  private checkQuality(content: string, filePath: string): CritiqueResult['issues'] {
    const issues: CritiqueResult['issues'] = [];

    // Check for console.log (should use proper logging)
    if (/console\.log/.test(content) && !filePath.includes('test')) {
      issues.push({
        type: 'poor_quality',
        severity: 'low',
        message: 'console.log found - use proper logging',
        location: filePath,
      });
    }

    // Check for very long functions (> 100 lines)
    const functionLengths = this.analyzeFunctionLengths(content);
    if (functionLengths.some(len => len > 100)) {
      issues.push({
        type: 'poor_quality',
        severity: 'medium',
        message: 'Very long function detected - consider breaking it down',
        location: filePath,
      });
    }

    // Check for deeply nested code (> 4 levels)
    if (this.hasDeepNesting(content)) {
      issues.push({
        type: 'poor_quality',
        severity: 'low',
        message: 'Deeply nested code detected - consider refactoring',
        location: filePath,
      });
    }

    return issues;
  }

  /**
   * Analyze function lengths
   */
  private analyzeFunctionLengths(content: string): number[] {
    // Simple heuristic: count lines between function declarations and closing braces
    // This is a simplified version - a real implementation would use AST parsing
    const functionPattern = /(?:function|=>)\s*[^{]*\{/g;
    const matches = content.match(functionPattern);

    if (!matches) return [];

    // For now, return a simple estimate
    return matches.map(() => 50); // Placeholder
  }

  /**
   * Check for deep nesting
   */
  private hasDeepNesting(content: string): boolean {
    const lines = content.split('\n');
    let maxIndent = 0;

    for (const line of lines) {
      const indent = line.search(/\S/);
      if (indent !== -1) {
        maxIndent = Math.max(maxIndent, indent);
      }
    }

    // Assuming 2-space indent, > 8 spaces = > 4 levels
    return maxIndent > 8;
  }

  /**
   * Generate recommendations
   */
  private generateRecommendations(issues: CritiqueResult['issues']): string[] {
    const recommendations: string[] = [];

    if (issues.some(i => i.type === 'mock')) {
      recommendations.push('Replace all mock implementations with complete, working code');
    }

    if (issues.some(i => i.type === 'todo')) {
      recommendations.push('Complete all TODO items before submitting');
    }

    if (issues.some(i => i.type === 'incomplete')) {
      recommendations.push('Finish all incomplete implementations');
    }

    if (issues.some(i => i.type === 'test_failure')) {
      recommendations.push('Ensure all tests are written and passing');
    }

    if (issues.some(i => i.type === 'missing_docs')) {
      recommendations.push('Add comprehensive documentation');
    }

    if (issues.some(i => i.type === 'poor_quality')) {
      recommendations.push('Refactor code to improve quality and maintainability');
    }

    return recommendations;
  }

  /**
   * Calculate overall score
   */
  private calculateScore(issues: CritiqueResult['issues'], testsPassed: boolean, isDocumented: boolean): number {
    let score = 100;

    for (const issue of issues) {
      switch (issue.severity) {
        case 'high':
          score -= 20;
          break;
        case 'medium':
          score -= 10;
          break;
        case 'low':
          score -= 5;
          break;
      }
    }

    if (!testsPassed) score -= 30;
    if (!isDocumented) score -= 15;

    return Math.max(0, score);
  }

  /**
   * Map issue type to feedback category
   */
  private mapIssueTypeToCategory(type: CritiqueResult['issues'][0]['type']): Review['feedback'][0]['category'] {
    const mapping: Record<string, Review['feedback'][0]['category']> = {
      mock: 'completeness',
      todo: 'completeness',
      incomplete: 'completeness',
      test_failure: 'testing',
      missing_docs: 'documentation',
      poor_quality: 'quality',
    };
    return mapping[type] || 'quality';
  }

  /**
   * Map severity
   */
  private mapSeverity(severity: 'low' | 'medium' | 'high'): 'info' | 'warning' | 'error' | 'critical' {
    const mapping = {
      low: 'info' as const,
      medium: 'warning' as const,
      high: 'error' as const,
    };
    return mapping[severity];
  }

  /**
   * Generate required changes list
   */
  private generateRequiredChanges(critique: CritiqueResult, feedback: Review['feedback']): string[] {
    const changes: string[] = [];

    if (critique.hasMocks) {
      changes.push('Remove all mock implementations and replace with complete code');
    }

    if (critique.hasTodos) {
      changes.push('Complete all TODO items');
    }

    if (critique.hasIncompleteCode) {
      changes.push('Finish all incomplete code sections');
    }

    if (!critique.testsPassed) {
      changes.push('Fix all failing tests');
    }

    if (!critique.isDocumented) {
      changes.push('Add comprehensive documentation');
    }

    // Add specific critical issues
    const criticalIssues = feedback.filter(f => f.severity === 'critical');
    for (const issue of criticalIssues) {
      changes.push(issue.message);
    }

    return changes;
  }

  /**
   * Get minimum score for approval based on strictness
   */
  private getMinimumScore(): number {
    const scores = {
      low: 50,
      medium: 70,
      high: 85,
      extreme: 95,
    };
    return scores[this.config.strictness];
  }
}
