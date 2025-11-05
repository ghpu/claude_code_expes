# Architecture Documentation

## Overview

The Claude Code Wrapper uses a dual-instance architecture to enforce code quality and completeness by separating planning/oversight from implementation.

## Components

### 1. Orchestrator

**File**: `src/orchestrator.ts`

**Purpose**: Main coordinator that:
- Initializes both Manager and Worker instances
- Sets up communication channels
- Coordinates the overall workflow
- Handles lifecycle management

**Key Methods**:
- `initialize()`: Sets up communication and instances
- `execute(request)`: Runs a complete workflow
- `shutdown()`: Cleanup and teardown

### 2. Manager Instance

**Files**:
- `src/manager/manager.ts` - Main manager logic
- `src/manager/planner.ts` - Task planning and breakdown
- `src/manager/critic.ts` - Code review and quality checks
- `src/manager/tracker.ts` - Progress tracking

**Purpose**: Acts as project manager and code reviewer

**Responsibilities**:
1. **Planning**:
   - Break down user requests into detailed subtasks
   - Identify dependencies
   - Create checklists and requirements
   - Estimate effort and identify risks

2. **Tracking**:
   - Monitor progress on all tasks
   - Track tool usage statistics
   - Generate progress reports

3. **Review & Critique**:
   - Review all Worker implementations
   - Check for quality issues (mocks, TODOs, incomplete code)
   - Verify tests pass
   - Ensure documentation exists
   - Calculate quality scores
   - Approve or reject implementations

4. **Approval**:
   - Approve/block Worker tool usage
   - Enforce quality gates
   - Limit iterations to prevent infinite loops

**Quality Gates**:
- No mock implementations (unless allowed)
- No TODO comments
- No incomplete code
- All tests must pass
- Documentation required
- No console.log in production code
- Functions not too long (< 100 lines)
- Nesting not too deep (< 4 levels)

### 3. Worker Instance

**Files**:
- `src/worker/worker.ts` - Main worker logic

**Purpose**: Performs implementation under Manager supervision

**Responsibilities**:
1. **Implementation**:
   - Write code based on task assignments
   - Follow Manager's requirements
   - Request approval for destructive operations

2. **Testing**:
   - Write comprehensive tests
   - Run tests and report results
   - Fix test failures

3. **Documentation**:
   - Document all implementations
   - Add code comments
   - Write API documentation

4. **Reporting**:
   - Report progress to Manager
   - Request tool use approvals
   - Submit implementations for review
   - Handle rejection feedback

**Hooks Integration**:
- Pre-tool hook: Request approval before tool use
- Post-tool hook: Report tool execution results
- Submit hook: Submit implementation for review

### 4. Communication Layer

**Files**:
- `src/communication/channel.ts` - Channel implementation
- `src/communication/protocol.ts` - Message protocol

**Purpose**: Enable Manager-Worker communication

**Implementation**: File-based message passing
- Each instance has inbox/outbox directories
- Messages are JSON files
- Polling mechanism for receiving messages
- Supports request/response patterns

**Message Types**:
- `TASK_ASSIGNED`: Manager assigns task
- `TOOL_USE_REQUEST`: Worker requests approval
- `TOOL_USE_APPROVED/BLOCKED`: Manager responds
- `IMPLEMENTATION_SUBMITTED`: Worker submits work
- `REVIEW_FEEDBACK`: Manager provides critique
- `IMPLEMENTATION_APPROVED/REJECTED`: Final decision
- `STATUS_UPDATE`: Progress updates
- `ERROR_REPORT`: Error notifications
- `HEARTBEAT`: Keep-alive messages

### 5. Hooks System

**Files**:
- `src/hooks/pre-tool-hook.sh` - Pre-tool execution
- `src/hooks/post-tool-hook.sh` - Post-tool execution
- `src/hooks/submit-hook.sh` - Implementation submission

**Purpose**: Monitor Worker actions in real-time

**How It Works**:
1. Worker's Claude Code SDK is configured with hooks
2. Before any tool use, pre-hook runs
3. Pre-hook sends request to Manager via channel
4. Pre-hook waits for approval
5. If approved, tool executes
6. Post-hook reports results to Manager

This creates a tight supervision loop where Manager can block inappropriate actions.

## Data Flow

### Task Execution Flow

```
User Request
    ↓
Orchestrator.execute()
    ↓
Manager.startWorkflow()
    ↓
Planner.planTask()
    ├─→ Break into subtasks
    ├─→ Identify dependencies
    ├─→ Create checklists
    └─→ Estimate effort
    ↓
Manager.assignNextTask()
    ↓
Channel → TASK_ASSIGNED message → Worker
    ↓
Worker.executeTask()
    ↓
[For each tool use]
    ↓
Worker → TOOL_USE_REQUEST → Manager
    ↓
Manager.evaluateToolUseRequest()
    ↓
Manager → TOOL_USE_APPROVED/BLOCKED → Worker
    ↓
[If approved] Worker executes tool
    ↓
Worker → TOOL_USE_COMPLETED → Manager
    ↓
[After implementation]
    ↓
Worker → IMPLEMENTATION_SUBMITTED → Manager
    ↓
Critic.reviewImplementation()
    ├─→ Check for mocks
    ├─→ Check for TODOs
    ├─→ Check for incomplete code
    ├─→ Verify tests pass
    ├─→ Check documentation
    └─→ Calculate score
    ↓
Manager → REVIEW_FEEDBACK → Worker
Manager → IMPLEMENTATION_APPROVED/REJECTED → Worker
    ↓
[If approved]
    ↓
Manager.assignNextTask()
    ↓
[If rejected]
    ↓
Worker.executeTask() [retry with fixes]
    ↓
[Repeat until approved or max iterations]
    ↓
[When all tasks complete]
    ↓
Manager emits 'workflow-completed'
    ↓
Orchestrator.shutdown()
```

