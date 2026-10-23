# EVOLVE — Lychee Player 演进计划

> 实施计划 · 2026-10-23
> 输入：`TODO.md` 当前 7 项任务与 9 项进阶目标；A7“歌单后台分页加载”为 2026-10-21 追加；A8“工程常量集中管理”为本次计划追加。
>
> 本文回答四个问题：**现状是什么、准备怎么做、要改哪些文档的哪些章节、如何验收**。它是实施计划，不纳入 GUIDELINES 的五文档体系，也不是规范正文；当前 `USER.html` / `CORE.html` / `PROVIDER.html` / `BUILD.html` 尚未按本计划修改。任务落地后，结论写入对应 HTML 文档，并从 `TODO.md` 删除条目；本计划对应小节标记为已归档。

## 0. 总览

### 0.1 任务总表

| ID | TODO 条目 | 优先级 | 方案摘要 | 主要文档动作 |
|---|---|:---:|---|---|
| A1 | 歌单缓存（甚至预加载） | P1 | 主进程内存 + 磁盘缓存，按页累积，stale-while-revalidate；只预加载“我喜欢”第一页 | USER §1/§2/§5.2.8；CORE §1/§2/§4.1/§4.12/§4.45/§4.x/§5；新增 cache 模块 |
| A2 | 歌单详情页返回我的歌单列表 | P0 | 正常态与错误态的返回目标都改为 `/library` | USER §5.2.8；CORE §4.46 |
| A3 | 启动 flags 外部文件 | P0 | XDG 配置文件，每行一个参数；命令行 > 文件 > 内置默认；设置页可展示 / 编辑，保存后下次启动生效 | USER §2/§5.2.7；CORE §1/§2/§4.2/§4.4/§4.48/§4.x/§5.2；BUILD（A4 后补） |
| A4 | Arch Linux 打包（AUR-ready tar.gz + curl 安装脚本）+ BUILD.html | P1 | 仅 Arch x86_64；electron-builder `dir` → 固定布局 tar.gz；`install.sh` 一行安装；暂不做 AUR / 自动发布 | 新建 BUILD（含 A3/A5 小节）；CORE §1/§3；README 安装行按需链接 BUILD |
| A5 | api 层 fixture 回放测试 | P1 | Vitest + 脱敏 fixture + fetch 回放，默认不访问真实网络 | CORE §1/§2/§3；BUILD（A4 后补） |
| A6 | 歌单不可播预检 + 最高可用音质 | P1 | 主进程分批探测，详情并发限制 + vkey 分档；结果缓存并驱动歌单列表标记，不参与队列运行期 | USER §1/§2/§5.2.4/§5.2.8；CORE §1/§2/§4.1/§4.2/§4.11/§4.39/§4.46/§4.x/§5；PROVIDER §4.3 |
| A7 | 歌单后台分页加载 + 队列构建 | P1 | 50 首/页；第一页即渲染；队列从播放起为空，当前歌曲单独显示，完整且非 stale 后按当前模式增量追加；补全不会取消并写入缓存 | USER §1/§2/§5.2.8/§5.2.9；CORE §1/§2/§4.1/§4.2/§4.12/§4.29/§4.46/§4.x/§5；PROVIDER §4.1/§4.3 |
| A8 | 工程常量集中管理 | P1 | 新增 `src/shared/constants.ts`；所有模块常量集中导出；`PROBE_MAX_SONGS = PLAYLIST_PAGE_SIZE * PLAYLIST_PAGE_MAX` | CORE §1/§2/§4.x；各模块签名改为引用 |
| B1 | 托盘常驻体验打磨 | P2 | 托盘菜单 / tooltip / 图标随播放状态更新 | USER §5.4；CORE §4.5/§4.19/§5.5 |
| B2 | 播放缓存 | P2 | 仅音频体磁盘缓存；不做链接缓存 / 下一首预解析；按账号隔离 | README 非目标；USER §1/§2/§3.1/§5.2.7；CORE §1/§4.1/§4.2/§4.27/§4.48/§4.x/§5.5；PROVIDER §3.3/§4.1；BUILD 存储 |
| B3 | 每日推荐 / 专属雷达 / 猜你喜欢 | P2 | 先探测上游接口，再做“发现”页与按日缓存 | USER §2/§5.2.2/§5.2.8；CORE §1/§4.1/§4.2/§4.25/§4.x/§5；PROVIDER §1/§3/§4.1/§4.3 |
| B4 | 逐字歌词（QRC） | P2 | QRC 解密 + 分词时间轴；不做桌面歌词 | USER §1/§5.2.5；CORE §1/§4.1/§4.14/§4.33/§4.34/§4.41/§5.9；PROVIDER §1/§4.1/§4.3 |
| B5 | 收藏 / 歌单管理 | P2 | 收藏、建单、改名、删单、增删歌曲；乐观更新 + 回滚 | USER §1/§2/§5.2.3/§5.2.4/§5.2.8；CORE §1/§2/§4.1/§4.2/§4.39/§4.40/§4.45/§4.x/§5；PROVIDER §1/§3/§4.1/§4.2/§4.3 |
| B6 | MV 播放 | P3 | 搜索 / 详情 / 取流 / 视频播放页 | USER §1/§2/§5.2.8；CORE §1/§4.1/§4.2/§4.25/§4.44/§4.x/§5；PROVIDER §1/§3/§4.1/§4.3 |
| B7 | 下载管理 | P2 | 仅下载当前账号可播内容；队列、断点、存储管理；缓存封面，不保存歌词文件 | USER §1/§2/§5.2.2/§5.2.3/§5.2.4/§5.2.7/§5.2.x；CORE §1/§4.1/§4.2/§4.23/§4.39/§4.40/§4.48/§4.x/§5；PROVIDER §3.3/§4.1；BUILD 存储 |
| B8 | 全局快捷键 | P2 | 设置页录制快捷键，主进程注册；Wayland 说明限制 | USER §1/§5.2.7；CORE §1/§4.1/§4.48/§5.1/§5.8 |
| B9 | libmpv / 原生播放引擎 | P3 | 评估触发条件；Linux 优先 mpv 子进程 + JSON IPC | USER §1/§5.2.7；CORE §1/§3/§4.1/§4.2/§4.27/§4.48/§5；PROVIDER §1/§3/§4.5；BUILD 运行依赖 |

优先级说明：**P0** 是发布前必须完成；**P1** 是核心体验与质量基线；**P2** 是明确要做但排在当前任务之后；**P3** 是条件触发或先做技术验证。

### 0.2 实施顺序

1. **A2**（一行级修改，先清掉明显不合理的返回目标）。
2. **A3**（启动参数影响所有后续运行环境，先稳定；BUILD 小节延后到 A4 创建 BUILD.html 后补）。
3. **A5**（测试基线；A6、B3、B5、B7 都要靠 fixture 固定上游行为；BUILD 小节延后到 A4 后补）。
4. **A4**（Arch Linux tar.gz 打包、curl 安装脚本与 BUILD；发布与 AUR 后置，依赖 A5 的测试命令；同时创建 BUILD.html 骨架并收录 A3/A5 的 BUILD 小节，最后逐条验证）。
5. **A8**（工程常量集中到 `src/shared/constants.ts`；先迁移现有模块，后续 A1/A7/A6/B2 的新增常量直接写入该文件）。
6. **A1 + A7**（一起设计：缓存按页存储，第一页即渲染，后续分页补齐；完整且非 stale 后按当前模式增量追加队列）。
7. **A6**（复用 A1 的缓存/限流思路，并在 A7 的增量页上逐步探测；需要 A5 的 fixture；`PROBE_MAX_SONGS` 使用 A8 的派生常量）。
8. **B1**（低风险托盘打磨）。
9. **B2 / B8**（音频体磁盘缓存与快捷键，都是独立的基础体验）。
10. **B4**（QRC 逐字歌词；不做桌面歌词）。
11. **B5 / B7**（账号写入类功能与下载管理，依赖 A1 缓存失效与 A5 回放）。
12. **B3 / B6**（新上游内容类型；先探测接口）。
13. **B9**（只在 gapless / EQ / 响度归一成为硬需求时启动）。

---

## A. 当前任务

### A1 歌单缓存（甚至预加载）

**TODO 原文**

> 歌单缓存（甚至预加载）

**与 A7 的关系**

> A7 会把 `playlist.get` 改为“按页返回、后台补齐”。A1 的缓存层因此按“可增量填充的歌单”存储，而不是只缓存完整 `PlaylistDetail`；本节只定义缓存读写与预取，分页 IPC 与队列构建以 A7 为准。

**现状核对（main 分支）**

- `src/main/api/playlist.ts` 的 `getPlaylist` 每次都从上游分页拉全量，没有缓存。
- `PlaylistView.vue` 每次进入路由都重新 `playlist.get`；`LibraryView.vue` 只加载歌单列表，不预取详情。
- 现有 `song.ts` 只有 `mediaMidCache`，与歌单无关。
- 大歌单（数百至上千首）每次进入都要重复请求，返回体也大，首屏体感明显。

**目标**

- 已打开过的歌单再次进入时优先展示缓存，不阻塞在网络上。
- 缓存可跨进程重启；有容量上限与过期策略。
- 只对“我喜欢”歌单在后台预热第一页；不做悬停 / 聚焦预加载。
- 退出登录、切换账号、歌单被编辑后，缓存不得串号或过期展示。

**方案**

1. **缓存位置**：主进程。歌单详情本来就在主进程组装，缓存放主进程可避免渲染进程重复持有大对象，也便于统一失效。
2. **两层缓存**：
   - 内存缓存：命中快，进程退出即消失。
   - 磁盘 JSON：跨重启；按账号分目录，文件权限 `0600`，写入使用临时文件 + rename。
3. **缓存内容按页累积**：缓存条目保存 `meta`、已加载的 `songs`、`total`、`complete`、`fetchedAtMs`。允许只有第一页或前几页；A7 每成功加载一页就增量写入，`complete` 表示已到歌单末尾。
4. **策略**：stale-while-revalidate。
   - 未过期且完整：直接返回完整缓存。
   - 未过期但只缓存了部分页：先返回已缓存页，渲染后继续补页。
   - 已过期：先返回缓存并带 `stale: true`，渲染进程立即展示，再从第一页开始后台重验证。
   - 无缓存：A7 拉第一页，成功后写入缓存并渲染。
   - 后台刷新失败：保留旧缓存，用户可见提示“刷新失败，显示缓存内容”；不把整页打成错误态。
   - TTL 推荐 30_000 ms：缓存主要用于点开歌单时的即时呈现，不把减少请求作为目标；超过 TTL 即后台重验证。
5. **预加载**：`LibraryView` 加载“我的歌单”后，只对 `kind === 'favorites'` 的“我喜欢”歌单调用 `playlist.prefetch([id])`；**只预热第一页**，不预取全量；不做悬停 / 聚焦预加载；主进程去重、跳过新鲜缓存、失败静默。页获取并发由 `PLAYLIST_PREFETCH_CONCURRENCY` 控制：设计上允许同时获取多页，默认值 1（顺序）求稳，后续可提升到 3；A7 的后续页补齐复用同一限流。
6. **失效**：
   - TTL 到期。
   - 退出登录 / 切换账号：清空全部歌单缓存（至少清空当前账号作用域）。
   - 后续 B5 的歌单编辑成功后：按歌单 ID 失效。
   - 缓存 schema 版本不匹配：丢弃并重建。
7. **容量**：只缓存“我喜欢”一个歌单，因此不设条目数上限；`PLAYLIST_CACHE_MAX_BYTES` 作为单文件兜底（推荐 16 MiB）。超过字节上限时不落盘，只留内存。

**接口草案**

> `playlist.get`（按 `offset` 分页）的 IPC 契约由 A7 定义；A1 只提供缓存读写与预取。

```ts
// main/cache/playlist.ts（新增，模块内部类型，不跨 IPC）
export interface PlaylistCacheEntry {
  meta: PlaylistMeta;
  songs: Song[];
  total: number;
  complete: boolean;
  fetchedAtMs: number;
}

export function readPlaylistCache(scope: string, id: string): PlaylistCacheEntry | null;
export function writePlaylistCache(scope: string, entry: PlaylistCacheEntry): Promise<void>;
export function invalidatePlaylistCache(id: string): Promise<void>;
export function clearPlaylistCache(): Promise<void>;

declare const PLAYLIST_CACHE_TTL_MS: number;        // 推荐值 30_000 ms；以交互体验为主，仍及时更新
declare const PLAYLIST_CACHE_MAX_BYTES: number;     // 推荐值 16 × 1024 × 1024
declare const PLAYLIST_PREFETCH_CONCURRENCY: number; // 推荐值 1；限制同时获取多页的并发，保留提升到 3 的能力，默认求稳
```

**“我喜欢”歌单识别**

上游 `v_playlist` 中“我喜欢”不是靠列表位置标识的，而是固定 `dirId = 201`、名称通常为“我喜欢”。实现约定：

- `shared/types.ts` 增加 `PlaylistKind = 'normal' | 'favorites'`，`PlaylistMeta` 增加 `kind: PlaylistKind`。
- `listMine` 遇到 `dirId === 201`（兼容 `dirid`；名称“我喜欢”作为兜底判断）时输出 `{ id: 'liked', kind: 'favorites', name: '我喜欢' }`；普通歌单 `kind = 'normal'`，`id` 保持现有回退链。
- `fetchPlaylistPage` 对 `id === 'liked'` 使用 `CgiGetDiss { disstid: 0, dirid: 201, ... }`；普通歌单继续使用 `disstid: id`。
- 搜索结果的 `PlaylistMeta` 一律 `kind = 'normal'`。
- 缓存键使用 `liked`，与其他歌单的按页缓存一致。
- `LibraryView` 只对 `kind === 'favorites'` 的歌单预取第一页；不依赖它是否排在列表第一。

