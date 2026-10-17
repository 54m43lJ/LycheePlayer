# POC 验证记录（poc/attempt-1）

> 本文件只服务于 POC 分支，不作为设计事实源。设计契约见 ARCHITECTURE.html / CODE.html；待拍板事项见 PENDING.md。

## 1. 目标与范围

验证 qqy 设计中最不确定的三件事：

1. QQ 音乐公开接口能否在不绕过授权的前提下，完成搜索、歌单、歌词、播放链接获取。
2. Electron 主进程 / preload / Vue 渲染进程的边界是否足够支撑 MVP。
3. MPRIS、托盘、凭证存储等 Linux 集成是否能在当前桌面环境落地。

POC 实现了 README 路线图中的 MVP 主链路，并提前验证了 MPRIS / 托盘：

- 搜索：单曲、歌手、专辑、歌单，分页。
- 播放：HTML5 Audio、播放队列、上一首 / 下一首、进度、音量、播放模式。
- 歌词：LRC + 翻译合并、滚动高亮、点击跳转。
- 歌单：公开歌单详情与全部歌曲、我的歌单（登录后）。
- 登录：手机 QQ 扫码（二维码生成、状态轮询）、Cookie 兜底验证、退出登录。
- 凭证：主进程内 `safeStorage` 加密落盘，不跨 IPC。
- 设置：默认音质、关闭到托盘。
- 集成：MPRIS（播放状态 / 元数据 / 反向控制）、系统托盘。

不在 POC 范围：扫码确认后的真实登录、VIP / 数字专辑权限验证、MV、下载、全局快捷键、逐字歌词、
歌单增删改、打包分发、自动更新。扫码登录的 `createQrKey` 与轮询已验证，但“手机确认后换取凭证”
需要真实账号才能端到端验证。

## 2. 如何运行

要求：Node.js ≥ 22.12，Linux 桌面会话（X11 / Wayland 均可）。窗口最小尺寸为 680×540；更窄时侧栏自动收为图标栏、登录与设置改为单列。

```bash
npm install
npm run dev          # electron-vite 开发模式
npm run probe        # 不启动界面，直接探测上游接口
npm run typecheck    # 主进程 + 渲染进程类型检查
npm run build        # 类型检查并产出 out/
npm start            # 预览生产构建
```

数据目录：`~/.config/qqy/`

- `settings.json`：界面设置。
- `credential.bin`：经 `safeStorage` 加密的凭证；Linux 无可用密钥环时退化为本机可读的 base64（POC 限制）。

## 3. 验证结果

### 3.1 上游探针

```text
PASS  search  「数鸭子」 001ziBbM4Nab6D
PASS  song detail  media_mid=002l16wc3s108k
PASS  stream 128k  200 1782384 bytes ID3
PASS  quality gate  320k 被上游拒绝（免费账号预期行为）
PASS  lyric  48 行
PASS  playlist  百听不厌的周杰伦 · 5 首（首页）
PASS  qr image  PNG 445 bytes
PASS  qr poll  status=66（66=待扫码）
```

### 3.2 界面链路（Electron + CDP 实测）

- 搜索「五月天」：20 条单曲，封面全部加载。
- 双击匿名可播歌曲「盛夏光年」：进度从 0:05 推进到 0:08，播放 / 暂停状态正确。
- 歌词：39 行，当前行高亮，随播放推进。
- 歌单 `7039749142`：99 首全部载入，封面正常。
- 扫码：二维码 111×111 PNG，轮询返回 66（待扫码）。
- 非法 Cookie：返回 `AUTH_EXPIRED`，不写入凭证。
- 窄屏 680×540：侧栏收为 64px 图标栏，搜索/设置/登录单列显示，无横向溢出；登录页内容可纵向滚动。
- MPRIS：`playerctl -p qqy status` 返回 `Playing`，元数据包含标题 / 专辑 / 封面；
  `playerctl -p qqy pause/play` 能反向控制播放器。
- 类型检查与生产构建通过，运行时控制台无应用错误。

## 4. 上游行为发现（已回写 ARCHITECTURE）

1. **播放链接不能按模板重建**：`vkey` 与 `purl` 的完整查询串绑定，重写 `guid` / `fromtag` 等参数会返回 403。
   正确做法是 `https://ws.stream.qqmusic.qq.com/` + 上游返回的 `purl`，查询参数原样保留。
   ARCHITECTURE §4.3 已更新。