### Communication Pattern

```
┌─────────────┐                          ┌─────────────┐
│   Manager   │                          │   Worker    │
│   Instance  │                          │   Instance  │
└──────┬──────┘                          └──────┬──────┘
       │                                        │
       │ Write: worker-inbox/msg.json          │
       │───────────────────────────────────────→│
       │                                        │
       │                                        │ Read: worker-inbox/
       │                                        │ (polling)
       │                                        │
       │          Write: manager-inbox/msg.json│
       │←───────────────────────────────────────│
       │                                        │
Read:  │                                        │
manager-inbox/                                  │
(polling)                                       │
       │                                        │
```

## Quality Enforcement

### Strictness Levels

**Low** (score ≥ 50):
- Basic functionality required
- Some issues tolerated
- Minimal testing

**Medium** (score ≥ 70):
- Good functionality
- Most issues fixed
- Adequate testing

**High** (score ≥ 85):
- Complete functionality
- No shortcuts
- Comprehensive testing
- Documentation required

**Extreme** (score ≥ 95):
- Perfect implementation
- Zero tolerance for issues
- Maximum test coverage
- Full documentation

### Quality Score Calculation

Base score: 100

**Deductions**:
- Mock implementation: -40
- TODO comment: -20
- Incomplete code: -35
- Test failures: -30
- Missing documentation: -15
- console.log: -5
- Long function: -10
- Deep nesting: -5

**Minimum Requirements**:
- No critical issues
- Score ≥ minimum for strictness level
- All required changes addressed

### Iteration Limits

To prevent infinite loops:
- Maximum iterations configurable (default: 5)
- Each rejection increments counter
- After max iterations, workflow fails
- Worker must learn from feedback

## Configuration

### Manager Config
```typescript
{
  strictness: 'low' | 'medium' | 'high' | 'extreme',
  allowMocks: boolean,
  requireTests: boolean,
  requireDocumentation: boolean,
  maxIterations: number,
  qualityGates: string[],
  reviewTimeout: number,
  autoApproveSimpleChanges: boolean,
  minTestCoverage?: number
}
```

### Worker Config
```typescript
{
  enableHooks: boolean,
  hookTimeout: number,
  maxRetries: number,
  requestApprovalFor: string[],  // Tool names
  autoSubmitAfterTools: string[],  // Tool names
  workingDirectory: string
}
```

## Extension Points

### Custom Quality Gates

Add custom quality checks in `Critic`:

```typescript
private checkCustomRule(content: string): boolean {
  // Your logic
  return true;
}
```

### Custom Planning

Extend `Planner` to use different task breakdown strategies:

```typescript
static customBreakdown(task: Task): Task[] {
  // Your logic
  return subtasks;
}
```

### Communication Channels

Implement alternative channels (IPC, sockets):

```typescript
class SocketChannel extends EventEmitter {
  // Implement Channel interface
}
```

## Performance Considerations

### Message Polling
- 100ms polling interval
- Immediate deletion after processing
- Sorted by timestamp for ordering

### File-based Communication
- Simple and debuggable
- No external dependencies
- Suitable for local development
- Can be replaced with IPC/sockets for production

### Memory Usage
- Message queue size limited (default: 100)
- Old messages automatically removed
- Cleanup on shutdown

## Security Considerations

### Sandboxing
- Worker runs in separate process
- All tool use must be approved
- Destructive operations require high-impact approval
- Working directory configurable

### Validation
- All messages validated before processing
- Tool parameters sanitized
- File paths checked

### Timeout Protection
- All operations have timeouts
- Prevents hanging on Worker failure
- Configurable timeout values

## Debugging

### Enable Debug Mode
```bash
claude-wrapper --debug "task description"
```

### Log Levels
- `debug`: All Manager-Worker communication
- `info`: Important events only
- `warn`: Warnings and errors
- `error`: Errors only

### Message Inspection
Messages are stored temporarily in channel directories:
```bash
ls /tmp/claude-wrapper-*/manager-inbox/
ls /tmp/claude-wrapper-*/worker-inbox/
```

### Progress Reports
Manager generates progress reports:
```typescript
const tracker = manager.getTracker();
console.log(tracker.generateReport());
```

## Future Enhancements

1. **Web UI**: Dashboard for monitoring workflow
2. **Multiple Workers**: Parallel task execution
3. **Persistent Storage**: Save workflow state
4. **Metrics**: Detailed analytics on quality
5. **Learning**: Manager learns from past reviews
6. **Templates**: Pre-configured task templates
7. **Integration**: CI/CD pipeline integration
8. **Collaboration**: Multiple users/managers
