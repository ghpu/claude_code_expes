"""
Claude Wrapper - Dual Instance System using Claude Code CLI
Spawns and manages two real Claude CLI processes for Manager and Worker roles
"""

__version__ = "1.0.0"
__author__ = "Claude Code Wrapper"

from .claude_process import ClaudeProcess
from .manager import Manager
from .worker import Worker
from .orchestrator import Orchestrator
from .tool_executor import ToolExecutor

__all__ = [
    "ClaudeProcess",
    "Manager",
    "Worker",
    "Orchestrator",
    "ToolExecutor",
]
