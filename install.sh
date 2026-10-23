#!/bin/sh
# Lychee Player curl 安装脚本。
# 用法：
#   curl -fsSL .../install.sh | sh
#   curl -fsSL .../install.sh | sh -s -- --version 0.1.0
#   curl -fsSL .../install.sh | sudo sh -s -- --system
set -eu

REPO="${LYCHEE_REPO:-lychee-player/lychee-player}"
VERSION="latest"
PREFIX=""
SYSTEM=0
UNINSTALL=0
DRY_RUN=0
ARCH="x86_64"

usage() {
  cat <<'EOF'
Lychee Player 安装脚本

  --version <ver>   选择 GitHub Release 版本；默认最新
  --prefix <dir>    用户级安装目录
  --system          安装到 /opt/lychee-player（需要 root / sudo）
  --uninstall       删除程序、桌面文件与图标，保留设置与缓存
  --dry-run         只打印动作，不写盘
  -h, --help        显示帮助
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="${2:?缺少版本号}"; shift 2 ;;
    --prefix) PREFIX="${2:?缺少目录}"; shift 2 ;;
    --system) SYSTEM=1; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "未知参数：$1" >&2; usage >&2; exit 2 ;;
  esac
done

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] %s\n' "$*"
  else
    "$@"
  fi
}

if [ "$SYSTEM" -eq 1 ]; then
  if [ "$(id -u)" -ne 0 ]; then
    echo "--system 需要 root / sudo 权限。" >&2
    exit 1
  fi
  APP_DIR="/opt/lychee-player"
  BIN="/usr/bin/lychee-player"
  DESKTOP_DIR="/usr/share/applications"
  ICON_DIR="/usr/share/icons/hicolor/256x256/apps"
else
  DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
  APP_DIR="${PREFIX:-$DATA_HOME/lychee-player}"
  BIN="$HOME/.local/bin/lychee-player"
  DESKTOP_DIR="$DATA_HOME/applications"
  ICON_DIR="$DATA_HOME/icons/hicolor/256x256/apps"
fi

if [ "$UNINSTALL" -eq 1 ]; then
  run rm -rf "$APP_DIR"
  run rm -f "$BIN"
  run rm -f "$DESKTOP_DIR/lychee-player.desktop"
  run rm -f "$ICON_DIR/lychee-player.png"
  echo "已卸载 Lychee Player（设置与缓存保留）。"
  exit 0
fi

if [ "$VERSION" = "latest" ]; then
  BASE="https://github.com/$REPO/releases/latest/download"
else
  BASE="https://github.com/$REPO/releases/download/$VERSION"
fi
ASSET="lychee-player-$VERSION-$ARCH.tar.gz"
if [ "$VERSION" = "latest" ]; then
  ASSET="lychee-player-latest-$ARCH.tar.gz"
  # latest/download 不解析资产名，使用 GitHub API 定位实际版本。
  VERSION="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n1)"
  if [ -z "$VERSION" ]; then
    echo "无法确定最新版本，请使用 --version 指定。" >&2
    exit 1
  fi
  BASE="https://github.com/$REPO/releases/download/$VERSION"
  ASSET="lychee-player-${VERSION#v}-$ARCH.tar.gz"
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "下载 $ASSET"
run curl -fL --proto '=https' --tlsv1.2 -o "$TMP/$ASSET" "$BASE/$ASSET"
run curl -fL --proto '=https' --tlsv1.2 -o "$TMP/$ASSET.sha256" "$BASE/$ASSET.sha256"

if [ "$DRY_RUN" -eq 0 ]; then
  ( cd "$TMP" && sha256sum -c "$ASSET.sha256" )
  run mkdir -p "$APP_DIR"
  run tar -xzf "$TMP/$ASSET" -C "$TMP"
  run cp -a "$TMP/lychee-player/." "$APP_DIR/"
fi

run mkdir -p "$(dirname "$BIN")" "$DESKTOP_DIR" "$ICON_DIR"
if [ "$SYSTEM" -eq 1 ]; then
  run ln -sf "$APP_DIR/lychee-player" "$BIN"
else
  run ln -sf "$APP_DIR/lychee-player" "$BIN"
fi
run cp "$APP_DIR/lychee-player.desktop" "$DESKTOP_DIR/lychee-player.desktop"
run cp "$APP_DIR/lychee-player.png" "$ICON_DIR/lychee-player.png"

if command -v update-desktop-database >/dev/null 2>&1; then
  run update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
fi

echo "已安装 Lychee Player $VERSION 到 $APP_DIR"
echo "入口：$BIN"
