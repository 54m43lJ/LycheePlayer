# 文档审计报告 — Lychee Player

- 审计对象：`README.html`、`USER.html`、`CORE.html`、`PROVIDER.html`、`TODO.md`、`GUIDELINES.md`、`diagram/*`、`style.css`
- 文档分支：`docs/evol-1` @ `8dd3f38`
- 参考实现：`dev/evol-1` @ `7d306f2`（并用 `main` @ `c9b58a6` 交叉核对）
- 审计日期：2026-10-19（行号以审计时的文件为准，后续编辑可能使行号偏移）
- 说明：文档分支不含 `src/`；本文中“与实现不符”均以 `dev/evol-1` 为参考。若文档描述的是目标状态而非当前实现，请按“需确认”一节的条目调整措辞。
- 本文是审计工作文档，不是 GUIDELINES 定义的五类项目文档之一，因此使用 Markdown 便于评审；不改变现有文档的分发结构。

## 结论摘要

| 类别 | 确认问题 | 已解决 | 其中高优先级 |
|---|---:|---:|---:|
| A. 自相矛盾 / 结构性错误 | 8 | 8 | 3 |
| B. 重复（违反单一事实源） | 6 组 | 6 | 0 |
| C. 与参考实现不符 / 疑似事实错误 | 14 | 14 | 3 |
| D. 违反 GUIDELINES 形式要求 | 7 | 7 | 3 |
| E. 拿不准 / 需确认 | 10 组 | 8 组已处理 | — |

### 修复状态

| ID | 状态 | 说明 |
|---|---|---|
| A1 | 已解决（2026-10-19） | 队列设计决策以 TODO 为第一权威；用户可见规则在 USER，内部实现细节在 CORE；USER/CORE 自包含，正文不引用 TODO；README 已简化。 |
| A2 | 已解决（2026-10-19） | 删除“token 名一一对应”；新增语义变量映射表；明确 dark/light 各自取色；修正 light 的 `--accent-strong`、`--accent-soft`、`--on-accent` 取值。 |
| A3 | 已解决（2026-10-20） | 经源码确认 MPRIS 事件分别注册；CORE §5.6 改为实际事件树（`onCommand` 回调），`raise` 拆分 show/focus，公共下发独立为 §5.6.1。与调用树重复的映射表已删除。GUIDELINES 增加调用栈格式规则。 |
| A4 | 已解决（2026-10-21） | CORE §5.7 只描述“有到期时间 / 无到期时间”两种续期条件与处理策略，不再写条件表达式。 |
| A5 | 已解决（2026-10-21） | USER §5.2.6 的“整页只有登录组件”加上“未登录时”，与已登录状态不再冲突。 |
| A6 | 已解决（2026-10-21） | PROVIDER §1 拆为 OAuth `g_tk`（`p_skey`）与资料 `g_tk`（`musickey`）；歌词固定 `g_tk=5381` 写入注记。 |
| A7 | 已解决（2026-10-21） | PROVIDER §4.2 将 `2001` / `104604`（瞬时繁忙，重试）与 `100001`（限流，不重试）拆成两行；以代码为准，`100001` 不重试。 |
| A8 | 已解决（2026-10-21） | CORE §4.16 按代码改为：`setEmbedBounds` 创建/定位/首次加载 `WebContentsView`；`openWebLogin` 只启动登录流程。 |
| B1 | 已解决（2026-10-21） | 凭证/密钥环规则以 USER §2（用户边界）与 PROVIDER §2（存储）为权威；README、USER 术语/图注、CORE §2/§5.4 改为链接或一句话摘要。 |
| B2 | 已解决（2026-10-21） | 音质降档链以 PROVIDER §2 为唯一权威；USER §2 只保留用户可见结果，CORE §4.11 改为链接。 |
| B3 | 已解决（2026-10-21） | “路由切换关闭歌词面板”以 USER §2 为权威；README 删除该句，USER §5.2.5 与 CORE §4.22 改为链接。 |
| B4 | 已解决（2026-10-21） | 音频流加载边界以 USER §3.1 为权威；CORE §5.5 与 PROVIDER §3.3/§4.1 改为链接。 |
| B5 | 已解决（2026-10-21） | 上游隔离规则保留在 CORE §2；PROVIDER §2 改为链接。 |
| B6 | 已解决（2026-10-19） | TODO 统一使用“播放队列”；实现细节移入 CORE，不写入 TODO；正文不引用 TODO。 |

机械检查结果：4 个 HTML 的本地链接与锚点全部有效；`<pre><code>` 中没有发现未转义的 `<`/`&`；6 个 PlantUML 源与 6 个 SVG 文本节点逐项一致；所有 `diagram/*.svg` 均被对应文档引用；未发现 Mermaid 或 ASCII 图（CORE 文件树除外，属 GUIDELINES 要求的形式）。

---

## A. 自相矛盾 / 结构性错误（确认）

### A1 [高][已解决] 播放队列“替换 / 追加”语义冲突

- 解决（2026-10-19）：
  - USER §1 将“播放队列”定义为当前歌曲之后、按播放顺序等待播放的歌曲；当前歌曲不属于队列。
  - 双击、“播放全部”、单曲播放（点击非当前歌曲行的播放按钮）都替换队列；“下一首播放”插入队列头；队列不提供队尾插入。
  - USER §5.2.3/§5.2.9 增加播放队列入口与可视面板；README 只保留基础播放操作；队列设计决策以 TODO 为第一权威，用户可见规则在 USER，内部实现细节在 CORE；USER/CORE 自包含，正文不引用 TODO；CORE 的 `playSong` 改为 `playNext`。
