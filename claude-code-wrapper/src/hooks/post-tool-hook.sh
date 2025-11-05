#!/bin/bash

# Post-tool hook for Worker instance
# This hook is called after any tool is executed
# It reports the results to the Manager

# Hook environment variables:
# - CLAUDE_CODE_TOOL_NAME: Name of the tool that was executed
# - CLAUDE_CODE_TOOL_RESULT: JSON string of tool result
# - CLAUDE_CODE_TOOL_SUCCESS: "true" or "false"
# - CLAUDE_CODE_TASK_ID: Current task ID (if set)

TOOL_NAME="${CLAUDE_CODE_TOOL_NAME:-unknown}"
TOOL_RESULT="${CLAUDE_CODE_TOOL_RESULT:-{}}"
TOOL_SUCCESS="${CLAUDE_CODE_TOOL_SUCCESS:-true}"
TASK_ID="${CLAUDE_CODE_TASK_ID:-}"
CHANNEL_PATH="${CLAUDE_CODE_CHANNEL_PATH:-/tmp/claude-wrapper}"

# Create completion message
MESSAGE_ID=$(uuidgen || echo "msg-$(date +%s)")
TIMESTAMP=$(date +%s%3N)

COMPLETION_FILE="${CHANNEL_PATH}/manager-inbox/${TIMESTAMP}-${MESSAGE_ID}.json"

# Build the completion message
cat > "$COMPLETION_FILE" << EOF
{
  "id": "${MESSAGE_ID}",
  "type": "TOOL_USE_COMPLETED",
  "timestamp": ${TIMESTAMP},
  "sender": "worker",
  "payload": {
    "toolName": "${TOOL_NAME}",
    "success": ${TOOL_SUCCESS},
    "output": "Tool execution completed",
    "taskId": "${TASK_ID}"
  }
}
EOF

echo "[Hook] Tool completion reported: $TOOL_NAME (success: $TOOL_SUCCESS)"

exit 0
