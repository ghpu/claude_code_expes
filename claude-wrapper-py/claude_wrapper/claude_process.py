"""
ClaudeProcess - Manages a Claude CLI subprocess
Handles stdin/stdout/stderr for real Claude Code CLI process
"""

import subprocess
import threading
import queue
import time
import os
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
        self.process: Optional[subprocess.Popen] = None
        self.stdout_queue: queue.Queue = queue.Queue()
        self.stderr_queue: queue.Queue = queue.Queue()
        self.stdout_thread: Optional[threading.Thread] = None
        self.stderr_thread: Optional[threading.Thread] = None
        self.conversation_history: list = []
        self.is_running = False

    def start(self) -> None:
        """Start the Claude CLI process"""
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
            ui.manager_log(f"Starting Claude CLI process at {claude_path}")
            ui.manager_log(f"Working directory: {self.working_dir}")
        else:
            ui.worker_log(f"Starting Claude CLI process at {claude_path}")
            ui.worker_log(f"Working directory: {self.working_dir}")

        # Prepare environment - pass through Claude Code authentication
        env = os.environ.copy()
        env['NO_COLOR'] = '1'  # Disable colors for easier parsing
        env['TERM'] = 'dumb'   # Disable interactive features

        try:
            if self.monitor_app:
                self.monitor_app.add_debug("CLAUDE_PROC", "info", f"Claude binary verified, creating subprocess...")
                self.monitor_app.add_debug("CLAUDE_PROC", "info", f"Working dir: {self.working_dir}")

            self.process = subprocess.Popen(
                [claude_path],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                cwd=self.working_dir,
                env=env,
                text=True,
                bufsize=1,  # Line buffered
            )

            if self.monitor_app:
                self.monitor_app.add_debug("CLAUDE_PROC", "success", f"Subprocess created (PID: {self.process.pid})")

            # Start output reading threads
            self.stdout_thread = threading.Thread(
                target=self._read_stream,
                args=(self.process.stdout, self.stdout_queue, 'stdout'),
                daemon=True
            )
            self.stderr_thread = threading.Thread(
                target=self._read_stream,
                args=(self.process.stderr, self.stderr_queue, 'stderr'),
                daemon=True
            )

            self.stdout_thread.start()
            self.stderr_thread.start()
            self.is_running = True

            if self.monitor_app:
                self.monitor_app.add_debug("CLAUDE_PROC", "success", "Output threads started")

            # Wait a moment for Claude to initialize
            if self.monitor_app:
                self.monitor_app.add_debug("CLAUDE_PROC", "info", "Sleeping 1s for initialization...")
            time.sleep(1)

            # Check for any stderr messages
            if self.monitor_app:
                stderr_lines = []
                try:
                    while not self.stderr_queue.empty():
                        stderr_lines.append(self.stderr_queue.get_nowait())
                except:
                    pass
                if stderr_lines:
                    for line in stderr_lines[:5]:  # Show first 5 stderr lines
                        self.monitor_app.add_debug("CLAUDE_STDERR", "warning", line.strip())
                else:
                    self.monitor_app.add_debug("CLAUDE_PROC", "info", "No stderr output")

            if self.monitor_app:
                self.monitor_app.add_debug("CLAUDE_PROC", "info", "Skipping initial output consumption (Claude CLI produces no output until prompted)")

            # NOTE: Claude CLI is an interactive REPL that doesn't output anything until
            # it receives input, so we skip the initial output consumption step

            if self.role.lower() == 'manager':
                ui.manager_log(f"Process started successfully (PID: {self.process.pid})", "success")
            else:
                ui.worker_log(f"Process started successfully (PID: {self.process.pid})", "success")

        except Exception as e:
            error_msg = f"Failed to start Claude process: {e}"
            if self.role.lower() == 'manager':
                ui.manager_log(error_msg, "error")
            else:
                ui.worker_log(error_msg, "error")
            raise RuntimeError(f"[{self.role}] {error_msg}")

    def _read_stream(self, stream, output_queue: queue.Queue, stream_name: str) -> None:
        """Read from stream and put into queue"""
        try:
            for line in stream:
                output_queue.put(line)

                # Show real-time streaming if enabled
                if self.show_streaming and stream_name == 'stdout':
                    ui.print_streaming_output(self.role.lower(), line)

                # Send to monitor if available
                if self.monitor_app and stream_name == 'stdout':
                    if self.role.lower() == 'manager':
                        self.monitor_app.add_manager_message(line.rstrip())
                    else:
                        self.monitor_app.add_worker_message(line.rstrip())

                if self.debug and stream_name == 'stderr':
                    if self.role.lower() == 'manager':
                        ui.manager_log(f"stderr: {line.rstrip()}", "warning")
                    else:
                        ui.worker_log(f"stderr: {line.rstrip()}", "warning")
        except Exception as e:
            if self.debug:
                if self.role.lower() == 'manager':
                    ui.manager_log(f"Stream {stream_name} error: {e}", "error")
                else:
                    ui.worker_log(f"Stream {stream_name} error: {e}", "error")

    def _consume_output(self, timeout: float = 30) -> str:
        """Consume output from queue until timeout"""
        output_lines = []
        start_time = time.time()
        last_output_time = start_time
        idle_threshold = 2.0  # Stop if no output for 2 seconds
        last_status_time = start_time

        if self.monitor_app:
            self.monitor_app.add_debug("CONSUME", "info", f"Starting output consumption (timeout={timeout}s)")
            # Check if process is alive
            if self.process:
                poll_result = self.process.poll()
                if poll_result is not None:
                    self.monitor_app.add_debug("CONSUME", "error", f"Process already exited with code {poll_result}!")
                else:
                    self.monitor_app.add_debug("CONSUME", "info", f"Process is alive (PID: {self.process.pid})")

        while True:
            try:
                # Non-blocking get with small timeout
                line = self.stdout_queue.get(timeout=0.1)
                output_lines.append(line)
                last_output_time = time.time()

                if self.monitor_app:
                    self.monitor_app.add_debug("CONSUME", "debug", f"Got line: {line[:50]}...")

                # Already shown via streaming in _read_stream
                pass

            except queue.Empty:
                # Check if we should stop
                elapsed = time.time() - start_time
                idle_time = time.time() - last_output_time

                # Periodic status update every 1 second
                if self.monitor_app and (time.time() - last_status_time) > 1.0:
                    self.monitor_app.add_debug("CONSUME", "debug", f"Still waiting... elapsed={elapsed:.1f}s, lines={len(output_lines)}, idle={idle_time:.1f}s")
                    last_status_time = time.time()

                    # Check if process died
                    if self.process:
                        poll_result = self.process.poll()
                        if poll_result is not None:
                            self.monitor_app.add_debug("CONSUME", "error", f"Process died with exit code {poll_result}!")

                if elapsed > timeout:
                    if self.monitor_app:
                        self.monitor_app.add_debug("CONSUME", "warning", f"Output timeout reached ({timeout}s), {len(output_lines)} lines received")
                    if self.debug:
                        print(f"[{self.role}] Output timeout ({timeout}s)")
                    break

                if idle_time > idle_threshold and len(output_lines) > 0:
                    if self.monitor_app:
                        self.monitor_app.add_debug("CONSUME", "info", f"Idle threshold reached ({idle_threshold}s), {len(output_lines)} lines received")
                    if self.debug:
                        print(f"[{self.role}] Idle threshold reached ({idle_threshold}s)")
                    break

        if self.monitor_app:
            self.monitor_app.add_debug("CONSUME", "success", f"Output consumption complete: {len(output_lines)} lines")

        return ''.join(output_lines)

    def send_prompt(self, prompt: str, timeout: float = 120) -> ClaudeResponse:
        """
        Send a prompt to Claude and wait for response

        Args:
            prompt: The prompt to send
            timeout: Maximum time to wait for response

        Returns:
            ClaudeResponse object with the response text
        """
        if not self.is_running:
            raise RuntimeError(f"[{self.role}] Process not running")

        if self.role.lower() == 'manager':
            ui.manager_log(f"Sending prompt ({len(prompt)} chars)")
        else:
            ui.worker_log(f"Sending prompt ({len(prompt)} chars)")

        # Send prompt via stdin
        try:
            if self.monitor_app:
                self.monitor_app.add_debug("CLAUDE_PROC", "info", f"Writing prompt to stdin ({len(prompt)} chars)...")

            self.process.stdin.write(prompt + '\n\n')
            self.process.stdin.flush()

            if self.monitor_app:
                self.monitor_app.add_debug("CLAUDE_PROC", "success", "Prompt written and flushed")

        except Exception as e:
            if self.monitor_app:
                self.monitor_app.add_debug("CLAUDE_PROC", "error", f"Failed to write prompt: {e}")
            raise RuntimeError(f"[{self.role}] Failed to send prompt: {e}")

        # Wait for and collect response
        if self.monitor_app:
            self.monitor_app.add_debug("CLAUDE_PROC", "info", f"Waiting for response (timeout={timeout}s)...")

        response_text = self._consume_output(timeout=timeout)

        if self.monitor_app:
            self.monitor_app.add_debug("CLAUDE_PROC", "success", f"Response received ({len(response_text)} chars)")

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

        try:
            if self.process:
                self.process.terminate()
                self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            if self.debug:
                print(f"[{self.role}] Force killing process")
            self.process.kill()
        except Exception as e:
            if self.debug:
                print(f"[{self.role}] Error stopping process: {e}")

        self.is_running = False

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