- 以下为审计时的问题记录（已按上述决策处理）：
- 位置：`USER.html` §1（L42）、§3.3（L145）、§5.2.4（L299）；`README.html` §2（L63、L73）。
- 冲突：
  - §1 与 §3.3：双击或“播放全部”替换队列；**单曲播放追加到队尾**。
  - §5.2.4：双击行播放并**替换队列**。
  - 文档没有定义“单曲播放”和“双击播放”的区别，也没有给出“追加”的界面入口。
- 参考实现：`SearchView.vue:85-86` 的 `playSongAt` 与 `SongTable.vue` 的播放按钮都调用 `player.playList`（替换队列）；`player.playSong`（追加）只有定义和导出，没有调用点（`stores/player.ts:153-167`）。
- 建议：在 USER §1 只保留一套权威队列语义。若确实需要“追加”，补充触发入口，并在 CORE §5.5 增加 `playSong` 调用路径；否则删除“追加到队尾”的表述。

### A2 [高][已解决] 调色板“token 名一一对应”与实际 token / 映射不符

- 解决（2026-10-19）：删除“token 名一一对应”，改为按语义角色映射；新增“语义变量映射”表，明确 dark/light 各自从本主题调色盘取色，不得跨主题取色或使用盘外字面量。
- light 的修正：`--accent-strong` 取 `purple`，`--accent-soft` 取 `purple-light`，`--on-accent` 取 `highlight`（不再直接写白色）。参考实现 `src/renderer/styles/main.css:84` 仍是 `--on-accent: #ffffff`，代码需按本文档同步。
- 以下为审计时的问题记录（已按上述决策处理）：
- 位置：`USER.html` §5.1（L169、L183、L197、L202）。
- 冲突：
  - L169 称“深色与浅色的 token 名一一对应”，但 dark 使用 `cream`（L183），light 使用 `highlight`（L197），名称并不一一对应。
  - L202 将 `purple-light` 映射为 `--accent-strong`。参考实现中 dark 才是 `purple-light → --accent-strong`（`src/renderer/styles/main.css:23`），light 的 `--accent-strong` 实际是 `purple`（`main.css:83`），`purple-light` 用于 `--accent-soft`（`main.css:85`）。
- 建议：把“名称一一对应”改为“角色对应、名称可不同”；按 dark/light 分别列出映射，并补上 `cream` / `highlight` 的映射。

### A3 [高][已解决] CORE §5.6 的调用树把 `sendPlayerCommand` 链挂在 `quit` 下

- 解决（2026-10-20）：经源码确认，MPRIS 按事件分别注册监听（`src/main/integration/mpris.ts:44-65`），不存在单一 `player.on(command)` 入口。CORE §5.6 改为实际事件树：事件监听器用绑定语句表示，监听器内部的 `onCommand` / `app.quit()` / 窗口调用作为子调用；`raise` 拆成 getAllWindows / restore / show / focus；公共下发独立为 §5.6.1。映射表与调用树重复，且表不是调用栈，按 GUIDELINES §5 删除表、保留树。GUIDELINES 增加“事件监听器以绑定语句表示、监听器内部调用作为子调用”及一行一个调用/共享下游独立成根的规则。
- 以下为审计时的问题记录（已按上述决策处理）：
- 位置：`CORE.html` §5.6（L959–L971）。
- 冲突：树中 `ipc::sendPlayerCommand(command) → webContents.send(...) → handleCommand(...)` 被缩进为 `player.on('quit') → app::quit()` 的子节点，暗示只有 quit 会发送播放命令；但同一块前几行已经显示 play/pause/next/previous 也会调用 `sendPlayerCommand`。
- 参考实现：`src/main/integration/mpris.ts:44-65` 中每个事件都调用 `onCommand`；`quit` 只调用 `app.quit()`（L65），不会发送 `player:command`。
- 建议：把 `sendPlayerCommand` 展开链提为独立根节点或单独代码块；`quit` 只保留 `app.quit()`。

### A4 [中][已解决] 续期条件把“无到期时间”的 6 小时回退写成了通用条件

- 解决（2026-10-21）：CORE §5.7 只列“凭证有到期时间 / 无到期时间”两种条件和处理策略，不再写条件表达式。
- 以下为审计时的问题记录（已按上述决策处理）：
- 位置：`CORE.html` §5.7（L977）；`CORE.html` §4.15（`SESSION_REFRESH_AHEAD_MS` / `SESSION_REFRESH_FALLBACK_MS`）。
- 冲突：§4.15 明确 `SESSION_REFRESH_FALLBACK_MS` 是“凭证无到期时间时的续期间隔”；§5.7 却写成“到期前 10 分钟**或**距上次续期 ≥ 6 小时”，看起来对所有凭证都成立。
- 参考实现：`src/main/api/login.ts:291-295` 的条件是二选一：有 `expiredAtMs` 时只看 10 分钟窗口，没有到期时间时才看 6 小时间隔。
- 建议：改为 `expiredAtMs !== null ? (expiredAtMs - now <= 10min) : (now - lastRefreshAt >= 6h)`。

### A5 [中][已解决] 登录页“整页只有登录组件”与已登录状态冲突

- 解决（2026-10-21）：USER §5.2.6 的“整页只有登录组件”加上“未登录时”，与已登录状态不再冲突。
- 以下为审计时的问题记录（已按上述决策处理）：
- 位置：`USER.html` §5.2.6（L332、L335）。
- 冲突：L332 称“整页只有登录组件与下方 Cookie 折叠入口”，L335 又说“已登录状态下页面显示账号头像、昵称、musicid 与‘进入我的歌单 / 退出登录’”。参考实现 `LoginView.vue:108-149` 在已登录时只渲染已登录卡片，不渲染 xlogin 与 Cookie 入口。
- 建议：L332 加限定语“未登录时”。

