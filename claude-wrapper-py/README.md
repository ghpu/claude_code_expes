# Claude Wrapper - Dual Instance Mode (Python + CLI)

## 🎯 COMPLETE PYTHON IMPLEMENTATION - NO SHORTCUTS!

This is a **FULLY FUNCTIONAL** dual-instance Claude system that spawns and manages **TWO REAL Claude Code CLI processes** using your **Claude Code Max subscription**.

**NO API KEY NEEDED** - Uses your existing Claude Code authentication!

## What This Does

Spawns TWO separate Claude Code CLI processes:

1. **Manager** - Plans tasks and performs STRICT code review
2. **Worker** - Implements code knowing it will be reviewed

The Manager **ACTUALLY REJECTS** lazy code, shortcuts, mocks, and TODOs. The Worker knows this and tries harder.

## Architecture

```
User Task
    ↓
[Python Orchestrator]
    ↓
    ├─→ [Manager Process] (claude CLI instance 1)
    │   - spawn subprocess
    │   - stdin: prompts
    │   - stdout: responses
    │   - Strict system prompt
    │   - Reviews actual files
    │   - REJECTS shortcuts
    │
    └─→ [Worker Process] (claude CLI instance 2)
        - spawn subprocess
        - stdin: prompts
        - stdout: responses
        - Implementation prompt
        - Receives feedback
        - Retries until approved
```

## Installation

```bash
cd claude-wrapper-py

# No dependencies needed! Uses only Python standard library
python3 -m pip install -e .

# Or run directly
python3 -m claude_wrapper "your task"
```

## Usage

### Basic Usage

```bash
python -m claude_wrapper "Write a calculator function with tests"
```

### With Options

```bash
# Extreme strictness
python -m claude_wrapper --strictness extreme "Build a REST API"

# Allow mocks (not recommended)
python -m claude_wrapper --allow-mocks "Prototype a feature"

# Don't require tests (not recommended)
python -m claude_wrapper --no-tests "Quick script"

# Debug mode
python -m claude_wrapper --debug "Complex task"

# More iterations
python -m claude_wrapper --max-iterations 10 "Challenging task"

# Custom working directory
python -m claude_wrapper --working-dir /path/to/project "Add feature"
```

### Your Complex Task

```bash
python -m claude_wrapper \
  --strictness extreme \
  --max-iterations 7 \
  "Write a complete python + svelte 5 (no sveltekit) + tailwind 4.1 + sqlite + casbin + keycloak OIDC web application with full e2e tests"
```

## Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `--strictness` | `high` | Review strictness: `low`, `medium`, `high`, `extreme` |
| `--allow-mocks` | `false` | Allow mock implementations |
| `--no-tests` | `false` | Don't require tests |
| `--max-iterations` | `5` | Maximum review iterations per subtask |
| `--working-dir` | `pwd` | Working directory |
| `--debug` | `false` | Enable debug output |
| `--claude-path` | `/opt/node22/bin/claude` | Path to claude CLI |

## Quality Standards Enforced

The Manager will **AUTOMATICALLY REJECT** if it finds:

- ❌ Mock implementations (unless `--allow-mocks`)
- ❌ TODO comments or placeholders
- ❌ "Implement this later" notes
- ❌ Missing or failing tests (unless `--no-tests`)
- ❌ No error handling
- ❌ Missing documentation
- ❌ Code that doesn't work

## Example Workflow

```bash
$ python -m claude_wrapper "Create a simple calculator with tests"

╔════════════════════════════════════════════════════════════════╗
║     CLAUDE WRAPPER - DUAL INSTANCE MODE (Python + CLI)       ║
║     Uses Claude Code Max Subscription - NO API KEY NEEDED     ║
╚════════════════════════════════════════════════════════════════╝

Configuration:
  Task: Create a simple calculator with tests
  Strictness: high
  Require Tests: True
  Max Iterations: 5

[Orchestrator] Initializing Manager...
[MANAGER] Starting Claude process...
[MANAGER] Process started successfully (PID: 12345)

[Orchestrator] Initializing Worker...
[WORKER] Starting Claude process...
[WORKER] Process started successfully (PID: 12346)

[Orchestrator] Phase 1: PLANNING
[Orchestrator] Plan created:
  Subtasks: 3
    1. Create calculator module with add/subtract/multiply/divide
    2. Write comprehensive unit tests
    3. Add documentation and usage examples

[Orchestrator] Phase 2: IMPLEMENTATION

[Orchestrator] Subtask 1/3: Create calculator module...
[Orchestrator] Iteration 1/5
[Orchestrator] → Worker: Implement subtask
[WORKER] Writing calculator.py...
[WORKER] IMPLEMENTATION COMPLETE
[Orchestrator] ← Worker: Implementation submitted
   Files: 1
   Tests: 0

[Orchestrator] → Manager: Review implementation
[MANAGER] Reviewing implementation...
[MANAGER] Reading calculator.py...
[MANAGER] Review complete
[Orchestrator] ← Manager: Review complete
   Score: 45/100
   Status: ✗ REJECTED

[Orchestrator] ✗ Rejected - providing feedback
   Issues: 3
   Required changes:
     - No tests found → INSTANT REJECT
     - Missing error handling for division by zero
     - No documentation

[Orchestrator] Iteration 2/5
[Orchestrator] → Worker: Providing feedback...
[WORKER] Adding tests...
[WORKER] Adding error handling...
[WORKER] IMPLEMENTATION COMPLETE
[Orchestrator] ← Worker: Implementation submitted
   Files: 2
   Tests: 1

[Orchestrator] → Manager: Review implementation
[MANAGER] Reviewing... Tests passing... Good error handling...
[Orchestrator] ← Manager: Review complete
   Score: 92/100
   Status: ✓ APPROVED

[Orchestrator] ✓ Subtask 1 completed successfully

[... continues for other subtasks ...]

================================================================================
  SUMMARY
================================================================================
Subtasks completed: 3/3

✓ All subtasks completed successfully!
```