**文档动作**

| 文档 | 位置 | 动作 | 内容 |
|---|---|---|---|
| README | §2 用户交互 · 歌单 | 修订 | 再次进入已打开歌单时先显示上次内容并在后台刷新；只后台准备“我喜欢”第一页，不阻塞列表。 |
| USER | §1 TERMS | 新增 | “我喜欢（收藏歌单）”：固定收藏歌单，不依赖列表位置。 |
| USER | §2 CONVENTIONS | 新增 | 歌单加载与后台刷新：再次进入先显示上次内容；第一页成功即显示；刷新失败保留已显示内容并提示；只后台准备“我喜欢”第一页；退出登录清空本机歌单数据。 |
| USER | §5.2.8 页面结构 | 修订 | 歌单详情：再次进入先显示上次内容；错误态只用于第一页无内容可显示；收藏歌单展示名称“我喜欢”；不新增刷新按钮。 |
| CORE | §1 File tree | 修订 | 新增 `src/main/cache/playlist.ts`；§4 后续小节编号顺延。 |
| CORE | §2 CONVENTIONS | 新增 | 缓存键、账号作用域、过期 / 字节上限策略（具体值见 `shared/constants.ts`）、页获取并发、按页累积、失效时机；凭证与播放链接不入缓存。 |
| CORE | §4.1 types.ts | 修订 | `PlaylistKind`、`PlaylistMeta.kind`；收藏歌单使用虚拟 ID `liked`。 |
| CORE | §4.12 playlist.ts | 修订 | `listMine` 标记 `dirId=201`；`fetchPlaylistPage` 对 `liked` 使用 `dirid:201`；缓存读写；`prefetchPlaylists` 只取第一页。 |
| CORE | §4.45 LibraryView.vue | 修订 | “我的歌单”加载完成后调用 `prefetchPlaylists`，只准备“我喜欢”第一页。 |
| CORE | 新增 §4.x cache/playlist.ts | 新增 | 缓存读写、失效、清理；TTL / 字节上限 / 并发常量在 `shared/constants.ts` 声明，本模块只引用。 |
| CORE | 新增 §5.10 歌单缓存与预取 | 新增 | 预取“我喜欢”第一页、缓存命中 / 过期 / 未命中路径。 |
| CORE | §4.2 ipc.ts | 不新增 | 分页 IPC 类型由 A7 统一定义，A1 不重复声明。 |
| PROVIDER | §2 CONVENTIONS | 不动 | 内部缓存策略见 CORE §2/§4.x；上游契约不变。 |
| PROVIDER | §4.1 接口表 | 修订 | “我喜欢”读取使用 `CgiGetDiss` 的 `disstid:0` + `dirid:201`；普通歌单仍用 `disstid`。 |
| PROVIDER | §4.3 QqMineData / 转换 | 修订 | `dirId=201` / 名称“我喜欢”识别为收藏歌单；输出 `kind=favorites`、`id=liked`。 |
| BUILD | — | 不动 | 缓存目录由应用自动创建。 |

**实现步骤**

1. 新增缓存模块与单元测试（读写、按页累积、过期、字节上限、schema 校验）。
2. 配合 A7 把 `getPlaylist` 的分页循环拆成“单页抓取 + 缓存读写”；缓存模块不直接决定 IPC 返回形状。
3. 改 `listMine`：按 `dirId=201` / 名称识别“我喜欢”，输出 `kind=favorites`、`id=liked`；`fetchPlaylistPage` 处理 `liked`。
4. 改 `LibraryView`：只在“我的歌单”加载完成后预取“我喜欢”第一页；移除悬停 / 聚焦预取。
5. 接入退出登录 / 切换账号清理。
6. 用 fixture 覆盖：首次第一页、缓存完整命中、缓存部分命中、过期重验证失败、收藏歌单 `dirid:201`。

**验收**

- 第二次进入同一歌单时，已缓存页不再请求；未缓存页由 A7 继续补。
- 缓存过期时先出内容再更新；刷新失败保留缓存。
- 清空 `userData/cache` 后由 A7 从第一页重新开始，不在缓存层阻塞。
- 退出登录后，另一账号看不到旧账号歌单缓存。
- 1000 首歌单的缓存文件大小与读取耗时可接受；超过字节上限时不落盘，只留内存。
- “我喜欢”无论排在列表第几位都能被识别，并通过 `dirid:201` 打开。
- 预取只针对“我喜欢”第一页；悬停 / 聚焦其他卡片不产生请求。
- 预取失败不影响列表展示，也不产生重复请求。

---

### A2 歌单详情页返回我的歌单列表

**TODO 原文**

> 歌单详情页不需要返回搜索，需要的是返回我的歌单列表

**现状核对（main 分支）**

- `PlaylistView.vue` 正常态头部有“返回搜索”（`router.push('/search')`）。
- 加载失败态同时有“重试”和“返回搜索”。

**目标**

- 歌单详情页的所有返回入口都指向“我的歌单”（`/library`），不再回搜索。
- 从搜索页进入歌单后，返回动作也按本条规定去“我的歌单”；不保留来源栈返回。

**方案**

- 正常态头部按钮文案改为“返回我的歌单”，目标 `/library`。
- 错误态按钮同样改为“返回我的歌单”，目标 `/library`。
- 不新增 API、不改路由表。

**文档动作**

| 文档 | 位置 | 动作 | 内容 |
|---|---|---|---|
| USER | §5.2.8 页面结构 | 修订 | 歌单详情：“加载失败显示重试与返回我的歌单”；头部返回目标为我的歌单。 |
| CORE | §4.46 PlaylistView.vue | 修订 | 删除“返回搜索”描述；组件只保留职责一行，返回目标与按钮文案见 USER §5.2.8。 |
| README | — | 不动 | 不新增返回说明。 |
| PROVIDER | — | 不动 | 不涉及上游。 |

**实现步骤**

1. 修改 `PlaylistView.vue` 两处 `router.push('/search')` 为 `/library`。
2. 同步按钮文案。
3. 手动验证：正常进入、加载失败、搜索进入、直接 URL 进入四种路径。

**验收**

- 正常态与错误态的返回按钮都进入“我的歌单”。
- 不再出现“返回搜索”文案。
- 路由切换仍按既有规则关闭歌词 / 评论面板。

---

### A3 启动 flags 外部文件

**TODO 原文**

> 启动 flags：从外部 flags 文件读取用户自定义启动参数（覆盖默认）；无外部配置时使用个人默认（Wayland + gnome-libsecret 密钥环后端）

**现状核对（main 分支）**

- `src/main/index.ts` 在模块加载阶段硬编码 `password-store=gnome-libsecret`。
- `configureLinuxDisplay()` 依据 `--ozone-platform`、`LYCHEE_OZONE_PLATFORM`、`WAYLAND_DISPLAY` 决定 Wayland / X11。
- 没有外部 flags 文件；用户只能改环境变量或命令行。

**目标**

- 用户可以编辑一个可预测的配置文件，追加 / 覆盖 Electron / Chromium 启动参数。
- 没有配置文件时，使用内置默认：Wayland 会话优先 + `gnome-libsecret` 密钥环后端。
- 显式命令行参数优先级最高，避免“文件写死后无法临时覆盖”。
- 设置页展示当前 flags 文件并提供编辑入口；保存后提示“下次启动生效”。
- 不允许在 UI 中选择 flags 文件路径；路径只能由默认规则或命令行 `--flags-file` 决定。
- 所有参数在 `app.whenReady()` 之前生效；修改后需重启应用。

**方案**

1. **文件位置**：`$XDG_CONFIG_HOME/lychee-player/flags.conf`；未设置 `XDG_CONFIG_HOME` 时用 `~/.config/lychee-player/flags.conf`。
2. **覆盖入口**：支持 `--flags-file=<path>` 指定另一份文件；该参数由应用消费，不再下发给 Chromium。
3. **格式**：每行一个完整参数；空行与 `#` 开头的行忽略；行首尾空白裁剪；不支持 shell 引号与变量展开。
   - `--name=value` → `appendSwitch(name, value)`
   - `--name` → `appendSwitch(name)`
   - 不以 `--` 开头的行 → `appendArgument(line)`（位置参数）
   - 含空格的值必须写成 `--key=value`。
4. **示例**：

```text
# Lychee Player 启动参数（每行一个）
--ozone-platform=wayland
--enable-wayland-ime
--password-store=gnome-libsecret
--autoplay-policy=no-user-gesture-required
```

5. **优先级**（从高到低）：

| 优先级 | 来源 | 说明 |
|---:|---|---|
| 1 | 显式命令行 | 已出现在 `process.argv` 的开关不被文件覆盖。 |
| 2 | `--flags-file` / 默认 flags 文件 | 覆盖内置默认。 |
| 3 | 环境变量 `LYCHEE_OZONE_PLATFORM` | 仅用于显示后端；文件里已有 `ozone-platform` 时忽略。 |
| 4 | 内置默认 | 见下。 |
| 5 | Electron / Chromium 自身默认 | 应用不再干预。 |

6. **内置默认**：
   - Linux：`password-store=gnome-libsecret`、`autoplay-policy=no-user-gesture-required`。
   - 检测到 Wayland 会话（`XDG_SESSION_TYPE=wayland` 或 `WAYLAND_DISPLAY`）且没有显式 `ozone-platform`：`ozone-platform=wayland` + `enable-wayland-ime`。
   - 非 Wayland：不强制 `ozone-platform`，交给 Electron 自动选择，避免 X11 用户无法启动。
   - 若用户要求“无条件 Wayland”，在 flags 文件写 `--ozone-platform=wayland`。
   - KDE 等非 GNOME 环境可在文件里改用 `--password-store=kwallet6` / `kwallet`；`basic` 仅用于排障，会退化为弱保护。
7. **设置页展示与编辑**：
   - 设置页新增“启动参数”区块，展示当前生效的 flags 文件绝对路径与文件内容；文件不存在时显示空内容与示例占位。
   - 提供“编辑”按钮：进入文本编辑状态，保存时调用 `flags.save(content)` 写回当前生效文件；写入使用临时文件 + rename，保持 0600 权限。
   - 保存成功后 Toast“已保存，下次启动生效”；不在运行中热加载。
   - 不提供文件选择器 / 路径输入框；路径只能由默认规则或命令行 `--flags-file` 决定，UI 只读写当前生效文件。

8. **安全与健壮性**：
   - 文件最大 8 KiB / 64 行；超出截断并记录日志。
   - 拒绝 group / world-writable 的文件（防止本地其他用户注入 `--no-sandbox` 等危险参数）。
   - 解析失败的行跳过并记录；不让启动失败。
   - 只记录“读取了哪个文件、应用了多少条”，不记录凭证类值。

**接口草案**

```ts
// src/main/startup-flags.ts（新增）
export interface StartupFlag {
  kind: 'switch' | 'argument';
  name?: string;
  value?: string;
  raw: string;
}

export interface FlagsFile {
  path: string;
  content: string;
}

export function resolveFlagsFile(argv: string[]): string;
export function parseFlagsFile(text: string): StartupFlag[];
export function applyStartupFlags(flags: StartupFlag[]): void;
export function applyDefaultFlags(): void;
export function readFlagsFile(): Promise<FlagsFile>;
export function writeFlagsFile(content: string): Promise<void>;

declare const STARTUP_FLAGS_MAX_BYTES: number; // 推荐值 8 × 1024
declare const STARTUP_FLAGS_MAX_LINES: number; // 推荐值 64
```

```ts
// shared/ipc.ts
flags: {
  get(): Promise<IpcResult<FlagsFile>>;
  save(content: string): Promise<IpcResult<null>>;
};
```

**文档动作**

| 文档 | 位置 | 动作 | 内容 |
|---|---|---|---|
| README | §2 用户交互 | 新增 | “启动参数”行：设置页可查看 / 编辑启动参数，修改后重启生效，链接 USER §2。 |
| USER | §2 CONVENTIONS | 新增 | “启动参数文件”：路径、格式、优先级、默认值、重启生效、安全边界。 |
| USER | §5.2.7 设置页 | 新增 | “启动参数”区块：展示当前文件路径与内容、编辑按钮、保存后提示“下次启动生效”；不提供路径选择。 |
| CORE | §1 File tree | 修订 | 新增 `src/main/startup-flags.ts`、`resources/flags.conf.example`。 |
| CORE | §2 CONVENTIONS | 新增 | 内部解析、应用时机、文件权限检查、UI 只读写当前生效文件；用户可见的路径 / 格式 / 优先级见 USER §2，不重复。 |
| CORE | §4.2 ipc.ts | 修订 | `flags.get` / `flags.save`，保存不接受路径参数。 |
| CORE | §4.4 index.ts | 修订 | 模块加载阶段调用 `resolveFlagsFile` / `applyStartupFlags` / `applyDefaultFlags`。 |
| CORE | §4.48 SettingsView.vue | 修订 | “启动参数”区块的展示、编辑、保存与“下次启动生效”提示；不提供路径选择。 |
| CORE | 新增 §4.x startup-flags.ts | 新增 | 解析、应用、默认值、`readFlagsFile` / `writeFlagsFile`；声明大小 / 行数常量（名称 + 用途，推荐值见注释）。 |
| CORE | §5.2 启动参数与单实例 | 重写 | 文件读取 → 文件参数应用 → 默认补齐 → 单实例锁；设置页保存不热加载。 |
| PROVIDER | — | 不动 | Electron / Chromium 属于运行时依赖，不进入上游边界文档。 |
| BUILD | 第 10 章（A4 创建后补） | 新增 | flags 文件路径、示例、打包后覆盖方式。 |

**实现步骤**

