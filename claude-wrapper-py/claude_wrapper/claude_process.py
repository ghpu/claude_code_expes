"""
ClaudeProcess - Manages a Claude CLI subprocess using pexpect
Handles terminal interaction with real Claude Code CLI process
"""

import pexpect
import time
import os
import re
from typing import Optional, Callable
from dataclasses import dataclass
from .terminal_ui import ui


# ANSI escape code regex for stripping terminal control sequences
ANSI_ESCAPE = re.compile(r'\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])')


def strip_ansi(text: str) -> str:
    """Remove ANSI escape sequences from text"""
    return ANSI_ESCAPE.sub('', text)


@dataclass
class ClaudeResponse:
    """Response from Claude CLI"""
    text: str
    is_complete: bool
    has_thinking: bool
    thinking_content: str = ""


class LogToMonitor:
    """Helper class to route pexpect output to monitor with intelligent parsing"""

    def __init__(self, monitor_app, role: str):
        self.monitor_app = monitor_app
        self.role = role
        self.buffer = ""
        self.last_line = ""

    def write(self, data: str):
        """Called by pexpect when it reads data"""
        if not data:
            return

        # Strip ANSI escape codes for clean display
        clean_data = strip_ansi(data)

        # Filter out common TUI noise patterns
        if self._is_tui_noise(clean_data):
            return

        # Buffer data
        self.buffer += clean_data

        # Process complete lines
        while '\n' in self.buffer:
            line, self.buffer = self.buffer.split('\n', 1)
            line = line.strip()

            # Skip empty lines and duplicates
            if not line or line == self.last_line:
                continue

            # Skip repetitive status updates
            if self._is_status_update(line):
                continue

            self.last_line = line

            # Send meaningful content to monitor
            if self.monitor_app:
                if self.role.lower() == 'manager':
                    self.monitor_app.add_manager_message(line)
                else:
                    self.monitor_app.add_worker_message(line)

        # Also show partial buffer content (current line being typed/displayed)
        # Update every 50 characters or so to show typing progress
        if self.buffer and len(self.buffer) % 50 == 0:
            if self.monitor_app:
                preview = self.buffer[-100:] if len(self.buffer) > 100 else self.buffer
                if self.role.lower() == 'manager':
                    self.monitor_app.add_manager_message(f"[Typing...] {preview}")
                else:
                    self.monitor_app.add_worker_message(f"[Typing...] {preview}")

    def _is_tui_noise(self, text: str) -> bool:
        """Check if text is TUI noise (progress bars, spinners, etc.)"""
        noise_patterns = [
            r'^\s*[\|\-\\/]+\s*$',  # Spinner characters
            r'^\s*\[=+>\s*\]\s*$',  # Progress bars
            r'^\s*\d+%\s*$',  # Percentage only
            r'^\s*[\.]{3,}\s*$',  # Ellipsis patterns
            r'^\s*$',  # Empty
        ]

        for pattern in noise_patterns:
            if re.match(pattern, text):
                return True

        return False

    def _is_status_update(self, line: str) -> bool:
        """Check if line is a repetitive status update"""
        # Skip lines that look like status indicators
        status_prefixes = [
            'Loading',
            'Initializing',
            'Processing',
            'Waiting',
            'Connecting',
        ]

        for prefix in status_prefixes:
            if line.startswith(prefix) and '...' in line:
                return True

        return False

    def flush(self):
        """Required for file-like interface"""
        # Flush remaining buffer
        if self.buffer.strip() and self.monitor_app:
            clean = self.buffer.strip()
            if clean and not self._is_tui_noise(clean):
                if self.role.lower() == 'manager':
                    self.monitor_app.add_manager_message(clean)
                else:
                    self.monitor_app.add_worker_message(clean)
        self.buffer = ""


