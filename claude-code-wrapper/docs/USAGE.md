# Usage Guide

## Installation

```bash
cd claude-code-wrapper
npm install
npm run build
```

## Quick Start

### Command Line

```bash
# Simple task
npx claude-wrapper "Create a Hello World program"

# With options
npx claude-wrapper --strictness high "Build a REST API"

# With custom config
npx claude-wrapper --config myconfig.json "Implement feature X"
```

### Programmatic Usage

```typescript
import { run } from 'claude-code-wrapper';

await run('Build a user authentication system', {
  manager: {
    strictness: 'high',
    requireTests: true,
  },
});
```

## Configuration

### Config File Structure

```json
{
  "manager": {
    "strictness": "high",
    "allowMocks": false,
    "requireTests": true,
    "requireDocumentation": true,
    "maxIterations": 5
  },
  "worker": {
    "enableHooks": true,
    "requestApprovalFor": ["Write", "Edit", "Bash"],
    "workingDirectory": "."
  },
  "communication": {
    "channelType": "file",
    "timeout": 30000
  },
  "logging": {
    "level": "info"
  }
}
```

### Strictness Levels

**Low**:
- Allows shortcuts
- Minimal testing
- Fast but lower quality

**Medium**:
- Balanced approach
- Good testing
- Moderate quality

**High** (recommended):
- No shortcuts
- Comprehensive testing
- High quality

**Extreme**:
- Perfect code
- Maximum test coverage
- Highest quality

## Workflow

### 1. Planning Phase

The Manager analyzes your request and creates a detailed plan:

```
[Manager] Starting workflow for: "Build user authentication"

[Manager] Plan created:
  Main task: Build user authentication
  Subtasks: 10
  Estimated duration: 300 minutes

  Risks identified:
    - High number of requirements may increase complexity
    - Worker may attempt shortcuts or incomplete implementations
```

### 2. Task Execution

The Manager assigns tasks one by one to the Worker:

```
[Manager] Assigning task to Worker:
  Task: Requirements Analysis: Analyze and document detailed requirements
  Priority: critical
  Checklist items: 16

[Worker] Received task: Requirements Analysis
[Worker] Executing task...
```

### 3. Tool Approval

Before each tool use, Worker requests approval:

```
[Worker] Requesting approval for Write...

[Manager] Tool use request: Write
  Reason: Create implementation file
  Impact: high

[Manager] ✓ Approved
```

### 4. Implementation Review

After implementation, Manager reviews the work:

```
[Worker] Submitting implementation for review...
  Files: 5
  Tests: 3

[Manager] Reviewing implementation...
[Manager] Review complete - Score: 92/100
[Manager] Status: ✓ APPROVED
```

### 5. Rejection & Iteration

If quality is insufficient, Manager rejects:

```
[Manager] Review complete - Score: 65/100
[Manager] Status: ✗ REJECTED

[Manager] Feedback:
  CRITICAL: Mock implementations found - complete implementations required
  ERROR: TODO comments found - all code must be complete
  WARNING: console.log found - use proper logging

[Manager] Required changes:
  - Remove all mock implementations and replace with complete code
  - Complete all TODO items
  - Replace console.log with proper logging

[Worker] Retrying with corrections...
```

### 6. Completion

When all tasks are done:

```
[Manager] All tasks completed!

=== Task Progress Report ===
Total Tasks: 10
Completed: 10 (100.0%)
In Progress: 0
Pending: 0
Blocked: 0

✓ Task completed successfully!
```

## Common Scenarios

### Scenario 1: Simple Feature

```bash
claude-wrapper "Add email validation to the user form"
```

**What happens**:
1. Manager creates 3-5 subtasks
2. Worker implements validation logic
3. Worker writes tests
4. Manager reviews and approves
5. Done in 1-2 iterations

### Scenario 2: Complex System

```bash
claude-wrapper --strictness extreme "Build a complete e-commerce checkout system"
```

**What happens**:
1. Manager creates 15+ subtasks
2. Each subtask goes through multiple iterations
3. Manager enforces strict quality standards
4. Worker must fix all issues
5. Done in 3-5 iterations per subtask

### Scenario 3: Quick Prototype

```bash
claude-wrapper --allow-mocks --no-tests "Prototype a chat interface"
```

**What happens**:
1. Manager allows mocks and skips test requirements
2. Worker can use placeholder implementations
3. Fast completion, lower quality
4. Suitable for demos and prototypes

### Scenario 4: Production Code

```bash
claude-wrapper --config config/strict-config.json "Production authentication system"
```

**What happens**:
1. Extreme quality standards
2. No shortcuts allowed
3. Comprehensive testing required
4. Full documentation required
5. Maximum 3 iterations per task
6. Takes longer but highest quality

## Troubleshooting

### Worker Keeps Getting Rejected

**Symptom**: Same task rejected multiple times

**Causes**:
- Worker using mocks (set `allowMocks: true` or fix code)
- Tests not passing (debug test failures)
- Missing documentation (add docs)

**Solution**:
```bash
# Lower strictness temporarily
claude-wrapper --strictness medium "task"

# Or allow mocks during development
claude-wrapper --allow-mocks "task"
```

### Timeout Errors

