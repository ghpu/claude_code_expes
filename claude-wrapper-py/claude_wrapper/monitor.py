"""
Advanced TUI Monitor - Live conversation view with interactive controls
"""

from textual.app import App, ComposeResult
from textual.containers import Container, Horizontal, Vertical, ScrollableContainer
from textual.widgets import Header, Footer, Static, Input, Button, Label, RichLog
from textual.binding import Binding
from textual.reactive import reactive
from rich.text import Text
from rich.panel import Panel
from rich.syntax import Syntax
from datetime import datetime
import threading
import queue
from typing import Dict, Any, Optional


class ConversationPanel(ScrollableContainer):
    """Panel showing conversation messages for a Claude instance"""

    def __init__(self, title: str, role: str, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.title = title
        self.role = role  # "manager" or "worker"
        self.messages = []
        self.border_title = title

    def add_message(self, content: str, message_type: str = "text"):
        """Add a message to the conversation"""
        timestamp = datetime.now().strftime("%H:%M:%S")

        # Create styled text based on role and message type
        if self.role == "manager":
            color = "bright_blue"
            prefix = "M"
        else:
            color = "bright_magenta"
            prefix = "W"

        if message_type == "thinking":
            style = f"dim {color}"
            icon = "💭"
        elif message_type == "tool":
            style = f"italic {color}"
            icon = "🔧"
        elif message_type == "error":
            style = "bright_red bold"
            icon = "✗"
        elif message_type == "success":
            style = "bright_green bold"
            icon = "✓"
        else:
            style = color
            icon = "●"

        # Create the message text
        msg_text = Text()
        msg_text.append(f"[{timestamp}] ", style="dim")
        msg_text.append(f"{icon} ", style=style)
        msg_text.append(f"{prefix} ", style=f"bold {color}")
        msg_text.append(content, style=style if message_type != "text" else "")

        self.messages.append(msg_text)

        # Add to display
        label = Label(msg_text)
        self.mount(label)

        # Auto-scroll to bottom
        self.scroll_end(animate=False)

    def clear_messages(self):
        """Clear all messages"""
        self.messages = []
        self.remove_children()


class ReviewPanel(ScrollableContainer):
    """Panel showing review results and feedback"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.border_title = "Review & Feedback"

    def show_review(self, review: Dict[str, Any]):
        """Display review results"""
        self.remove_children()

        # Create review display
        approved = review.get('approved', False)
        score = review.get('score', 0)
        issues = review.get('issues', [])
        changes = review.get('required_changes', [])

        # Status line
        if approved:
            status = Text("✓ APPROVED", style="bold bright_green")
        else:
            status = Text("✗ REJECTED", style="bold bright_red")

        score_color = "bright_green" if score >= 80 else "bright_yellow" if score >= 60 else "bright_red"
        score_text = Text(f"Score: {score}/100", style=f"bold {score_color}")

        header = Text()
        header.append_text(status)
        header.append("  │  ")
        header.append_text(score_text)
        header.append(f"  │  Issues: {len(issues)}", style="yellow" if len(issues) > 0 else "green")

        self.mount(Label(header))
        self.mount(Label(Text(" ", style="dim")))

        # Show issues
        if issues:
            self.mount(Label(Text("Issues Found:", style="bold bright_yellow")))
            for i, issue in enumerate(issues[:10], 1):
                issue_text = Text(f"  {i}. {issue}", style="yellow")
                self.mount(Label(issue_text))

        # Show required changes
        if changes:
            self.mount(Label(Text(" ", style="dim")))
            self.mount(Label(Text("Required Changes:", style="bold bright_cyan")))
            for i, change in enumerate(changes[:10], 1):
                change_text = Text(f"  {i}. {change}", style="cyan")
                self.mount(Label(change_text))

        # Auto-scroll to top
        self.scroll_home(animate=False)

    def show_feedback(self, feedback: str):
        """Display feedback being sent to Worker"""
        self.remove_children()

        title = Text("Feedback to Worker:", style="bold bright_magenta")
        self.mount(Label(title))
        self.mount(Label(Text(" ", style="dim")))

        # Split feedback into lines
        for line in feedback.split('\n')[:50]:  # Limit to 50 lines
            if line.strip():
                self.mount(Label(Text(line, style="white")))

        self.scroll_home(animate=False)


class DebugPanel(ScrollableContainer):
    """Panel showing debug and diagnostic messages"""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.border_title = "Debug Log (F5)"
        self.messages = []

    def add_debug_message(self, source: str, level: str, message: str):
        """Add a debug message to the panel"""
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]  # Include milliseconds

        # Color based on level
        if level == "error":
            level_color = "bright_red"
            icon = "✗"
        elif level == "warning":
            level_color = "bright_yellow"
            icon = "⚠"
        elif level == "success":
            level_color = "bright_green"
            icon = "✓"
        elif level == "info":
            level_color = "bright_cyan"
            icon = "ℹ"
        else:
            level_color = "white"
            icon = "●"

        # Create styled message
        msg_text = Text()
        msg_text.append(f"[{timestamp}] ", style="dim")
        msg_text.append(f"{icon} ", style=level_color)
        msg_text.append(f"[{source:12}] ", style="bold bright_white")
        msg_text.append(f"{message}", style=level_color if level != "debug" else "dim")

        self.messages.append(msg_text)

        # Add to display
        label = Label(msg_text)
        self.mount(label)

        # Auto-scroll to bottom
        self.scroll_end(animate=False)

    def clear_messages(self):
        """Clear all debug messages"""
        self.messages = []
        self.remove_children()


class StatusBar(Static):
    """Status bar showing current workflow status"""

    status_text = reactive("")

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

    def render(self) -> Text:
        text = Text()
        text.append("Status: ", style="bold")
        text.append(self.status_text, style="bright_cyan")
        return text

    def update_status(self, status: str):
        """Update the status text"""
        self.status_text = status


class MonitorApp(App):
    """Advanced TUI Monitor for Claude Dual-Instance Workflow"""

    CSS = """
    Screen {
        background: $surface;
    }

    #main-container {
        height: 100%;
    }

    #conversations {
        height: 50%;
        border: solid $primary;
    }

    #manager-panel {
        width: 1fr;
        border: solid blue;
        background: $surface-darken-1;
    }

    #worker-panel {
        width: 1fr;
        border: solid magenta;
        background: $surface-darken-1;
    }

    #review-panel {
        height: 20%;
        border: solid cyan;
        background: $surface-darken-1;
    }

    #debug-panel {
        height: 20%;
        border: solid yellow;
        background: $surface-darken-1;
    }

    #input-area {
        height: 10%;
        border: solid green;
        background: $surface-darken-1;
    }

    Input {
        border: solid $accent;
    }

    #status-bar {
        background: $primary-darken-2;
        color: $text;
        height: 1;
        padding: 0 1;
    }
    """

    BINDINGS = [
        Binding("f1", "toggle_manager", "Toggle Manager", show=True),
        Binding("f2", "toggle_worker", "Toggle Worker", show=True),
        Binding("f3", "toggle_review", "Toggle Review", show=True),
        Binding("f4", "clear_all", "Clear All", show=True),
        Binding("f5", "toggle_debug", "Toggle Debug", show=True),
        Binding("ctrl+c", "quit", "Quit", show=True),
    ]

    def __init__(self):
        super().__init__()
        self.manager_panel: Optional[ConversationPanel] = None
        self.worker_panel: Optional[ConversationPanel] = None
        self.review_panel: Optional[ReviewPanel] = None
        self.debug_panel: Optional[DebugPanel] = None
        self.status_bar: Optional[StatusBar] = None
        self.input_widget: Optional[Input] = None

        # Message queues for thread-safe updates
        self.manager_queue = queue.Queue()
        self.worker_queue = queue.Queue()
        self.review_queue = queue.Queue()
        self.status_queue = queue.Queue()
        self.debug_queue = queue.Queue()

        # Visibility flags
        self.show_manager = True
        self.show_worker = True
        self.show_review = True
        self.show_debug = True

        # Interaction callback
        self.interaction_callback = None

    def compose(self) -> ComposeResult:
        """Create the UI layout"""
        yield Header(show_clock=True)

        with Vertical(id="main-container"):
            # Status bar
            yield StatusBar(id="status-bar")

            # Conversations area
            with Horizontal(id="conversations"):
                yield ConversationPanel("Manager (F1)", "manager", id="manager-panel")
                yield ConversationPanel("Worker (F2)", "worker", id="worker-panel")

            # Review panel
            yield ReviewPanel(id="review-panel")

            # Debug panel
            yield DebugPanel(id="debug-panel")

            # Input area
            with Horizontal(id="input-area"):
                yield Label("Ask Manager: ", markup=False)
                yield Input(placeholder="Type message for Manager and press Enter...", id="manager-input")

        yield Footer()

    def on_mount(self) -> None:
        """Called when app is mounted"""
        self.manager_panel = self.query_one("#manager-panel", ConversationPanel)
        self.worker_panel = self.query_one("#worker-panel", ConversationPanel)
        self.review_panel = self.query_one("#review-panel", ReviewPanel)
        self.debug_panel = self.query_one("#debug-panel", DebugPanel)
        self.status_bar = self.query_one("#status-bar", StatusBar)
        self.input_widget = self.query_one("#manager-input", Input)

        # Set initial status
        self.status_bar.update_status("Initializing...")
        self.add_debug("MONITOR", "info", "TUI Monitor initialized")

        # Start update timer
        self.set_interval(0.1, self.process_queues)

    def process_queues(self):
        """Process message queues and update UI"""
        # Process manager messages
        while not self.manager_queue.empty():
            try:
                msg = self.manager_queue.get_nowait()
                if self.manager_panel:
                    self.manager_panel.add_message(msg['content'], msg.get('type', 'text'))
            except queue.Empty:
                break

        # Process worker messages
        while not self.worker_queue.empty():
            try:
                msg = self.worker_queue.get_nowait()
                if self.worker_panel:
                    self.worker_panel.add_message(msg['content'], msg.get('type', 'text'))
            except queue.Empty:
                break

        # Process review updates
        while not self.review_queue.empty():
            try:
                data = self.review_queue.get_nowait()
                if self.review_panel:
                    if 'review' in data:
                        self.review_panel.show_review(data['review'])
                    elif 'feedback' in data:
                        self.review_panel.show_feedback(data['feedback'])
            except queue.Empty:
                break

        # Process status updates
        while not self.status_queue.empty():
            try:
                status = self.status_queue.get_nowait()
                if self.status_bar:
                    self.status_bar.update_status(status)
            except queue.Empty:
                break

        # Process debug messages
        while not self.debug_queue.empty():
            try:
                debug_msg = self.debug_queue.get_nowait()
                if self.debug_panel:
                    self.debug_panel.add_debug_message(
                        debug_msg['source'],
                        debug_msg['level'],
                        debug_msg['message']
                    )
            except queue.Empty:
                break

    def on_input_submitted(self, event: Input.Submitted) -> None:
        """Handle input submission"""
        if event.input.id == "manager-input":
            message = event.value.strip()
            if message:
                # Add to manager panel as user message
                self.add_manager_message(f"[USER] {message}", "text")

                # Clear input
                event.input.value = ""

                # Call interaction callback if set
                if self.interaction_callback:
                    threading.Thread(
                        target=self.interaction_callback,
                        args=(message,),
                        daemon=True
                    ).start()

    def action_toggle_manager(self) -> None:
        """Toggle Manager panel visibility"""
        self.show_manager = not self.show_manager
        if self.manager_panel:
            self.manager_panel.display = self.show_manager

    def action_toggle_worker(self) -> None:
        """Toggle Worker panel visibility"""
        self.show_worker = not self.show_worker
        if self.worker_panel:
            self.worker_panel.display = self.show_worker

    def action_toggle_review(self) -> None:
        """Toggle Review panel visibility"""
        self.show_review = not self.show_review
        if self.review_panel:
            self.review_panel.display = self.show_review

    def action_toggle_debug(self) -> None:
        """Toggle Debug panel visibility"""
        self.show_debug = not self.show_debug
        if self.debug_panel:
            self.debug_panel.display = self.show_debug
        self.add_debug("MONITOR", "info", f"Debug panel {'shown' if self.show_debug else 'hidden'}")

    def action_clear_all(self) -> None:
        """Clear all panels"""
        if self.manager_panel:
            self.manager_panel.clear_messages()
        if self.worker_panel:
            self.worker_panel.clear_messages()
        if self.debug_panel:
            self.debug_panel.clear_messages()
        self.add_debug("MONITOR", "info", "All panels cleared")

    # Public API for adding messages

    def add_manager_message(self, content: str, msg_type: str = "text"):
        """Add message to Manager panel (thread-safe)"""
        self.manager_queue.put({'content': content, 'type': msg_type})

    def add_worker_message(self, content: str, msg_type: str = "text"):
        """Add message to Worker panel (thread-safe)"""
        self.worker_queue.put({'content': content, 'type': msg_type})

    def show_review_result(self, review: Dict[str, Any]):
        """Show review results (thread-safe)"""
        self.review_queue.put({'review': review})

    def show_feedback_text(self, feedback: str):
        """Show feedback text (thread-safe)"""
        self.review_queue.put({'feedback': feedback})

    def update_status(self, status: str):
        """Update status bar (thread-safe)"""
        self.status_queue.put(status)
        self.add_debug("STATUS", "info", f"Status: {status}")

    def add_debug(self, source: str, level: str, message: str):
        """Add debug message (thread-safe)"""
        self.debug_queue.put({'source': source, 'level': level, 'message': message})

    def set_interaction_callback(self, callback):
        """Set callback function for user interactions"""
        self.interaction_callback = callback

    def run_with_orchestrator(self, orchestrator_func, *args, **kwargs):
        """
        Run the monitor TUI with orchestrator in background thread

        Args:
            orchestrator_func: Function to run in background (orchestrator.run)
            *args, **kwargs: Arguments to pass to the function
        """
        self.orchestrator_result = None
        self.orchestrator_error = None

        def run_orchestrator():
            try:
                self.add_debug("ORCH-THREAD", "info", "Orchestrator thread started")
                self.orchestrator_result = orchestrator_func(*args, **kwargs)
                self.add_debug("ORCH-THREAD", "success", "Orchestrator completed successfully")
                self.update_status("Workflow complete!")
            except Exception as e:
                self.orchestrator_error = e
                self.add_debug("ORCH-THREAD", "error", f"Orchestrator error: {str(e)}")
                self.update_status(f"Error: {str(e)}")
                import traceback
                tb_str = traceback.format_exc()
                # Send traceback to debug panel
                for line in tb_str.split('\n')[:20]:  # Limit to 20 lines
                    if line.strip():
                        self.add_debug("TRACEBACK", "error", line)
            finally:
                # Keep TUI running to show results
                pass

        # Start orchestrator in background thread
        self.add_debug("MONITOR", "info", "Starting orchestrator in background thread")
        orch_thread = threading.Thread(target=run_orchestrator, daemon=True)
        orch_thread.start()
        self.add_debug("MONITOR", "info", f"Background thread ID: {orch_thread.ident}")

        # Run TUI in main thread (blocks until user exits)
        try:
            self.add_debug("MONITOR", "info", "Starting TUI in main thread")
            self.run()
        finally:
            # Wait a moment for orchestrator thread to finish
            self.add_debug("MONITOR", "info", "TUI exited, waiting for orchestrator...")
            orch_thread.join(timeout=2)

        # Return result or raise error
        if self.orchestrator_error:
            raise self.orchestrator_error
        return self.orchestrator_result


# Singleton instance
_monitor_app: Optional[MonitorApp] = None


def get_monitor() -> Optional[MonitorApp]:
    """Get the monitor app instance"""
    return _monitor_app


def create_monitor() -> MonitorApp:
    """
    Create the TUI monitor instance (does not start it yet)

    The monitor must be run in the main thread.
    Call monitor.run_with_orchestrator(orchestrator, task) to start.
    """
    global _monitor_app

    if _monitor_app is not None:
        return _monitor_app

    _monitor_app = MonitorApp()
    return _monitor_app


def stop_monitor():
    """Stop the TUI monitor"""
    global _monitor_app

    if _monitor_app:
        _monitor_app.exit()
        _monitor_app = None
