"""
Orchestrator - Coordinates Manager and Worker Claude processes
"""

from typing import Dict, Any
from .manager import Manager
from .worker import Worker
from .terminal_ui import ui


class Orchestrator:
    """Orchestrates the dual-instance workflow"""

    def __init__(
        self,
        working_dir: str,
        manager_config: Dict[str, Any],
        max_iterations: int = 5,
        debug: bool = False,
        interactive: bool = False
    ):
        """
        Initialize Orchestrator

        Args:
            working_dir: Working directory
            manager_config: Configuration for Manager (strictness, etc.)
            max_iterations: Maximum retry iterations
            debug: Enable debug output
            interactive: Enable interactive mode (pause for user input)
        """
        self.working_dir = working_dir
        self.manager_config = manager_config
        self.max_iterations = max_iterations
        self.debug = debug
        self.interactive = interactive

        # Will be initialized in run()
        self.manager: Manager = None
        self.worker: Worker = None

    def run(self, task_description: str) -> Dict[str, Any]:
        """
        Run the complete dual-instance workflow

        Args:
            task_description: The task to execute

        Returns:
            Final result dict with status and details
        """
        ui.print_banner("DUAL INSTANCE WORKFLOW STARTING")
        ui.print_box("Task", [task_description], ui.Colors.BRIGHT_CYAN)

        try:
            # Initialize Manager
            ui.orchestrator_log("Initializing Manager instance...")
            self.manager = Manager(self.working_dir, self.manager_config, debug=self.debug)
            self.manager.start()

            # Initialize Worker
            ui.orchestrator_log("Initializing Worker instance...")
            self.worker = Worker(self.working_dir, debug=self.debug)
            self.worker.start()

            ui.orchestrator_log("Both instances ready!", "success")

            # Phase 1: Planning
            ui.print_section("Phase 1: PLANNING")
            ui.orchestrator_log("Requesting plan from Manager...")

            plan = self.manager.plan_task(task_description)

            ui.orchestrator_log(f"Plan created with {len(plan['subtasks'])} subtasks", "success")
            subtask_list = [f"{i}. {subtask}" for i, subtask in enumerate(plan['subtasks'], 1)]
            ui.print_box("Subtasks", subtask_list, ui.Colors.BRIGHT_YELLOW)

            # Phase 2: Implementation with review iterations
            ui.print_section("Phase 2: IMPLEMENTATION & REVIEW")

            results = []

            for i, subtask in enumerate(plan['subtasks'], 1):
                ui.print_subtask_header(i, len(plan['subtasks']), subtask)

                result = self._execute_subtask_with_review(subtask)
                results.append(result)

                if not result['approved']:
                    ui.orchestrator_log(f"Subtask {i} failed after {self.max_iterations} iterations", "error")
                else:
                    ui.orchestrator_log(f"Subtask {i} completed successfully", "success")

                # Interactive mode - allow user to interact with Manager
                if self.interactive and i < len(plan['subtasks']):
                    ui.orchestrator_log("Interactive mode enabled", "info")
                    try:
                        self._handle_user_interaction()
                    except KeyboardInterrupt:
                        ui.orchestrator_log("User cancelled workflow", "warning")
                        break

            # Summary
            approved_count = sum(1 for r in results if r['approved'])
            failed_count = len(results) - approved_count

            ui.print_summary(len(results), approved_count, failed_count)

            all_approved = all(r['approved'] for r in results)

            if all_approved:
                status = "success"
            else:
                status = "partial"

            return {
                'status': status,
                'task': task_description,
                'subtasks': len(results),
                'approved': approved_count,
                'results': results
            }

        finally:
            # Clean up
            ui.orchestrator_log("Shutting down instances...")
            if self.manager:
                self.manager.stop()
            if self.worker:
                self.worker.stop()
            ui.orchestrator_log("Shutdown complete", "success")

    def _execute_subtask_with_review(self, subtask_description: str) -> Dict[str, Any]:
        """
        Execute a subtask with review iteration loop

        Args:
            subtask_description: Description of the subtask

        Returns:
            Result dict with approval status and details
        """
        iteration = 0
        implementation = None
        review = None

        while iteration < self.max_iterations:
            iteration += 1
            ui.print_iteration_header(iteration, self.max_iterations)

            # Worker implements
            ui.orchestrator_log("→ Worker: Requesting implementation")
            if iteration == 1:
                implementation = self.worker.execute_task(subtask_description)
            else:
                # Provide previous feedback
                feedback = self._format_feedback(review)
                implementation = self.worker.provide_feedback(feedback)

            ui.orchestrator_log("← Worker: Implementation received")
            ui.print_progress(f"Files modified/created: {len(implementation['files'])}")
            ui.print_progress(f"Tests executed: {len(implementation['tests'])}")

            # Manager reviews
            ui.orchestrator_log("→ Manager: Requesting code review")
            review = self.manager.review_implementation(implementation)

            ui.orchestrator_log("← Manager: Review received")
            ui.print_review_result(review['approved'], review['score'], len(review['issues']))

            # Check if approved
            if review['approved']:
                ui.orchestrator_log(f"Subtask approved after {iteration} iteration(s)", "success")
                return {
                    'approved': True,
                    'iterations': iteration,
                    'score': review['score'],
                    'implementation': implementation
                }

            # Not approved - show feedback
            ui.orchestrator_log("Implementation rejected - providing feedback to Worker", "warning")
            if review['required_changes']:
                ui.print_box("Required Changes", review['required_changes'][:5], ui.Colors.YELLOW)

        # Max iterations exceeded
        ui.orchestrator_log(f"Max iterations ({self.max_iterations}) exceeded", "error")
        ui.print_warning(f"Final score: {review['score']}/100")

        return {
            'approved': False,
            'iterations': self.max_iterations,
            'score': review['score'],
            'implementation': implementation,
            'review': review
        }

    def _format_feedback(self, review: Dict[str, Any]) -> str:
        """Format review feedback for Worker"""
        feedback = f"""# CODE REVIEW FEEDBACK

**Score**: {review['score']}/100
**Status**: REJECTED - Needs improvements

"""
        if review['issues']:
            feedback += "**Issues Found**:\n"
            for i, issue in enumerate(review['issues'], 1):
                feedback += f"{i}. {issue}\n"
            feedback += "\n"

        if review['required_changes']:
            feedback += "**Required Changes** (YOU MUST FIX THESE):\n"
            for i, change in enumerate(review['required_changes'], 1):
                feedback += f"{i}. {change}\n"
            feedback += "\n"

        feedback += """**Instructions**:
1. Address ALL the issues above
2. Make the required changes
3. Ensure ALL tests pass
4. Verify code quality
5. Resubmit for review

Be thorough. The Manager will review again."""

        return feedback

    def _handle_user_interaction(self) -> None:
        """Handle interactive mode - allow user to interact with Manager"""
        while True:
            print()
            user_input = ui.ask_user("Enter message for Manager (or 'continue' to proceed):")

            if user_input.lower() in ['continue', 'c', '']:
                break

            if user_input.lower() in ['quit', 'exit', 'q']:
                ui.print_warning("User requested exit")
                raise KeyboardInterrupt("User exit")

            # Send to Manager
            response = self.manager.interactive_prompt(user_input)

            # Display response
            ui.print_box("Manager Response", [response], ui.Colors.BRIGHT_BLUE)

            print()
            again = ui.ask_user("Ask another question? (y/n):")
            if again.lower() not in ['y', 'yes']:
                break
