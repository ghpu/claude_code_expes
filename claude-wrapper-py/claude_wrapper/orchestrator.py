"""
Orchestrator - Coordinates Manager and Worker Claude processes
"""

from typing import Dict, Any
from .manager import Manager
from .worker import Worker


class Orchestrator:
    """Orchestrates the dual-instance workflow"""

    def __init__(
        self,
        working_dir: str,
        manager_config: Dict[str, Any],
        max_iterations: int = 5,
        debug: bool = False
    ):
        """
        Initialize Orchestrator

        Args:
            working_dir: Working directory
            manager_config: Configuration for Manager (strictness, etc.)
            max_iterations: Maximum retry iterations
            debug: Enable debug output
        """
        self.working_dir = working_dir
        self.manager_config = manager_config
        self.max_iterations = max_iterations
        self.debug = debug

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
        print("=" * 80)
        print("  CLAUDE WRAPPER - DUAL INSTANCE MODE (Python + CLI)")
        print("=" * 80)
        print(f"\nTask: {task_description}\n")
        print("=" * 80)
        print()

        try:
            # Initialize Manager
            print("[Orchestrator] Initializing Manager...")
            self.manager = Manager(self.working_dir, self.manager_config, debug=self.debug)
            self.manager.start()

            # Initialize Worker
            print("[Orchestrator] Initializing Worker...")
            self.worker = Worker(self.working_dir, debug=self.debug)
            self.worker.start()

            print("[Orchestrator] Both instances ready\n")

            # Phase 1: Planning
            print("[Orchestrator] Phase 1: PLANNING")
            print("-" * 80)
            plan = self.manager.plan_task(task_description)

            print(f"[Orchestrator] Plan created:")
            print(f"  Subtasks: {len(plan['subtasks'])}")
            for i, subtask in enumerate(plan['subtasks'], 1):
                print(f"    {i}. {subtask}")
            print()

            # Phase 2: Implementation with review iterations
            print("[Orchestrator] Phase 2: IMPLEMENTATION")
            print("-" * 80)

            results = []

            for i, subtask in enumerate(plan['subtasks'], 1):
                print(f"\n[Orchestrator] Subtask {i}/{len(plan['subtasks'])}: {subtask}")
                print("-" * 80)

                result = self._execute_subtask_with_review(subtask)
                results.append(result)

                if not result['approved']:
                    print(f"[Orchestrator] ✗ Subtask {i} failed after {self.max_iterations} iterations")
                    # Could choose to continue or stop here
                    # For now, we'll continue with other subtasks
                else:
                    print(f"[Orchestrator] ✓ Subtask {i} completed successfully")

            # Summary
            print("\n" + "=" * 80)
            print("  SUMMARY")
            print("=" * 80)

            approved_count = sum(1 for r in results if r['approved'])
            print(f"Subtasks completed: {approved_count}/{len(results)}")
            print()

            all_approved = all(r['approved'] for r in results)

            if all_approved:
                print("✓ All subtasks completed successfully!")
                status = "success"
            else:
                print("✗ Some subtasks failed to meet quality standards")
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
            print("\n[Orchestrator] Shutting down...")
            if self.manager:
                self.manager.stop()
            if self.worker:
                self.worker.stop()
            print("[Orchestrator] Shutdown complete")

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
            print(f"\n[Orchestrator] Iteration {iteration}/{self.max_iterations}")

            # Worker implements
            print("[Orchestrator] → Worker: Implement subtask")
            if iteration == 1:
                implementation = self.worker.execute_task(subtask_description)
            else:
                # Provide previous feedback
                feedback = self._format_feedback(review)
                implementation = self.worker.provide_feedback(feedback)

            print(f"[Orchestrator] ← Worker: Implementation submitted")
            print(f"   Files: {len(implementation['files'])}")
            print(f"   Tests: {len(implementation['tests'])}")

            # Manager reviews
            print("[Orchestrator] → Manager: Review implementation")
            review = self.manager.review_implementation(implementation)

            print(f"[Orchestrator] ← Manager: Review complete")
            print(f"   Score: {review['score']}/100")
            print(f"   Status: {'✓ APPROVED' if review['approved'] else '✗ REJECTED'}")

            # Check if approved
            if review['approved']:
                print(f"[Orchestrator] ✓ Subtask approved after {iteration} iteration(s)")
                return {
                    'approved': True,
                    'iterations': iteration,
                    'score': review['score'],
                    'implementation': implementation
                }

            # Not approved - show feedback
            print(f"[Orchestrator] ✗ Rejected - providing feedback to Worker")
            print(f"   Issues: {len(review['issues'])}")
            if review['required_changes']:
                print("   Required changes:")
                for change in review['required_changes'][:3]:  # Show first 3
                    print(f"     - {change}")

        # Max iterations exceeded
        print(f"\n[Orchestrator] ✗ Max iterations ({self.max_iterations}) exceeded")
        print(f"   Final score: {review['score']}/100")

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
