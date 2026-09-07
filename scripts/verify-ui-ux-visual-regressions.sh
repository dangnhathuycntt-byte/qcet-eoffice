#!/usr/bin/env bash
set -euo pipefail

# Output directory
OUTPUT_DIR="/tmp/qcet-screenshots"
mkdir -p "$OUTPUT_DIR"

# Resolve Google Chrome executable
CHROME_BIN="${CHROME_BIN:-}"
if [ -z "$CHROME_BIN" ]; then
  if [ -x "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" ]; then
    CHROME_BIN="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  elif command -v google-chrome >/dev/null 2>&1; then
    CHROME_BIN="$(command -v google-chrome)"
  elif command -v chromium >/dev/null 2>&1; then
    CHROME_BIN="$(command -v chromium)"
  elif command -v chromium-browser >/dev/null 2>&1; then
    CHROME_BIN="$(command -v chromium-browser)"
  else
    echo "Error: Google Chrome / Chromium executable not found." >&2
    exit 1
  fi
fi

# Check server availability
SERVER_URL="http://localhost:3001"
if ! curl -s --connect-timeout 3 "$SERVER_URL" >/dev/null 2>&1; then
  echo "Error: Dev server is not responding at $SERVER_URL. Please ensure 'npm run dev -- -p 3001' is running." >&2
  exit 1
fi

echo "Using Chrome: $CHROME_BIN"
echo "Target directory: $OUTPUT_DIR"

capture_screenshot() {
  local url="$1"
  local width="$2"
  local height="$3"
  local output_file="$4"

  echo "Capturing $url (${width}x${height}) -> $output_file"
  "$CHROME_BIN" \
    --headless=new \
    --hide-scrollbars \
    --window-size="${width},${height}" \
    --virtual-time-budget=3000 \
    --screenshot="$output_file" \
    "$url" >/dev/null 2>&1

  if [ -f "$output_file" ]; then
    local size
    size="$(wc -c < "$output_file" | tr -d ' ')"
    echo "Successfully captured: $output_file ($size bytes)"
  else
    echo "Failed to generate: $output_file" >&2
    exit 1
  fi
}

# 1. Desktop Fold View - Dashboard
capture_screenshot \
  "http://localhost:3001/?zone=dashboard" \
  1440 1200 \
  "$OUTPUT_DIR/verified-desktop-fold.png"

# 2. Full Dashboard View
capture_screenshot \
  "http://localhost:3001/?zone=dashboard" \
  1440 2600 \
  "$OUTPUT_DIR/verified-full-dashboard.png"

# 3. Tasks Zone View
capture_screenshot \
  "http://localhost:3001/?zone=tasks" \
  1440 2200 \
  "$OUTPUT_DIR/verified-tasks-zone.png"

echo "All visual regression screenshots captured successfully in $OUTPUT_DIR."