## How It Works

### 1. Process Spawning

```python
# Spawns real Claude CLI process
self.process = subprocess.Popen(
    ['/opt/node22/bin/claude'],
    stdin=subprocess.PIPE,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
    env=os.environ.copy()  # Passes through Claude Code auth
)
```

### 2. Communication

- Writes prompts to **stdin**
- Reads responses from **stdout**
- Parses output to detect completion
- Maintains conversation history

### 3. Manager Review

- Reads actual files using ToolExecutor
- Analyzes code quality
- Checks for shortcuts/mocks/TODOs
- Verifies tests pass
- Provides detailed feedback

### 4. Worker Implementation

- Receives task description
- Implements code
- Runs tests
- Submits for review
- Receives feedback and retries

### 5. Iteration Loop

- Manager reviews Worker's code
- If rejected: Worker receives feedback and retries
- If approved: Move to next subtask
- Max iterations: 5 (configurable)

## Project Structure

```
claude-wrapper-py/
├── claude_wrapper/
│   ├── __init__.py           # Package initialization
│   ├── __main__.py           # CLI entry point (main)
│   ├── claude_process.py     # Process spawning & management (230 lines)
│   ├── tool_executor.py      # File operations (210 lines)
│   ├── manager.py            # Manager instance (350 lines)
│   ├── worker.py             # Worker instance (260 lines)
│   └── orchestrator.py       # Coordination (230 lines)
├── tests/                    # Tests
├── requirements.txt          # Dependencies (none!)
├── setup.py                  # Installation
└── README.md                 # This file
```

**Total: ~1,300 lines of production Python code**

## Advantages Over TypeScript Version

✅ **No API key needed** - Uses Claude Code Max directly
✅ **Better subprocess management** - Python's subprocess module is more robust
✅ **Simpler parsing** - Text processing is cleaner in Python
✅ **No external dependencies** - Pure Python standard library
✅ **Easier to debug** - Clearer error messages and logging
✅ **Cross-platform** - Works on Linux, macOS, Windows

## Requirements

- **Python 3.8+**
- **Claude Code CLI** installed and authenticated
- **Claude Code Max subscription** (for unlimited usage)

That's it! No API key, no npm packages, no TypeScript compilation.

## Troubleshooting

### "claude: command not found"

Set the path:
```bash
python -m claude_wrapper --claude-path /path/to/claude "task"
```

### Process hangs or times out

- Increase timeout in code
- Check Claude CLI is working: `claude --help`
- Try with `--debug` flag to see detailed output

### Review rejects everything

- Lower strictness: `--strictness medium`
- Allow mocks: `--allow-mocks`
- Check Manager's feedback for specific issues

## Development

### Running Tests

```bash
python -m pytest tests/
```

### Code Formatting

```bash
black claude_wrapper/
```

### Type Checking

```bash
mypy claude_wrapper/
```

## Comparison to API Version

| Feature | Python CLI Version | TypeScript API Version |
|---------|-------------------|------------------------|
| Uses Claude Code Max | ✅ Yes | ❌ No - needs API key |
| Real dual-instance | ✅ Yes - spawns 2 CLI processes | ✅ Yes - 2 API conversations |
| Cost | ✅ Free with subscription | 💰 $0.30-$0.90 per task |
| Dependencies | ✅ None (stdlib only) | ❌ Node, TypeScript, SDK |
| Setup complexity | ✅ Simple | ⚠️ Moderate |
| Robustness | ⚠️ Depends on CLI stability | ✅ Official API |

## Known Limitations

1. **CLI Output Parsing**: Claude CLI output format may change
2. **Authentication**: Requires Claude Code session to be active
3. **Performance**: Slightly slower than API (process overhead)
4. **Error Handling**: CLI errors are harder to parse than API errors

## Future Enhancements

- [ ] Add parallel subtask execution
- [ ] Improve output parsing with regex patterns
- [ ] Add caching for repeated operations
- [ ] Support custom system prompts
- [ ] Add web UI
- [ ] Metrics and logging

## Credits

Built for users who want dual-instance enforcement with their Claude Code Max subscription, without needing separate API access.

## License

MIT

---

## TL;DR

```bash
# Install
cd claude-wrapper-py
python3 -m pip install -e .

# Run
python -m claude_wrapper "Write a calculator with tests"

# Watch it enforce quality with TWO real Claude instances!
```

**NO API KEY. NO SHORTCUTS. REAL ENFORCEMENT.**
