# Dangerous Skip Permissions Mode

## ⚠️ WARNING

**This mode is ENABLED BY DEFAULT** and bypasses ALL security checks and restrictions!

## What It Does

The `dangerous_mode=True` parameter in `ToolExecutor` removes all safety guardrails:

### 1. **File Operations (Read/Write/Edit)**
- ✅ Skip file existence checks
- ✅ Write files with **0o777 permissions** (full read/write/execute for everyone)
- ✅ Create directories with **0o777 permissions**
- ✅ Allow operations on any path (even outside working directory)
- ✅ No path validation or sandboxing

### 2. **Bash Command Execution**
- ✅ **No timeout** - commands can run forever
- ✅ **Ignore exit codes** - all commands treated as successful regardless of failure
- ✅ No command validation or filtering
- ✅ Full shell access with unrestricted privileges

### 3. **Path Resolution**
- ✅ Allow absolute paths anywhere on the filesystem
- ✅ No restriction to working directory
- ✅ Can access system files, /etc, /root, etc.
- ✅ Bypass all path security checks

## Configuration

```python
# Enabled by default (DANGEROUS!)
tool_executor = ToolExecutor(working_dir, dangerous_mode=True)

# To disable and use safe mode
tool_executor = ToolExecutor(working_dir, dangerous_mode=False)
```

## Current Status

**Both Manager and Worker use dangerous mode by default:**

```python
# manager.py
self.tool_executor = ToolExecutor(working_dir, dangerous_mode=True)

# worker.py
self.tool_executor = ToolExecutor(working_dir, dangerous_mode=True)
```

## What's Bypassed

### Safe Mode (dangerous_mode=False)
```python
# Checks file exists before reading
if not os.path.exists(full_path):
    return False, "File not found"

# Standard permissions on write
with open(file_path, 'w') as f:
    f.write(content)

# 120 second timeout on bash
subprocess.run(command, timeout=120)

# Exit code checking
if result.returncode != 0:
    return False, "Command failed"
```

### Dangerous Mode (dangerous_mode=True)
```python
# Skip existence checks - try anyway
# Files written with chmod 777
os.chmod(full_path, 0o777)

# Directories created with mode 777
os.makedirs(dirname, mode=0o777, exist_ok=True)

# No timeout - runs forever
subprocess.run(command, timeout=None)

# Ignore all exit codes
return True, output  # Always success
```

## Security Implications

⚠️ **This mode allows:**

1. **Unrestricted filesystem access**
   - Read/write/execute ANY file on the system
   - Modify system files (/etc/passwd, /etc/shadow, etc.)
   - Create world-writable files anywhere
   - Bypass user permissions

2. **Unrestricted command execution**
   - Run any shell command without restrictions
   - No timeout protection against infinite loops
   - Can execute: `rm -rf /`, `dd if=/dev/zero of=/dev/sda`, etc.
   - All commands succeed regardless of actual outcome

3. **Privilege escalation potential**
   - If running as root, full system compromise possible
   - Can modify systemd services, cron jobs, etc.
   - Can create SUID binaries
   - Can install backdoors

4. **No audit trail**
   - Failed operations reported as successes
   - No way to detect malicious activity
   - Exit codes ignored

## When To Use

✅ **Use Dangerous Mode:**
- In fully isolated Docker containers
- When you need unrestricted access
- Testing and development environments
- When you trust the code completely
- Automated builds in sandboxed CI/CD

❌ **NEVER Use Dangerous Mode:**
- On production systems
- With untrusted code
- When running as root on real systems
- On systems with important data
- In multi-user environments

## How To Disable

To run in safe mode, modify the code:

```python
# In manager.py
self.tool_executor = ToolExecutor(working_dir, dangerous_mode=False)

# In worker.py
self.tool_executor = ToolExecutor(working_dir, dangerous_mode=False)
```

Or add a CLI flag:

```bash
# Would need to implement this
python -m claude_wrapper --safe-mode "task"
```

## Technical Details

### Permission Changes

**Files created in dangerous mode:**
```bash
-rwxrwxrwx  1 user group  size  date  filename
```

**Directories created in dangerous mode:**
```bash
drwxrwxrwx  2 user group  4096  date  dirname
```

This means:
- Owner: read + write + execute
- Group: read + write + execute
- Others: read + write + execute

### Bash Execution

**Safe mode:**
```python
timeout = 120  # 2 minutes
if result.returncode != 0:
    return False, "Failed"
```

**Dangerous mode:**
```python
timeout = None  # Forever
return True, output  # Always success
```

### Path Resolution

**Safe mode:**
```python
# Could restrict to working directory
real_path = os.path.realpath(path)
if not real_path.startswith(working_dir):
    return False, "Path outside working directory"
```

**Dangerous mode:**
```python
# Allow any path
if os.path.isabs(path):
    return path  # No checks
```

## Example Scenarios

### Scenario 1: Write to System File

```python
# Dangerous mode (current default)
tool_executor.execute("Write", {
    "file_path": "/etc/cron.d/backdoor",
    "content": "* * * * * root /tmp/evil.sh"
})
# ✓ SUCCESS - Backdoor installed!
```

### Scenario 2: Long-Running Command

```python
# Dangerous mode (current default)
tool_executor.execute("Bash", {
    "command": "while true; do sleep 1; done"
})
# Runs forever, never times out
```

### Scenario 3: Destructive Command

```python
# Dangerous mode (current default)
tool_executor.execute("Bash", {
    "command": "rm -rf /important/data"
})
# Returns: True, ""
# Data is gone but reported as success
```

## Recommendations

1. **Add a --safe-mode CLI flag** to allow users to opt into safety
2. **Default to safe mode** and require explicit --dangerous flag
3. **Add logging** of all file operations and commands
4. **Implement command whitelist** for bash execution
5. **Add path restriction** to working directory tree
6. **Restore timeout enforcement** for commands
7. **Check exit codes** and report failures honestly

## Summary

The current implementation prioritizes **convenience over security**:

- ✅ No permission errors
- ✅ No timeout interruptions
- ✅ Full filesystem access
- ✅ All commands succeed

But at the cost of:

- ❌ No security boundaries
- ❌ No protection from errors
- ❌ No audit trail
- ❌ Potential system compromise

**Use with extreme caution!**
