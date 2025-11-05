# Claude Code Wrapper - Dual Instance Architecture

## Overview

A sophisticated wrapper around Claude Code SDK that addresses quality issues by using two instances:

1. **Manager Instance (PM/Critique)**: Plans, tracks, reviews, and critiques
2. **Worker Instance**: Implements under strict supervision with extensive hooks

## Problem Statement

Claude Code with Sonnet 4.5 can be lazy and sloppy, taking shortcuts like:
- Writing mocks instead of complete implementations
- Leaving TODOs and placeholder code
- Skipping tests or error handling
- Not fully debugging issues

## Solution

The Manager instance acts as a strict project manager and code reviewer, monitoring the Worker instance through hooks and enforcing quality standards.

## Architecture

```
┌─────────────────────────────────────────────┐
│         User Request                         │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│         Orchestrator                         │
│  - Routes requests                           │
│  - Manages communication                     │
│  - Coordinates workflow                      │
└──────────────┬──────────────────────────────┘
               │
               ├─────────────────┬─────────────────┐
               ▼                 ▼                 ▼
    ┌──────────────────┐ ┌──────────────┐ ┌──────────────┐
    │   Manager        │ │ Communication │ │   Worker      │
    │   Instance       │ │   Channel     │ │   Instance    │
    │                  │ │               │ │               │
    │ - Plans tasks    │◄┼──────────────►│ │ - Implements  │
    │ - Tracks TODOs   │ │   Messages    │ │ - Tests       │
    │ - Reviews code   │ │   Events      │ │ - Debugs      │
    │ - Critiques      │ │   Approvals   │ │ - Reports     │
    │ - Approves/Blocks│ │               │ │   via Hooks   │
    └──────────────────┘ └──────────────┘ └──────┬────────┘
                                                   │
                                          ┌────────┴────────┐
                                          │ Hooks System    │
                                          │ - Pre-tool      │
                                          │ - Post-tool     │
                                          │ - Submit        │
                                          │ - Quality gates │
                                          └─────────────────┘
```

## Features

### Manager Capabilities
- **Planning**: Uses TodoWrite to create detailed task breakdowns
- **Tracking**: Monitors progress on all subtasks
- **Review**: Examines all Worker outputs before approval
- **Critique**: Provides detailed feedback on code quality
- **Quality Gates**: Blocks lazy implementations, mocks, TODOs
- **Subagents**: Uses specialized agents for complex analysis

### Worker Capabilities
- **Monitored Execution**: All actions reported via hooks
- **Test-Driven**: Must write and pass tests
- **Debugging**: Must fully resolve issues, no shortcuts
- **Documentation**: Must document all implementations
- **Hook Integration**: Extensive hooks for Manager oversight

### Communication Protocol
- `TASK_ASSIGNED`: Manager assigns task to Worker
- `TOOL_USE_REQUEST`: Worker requests permission for tool use
- `TOOL_USE_APPROVED`: Manager approves tool execution
- `TOOL_USE_BLOCKED`: Manager blocks action with feedback
- `IMPLEMENTATION_SUBMITTED`: Worker submits for review
- `REVIEW_FEEDBACK`: Manager provides critique
- `IMPLEMENTATION_APPROVED`: Manager approves work
- `IMPLEMENTATION_REJECTED`: Manager rejects, requires rework

### Quality Standards
1. **No Mocks**: Complete implementations only (unless explicitly requested)
2. **No TODOs**: All code must be finished
3. **Tests Required**: Must write and pass tests
4. **Error Handling**: Comprehensive error handling required
5. **Documentation**: Code must be well-documented
6. **Working Code**: Must actually run and work as specified

## Usage

```bash
# Start the wrapper
npm start -- "Build a REST API with authentication"

# With configuration
npm start -- --config myconfig.json "Implement feature X"

# Debug mode
npm start -- --debug "Fix bug in authentication"
```

## Configuration

### Manager Configuration
```json
{
  "strictness": "high",
  "allowMocks": false,
  "requireTests": true,
  "requireDocumentation": true,
  "maxIterations": 5
}
```

### Worker Hook Configuration
```bash
# Pre-tool hook: Request approval
# Post-tool hook: Report results
# Submit hook: Request review
```

## Example Workflow

1. **User**: "Build a user authentication system"
2. **Manager**: Creates detailed plan with 10+ subtasks
3. **Manager**: Assigns first task to Worker: "Design database schema"
4. **Worker**: (via hook) Requests approval to use Write tool
5. **Manager**: Reviews request, approves
6. **Worker**: Creates schema file
7. **Worker**: (via hook) Submits schema for review
8. **Manager**: Reviews schema, provides critique: "Add indexes"
9. **Worker**: Updates schema with indexes
10. **Worker**: Resubmits for review
11. **Manager**: Approves, assigns next task
12. **[Repeat for all subtasks]**
13. **Manager**: Final integration review
14. **Manager**: Returns completed, tested, working code to user

## Benefits

- **Quality**: Manager enforces high standards
- **Completeness**: No shortcuts or placeholders allowed
- **Accountability**: Every action is monitored and reviewed
- **Thoroughness**: All subtasks must be completed
- **Testing**: Tests are required and must pass
- **Documentation**: Code is well-documented

## Directory Structure

```
claude-code-wrapper/
├── src/
│   ├── manager/
│   │   ├── manager.ts           # Main manager logic
│   │   ├── planner.ts           # Task planning and breakdown
│   │   ├── critic.ts            # Code review and critique
│   │   └── tracker.ts           # Progress tracking
│   ├── worker/
│   │   ├── worker.ts            # Main worker logic
│   │   └── executor.ts          # Task execution
│   ├── communication/
│   │   ├── channel.ts           # IPC channel implementation
│   │   ├── protocol.ts          # Message protocol
│   │   └── queue.ts             # Message queue
│   ├── hooks/
│   │   ├── pre-tool-hook.sh     # Pre-tool execution hook
│   │   ├── post-tool-hook.sh    # Post-tool execution hook
│   │   └── submit-hook.sh       # Submission review hook
│   ├── orchestrator.ts          # Main orchestrator
│   ├── types.ts                 # Shared TypeScript types
│   └── utils.ts                 # Utility functions
├── config/
│   ├── manager-config.json      # Manager configuration
│   ├── worker-config.json       # Worker configuration
│   └── wrapper-config.json      # Wrapper configuration
├── examples/
│   └── sample-tasks.md          # Example tasks
├── tests/
│   └── integration.test.ts      # Integration tests
├── package.json
├── tsconfig.json
└── README.md
```

## License

MIT
