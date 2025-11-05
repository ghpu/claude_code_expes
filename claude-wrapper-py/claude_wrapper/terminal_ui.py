"""
Terminal UI - Beautiful terminal interface with colors and real-time updates
"""

import sys
import threading
from datetime import datetime
from typing import Optional


class Colors:
    """ANSI color codes"""
    RESET = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'

    # Foreground colors
    BLACK = '\033[30m'
    RED = '\033[31m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    BLUE = '\033[34m'
    MAGENTA = '\033[35m'
    CYAN = '\033[36m'
    WHITE = '\033[37m'

    # Bright colors
    BRIGHT_RED = '\033[91m'
    BRIGHT_GREEN = '\033[92m'
    BRIGHT_YELLOW = '\033[93m'
    BRIGHT_BLUE = '\033[94m'
    BRIGHT_MAGENTA = '\033[95m'
    BRIGHT_CYAN = '\033[96m'

    # Background colors
    BG_BLACK = '\033[40m'
    BG_RED = '\033[41m'
    BG_GREEN = '\033[42m'
    BG_YELLOW = '\033[43m'
    BG_BLUE = '\033[44m'
    BG_MAGENTA = '\033[45m'
    BG_CYAN = '\033[46m'
    BG_WHITE = '\033[47m'


class TerminalUI:
    """Terminal UI for monitoring dual-instance execution"""

    def __init__(self, enable_colors: bool = True):
        self.enable_colors = enable_colors
        self.lock = threading.Lock()

    def _colorize(self, text: str, color: str) -> str:
        """Apply color to text if colors enabled"""
        if not self.enable_colors:
            return text
        return f"{color}{text}{Colors.RESET}"

    def _timestamp(self) -> str:
        """Get formatted timestamp"""
        return datetime.now().strftime("%H:%M:%S")

    def print_banner(self, title: str):
        """Print a banner with title"""
        width = 80
        print("\n" + "=" * width)
        padding = (width - len(title) - 2) // 2
        print(" " * padding + self._colorize(title, Colors.BOLD + Colors.BRIGHT_CYAN))
        print("=" * width + "\n")

    def print_section(self, title: str):
        """Print a section header"""
        print("\n" + self._colorize("─" * 80, Colors.DIM))
        print(self._colorize(f"  {title}", Colors.BOLD + Colors.BRIGHT_YELLOW))
        print(self._colorize("─" * 80, Colors.DIM))

    def print_config(self, config: dict):
        """Print configuration"""
        print(self._colorize("\n⚙️  Configuration:", Colors.BOLD))
        for key, value in config.items():
            key_colored = self._colorize(f"  {key}:", Colors.CYAN)
            value_colored = self._colorize(str(value), Colors.WHITE)
            print(f"{key_colored} {value_colored}")
        print()

    def manager_log(self, message: str, level: str = "info"):
        """Log message from Manager"""
        with self.lock:
            timestamp = self._colorize(f"[{self._timestamp()}]", Colors.DIM)

            if level == "info":
                prefix = self._colorize("[MANAGER]", Colors.BOLD + Colors.BLUE)
            elif level == "success":
                prefix = self._colorize("[MANAGER] ✓", Colors.BOLD + Colors.GREEN)
            elif level == "error":
                prefix = self._colorize("[MANAGER] ✗", Colors.BOLD + Colors.RED)
            elif level == "warning":
                prefix = self._colorize("[MANAGER] ⚠", Colors.BOLD + Colors.YELLOW)
            else:
                prefix = self._colorize("[MANAGER]", Colors.BLUE)

            print(f"{timestamp} {prefix} {message}")
            sys.stdout.flush()

    def worker_log(self, message: str, level: str = "info"):
        """Log message from Worker"""
        with self.lock:
            timestamp = self._colorize(f"[{self._timestamp()}]", Colors.DIM)

            if level == "info":
                prefix = self._colorize("[WORKER]", Colors.BOLD + Colors.MAGENTA)
            elif level == "success":
                prefix = self._colorize("[WORKER] ✓", Colors.BOLD + Colors.GREEN)
            elif level == "error":
                prefix = self._colorize("[WORKER] ✗", Colors.BOLD + Colors.RED)
            elif level == "warning":
                prefix = self._colorize("[WORKER] ⚠", Colors.BOLD + Colors.YELLOW)
            else:
                prefix = self._colorize("[WORKER]", Colors.MAGENTA)

            print(f"{timestamp} {prefix} {message}")
            sys.stdout.flush()

    def orchestrator_log(self, message: str, level: str = "info"):
        """Log message from Orchestrator"""
        with self.lock:
            timestamp = self._colorize(f"[{self._timestamp()}]", Colors.DIM)

            if level == "info":
                prefix = self._colorize("[ORCHESTRATOR]", Colors.BOLD + Colors.CYAN)
            elif level == "success":
                prefix = self._colorize("[ORCHESTRATOR] ✓", Colors.BOLD + Colors.GREEN)
            elif level == "error":
                prefix = self._colorize("[ORCHESTRATOR] ✗", Colors.BOLD + Colors.RED)
            else:
                prefix = self._colorize("[ORCHESTRATOR]", Colors.CYAN)

            print(f"{timestamp} {prefix} {message}")
            sys.stdout.flush()

    def print_manager_output(self, text: str, is_thinking: bool = False):
        """Print Manager's Claude output with formatting"""
        with self.lock:
            if is_thinking:
                print(self._colorize("  💭 Manager thinking:", Colors.DIM + Colors.BLUE))
                for line in text.split('\n'):
                    if line.strip():
                        print(self._colorize(f"     {line}", Colors.DIM))
            else:
                print(self._colorize("  📝 Manager response:", Colors.BLUE))
                # Show first 500 chars
                preview = text[:500] + ("..." if len(text) > 500 else "")
                for line in preview.split('\n'):
                    if line.strip():
                        print(f"     {line}")
            sys.stdout.flush()

    def print_worker_output(self, text: str, is_thinking: bool = False):
        """Print Worker's Claude output with formatting"""
        with self.lock:
            if is_thinking:
                print(self._colorize("  💭 Worker thinking:", Colors.DIM + Colors.MAGENTA))
                for line in text.split('\n'):
                    if line.strip():
                        print(self._colorize(f"     {line}", Colors.DIM))
            else:
                print(self._colorize("  📝 Worker response:", Colors.MAGENTA))
                # Show first 500 chars
                preview = text[:500] + ("..." if len(text) > 500 else "")
                for line in preview.split('\n'):
                    if line.strip():
                        print(f"     {line}")
            sys.stdout.flush()

    def print_streaming_output(self, role: str, line: str):
        """Print streaming output line by line"""
        with self.lock:
            if role == "manager":
                color = Colors.BLUE
                prefix = "M│"
            else:  # worker
                color = Colors.MAGENTA
                prefix = "W│"

            colored_prefix = self._colorize(prefix, Colors.BOLD + color)
            print(f"{colored_prefix} {line.rstrip()}")
            sys.stdout.flush()

    def print_review_result(self, approved: bool, score: int, issues: int):
        """Print review result with formatting"""
        with self.lock:
            if approved:
                status = self._colorize("✓ APPROVED", Colors.BOLD + Colors.BRIGHT_GREEN)
            else:
                status = self._colorize("✗ REJECTED", Colors.BOLD + Colors.BRIGHT_RED)

            score_color = Colors.BRIGHT_GREEN if score >= 80 else Colors.BRIGHT_YELLOW if score >= 60 else Colors.BRIGHT_RED
            score_text = self._colorize(f"{score}/100", Colors.BOLD + score_color)

            print(f"\n  {status}")
            print(f"  Score: {score_text}")
            print(f"  Issues found: {self._colorize(str(issues), Colors.YELLOW)}")
            sys.stdout.flush()

    def print_iteration_header(self, iteration: int, max_iterations: int):
        """Print iteration header"""
        with self.lock:
            bar_filled = "█" * iteration
            bar_empty = "░" * (max_iterations - iteration)
            bar = self._colorize(bar_filled, Colors.GREEN) + self._colorize(bar_empty, Colors.DIM)

            print(f"\n  {self._colorize(f'Iteration {iteration}/{max_iterations}', Colors.BOLD + Colors.BRIGHT_CYAN)} {bar}")
            sys.stdout.flush()

    def print_subtask_header(self, index: int, total: int, description: str):
        """Print subtask header"""
        with self.lock:
            print("\n" + "═" * 80)
            header = self._colorize(f"Subtask {index}/{total}", Colors.BOLD + Colors.BRIGHT_YELLOW)
            print(f"  {header}: {description}")
            print("═" * 80 + "\n")
            sys.stdout.flush()

    def print_progress(self, message: str):
        """Print progress message"""
        with self.lock:
            print(f"  {self._colorize('⋯', Colors.CYAN)} {message}")
            sys.stdout.flush()

    def print_success(self, message: str):
        """Print success message"""
        with self.lock:
            print(f"  {self._colorize('✓', Colors.BRIGHT_GREEN)} {message}")
            sys.stdout.flush()

    def print_error(self, message: str):
        """Print error message"""
        with self.lock:
            print(f"  {self._colorize('✗', Colors.BRIGHT_RED)} {message}")
            sys.stdout.flush()

    def print_warning(self, message: str):
        """Print warning message"""
        with self.lock:
            print(f"  {self._colorize('⚠', Colors.BRIGHT_YELLOW)} {message}")
            sys.stdout.flush()

    def print_summary(self, total: int, approved: int, failed: int):
        """Print final summary"""
        print("\n" + "═" * 80)
        print(self._colorize("  SUMMARY", Colors.BOLD + Colors.BRIGHT_CYAN))
        print("═" * 80)

        print(f"\n  Total subtasks: {self._colorize(str(total), Colors.BOLD)}")
        print(f"  {self._colorize('✓', Colors.GREEN)} Approved: {self._colorize(str(approved), Colors.BOLD + Colors.GREEN)}")

        if failed > 0:
            print(f"  {self._colorize('✗', Colors.RED)} Failed: {self._colorize(str(failed), Colors.BOLD + Colors.RED)}")

        print()

        if failed == 0:
            print(self._colorize("  🎉 All subtasks completed successfully!", Colors.BOLD + Colors.BRIGHT_GREEN))
        else:
            print(self._colorize(f"  ⚠️  {failed} subtask(s) did not meet quality standards", Colors.BOLD + Colors.YELLOW))

        print()
        sys.stdout.flush()

    def print_box(self, title: str, content: list, color: str = Colors.WHITE):
        """Print a box with title and content"""
        with self.lock:
            width = 76
            print("\n  ┌" + "─" * width + "┐")
            print(f"  │ {self._colorize(title, Colors.BOLD + color):<{width-2}} │")
            print("  ├" + "─" * width + "┤")

            for line in content:
                # Wrap long lines
                if len(line) > width - 4:
                    words = line.split()
                    current_line = ""
                    for word in words:
                        if len(current_line) + len(word) + 1 <= width - 4:
                            current_line += (word + " ")
                        else:
                            print(f"  │ {current_line:<{width-2}} │")
                            current_line = word + " "
                    if current_line:
                        print(f"  │ {current_line:<{width-2}} │")
                else:
                    print(f"  │ {line:<{width-2}} │")

            print("  └" + "─" * width + "┘\n")
            sys.stdout.flush()

    def ask_user(self, prompt: str) -> str:
        """Ask user for input"""
        with self.lock:
            colored_prompt = self._colorize(f"\n  {prompt} ", Colors.BOLD + Colors.CYAN)
            return input(colored_prompt)

    def clear_line(self):
        """Clear current line"""
        print('\r\033[K', end='')
        sys.stdout.flush()


# Global UI instance
ui = TerminalUI()