### A6 [中][已解决] `g_tk` 来源在 PROVIDER 内部矛盾

- 解决（2026-10-21）：PROVIDER §1 拆为 OAuth `g_tk`（`p_skey`）与资料 `g_tk`（`musickey`）两行；歌词固定 `g_tk=5381` 写入注记。
- 以下为审计时的问题记录（已按上述决策处理）：
- 位置：`PROVIDER.html` §1（L66）、§3.2（L141）。
- 冲突：§1 定义 `g_tk` 由 `p_skey` 计算，并“随 OAuth 与资料请求发送”；§3.2 又说资料接口的 `g_tk` 由 `hash33(musickey, 5381)` 计算。
- 参考实现：资料接口确实使用 `hash33(credential.musickey, 5381)`（`src/main/api/user.ts:28`）；OAuth authorize 使用 `hash33(jar.p_skey, 5381)`（`src/main/api/login.ts:57`）。
- 建议：拆成“OAuth g_tk（p_skey）”与“资料 g_tk（musickey）”，或把 §1 的定义限定为 OAuth 场景。

### A7 [中][已解决] `100001` 是否重试前后矛盾

- 解决（2026-10-21）：以代码为准，`100001` 不重试。PROVIDER §4.2 将 `2001` / `104604`（瞬时繁忙，重试）与 `100001`（限流，不重试）拆成两行。
- 以下为审计时的问题记录（已按上述决策处理）：
- 位置：`PROVIDER.html` §2（L104）、§4.2 表（L274）。
- 冲突：§2 的重试规则只列 `2001` / `104604`；§4.2 表却把 `104604` / `100001` / `2001` 都归为 `QUOTA_LIMITED`，并注明“短退避重试”。
- 参考实现：`src/main/api/client.ts:182` 只对 `2001` / `104604` 重试；`100001` 直接映射为 `QUOTA_LIMITED`，不重试。
- 建议：统一表格与实现。若 `100001` 不重试，将其从“重试”行拆出；若应重试，补实现。

### A8 [中][已解决] CORE §4.16 把加载 xlogin 的职责写给了 `openWebLogin`

- 解决（2026-10-21）：按代码改为：`setEmbedBounds` 负责 `WebContentsView` 的创建、定位与首次加载；`openWebLogin` 只启动登录流程（轮询 Cookie / 捕获 OAuth code、换证）。
- 以下为审计时的问题记录（已按上述决策处理）：
- 位置：`CORE.html` §4.16 注（L503）。
- 冲突：注中称“`openWebLogin` 在独立 session 分区中加载官方 xlogin”；但 CORE §5.3 自己显示是 `setEmbedBounds → createEmbedView → loadURL(XLOGIN_URL)`。
- 参考实现：`src/main/api/web-login.ts:54-65` 在 `setEmbedBounds` 中创建视图并 `loadURL`；`openWebLogin`（L145-156）只启动登录流程。
- 建议：改为“`setEmbedBounds` 负责创建/定位/加载视图；`openWebLogin` 启动轮询与换证”。

---

## B. 重复（违反 GUIDELINES 单一事实源）

GUIDELINES Global #1 要求“定义只出现一次，其他地方用链接”。以下规则/定义被多处复述，建议各保留一个权威位置。

### B1 [中][已解决] 凭证边界 / 密钥环规则至少 7 处

- 解决（2026-10-21）：用户侧以 USER §2“登录凭证边界”为权威，存储侧以 PROVIDER §2“密钥环”为权威；README、USER 术语/图注、CORE §2/§5.4 改为链接或一句话摘要。
- 以下为审计时的问题记录（已按上述决策处理）：
- `README.html` L53；`USER.html` L62、L101、L128、L139；`CORE.html` L120；`PROVIDER.html` L116。
- 同一规则（凭证只在主进程、不跨 IPC、密钥环不可用禁用登录、绝不退化为明文）反复出现。
- 建议：产品行为以 USER §2“登录凭证边界”为权威；存储实现以 PROVIDER §2“密钥环”为权威；CORE 与 README 改为链接/一句话摘要。

### B2 [中][已解决] 音质降档链 `flac → 320k → 128k` 至少 6 处

- 解决（2026-10-21）：以 PROVIDER §2“音质降档”为唯一权威；USER §2 只保留用户可见结果，CORE §4.11 改为链接。
- 以下为审计时的问题记录（已按上述决策处理）：
- `USER.html` L89；`PROVIDER.html` L100、L151、L275；`CORE.html` L466、L955。
- 建议：以 PROVIDER §2“音质降档”为唯一权威；USER 只保留用户可见结果并链接；CORE 只说明内部实现位置并链接。

### B3 [低][已解决] “路由切换关闭歌词面板”重复 4 处

- 解决（2026-10-21）：以 USER §2“路由”为权威；README 删除该句，USER §5.2.5 与 CORE §4.22 改为链接。
- 以下为审计时的问题记录（已按上述决策处理）：
- `README.html` L68；`USER.html` L113、L318；`CORE.html` L579。
- 建议：以 USER §2“路由”为权威；其余位置链接。

### B4 [低][已解决] “音频流由渲染进程直接加载”重复 3 处

- 解决（2026-10-21）：以 USER §3.1 为权威；CORE §5.5 与 PROVIDER §3.3/§4.1 改为链接。
- 以下为审计时的问题记录（已按上述决策处理）：
- `USER.html` L127；`CORE.html` L954；`PROVIDER.html` L152。
- 建议：以 USER §3.1 的架构说明为权威；CORE/PROVIDER 链接，不重复展开。

### B5 [低][已解决] “上游隔离”整句在 CORE 与 PROVIDER 完全重复

