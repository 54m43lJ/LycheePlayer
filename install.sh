#!/bin/sh
# Lychee Player curl 安装脚本。
# 用法：
#   curl -fsSL https://raw.githubusercontent.com/54m43lJ/LycheePlayer/main/install.sh | sh
#   curl -fsSL https://raw.githubusercontent.com/54m43lJ/LycheePlayer/main/install.sh | sh -s -- --version 0.1.0
#   curl -fsSL https://raw.githubusercontent.com/54m43lJ/LycheePlayer/main/install.sh | sudo sh -s -- --system
#   ./install.sh --local dist/lychee-player-0.1.0-x86_64.tar.gz
set -eu

REPO="${LYCHEE_REPO:-54m43lJ/LycheePlayer}"
VERSION="preview"
PREFIX=""
SYSTEM=0
UNINSTALL=0
DRY_RUN=0
LOCAL_TARBALL=""
ARCH="x86_64"
DEPS_MODE="ask" # ask | yes | no

usage() {
  cat <<'EOF'
Lychee Player 安装脚本

  --version <ver>   选择 Release；默认 preview（预览版），稳定版传 v0.1.0
  --local <tarball> 从本地打包产物安装（需要同目录 .sha256；用于开发测试）
  --prefix <dir>    用户级安装目录
  --system          安装到 /opt/lychee-player（需要 root / sudo）
  --with-deps       安装运行期依赖（GTK / libsecret / NSS / ALSA / D-Bus）
  --no-deps         跳过运行期依赖安装
  --uninstall       删除程序、桌面文件与图标，保留设置与缓存
  --dry-run         只打印动作，不写盘、不等待输入
  -h, --help        显示帮助

依赖安装默认在客户端安装成功后执行；失败不会阻塞客户端安装。
EOF
}

while [ $# -gt 0 ]; do
  case "$1" in
    --version) VERSION="${2:?缺少版本号}"; shift 2 ;;
    --local) LOCAL_TARBALL="${2:?缺少 tarball 路径}"; shift 2 ;;
    --prefix) PREFIX="${2:?缺少目录}"; shift 2 ;;
    --system) SYSTEM=1; shift ;;
    --with-deps)
      if [ "$DEPS_MODE" = "no" ]; then echo "--with-deps 与 --no-deps 互斥。" >&2; exit 2; fi
      DEPS_MODE="yes"; shift ;;
    --no-deps)
      if [ "$DEPS_MODE" = "yes" ]; then echo "--with-deps 与 --no-deps 互斥。" >&2; exit 2; fi
      DEPS_MODE="no"; shift ;;
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
  if [ "$(id -u)" -ne 0 ] && [ "$DRY_RUN" -eq 0 ]; then
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

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

CACHE_BASE="${XDG_CACHE_HOME:-$HOME/.cache}/lychee-player/install"

# 安装包进入缓存前先写 .part，校验通过后原子改名，避免半截文件被复用。
fetch_to_cache() {
  url="$1"
  target="$2"
  mkdir -p "$(dirname "$target")"
  chmod 700 "$(dirname "$target")" 2>/dev/null || true
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] curl -fL --proto "=https" --tlsv1.2 -o "%s.part" "%s"\n' "$target" "$url"
    printf '[dry-run] move %s.part -> %s\n' "$target" "$target"
    return 0
  fi
  rm -f "$target.part"
  curl -fL --proto '=https' --tlsv1.2 -o "$target.part" "$url"
  mv "$target.part" "$target"
  chmod 600 "$target" 2>/dev/null || true
}

