"""
CLI entry point for Claude Wrapper
"""

import argparse
import sys
import os
from .orchestrator import Orchestrator


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description="Claude Wrapper - Dual Instance Mode using Claude Code CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m claude_wrapper "Write a calculator function with tests"
  python -m claude_wrapper --strictness extreme "Build a REST API"
  python -m claude_wrapper --debug "Add authentication to my app"

This wrapper spawns TWO real Claude Code CLI processes:
  1. Manager: Plans tasks and performs strict code review
  2. Worker: Implements code under Manager supervision

NO SHORTCUTS. NO LAZY CODE. REAL DUAL-INSTANCE ENFORCEMENT.
        """
    )

    parser.add_argument(
        "task",
        help="Task description to execute"
    )

    parser.add_argument(
        "--working-dir",
        default=os.getcwd(),
        help="Working directory (default: current directory)"
    )

    parser.add_argument(
        "--strictness",
        choices=["low", "medium", "high", "extreme"],
        default="high",
        help="Code review strictness level (default: high)"
    )

    parser.add_argument(
        "--allow-mocks",
        action="store_true",
        help="Allow mock implementations (default: not allowed)"
    )

    parser.add_argument(
        "--no-tests",
        action="store_true",
        help="Don't require tests (default: tests required)"
    )

    parser.add_argument(
        "--max-iterations",
        type=int,
        default=5,
        help="Maximum review iterations per subtask (default: 5)"
    )

    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug output"
    )

    parser.add_argument(
        "--interactive",
        action="store_true",
        help="Enable interactive mode (pause after each subtask to interact with Manager)"
    )

    parser.add_argument(
        "--monitor",
        action="store_true",
        help="Enable advanced TUI monitor with live conversation view (requires textual)"
    )

    parser.add_argument(
        "--claude-path",
        default="claude",
        help="Path to claude CLI executable (default: claude)"
    )

    args = parser.parse_args()

    # Set claude path in environment
    os.environ['CLAUDE_PATH'] = args.claude_path

    # Print banner
    print()
    print("╔════════════════════════════════════════════════════════════════╗")
    print("║     CLAUDE WRAPPER - DUAL INSTANCE MODE (Python + CLI)       ║")
    print("║     Uses Claude Code Max Subscription - NO API KEY NEEDED     ║")
    print("╚════════════════════════════════════════════════════════════════╝")
    print()

    # Show configuration
    print("Configuration:")
    print(f"  Task: {args.task}")
    print(f"  Working Dir: {args.working_dir}")
    print(f"  Strictness: {args.strictness}")
    print(f"  Allow Mocks: {args.allow_mocks}")
    print(f"  Require Tests: {not args.no_tests}")
    print(f"  Max Iterations: {args.max_iterations}")
    print(f"  Interactive Mode: {args.interactive}")
    print(f"  TUI Monitor: {args.monitor}")
    print(f"  Debug: {args.debug}")
    print(f"  Claude Path: {args.claude_path}")
    print()

    # Build manager config
    manager_config = {
        'strictness': args.strictness,
        'allow_mocks': args.allow_mocks,
        'require_tests': not args.no_tests,
    }

    try:
        # Create and run orchestrator
        orchestrator = Orchestrator(
            working_dir=args.working_dir,
            manager_config=manager_config,
            max_iterations=args.max_iterations,
            debug=args.debug,
            interactive=args.interactive,
            use_monitor=args.monitor
        )

        result = orchestrator.run(args.task)

        # Exit with appropriate code
        if result['status'] == 'success':
            print("\n✓ Task completed successfully!")
            sys.exit(0)
        else:
            print("\n✗ Task completed with some failures")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n✗ Fatal error: {e}")
        if args.debug:
            import traceback
            traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
