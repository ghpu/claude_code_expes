#!/bin/bash

# Submit hook for Worker instance
# This hook is called when the Worker submits a response
# It sends the implementation to the Manager for review

# Hook environment variables:
# - CLAUDE_CODE_RESPONSE: The response being submitted
# - CLAUDE_CODE_TASK_ID: Current task ID
# - CLAUDE_CODE_WORKING_DIR: Working directory

RESPONSE="${CLAUDE_CODE_RESPONSE:-}"
TASK_ID="${CLAUDE_CODE_TASK_ID:-}"
WORKING_DIR="${CLAUDE_CODE_WORKING_DIR:-.}"
CHANNEL_PATH="${CLAUDE_CODE_CHANNEL_PATH:-/tmp/claude-wrapper}"

echo "[Hook] Submit hook triggered for task: $TASK_ID"

# Collect implementation details
FILES_CHANGED=$(git -C "$WORKING_DIR" diff --name-status HEAD 2>/dev/null || echo "")
TEST_FILES=$(find "$WORKING_DIR" -name "*.test.*" -o -name "*.spec.*" 2>/dev/null | head -20)

# Run tests if they exist
TEST_RESULTS=""
TESTS_PASSED=true

if [ -n "$TEST_FILES" ]; then
  echo "[Hook] Running tests..."

  # Try common test runners
  if [ -f "$WORKING_DIR/package.json" ]; then
    TEST_RESULTS=$(cd "$WORKING_DIR" && npm test 2>&1 || echo "Tests failed")

    if echo "$TEST_RESULTS" | grep -q "failing\|failed"; then
      TESTS_PASSED=false
    fi
  fi
fi

# Create implementation submission message
MESSAGE_ID=$(uuidgen || echo "msg-$(date +%s)")
TIMESTAMP=$(date +%s%3N)

SUBMISSION_FILE="${CHANNEL_PATH}/manager-inbox/${TIMESTAMP}-${MESSAGE_ID}.json"

# Build files array (simplified)
FILES_JSON="[]"
if [ -n "$FILES_CHANGED" ]; then
  FILES_JSON='['
  FIRST=true

  while IFS=$'\t' read -r status file; do
    if [ "$FIRST" = true ]; then
      FIRST=false
    else
      FILES_JSON="${FILES_JSON},"
    fi

    ACTION="modified"
    case "$status" in
      A) ACTION="created" ;;
      D) ACTION="deleted" ;;
      M) ACTION="modified" ;;
    esac

    # Escape the file path
    FILE_ESC=$(echo "$file" | sed 's/"/\\"/g')

    FILES_JSON="${FILES_JSON}{\"path\":\"${FILE_ESC}\",\"action\":\"${ACTION}\"}"
  done <<< "$FILES_CHANGED"

  FILES_JSON="${FILES_JSON}]"
fi

# Build tests array
TESTS_JSON='[]'
if [ -n "$TEST_FILES" ]; then
  TESTS_JSON='['
  FIRST=true

  for test_file in $TEST_FILES; do
    if [ "$FIRST" = true ]; then
      FIRST=false
    else
      TESTS_JSON="${TESTS_JSON},"
    fi

    TEST_FILE_ESC=$(echo "$test_file" | sed 's/"/\\"/g')
    TESTS_JSON="${TESTS_JSON}{\"path\":\"${TEST_FILE_ESC}\",\"passed\":${TESTS_PASSED}}"
  done

  TESTS_JSON="${TESTS_JSON}]"
fi

# Build the submission message
cat > "$SUBMISSION_FILE" << EOF
{
  "id": "${MESSAGE_ID}",
  "type": "IMPLEMENTATION_SUBMITTED",
  "timestamp": ${TIMESTAMP},
  "sender": "worker",
  "payload": {
    "implementation": {
      "taskId": "${TASK_ID}",
      "files": ${FILES_JSON},
      "tests": ${TESTS_JSON},
      "documentation": "Implementation submitted for review",
      "completionNotes": "Task completed. Awaiting review."
    }
  }
}
EOF

echo "[Hook] Implementation submitted for review"
echo "[Hook] Files: $(echo "$FILES_JSON" | jq 'length' 2>/dev/null || echo "unknown")"
echo "[Hook] Tests passed: $TESTS_PASSED"

# Wait for review (optional - could return immediately)
# For now, we'll wait for approval/rejection

TIMEOUT=300  # 5 minutes
ELAPSED=0
REVIEW_RECEIVED=false
APPROVED=false

while [ $ELAPSED -lt $TIMEOUT ]; do
  # Look for review response
  RESPONSE_FILES=$(find "${CHANNEL_PATH}/worker-inbox" -name "*.json" -type f 2>/dev/null | sort -n)

  for RESPONSE_FILE in $RESPONSE_FILES; do
    # Check for implementation approval/rejection
    if grep -q "\"implementationId\":\"${TASK_ID}\"" "$RESPONSE_FILE" 2>/dev/null; then
      REVIEW_RECEIVED=true

      if grep -q "\"type\":\"IMPLEMENTATION_APPROVED\"" "$RESPONSE_FILE"; then
        APPROVED=true
        echo "[Hook] ✓ Implementation APPROVED"
      else
        echo "[Hook] ✗ Implementation REJECTED"

        # Extract feedback
        FEEDBACK=$(cat "$RESPONSE_FILE" | jq -r '.payload.feedback.requiredChanges[]' 2>/dev/null || echo "No specific feedback")
        echo "[Hook] Feedback: $FEEDBACK"
      fi

      rm -f "$RESPONSE_FILE"
      break 2
    fi

    # Clean up old messages
    rm -f "$RESPONSE_FILE"
  done

  sleep 1
  ELAPSED=$((ELAPSED + 1))
done

if [ "$APPROVED" = true ]; then
  exit 0
else
  echo "[Hook] Implementation requires revision"
  exit 1
fi
