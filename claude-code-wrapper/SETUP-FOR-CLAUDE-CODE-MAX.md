# Setup Guide for Claude Code Max Users

## Quick Start (2 minutes)

Even with Claude Code Max subscription, you need an Anthropic API key to use the dual-instance wrapper.

### Step 1: Get Your API Key

1. **Go to Console**: https://console.anthropic.com/
   - Sign in with your Claude account (same as Claude Code)

2. **Create API Key**:
   - Click "API Keys" in the sidebar
   - Click "Create Key"
   - Name it: "Claude Wrapper"
   - Copy the key (starts with `sk-ant-`)

3. **Check for Free Credits**:
   - New accounts often get $5-10 in free API credits
   - Check your balance in the console

### Step 2: Set Your API Key

```bash
# Option 1: Environment variable (recommended)
export ANTHROPIC_API_KEY="sk-ant-your-key-here"

# Option 2: Config file
mkdir -p ~/.claude-wrapper
echo '{"apiKey": "sk-ant-your-key-here"}' > ~/.claude-wrapper/config.json

# Option 3: Command line
npm start -- --api-key "sk-ant-your-key-here" "your task"
```

### Step 3: Use It

```bash
cd /home/mclf0736/projects/external/claude_code_expes/claude-code-wrapper

# Simple task
npm start -- "Write a function to calculate fibonacci with tests"

# Your complex task
npm start -- "Write a complete python + svelte 5 (no sveltekit) + tailwind 4.1 + sqlite + casbin + keycloak OIDC web application with full e2e tests"

# With extreme quality standards
npm start -- --strictness extreme "Build production-grade REST API"
```

## Why Do You Need an API Key?

**Claude Code subscription** gives you access to:
- Claude Code IDE/CLI interface
- Interactive coding assistance
- Your current session

**Anthropic API key** enables:
- Programmatic access to Claude models
- Running TWO separate Claude instances
- Automated code review system
- The dual-instance wrapper

They're separate services but you can use the same account!

## Cost Estimate

With the dual-instance system:
- **Planning**: ~2,000 tokens
- **Implementation**: ~5,000 tokens per iteration
- **Review**: ~3,000 tokens per iteration
- **Typical task**: 10,000-30,000 total tokens

**Cost per task**: $0.30-$0.90

**Worth it because**:
- No lazy code
- No shortcuts or mocks
- Real tests that pass
- Complete documentation
- High-quality output

## What You Get

Instead of one Claude that might be lazy:

```
Single Instance:
User → Claude Code → Maybe shortcuts, TODOs, missing tests ❌

Dual Instance Wrapper:
User → Manager Claude → Reviews everything
              ↓
         Worker Claude → Implements (knows it will be reviewed)
              ↓
         Manager Claude → REJECTS if incomplete
              ↓
         Worker Claude → Fixes and retries
              ↓
         Manager Claude → APPROVES only when perfect ✅
```

## Verify Setup

Check if your key works:

```bash
# Test with simple task
npm start -- "Write a hello world function in Python with a test"
```

You should see:
```
✓ API key found

[Orchestrator] Phase 1: Planning
[Manager] Planning task...
[Manager] Plan created: ...
```

## Troubleshooting

### "API key required" error

```bash
# Check if key is set
echo $ANTHROPIC_API_KEY

# Should show: sk-ant-...
# If empty, set it again
```

### "Authentication failed" error

- Your API key may be invalid
- Go to console.anthropic.com and create a new one

### "Rate limit exceeded" error

- You're making too many requests
- Wait a minute and try again
- Or upgrade your API plan

## Alternative: Use Mock Mode (Not Recommended)

If you really don't want to use the API, you can use the old mock version:

```bash
npm run start:mock -- "your task"
```

But this **doesn't actually work** - it just prints fake logs. The whole point of this wrapper is to have REAL dual-instance enforcement.

## Questions?

1. **Do I need to pay for both Claude Code AND API?**
   - Claude Code subscription is separate from API usage
   - API has its own billing (often with free credits)

2. **Can I use my Claude Code subscription for API calls?**
   - No, they're separate services
   - But you can use the same account for both

3. **Is it worth the extra cost?**
   - If you value high-quality, complete code: YES
   - The wrapper prevents lazy implementations
   - Saves time by catching issues early

4. **How do I monitor my API usage?**
   - Go to console.anthropic.com
   - Check "Usage" section
   - The wrapper also shows token usage after each task

## Ready to Go!

Once you have your API key set:

```bash
export ANTHROPIC_API_KEY="sk-ant-your-key"
npm start -- "Your challenging task that requires NO SHORTCUTS"
```

The Manager will enforce quality. The Worker will deliver completeness. You'll get production-ready code.

**NO LAZY CODE. NO SHORTCUTS. REAL DUAL-INSTANCE ENFORCEMENT.**
