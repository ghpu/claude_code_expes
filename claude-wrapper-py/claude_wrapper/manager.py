"""
Manager - Strict code review and task planning using real Claude CLI process
"""

from typing import Dict, List, Any
from .claude_process import ClaudeProcess
from .tool_executor import ToolExecutor
from .terminal_ui import ui


class Manager:
    """Manager instance for planning and strict code review"""

    def __init__(self, working_dir: str, config: Dict[str, Any], debug: bool = False, monitor_app=None):
        """
        Initialize Manager

        Args:
            working_dir: Working directory
            config: Manager configuration (strictness, allow_mocks, require_tests, etc.)
            debug: Enable debug output
            monitor_app: Optional MonitorApp instance for TUI display
        """
        self.working_dir = working_dir
        self.config = config
        self.debug = debug
        self.monitor_app = monitor_app
        self.claude = ClaudeProcess(working_dir, role="MANAGER", debug=debug, monitor_app=monitor_app)
        self.tool_executor = ToolExecutor(working_dir, dangerous_mode=True)
        self.system_prompt = self._build_system_prompt()

    def _build_system_prompt(self) -> str:
        """Build the system prompt for Manager"""
        strictness = self.config.get('strictness', 'high')
        allow_mocks = self.config.get('allow_mocks', False)
        require_tests = self.config.get('require_tests', True)

        prompt = f"""You are an EXTREMELY STRICT Engineering Manager and Code Reviewer.

Your role is to:
1. Plan complex tasks and break them into subtasks
2. Review all code implementations with RUTHLESS scrutiny
3. REJECT any shortcuts, incomplete code, or lazy implementations
4. Enforce the highest quality standards

STRICTNESS LEVEL: {strictness.upper()}

AUTOMATIC REJECTION CRITERIA:

1. SHORTCUTS & INCOMPLETE CODE:
   {'- Mocks are tolerated if clearly marked' if allow_mocks else '- ANY mock implementations → INSTANT REJECT'}
   - TODO comments → INSTANT REJECT
   - "Implement this later" → INSTANT REJECT
   - Placeholder code → INSTANT REJECT
   - Half-finished functions → INSTANT REJECT

2. TESTING:
   {'''- No tests → INSTANT REJECT
   - Tests not passing → INSTANT REJECT
   - Insufficient coverage → INSTANT REJECT''' if require_tests else '- Tests are optional but recommended'}

3. CODE QUALITY:
   - No error handling → REJECT
   - Poor variable names → REJECT
   - Overly complex functions → REJECT
   - Code that doesn't follow language conventions → REJECT

4. DOCUMENTATION:
   - Missing documentation → REJECT
   - Unclear explanations → REJECT

APPROVAL CRITERIA:
✓ ALL requirements fully implemented
✓ ALL tests written and passing
✓ Comprehensive error handling
✓ Clear documentation
✓ Production-ready code quality
✓ NO shortcuts or TODOs

Be RUTHLESS. It's better to reject 10 times and get perfection than approve mediocre code.
The worker MUST meet these standards or you MUST reject with specific feedback.

Working directory: {self.working_dir}
"""
        return prompt

    def start(self) -> None:
        """Start the Manager's Claude process"""
        ui.manager_log("Starting Manager Claude instance...")

        if self.monitor_app:
            self.monitor_app.add_debug("MANAGER", "info", "About to call self.claude.start()...")

        self.claude.start()

        if self.monitor_app:
            self.monitor_app.add_debug("MANAGER", "success", "self.claude.start() completed")
            self.monitor_app.add_debug("MANAGER", "info", "About to send system prompt...")

        # Send system prompt
        response = self.claude.send_prompt(self.system_prompt)

        if self.monitor_app:
            self.monitor_app.add_debug("MANAGER", "success", "System prompt sent successfully")

        ui.manager_log("Initialized and ready", "success")
        if self.debug:
            ui.manager_log(f"Response preview: {response.text[:100]}...")

    def plan_task(self, task_description: str) -> Dict[str, Any]:
        """
        Plan a task and break it into subtasks

        Args:
            task_description: Description of the task

        Returns:
            Dictionary with plan details (subtasks, risks, etc.)
        """
        ui.manager_log("Creating implementation plan...")

        prompt = f"""# TASK PLANNING REQUEST

Task: {task_description}

Please create a detailed implementation plan.

Provide:
1. Breakdown of the main task
2. Ordered list of subtasks (number them)
3. Dependencies between tasks
4. Potential risks or challenges
5. Estimated complexity

Use tools if needed to understand the codebase:
- Read: Read existing files
- Glob: Find files matching patterns
- Grep: Search for code patterns

Format your response clearly with numbered subtasks."""

        response = self.claude.send_prompt(prompt, timeout=60)

        # Parse subtasks from response
        subtasks = self._parse_subtasks(response.text)

        plan = {
            'description': task_description,
            'subtasks': subtasks,
            'full_plan': response.text,
            'has_thinking': response.has_thinking,
            'thinking': response.thinking_content
        }

        ui.manager_log(f"Plan created with {len(subtasks)} subtasks", "success")

        return plan

    def _parse_subtasks(self, text: str) -> List[str]:
        """Parse numbered subtasks from plan text"""
        import re

        subtasks = []
        # Look for numbered items like "1. Do something"
        pattern = r'^\s*\d+\.\s+(.+)$'

        for line in text.split('\n'):
            match = re.match(pattern, line)
            if match:
                subtasks.append(match.group(1).strip())

        # If no numbered items found, create a single subtask
        if not subtasks:
            subtasks = [text.strip()]

        return subtasks

    def review_implementation(self, implementation: Dict[str, Any]) -> Dict[str, Any]:
        """
        Review an implementation strictly

        Args:
            implementation: Dictionary with files, tests, documentation

        Returns:
            Review result with approval status, score, and feedback
        """
        ui.manager_log("Reviewing implementation...")
        ui.manager_log(f"Files to review: {len(implementation.get('files', []))}")
        ui.manager_log(f"Test results: {len(implementation.get('tests', []))}")

        # Build review prompt with actual file contents
        prompt = self._build_review_prompt(implementation)

        # Send to Claude for review
        response = self.claude.send_prompt(prompt, timeout=120)

        # Parse review
        review = self._parse_review(response.text)

        status = "Approved" if review['approved'] else "Rejected"
        level = "success" if review['approved'] else "warning"
        ui.manager_log(f"Review complete: {status} (Score: {review['score']}/100, Issues: {len(review['issues'])})", level)

        return review

    def _build_review_prompt(self, implementation: Dict[str, Any]) -> str:
        """Build review prompt with actual file contents"""
        prompt = "# CODE REVIEW REQUEST\n\n"

        # Add files
        files = implementation.get('files', [])
        if files:
            prompt += f"## Files Modified/Created ({len(files)})\n\n"
            for file_info in files:
                filepath = file_info['path']
                prompt += f"### {filepath}\n\n"

                # Read actual file content
                success, content = self.tool_executor.execute('Read', {'file_path': filepath})
                if success:
                    prompt += f"```\n{content}\n```\n\n"
                else:
                    prompt += f"*Could not read file: {content}*\n\n"

        # Add test results
        tests = implementation.get('tests', [])
        if tests:
            prompt += f"## Test Results ({len(tests)})\n\n"
            for test in tests:
                status = "✓ PASSED" if test.get('passed', False) else "✗ FAILED"
                prompt += f"### {test['name']}: {status}\n\n"
                if test.get('output'):
                    prompt += f"```\n{test['output']}\n```\n\n"
        else:
            prompt += "## Test Results\n**NO TESTS FOUND**"
            if self.config.get('require_tests', True):
                prompt += " → AUTOMATIC REJECT\n\n"

        # Add documentation
        docs = implementation.get('documentation', '')
        if docs:
            prompt += f"## Documentation\n{docs}\n\n"
        else:
            prompt += "## Documentation\n**NO DOCUMENTATION PROVIDED**\n\n"

        # Review instructions
        prompt += """## REVIEW INSTRUCTIONS

Perform a THOROUGH and STRICT code review.

Check for:
1. Completeness - Is EVERYTHING implemented?
2. Quality - Is the code well-written and maintainable?
3. Tests - Are there comprehensive tests that PASS?
4. Shortcuts - Any mocks, TODOs, placeholders, or incomplete code?
5. Error handling - Are errors properly handled?
6. Documentation - Is it well-documented?

Provide your review in this format:

DECISION: APPROVE or REJECT
SCORE: [0-100]

ISSUES:
- [List specific issues found]

REQUIRED CHANGES:
- [List what MUST be fixed if rejected]

Be ruthless. Only approve if this code meets the HIGHEST standards."""

        return prompt

    def _parse_review(self, text: str) -> Dict[str, Any]:
        """Parse review response"""
        import re

        review = {
            'approved': False,
            'score': 0,
            'issues': [],
            'required_changes': [],
            'full_review': text
        }

        # Check approval
        if re.search(r'DECISION:\s*APPROVE', text, re.IGNORECASE):
            review['approved'] = True
        elif re.search(r'DECISION:\s*REJECT', text, re.IGNORECASE):
            review['approved'] = False
        else:
            # Default to approved if "approve" without "reject"
            review['approved'] = 'approve' in text.lower() and 'reject' not in text.lower()

        # Extract score
        score_match = re.search(r'SCORE:\s*(\d+)', text, re.IGNORECASE)
        if score_match:
            review['score'] = int(score_match.group(1))
        else:
            # Estimate based on approval
            review['score'] = 85 if review['approved'] else 45

        # Extract issues
        issues_section = re.search(r'ISSUES:(.*?)(?:REQUIRED CHANGES:|$)', text, re.DOTALL | re.IGNORECASE)
        if issues_section:
            for line in issues_section.group(1).split('\n'):
                line = line.strip()
                if line and (line.startswith('-') or line.startswith('•')):
                    review['issues'].append(line.lstrip('-•').strip())

        # Extract required changes
        changes_section = re.search(r'REQUIRED CHANGES:(.*?)$', text, re.DOTALL | re.IGNORECASE)
        if changes_section:
            for line in changes_section.group(1).split('\n'):
                line = line.strip()
                if line and (line.startswith('-') or line.startswith('•')):
                    review['required_changes'].append(line.lstrip('-•').strip())

        # If rejected but no changes specified, add generic ones
        if not review['approved'] and not review['required_changes']:
            review['required_changes'] = [
                "Address all issues mentioned in the review",
                "Ensure all tests pass",
                "Add comprehensive documentation"
            ]

        return review

    def interactive_prompt(self, user_message: str) -> str:
        """
        Send a custom prompt to Manager for interaction

        Args:
            user_message: User's message/question

        Returns:
            Manager's response text
        """
        ui.manager_log(f"User interaction: {user_message[:50]}...")

        prompt = f"""# USER INTERACTION

The user wants to interact with you directly:

{user_message}

Please respond to the user's message."""

        response = self.claude.send_prompt(prompt, timeout=120)

        ui.manager_log("Response ready")

        return response.text

    def stop(self) -> None:
        """Stop the Manager's Claude process"""
        ui.manager_log("Stopping Manager instance...")
        self.claude.stop()
        ui.manager_log("Manager stopped", "success")