- 解决（2026-10-21）：上游隔离规则保留在 CORE §2；PROVIDER §2 改为链接。
- 以下为审计时的问题记录（已按上述决策处理）：
- `CORE.html` L124 与 `PROVIDER.html` L88 文本几乎完全相同。
- 建议：该规则属于内部约定，保留在 CORE §2；PROVIDER 改为链接。

### B6 [低][已解决] TODO 用“播放列表”指代 USER 的“播放队列”

- 解决（2026-10-19）：TODO 保留队列设计决策并统一使用“播放队列”；内部数据结构、方法签名等实现细节移入 CORE；USER/CORE 正文不引用 TODO。
- 审计时问题：`TODO.md` L3–L6 的“播放列表功能”“加入播放列表（队尾）”“通过播放列表预览播放顺序”实际指当前播放队列；USER §1 已定义“播放队列（Queue）”，`GUIDELINES.md` USER 规则要求术语“never synonymized”。

---

## C. 与参考实现不符 / 疑似事实错误（确认）

> 2026-10-21：C1–C14 的文档已按决策修正。C4（凭证明文 fallback）与 C5（音质回退算法）的代码实现仍落后于文档，已记录到 `TODO.md`。

### C1 [高] 扫码登录文档漏掉了 OAuth `code` 导航捕获路径

- 位置：`CORE.html` §5.3（L904–L910）、§4.16 注（L503）；`PROVIDER.html` §3.1 注（L131）。
- 文档只描述“轮询 Cookie → `requestOAuthCodeWithCookies` → `exchangeQqLoginCode`”，并称必须同时看到 `p_skey` 才进入 OAuth 换证。
- 参考实现还有一条并行路径：`src/main/api/web-login.ts:96-127` 监听 `will-navigate` / `will-redirect` / `did-navigate`，从 URL 中提取 OAuth `code`；`runEmbedLogin` 在 L168 设置 `emitCode = (code) => succeed(code)`，`succeed` 直接调用 `exchangeQqLoginCode(code)`（L170-180），并不要求 `p_skey`。
- 影响：PROVIDER §3.1 的“必须同时看到 p_skey……”对导航回调路径不成立；按文档实现可能漏掉实际登录成功路径。
- 建议：在 CORE §5.3 与 PROVIDER §3.1 明确两条路径：
  1. xlogin 完成 OAuth 后重定向，应用从导航 URL 捕获 `code`；
  2. Cookie 轮询作为兜底，需要 `p_skey` + `p_uin`/`pt4_token`/`uin`。

### C2 [高] 请求头 UA / Referer 的统一描述与实现不符

- 位置：`PROVIDER.html` §4.1 注（L220）。
- 文档：请求头统一使用桌面浏览器 UA 与 `Referer: https://y.qq.com/`；登录换证与续期使用移动端 UA。
- 参考实现：
  - `src/main/api/login.ts:6-7` 的 `USER_AGENT` 是 Windows 桌面 Chrome。
  - `requestOAuthCodeWithCookies` 使用桌面 UA，且 `Referer: https://xui.ptlogin2.qq.com/`（L306-312）。
  - `exchangeQqLoginCode` 使用 iPhone UA（L352-354）。
  - `refreshMusickey` 使用桌面 UA + `https://y.qq.com/`（L468-471）。
- 建议：按端点列出例外，不要写“统一”；续期实际不是移动端 UA。

### C3 [高] `prov-play` 时序图把音频流请求画成主进程发起

- 位置：`diagram/prov-play.puml` / `prov-play.svg`；`PROVIDER.html` §3.3 注（L152）。
- 冲突：图中 participant 明确写“Lychee Player (主进程)”，并画出 `APP -> STREAM : GET https://ws.stream.qqmusic.qq.com/{purl}`；但 PROVIDER §3.3 与 USER §3.1、CORE §5.5 都说明音频流由**渲染进程**直接加载，主进程只经手链接字符串。
- 建议：把 STREAM 的请求方改为“Lychee Player (渲染进程)”，或把整个流加载步骤从 PROVIDER 主进程时序中移除。这条同时违反 GUIDELINES“provider 图不出现项目内部调用结构”的规则。

### C4 [中][文档已解决；代码待办] README 说凭证“保存在系统密钥环”，实际是加密落盘

- 解决（2026-10-21）：README 改为链接 USER §2；复核 `credential.ts` 发现 `loadCredential` 仍会加载旧明文（密钥环不可用时也接受），代码落后于“必须依靠 libsecret，否则不能登录”的文档标准；已记录到 `TODO.md`。
- 以下为审计时的问题记录：
- 位置：`README.html` L53。
- 参考实现：`safeStorage.encryptString` 加密后写入 `credential.bin`（`src/main/credential.ts:61-77`），系统密钥环只保护加密密钥；PROVIDER §2（L116）与 CORE §4.7 注（L410）也都写“加密后落盘”。
- 建议：改为“凭证加密后落盘，加密密钥由系统密钥环保护”；不要写“凭证保存在密钥环”。

### C5 [中][文档已解决；代码待办] 音质降档链没有体现“从请求档位开始”

- 解决（2026-10-21）：PROVIDER §2 改为“先请求档位，再按 flac → 320k → 128k 兜底（跳过已尝试的请求档位）”；USER 改为实际音质可能更高或更低。参考实现 `QUALITY_CHAIN` 仍只向下，代码已记录到 `TODO.md`。
- 以下为审计时的问题记录：
- 位置：`USER.html` L89；`PROVIDER.html` L100。
- 文档：请求档位无链接时按 `flac → 320k → 128k` 逐档重试。
- 参考实现：`src/main/api/song.ts:39-43` 的 `QUALITY_CHAIN` 为：
  - `flac → flac, 320k, 128k`
  - `320k → 320k, 128k`
  - `128k → 128k`
