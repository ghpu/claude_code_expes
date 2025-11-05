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

# Interactive mode - pause after each subtask to interact with Manager
python -m claude_wrapper --interactive "Build a complex feature"

# TUI Monitor mode - see live conversations in beautiful interface
python -m claude_wrapper --monitor "Build a complex feature"

# Both interactive and monitor
python -m claude_wrapper --interactive --monitor "Build a complex feature"

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

# Custom Claude path
python -m claude_wrapper --claude-path /usr/local/bin/claude "Task"
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
| `--interactive` | `false` | Enable interactive mode - pause after each subtask to interact with Manager |
| `--monitor` | `false` | Enable advanced TUI monitor with live conversation view (requires `textual`) |
| `--allow-mocks` | `false` | Allow mock implementations |
| `--no-tests` | `false` | Don't require tests |
| `--max-iterations` | `5` | Maximum review iterations per subtask |
| `--working-dir` | `pwd` | Working directory |
| `--debug` | `false` | Enable debug output |
| `--claude-path` | `claude` | Path to claude CLI |

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

## New Features

### 🎨 Beautiful Terminal UI

The wrapper now includes a rich terminal UI with:

- **Color-coded output** - Manager (blue), Worker (magenta), Orchestrator (cyan)
- **Real-time streaming** - Watch Claude's responses as they arrive
- **Progress bars** - Visual iteration progress
- **Formatted boxes** - Clean display of reviews, feedback, and summaries
- **Status indicators** - ✓ success, ✗ error, ⚠ warning
- **Timestamps** - Track when events occur

All output is beautifully formatted with ANSI colors and structured layouts for easy monitoring.

### 🎯 Interactive Mode

With `--interactive`, you can pause the workflow after each subtask and interact directly with the Manager Claude instance:

```bash
python -m claude_wrapper --interactive "Build a feature"
```

**What you can do in interactive mode:**

- Ask the Manager questions about the implementation
- Request clarifications on the plan
- Discuss architecture decisions
- Get explanations of review decisions
- Provide additional requirements
- Type `continue` to proceed with the next subtask
- Type `quit` to exit

**Example interaction:**

```
[After subtask 1 completes]

  Enter message for Manager (or 'continue' to proceed): Why did you choose that approach?

[MANAGER] User interaction: Why did you choose that approach?...
[MANAGER] Response ready

┌─ Manager Response ──────────────────────────────────────────────┐
│ I chose this approach because it provides better separation     │
│ of concerns and makes testing easier. The implementation        │
│ follows SOLID principles and allows for future extensibility.   │
└──────────────────────────────────────────────────────────────────┘

  Ask another question? (y/n): n
```

### 📊 Advanced TUI Monitor

**NEW!** The `--monitor` flag launches an advanced Terminal User Interface with live conversation views:

```bash
# Install textual first (optional dependency)
pip install textual

# Run with monitor
python -m claude_wrapper --monitor "Build a feature"
```

**Monitor Features:**

- **Dual Conversation Panels** - See Manager and Worker conversations side-by-side in real-time
- **Live Streaming** - Watch Claude's responses as they arrive, character by character
- **Review Panel** - See detailed review results, scores, issues, and required changes
- **Interactive Input** - Type messages to interact with the Manager directly from the TUI
- **Keyboard Controls:**
  - `F1` - Toggle Manager panel visibility
  - `F2` - Toggle Worker panel visibility
  - `F3` - Toggle Review panel visibility
  - `F4` - Clear all conversation history
  - `Ctrl+C` - Exit the application
- **Auto-scrolling** - Panels automatically scroll to show latest messages
- **Color-coded messages** - Manager (blue), Worker (magenta), status indicators
- **Status bar** - Shows current workflow status and progress

**Monitor Layout:**

```
┌──────────────────────── Claude Wrapper Monitor ─────────────────────┐
│ Status: Reviewing (Iteration 2/5)...                                │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─ Manager (F1) ─────────┐  ┌─ Worker (F2) ──────────┐           │
│  │ [10:30:15] ● M Starting│  │ [10:30:16] ● W Starting│           │
│  │ [10:30:17] ● M Planning│  │ [10:30:18] ● W Impl... │           │
│  │ [10:30:20] ✓ M Plan OK │  │ [10:30:25] ✓ W Done    │           │
│  │ [10:30:30] ● M Review  │  │ [10:30:32] ● W Waiting │           │
│  │                         │  │                         │           │
│  └─────────────────────────┘  └─────────────────────────┘           │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│  ┌─ Review & Feedback (F3) ──────────────────────────────────────┐  │
│  │ ✗ REJECTED  │  Score: 65/100  │  Issues: 3                    │  │
│  │                                                                 │  │
│  │ Issues Found:                                                   │  │
│  │   1. No tests found → INSTANT REJECT                           │  │
│  │   2. Missing error handling for edge cases                     │  │
│  │   3. Incomplete documentation                                  │  │
│  │                                                                 │  │
│  │ Required Changes:                                               │  │
│  │   1. Add comprehensive unit tests                              │  │
│  │   2. Implement proper error handling                           │  │
│  └─────────────────────────────────────────────────────────────────┘  │
│                                                                      │
├──────────────────────────────────────────────────────────────────────┤
│ Ask Manager: [Type message and press Enter...]                      │
└──────────────────────────────────────────────────────────────────────┘
```

**When to use the Monitor:**

- **Complex tasks** - See both instances working simultaneously
- **Debugging** - Watch the full conversation flow in real-time
- **Learning** - Understand how Manager and Worker collaborate
- **Long-running tasks** - Monitor progress without cluttering the terminal
- **Interactive development** - Ask questions while watching the workflow

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
│   ├── __main__.py           # CLI entry point with argument parsing
│   ├── claude_process.py     # Process spawning & management (290 lines)
│   ├── tool_executor.py      # File operations (Read/Write/Edit/Bash/Glob/Grep) (210 lines)
│   ├── manager.py            # Manager instance with strict review (360 lines)
│   ├── worker.py             # Worker instance for implementation (280 lines)
│   ├── orchestrator.py       # Coordination and workflow (260 lines)
│   ├── terminal_ui.py        # Beautiful terminal UI with colors (310 lines)
│   └── monitor.py            # Advanced TUI monitor with live views (450 lines)
├── tests/                    # Tests
├── requirements.txt          # Dependencies (textual for monitor)
├── setup.py                  # Installation
└── README.md                 # This file
```

**Total: ~2,160 lines of production Python code**

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
- **textual** (optional, only for `--monitor` flag): `pip install textual`

Core functionality uses only Python standard library. The TUI monitor is optional but highly recommended for better visibility.

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
