#!/bin/bash

# Pre-tool hook for Worker instance
# This hook is called before any tool is executed
# It sends a request to the Manager for approval

# Hook environment variables provided by Claude Code:
# - CLAUDE_CODE_TOOL_NAME: Name of the tool being executed
# - CLAUDE_CODE_TOOL_PARAMS: JSON string of tool parameters
# - CLAUDE_CODE_TASK_ID: Current task ID (if set)
# - CLAUDE_CODE_WORKING_DIR: Current working directory

TOOL_NAME="${CLAUDE_CODE_TOOL_NAME:-unknown}"
TOOL_PARAMS="${CLAUDE_CODE_TOOL_PARAMS:-{}}"
TASK_ID="${CLAUDE_CODE_TASK_ID:-}"
CHANNEL_PATH="${CLAUDE_CODE_CHANNEL_PATH:-/tmp/claude-wrapper}"

# Determine impact level based on tool name
IMPACT="medium"
case "$TOOL_NAME" in
  "Write"|"Edit"|"Bash")
    IMPACT="high"
    ;;
  "Read"|"Glob"|"Grep")
    IMPACT="low"
    ;;
esac

# Create request message
REQUEST_ID=$(uuidgen || echo "req-$(date +%s)")
TIMESTAMP=$(date +%s%3N)

REQUEST_FILE="${CHANNEL_PATH}/manager-inbox/${TIMESTAMP}-${REQUEST_ID}.json"

# Build the request message
cat > "$REQUEST_FILE" << EOF
{
  "id": "${REQUEST_ID}",
  "type": "TOOL_USE_REQUEST",
  "timestamp": ${TIMESTAMP},
  "sender": "worker",
  "payload": {
    "request": {
      "toolName": "${TOOL_NAME}",
      "parameters": ${TOOL_PARAMS},
      "reason": "Tool execution requested",
      "taskId": "${TASK_ID}",
      "impact": "${IMPACT}"
    }
  }
}
EOF

# Wait for approval (poll for response)
TIMEOUT=30
ELAPSED=0
APPROVED=false

while [ $ELAPSED -lt $TIMEOUT ]; do
  # Look for response file
  RESPONSE_FILES=$(find "${CHANNEL_PATH}/worker-inbox" -name "*.json" -type f 2>/dev/null | sort -n)

  for RESPONSE_FILE in $RESPONSE_FILES; do
    # Check if this is a reply to our request
    if grep -q "\"replyTo\":\"${REQUEST_ID}\"" "$RESPONSE_FILE" 2>/dev/null; then
      # Check if approved
      if grep -q "\"type\":\"TOOL_USE_APPROVED\"" "$RESPONSE_FILE"; then
        APPROVED=true
      fi

      # Delete the response file
      rm -f "$RESPONSE_FILE"
      break 2
    fi

    # Clean up old messages
    rm -f "$RESPONSE_FILE"
  done

  sleep 0.5
  ELAPSED=$((ELAPSED + 1))
done

if [ "$APPROVED" = true ]; then
  echo "[Hook] Tool use approved: $TOOL_NAME"
  exit 0
else
  echo "[Hook] Tool use blocked or timeout: $TOOL_NAME"
  exit 1
fi
