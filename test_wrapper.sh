#!/bin/bash

# Test script for Claude Wrapper with Terminal UI and Interactive Mode

echo "======================================================================"
echo "  CLAUDE WRAPPER TEST SUITE"
echo "======================================================================"
echo ""

# Test 1: Help command
echo "Test 1: Help command"
echo "----------------------------------------------------------------------"
cd claude-wrapper-py
python -m claude_wrapper --help
echo ""

# Test 2: Simple dry run (just show it would work)
echo ""
echo "Test 2: Check syntax and imports"
echo "----------------------------------------------------------------------"
python -c "
from claude_wrapper.orchestrator import Orchestrator
from claude_wrapper.terminal_ui import ui
from claude_wrapper.manager import Manager
from claude_wrapper.worker import Worker

print('✓ All imports successful')
ui.print_success('Terminal UI working')
ui.manager_log('Manager logging works')
ui.worker_log('Worker logging works')
ui.orchestrator_log('Orchestrator logging works')
"
echo ""

# Test 3: Show what a real run would look like
echo ""
echo "Test 3: To run a REAL task, use:"
echo "----------------------------------------------------------------------"
echo "python -m claude_wrapper 'Create a simple hello world script'"
echo ""
echo "With interactive mode:"
echo "python -m claude_wrapper --interactive 'Create a simple hello world script'"
echo ""
echo "With debug and custom settings:"
echo "python -m claude_wrapper --debug --strictness medium --max-iterations 3 'Your task'"
echo ""

echo "======================================================================"
echo "  TEST SUITE COMPLETE"
echo "======================================================================"
echo ""
echo "NOTE: The actual Claude CLI processes will only start when you run"
echo "      a real task. Make sure 'claude' command is in your PATH."
echo ""
