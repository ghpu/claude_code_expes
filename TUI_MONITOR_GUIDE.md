# TUI Monitor - Complete Guide

## ✅ Fixed: Threading Issue

**Problem:** Initial implementation tried to run textual TUI in a background thread, which failed because textual requires the main thread to set up signal handlers.

**Error:**
```
ValueError: signal only works in main thread of the main interpreter
```

**Solution:** Restructured the monitor to run in the main thread while the orchestrator runs in a background thread.

## 🎯 How It Works Now

### Architecture

```
Main Thread                    Background Thread
┌─────────────────┐           ┌──────────────────┐
│                 │           │                  │
│  Textual TUI    │◄─────────┤   Orchestrator   │
│  Monitor App    │  queues   │   Manager        │
│                 │           │   Worker         │
│  - Panels       │           │                  │
│  - Input        │           │                  │
│  - Display      │           │                  │
│                 │           │                  │
└─────────────────┘           └──────────────────┘
```

1. **Main Thread**: Runs the textual TUI (monitor)
2. **Background Thread**: Runs the orchestrator workflow
3. **Communication**: Thread-safe queues for messages
4. **User Input**: Processed in main thread, callbacks executed in background

### Code Flow

```python
# __main__.py
if args.monitor:
    monitor = create_monitor()          # Create monitor instance
    orchestrator = Orchestrator(...)    # Create orchestrator with monitor
    result = monitor.run_with_orchestrator(orchestrator.run, task)
    # ^ This blocks main thread running TUI
    #   while orchestrator runs in background thread
```

## 📦 Installation

```bash
# Required for monitor mode
pip install textual

# Or install from requirements
cd claude-wrapper-py
pip install -r requirements.txt
```

## 🚀 Usage

### Basic Monitor Mode

```bash
python -m claude_wrapper --monitor "Write a calculator with tests"
```

### With Other Flags

```bash
# Monitor + Interactive + Debug
python -m claude_wrapper --monitor --interactive --debug "Build a feature"

# Monitor + Extreme Strictness
python -m claude_wrapper --monitor --strictness extreme "Build REST API"

# Monitor + More Iterations
python -m claude_wrapper --monitor --max-iterations 10 "Complex task"
```

## 🎨 TUI Features

### Panel Layout

```
┌───────────────────── Claude Wrapper Monitor ─────────────────────┐
│ Status: Reviewing (Iteration 2/5)...                             │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─ Manager (F1) ─────────┐  ┌─ Worker (F2) ───────────┐       │
│  │ [10:30:15] ● M Started │  │ [10:30:16] ● W Started  │       │
│  │ [10:30:17] ● M Planning│  │ [10:30:18] ● W Impl...  │       │
│  │ [10:30:20] ✓ M Done    │  │ [10:30:25] ✓ W Done     │       │
│  │ [10:30:30] ● M Review  │  │ [10:30:32] ● W Waiting  │       │
│  │ ...                     │  │ ...                      │       │
│  └─────────────────────────┘  └──────────────────────────┘       │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│  ┌─ Review & Feedback (F3) ───────────────────────────────────┐  │
│  │                                                             │  │
│  │ ✗ REJECTED  │  Score: 65/100  │  Issues: 3                │  │
│  │                                                             │  │
│  │ Issues Found:                                               │  │
│  │   1. No tests found → INSTANT REJECT                       │  │
│  │   2. Missing error handling for edge cases                 │  │
│  │   3. Incomplete documentation                              │  │
│  │                                                             │  │
│  │ Required Changes:                                           │  │
│  │   1. Add comprehensive unit tests                          │  │
│  │   2. Implement proper error handling                       │  │
│  │   3. Add complete documentation                            │  │
│  │                                                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│ Ask Manager: [Type message and press Enter...]                   │
└───────────────────────────────────────────────────────────────────┘
 F1 Toggle Manager │ F2 Toggle Worker │ F3 Toggle Review │ F4 Clear
```

### Keyboard Controls

| Key | Action |
|-----|--------|
| `F1` | Toggle Manager panel visibility |
| `F2` | Toggle Worker panel visibility |
| `F3` | Toggle Review panel visibility |
| `F4` | Clear all conversation history |
| `Ctrl+C` | Exit the monitor (workflow continues in background) |
| `Enter` | Send message to Manager (when input focused) |

### Panel Features

**Manager Panel (Blue)**
- Shows Manager Claude's conversation
- Planning phase output
- Review decisions and reasoning
- User interactions

**Worker Panel (Magenta)**
- Shows Worker Claude's conversation
- Implementation progress
- Test results
- Revision attempts