- 即请求 `320k` 时不会先试 `flac`，请求 `128k` 时不会向上试。文档的写法容易被实现成“永远从 flac 开始”。
- 建议：改为“从请求档位开始逐级向下：flac → 320k → 128k；320k → 128k；128k 不再降档”。

### C6 [中] 歌曲列表 `#` 列的“序号 / 播放按钮”描述与实现不符

- 位置：`USER.html` §5.2.4（L299）。
- 文档：悬停或当前播放行在 `#` 列显示播放按钮，其余显示序号。
- 参考实现：`SongTable.vue` 的 `#` 列始终只渲染播放按钮（L22-27），没有序号文本；非悬停/非当前行只是通过 CSS `opacity: 0` 隐藏按钮（`main.css:706-721`），视觉上是空白而不是序号。
- 建议：要么在 `SongTable` 中补序号文本，要么把文档改为“`#` 列始终为播放按钮，非活动行透明显示”。

### C7 [中] `INTERNAL` 的“提示重启应用”没有实现

- 位置：`USER.html` §5.3 表（L409）。
- 文档：界面提示“主进程内部错误”，行为“提示重启应用；详情只写入主进程日志”。
- 参考实现：`describeError` 只返回“主进程内部错误”（`src/renderer/api.ts:26`），没有重启提示或重启入口；主进程日志确实只记录错误码/消息（`src/main/ipc.ts`）。
- 建议：补重启提示，或把“行为”改为“提示主进程内部错误，详情写入主进程日志”。

### C8 [中] “网络错误重试 3 次”在参考实现中只覆盖 HTTP 非 2xx / 429

- 位置：`CORE.html` §4.8（`UPSTREAM_RETRY_ATTEMPTS` 等）、§4.8 注；`PROVIDER.html` §2（L104）。
- 文档：网络错误做短退避重试，最大尝试次数 3。
- 参考实现：`src/main/api/client.ts:97-124` 只对 `UpstreamError` 且 code 为 `QUOTA_LIMITED` / `UPSTREAM_NETWORK` 的情况重试；`fetch` 连接失败抛出的 `TypeError`、`AbortSignal.timeout` 抛出的 `TimeoutError` 都不是 `UpstreamError`，会直接抛出，不重试。`UPSTREAM_NETWORK` 目前主要来自 HTTP 非 2xx（`fetchOnce`）。
- 影响：文档承诺的“网络错误重试”对真实断网/超时不成立。
- 建议：先确认应以文档还是实现为准；若以文档为准，在 `upstreamRequest` 中把网络异常/超时包装成可重试的 `UpstreamError('UPSTREAM_NETWORK')`。

### C9 [中] “所有请求型 IPC 错误以 Toast 展示”存在未覆盖页面

- 位置：`USER.html` §2（L117）。
- 参考实现：`LibraryView.vue:20-31` 的 `load()` 捕获 `playlist.listMine` 错误后只写入页面内 `error.value`，没有调用 `toast.error`；`PlaylistView.vue` 则同时写内联错误和 Toast。
- 建议：补 Toast，或在 USER §2 明确“页面级加载错误允许使用内联错误区，其余请求型错误用 Toast”。

### C10 [低] CORE §4.33 的 `reload` 返回类型与实现不符

- 位置：`CORE.html` L742：`reload(): Promise<void> | false;`
- 参考实现：`src/renderer/composables/lyrics.ts:55` 返回 `player.current && load(...)`，类型是 `null | Promise<void>`，不是 `false`。
- 建议：改为 `reload(): Promise<void> | null`，或让实现返回 `false` 以匹配文档。

### C11 [低] CORE §5.8 退出流程漏掉 `quitting = true`

- 位置：`CORE.html` §5.8（L988–L996）。
- 参考实现：`src/main/index.ts:176-183` 的 `before-quit` 第一行是 `quitting = true`，之后才清理定时器、MPRIS、托盘、登录视图并保存设置。没有这行，`BrowserWindow.on('close')` 的 `!quitting && closeToTray` 判断可能把退出拦截成“隐藏到托盘”。
- 建议：在调用树中补一行状态置位（可作为判断/状态行），或在注中明确“先置 quitting”。

### C12 [低] “只放行 QQ 域名”与实际放行列表不符

- 位置：`CORE.html` §5.3 注（L913）；`PROVIDER.html` §2（L112）。
- 参考实现：`src/main/api/web-login.ts:10-21` 放行 `qq.com`、`*.qq.com`、`*.gtimg.cn`、`*.weixin.qq.com`。
- 建议：改为“只放行腾讯相关域名（qq.com / gtimg.cn / weixin.qq.com）”。

### C13 [低][已解决] README 版本阶段声明与参考实现不一致

- 解决（2026-10-21）：README 删除版本阶段说明；TODO 增加“删除任何版本阶段提示和字样”的跟踪项。
- 以下为审计时的问题记录：
- 位置：`README.html` L38；`TODO.md` L15。
- 参考实现：版本号仍为验证版，侧栏与设置页也有阶段文案；README 当时仍声明“可日常使用”的版本阶段。

### C14 [低] CORE §1 注把 `scripts/probe.mjs` 归为“纯展示文件”

- 位置：`CORE.html` §1 注（L98）。
- 文档：带链接的文件在 §4 有签名小节；其余条目为配置、资源或纯展示文件。
- 实际：`scripts/probe.mjs` 是可执行探针脚本，不是配置/资源/纯展示文件，也没有 §4 签名小节。
- 建议：给 `probe.mjs` 增加签名小节，或把注改为“脚本、配置、资源或纯展示文件”。

---

## D. 违反 GUIDELINES 形式要求（确认）

### D1 [高][已解决] 违反 Global #1 单一事实源