if [ -n "$LOCAL_TARBALL" ]; then
  if [ ! -f "$LOCAL_TARBALL" ]; then
    echo "找不到本地安装包：$LOCAL_TARBALL" >&2
    exit 1
  fi
  if [ ! -f "$LOCAL_TARBALL.sha256" ]; then
    echo "找不到校验和：$LOCAL_TARBALL.sha256" >&2
    exit 1
  fi
  ASSET="$(basename "$LOCAL_TARBALL")"
  INSTALL_VERSION="本地包"
  echo "使用本地安装包 $LOCAL_TARBALL"
  run cp "$LOCAL_TARBALL" "$TMP/$ASSET"
  run cp "$LOCAL_TARBALL.sha256" "$TMP/$ASSET.sha256"
else
  if [ "$VERSION" = "preview" ]; then
    TAG="preview"
    ASSET="lychee-player-preview-$ARCH.tar.gz"
    INSTALL_VERSION="预览版"
  elif [ "$VERSION" = "latest" ]; then
    # latest/download 不解析资产名，使用 GitHub API 定位实际稳定版。
    VERSION="$(curl -fsSL "https://api.github.com/repos/$REPO/releases/latest" | sed -n 's/.*"tag_name": *"\([^"]*\)".*/\1/p' | head -n1)"
    if [ -z "$VERSION" ]; then
      echo "无法确定最新稳定版；当前默认安装 preview，或使用 --version 指定。" >&2
      exit 1
    fi
    TAG="$VERSION"
    ASSET="lychee-player-${TAG#v}-$ARCH.tar.gz"
    INSTALL_VERSION="$TAG"
  else
    case "$VERSION" in
      v*) TAG="$VERSION" ;;
      *) TAG="v$VERSION" ;;
    esac
    ASSET="lychee-player-${TAG#v}-$ARCH.tar.gz"
    INSTALL_VERSION="$TAG"
  fi
  BASE="https://github.com/$REPO/releases/download/$TAG"
  CACHE_DIR="$CACHE_BASE/$TAG"
  CACHE_TAR="$CACHE_DIR/$ASSET"
  CACHE_SHA="$CACHE_DIR/$ASSET.sha256"

  echo "校验缓存 $CACHE_TAR"
  REMOTE_SHA=""
  if REMOTE_SHA="$(curl -fsSL --proto '=https' --tlsv1.2 "$BASE/$ASSET.sha256" 2>/dev/null)"; then
    if [ "$DRY_RUN" -eq 1 ]; then
      echo "[dry-run] 远端校验和可用；将比对本地缓存后决定是否下载"
    elif [ -f "$CACHE_TAR" ] && [ -n "$REMOTE_SHA" ]; then
      LOCAL_SHA="$(sha256sum "$CACHE_TAR" | awk '{print $1}')"
      WANT_SHA="$(printf '%s\n' "$REMOTE_SHA" | awk '{print $1}')"
      if [ "$LOCAL_SHA" = "$WANT_SHA" ]; then
        echo "缓存校验通过，跳过下载"
      else
        echo "缓存校验和不匹配，重新下载"
        rm -f "$CACHE_TAR"
        fetch_to_cache "$BASE/$ASSET" "$CACHE_TAR"
        printf '%s\n' "$REMOTE_SHA" > "$CACHE_SHA"
      fi
    else
      fetch_to_cache "$BASE/$ASSET" "$CACHE_TAR"
      printf '%s\n' "$REMOTE_SHA" > "$CACHE_SHA"
    fi
  else
    if [ "$DRY_RUN" -eq 1 ]; then
      echo "[dry-run] 远端校验和不可用"
    else
      echo "无法获取远端校验和；为避免使用过期缓存，已停止安装。" >&2
      echo "可稍后重试，或清理缓存目录：$CACHE_BASE" >&2
      exit 1
    fi
  fi

  if [ "$DRY_RUN" -eq 1 ] || [ -f "$CACHE_TAR" ]; then
    run cp "$CACHE_TAR" "$TMP/$ASSET"
    if [ -f "$CACHE_SHA" ]; then
      run cp "$CACHE_SHA" "$TMP/$ASSET.sha256"
    else
      printf '%s\n' "$REMOTE_SHA" > "$TMP/$ASSET.sha256"
    fi
  fi
fi