class ClaudeProcess:
    """Manages a Claude Code CLI process with stdin/stdout/stderr handling"""

    def __init__(self, working_dir: str, role: str = "assistant", debug: bool = False, show_streaming: bool = True, monitor_app=None):
        """
        Initialize Claude process manager

        Args:
            working_dir: Working directory for the Claude process
            role: Role identifier (manager/worker) for logging
            debug: Enable debug output
            show_streaming: Show real-time streaming output
            monitor_app: Optional MonitorApp instance for TUI display
        """
        self.working_dir = working_dir
        self.role = role
        self.debug = debug
        self.show_streaming = show_streaming
        self.monitor_app = monitor_app
        self.child: Optional[pexpect.spawn] = None  # pexpect child process
        self.conversation_history: list = []
        self.is_running = False

    def start(self) -> None:
        """Start the Claude CLI process using pexpect"""
        if self.is_running:
            raise RuntimeError(f"[{self.role}] Process already running")

        claude_path = os.getenv('CLAUDE_PATH', '/opt/node22/bin/claude')

        # Check if Claude binary exists
        if not os.path.exists(claude_path):
            error_msg = f"Claude CLI not found at {claude_path}"
            if self.monitor_app:
                self.monitor_app.add_debug("CLAUDE_PROC", "error", error_msg)
            raise FileNotFoundError(error_msg)

        if not os.access(claude_path, os.X_OK):
            error_msg = f"Claude CLI at {claude_path} is not executable"
            if self.monitor_app:
                self.monitor_app.add_debug("CLAUDE_PROC", "error", error_msg)
            raise PermissionError(error_msg)

        if self.role.lower() == 'manager':
            ui.manager_log(f"Starting Claude CLI with pexpect at {claude_path}")
            ui.manager_log(f"Working directory: {self.working_dir}")
        else:
            ui.worker_log(f"Starting Claude CLI with pexpect at {claude_path}")
            ui.worker_log(f"Working directory: {self.working_dir}")

        # Prepare environment - pass through Claude Code authentication
        env = os.environ.copy()
        env['TERM'] = 'xterm-256color'  # Terminal type

        try:
            if self.monitor_app:
                self.monitor_app.add_debug("PEXPECT", "info", f"Spawning Claude CLI with pexpect...")
                self.monitor_app.add_debug("PEXPECT", "info", f"Working dir: {self.working_dir}")

            # Spawn Claude CLI with pexpect
            self.child = pexpect.spawn(
                claude_path,
                cwd=self.working_dir,
                env=env,
                timeout=120,
                encoding='utf-8',
                echo=True  # Allow echo - Claude CLI will echo typed input
            )

            # Enable logging if debug
            if self.debug or self.monitor_app:
                self.child.logfile_read = LogToMonitor(self.monitor_app, self.role)

            self.is_running = True

            if self.monitor_app:
                self.monitor_app.add_debug("PEXPECT", "success", f"Claude CLI spawned (PID: {self.child.pid})")

            # Wait for Claude CLI to be ready
            if self.monitor_app:
                self.monitor_app.add_debug("PEXPECT", "info", "Waiting for Claude CLI to initialize...")

            # Wait for Claude to show prompt or become idle
            # Look for common prompt patterns or wait for initialization to complete
            try:
                # Try to detect prompt patterns like "> ", "$ ", "? ", or just wait
                index = self.child.expect([
                    r'[>\$\?]\s*$',  # Common prompt patterns
                    pexpect.TIMEOUT
                ], timeout=10)

                if index == 0:
                    if self.monitor_app:
                        self.monitor_app.add_debug("PEXPECT", "success", f"Detected prompt: {self.child.after}")
                else:
                    # Timeout - Claude might be waiting silently
                    if self.monitor_app:
                        self.monitor_app.add_debug("PEXPECT", "info", "No prompt detected, assuming ready")

            except pexpect.TIMEOUT:
                if self.monitor_app:
                    self.monitor_app.add_debug("PEXPECT", "info", "Timeout waiting for prompt, assuming ready")

            if self.monitor_app:
                self.monitor_app.add_debug("PEXPECT", "success", "Claude CLI ready for input")

            if self.role.lower() == 'manager':
                ui.manager_log(f"Process started successfully (PID: {self.child.pid})", "success")
            else:
                ui.worker_log(f"Process started successfully (PID: {self.child.pid})", "success")

        except Exception as e:
            error_msg = f"Failed to start Claude process: {e}"
            if self.role.lower() == 'manager':
                ui.manager_log(error_msg, "error")
            else:
                ui.worker_log(error_msg, "error")
            if self.monitor_app:
                self.monitor_app.add_debug("PEXPECT", "error", str(e))
            raise RuntimeError(f"[{self.role}] {error_msg}")

    def send_prompt(self, prompt: str, timeout: float = 120) -> ClaudeResponse:
        """
        Send a prompt to Claude and wait for response using pexpect

        Args:
            prompt: The prompt to send
            timeout: Maximum time to wait for response

        Returns:
            ClaudeResponse object with the response text
        """
        if not self.is_running or not self.child:
            raise RuntimeError(f"[{self.role}] Process not running")

        if self.role.lower() == 'manager':
            ui.manager_log(f"Sending prompt ({len(prompt)} chars)")
        else:
            ui.worker_log(f"Sending prompt ({len(prompt)} chars)")

        # Log to debug only - Claude CLI will echo the prompt naturally
        if self.monitor_app:
            prompt_preview = prompt[:200] + "..." if len(prompt) > 200 else prompt
            self.monitor_app.add_debug("PEXPECT", "info", f"Sending prompt ({len(prompt)} chars): {prompt_preview}")

        try:
            # Display the prompt in conversation window as we send it
            # (Claude CLI might not echo, so we show what we're typing)
            if self.monitor_app:
                if self.role.lower() == 'manager':
                    self.monitor_app.add_manager_message(f"[User Input]\n{prompt}\n")
                else:
                    self.monitor_app.add_worker_message(f"[User Input]\n{prompt}\n")

            # Send prompt to Claude CLI character by character (like human typing)
            if self.monitor_app:
                self.monitor_app.add_debug("PEXPECT", "info", "Typing prompt character by character...")

            for i, char in enumerate(prompt):
                self.child.send(char)
                # Small delay to simulate human typing (prevents input buffer issues)
                time.sleep(0.01)

                # Show typing progress every 100 characters
                if self.monitor_app and (i + 1) % 100 == 0:
                    self.monitor_app.add_debug("PEXPECT", "debug", f"Typed {i + 1}/{len(prompt)} characters...")

            # Send Enter key to confirm/submit
            self.child.send('\r')  # Carriage return (Enter key)

            if self.monitor_app:
                self.monitor_app.add_debug("PEXPECT", "success", "Prompt typed and submitted with Enter key")
                self.monitor_app.add_debug("PEXPECT", "info", "Waiting for Claude CLI response...")

            # Wait for Claude to finish processing - just use timeout
            # Claude CLI will output continuously, so we collect for a reasonable time
            # then check if output has stopped (idle detection)
            time.sleep(2)  # Give Claude time to start responding

            if self.monitor_app:
                self.monitor_app.add_debug("PEXPECT", "info", "Starting to collect response output...")

            # Try to read all available output with a reasonable timeout
            # We'll keep reading until output stops for 2 seconds
            start_time = time.time()
            last_output_time = time.time()
            response_parts = []
            idle_timeout = 3.0  # Stop if no output for 3 seconds

            while (time.time() - start_time) < timeout:
                try:
                    # Try to read with very short timeout
                    self.child.expect([pexpect.TIMEOUT], timeout=0.5)

                    # Got some output
                    if self.child.before:
                        response_parts.append(self.child.before)
                        last_output_time = time.time()

                        if self.monitor_app:
                            self.monitor_app.add_debug("PEXPECT", "debug", f"Received data chunk: {len(self.child.before)} chars")

                except pexpect.TIMEOUT:
                    # Check if we've been idle too long
                    idle_time = time.time() - last_output_time

                    # Report idle status
                    if self.monitor_app and idle_time > 1.0:
                        self.monitor_app.add_debug("PEXPECT", "debug", f"Idle for {idle_time:.1f}s, response_parts={len(response_parts)}")

                    if idle_time > idle_timeout:
                        if response_parts:
                            if self.monitor_app:
                                self.monitor_app.add_debug("PEXPECT", "info", f"Idle for {idle_time:.1f}s, assuming response complete")
                            break
                        else:
                            # No output at all - keep waiting up to full timeout
                            if self.monitor_app and (time.time() - start_time) % 10 < 0.5:  # Log every 10s
                                elapsed = time.time() - start_time
                                self.monitor_app.add_debug("PEXPECT", "warning", f"No output after {elapsed:.0f}s - Claude CLI may not be responding")

            response_text = ''.join(response_parts)

            # Strip ANSI escape codes for clean response
            response_text = strip_ansi(response_text)

            if self.monitor_app:
                self.monitor_app.add_debug("PEXPECT", "success", f"Response collection complete: {len(response_text)} chars")
                if response_text:
                    preview = response_text[:200].replace('\n', '\\n')
                    self.monitor_app.add_debug("PEXPECT", "debug", f"Response preview: {preview}...")
                else:
                    self.monitor_app.add_debug("PEXPECT", "error", "Response is EMPTY - Claude CLI did not produce any output!")

        except pexpect.EOF:
            if self.monitor_app:
                self.monitor_app.add_debug("PEXPECT", "error", "Claude CLI process ended unexpectedly (EOF)")
            raise RuntimeError(f"[{self.role}] Claude CLI process ended")

        except Exception as e:
            if self.monitor_app:
                self.monitor_app.add_debug("PEXPECT", "error", f"Error: {e}")
            raise RuntimeError(f"[{self.role}] Failed to communicate with Claude: {e}")

        # Add to conversation history
        self.conversation_history.append({
            'role': 'user',
            'content': prompt
        })
        self.conversation_history.append({
            'role': 'assistant',
            'content': response_text
        })

        # Parse response
        return self._parse_response(response_text)

    def _parse_response(self, text: str) -> ClaudeResponse:
        """Parse Claude CLI output into structured response"""
        # Extract thinking if present
        thinking = ""
        has_thinking = False

        if "<thinking>" in text and "</thinking>" in text:
            start = text.find("<thinking>") + len("<thinking>")
            end = text.find("</thinking>")
            thinking = text[start:end].strip()
            has_thinking = True
            # Remove thinking from main text
            text = text[:text.find("<thinking>")] + text[text.find("</thinking>") + len("</thinking>"):]

        # Check if response seems complete
        completion_indicators = [
            "task complete",
            "implementation complete",
            "done",
            "finished",
            "ready for review",
            "tests passing",
        ]

        is_complete = any(indicator in text.lower() for indicator in completion_indicators)

        return ClaudeResponse(
            text=text.strip(),
            is_complete=is_complete,
            has_thinking=has_thinking,
            thinking_content=thinking
        )

    def stop(self) -> None:
        """Stop the Claude process"""
        if not self.is_running:
            return

        if self.debug:
            print(f"[{self.role}] Stopping process...")

        self.is_running = False

        try:
            if self.child and self.child.isalive():
                self.child.terminate(force=False)
                time.sleep(1)

                if self.child.isalive():
                    if self.debug:
                        print(f"[{self.role}] Force killing process")
                    self.child.terminate(force=True)

        except Exception as e:
            if self.debug:
                print(f"[{self.role}] Error stopping process: {e}")

        if self.debug:
            print(f"[{self.role}] Process stopped")

    def __enter__(self):
        """Context manager entry"""
        self.start()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit"""
        self.stop()

    def get_conversation_history(self) -> list:
        """Get the conversation history"""
        return self.conversation_history.copy()