- 解决（2026-10-21）：B1–B6 已处理；凭证边界、音质降档链、路由关闭歌词面板、音频流直连、上游隔离与队列术语均改为单一权威位置 + 链接。
- 以下为审计时的问题记录：
- 见 B1–B6。重复的规则包括凭证边界、音质降档链、路由关闭歌词面板、音频流直连、上游隔离，以及 TODO 中的队列术语。
- GUIDELINES L25 要求“定义只出现一次，其他地方用超链接”。

### D2 [中][已解决] 违反 Global #2 不得记录修订历史

- 解决（2026-10-21）：TODO 删除“路线图移入”等迁移说明；版本阶段迁移条目已替换为用户要求的“删除任何阶段提示和字样”跟踪项。
- 以下为审计时的问题记录：
- 位置：`TODO.md` 中旧的“版本阶段迁移”说明与“路线图移入”说明。
- 这两处记录了文档/路线图的迁移历史，属于 GUIDELINES L26 明确禁止的“changes against previous versions”。
- 建议：把历史放进提交说明；TODO 只保留当前待办。

### D3 [高][已解决] CORE 签名块不是合法的项目语言语法

- 解决（2026-10-21）：`Credential` 改为空接口，`XLOGIN_URL` 改为 `declare const`，`router` 改为 `createRouter(...)` 初始化；Vue 组件统一改用 `defineProps` / `withDefaults` / `defineEmits`，无 props/emits 的组件改用注释。
- 以下为审计时的问题记录：
- `CORE.html` L278：`export interface Credential;` —— TypeScript 接口不能没有 body。
- `CORE.html` L373：`export const XLOGIN_URL: string;` —— 没有 `declare` 或初始化器，普通 `.ts` 文件中非法。
- `CORE.html` L592：`const router: Router;` —— 没有初始化器，非法。
- `CORE.html` L764–L795 的 `props: {...}; emits: none` 也不是合法的 Vue/TS 语法，而是文档简写。
- GUIDELINES Core 规则（L72）要求“项目语言，语法有效”，只有“已在 USER/PROVIDER 定义的符号”可以一行无 body 声明。
- 建议：
  - `export interface Credential {}`（或 `export type Credential = ...`）；
  - `export const XLOGIN_URL = '...'`；
  - `const router = createRouter({...})`；
  - Vue props/emits 改用 `defineProps` / `defineEmits`，或在 CONVENTIONS 明确声明这是伪代码记法。

### D4 [中][已解决] CORE §4 的方法签名覆盖不完整

- 解决（2026-10-21）：GUIDELINES 明确“签名必须覆盖核心流程相关方法；非核心辅助方法可酌情引入”。CORE 已补 `checkCredentialStore`、`configureLinuxDisplay`、`showMainWindow`、`refreshMusickey`、`probeCredential`、`createEmbedView`、`attachCapture`、`extractOauthCode`、`runEmbedLogin`、`fetchTrack`、`requestQuality`、`buildStreamUrl` 等核心方法签名；`parseCookieString` 等辅助方法允许省略。
- 以下为审计时的问题记录：
- GUIDELINES Core 第 4 章要求“每个源文件一个小节；方法：签名 + 至多一行用途”。当前只列了导出 API，但调用树引用了多个未声明的内部函数：
  - `src/main/index.ts`：`checkCredentialStore`、`configureLinuxDisplay`、`showMainWindow`（CORE §5.1/§5.2 使用）。
  - `src/main/api/song.ts`：`fetchTrack`、`requestQuality`、`buildStreamUrl`（CORE §5.5 使用）。
  - `src/main/api/login.ts`：`refreshMusickey`、`parseCookieString`、`probeCredential`（CORE §5.4/§5.7 使用）。
  - `src/main/api/web-login.ts`：`runEmbedLogin`、`finishFromCookies`、`fail`、`createEmbedView`（CORE §5.3 使用）。
- 建议：补齐这些签名；如果约定只列导出 API，请在 CORE §2 CONVENTIONS 明确“内部函数只出现在调用树，签名小节只列导出 API”的例外。

### D5 [高][已解决] Provider 图出现项目内部调用结构

- 解决（2026-10-21）：GUIDELINES 增加“项目整体参与者、只画跨边界消息、内部处理可单次回环”的规则；`prov-cookie` / `prov-login` / `prov-play` 已改为整体播放器参与者，内部处理改为单次回环或删除，SVG 已重导出。
- 以下为审计时的问题记录（已按上述决策处理）：
- GUIDELINES Provider 规则（L92）：provider 图只写跨越边界的方法/消息，项目内部调用结构不得出现。
- `diagram/prov-cookie.puml`：`APP -> APP : 解析 Cookie`、`APP -> APP : 生成 Credential`、`APP -> APP : AUTH_EXPIRED` 都是应用内部步骤。
- `diagram/prov-login.puml`：`APP -> XW : 读取 session Cookie` 是应用主进程读取自己的内嵌视图，不是 provider 消息。
- `diagram/prov-play.puml`：`APP (主进程) -> STREAM` 既违反该规则，也与“渲染进程直连”的契约冲突（见 C3）。
- 建议：删除/改写这些自消息，只保留 xlogin/QQ、资料接口、vkey、音频流等跨边界消息；内部流程放到 CORE §5.3/§5.4/§5.5。

### D6 [中][已解决] 违反 Global #8 “一块一流程”

- 解决（2026-10-21）：CORE §5.5 拆出 §5.5.1“播放结束”；§5.8 拆成 §5.8.1“关闭窗口”与 §5.8.2“应用退出”。
- 以下为审计时的问题记录：
- `CORE.html` §5.5（L932–L951）：`audio/engine::onEnded` 是一个与前面“点击播放”分离的根流程，却放在同一代码块。
- `CORE.html` §5.8（L988–L996）：`BrowserWindow.on('close')` 与 `app.on('before-quit')` 是两个独立事件处理器，放在同一代码块。
- 建议：拆成独立小节或独立代码块；§5.5 可分为“5.5.1 开始播放 / 5.5.2 播放结束”，§5.8 可分为“关闭窗口 / 应用退出”。