1. 新增 `startup-flags.ts` 与解析单测。
2. 在 `app.setName` 之后、`configureLinuxDisplay` 之前读取文件。
3. 先应用命令行中已存在的开关判断，再应用文件，再补默认。
4. 替换现有硬编码 `password-store` 与 `configureLinuxDisplay` 分支。
5. 提供 `resources/flags.conf.example`，打包时作为参考（不自动安装到用户目录）。
6. 新增 `flags.get` / `flags.save` IPC；设置页展示当前路径与内容，编辑保存后提示下次启动生效；不提供路径选择。
7. 文档补 USER / CORE / BUILD。

**验收**

- 无文件：Wayland 会话使用 Wayland + IME；X11 会话正常启动；密码库为 `gnome-libsecret`。
- 文件写 `--ozone-platform=x11`：Wayland 会话也按 X11 启动。
- 文件写 `--password-store=basic`：覆盖默认；启动日志提示已读取文件。
- 命令行 `--ozone-platform=x11` 覆盖文件中的 `wayland`。
- 损坏 / 超长 / 权限异常文件不会阻止启动。
- 修改文件后重启生效；运行中不热加载。
- 设置页显示当前生效文件路径与内容，编辑保存后提示“下次启动生效”；没有路径选择入口。
- `--flags-file` 指定的路径在设置页只读展示并可编辑该文件；UI 不能切换路径。
- 保存只校验大小 / 行数，内容原样写入；非法行在下次启动时按解析规则跳过。

---

### A4 Arch Linux 打包：AUR-ready tar.gz + curl 安装脚本 + BUILD.html

**需求**

> 只支持 Arch Linux x86_64。AUR 发布暂不做，真实发布流程现在不提；当前只产出可在 GitHub 发布 tar.gz 的包，并保证后续能直接接入 AUR。

**现状核对（main 分支）**

- `package.json` 只有 `dev` / `start` / `build` / `typecheck` / `probe` 脚本，没有 electron-builder。
- 没有 `electron-builder.yml`、`build/` 资源目录，也没有面向 Arch 的 tar.gz 打包脚本。
- `BUILD.html` 不存在。

**目标**

- 面向 Arch Linux x86_64 产出可分发的 `tar.gz`。
- 产物布局固定、可重定位，后续可直接作为 AUR `-bin` 包的 `source`，不需要重新设计 tarball。
- 提供 POSIX sh 的 `install.sh`，允许不依赖包管理器、用 `curl ... | sh` 一行安装到用户目录。
- `BUILD.html` 覆盖开发、构建、打包、手动运行、curl 安装、依赖与排障。
- 当前不做：AUR PKGBUILD / AUR 发布、GitHub Release 自动发布、deb / rpm / AppImage / arm64。

**方案**

1. **产物契约**：

```text
lychee-player-<version>-x86_64.tar.gz
└── lychee-player/
    ├── lychee-player              # 可执行文件
    ├── resources/                 # 图标、xlogin 等运行资源
    ├── LICENSE
    ├── lychee-player.desktop
    └── lychee-player.png
```

   - 文件名版本与 `package.json` 一致，不带 `v` 前缀，便于未来 `pkgver` 直接取用。
   - 顶层目录固定为 `lychee-player/`，解压后可直接放在 `/opt/lychee-player`。
   - `.desktop` 中 `Exec=lychee-player`、`Icon=lychee-player`，未来由 AUR 安装到 `/usr/share/...` 并创建 `/usr/bin` 符号链接。
   - 不把 `node_modules`、源码、测试、构建缓存打进 tarball。

2. **构建方式**：
   - `electron-builder` 只配置 Linux `dir` 目标；不配置 deb / rpm / AppImage / pacman。
   - `npm run package:arch` 执行：`npm run build` → `electron-builder --linux dir` → 整理为 `dist/lychee-player/` → 生成 tarball 与 `sha256sum`。
   - `scripts/package-arch.mjs` 负责目录整理、补 `.desktop` / 图标 / LICENSE、生成校验和；避免把打包步骤散落在其他脚本里。
   - `build/` 只放 electron-builder 需要的图标资源。

3. **免包管理器安装脚本**：`install.sh`（POSIX sh，`curl ... | sh` 可用）
   - README 提供一行安装：

```sh
curl -fsSL https://raw.githubusercontent.com/<owner>/lychee-player/main/install.sh | sh
curl -fsSL https://raw.githubusercontent.com/<owner>/lychee-player/main/install.sh | sh -s -- --version 0.1.0
curl -fsSL https://raw.githubusercontent.com/<owner>/lychee-player/main/install.sh | sudo sh -s -- --system
```

   - 脚本为 POSIX sh，`curl ... | sh` 与 `curl ... | bash` 都可用；仅支持 Arch Linux x86_64，脚本检查系统、架构与 `curl` / `tar` / `sha256sum`。
   - 默认按用户安装，不需要 sudo：
     - 程序目录：`${XDG_DATA_HOME:-$HOME/.local/share}/lychee-player`
     - 可执行入口：`~/.local/bin/lychee-player`
     - 桌面文件：`~/.local/share/applications/lychee-player.desktop`
     - 图标：`~/.local/share/icons/hicolor/512x512/apps/lychee-player.png`
   - `--system` 系统级安装（需要 root / sudo）：
     - 程序目录：`/opt/lychee-player`
     - 可执行入口：`/usr/bin/lychee-player`
     - 桌面文件：`/usr/share/applications/lychee-player.desktop`
     - 图标：`/usr/share/icons/hicolor/512x512/apps/lychee-player.png`
     - 许可证：`/usr/share/licenses/lychee-player/LICENSE`
   - 参数：`--version <ver>`（默认 GitHub 最新 Release）、`--prefix <dir>`、`--system`、`--uninstall`、`--dry-run`；`LYCHEE_BASE_URL` 用于测试本地 / 镜像资产。
   - 下载 tarball 与 `sha256sum`，校验通过后解压到临时目录，再原子替换安装目录；`--uninstall` 只删除程序、桌面文件与图标，不删除设置 / 缓存。
   - `.desktop` 的 `Exec` 重写为安装目录的绝对路径，避免 `~/.local/bin` 不在 PATH 时无法从桌面启动。
   - 安全：校验和缺失或不匹配直接失败；文档同时给出“先下载脚本检查再执行”的方式，不强制管道执行。

4. **AUR 接入预留**（现在不写 PKGBUILD）：

| AUR 未来需要 | 当前产物保证 |
|---|---|
| 稳定的 `source` URL | GitHub Release 资产名固定为 `lychee-player-<version>-x86_64.tar.gz` |
| `pkgver` | 文件名与 `package.json` 版本一致，不带 `v` |
| 安装到 `/opt/lychee-player` | tarball 顶层目录固定、内容可重定位 |
| `.desktop` / 图标 / LICENSE | 已包含在 tarball |
| 运行期依赖 | BUILD 列出 Arch 包名，未来 PKGBUILD 直接抄 |
| `chrome-sandbox` 权限 | BUILD 说明需要 `4755 root:root`；由未来 PKGBUILD 设置 |
| 校验和 | 每次打包生成 `sha256sum` |

5. **发布边界**：
   - 分发形态定为 GitHub Release 的 tar.gz。
   - 本次只保证“能产出这个资产”，不配置标签触发、Release 上传、签名、自动更新或 AUR 推送。
   - 后续接入 AUR 时，只需新增 PKGBUILD / `.SRCINFO` 和发布 workflow，不改 tarball 结构。
6. **BUILD.html 大纲**（开发完成后写，不在设计阶段写死细节）：

| 章节 | 内容 |
|---|---|
| 1. 环境要求 | Arch Linux x86_64；`base-devel`、`nodejs`、`npm`；运行期 GTK / libsecret / NSS / ALSA / D-Bus。 |
| 2. 开发运行（A5 测试小节） | `npm ci`、`npm run dev`、类型检查、测试、探针。 |
| 3. 构建 | `npm run build` 的产物目录与变量注入（版本 / 许可证）。 |
| 4. 打包 | `npm run package:arch`、`electron-builder --linux dir`、tarball 结构、校验和。 |
| 5. curl 安装 | `curl` 管道安装、`--version` / `--prefix` / `--system` / `--uninstall` / `--dry-run`、用户目录与 `/opt` 系统级布局、校验和失败处理。 |
| 6. 手动运行 | 解压 tarball、直接执行 `lychee-player`；运行期依赖列表。 |
| 7. 支持范围 | 仅 Arch Linux x86_64；其他发行版与 arm64 不在范围。 |
| 8. 后续 AUR | 产物如何映射到 `/opt`、`/usr/bin`、`.desktop`、图标、LICENSE；当前不提供 PKGBUILD。 |
| 9. 故障排查 | 沙箱 / `chrome-sandbox` 权限、Wayland、密钥环未解锁、缺库、curl / 校验和失败。 |
| 10. 启动参数（A3） | flags 文件位置与打包后的覆盖方式（与 A3 共用定义）。 |

**文档动作**

| 文档 | 位置 | 动作 | 内容 |
|---|---|---|---|
| BUILD | 新文件 | 新增 | 创建 BUILD.html，收录 A3 启动参数与 A5 测试小节；按上方大纲编写，按需链接 USER / CORE / PROVIDER，不设置顶部互链；最后逐条验证。 |
| README | §1.2 GOAL / §2 用户交互 | 修订 / 新增 | 明确当前仅支持 Arch Linux x86_64；新增“curl 一行安装 / 下载 tar.gz 手动运行”行并链接 BUILD。 |
| CORE | §1 File tree | 修订 | 增加 `electron-builder.yml`、`build/`、`scripts/package-arch.mjs`、`packaging/arch/lychee-player.desktop`、`install.sh`。 |
| CORE | §3 SBOM | 修订 | 增加 `electron-builder`（构建期依赖）；不新增运行期依赖。 |
| CORE | §5 Call stack | 不动 | 打包是构建期行为，不进入运行时调用栈。 |
| USER / PROVIDER | — | 不动 | 安装与运行细节归 BUILD，不重复。 |

**实现步骤**

1. 安装 `electron-builder`，配置只生成 Linux `dir`；添加 `package:arch` 脚本。
2. 补 `build/` 图标与 `packaging/arch/lychee-player.desktop`。
3. 编写 `scripts/package-arch.mjs`：整理 `dist/lychee-player/`、补 LICENSE / 图标 / desktop、打 tar.gz、生成 sha256。
4. 编写 `install.sh`（POSIX sh）：版本 / 前缀 / 校验和 / 原子安装 / 卸载 / dry-run；用本地 tarball 与 `LYCHEE_BASE_URL` 测试。
5. 在 Arch Linux x86_64 上解压 tarball 并运行 `install.sh --version ...`，验证安装、桌面入口、卸载；不依赖 pacman。
6. 最后写 BUILD.html，逐条执行其中的命令验证。
7. 更新四份文档的链接与 CORE 文件树 / SBOM。

**验收**

- `npm run package:arch` 产出 `dist/lychee-player-<version>-x86_64.tar.gz` 与 `sha256sum`。
- tarball 顶层为 `lychee-player/`；包含可执行文件、`resources/`、`LICENSE`、`.desktop`、图标；不含源码 / `node_modules` / 测试。
- 在干净 Arch Linux x86_64 上解压后可启动；若 Chromium 沙箱因 `chrome-sandbox` 权限拒绝，按 BUILD 说明处理（用户命名空间，或未来 AUR 设为 `4755 root:root`）。桌面文件可直接用于未来的 `/usr/share/applications`。
- tarball 可重定位：解压到任意目录仍能启动；未来放到 `/opt/lychee-player` 不需要改结构。
- `curl ... | sh` 可完成用户目录安装；`~/.local/bin/lychee-player`、桌面文件与图标可用；`--uninstall` 可清理程序文件且保留设置 / 缓存。
- `curl ... | sudo sh -s -- --system` 可安装到 `/opt/lychee-player`、`/usr/bin/lychee-player`、`/usr/share/applications` 与 `hicolor` 图标；`--system --uninstall` 可清理。
- 校验和缺失或不匹配时安装脚本拒绝安装；`--dry-run` 不写盘。
- `install.sh` 通过 `shellcheck`；在 Arch x86_64 容器中不依赖 pacman 完成安装 / 卸载测试。
- BUILD.html 中的命令从零可复现，不依赖未记录的环境变量。
- 仓库中不出现 AUR PKGBUILD / Release workflow / deb / rpm / AppImage / arm64 配置。
- 后续写 AUR `-bin` PKGBUILD 时，只需引用该资产、抄 BUILD 的依赖列表与安装路径，不需要改 tarball。

---

### A5 api 层 fixture 回放测试

**TODO 原文**

> 为 api 层补 fixture 回放测试，降低上游变更导致的回归成本

**现状核对（main 分支）**

- 没有 `test/` 目录、测试框架或 `npm test` 脚本。
- `src/main/api/` 的解析、分页、错误映射、重试逻辑全部依赖真实上游；上游字段一变，问题只能靠手测发现。
- `scripts/probe.mjs` 只做可达性探测，不校验解析结果。

**目标**

- 在无网络环境下回放真实上游响应，覆盖请求构造、字段映射、分页、错误映射与重试。
- 上游变更时，失败点能直接定位到具体接口 / 字段。
- fixture 不含凭证、Cookie、完整播放链接等敏感数据。
- 测试默认不访问真实上游。

**方案**

1. **框架**：Vitest（Node 环境），与 Vite / TS 配置一致；不引入 jsdom。
2. **回放层**：在测试中 stub 全局 `fetch`，按“请求匹配器”返回 fixture。
   - 匹配维度：host / path / HTTP method / `musicu` 的 `module` + `method` / 关键参数子集。
   - 支持顺序响应（第一次 429，第二次 200）用于重试测试。
   - 支持 HTTP 状态、原始文本（非法 JSON）、业务码。
