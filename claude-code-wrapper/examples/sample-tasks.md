# Sample Tasks for Claude Code Wrapper

This file contains example tasks to test and demonstrate the Claude Code Wrapper.

## Simple Tasks

### Task 1: Hello World
```bash
claude-wrapper "Create a simple Hello World program in TypeScript"
```

### Task 2: Utility Function
```bash
claude-wrapper "Write a utility function that validates email addresses with tests"
```

### Task 3: Data Structure
```bash
claude-wrapper "Implement a Stack data structure with push, pop, peek operations and full test coverage"
```

## Medium Complexity Tasks

### Task 4: REST API Endpoint
```bash
claude-wrapper "Create a REST API endpoint for user registration with validation and error handling"
```

### Task 5: Database Schema
```bash
claude-wrapper "Design and implement a database schema for a blog system with posts, comments, and users"
```

### Task 6: Authentication System
```bash
claude-wrapper --strictness extreme "Build a JWT-based authentication system with login, logout, and token refresh"
```

## Complex Tasks

### Task 7: Complete Feature
```bash
claude-wrapper "Implement a complete user management system with CRUD operations, authentication, and role-based access control"
```

### Task 8: Microservice
```bash
claude-wrapper "Build a microservice for handling file uploads with validation, storage, and retrieval"
```

### Task 9: Integration
```bash
claude-wrapper "Integrate a payment gateway (Stripe) with webhook handling and transaction logging"
```

## Tasks That Test Quality Gates

### Task 10: No Shortcuts Allowed
```bash
claude-wrapper --strictness extreme "Create a shopping cart system with inventory management"
```
This task will fail if the Worker tries to use mocks or incomplete code.

### Task 11: Full Test Coverage Required
```bash
claude-wrapper --strictness high "Build a calculator with support for complex expressions"
```
The Manager will reject if tests don't cover all edge cases.

### Task 12: Documentation Required
```bash
claude-wrapper "Create a library for parsing CSV files with comprehensive documentation"
```

## Configuration Examples

### Lenient Mode (allows mocks, minimal testing)
```bash
claude-wrapper --config config/lenient-config.json "Quick prototype of a chat interface"
```

### Strict Mode (no shortcuts, comprehensive tests)
```bash
claude-wrapper --config config/strict-config.json "Production-ready user authentication"
```

### Custom Configuration
```bash
cat > custom.json << EOF
{
  "manager": {
    "strictness": "high",
    "allowMocks": false,
    "requireTests": true,
    "maxIterations": 3
  }
}
EOF

claude-wrapper --config custom.json "Build feature X"
```

## Expected Behavior

### Successful Flow
1. Manager receives task
2. Manager creates detailed plan with subtasks
3. Manager assigns first subtask to Worker
4. Worker requests tool approval
5. Manager approves/blocks based on quality gates
6. Worker implements and submits
7. Manager reviews implementation
8. If approved: Move to next subtask
9. If rejected: Worker must fix issues and resubmit
10. Repeat until all subtasks complete

### Rejection Scenarios

#### Worker submits mock implementation
```
[Manager] ✗ Implementation REJECTED
[Manager] Required changes:
  - Remove all mock implementations and replace with complete code
[Worker] Retrying with corrections...
```

#### Worker leaves TODO comments
```
[Manager] ✗ Implementation REJECTED
[Manager] Required changes:
  - Complete all TODO items
[Worker] Retrying with corrections...
```

#### Tests failing
```
[Manager] ✗ Implementation REJECTED
[Manager] Required changes:
  - Fix all failing tests
[Worker] Retrying with corrections...
```

## Monitoring Progress

The Manager provides real-time progress reports:

```
=== Task Progress Report ===
Total Tasks: 10
Completed: 6 (60.0%)
In Progress: 1
Pending: 3
Blocked: 0

=== Tool Usage Statistics ===
Read: 15/15 (100.0%)
Write: 12/14 (85.7%)
Bash: 8/10 (80.0%)
```

## Tips

1. **Use strict mode for production code**: `--strictness extreme`
2. **Allow iteration**: Set `maxIterations` higher for complex tasks
3. **Enable debug mode**: Use `--debug` to see detailed Manager-Worker communication
4. **Start simple**: Test with simple tasks first to understand the workflow
5. **Review logs**: Check Manager critique messages to understand quality requirements