2. **搜索接口不要带 `comm`**：`DoSearchForQQMusicDesktop` 带 `comm` 时偶发返回空列表；不带 `comm`
   正常。客户端对空结果增加一次重试以区分瞬时异常。
3. **封面尺寸**：`T002R100x100M000{mid}.jpg` 返回空文件，`T002R300x300M000{mid}.jpg` 正常。
   UI 统一使用 300×300。
4. **`pay.pay_play === 0` 不等于匿名可播**：部分付费单曲仍会在 vkey 阶段返回 `104003`。
   权限最终以 vkey 结果为准；`PayInfo` 只用于 UI 角标。映射规则已写入 ARCHITECTURE §4.3。
5. **瞬时错误 2001**：上游偶发返回 `req_0.code = 2001`，客户端做 3 次短退避重试。
6. **二维码图片很小**：QQ 登录二维码是 1-bit 111×111 PNG（约 440 字节），不能按文件大小判断有效性。

## 5. 与设计文档的差异

| 差异 | 原因 | 文档状态 |
| --- | --- | --- |
| `login.createQrKey()` 返回 `QrSession`（二维码 data URL + 过期时间） | 渲染进程必须拿到图片才能显示二维码；原接口只返回 `null` | 已更新 ARCHITECTURE §4.1 / §4.2、CODE §3.11 |
| 新增 `login.getStatus()`、`login.loginWithCookie()` | 启动时恢复登录态；Cookie 是 PENDING #4 的兜底入口 | 已更新 ARCHITECTURE §4.1 / §4.2 |
| `QrStatus` 增加 `failed` 阶段与 `message` | 扫码确认后换证失败时需要向用户展示具体原因，而不是静默过期 | 已更新 ARCHITECTURE §3.2 / §4.2 |
| 播放链接拼接改为复用 `purl` | `vkey` 与查询串绑定，重建会 403 | 已更新 ARCHITECTURE §1 / §4.3、CODE §3.7 |
| 托盘 `initTray(actions)` 需要回调 | 托盘菜单要控制播放器与退出 | 已更新 CODE §3.13 |
| `closeToTray` 默认 `false` | PENDING #6 未拍板，POC 取保守值 | PENDING 保留 |
| 凭证用 `safeStorage` 加密文件 | 不引入 keytar / libsecret 原生依赖，先验证边界 | POC 限制，最终方案待定 |
| MPRIS / 托盘提前实现 | 验证 Linux 桌面集成的核心卖点 | README 路线图仍将 MPRIS 完整实现列为进阶 |
| 新增 renderer stores `auth/settings/ui` 与 `shared/` 类型 | 支撑多页面状态与单一类型契约 | 已更新 CODE §1 |

## 6. POC 已知限制

- 扫码登录只验证到“等待扫码”；授权换证链路已按公开实现对齐（优先直接访问 `ptqrlogin` 回调地址，失败再用回调中的 `uin` / `ptsigx` 重建 `check_sig`；`QQLogin` 使用 POST + `req` 信封），但仍需要真实账号回归。失败原因会显示在二维码遮罩上，并保留 Cookie 兜底入口。
- Cookie 登录只验证了非法 Cookie 的拒绝路径，未用真实账号验证成功路径。
- VIP / FLAC / 数字专辑的权限与降档提示未用付费账号验证。
- 我的歌单接口需要登录，POC 未做真实账号联调，字段映射采用防御式别名。
- 桌面歌词、逐字歌词、MV、下载、全局快捷键未实现。
- 未配置 electron-builder，未生成 deb / rpm / AppImage。
- 托盘在无 StatusNotifier 的极简桌面环境中可能不可见。
- 上游限流与接口变更仍是最大外部风险；`npm run probe` 可作为回归哨兵。

## 7. 下一步建议

1. 用真实账号跑通扫码授权、Cookie 登录、VIP 320k / FLAC、我的歌单。
2. 拍板 PENDING #2（许可证）、#5（默认音质与降档提示）、#6（关闭行为）、#7（应用名）。
3. 引入 electron-builder 与 CI 双架构构建，补 BUILD.html。
4. 为 `api/` 层加 fixture 回放测试，降低上游变更导致的回归成本。
5. 评估把 `mpris-service`（dbus-next）替换为更活跃的维护分支，或直接使用 `dbus-next`。