3. **fixture 结构**：

```text
test/
├── api/
│   ├── client.test.ts
│   ├── search.test.ts
│   ├── song.test.ts
│   ├── playlist.test.ts
│   ├── lyric.test.ts
│   ├── comment.test.ts
│   ├── user.test.ts
│   └── login.test.ts
├── fixtures/
│   ├── musicu/
│   │   ├── search.song.json
│   │   ├── search.empty.json
│   │   ├── song.detail.json
│   │   ├── song.vkey-fallback.json
│   │   ├── playlist.page-1.json
│   │   ├── playlist.page-2.json
│   │   ├── playlist.liked.json
│   │   ├── lyric.empty.json
│   │   ├── comment.page.json
│   │   ├── vip.json
│   │   └── login.refresh.json
│   └── http/
│       ├── profile.json
│       └── retry-429.json
└── replay.ts
vitest.config.ts
```

4. **脱敏规则**：
   - `uin` / `musicid` / `openid` 替换为固定假值。
   - `musickey` / `qm_keyst` / `p_skey` / `refresh_token` 只保留字段名，值替换为 `REDACTED`。
   - `purl` 保留路径结构，查询串中的 `vkey` / `guid` 替换为假值；或直接改成相对路径。
   - 不记录真实 Cookie、手机号、头像 URL 中的用户标识。
5. **覆盖用例**：

| 模块 | 必测点 |
|---|---|
| client | 200 正常、HTTP 429 重试、HTTP 500 重试、超时、非法 JSON、缺少 `req_0`、未知业务码。 |
| search | 四类搜索映射、空结果重试一次、分页与总数、字段缺失。 |
| song | 详情缺 `track_info`、`media_mid` 缓存、vkey 逐档回退、全部无 `purl` → `NO_STREAM`。 |
| playlist | 单页、多页补齐、`songnum` 与实际条数不一致、空歌单、非法 ID、收藏歌单 `dirid:201`。 |
| lyric | 正常 LRC、`-1901` 空歌词、翻译为空、base64 / 非 base64。 |
| comment | 字段映射、空正文过滤、`HasMore`、时间戳秒 / 毫秒。 |
| user | 昵称回退 musicid、头像 http → https、VIP 各字段组合。 |
| login | Cookie 解析、资料校验失败、refresh 字段映射、过期时间计算。 |

6. **fixture 录制脚本**：提供 `scripts/record-fixtures.mjs`，仅在显式环境变量下访问真实上游，输出后由人工脱敏；默认不运行、不写入仓库。录制脚本与回放测试一起交付。
7. **网络隔离**：禁止测试代码读取真实环境变量或发起未 stub 的请求。

**文档动作**

| 文档 | 位置 | 动作 | 内容 |
|---|---|---|---|
| CORE | §1 File tree | 修订 | 增加 `test/` 子树、`vitest.config.ts`、`scripts/record-fixtures.mjs`；测试文件不逐个链接 §4。 |
| CORE | §2 CONVENTIONS | 新增 | “fixture 回放”：请求匹配、脱敏、录制与更新流程、禁止真实网络。 |
| CORE | §3 SBOM | 修订 | 增加 `vitest`（开发期依赖）。 |
| BUILD | 第 2 章测试小节（A4 创建 BUILD 后补） | 新增 | `npm test`、`npm run test:watch`、`scripts/record-fixtures.mjs` 用法。 |
| PROVIDER | §2 CONVENTIONS | 不动 | fixture 属于 CORE 测试约定，不改变上游契约；不复制完整上游文档。 |
| USER | — | 不动 | 测试对用户不可见。 |

**实现步骤**

1. 安装 Vitest，添加 `test` / `test:watch` 脚本与配置。
2. 实现 `test/replay.ts`：fetch stub、请求匹配、顺序响应、断言辅助。
3. 先覆盖 `client.ts` 与 `musicu`，再按模块补 fixture。
4. 实现 `scripts/record-fixtures.mjs`：显式开关下录制、输出到临时目录、提示人工脱敏。
5. 把现有手工验证过的真实响应脱敏后入库。
6. 保证 `npm test` 在无网络环境下通过。
7. 文档补 CORE §1/§2/§3 与 BUILD。

**验收**

- `npm test` 在断网环境全绿。
- 删除任一关键字段的 fixture，对应测试失败且错误码符合预期。
- fixture 中搜索不到真实凭证、Cookie、完整播放链接。
- 重试测试使用假时钟，不产生真实等待。
- `scripts/record-fixtures.mjs` 默认不联网；只有显式开关才录制，并提示脱敏。

---

### A6 歌单不可播预检 + 最高可用音质

**TODO 原文**

> 提前探测歌单内不可用的歌（顺便探测歌曲最高可用音质）。如果API只支持单首歌提取的话，加入并发限制，防止大歌单并发数爆炸

**现状核对（main 分支）**

- 只有点击播放时才走 `song.getUrls`；歌单列表不知道哪些歌不可播。
- `getStreamUrls` 内部用 `mapLimit(..., 4, fetchTrack)` 取详情；vkey 支持批量，但 `get_song_detail_yqq` 是单首请求。
- 没有“最高可用音质”概念；实际音质只是请求档位 + 回退结果。
- `SongTable` 没有可用性状态；不可播只能在播放失败后从 Toast 得知。

**目标**

- 歌单加载后，逐步标记每首歌：可播 / 不可播 / 最高可用音质。
- 不阻塞页面；大歌单不产生并发风暴；离开页面后停止继续探测。
- 用户点击前就能看到不可播歌曲；点击不可播歌曲时不再发起无意义的播放请求。
- A6 本身不改变播放失败规则；队列内不可播的处理由 A7 / 播放条定义。

**方案**

1. **数据模型**：

```ts
export interface SongAvailability {
  songMid: string;
  playable: boolean;       // 当前账号是否可播
  maxQuality: Quality | null; // 最高可用档位；不可播为 null
  checkedAtMs: number;
}

export interface ProbeOptions {
  force?: boolean;
}
```

2. **探测算法**（主进程）：
   - 入参去重、过滤空 `songMid`，单次最多 30 首（`PROBE_MIDS_MAX`）。
   - 先查缓存（按 `musicid|songMid`，TTL 10 分钟）；命中直接返回。
   - 未命中：用 `get_song_detail_yqq` 取详情，**并发 2**（`PROBE_DETAIL_CONCURRENCY`）；`media_mid` 顺手写入现有缓存。
   - 从详情的 `file` 尺寸字段（`size_128mp3` / `size_320mp3` / `size_flac` 等，实际字段以 fixture 为准）推候选最高档；若上游不返回尺寸，则按 `flac → 320k → 128k` 逐档探测。
   - 按候选档分组调用 `CgiGetVkey`，单批最多 20 首（`PROBE_VKEY_BATCH`）；`purl` 非空即记录；未命中的歌曲降一档继续，直到 `128k`。
   - 单曲不可播不抛异常，返回 `playable: false`；整批网络 / 认证失败才抛 `IpcError`。
   - 结果写入缓存；`force` 跳过缓存。
3. **渲染进程调度**：
   - 新增 `useAvailability` composable，监听当前歌单歌曲集合。
   - 可见行优先（`IntersectionObserver`），每批 20–30 首调用 `song.probe`；剩余歌曲在 `requestIdleCallback` 中分批补探。
   - 路由离开 / 切换歌单时取消后续批次；主进程用请求令牌丢弃过期结果。
   - 手动刷新歌单时 `force` 重探。
4. **UI 规则**：
   - `SongTable` 增加 `availability` prop；行内显示最高可用音质小标签（`FLAC` / `320K` / `128K`），不可播行显示“不可播”并禁用播放入口。
   - 不可播行的“播放”“下一首播放”按钮都禁用；点击不发起播放、不插入队列。
   - 检测只更新歌单里歌曲的元数据，不修改播放队列、不移除歌曲、不改变当前歌曲，也不因检测结果改变已在队列中的歌曲的播放状态。队列中的歌曲按队列顺序播放，不论之后检测结果如何。
   - 队列过滤只发生在 A7 构建队列时：`appendPlaylistQueue` 按当时的 `playable !== false` 决定是否入队，未探测的“未知”按可播处理，不等待检测。A6 不参与队列运行期。
   - 预检失败（网络）不显示错误，只保持“未知”状态；未知状态不显示“检测中”占位，避免列表闪烁；点击播放仍按原路径尝试。
5. **限制**：
   - 与 A7 配合：每追加一页只探测新增歌曲，不等待全量；已探测结果随页缓存。
   - 预检不是播放许可的替代；真正播放前仍以 `song.getUrls` 结果为准。
   - 账号切换 / 退出登录清空探测缓存。
   - 不按固定前 N 首截断：采用可见优先 + 空闲补探，全部歌曲最终覆盖；`PROBE_MAX_SONGS = PLAYLIST_PAGE_SIZE * PLAYLIST_PAGE_MAX`（当前 50 × 20000 = 1,000,000），与 A7 歌单最大容量一致，不设固定值。

**接口草案**

```ts
// shared/ipc.ts
song: {
  getUrls(mids: string[], quality: Quality): Promise<IpcResult<UrlResult[]>>;
  probe(mids: string[], options?: ProbeOptions): Promise<IpcResult<SongAvailability[]>>;
};
```

```ts
// src/main/api/availability.ts（新增）
export function probeAvailability(
  mids: string[],
  options?: ProbeOptions
): Promise<SongAvailability[]>;
export function clearAvailabilityCache(musicid?: string): void;

declare const PROBE_MIDS_MAX: number;          // 推荐值 30
declare const PROBE_DETAIL_CONCURRENCY: number; // 推荐值 2
declare const PROBE_VKEY_BATCH: number;        // 推荐值 20
declare const PROBE_CACHE_TTL_MS: number;      // 推荐值 10 × 60_000 ms
declare const PROBE_MAX_SONGS: number;         // = PLAYLIST_PAGE_SIZE * PLAYLIST_PAGE_MAX；不是固定值
```

同时把 `song.ts` 的取流逻辑抽成可复用函数：

```ts
export function resolveStreamUrls(
  mids: string[],
  requested: Quality
): Promise<Map<string, { url: string; quality: Quality }>>;
export function getStreamUrls(mids: string[], quality: Quality): Promise<UrlResult[]>;
```

**文档动作**

| 文档 | 位置 | 动作 | 内容 |
|---|---|---|---|
| README | §2 用户交互 · 歌单 | 修订 | 歌单列表逐步标记不可播与最高可用音质。 |
| USER | §1 TERMS | 新增 | “不可播标记”“最高可用音质”。 |
| USER | §2 CONVENTIONS | 新增 | 不可播标记与最高可用音质逐步出现、不阻塞列表；不改变播放失败规则。 |
| USER | §5.2.4 歌曲列表 | 修订 | 不可播行样式、最高可用音质标签、播放入口禁用；≤900px 布局不新增列。 |
| USER | §5.2.8 歌单详情 | 修订 | 不显示检测进度 / “检测中”；显示未知 / 不可播状态；刷新时重新检测。 |
| USER | §5.2.9 播放队列 | 不动 | 队列规则由 A7 定义；A6 只更新歌单歌曲元数据，不改变队列。 |
| USER | §5.3 错误与通知 | 注 | 不可播标记获取失败静默；播放失败仍按现有提示。 |
| CORE | §1 File tree | 修订 | 新增 `src/main/api/availability.ts`、`src/renderer/composables/availability.ts`。 |
| CORE | §2 CONVENTIONS | 新增 | 渐进探测、批次上限、账号作用域、网络失败语义；具体值见 §4.x 常量。 |
| CORE | §4.1 types.ts | 修订 | `SongAvailability`、`ProbeOptions`。 |
| CORE | §4.2 ipc.ts | 修订 | `song.probe` 通道。 |
| CORE | §4.11 song.ts | 修订 | `resolveStreamUrls` 抽取；探测复用。 |
| CORE | §4.29 player.ts | 不动 | 队列由 A7 负责；A6 不修改队列、不因检测结果移除歌曲或改变当前播放。 |
| CORE | §4.39 SongTable.vue | 修订 | `availability` prop 与不可播状态；禁用播放 / 下一首按钮。 |
| CORE | §4.46 PlaylistView.vue | 修订 | 接入 `useAvailability`，按当前歌单歌曲集合触发探测。 |
| CORE | 新增 §4.x availability.ts | 新增 | 探测、缓存、清理；声明批次 / 并发 / TTL 常量；`PROBE_MAX_SONGS = PLAYLIST_PAGE_SIZE * PLAYLIST_PAGE_MAX`，直接写入 A8 的 `shared/constants.ts`。 |
| CORE | 新增 §5.11 歌单可用性检测 | 新增 | 可见行 → `song.probe` → `availability::probeAvailability` → `get_song_detail_yqq` / `CgiGetVkey` → 缓存；UI 状态由返回结果驱动。 |
| PROVIDER | §2 CONVENTIONS | 不动 | 内部探测策略见 CORE §2/§4.x；上游契约不变。 |
| PROVIDER | §3.3 播放链接协议 | 不动 | 复用现有播放链接协议；音质回退已由 §2 定义，不重复。 |
| PROVIDER | §4.1 接口表 | 不动 | 不新增接口；仍为 `get_song_detail_yqq` + `CgiGetVkey`。 |
| PROVIDER | §4.3 QqSong / 转换 | 修订 | 在 fixture 验证通过后补 `file.size_128mp3` / `size_320mp3` / `size_flac`；只记录字段与尺寸 → 候选档位映射，探测策略见 CORE §4.x。 |
| BUILD | — | 不动 | 无新增运行期依赖。 |

**实现步骤**