**Symptom**: "Timeout waiting for reply"

**Causes**:
- Manager not responding
- Communication channel issues
- Very slow operations

**Solution**:
```json
{
  "communication": {
    "timeout": 60000  // Increase timeout
  },
  "worker": {
    "hookTimeout": 60000
  }
}
```

### Max Iterations Exceeded

**Symptom**: "Maximum iterations exceeded"

**Causes**:
- Worker not learning from feedback
- Requirements too strict
- Complex task needs more attempts

**Solution**:
```json
{
  "manager": {
    "maxIterations": 10  // Allow more attempts
  }
}
```

### Tool Use Blocked

**Symptom**: Worker tools keep getting blocked

**Causes**:
- Manager being too cautious
- Inappropriate tool for task
- Security concerns

**Solution**:
```json
{
  "manager": {
    "autoApproveSimpleChanges": true  // Auto-approve safe operations
  },
  "worker": {
    "requestApprovalFor": ["Bash"]  // Only require approval for risky tools
  }
}
```

## Best Practices

### 1. Start Simple

Begin with simple tasks to understand the workflow:

```bash
claude-wrapper "Create a utility function"
```

### 2. Use Appropriate Strictness

- Development: `medium`
- Production: `high` or `extreme`
- Prototypes: `low`

### 3. Review Manager Feedback

Pay attention to rejection reasons - they indicate quality expectations.

### 4. Iterate Configuration

Start with defaults, then tune based on your needs:

```json
{
  "manager": {
    "strictness": "high",
    "maxIterations": 5
  }
}
```

### 5. Monitor Progress

Enable info logging to see what's happening:

```json
{
  "logging": {
    "level": "info"
  }
}
```

### 6. Use Version Control

The wrapper works best with git:

```bash
git init
git add .
git commit -m "Initial commit"

claude-wrapper "Add feature X"
```

### 7. Break Down Large Tasks

For very complex tasks, break them down manually:

```bash
# Instead of:
claude-wrapper "Build entire application"

# Do:
claude-wrapper "Build authentication module"
claude-wrapper "Build user management module"
claude-wrapper "Build admin dashboard"
```

## Advanced Usage

### Custom Quality Gates

Create custom checks by extending Critic:

```typescript
import { Critic } from 'claude-code-wrapper';

class CustomCritic extends Critic {
  private checkCustomRule(content: string): boolean {
    // Your custom quality check
    return !content.includes('forbidden-pattern');
  }
}
```

### Multiple Workers (Future)

In future versions, you'll be able to run multiple workers:

```typescript
const orchestrator = new Orchestrator(config);
await orchestrator.addWorker('worker-1');
await orchestrator.addWorker('worker-2');
await orchestrator.execute('Large task');
```

### Web Dashboard (Future)

Monitor workflows in real-time:

```bash
claude-wrapper --dashboard "Build feature X"
# Opens browser at http://localhost:3000
```

## Tips & Tricks

### Debug Manager-Worker Communication

```bash
# In terminal 1: watch Manager inbox
watch -n 1 'ls -la /tmp/claude-wrapper-*/manager-inbox/'

# In terminal 2: watch Worker inbox
watch -n 1 'ls -la /tmp/claude-wrapper-*/worker-inbox/'

# In terminal 3: run wrapper
claude-wrapper --debug "task"
```

### Save Workflow State

```typescript
import { Orchestrator } from 'claude-code-wrapper';

const orchestrator = new Orchestrator(config);
await orchestrator.initialize();
await orchestrator.execute('task');

// Save state
const state = orchestrator.getStatus();
fs.writeFileSync('workflow-state.json', JSON.stringify(state, null, 2));
```

### Resume After Failure

```typescript
// Load previous state
const state = JSON.parse(fs.readFileSync('workflow-state.json', 'utf-8'));

// Create new orchestrator and restore state
const orchestrator = new Orchestrator(config);
await orchestrator.initialize();
await orchestrator.restoreState(state);  // Future feature
await orchestrator.execute('continue');
```

### Dry Run Mode (Future)

Preview what will happen without executing:

```bash
claude-wrapper --dry-run "task description"
# Shows plan without executing
```

## Getting Help

### Enable Verbose Logging

```bash
claude-wrapper --debug "task"
```

### Check Progress Report

The Manager generates progress reports automatically.

### Review Configuration

```bash
claude-wrapper --show-config
```

### Report Issues

If you encounter problems:

1. Enable debug logging
2. Save the output
3. Check the architecture docs
4. Report with minimal reproduction case

## Integration

### CI/CD Pipeline

```yaml
# .github/workflows/feature.yml
name: Generate Feature

on:
  workflow_dispatch:
    inputs:
      feature:
        description: 'Feature description'
        required: true

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node
        uses: actions/setup-node@v2
      - name: Install wrapper
        run: |
          cd claude-code-wrapper
          npm install
      - name: Generate feature
        run: |
          npx claude-wrapper "${{ github.event.inputs.feature }}"
      - name: Create PR
        uses: peter-evans/create-pull-request@v4
        with:
          title: "Feature: ${{ github.event.inputs.feature }}"
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Use wrapper to review code before commit
npx claude-wrapper "Review staged changes for quality issues"
```
