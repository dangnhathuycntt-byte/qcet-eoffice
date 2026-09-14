#!/bin/bash
set -e

echo "=== CÀI ĐẶT & CẤU HÌNH BROWSER-USE MCP CHO CLAUDE DESKTOP ==="

# 1. Kiểm tra uv / uvx
UVX_PATH=$(which uvx 2>/dev/null || true)
if [ -z "$UVX_PATH" ]; then
    if [ -f "$HOME/.local/bin/uvx" ]; then
        UVX_PATH="$HOME/.local/bin/uvx"
    elif [ -f "/opt/homebrew/bin/uvx" ]; then
        UVX_PATH="/opt/homebrew/bin/uvx"
    fi
fi

if [ -z "$UVX_PATH" ]; then
    echo ">> Chưa tìm thấy 'uv'. Đang tiến hành cài đặt uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
    UVX_PATH="$HOME/.local/bin/uvx"
fi

echo ">> Đã xác định uvx tại: $UVX_PATH"

# 2. Cài đặt Playwright Chromium
echo ">> Đang chuẩn bị trình duyệt Chromium cho Playwright..."
"$UVX_PATH" --from 'browser-use[cli]' playwright install chromium || true

# 3. Đường dẫn cấu hình Claude Desktop
CONFIG_DIR="$HOME/Library/Application Support/Claude"
CONFIG_FILE="$CONFIG_DIR/claude_desktop_config.json"
mkdir -p "$CONFIG_DIR"

# 4. Hướng dẫn hoặc cập nhật cấu hình bằng Python
python3 - <<EOF
import json
import os

config_file = os.path.expanduser("~/Library/Application Support/Claude/claude_desktop_config.json")
uvx_path = "$UVX_PATH"

data = {"mcpServers": {}}
if os.path.exists(config_file):
    try:
        with open(config_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            if "mcpServers" not in data:
                data["mcpServers"] = {}
    except Exception as e:
        print(f"Lưu ý: Không thể đọc file cấu hình cũ, tạo mới cấu hình ({e})")

# Giữ nguyên các MCP khác nếu có, cập nhật hoặc thêm browser-use
existing_env = data["mcpServers"].get("browser-use", {}).get("env", {})
openai_key = existing_env.get("OPENAI_API_KEY") or os.environ.get("OPENAI_API_KEY", "")

data["mcpServers"]["browser-use"] = {
    "command": uvx_path,
    "args": [
        "--from",
        "browser-use[cli]",
        "browser-use",
        "--mcp"
    ],
    "env": {
        "OPENAI_API_KEY": openai_key or "YOUR_OPENAI_API_KEY_HERE",
        "BROWSER_USE_HEADLESS": "false"
    }
}

with open(config_file, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print(f">> Đã cập nhật thành công file: {config_file}")
EOF

echo ""
echo "=== HOÀN TẤT ==="
echo "1. Mở file: ~/Library/Application Support/Claude/claude_desktop_config.json"
echo "   Điền API Key của bạn vào mục OPENAI_API_KEY (hoặc ANTHROPIC_API_KEY nếu dùng Claude API)."
echo "2. Khởi động lại ứng dụng Claude Desktop (Cmd + Q rồi mở lại)."