**Review Panel (Cyan)**
- Review status (✓ APPROVED / ✗ REJECTED)
- Score out of 100
- List of issues found
- Required changes for next iteration
- Feedback being sent to Worker

**Input Area (Green)**
- Type messages to interact with Manager
- Works even during active workflow
- Responses appear in Manager panel

**Status Bar (Top)**
- Current workflow phase
- Iteration progress
- Real-time status updates

## 🎭 Message Types

The monitor displays different message types with visual indicators:

- `●` - Regular message
- `💭` - Thinking/reasoning (dimmed)
- `🔧` - Tool usage
- `✓` - Success
- `✗` - Error
- `⚠` - Warning

## 💡 Tips & Tricks

### Maximizing Readability

1. **Hide panels you don't need**
   - Press `F1`, `F2`, or `F3` to toggle panels
   - Focus on what matters most for your task

2. **Clear history when it gets long**
   - Press `F4` to clear conversation panels
   - Review panel stays for current iteration

3. **Use with interactive mode**
   ```bash
   python -m claude_wrapper --monitor --interactive "task"
   ```
   - Pause after each subtask
   - Ask questions via TUI input
   - Continue when ready

### Interaction Examples

**During execution, type in input area:**

```
Why did you reject this implementation?
```

```
Can you explain your approach to testing?
```

```
What would make this pass the review?
```

Manager's responses appear in the Manager panel in real-time.

## 🔧 Troubleshooting

### Monitor won't start

**Error:** `ModuleNotFoundError: No module named 'textual'`

**Solution:**
```bash
pip install textual
```

### Signal error

**Error:** `ValueError: signal only works in main thread`

**Solution:** Make sure you're using the latest version (commit `f0a94c3` or later). This bug was fixed.

### Monitor exits immediately

**Possible causes:**
- Orchestrator encountered an error
- Check terminal output for error messages
- Try with `--debug` flag for more info

### Can't see output

**Solutions:**
- Press `F1`, `F2`, `F3` to ensure panels are visible
- Scroll down in panels (they auto-scroll but you can manually scroll up)
- Press `F4` to clear and start fresh

### TUI looks broken

**Check terminal size:**
- Minimum recommended: 120 columns × 40 rows
- Resize terminal window if needed

## 📊 Performance Notes

- Monitor adds minimal overhead (~5-10ms per message)
- Thread-safe queues prevent race conditions
- Auto-scrolling optimized for large conversations
- Messages buffered for smooth updates

## 🎯 When to Use Monitor

✅ **Use Monitor When:**
- Working on complex, multi-step tasks
- Want to see both Claude instances simultaneously
- Need to understand review decisions
- Debugging workflow issues
- Learning how the dual-instance system works
- Long-running tasks where you want to monitor progress

❌ **Skip Monitor When:**
- Simple, quick tasks
- Headless/CI environments
- Terminal doesn't support TUI well
- Just want final results

## 🏗️ Technical Details

### Thread Safety

All panel updates use thread-safe queues:

```python
# Background thread (orchestrator)
monitor.add_manager_message("Planning task...")

# Main thread (TUI)
while not self.manager_queue.empty():
    msg = self.manager_queue.get_nowait()
    self.manager_panel.add_message(msg['content'])
```

### Message Flow

```
Orchestrator Thread ──► Queue ──► TUI Main Thread ──► Display
                                    │
                                    └──► Input Handler
                                            │
User Input ──────────────────────────────┘
```

### Graceful Shutdown

When you press `Ctrl+C`:
1. TUI exits cleanly
2. Background orchestrator thread finishes current operation
3. Results are preserved and returned
4. Proper cleanup of all resources

## 📝 Examples

### Example 1: Basic Usage

```bash
python -m claude_wrapper --monitor "Create a simple web server"
```

You'll see:
- Manager planning the task
- Worker implementing
- Live code review
- Iteration loop with feedback

### Example 2: With Interaction

```bash
python -m claude_wrapper --monitor "Build user authentication system"
```

While running, type in input area:
- "What security measures are you considering?"
- "Why use bcrypt over argon2?"
- "Show me the test coverage plan"

### Example 3: Debugging a Rejection

Task keeps getting rejected? Use monitor to:
1. Watch Review panel for specific issues
2. See Worker's responses to feedback
3. Ask Manager why certain approaches fail
4. Adjust requirements based on understanding

## 🎉 Summary

The TUI Monitor provides:
- **Full visibility** into dual-instance workflow
- **Real-time streaming** of conversations
- **Interactive communication** with Manager
- **Beautiful, organized** display
- **Configurable views** for your needs

It transforms the wrapper from a black box into a transparent, interactive system where you can watch, learn, and guide the AI collaboration process.

Enjoy monitoring your Claude instances! 🚀