### D7 [低][已解决] 其他形式问题

- 解决（2026-10-21）：GUIDELINES 明确文件树只列源码、构建配置与资源，文档及其样式不在其中；CORE 文件树移除文档、`style.css` 与 `LICENSE`，仅保留 TODO 作为跟踪例外；`style.css` 的陈旧“6.1”注释改为 USER §5.2.1；CORE §4.47 注释缩减为“主题 token 与布局样式”，其余信息移入注记。
- 以下为审计时的问题记录：
- `TODO.md` 是 Markdown，而 GUIDELINES 开篇要求“Documents per project, in HTML”。TODO 作为工作跟踪例外保留。
- `CORE.html` §1 文件树列出 `style.css`，但它是文档样式，与源码无关；已移除。
- `style.css` L175 注释仍写“6.1 骨架图”，当前对应章节是 USER §5.2.1，属陈旧编号。
- `CORE.html` §4.47 的注释“无导出：主题 token、布局、组件样式与响应式断点”包含 4 个信息点，按 Global #7 应移到代码块后的 `ul.note`。

---

## E. 拿不准 / 需确认（未判定为问题）

> 2026-10-21：E1–E5、E7、E9、E10 已处理；E6 暂不处理；E8 不构成违规。

以下条目取决于产品口径、文档定位或团队约定，未直接判为错误；建议确认后再决定是否修改。

### E1 [已处理] MPRIS 到底归 USER 还是 PROVIDER

- 处理：按就近原则，MPRIS 直接面向 D-Bus，归 `PROVIDER.html` §4.4；GUIDELINES 已增加就近原则。
- GUIDELINES 把 USER 定义为“上层：最终用户 / 依赖软件”，内容包含“协议、API”；PROVIDER 是“下层：数据源 / 依赖（系统服务、IPC……）”，且 Provider 规则要求“只记录被消费的子集”。
- 当前 `PROVIDER.html` §4.4 承载了应用**暴露给桌面环境**的 MPRIS 契约；`USER.html` §4 只剩“除 MPRIS 外没有其他 API”和指向 PROVIDER 的链接。MPRIS 的调用方是桌面环境（依赖软件），按边界定义更像 USER 的接口。
- 另一种解释：D-Bus 是下层系统服务，MPRIS 作为 D-Bus 上的协议可以归 PROVIDER；团队在提交 `d60c9c6` 中也明确选择了这一方案。
- 建议：若保留现方案，在 GUIDELINES 或 PROVIDER §4.4 明确“MPRIS 作为 D-Bus 契约归 PROVIDER”的例外；否则把 §4.4 迁到 USER §4。由于两种解释都说得通，本节不把它列为确认违规。

### E2 [已处理] README “完整的 MPRIS 媒体控制”与 PROVIDER §4.4 的范围

- 处理：README GOAL 不再单列“完整 MPRIS”；PROVIDER §4.4 补全 `Volume` / `LoopStatus` / `Shuffle` 契约与映射，CORE 类型及 §5.6 事件同步；代码实现记入 `TODO.md`。
- 审计时记录：`README.html` L33 把“完整的 MPRIS 媒体控制”列为成功标准；`PROVIDER.html` L563 明确 `Volume` / `LoopStatus` / `Shuffle` 未同步、不属于契约。
- “完整”如果指播放控制方法（Play/Pause/Next/Previous/Seek），当前子集可以算完整；如果按 MPRIS 规范理解，则目标尚未覆盖。建议在 README 改成“核心 MPRIS 播放控制”，或在 PROVIDER 说明后续范围。

### E3 [已处理] “官方公开接口”与“未提供公开接口文档”

- 处理：README、USER 页脚、PROVIDER §2 统一为“官方可访问接口（无公开文档）”。
- 审计时记录：`README.html` L111 称“仅调用官方公开接口”；`PROVIDER.html` §2（L84）称“QQ 音乐未提供公开接口文档，本文档的权威来源是实际消费的请求与响应字段”。
- 两者可以同时成立（接口可公开访问但无公开文档），但读者容易理解为矛盾。建议统一为“官方可访问接口（无公开文档）”。

### E4 [已处理] 文档原型 CSS 与正文/产品 CSS 的数值差异

- 处理：不要求原型与正文数值一致；GUIDELINES 与 USER §5.2 已明确样式规定以文字/代码为准，原型只作示意。
- `style.css` 是文档原型样式，不是产品样式；正文明确说“原型不是像素级截图”。
- 仍有几处值得确认是否要对齐：
  - 歌词行：`style.css` `.u-lyric` 12px / 继承 1.45，而 USER §5.2.5 写 14px / 1.7；产品 `src/renderer/styles/main.css:1594-1601` 是 14px / 1.7。
  - 播放按钮：`style.css` `.u-ctl.play` 34px，USER §5.2.3 写 38px；产品 `main.css:1349-1353` 是 38px。
  - 歌曲列表封面：`style.css` `.u-cover` 30px，USER §5.2.4 写 38px；产品 `main.css:730-733` 是 38px。
- 若原型只是示意，可保持现状；若要求原型“固定几何”，建议把 `style.css` 调到与正文/产品一致。

### E5 [已处理] “回退上一首歌但播放条没回退”

