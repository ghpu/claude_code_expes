"""
ToolExecutor - Executes file operations and commands
Provides Read, Write, Edit, Bash, Glob, Grep functionality
"""

import os
import subprocess
import glob as glob_module
from pathlib import Path
from typing import Dict, Any, Tuple


class ToolExecutor:
    """Executes tools for file operations and commands"""

    def __init__(self, working_dir: str):
        """
        Initialize tool executor

        Args:
            working_dir: Working directory for operations
        """
        self.working_dir = working_dir

    def execute(self, tool_name: str, params: Dict[str, Any]) -> Tuple[bool, str]:
        """
        Execute a tool

        Args:
            tool_name: Name of the tool (Read, Write, Edit, Bash, Glob, Grep)
            params: Tool parameters

        Returns:
            Tuple of (success: bool, output: str)
        """
        try:
            if tool_name == "Read":
                return self._read(params['file_path'])
            elif tool_name == "Write":
                return self._write(params['file_path'], params['content'])
            elif tool_name == "Edit":
                return self._edit(params['file_path'], params['old_string'], params['new_string'])
            elif tool_name == "Bash":
                return self._bash(params['command'])
            elif tool_name == "Glob":
                return self._glob(params['pattern'])
            elif tool_name == "Grep":
                return self._grep(params['pattern'], params.get('path', '.'))
            else:
                return False, f"Unknown tool: {tool_name}"
        except Exception as e:
            return False, f"Tool execution error: {str(e)}"

    def _read(self, file_path: str) -> Tuple[bool, str]:
        """Read a file with line numbers"""
        full_path = self._resolve_path(file_path)

        if not os.path.exists(full_path):
            return False, f"File not found: {full_path}"

        try:
            with open(full_path, 'r', encoding='utf-8', errors='replace') as f:
                lines = f.readlines()

            # Format with line numbers (cat -n style)
            numbered = []
            for i, line in enumerate(lines, 1):
                numbered.append(f"{i:6}→{line.rstrip()}")

            return True, '\n'.join(numbered)
        except Exception as e:
            return False, f"Error reading file: {e}"

    def _write(self, file_path: str, content: str) -> Tuple[bool, str]:
        """Write content to a file"""
        full_path = self._resolve_path(file_path)

        try:
            # Create directory if needed
            os.makedirs(os.path.dirname(full_path), exist_ok=True)

            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(content)

            return True, f"File written successfully: {full_path}"
        except Exception as e:
            return False, f"Error writing file: {e}"

    def _edit(self, file_path: str, old_string: str, new_string: str) -> Tuple[bool, str]:
        """Edit a file by replacing text"""
        full_path = self._resolve_path(file_path)

        if not os.path.exists(full_path):
            return False, f"File not found: {full_path}"

        try:
            with open(full_path, 'r', encoding='utf-8') as f:
                content = f.read()

            if old_string not in content:
                return False, f"String not found in file: {old_string[:50]}..."

            new_content = content.replace(old_string, new_string, 1)

            with open(full_path, 'w', encoding='utf-8') as f:
                f.write(new_content)

            return True, f"File edited successfully: {full_path}"
        except Exception as e:
            return False, f"Error editing file: {e}"

    def _bash(self, command: str) -> Tuple[bool, str]:
        """Execute a bash command"""
        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=self.working_dir,
                capture_output=True,
                text=True,
                timeout=120
            )

            output = result.stdout
            if result.stderr:
                output += f"\n[stderr]: {result.stderr}"

            if result.returncode != 0:
                return False, f"Command failed (exit {result.returncode}):\n{output}"

            return True, output
        except subprocess.TimeoutExpired:
            return False, "Command timeout (120s)"
        except Exception as e:
            return False, f"Error executing command: {e}"

    def _glob(self, pattern: str) -> Tuple[bool, str]:
        """Find files matching glob pattern"""
        try:
            files = glob_module.glob(
                pattern,
                root_dir=self.working_dir,
                recursive=True
            )

            if not files:
                return True, "No files found"

            # Convert to absolute paths
            abs_files = [os.path.join(self.working_dir, f) for f in files]
            return True, '\n'.join(sorted(abs_files))
        except Exception as e:
            return False, f"Error in glob: {e}"

    def _grep(self, pattern: str, path: str) -> Tuple[bool, str]:
        """Search for pattern in files"""
        search_path = self._resolve_path(path)

        try:
            # Use grep command if available
            result = subprocess.run(
                ['grep', '-r', '-n', pattern, search_path],
                capture_output=True,
                text=True,
                timeout=30
            )

            if result.returncode == 1:  # No matches
                return True, "No matches found"
            elif result.returncode != 0:  # Error
                return False, f"Grep error: {result.stderr}"

            return True, result.stdout
        except FileNotFoundError:
            # grep not available, fall back to Python search
            return self._python_grep(pattern, search_path)
        except Exception as e:
            return False, f"Error in grep: {e}"

    def _python_grep(self, pattern: str, path: str) -> Tuple[bool, str]:
        """Python fallback for grep"""
        import re

        matches = []
        pattern_re = re.compile(pattern)

        if os.path.isfile(path):
            files = [path]
        else:
            files = []
            for root, _, filenames in os.walk(path):
                for filename in filenames:
                    files.append(os.path.join(root, filename))

        for filepath in files:
            try:
                with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                    for i, line in enumerate(f, 1):
                        if pattern_re.search(line):
                            matches.append(f"{filepath}:{i}:{line.rstrip()}")
            except:
                pass  # Skip files that can't be read

        if not matches:
            return True, "No matches found"

        return True, '\n'.join(matches)

    def _resolve_path(self, path: str) -> str:
        """Resolve path relative to working directory"""
        if os.path.isabs(path):
            return path
        return os.path.join(self.working_dir, path)
