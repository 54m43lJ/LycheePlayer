# POC 验证记录（poc/attempt-1）

> 本文件只服务于 POC 分支，不作为设计事实源。设计契约见 ARCHITECTURE.html / CODE.html；实现细节与上游端点清单见 IMPLEMENTATION.md；待拍板事项见 PENDING.md。

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
- 登录：嵌入 QQ 官方 xlogin 扫码组件（默认）、实验性应用内二维码、Cookie 兜底验证、退出登录。
- 会话：保存完整凭证（含 `refresh_token`），每 30 分钟检查、到期前自动续期。
- 凭证：主进程内 `safeStorage` 加密落盘，不跨 IPC。
- 设置：默认音质、关闭到托盘、凭证到期时间与手动续期。
- 集成：MPRIS（播放状态 / 元数据 / 反向控制）、系统托盘。

不在 POC 范围：数字专辑购买、MV、下载、全局快捷键、逐字歌词、歌单增删改、打包分发、自动更新。

## 2. 如何运行
要求：Node.js ≥ 22.12，Linux 桌面会话（X11 / Wayland 均可）。

- 主窗口最小尺寸为 280×440；主断点 900px（宽/窄模式），额外 560px 超窄断点。
- Wayland 会话下默认使用 Wayland（`--ozone-platform=wayland` + Wayland IME）；无 `WAYLAND_DISPLAY` 时回退 X11。
- 可用 `QQY_OZONE_PLATFORM=x11` 或命令行 `--ozone-platform=x11` 强制 X11；`npm run dev` / `npm start` 同时设置 `ELECTRON_OZONE_PLATFORM_HINT=auto` 作为兜底。

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
- 官方扫码组件：窗口只加载 `xui.ptlogin2.qq.com/cgi-bin/xlogin`（与官方 Linux 客户端一致），不加载完整 y.qq.com；二维码 111×111。扫码确认后组件在 `graph.qq.com/oauth2.0/login_jump` 写入 `p_skey`，应用读取该 Cookie 完成 OAuth authorize + `QQLogin`。已实际完成登录、写入凭证，并在重启后保持登录态。
- 应用内二维码（实验）：`createQrKey` 生成与轮询可用，但当前账号/IP 的 `check_sig` 返回 `p_skey_forbid`，因此不作为默认登录路径。
- 会话续期：`keyExpiresIn = 259200`（72 小时）；`login.refreshSession()` 使用 `refresh_token` 调用 `music.login.LoginServer/Login` 成功，新 musickey 写入后到期时间向后延长 72 小时。
- 非法 Cookie：返回 `AUTH_EXPIRED`，不写入凭证。
- 登录账号下的“我的歌单”：成功载入 24 个歌单。
- VIP 歌曲《晴天》：320k 与 FLAC 均播放成功，音质切换后进度继续推进。
- 窄屏：在 900px 统一断点收为 64px 图标栏；560px 以下播放器改为双行、侧栏 56px。
- 音量条：宽屏 56–84px 自适应；≤900px 点击音量图标弹出竖直滑块；实测 280×440 / 320×480 / 680×540 / 900×650 / 1280×820 均无横向溢出。
- 主题：深色 / 浅色调色板切换并持久化；`data-theme` 驱动 CSS token，`settings.theme` 为事实源。
- 歌词：`-1901` 视为无歌词，纯音乐仍显示“这首歌还没有歌词”而非加载失败；活动行保持原字号与固定行高，不再文字重叠。
- Wayland 启动：不额外传 `--ozone-platform` 启动，进程参数自动包含 `--ozone-platform=wayland`，并启用 Wayland IME；`QQY_OZONE_PLATFORM=x11` 可强制回退 X11。
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
7. **官方 Linux 客户端的登录组件**：缓存中的入口是 `xui.ptlogin2.qq.com/cgi-bin/xlogin?...appid=716027609...s_url=graph.qq.com/oauth2.0/login_jump...`。它只加载扫码窗口；扫码完成后 `login_jump` 会写入 `p_skey`，随后需要客户端自己调用 OAuth authorize 换 `code`，再调 `QQConnectLogin.LoginServer/QQLogin`。
8. **原生 check_sig 与官方组件差异**：直接构造 check_sig 在当前网络返回 `p_skey_forbid`；官方 xlogin 组件走完整浏览器流程后能正常写入 `p_skey`，因此默认登录改用前者。
9. **会话时长**：`QQLogin` 返回的 `keyExpiresIn` 为 259200 秒（72 小时）；`refresh_token` 可续期。官方客户端 24 小时内掉线更像是没有主动续期，而不是 key 本身只有 24 小时。
10. **续期接口**：`QQConnectLogin.LoginServer/QQLogin` 的简单续期（`musics.fcg` + MD5 / zzc sign）实测不可用（2000 / 10006）；正确路径是 `music.login.LoginServer/Login` + `loginMode=2` + `refresh_token`，实测返回新 musickey。