1. 扩展 `scripts/probe.mjs` 验证详情返回的 file 尺寸字段；把样例写入 fixture。
2. 抽取 `resolveStreamUrls`，保证 `getStreamUrls` 行为不变。
3. 新增 `availability.ts`：缓存、并发、分档探测、批量。
4. 新增 IPC 与 preload 类型。
5. 新增 `useAvailability`，接入 `PlaylistView` / `SongTable`。
6. 处理不可播点击与路由取消；队列过滤由 A7 的 `appendPlaylistQueue` 负责，A6 不修改 `player.ts`。
7. 用 A5 的 fixture 覆盖：详情缺字段、最高档无权限、逐档回退、全部不可播、并发上限。

**验收**

- 1000 首歌单进入后页面立即可用；可见行优先完成标记，后台逐步补齐。
- 详情并发不超过 2，vkey 单批不超过 20；不出现数百并发请求。
- 最高可用音质与手动逐档播放结果一致。
- 不可播歌曲在列表中可识别，播放 / 下一首按钮禁用，点击不发起播放、不进入队列。
- 检测结果晚到不修改已有队列；A6 不因检测结果移除队列歌曲或改变队列顺序。
- 播放失败规则保持不变；切换歌单 / 离开页面后不再继续请求；缓存命中后重复进入不再请求。
- 账号切换后旧账号的探测结果不生效。

---

### A7 歌单后台分页加载与队列构建

**新增需求（2026-10-21）**

> 列表采用后台分页加载策略。如果无缓存的情况下，分页加载的第一页加载成功即渲染歌单，后续歌单慢慢补全。这里需要注意一个实现细节：如果我马上开始播放，就以当前已有的歌单入队列；等歌单加载完成（或半路失败）后再刷新一遍队列，这一点同样适用有缓存的情况。

> 2026-10-22 调整：不再用“已加载部分”作为队列；先选当前歌曲立即播放，队列从播放起存在但为空；完整且非 stale 后按当前歌曲位置增量追加。分页固定 50 首/页，开始后补全不会取消并写入缓存。

**现状核对（main 分支）**

- `src/main/api/playlist.ts` 的 `getPlaylist` 在 `for` 循环里拉完所有页才返回，`PlaylistView` 在此之前一直显示整页 loading。
- `PlaylistDetail.songs` 是一次性完整数组；`PlaylistView` 的 `songs` computed 直接喂给 `player.playList`。
- 播放器没有“歌单正在构建队列”的状态；加载中途开始播放时，队列只能基于当时的数组。

**目标**

- 无缓存时：第一页（50 首）成功即渲染歌单头图、元数据与第一页歌曲；后续页在后台顺序补齐。
- 有缓存时：立即渲染已缓存页（完整或部分），按缓存新鲜度决定是否后台重验证；后续页从缓存末尾继续。
- 开始播放时不使用半截队列：先选当前歌曲立即播放；完整加载前队列为空。
- 整个歌单加载完成且非 stale 后，按当前歌曲位置增量追加播放队列；当前歌曲、播放进度不变，已知不可播歌曲不入队。
- 一旦开始补全就不会取消：离开页面、切换歌单、网络失败都不取消补全；逐页写缓存，下次打开从缓存末尾继续。
- 不产生重复歌曲，旧响应不能覆盖新列表。

**方案**

1. **分页数据模型**：

```ts
export interface PlaylistPage {
  meta: PlaylistMeta;
  songs: Song[];
  offset: number;       // 本页第一首在歌单中的偏移
  total: number;        // 上游 songnum
  hasMore: boolean;
}

export interface PlaylistPageResult {
  page: PlaylistPage;
  fetchedAtMs: number;
  stale: boolean;
  fromCache: boolean;
}
```

2. **IPC 采用拉取式分页**：

```ts
playlist: {
  get(id: string, options?: { offset?: number; force?: boolean }): Promise<IpcResult<PlaylistPageResult>>;
  prefetch(ids: string[]): void; // 只预热第一页
};
```

- `offset` 默认 0；后续页用上一页的 `offset + songs.length`。
- `meta` 以第一页为准；后续页若返回 `dirinfo` 则更新，否则沿用第一页。
- **固定 50 首/页**；`PLAYLIST_PAGE_SIZE` / `PLAYLIST_PAGE_MAX` 的具体值只在 `shared/constants.ts` 的签名注释中给推荐值（50 / 20000；后者仅作异常分页兜底）。
- `hasMore = songs.length > 0 && offset + songs.length < total`；只有空页或 `hasMore === false` 时结束；返回不足一页但仍有剩余时继续翻页，避免死循环。
- 页获取并发由 `PLAYLIST_PREFETCH_CONCURRENCY` 控制（默认 1，即顺序；保留提升到 3 的能力）；主进程按 `offset` 取缓存或上游。
- 收藏歌单 `id === 'liked'` 仍走同一分页接口，主进程按 A1 的规则转换为 `disstid:0` + `dirid:201`。

3. **渲染进程状态**：新增 `stores/playlist.ts`（或等价 composable），持有当前歌单 feed：

```ts
type PlaylistLoadStatus = 'idle' | 'loading' | 'partial' | 'complete' | 'error';

interface PlaylistFeed {
  meta: PlaylistMeta | null;
  songs: Song[];
  total: number;
  status: PlaylistLoadStatus;
  stale: boolean;
  error: string;
  load(id: string): Promise<void>;
  retry(): Promise<void>;
}
```

- 第一页成功：写入 `meta` / `songs` / `total`；有后续页时 `status = 'partial'`，第一页即最后一页时直接 `complete`；两种情况都立即渲染。
- 后续页：逐页请求并追加；按 `songMid` 去重，保持上游顺序；全部完成 `status = 'complete'`。
- 中途失败：保留已加载歌曲，`status = 'partial'`，记录 `error`，按指数退避继续重试；列表底部显示“加载失败，正在重试”，不把部分数据当成最终队列。
- 第一页失败：`status = 'error'`，整页错误态 + 自动重试；有缓存第一页时先渲染缓存再重试。
- 每个 feed 带自增 `loadToken`；重新加载同一歌单时旧响应直接丢弃。
- **不因路由离开 / 切换歌单取消 feed**；feed 放在 store 中继续跑完并写缓存。
- **队列就绪条件**：`status === 'complete' && !stale`；stale 歌单的歌曲不进入队列，只显示列表。

4. **缓存路径（与 A1 配合）**：
   - 完整且新鲜缓存：直接渲染全部歌曲，`status = 'complete'`、`stale = false`；队列可立即构建。
   - 完整但过期缓存：直接渲染全部歌曲，`status = 'complete'`、`stale = true`；后台从第一页重验证，重验证完成前队列保持为空。
   - 新鲜的部分缓存：渲染已缓存页，`status = 'partial'`、`stale = false`；从 `offset = cached.songs.length` 继续补页。
   - 过期的部分缓存：先渲染已缓存页，`status = 'partial'`、`stale = true`；同时从第一页开始重验证已缓存页；以重验证后的实际长度为准，再从该位置继续补剩余页。
   - 每成功一页立即写入缓存；即使中途失败，已完成的页也不会丢失。
   - 下次打开同一歌单：从缓存末尾继续，不从头加载；完整且新鲜时直接进入可构建队列状态。

5. **队列构建**：

```ts
export interface QueueSource {
  kind: 'playlist';
  id: string;
}

// player store 内部状态
queueSource: QueueSource | null;
queueBuilding: boolean;

appendPlaylistQueue(current: Song, fullSongs: Song[]): void;
```

- **队列从播放开始就存在，但为空**：`playOrder = [current]`、`index = 0`；`queue` 为空，只显示当前歌曲。stale 歌单的歌曲不进入队列。
- 开始播放（播放全部 / 点击某首）：
  - 用户点击了具体歌曲：当前歌曲 = 该歌曲（点击不可播歌曲已被禁用）。
  - “播放全部”且当前模式为 `shuffle`：从当前已缓存 / 已加载歌曲中，按 `playable !== false` 过滤后随机选一首作为当前歌曲。
  - “播放全部”且为其他模式：当前歌曲 = 当前已缓存 / 已加载的、`playable !== false` 的第一首。
  - 选择池为空时提示“没有可播放歌曲”，不启动。
  - `queueBuilding = true`、`queueSource = { kind: 'playlist', id }`；立即 `loadAndPlay(current)`。
  - 若当前已有新鲜完整歌单数据，立即执行下面的增量构建；否则等 `status === 'complete' && !stale` 再执行。
- **无论是否加载完成，交互逻辑相同**：
  - 用户手动播放其它歌曲：替换当前歌曲为 `newCurrent`，清空队列（`playOrder = [newCurrent]`、`index = 0`），`queueBuilding = true`；若已有新鲜完整数据，立即从新当前歌曲位置增量构建，否则等加载完成。
  - 用户“下一首播放”：`addNext(song)` 按普通队列规则直接插入 `playOrder` 当前歌曲之后，不切歌、不写历史；这是手动加入队列的唯一入口，不另设“手动队列”层。
  - 播放队列面板显示当前歌曲与队列内容；加载期间队列可能为空，也可能有用户手动加入队列的歌曲。
- **增量构建 `appendPlaylistQueue(current, fullSongs)`**：只在 `status === 'complete' && !stale` 时执行，且只追加、不重建。
  - 取完整歌曲列表，按不可播规则过滤 `playable === false`。
  - 顺序 / 循环 / 单曲循环模式：按 `songMid` 找到当前歌曲在完整列表中的位置，候选 = 该位置之后的歌曲；**当前歌曲之前的歌曲不进入本次队列**。
  - 找不到当前歌曲：fallback 从完整列表第一首开始，候选 = 完整列表。
  - 随机模式：候选 = 完整列表中除当前歌曲外的所有歌曲，先随机打乱，再追加。
  - 过滤掉 `playOrder` 中已存在的 `songMid`（当前歌曲与用户手动加入队列的歌曲），避免重复。
  - 把候选追加到 `playOrder` 末尾；不调整 `index`、不移动当前歌曲、不重排已有队列。
  - 当前歌曲不在完整列表时仍保留在当前位；队列从歌单第一首开始追加，作为 fallback。
  - 完成后 `queueBuilding = false`；本次加载不再追加。
- 加载期间用户手动加入队列的歌曲始终保留在队列前部；随机模式的打乱只作用于本次追加的歌单候选块，不会与手动“下一首”冲突。
- 加载期间 `playNext()` 按实际队列执行：队列为空时停止；有手动加入队列的歌曲时正常播放。
- 顺序 / 循环模式队列只包含当前歌曲及其后歌曲；当前为队首且播放历史为空时 `previous` 回到 0；`repeat-all` 从队首（当前歌曲）回绕，不自动加入当前之前的歌曲。随机模式使用完整列表（除当前）打乱后追加。
- 若 `queueSource` 已不是该歌单（用户已切到别的来源播放），仍完成加载与缓存，但不追加队列。
- 播放条只对当前播放歌曲与队列负责；探测结果不直接改变播放条。当前歌曲不可播时，由播放条沿队列向后尝试下一首，直到可播或队列为空；探测结果只更新歌单歌曲元数据。

6. **播放历史与上一首**：

```ts
// player store 内部状态
playHistory: Song[]; // 已播放歌曲，旧 → 新；不包含 current

clearPlayHistory(): void;
previous(): void;
```

- 正常切歌由 `playNext()` 负责：手动下一首与自动续播都调用它；在确定要切换到下一首（含 `repeat-all` 回绕）时，先把原 `current` 追加到 `playHistory`。到队尾停止或单曲循环重播不写入历史。
- `addNext(song)` 只插队、不切歌、不写历史；`playAt(index)` 只做低层定位与加载，不写历史。
- **任何重建歌单队列的操作都清空 `playHistory`**：`playList`、`startPlaylistPlayback`、替换当前歌曲并清空队列。重建队列的初始播放不写入历史；清空发生在设置新队列之后。
- 分页增量追加不是重建，不清空历史。
- `previous()` 分支：
  - `playHistory` 非空：弹出最后一项并播放；当前歌曲不入历史；队列保持不重建。
  - `playHistory` 为空 + 顺序 / 列表循环 / 单曲循环：`seek(0)`，效果是重播当前歌曲。
  - `playHistory` 为空 + 随机模式：重建随机队列（当前歌曲作为队首锚点，完整歌单参与洗牌），清空历史（已为空），不重建当前音频。
- 历史中的歌曲若已不在当前 `playOrder`（极端手动编辑）：按“空历史”处理，避免凭空插入歌曲。
- 从歌单中间开始播放时，历史只累计本次播放开始后实际播放过的歌曲；当前歌曲之前的歌曲不会进入历史。

7. **补全不会取消**：
   - 一旦开始加载某歌单，就持续到 `complete`；离开页面、切换到其他歌单、网络失败都不停止。
   - 页失败使用指数退避重试（上限 30s）；只有应用退出会自然终止；切换歌单 / 离开页面不取消；下次打开从缓存末尾继续。
   - 后台补全任务按歌单串行执行，避免多个大歌单同时刷上游；已在补全的同一歌单不重复启动。
   - 已完成（`complete`）的缓存不再请求；`stale` 时先重验证再补差异。

8. **UI 契约**：
   - 歌单头图与第一页歌曲先出现；列表底部显示“正在加载剩余歌曲（已载入 x / 共 y）”。
   - 加载失败：底部显示“加载失败，正在重试”，已加载歌曲仍可播放；不出现终止性“部分加载完成”状态。
   - “播放全部”在第一页加载后即可用；开始播放后队列为空；`status = complete && !stale` 后按当前歌曲位置增量追加后续歌曲；stale 缓存期间队列保持为空。
   - 滚动位置不因追加页跳动；新页只追加，不重排已展示行。
   - 队列构建完成不弹 Toast；当前歌曲与播放进度保持不变。

**文档动作**