if [ "$DRY_RUN" -eq 0 ]; then
  ( cd "$TMP" && sha256sum -c "$ASSET.sha256" )
  run mkdir -p "$APP_DIR"
  run tar -xzf "$TMP/$ASSET" -C "$TMP"
  run cp -a "$TMP/lychee-player/." "$APP_DIR/"
fi

run mkdir -p "$(dirname "$BIN")" "$DESKTOP_DIR" "$ICON_DIR"
run ln -sf "$APP_DIR/lychee-player" "$BIN"
if [ "$DRY_RUN" -eq 0 ]; then
  # GUI 会话的 PATH 通常不包含 ~/.local/bin，桌面项必须使用绝对路径。
  awk -v bin="$BIN" '
    /^Exec=/ { print "Exec=\"" bin "\" %U"; next }
    /^TryExec=/ { print "TryExec=" bin; next }
    { print }
  ' "$APP_DIR/lychee-player.desktop" > "$TMP/lychee-player.desktop"
  run cp "$TMP/lychee-player.desktop" "$DESKTOP_DIR/lychee-player.desktop"
else
  printf '[dry-run] install desktop entry (Exec=%s %%U)\n' "$BIN"
fi
run cp "$APP_DIR/lychee-player.png" "$ICON_DIR/lychee-player.png"

if command -v update-desktop-database >/dev/null 2>&1; then
  run update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true
fi

echo "已安装 Lychee Player $INSTALL_VERSION 到 $APP_DIR"
echo "入口：$BIN"

# ---------- 运行期依赖 ----------
# 默认只处理 GTK / libsecret / NSS / ALSA / D-Bus；失败不阻塞客户端安装。
install_deps() {
  if ! command -v pacman >/dev/null 2>&1; then
    echo "未检测到 pacman，跳过运行期依赖安装（可参考 BUILD §1 手动安装）。"
    return 0
  fi
  PKGS="gtk3 libsecret nss alsa-lib dbus"
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '[dry-run] %s\n' "sudo pacman -S --needed $PKGS"
    return 0
  fi
  if [ "$(id -u)" -eq 0 ]; then
    pacman -S --needed --noconfirm $PKGS || echo "运行期依赖安装失败，可能影响启动，但不影响客户端本体。" >&2
  elif command -v sudo >/dev/null 2>&1; then
    sudo pacman -S --needed --noconfirm $PKGS || echo "运行期依赖安装失败，可能影响启动，但不影响客户端本体。" >&2
  else
    echo "缺少 root / sudo，跳过运行期依赖安装；可参考 BUILD §1 手动安装。" >&2
  fi
}

if [ "$DRY_RUN" -eq 1 ]; then
  case "$DEPS_MODE" in
    yes) install_deps ;;
    no) echo "[dry-run] 跳过运行期依赖安装（--no-deps）" ;;
    *)
      if [ -t 0 ]; then
        echo "[dry-run] 将询问：安装运行期依赖？[Y/n]（默认 Y）"
      else
        echo "[dry-run] 非交互且未给依赖参数：默认跳过运行期依赖"
      fi
      ;;
  esac
else
  case "$DEPS_MODE" in
    yes) install_deps ;;
    no) echo "已按 --no-deps 跳过运行期依赖安装。" ;;
    *)
      if [ -t 0 ]; then
        printf '安装运行期依赖（GTK / libsecret / NSS / ALSA / D-Bus）？[Y/n] '
        read -r answer || answer=""
        case "$answer" in
          ""|y|Y|yes|YES|Yes) install_deps ;;
          *) echo "已跳过运行期依赖安装。" ;;
        esac
      else
        echo "非交互环境且未给依赖参数，已跳过运行期依赖安装。"
        echo "如需安装，请重新运行：./install.sh --with-deps"
        echo "或先下载脚本再执行：curl -fsSL <install.sh> -o install.sh && sh install.sh"
      fi
      ;;
  esac
fi
