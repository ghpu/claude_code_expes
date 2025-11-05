# Claude Code Max Subscription - Technical Reality

## The Situation

You have **Claude Code Max**, which gives you access to the interactive Claude Code CLI/IDE. You want to use the dual-instance wrapper **without needing a separate API key**.

## The Technical Challenge

**Claude Code CLI** is designed for **interactive human use**, not programmatic spawning:

```
Claude Code CLI:
- Interactive terminal interface
- Designed for human conversation
- Uses authentication tied to your session
- NOT designed to be spawned programmatically
- Cannot easily spawn multiple instances

Anthropic API:
- Programmatic access
- Designed for automation
- Can create multiple separate conversations
- Requires API key (separate from Claude Code subscription)
```

## Why Spawning Claude CLI Won't Work Well

1. **Authentication Issues**: Claude Code uses session-based auth that may not work for child processes
2. **Output Parsing**: CLI output is designed for humans, not machines (formatting, colors, interactive prompts)
3. **Tool Interception**: Can't easily intercept and approve/block tools
4. **State Management**: Hard to manage conversation state across process restarts
5. **Fragile**: Any change to CLI output format breaks everything

## Your Options

### Option 1: Use Anthropic API (Recommended) ⭐

**What you need:**
- Get an API key from console.anthropic.com (same account as Claude Code)
- You may have free credits ($5-10)
- Cost: ~$0.30-$0.90 per task after free credits

**What you get:**
- TWO real Claude instances
- Manager actually reviews code
- Automatic rejection of lazy work
- Iteration until quality standards met
- **REAL dual-instance enforcement**

**Setup:**
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
npm start -- "your task"
```

### Option 2: Enhanced Single Instance (No API Key Needed)

**What you need:**
- Nothing - uses your existing Claude Code subscription

**What you get:**
- ONE Claude instance (current session)
- Enhanced system prompt enforcing quality
- Checklist-based task tracking
- Self-review prompts
- **NOT true dual-instance** (Claude reviewing its own work)

**Setup:**
```bash
npm run start:enhanced -- "your task"
```

This is basically me (current Claude session) trying really hard to not be lazy, with better prompting and checklists. But I'm still reviewing my own work, so it's not as strict as having a separate Manager.

### Option 3: Manual Dual-Instance

**What you need:**
- Two separate Claude Code sessions (two terminal windows)
- Manual copy/paste between them

**What you get:**
- Real separation
- No API costs
- Manual process (you do the coordination)

**Process:**
1. Terminal 1: Ask Claude to implement the task
2. Copy the code
3. Terminal 2: Ask a fresh Claude to review it strictly
4. Copy feedback back
5. Repeat until approved

### Option 4: Wait for Official Feature

Claude Code may eventually add built-in multi-instance support, but that's not available yet.

## My Recommendation

**If you value complete, non-lazy code:** Get the API key (Option 1)
- You probably have free credits
- $0.30-$0.90 per task is worth it for quality
- Real dual-instance enforcement

**If you don't want any API costs:** Use Option 2 (Enhanced Single Instance)
- I'll try my best to be thorough
- But I can't enforce quality as strictly as a separate Manager
- Self-review is inherently limited

**If you want to be hands-on:** Use Option 3 (Manual)
- Real separation
- More work for you
- Free

## The Bottom Line

There's no way to programmatically spawn multiple Claude Code CLI instances using your Max subscription alone. The dual-instance system **requires** either:

1. Anthropic API (separate from Claude Code subscription)
2. Manual coordination between separate Claude sessions
3. Single instance with better prompting (not true dual-instance)

## What Do You Want To Do?

A. **Get API key** - I'll help you set it up (2 minutes, may have free credits)
B. **Enhanced single instance** - I'll build a better prompted version (no second instance though)
C. **Manual process** - I'll give you a guide for running two sessions manually
D. **Something else** - Tell me what you're thinking

Let me know and I'll implement whichever approach you prefer!