| 文档 | 位置 | 动作 | 内容 |
|---|---|---|---|
| README | §2 用户交互 · 歌单 | 修订 | 第一页即显示；队列从播放起为空，当前歌曲单独显示；歌单完整加载后自动补齐。 |
| USER | §1 TERMS | 新增 | “渐进加载”：第一页先显示，后续歌曲自动补齐；播放队列补齐规则见 §5.2.9。 |
| USER | §2 CONVENTIONS | 新增 | 第一页成功即显示；后续页自动补齐；歌单完整加载后，播放队列按当前歌曲位置自动补齐；已知不可播不入队。 |
| USER | §2 CONVENTIONS 播放失败 | 修订 | 区分“不可播（无可用流）沿队列向后尝试到可播或队列空”和“其他加载失败不自动跳下一首 / 不自动回退”。 |
| USER | §5.2.8 页面结构 | 修订 | 歌单详情：第一页渲染、底部加载 / 重试、已载入 / 总数；队列为空，当前歌曲单独显示。 |
| USER | §5.2.9 播放队列 | 修订 | 播放开始后队列为空，当前歌曲单独显示；手动“下一首播放”直接入队；歌单完整加载后自动补齐；未加载完整的歌单不进入队列；当前歌曲不可播时沿队列向后尝试到可播或队列空；上一首按播放历史回退。 |
| CORE | §1 File tree | 修订 | 新增 `src/renderer/stores/playlist.ts`（feed）；A1 的 cache 模块同步登记。 |
| CORE | §2 CONVENTIONS | 新增 | 页获取并发受 `PLAYLIST_PREFETCH_CONCURRENCY` 控制（默认 1 顺序，保留提升能力）、补全不会取消、队列构建状态；页大小 / 页上限见 `shared/constants.ts`，不在此重复。 |
| CORE | §4.1 types.ts | 修订 | `PlaylistPage`、`PlaylistPageResult`。 |
| CORE | §4.2 ipc.ts | 修订 | `playlist.get(id, { offset, force })`；`prefetch` 只取第一页。 |
| CORE | §4.12 playlist.ts | 修订 | 拆出 `fetchPlaylistPage`；单页抓取 + 缓存读写；不再在内部循环拉全量；复用 A1 的 `PLAYLIST_PREFETCH_CONCURRENCY`；`PLAYLIST_PAGE_SIZE` / `PLAYLIST_PAGE_MAX` 在 `shared/constants.ts` 声明（推荐值 50 / 20000 见注释），本模块只引用。 |
| CORE | §4.29 player.ts | 修订 | `QueueSource`、`queueSource` / `queueBuilding`；`startPlaylistPlayback`；`appendPlaylistQueue` 增量追加；`playHistory` / `clearPlayHistory` / `previous` 历史回退；`playNext(song)` → `addNext(song)`（下一首播放插队，不切歌、不写历史）；`next()` → `playNext()`（手动下一首与自动续播共用，切歌前写入历史；队尾停止/重播不写）；签名注释明确 `addNext` / `playNext` / `playAt` 的效果与适用场景；队列构建过滤不可播；播放条自行验证当前曲，不可播时沿队列向后尝试到可播或队列空，不读取探测结果。 |
| CORE | §5.5 播放单曲 | 修订 | 播放条自行验证当前曲；不可播时沿队列向后尝试到可播或队列空；其他加载失败仍按既有规则停止。 |
| CORE | §4.46 PlaylistView.vue | 修订 | 改用 feed；组件职责一行；第一页渲染、底部状态、startPlaylistPlayback 传 source、离开页面不取消 feed 等流程见 §5.12。 |
| CORE | 新增 §4.x stores/playlist.ts | 新增 | `PlaylistFeed` 状态、`load` / `retry`、`loadToken`、后台补全与缓存续传。 |
| CORE | 新增 §5.12 歌单分页加载与队列构建 | 新增 | 第一页请求 → 后续页请求 → 失败重试 → complete → `appendPlaylistQueue`；`playNext` / `previous` 历史；含缓存续传。 |
| PROVIDER | §2 CONVENTIONS | 不动 | 应用分页策略见 CORE §4.12；PROVIDER 只保留上游 `song_begin` / `song_num` 与单页上限。 |
| PROVIDER | §4.1 接口表 | 修订 | 注明分页偏移语义与 `dirinfo.songnum` 总数；收藏歌单 `dirid:201`。 |
| PROVIDER | §4.3 QqPlaylistData | 修订 | 明确 `songlist[]` 是单页结果；总数以 `dirinfo.songnum` 为准。 |
| BUILD | — | 不动 | 无新增运行期依赖。 |

**实现步骤**

1. 把 `getPlaylist` 拆成 `fetchPlaylistPage(id, offset)`，单页固定 50 首返回 `PlaylistPage`；保留字段映射与缓存。
2. 新增 `stores/playlist.ts`，实现第一页渲染、顺序补页、去重、`loadToken`、失败重试、后台补全与缓存续传。
3. 改 `PlaylistView`：绑定 feed，第一页立即渲染，底部加载 / 重试状态；`playAt` / 播放全部向 `startPlaylistPlayback` 传 `{ kind: 'playlist', id }`；离开页面不取消 feed。
4. 改 `player.ts`：增加 `queueSource` / `queueBuilding`；开始播放只放当前歌曲；`status === complete && !stale` 后按 `songMid` 定位当前歌曲并增量追加队列，保留手动“下一首播放”；过滤不可播歌曲；增加 `playHistory` 与播放历史的 `previous()` 分支；把 `playNext(song)` 重命名为 `addNext(song)`，`next()` 重命名为 `playNext()`，历史入队放在 `playNext()` 内。
5. 在 feed 就绪时调用 `appendPlaylistQueue`；`queueSource` 不匹配时只完成缓存，不改队列；重建队列时清空历史，增量追加时保留历史。
6. 与 A1 缓存、A6 预检联调：每追加一页只对新歌曲探测；完整加载后用最新可用性过滤队列。
7. 补 fixture：50 首/页、多页、页边界重复、空页、失败重试、缓存完整 / 部分 / 过期、收藏歌单 `dirid:201`。

**验收**

- 无缓存进入 1000 首歌单：第一页（50 首）返回后立即看到头图与歌曲，后续页在后台递增，页面不整页 loading。
- 第一页加载后立刻点“播放全部”或任意歌曲：当前歌曲立即播放，队列为空；完整且非 stale 后按当前歌曲位置增量追加，当前歌曲与播放进度不变。
- 从歌单中间开始播放：顺序模式下队列从当前歌曲之后开始，下一首不是列表第一首；当前歌曲找不到时从歌单第一首开始追加。
- 随机模式下“播放全部”从已缓存 / 已加载歌曲中随机选当前歌曲；完整加载后其余歌曲随机打乱后追加；手动“下一首播放”已加入的歌曲保留在前部。
- 播放过几首后按上一首：按播放历史逐首回退；历史为空且顺序 / 循环模式时回到 0 重播当前歌曲；历史为空且随机模式时以当前歌曲为队首重建随机队列。
- 点击其他歌曲 / 重建歌单队列时历史清空；分页增量追加不清空历史。
- 加载中途失败 / 离开页面 / 切换歌单：feed 继续重试并补完，已完成页写入缓存；下次打开从缓存末尾继续。
- 有完整且新鲜缓存：立即渲染全部并增量构建队列；完整但 stale 缓存：先渲染，重验证完成前队列保持为空。
- 有部分缓存：先渲染已缓存页，再从缓存末尾继续补页；stale 期间不进队列。
- 加载期间手动“下一首播放”：直接加入队列，完整加载后只追加歌单候选，不重建、不覆盖手动歌曲。
- 队列构建时过滤已知不可播歌曲；播放条自行验证当前歌曲，当前曲不可播时沿队列向后尝试到可播或队列空，不依赖探测结果。
- 页边界无重复 / 缺失歌曲；`songMid` 去重后顺序与上游一致；正常歌单不会因分页上限提前截断，`PLAYLIST_PAGE_MAX` 仅作为异常分页兜底。
- 加载完成后只追加一次；当前歌曲不在最终列表时保留并置于队首。

---

### A8 工程常量集中管理

**新增需求（2026-10-23）**

> 所有常量放到一个文件里集中管理，供其它组件引用；`PROBE_MAX_SONGS` 用 `PLAYLIST_PAGE_SIZE * PLAYLIST_PAGE_MAX` 计算，而不是固定值。

**现状**

- 工程常量分散在 CORE §4.x 各模块的签名小节：`client.ts`、`search.ts`、`playlist.ts`、`user.ts`、`comment.ts`、`ipc.ts`、`index.ts`、`player.ts`、`startup-flags.ts`、`cache/playlist.ts`、`cache/audio.ts`、`availability.ts` 等。
- A6 的 `PROBE_MAX_SONGS` 与 A7 的 `PLAYLIST_PAGE_SIZE` / `PLAYLIST_PAGE_MAX` 是两个独立数字，容易漂移；改歌单上限时探测上限不会自动跟随。
- 同一数值可能在多个模块各写一份，测试和文档难以确认哪一份是权威。

**目标**

- 新增 `src/shared/constants.ts`，所有工程常量只在这里声明、导出，其它模块只 import。
- `PROBE_MAX_SONGS = PLAYLIST_PAGE_SIZE * PLAYLIST_PAGE_MAX`，与 A7 的歌单最大容量严格一致；当前为 `50 × 20_000 = 1_000_000`。
- 修改 `PLAYLIST_PAGE_SIZE` 或 `PLAYLIST_PAGE_MAX` 时，探测上限自动跟随，不需要改第二处。
- 不改变运行时行为；只改变常量的位置与派生方式。

**方案**

1. 新建 `src/shared/constants.ts`，按领域分组导出：上游请求、搜索、歌单、探测、启动参数、缓存、播放器等。
2. 把现有模块里的 `declare const` / 模块级常量迁入该文件；模块内只保留 import。
3. 派生常量使用表达式，不写第二个字面量；`PROBE_MAX_SONGS` 是首个派生常量。
4. 删除重复、未使用或已被取代的常量（A1 已删除的 `PLAYLIST_CACHE_MAX_ENTRIES` / `PLAYLIST_PREFETCH_MAX` 不再恢复）。
5. UI 视觉字面量仍按 GUIDELINES 留在 USER/CSS 契约，不进入工程常量文件。

**接口草案**

> 下面是源码形状；CORE 的签名小节仍按 GUIDELINES 只写名称 + 用途，具体值只以推荐值注释出现。

```ts
// src/shared/constants.ts
export const PLAYLIST_PAGE_SIZE = 50;
export const PLAYLIST_PAGE_MAX = 20_000;
export const PROBE_MAX_SONGS = PLAYLIST_PAGE_SIZE * PLAYLIST_PAGE_MAX; // 1_000_000

// 其它示例：上游、搜索、缓存、播放器
export const UPSTREAM_TIMEOUT_MS = 15_000;
export const SEARCH_PAGE_SIZE_DEFAULT = 20;
export const PLAYLIST_CACHE_TTL_MS = 30_000;
export const PLAYLIST_CACHE_MAX_BYTES = 16 * 1024 * 1024;
export const PLAYER_STATE_THROTTLE_MS = 900;
```

**文档动作**

| 文档 | 位置 | 动作 | 内容 |
|---|---|---|---|
| CORE | §1 File tree | 修订 | 新增 `src/shared/constants.ts`。 |
| CORE | §2 CONVENTIONS | 新增 | 工程常量集中管理：只在 `shared/constants.ts` 声明；其它模块 import；派生常量用表达式；禁止模块内重复字面量。 |
| CORE | §4.x（按文件树顺序插入） | 新增 | 新增 `shared/constants.ts` 签名小节：列出全部常量名称、用途与推荐值注释；后续 §4.x 顺延，A8 提交统一更新交叉链接。 |
| CORE | 现有模块签名小节 | 修订 | `client.ts`、`search.ts`、`playlist.ts`、`user.ts`、`comment.ts`、`ipc.ts`、`index.ts`、`player.ts`、`startup-flags.ts` 删除局部常量声明，改为引用 `shared/constants.ts`；A1/A6/B2 后续新增模块按 §2 约定直接引用，不再建立局部常量。 |
| CORE | §4.x availability.ts（A6 落地时） | 约定 | `PROBE_MAX_SONGS` 直接写入 `shared/constants.ts`，使用 `PLAYLIST_PAGE_SIZE * PLAYLIST_PAGE_MAX` 派生，不写固定值。 |
| USER / PROVIDER | — | 不动 | 常量是实现细节，不进入用户 / 上游契约。 |
| BUILD | — | 不动 | 无构建变化。 |

**实现步骤**

1. 新建 `src/shared/constants.ts`，先迁移现有模块的工程常量。
2. 把现有 `client.ts`、`search.ts`、`playlist.ts`、`user.ts`、`comment.ts`、`ipc.ts`、`index.ts`、`player.ts`、`startup-flags.ts` 的常量声明改为 import。
3. A1/A7/A6/B2 的新增常量直接写入该文件；`PROBE_MAX_SONGS` 使用 `PLAYLIST_PAGE_SIZE * PLAYLIST_PAGE_MAX` 乘积表达式。
4. 全仓搜索模块级常量声明，清理重复值与未使用常量。
5. 跑 typecheck、单测与 A5 fixture 回放，确认行为不变。

**验收**

- `src/shared/constants.ts` 是工程常量的唯一声明位置；其它模块不再出现同名常量声明。
- `PROBE_MAX_SONGS === PLAYLIST_PAGE_SIZE * PLAYLIST_PAGE_MAX`；修改任一页参数后探测上限自动变化。
- A6 不再出现固定的 `20000` / `2000` 探测上限字面量。
- A7 的页大小 / 页上限与 A6 的探测上限不会漂移。
- 运行时行为、分页结果、探测结果与改造前一致；typecheck / 单测 / fixture 回放通过。

