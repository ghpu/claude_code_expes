"""
Worker - Task implementation using real Claude CLI process
"""

from typing import Dict, List, Any
from .claude_process import ClaudeProcess
from .tool_executor import ToolExecutor
from .terminal_ui import ui


class Worker:
    """Worker instance for implementing tasks"""

    def __init__(self, working_dir: str, debug: bool = False, monitor_app=None):
        """
        Initialize Worker

        Args:
            working_dir: Working directory
            debug: Enable debug output
            monitor_app: Optional MonitorApp instance for TUI display
        """
        self.working_dir = working_dir
        self.debug = debug
        self.monitor_app = monitor_app
        self.claude = ClaudeProcess(working_dir, role="WORKER", debug=debug, monitor_app=monitor_app)
        self.tool_executor = ToolExecutor(working_dir, dangerous_mode=True)
        self.system_prompt = self._build_system_prompt()
        self.current_implementation = None

    def _build_system_prompt(self) -> str:
        """Build the system prompt for Worker"""
        prompt = f"""You are a meticulous and thorough software engineer.

Your role is to implement tasks with the HIGHEST quality standards.

CRITICAL RULES - NO EXCEPTIONS:

1. **NO SHORTCUTS EVER**
   - Write COMPLETE, production-ready code
   - NEVER use placeholders or TODOs
   - NEVER use mock implementations
   - NEVER skip error handling
   - FINISH everything completely

2. **TESTS ARE MANDATORY**
   - Write comprehensive tests for ALL code
   - Tests MUST actually run and PASS
   - Include unit tests and edge cases
   - Show test results

3. **COMPLETE IMPLEMENTATION**
   - Implement every feature fully
   - Handle all edge cases
   - Add proper error handling
   - Include logging where appropriate

4. **DOCUMENTATION**
   - Document all functions
   - Include usage examples
   - Write clear explanations

5. **VERIFICATION**
   - After writing code, VERIFY it works
   - Run tests and show results
   - Check for errors
   - Verify dependencies

Your work will be reviewed by a STRICT Manager who WILL REJECT incomplete work.
Take your time. Be thorough. Do it RIGHT.

Available tools (describe what you want to do before using them):
- Read: Read files
- Write: Create new files
- Edit: Modify existing files
- Bash: Run commands (tests, builds, etc.)
- Glob: Find files
- Grep: Search code

When you use tools, explain why.
When you finish, say "IMPLEMENTATION COMPLETE" and summarize what you did.

Working directory: {self.working_dir}
"""
        return prompt

    def start(self) -> None:
        """Start the Worker's Claude process"""
        ui.worker_log("Starting Worker Claude instance...")

        self.claude.start()

        # Send system prompt
        response = self.claude.send_prompt(self.system_prompt)

        ui.worker_log("Initialized and ready", "success")

    def execute_task(self, task_description: str, requirements: List[str] = None) -> Dict[str, Any]:
        """
        Execute a task

        Args:
            task_description: Description of the task to implement
            requirements: Optional list of specific requirements

        Returns:
            Implementation dict with files, tests, documentation
        """
        ui.worker_log(f"Starting task implementation...")

        # Reset implementation tracking
        self.current_implementation = {
            'files': [],
            'tests': [],
            'documentation': '',
            'output': ''
        }

        # Build task prompt
        prompt = self._build_task_prompt(task_description, requirements)

        # Send to Claude
        response = self.claude.send_prompt(prompt, timeout=180)

        # Track the response
        self.current_implementation['output'] = response.text

        # Parse and track implementation details
        self._track_implementation(response.text)

        ui.worker_log(f"Implementation complete: {len(self.current_implementation['files'])} files, {len(self.current_implementation['tests'])} tests", "success")

        return self.current_implementation

    def _build_task_prompt(self, task_description: str, requirements: List[str] = None) -> str:
        """Build task prompt for Worker"""
        prompt = f"""# TASK ASSIGNMENT

**Task**: {task_description}

"""
        if requirements:
            prompt += "**Requirements**:\n"
            for i, req in enumerate(requirements, 1):
                prompt += f"{i}. {req}\n"
            prompt += "\n"

        prompt += """**Instructions**:

1. Implement this task COMPLETELY - NO shortcuts
2. Write comprehensive tests that actually RUN and PASS
3. Document your code properly
4. Verify everything works

**Process**:

1. **Plan**: Briefly explain your approach
2. **Implement**: Write the code using tools:
   - Use Read to check existing code
   - Use Write to create new files
   - Use Edit to modify files
3. **Test**: Write and RUN tests using Bash
   - Show test output
   - Ensure tests PASS
4. **Verify**: Double-check everything works
5. **Document**: Explain what you built

When using tools, DESCRIBE what you're doing first, then use the tool.

Example:
"I need to create a calculator module. Let me write the main file..."
[Then use Write tool]

When COMPLETELY done, say "IMPLEMENTATION COMPLETE" and summarize.

Begin now."""

        return prompt

    def _track_implementation(self, output: str) -> None:
        """Track implementation details from output"""
        # This is a simplified tracker - in real use, we'd parse tool usage more carefully
        # For now, we'll scan for file mentions and test results

        import re

        # Look for file operations mentioned
        file_patterns = [
            r'(?:wrote|created|modified|edited)\s+(?:file\s+)?[\'"]?([^\s\'"]+\.[a-z]{2,5})',
            r'[\'"]([^\'"]+\.py)[\'"]',
            r'[\'"]([^\'"]+\.js)[\'"]',
            r'[\'"]([^\'"]+\.ts)[\'"]',
        ]

        files_mentioned = set()
        for pattern in file_patterns:
            matches = re.findall(pattern, output, re.IGNORECASE)
            files_mentioned.update(matches)

        # Add to implementation
        for filepath in files_mentioned:
            if filepath not in [f['path'] for f in self.current_implementation['files']]:
                self.current_implementation['files'].append({
                    'path': filepath,
                    'action': 'created'
                })

        # Look for test results
        test_indicators = [
            (r'(\d+)\s+passed', True),
            (r'(\d+)\s+failed', False),
            (r'All tests? passed', True),
            (r'Tests? passed', True),
        ]

        for pattern, passed in test_indicators:
            if re.search(pattern, output, re.IGNORECASE):
                self.current_implementation['tests'].append({
                    'name': 'tests',
                    'passed': passed,
                    'output': output[-500:]  # Last 500 chars with test results
                })
                break

        # Extract documentation (look for explanatory text)
        doc_match = re.search(r'(?:IMPLEMENTATION COMPLETE|Summary|Explanation):(.*?)$', output, re.DOTALL | re.IGNORECASE)
        if doc_match:
            self.current_implementation['documentation'] = doc_match.group(1).strip()

    def provide_feedback(self, feedback: str) -> Dict[str, Any]:
        """
        Provide feedback from Manager and retry

        Args:
            feedback: Feedback text from Manager's review

        Returns:
            Updated implementation dict
        """
        ui.worker_log("Received feedback from Manager, addressing issues...")

        prompt = f"""# MANAGER FEEDBACK

Your previous implementation was reviewed and needs improvements.

{feedback}

Please address ALL the issues mentioned above and resubmit.

Make the necessary changes, run tests again, and verify everything works.

When done, say "IMPLEMENTATION COMPLETE" and explain what you fixed."""

        # Send feedback and get response
        response = self.claude.send_prompt(prompt, timeout=180)

        # Update implementation tracking
        self.current_implementation['output'] += "\n\n--- REVISION ---\n\n" + response.text
        self._track_implementation(response.text)

        ui.worker_log("Revision complete, resubmitting for review", "success")

        return self.current_implementation

    def stop(self) -> None:
        """Stop the Worker's Claude process"""
        ui.worker_log("Stopping Worker instance...")
        self.claude.stop()
        ui.worker_log("Worker stopped", "success")