## 5. 与设计文档的差异

| 差异 | 原因 | 文档状态 |
| --- | --- | --- |
| `login.createQrKey()` 返回 `QrSession`（二维码 data URL + 过期时间） | 渲染进程必须拿到图片才能显示二维码；原接口只返回 `null` | 已更新 ARCHITECTURE §4.1 / §4.2、CODE §3.11 |
| 新增 `login.getStatus()`、`login.loginWithCookie()` | 启动时恢复登录态；Cookie 是 PENDING #4 的兜底入口 | 已更新 ARCHITECTURE §4.1 / §4.2 |
| 新增 `login.openWebLogin()` | QQ 网页登录可能返回 `p_skey_forbid` 风控；改为嵌入官方 xlogin 扫码组件，扫码后读取 `p_skey` 完成换证 | 已更新 ARCHITECTURE §3.2 / §4.1 |
| 新增 `login.refreshSession()`、`AuthStatus` 到期字段 | 官方客户端 24h 内掉线；用 `refresh_token` 主动续期，并在设置页显示到期时间 | 已更新 ARCHITECTURE §2 / §4.1 / §4.2 |
| `Settings.theme` + palette token 切换 | 统一深/浅色调色板，持久化到设置文件 | 已更新 ARCHITECTURE §4.3 |
| `QrStatus` 增加 `failed` 阶段与 `message` | 扫码确认后换证失败时需要向用户展示具体原因，而不是静默过期 | 已更新 ARCHITECTURE §3.2 / §4.2 |
| 播放链接拼接改为复用 `purl` | `vkey` 与查询串绑定，重建会 403 | 已更新 ARCHITECTURE §1 / §4.3、CODE §3.7 |
| 托盘 `initTray(actions)` 需要回调 | 托盘菜单要控制播放器与退出 | 已更新 CODE §3.13 |
| `closeToTray` 默认 `false` | PENDING #6 未拍板，POC 取保守值 | PENDING 保留 |
| 凭证用 `safeStorage` 加密文件 | 不引入 keytar / libsecret 原生依赖，先验证边界 | POC 限制，最终方案待定 |
| MPRIS / 托盘提前实现 | 验证 Linux 桌面集成的核心卖点 | README 路线图仍将 MPRIS 完整实现列为进阶 |
| 新增 renderer stores `auth/settings/ui` 与 `shared/` 类型 | 支撑多页面状态与单一类型契约 | 已更新 CODE §1 |

## 6. POC 已知限制

- 原生应用内二维码在当前网络环境仍会触发 `p_skey_forbid`；默认登录使用官方 xlogin 组件，已实际完成登录并持久化，因此该风控不阻塞日常使用。
- 手动粘贴 Cookie 的成功路径未单独验证；官方组件走 OAuth code 换证，不复用 Cookie 校验入口。
- 官方组件扫码后的 `p_skey` → authorize → `QQLogin` 已手动实测成功；自动读取 `login_jump` Cookie 的轮询逻辑已实现，建议再走一次完整扫码确认。
- 续期已实测一次成功，但 72 小时长周期观察、应用长时间关闭后首次启动续期仍需持续验证。
- 数字专辑与无版权歌曲的不可播提示未专门验证；VIP 歌曲的 320k / FLAC 已验证。
- 桌面歌词、逐字歌词、MV、下载、全局快捷键未实现。
- 未配置 electron-builder，未生成 deb / rpm / AppImage。
- 托盘在无 StatusNotifier 的极简桌面环境中可能不可见。
- 上游限流与接口变更仍是最大外部风险；`npm run probe` 可作为回归哨兵。

## 7. 下一步建议

1. 观察 72 小时以上：确认自动续期能在应用常驻与重启两种情况下保持登录态；若 refresh_token 过期，验证 UI 的重新登录引导。
2. 在另一网络/账号回归原生扫码 `p_skey` 成功路径，并验证数字专辑的不可播提示与手动 Cookie 粘贴。
3. 拍板 PENDING #2（许可证）、#5（默认音质与降档提示）、#6（关闭行为）、#7（应用名）。
4. 引入 electron-builder 与 CI 双架构构建，补 BUILD.html。
5. 为 `api/` 层加 fixture 回放测试，降低上游变更导致的回归成本。
6. 评估把 `mpris-service`（dbus-next）替换为更活跃的维护分支，或直接使用 `dbus-next`。