---

## B. 进阶目标

> 以下条目当前不排期，也不修改 HTML。每项列出立项后需要的文档动作与实现方案；上游接口类目标必须先探测真实接口，再写 PROVIDER 契约。

### B1 托盘常驻体验打磨

**现状**：`src/main/integration/tray.ts` 已有静态菜单（显示主窗口 / 播放暂停 / 上一首 / 下一首 / 退出）与关闭到托盘；菜单文案与图标不随播放状态变化，tooltip 固定。

**方案**

- `initTray` 接收状态更新函数；`player:state` 到达时同步托盘。
- 菜单动态化：当前歌曲存在时启用上一首 / 下一首；“播放 / 暂停”文案随状态切换；无歌曲时禁用播放控制。
- tooltip 显示“歌名 — 歌手”与播放状态；图标提供播放 / 暂停两套（或按主题明暗）。
- 不做单击切换显示 / 隐藏，也不增加“隐藏主窗口”菜单；单击只显示主窗口，关闭窗口行为沿用现有可调设置。
- GNOME 需要 AppIndicator 扩展；在 USER 中写明“托盘图标可能被桌面隐藏”，不把扩展打包进应用。

**文档动作**

| 文档 | 位置 | 动作 | 内容 |
|---|---|---|---|
| USER | §5.4 托盘 | 修订 | 动态菜单、tooltip、图标状态、GNOME 限制；单击只显示，不做隐藏切换。 |
| README | §2 系统集成 | 修订 | 托盘状态同步。 |
| CORE | §4.19 tray.ts | 修订 | `TrayActions` 增加状态输入 / `updateTray`；菜单重建。 |
| CORE | §4.5 ipc.ts | 修订 | `player:state` 同时分发到 MPRIS 与托盘。 |
| CORE | §5.5 播放单曲 | 修订 | `sendState` 分支增加 `integration/tray::updateState(state)`。 |
| PROVIDER | — | 不动 | 托盘是桌面壳能力，不是上游数据源。 |

**验收**：播放 / 暂停菜单文案即时变化；切歌后 tooltip 更新；无歌曲时控制项禁用；托盘初始化失败仍静默降级。

---

### B2 播放缓存（仅音频体磁盘缓存）

**现状**：每次播放都重新请求 vkey；只有 `mediaMidCache`。没有音频体缓存。

本任务不做 L1 链接缓存，不做 L2 下一首预解析；**只做 L3 音频体磁盘缓存**。

**方案**

- 缓存键：`musicid | songMid | quality`，按账号隔离，避免切换账号后直接播放上一账号的缓存内容。
- 缓存目录：`userData/cache/audio/<musicid>/<songMid>-<quality>.<ext>`；临时文件 + 原子重命名；总容量上限与 LRU 清理由 CORE 常量定义（具体值只在 §4.x 注释中给推荐值）。
- 播放路径：
  - 播放前先查缓存；命中则通过主进程自定义协议（如 `lychee-audio://`）直接播放本地文件，不再请求 vkey。
  - 未命中则复用 `api/song` 的取流逻辑；主进程代理远程音频并在播放同时写入缓存，完成后原子入库。
  - 缓存文件不完整 / 内容类型不符时删除并重新取流。
- 缓存命中不依赖 vkey；即使链接过期，完整缓存仍可播放。
- 不预解析下一首，不缓存 `UrlResult`；每次未命中仍走正常取流。
- 设置项：默认开启；显示当前占用与容量上限（上限值由 CORE 常量定义）、清空；退出登录不清空音频体缓存。
- 缓存按账号隔离：退出登录后文件保留，但其他账号不能命中旧账号缓存；同一账号重新登录后仍可命中。
- README 非目标同步说明：缓存仅供本机播放，不构成内容分发。

**文档动作**

| 文档 | 位置 | 动作 | 内容 |
|---|---|---|---|
| README | §1 非目标 | 修订 | 缓存仅供本机播放，不构成内容分发。 |
| USER | §1 TERMS | 新增 | “播放缓存”：已播放音频可在本机复用，减少重复下载；按账号隔离，可清空。 |
| USER | §2 CONVENTIONS | 新增 | 缓存按账号隔离；有容量上限、可手动清空；退出登录不清空；缓存内容仅本机播放；不做下一首预解析。 |
| USER | §3.1 总体架构 | 修订 | 音频流边界改为主进程本地协议 / 代理；同步更新 `diagram/general-architecture.puml` 与 `.svg`。 |
| USER | §5.2.7 设置页 | 新增 | 缓存开关、当前占用、清理；退出登录不清空。 |
| CORE | §1 File tree | 修订 | 增加 `src/main/cache/audio.ts`、`src/main/media/audio-protocol.ts`。 |
| CORE | 新增 §4.x cache/audio.ts | 新增 | 缓存读写、LRU、清理；`AUDIO_CACHE_*` 常量在 `shared/constants.ts` 声明，本模块只引用。 |
| CORE | §4.1 / §4.2 | 修订 | 缓存设置类型、播放源 IPC / 自定义协议。 |
| CORE | §4.27 engine.ts | 修订 | 播放源支持 `lychee-audio://` 本地协议 URL；接口不变。 |
| CORE | §4.48 SettingsView.vue | 修订 | 缓存开关、当前占用、清理入口。 |
| CORE | §5.5 播放单曲 | 修订 | 缓存命中 / 未命中取流与写缓存、账号作用域与回退路径；同步更新“主进程只经手链接字符串”的旧边界。 |
| PROVIDER | §3.3 / §4.1 | 修订 | 音频流端点与 vkey / purl 契约不变；Range 与 vkey 时效按实测记录；§3.3 的“主进程只经手链接字符串”旧说明改为引用 USER §3.1 的当前边界，应用侧代理或缓存策略见 CORE §5.5。 |
| BUILD | 存储章节 | 新增 | 缓存目录、容量与清理说明。 |

**验收**：二次播放同一歌曲无网络 / 无 vkey 请求；总占用不超过 CORE 定义的容量上限，满时按 LRU 淘汰；清空立即释放；退出登录不清空缓存，但另一账号不能命中旧账号缓存；不做 L1/L2 的痕迹。

---

### B3 每日推荐 / 专属雷达 / 猜你喜欢

**现状**：无推荐接口、无“发现”页面；默认落地页是 `/search`。

**方案**

1. 先扩展 `scripts/probe.mjs` 验证三个上游入口与登录要求，产出脱敏 fixture；确认字段后再写 PROVIDER。
2. 新增 `src/main/api/recommend.ts`，统一返回：

```ts
export interface RecommendSection {
  id: 'daily' | 'radar' | 'guess';
  title: string;
  songs: Song[];
  playlists: PlaylistMeta[];
  refreshedAtMs: number;
}

export interface RecommendFeed {
  sections: RecommendSection[];
}
```

3. 新路由 `/discover`，侧栏“浏览”下增加“发现”；未登录显示登录引导。
4. 按日缓存（每日推荐当天有效；雷达 / 猜你喜欢短 TTL）；支持手动刷新。
5. 卡片可播放全部、打开歌单；歌曲表复用 `SongTable`；不新增推荐流程图，调用栈足够。

**文档动作**

| 文档 | 位置 | 动作 | 内容 |
|---|---|---|---|
| README | §2 用户交互 | 新增 | “发现”入口与三类推荐。 |
| USER | §1 TERMS | 新增 | 每日推荐 / 专属雷达 / 猜你喜欢。 |
| USER | §2 CONVENTIONS 路由 | 修订 | 增加 `/discover` 路由。 |
| USER | §5.2.2 侧栏与导航 | 修订 | “浏览”组增加“发现”。 |
| USER | §5.2.8 页面结构 | 新增 | “发现”页：分区、卡片、空态、未登录态、刷新。 |
| CORE | §1 File tree | 修订 | 新增 `api/recommend.ts`、`views/DiscoverView.vue`、`stores/recommend.ts`。 |
| CORE | §4.1 types.ts | 修订 | `RecommendSection`、`RecommendFeed`。 |
| CORE | §4.2 ipc.ts | 修订 | 推荐读取通道。 |
| CORE | §4.25 router/index.ts | 修订 | `/discover` 路由。 |
| CORE | 新增 §4.x api/recommend.ts | 新增 | 三个推荐入口、缓存与转换。 |
| CORE | 新增 §4.x stores/recommend.ts | 新增 | 分区状态、刷新与按日缓存。 |
| CORE | 新增 §5.x 推荐加载 | 新增 | `/discover` 加载 → `recommend` → 上游接口 → 缓存 → 渲染调用栈。 |
| PROVIDER | §1 TERMS | 新增 | 每日推荐 / 专属雷达 / 猜你喜欢的上游名称与字段。 |
| PROVIDER | §3 / §4.1 / §4.3 | 新增 | 三个入口、请求参数、响应模型、转换；先 fixture 验证。 |
| BUILD | — | 不动 | 无构建变化。 |

**验收**：登录后三类内容可见；未登录有引导；刷新与按日缓存正确；上游失败有页面内错误与重试；fixture 覆盖字段映射。

---

### B4 逐字歌词（QRC 解密）

**现状**：`Lyric` 只有 `lrc` / `trans`，`utils/lrc.ts` 只解析 LRC。

本任务只做 QRC 逐字歌词，不新增任何桌面歌词功能。

**方案**

1. 先验证歌词接口的 QRC 返回字段与加密格式；解密实现放渲染进程 `utils/qrc.ts`，主进程只透传原始密文。
2. 数据模型扩展：

```ts
export interface LyricWord {
  startMs: number;
  durationMs: number;
  text: string;
}

export interface LyricLine {
  timeMs: number;
  durationMs: number | null;
  text: string;
  trans: string | null;
  words: LyricWord[] | null;
}

export interface Lyric {
  format: 'lrc' | 'qrc';
  text: string;
  trans: string | null;
}
```

`Lyric` 是跨 IPC 数据模型（CORE §4.1）；`LyricLine` / `LyricWord` 是渲染进程解析层类型（CORE §4.33），只在 §4.33 定义一次。

3. 逐字高亮：当前行内按 `positionMs` 找活动词；没有 QRC 时退回整行高亮；翻译仍按时间戳合并。
4. 不新增窗口、不新增桌面歌词设置、不做托盘 / 全局快捷键入口。

**文档动作**

| 文档 | 位置 | 动作 | 内容 |
|---|---|---|---|
| USER | §1 TERMS | 新增 | 逐字歌词。 |
| USER | §5.2.5 歌词与评论 | 修订 | 逐字高亮、无 QRC 回退；明确没有桌面歌词。 |
| CORE | §1 File tree | 修订 | `src/renderer/utils/qrc.ts`。 |
| CORE | §4.1 / §4.2 | 修订 | `Lyric` 增加 `format`；`LyricLine` / `LyricWord` 归 §4.33，不重复定义。 |
| CORE | §4.14 lyric.ts | 修订 | QRC 请求参数与原始返回。 |
| CORE | §4.33 lrc.ts | 修订 | 定义 `LyricLine` / `LyricWord`；单一解析入口，承接 `qrc.ts`；§4.1 不再重复。 |
| CORE | §4.34 composables/lyrics.ts | 修订 | 支持 QRC 行 / 词数据与活动词计算。 |
| CORE | §4.41 LyricsPanel.vue | 修订 | 逐字高亮；无 QRC 时整行回退。 |
| CORE | §5.9 歌词与评论 | 修订 | QRC 加载 / 解析 / 逐字高亮调用路径。 |
| PROVIDER | §1 TERMS | 新增 | QRC / 逐字歌词格式。 |
| PROVIDER | §4.1 歌词接口 | 修订 | `format` 参数、`qrc` 字段、加密格式说明（不复制算法实现）。 |
| PROVIDER | §4.3 QqLyricResponse | 修订 | 增加 `qrc` 字段与转换规则。 |
| BUILD | — | 不动 | 无新增依赖。 |

**验收**：QRC 行内高亮与时间轴一致；翻译仍可合并；没有桌面歌词窗口、设置项或入口；无 QRC 时整行高亮。

---

### B5 收藏 / 歌单管理

**现状**：只有 `playlist.get` / `listMine` 读取；没有收藏、创建、改名、删除、增删歌曲。

**方案**

1. 先探测并 fixture 化以下写入接口（具体 module / method 以实测为准）：
   - 收藏 / 取消收藏歌曲。
   - 创建 / 改名 / 删除歌单。
   - 歌单增删歌曲、调整顺序（如上游支持）。
2. 数据模型：

```ts
export interface FavoriteState {
  songMid: string;
  favorited: boolean;
}

export interface PlaylistEditResult {
  meta: PlaylistMeta;
  songs?: Song[];
}
```

3. IPC：

```ts
favorite: {
  get(mids: string[]): Promise<IpcResult<FavoriteState[]>>;
  toggle(songMid: string): Promise<IpcResult<FavoriteState>>;
};
playlist: {
  create(name: string): Promise<IpcResult<PlaylistMeta>>;
  rename(id: string, name: string): Promise<IpcResult<PlaylistMeta>>;
  remove(id: string): Promise<IpcResult<null>>;
  addSongs(id: string, mids: string[]): Promise<IpcResult<PlaylistDetail>>;
  removeSongs(id: string, mids: string[]): Promise<IpcResult<PlaylistDetail>>;
};
```

4. UI：
   - `SongTable` 行内收藏按钮；`PlayerBar` 当前歌曲收藏。
   - `LibraryView` 歌单卡片菜单：改名 / 删除 / 新建歌单。
   - 歌单详情编辑模式：多选歌曲 → 加入 / 移出歌单；或行内“更多”菜单。
   - 乐观更新 + 失败回滚 + Toast；写操作完成后失效 A1 的歌单缓存。
