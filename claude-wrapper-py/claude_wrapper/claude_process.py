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


@dataclass
class ClaudeResponse:
    """Response from Claude CLI"""
    text: str
    is_complete: bool
    has_thinking: bool
    thinking_content: str = ""


class ClaudeProcess:
    """Manages a Claude Code CLI process with stdin/stdout/stderr handling"""

    def __init__(self, working_dir: str, role: str = "assistant", debug: bool = False):
        """
        Initialize Claude process manager

        Args:
            working_dir: Working directory for the Claude process
            role: Role identifier (manager/worker) for logging
            debug: Enable debug output
        """
        self.working_dir = working_dir
        self.role = role
        self.debug = debug
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

        if self.debug:
            print(f"[{self.role}] Starting Claude process at {claude_path}")
            print(f"[{self.role}] Working directory: {self.working_dir}")

        # Prepare environment - pass through Claude Code authentication
        env = os.environ.copy()
        env['NO_COLOR'] = '1'  # Disable colors for easier parsing
        env['TERM'] = 'dumb'   # Disable interactive features

        try:
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

            # Wait a moment for Claude to initialize
            time.sleep(2)

            # Consume initial output
            self._consume_output(timeout=3)

            if self.debug:
                print(f"[{self.role}] Process started successfully (PID: {self.process.pid})")

        except Exception as e:
            raise RuntimeError(f"[{self.role}] Failed to start Claude process: {e}")

    def _read_stream(self, stream, output_queue: queue.Queue, stream_name: str) -> None:
        """Read from stream and put into queue"""
        try:
            for line in stream:
                output_queue.put(line)
                if self.debug and stream_name == 'stderr':
                    print(f"[{self.role}] stderr: {line.rstrip()}")
        except Exception as e:
            if self.debug:
                print(f"[{self.role}] Stream {stream_name} error: {e}")

    def _consume_output(self, timeout: float = 30) -> str:
        """Consume output from queue until timeout"""
        output_lines = []
        start_time = time.time()
        last_output_time = start_time
        idle_threshold = 2.0  # Stop if no output for 2 seconds

        while True:
            try:
                # Non-blocking get with small timeout
                line = self.stdout_queue.get(timeout=0.1)
                output_lines.append(line)
                last_output_time = time.time()

                if self.debug:
                    print(f"[{self.role}] > {line.rstrip()}")

            except queue.Empty:
                # Check if we should stop
                elapsed = time.time() - start_time
                idle_time = time.time() - last_output_time

                if elapsed > timeout:
                    if self.debug:
                        print(f"[{self.role}] Output timeout ({timeout}s)")
                    break

                if idle_time > idle_threshold and len(output_lines) > 0:
                    if self.debug:
                        print(f"[{self.role}] Idle threshold reached ({idle_threshold}s)")
                    break

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

        if self.debug:
            print(f"[{self.role}] Sending prompt ({len(prompt)} chars)")
            print(f"[{self.role}] Prompt preview: {prompt[:200]}...")

        # Send prompt via stdin
        try:
            self.process.stdin.write(prompt + '\n\n')
            self.process.stdin.flush()
        except Exception as e:
            raise RuntimeError(f"[{self.role}] Failed to send prompt: {e}")

        # Wait for and collect response
        response_text = self._consume_output(timeout=timeout)

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