- 处理：`TODO.md` 已改为“歌曲不存在时停止；再次播放不得自动回退上一首，播放条保留该曲且按钮置灰”。USER §2/§5.2.3 与 CORE §4.28/§5.5 写明不可播歌曲的展示、禁用与禁止自动回退机制。
- 审计时记录：`TODO.md` L9 记录该 bug；`USER.html` §2（L97）与 CORE §5.5 的约定是“加载失败停止，不自动跳下一首”。参考实现 `loadAndPlay` 也不自动回退（`src/renderer/stores/player.ts:113-144`）。
- 可能 TODO 已过期，或 bug 只在特定路径出现。建议确认后删除/更新 TODO，避免与文档约定冲突。

### E6 [暂缓] 歌单详情“返回搜索” vs TODO“返回我的歌单”

- 处理：按用户要求暂不处理。
- `USER.html` §5.2.8（L393）与 `CORE.html` §4.44（L819）写“返回搜索”；`TODO.md` L8 要求改为“返回我的歌单列表”。
- 这是已记录的未来变更，不算文档错误；实现变更时请同步更新 USER/CORE，避免文档滞后。

### E7 [已处理] 工程常量的落点

- 处理：GUIDELINES 已明确工程常量在所属源文件的签名小节中声明，推荐值只以注释形式给出；CORE 原 §2.1 的集中表已移除，常量已分散到 §4 各文件小节。

### E8 [不处理] 少量“设计理由”表述

- 处理：不构成违规，不处理。
- GUIDELINES 开头要求避免“针对具体设计选择的理由”。以下句子接近该限制：
  - `CORE.html` §4.26 注“替换为 mpv 等引擎时实现同一接口……”；
  - `CORE.html` §5.1 注“定时器同时承担密钥环晚解锁后的重试”；
  - `PROVIDER.html` §3.1 注“避免把未完成登录误判为成功”。
- 这些是短句且有助于理解契约，是否算违规取决于执行尺度；若严格，可移到提交说明或 CORE 的散文说明中。

### E9 [已处理] README 对官方客户端与参考项目的描述

- 处理：README Credits 删除“参考点”列，仅保留项目与技术栈/许可；GUIDELINES Credits 规则明确不写参考内容。
- 审计时记录：Credits 中 8 个仓库均可访问（`imsyy/SPlayer` 会重定向到 `SPlayer-Dev/SPlayer`，其余返回 200）；`lyswhut/lx-music-desktop` 的 Apache-2.0 已核对。
- “官方 Linux 客户端基于 Electron、MPRIS 残缺、不支持音质选择”等属于外部产品事实，本仓库无法验证；本次未据此判定为捏造。
- “Team-Quaver/quaver-music 的 Wayland 适配、AppImage 双架构 CI”等参考点也未逐项核对仓库内容。

### E10 [已处理] 登录页宽度与设置页“关于信息”

- 处理：登录组件改为宽度 100% + 最大宽度 800px（暂定，按实现调整），USER §5.2.1/§5.2.6 与 `TODO.md` 已记录；设置页补齐“关于”面板（版本、音频引擎、许可证、非官方声明），见 USER §5.2.7 与 CORE §4.46。
- 审计时记录：`USER.html` §5.2.6 L332 称组件“横向占满登录页宽度”；参考实现 `.login-wide` 是 `width: min(1080px, 100%)`（`main.css:1026-1032`），在更宽窗口中不会占满整个页面。若“登录页”指登录卡片，则描述成立。
- 审计时记录：`USER.html` §5.2.7 注称右列含“账号与关于信息”，但该节原型只画了账号面板；参考实现有版本信息面板。该面板已按现有实现补齐。

---

## F. 已检查且未发现问题的项

- **链接与锚点**：README/USER/CORE/PROVIDER 的所有本地 `href`（含 `#fragment`）均能解析；`diagram/*.svg`、`style.css`、`TODO.md` 均存在；4 个 HTML 均无重复 `id`，所有 `img` 都有 `alt`。
- **HTML 转义**：`<pre><code>` 内未发现未转义的 `<` 或 `&`；`Result<T, E>` 等泛型均使用 `&lt;` / `&gt;`。
- **PlantUML 源/导出**：6 个 `.puml` 与 6 个 `.svg` 一一对应，所有 SVG 都被 USER/PROVIDER 引用；用 PlantUML 1.2026.8 重新导出后，文本节点与已提交 SVG 一致。
- **图表形式**：未发现 Mermaid；CORE 文件树是 GUIDELINES 要求的 ASCII 树，不属于被禁止的“ASCII 图”。
- **章节顺序**：README（WHAT & WHY → 用户交互 → Credits）、USER（TERMS → CONVENTIONS → DIAGRAMS → INTERFACES → UI）、CORE（File tree → CONVENTIONS → SBOM → types → call stack）、PROVIDER（TERMS → CONVENTIONS → DIAGRAMS → INTERFACES）均符合 GUIDELINES 的章节目录。
- **工程常量**：已分散到 CORE §4 各文件签名小节，推荐值以注释形式记录；5.7 的两种情况描述见 A4（已解决）。
- **SBOM**：依赖清单与 `dev/evol-1:package.json` 一致（`electron`、`vue`、`pinia`、`vue-router`、`mpris-service`、TypeScript/Vite 工具链）。
- **Credits**：列出的 8 个仓库均存在；`lyswhut/lx-music-desktop` 的 Apache-2.0 许可已核对。

---

## G. 建议修复顺序

1. **代码待办**：C4 凭证明文 fallback、C5 音质回退、MPRIS Volume/LoopStatus/Shuffle 同步；文档已修正，代码实现见 `TODO.md`。
2. **暂缓**：E6 歌单详情返回路径，按用户要求暂不处理。

> 本报告最初只做审计；A1–A8、B1–B6、C1–C14、D1–D7 与 E1–E5/E7/E9/E10 的文档修订已同步。剩余待办集中在代码实现与 E6 暂缓项。