5. 权限：仅当前账号可编辑的歌单显示编辑入口；上游拒绝时按 `AUTH_EXPIRED` / `UPSTREAM_CHANGED` 映射。

**文档动作**

| 文档 | 位置 | 动作 | 内容 |
|---|---|---|---|
| README | §2 用户交互 | 新增 | 收藏与歌单管理入口。 |
| USER | §1 TERMS | 新增 | 收藏 / 歌单管理 / 可编辑歌单。 |
| USER | §2 CONVENTIONS | 新增 | 乐观更新与失败回滚；写操作后刷新列表。 |
| USER | §5.2.3 / §5.2.4 / §5.2.8 | 修订 | 播放条与歌曲行收藏按钮、歌单卡片菜单、编辑模式、确认删除。 |
| USER | 新增 §5.2.x 歌单编辑 | 新增 | 新建 / 改名 / 删除 / 增删歌曲的对话框契约。 |
| CORE | §1 File tree | 修订 | 新增 `api/favorite.ts`、`api/playlist-write.ts`、`stores/playlist-edit.ts`、`components/PlaylistEditDialog.vue`。 |
| CORE | §4.1 types.ts | 修订 | `FavoriteState`、`PlaylistEditResult`、`PlaylistMeta.editable`（或等价可编辑标记）。 |
| CORE | §4.2 ipc.ts | 修订 | `favorite.get` / `toggle`、`playlist.create` / `rename` / `remove` / `addSongs` / `removeSongs`。 |
| CORE | 新增 §4.x api/favorite.ts、api/playlist-write.ts | 新增 | 写接口签名、错误映射与缓存失效。 |
| CORE | §4.39 SongTable.vue / §4.40 PlayerBar.vue | 修订 | 收藏按钮与收藏状态。 |
| CORE | §4.45 LibraryView.vue | 修订 | 歌单卡片菜单：改名 / 删除 / 新建歌单。 |
| CORE | 新增 §4.x stores/playlist-edit.ts | 新增 | 编辑状态、乐观更新与回滚。 |
| CORE | 新增 §5.x 收藏与歌单编辑 | 新增 | 收藏切换、创建 / 改名 / 删除、增删歌曲调用栈。 |
| PROVIDER | §1 TERMS / §3 / §4.1 / §4.3 | 新增 | 写入接口、参数、返回模型、权限错误。 |
| PROVIDER | §4.2 错误表 | 修订 | 写操作的权限 / 频率错误映射。 |
| CORE | §4.x cache/playlist.ts | 修订 | 写成功后按 ID 失效。 |

**验收**：收藏状态与上游一致；创建 / 改名 / 删除后列表即时更新；失败回滚且提示；跨账号不串数据；所有写入接口有 fixture 与错误用例。

---

### B6 MV 播放

**现状**：只有音频播放；搜索类型不含 MV；没有视频页面。

**方案**

1. 探测 MV 搜索 / 详情 / 取流接口；确认是否需要登录与 VIP 权限。
2. 扩展 `SearchRequest.type` 增加 `'mv'`，`SearchResult` 增加 `mvs`；或独立 `mv.search`，避免影响现有四类搜索（推荐后者，减少回归）。
3. 新增 `MvView.vue`：视频播放器 + 标题 / 歌手 / 清晰度选择；支持全屏、退出恢复。
4. 取流失败复用 `NO_STREAM` / `AUTH_EXPIRED` 文案；不自动跳下一个 MV。
5. MPRIS 仍以音频状态为主；MV 播放时可标记暂停 / 停止音频。

**文档动作**

| 文档 | 位置 | 动作 | 内容 |
|---|---|---|---|
| README | §2 用户交互 | 新增 | MV 搜索与播放入口。 |
| USER | §1 TERMS | 新增 | MV / MV 清晰度。 |
| USER | §2 CONVENTIONS 路由 | 修订 | 增加 MV 播放页路由。 |
| USER | §5.2.8 页面结构 | 修订 | 搜索页增加 MV 卡片；新增 MV 播放页。 |
| CORE | §1 File tree | 修订 | `api/mv.ts`、`views/MvView.vue`。 |
| CORE | §4.1 types.ts | 修订 | MV 搜索结果、MV 清晰度与播放信息。 |
| CORE | §4.2 ipc.ts | 修订 | MV 搜索 / 详情 / 取流通道。 |
| CORE | §4.25 router/index.ts | 修订 | MV 播放页路由。 |
| CORE | §4.44 SearchView.vue | 修订 | MV 搜索入口与结果卡片。 |
| CORE | 新增 §4.x api/mv.ts | 新增 | MV 接口签名与转换。 |
| CORE | 新增 §5.x MV 播放 | 新增 | 搜索 → 详情 → 取流 → 播放调用栈。 |
| PROVIDER | §1 TERMS / §3 / §4.1 / §4.3 | 新增 | MV 术语、接口、参数、响应模型、取流字段。 |
| BUILD | — | 不动 | 使用 HTML5 video，无新增依赖。 |

**验收**：搜索 / 打开 / 播放 / 全屏 / 退出完整；无权限有明确提示；音频与 MV 切换时状态不互相污染。

---

### B7 下载管理

**现状**：无下载能力；当前音频流由渲染进程直接加载，B2 落地后由主进程缓存层代理。

**方案**

1. 主进程下载管理器：`DownloadTask` 队列、并发 1–2、暂停 / 继续 / 重试 / 删除；临时 `.part` + 原子重命名。
2. 下载前调用 `song.getUrls` 校验当前账号可播；只允许选择实际可用档位；不绕过 VIP / 数字专辑限制。
3. 记录元数据（歌曲、音质、文件路径、完成时间、大小、状态）；下载时缓存封面图片到同目录，不保存歌词文件，不内置转码。
4. 存储：默认 `~/Music/Lychee Player`（可配置）；容量上限与剩余空间检查；文件名清洗。
5. UI：歌曲行 / 播放条下载按钮；下载中心为侧栏抽屉（不新增路由）；进度、失败原因、打开目录、删除。
6. 断点续传仅在音频服务器支持 Range 时启用；不支持则整文件重下。
7. README 明确：仅限个人离线使用，不分发、不镜像内容。

**文档动作**

| 文档 | 位置 | 动作 | 内容 |
|---|---|---|---|
| README | §1 非目标 / §2 | 修订 | 个人离线使用边界；下载入口。 |
| USER | §1 TERMS | 新增 | 下载任务 / 下载中心。 |
| USER | §2 CONVENTIONS | 新增 | 仅当前账号可播内容；失败不自动重试无限次。 |
| USER | §5.2.2 侧栏与导航 | 修订 | 增加下载入口（抽屉）。 |
| USER | §5.2.3 / §5.2.4 | 修订 | 播放条与歌曲行下载按钮。 |
| USER | §5.2.7 / 新增 §5.2.x | 新增 | 下载目录、并发、容量；下载中心抽屉 UI；列表显示缓存的封面。 |
| CORE | §1 File tree | 修订 | 新增 `src/main/download/manager.ts`、`components/DownloadDrawer.vue`。 |
| CORE | §4.1 / §4.2 | 修订 | 下载任务类型、IPC。 |
| CORE | §4.23 App.vue | 修订 | 挂载下载抽屉；与歌词 / 播放队列面板互斥。 |
| CORE | §4.39 / §4.40 | 修订 | 下载按钮与状态。 |
| CORE | §4.48 SettingsView.vue | 修订 | 下载目录等设置项。 |
| CORE | 新增 §4.x download/manager.ts | 新增 | 下载队列、断点、存储管理。 |
| CORE | 新增 §5.x 下载 | 新增 | 取流 → 下载 → 落盘 → 状态恢复调用栈。 |
| PROVIDER | §3.3 / §4.1 | 注 | 音频流 Range、vkey 时效、下载前重新取链。 |
| BUILD | 存储章节 | 新增 | 默认目录、权限、磁盘要求。 |

**验收**：可播歌曲可下载；不可播歌曲在下载前被拒绝；暂停 / 继续 / 删除 / 打开目录可用；重启后任务状态恢复；容量上限生效；下载目录有封面图片、无歌词文件。

---

### B8 全局快捷键

**现状**：没有 `globalShortcut`；媒体键主要依赖 MPRIS。

**方案**

1. 设置模型增加：

```ts
export type ShortcutAction =
  | 'toggleWindow'
  | 'playPause'
  | 'next'
  | 'previous';

export interface ShortcutBinding {
  action: ShortcutAction;
  accelerator: string;
}

export interface Settings {
  // ...
  shortcuts: Partial<Record<ShortcutAction, string>>;
}
```

2. 主进程新增 `src/main/integration/global-shortcuts.ts`：`registerShortcuts(bindings)` / `unregisterShortcuts()`；启动后注册，设置变更后重建，退出时全部注销。
3. 冲突检测：注册失败返回给设置页，标记“已被占用”；不允许重复绑定同一 accelerator。
4. 设置页增加快捷键录制控件：按键捕获、清除、恢复默认；默认不占用系统媒体键，避免与 MPRIS / 桌面冲突，媒体键继续走 MPRIS。
5. Wayland：Electron `globalShortcut` 在部分合成器下不可用；提示用户改用桌面快捷键或 MPRIS。当前不引入 XDG Global Shortcuts portal，后续需要时另立任务。

**文档动作**

| 文档 | 位置 | 动作 | 内容 |
|---|---|---|---|
| USER | §5.2.7 设置页 | 新增 | 快捷键设置组、录制 / 冲突提示 / 恢复默认。 |
| USER | §1 TERMS | 新增 | 全局快捷键。 |
| CORE | §1 File tree | 修订 | `src/main/integration/global-shortcuts.ts`。 |
| CORE | §4.1 Settings | 修订 | `shortcuts` 字段与默认值。 |
| CORE | §4.48 SettingsView.vue | 修订 | 快捷键录制、冲突提示、恢复默认。 |
| CORE | §5.1 / §5.8 | 修订 | 启动注册、退出注销。 |
| BUILD | — | 不动 | 无新增依赖。 |

**验收**：绑定后窗口隐藏时仍生效；冲突有提示；修改 / 清除即时生效；退出后不残留；Wayland 不可用时有说明。

---

### B9 libmpv / 原生播放引擎

**现状**：`audio/engine.ts` 是 HTML5 Audio 实现，接口已抽象；没有 gapless / EQ / 响度归一。

**状态**：不排期。以下仅为 gapless / EQ / 响度归一成为硬需求时的技术预案。

**启动条件**（满足任一才评估）：

- 用户明确要求 gapless 专辑连续播放。
- EQ 或响度归一成为硬需求。
- HTML5 Audio 在目标桌面环境下出现无法解决的格式 / 延迟问题。

**方案**

1. Linux 优先 **mpv 子进程 + JSON IPC**，不先引入 libmpv 绑定：
   - 主进程 spawn `mpv --idle --no-video --audio-display=no --gapless-audio=yes --input-ipc-server=<socket>`。
   - JSON IPC：`loadfile`、`set_property pause/volume/af`、`seek`、`observe_property`。
   - 事件：`property-change`、`end-file`、`playback-restart`、`file-loaded`。
2. 渲染进程保留 `AudioEngine` 接口，新增 `remote-engine.ts` 通过 IPC 调用主进程；HTML5 作为 fallback。
3. 能力：
   - gapless：队列下一首 append 到 mpv playlist。
   - EQ：`af=equalizer=...` 或 `lavfi` 滤镜链。
   - 响度归一：`af=loudnorm` / ReplayGain。
4. 打包：优先依赖系统 `mpv`（BUILD 说明安装），启动时检测版本；缺失则回退 HTML5 并提示。若内置，需评估体积与许可证。
5. 安全：IPC socket 放 `XDG_RUNTIME_DIR`，权限 `0600`；不使用 TCP；退出时终止子进程。

**文档动作**

| 文档 | 位置 | 动作 | 内容 |
|---|---|---|---|
| README | §2 系统集成 / Credits | 修订 | 播放引擎说明；mpv 依赖与许可证。 |
| USER | §1 TERMS | 新增 | 播放引擎 / gapless / EQ / 响度归一。 |
| USER | §5.2.7 设置页 | 新增 | 引擎选择（自动 / HTML5 / mpv）、EQ / 响度开关。 |
| CORE | §1 File tree | 修订 | `src/main/audio/mpv.ts`、`src/renderer/audio/remote-engine.ts`。 |
| CORE | §4.1 types.ts | 修订 | mpv 状态 / 引擎设置类型。 |
| CORE | §4.2 ipc.ts | 修订 | 远程引擎控制通道。 |
| CORE | §4.27 engine.ts | 修订 | 接口职责与 fallback。 |
| CORE | §4.48 SettingsView.vue | 修订 | 引擎选择、EQ / 响度开关。 |
| CORE | §3 SBOM | 注 | 外部 mpv 依赖；版本 / 许可证见 BUILD（系统包例外）。 |
| CORE | 新增 §5.x mpv 播放 | 新增 | 引擎选择 → mpv 启动 / IPC → 播放状态回传调用栈。 |
| PROVIDER | §1 TERMS | 新增 | mpv / JSON IPC / socket / property / event。 |
| PROVIDER | §3 DIAGRAMS | 新增 | mpv 启动、`loadfile`、`property-change`、`end-file` 边界时序图；同时提交 `.puml` / `.svg`。 |
| PROVIDER | §4.5 | 新增 | mpv JSON IPC：命令、事件、属性、错误。 |
| BUILD | 运行依赖 | 新增 | `mpv` 安装、版本要求、socket 权限。 |

**验收**：mpv 缺失自动回退；gapless 无缝；EQ / loudnorm 生效；MPRIS 状态仍正确；退出无残留进程 / socket。

---
