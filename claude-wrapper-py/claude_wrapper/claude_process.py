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


@dataclass
class ClaudeResponse:
    """Response from Claude CLI"""
    text: str
    is_complete: bool
    has_thinking: bool
    thinking_content: str = ""


class LogToMonitor:
    """Helper class to route pexpect output to monitor"""

    def __init__(self, monitor_app, role: str):
        self.monitor_app = monitor_app
        self.role = role

    def write(self, data: str):
        """Called by pexpect when it reads data"""
        if not data:
            return

        # Send to monitor
        if self.monitor_app:
            if self.role.lower() == 'manager':
                self.monitor_app.add_manager_message(data)
            else:
                self.monitor_app.add_worker_message(data)

    def flush(self):
        """Required for file-like interface"""
        pass


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
                echo=False  # Don't echo input back
            )

            # Enable logging if debug
            if self.debug or self.monitor_app:
                self.child.logfile_read = LogToMonitor(self.monitor_app, self.role)

            self.is_running = True

            if self.monitor_app:
                self.monitor_app.add_debug("PEXPECT", "success", f"Claude CLI spawned (PID: {self.child.pid})")

            # Wait for Claude CLI to be ready - look for common patterns
            if self.monitor_app:
                self.monitor_app.add_debug("PEXPECT", "info", "Waiting for Claude CLI to be ready...")

            # Try to detect if Claude is ready by waiting for initial output
            # Claude CLI might show welcome message, prompt, or just be silent
            time.sleep(2)

            if self.monitor_app:
                self.monitor_app.add_debug("PEXPECT", "success", "Claude CLI ready")

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

        # Show outgoing prompt in monitor
        if self.monitor_app:
            prompt_preview = prompt[:200] + "..." if len(prompt) > 200 else prompt
            if self.role.lower() == 'manager':
                self.monitor_app.add_manager_message(f">>> SENDING PROMPT: {prompt_preview}")
            else:
                self.monitor_app.add_worker_message(f">>> SENDING PROMPT: {prompt_preview}")
            self.monitor_app.add_debug("PEXPECT", "info", f"Sending prompt ({len(prompt)} chars)...")

        try:
            # Send prompt to Claude CLI
            self.child.sendline(prompt)

            if self.monitor_app:
                self.monitor_app.add_debug("PEXPECT", "success", "Prompt sent via pexpect")

            # Wait for response - expect any output or timeout
            # Claude may respond with various patterns, so we use a generous regex
            self.child.expect([pexpect.TIMEOUT, pexpect.EOF, '.+'], timeout=timeout)

            # Collect everything that was output
            response_text = self.child.before + self.child.after if self.child.after else self.child.before

            if not response_text:
                response_text = ""

            if self.monitor_app:
                self.monitor_app.add_debug("PEXPECT", "success", f"Response received ({len(response_text)} chars)")

        except pexpect.TIMEOUT:
            if self.monitor_app:
                self.monitor_app.add_debug("PEXPECT", "warning", f"Timeout after {timeout}s waiting for response")
            response_text = self.child.before if self.child.before else ""

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
