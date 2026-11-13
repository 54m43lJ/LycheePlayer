# IMPL

开发过程心得，按“文档错误 / 文档缺漏 / 技术坑”分组。每条只记录一个独立问题，跨组不重复同一结论。表中的动作表示建议落点；`不动` 表示该处已有内容、本轮不再重复编辑，或以其它条目为准。

## 1. 开发中发现文档的错误

### 1.1 README 仍把歌词 / 评论描述为 `/lyrics` 页面

**问题描述**：README 的用户交互表写着“点击播放条封面进入 `/lyrics` 页面”，但 USER / CORE 已明确歌词与评论是覆盖内容区的弹出层，CORE 更直接写明 `/lyrics` 不再存在。开发译文开关与评论输入框时，如果按 README 实现就会多出无意义的路由分支。

**解决方法**：

- 以 USER §5.2.5 与 CORE §4.72 的弹出层契约为唯一实现依据，不新增 `/lyrics` 路由。
- 译文开关、评论输入框都挂在 `LyricsOverlay` 内，关闭入口只改 `ui.lyricsOpen`。
- 把 README 的旧表述留作本次修订项，避免后续开发者按旧文案重新引入页面。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `README.md` | §2 用户交互 · 歌词 / 评论行 | 改 | 将“进入 `/lyrics` 页面”改为“点击封面开合歌词 / 评论弹出层”，与 ABOUT 的表述对齐。 |
| `USER.html` | §5.2.5 歌词与评论（`#u5-2-5`） | 不动 | 已定义弹出层、译文开关与评论输入框，作为用户侧权威来源，不再重复修改。 |
| `CORE.html` | §4.72 `LyricsOverlay.vue`（`#c4-72`） | 不动 | 已写明 `/lyrics` 不再存在，作为实现约束引用即可。 |

### 1.2 下载相关文案仍停留在批次模型

**问题描述**：README / ABOUT 原先写“下载中心支持批次级暂停 / 继续 / 删除 / 重试”“整单下载创建一个批次”，但 CORE 与下载实现已经统一为单队列，没有批次字段或批次级操作。USER §5.2.8 歌单详情也仍写“下载全部按钮显示完成 / 总数 / 失败，全部完成显示已全部下载”，而实际只提示“已加入下载队列”。这些残留会让实现者误以为需要维护批次状态。

**解决方法**：

- 以 CORE §4.60 / §5.16 的统一队列为唯一模型，不引入批次 ID、批次汇总或批次级操作。
- “下载全部”只按歌单顺序去重入队并 Toast 提示，按钮不显示任务完成进度。
- 本轮已把 README / ABOUT 的下载行改为统一队列语义；USER 歌单详情中的批次进度句仍需修正。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `README.md` | §2 用户交互 · 下载 / 整单下载行 | 不动 | 本轮已改为统一队列，不再提批次；后续保持该表述，不重新引入批次概念。 |
| `ABOUT.html` | 用户交互 · 下载 / 整单下载行 | 不动 | 已与 README 同步，避免重复改同一段用户文案。 |
| `USER.html` | §5.2.8 页面结构 · 歌单详情（`#u5-2-8`） | 改 | 删除“按钮显示完成 / 总数 / 失败，全部完成显示已全部下载”，改为“加入统一队列后 Toast 提示”。 |
| `CORE.html` | §4.60 `download/manager.ts` / §5.16 下载（`#c4-60` / `#c5-16`） | 不动 | 已完整描述单队列、串行下载与无批次语义，作为模型来源。 |

### 1.3 下载调用树只记录歌曲表一个入口

**问题描述**：CORE §5.16 原先只画了 `SongTable::emit('download') → download.start`，播放条的实际下载入口没有出现在调用树里。结果是“已下载时确认删除”先只加到了歌单页，播放条继续走旧入队逻辑，文档也没有暴露这个缺口。

**解决方法**：

- 把下载按钮的判定、入队、删除确认与提示收敛到 `useDownloadAction().requestDownload()`。
- `PlayerBar` 与所有歌曲表页面只负责把歌曲对象和音质传给该入口，不再各自判断资产状态。
- 调用树改为 `SongTable / PlayerBar → requestDownload → 入队或删除分支`，并新增全局 `DownloadDeleteDialog`。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §5.16 下载（`#c5-16`） | 改 | 把单入口调用树改为 `SongTable` / `PlayerBar → requestDownload`，并补已下载时的删除分支。 |
| `CORE.html` | §4.84 `composables/download-action.ts`（`#c4-84`） | 增 | 记录共用下载入口、`pendingDelete`、确认 / 取消函数，以及返回的 ref 需在调用方顶层解构。 |
| `CORE.html` | §4.85 `components/DownloadDeleteDialog.vue`（`#c4-85`） | 增 | 记录全局唯一删除下载确认框及挂载位置。 |
| `CORE.html` | §2 CONVENTIONS（`#c2`） | 增 | 增加“下载按钮行为”约定：所有入口共用 `requestDownload`，不各自判断已下载状态；磁盘删除由主进程执行。 |
| `USER.html` | §5.2.3 播放条 / §5.2.4 歌曲列表 | 不动 | 已声明所有歌曲表与播放条共用同一行为，避免与本节重复。 |

## 2. 开发中发现文档没写明的细节

### 2.1 “纯本地搜索”的匹配范围与空状态未定义

**问题描述**：TODO 只写了“支持纯本地搜索功能”，没有说明搜索哪些字段、是否扫描下载目录、是否允许触发上游请求，也没有区分“没有任务”和“搜索无匹配”。实现时必须自行决定契约，否则不同页面容易做出不同的搜索语义。

**解决方法**：

- 只匹配已加载的任务快照，不请求上游、不重新扫描目录。
- 匹配歌名、`songMid`、歌手、专辑与文件路径，统一做小写包含匹配。
- 与状态筛选叠加；搜索无结果时显示“没有匹配的下载任务”，未搜索时保留“没有符合条件的任务”。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.8 页面结构 · 下载中心（`#u5-2-8`） | 改 | 补充搜索字段、只过滤已加载任务、与状态筛选叠加及两类空状态。 |
| `CORE.html` | §4.67 `DownloadsView.vue`（`#c4-67`） | 改 | 记录搜索框位置、匹配范围、空状态与不触发上游 / 目录扫描。 |
| `CORE.html` | §4.83 `utils/download-filter.ts`（`#c4-83`） | 增 | 记录 `matchesDownloadKeyword()` 的字段集合与大小写规则。 |
| `CORE.html` | §4.1 `DownloadTask`（`#c4-1`） | 不动 | 已声明 `singers` / `albumName` 的用途，搜索规则只放在 §4.83，避免重复。 |

### 2.2 删除下载的 IPC 粒度与清理范围未写明

**问题描述**：文档只有按任务 ID 的 `download.remove(id)`，没有回答“歌曲已经下载，但当前页面只有 `songMid`、没有任务 ID”时如何删除。也没有说明同一歌曲存在多条 `done` 任务时删哪条，以及是否清理 `.part` 和下载封面。

**解决方法**：

- 增加按歌曲删除的 `download.removeSong(songMid)` 与主进程 `removeDownloadedSong()`。
- 删除该歌曲全部 `done` 任务，同时移除音频、残留 `.part` 与下载封面，并保存索引。
- 保留 `download.remove(id)` 供下载中心按行删除单任务；渲染层使用按歌曲接口，避免依赖任务列表是否加载。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.2 `src/shared/ipc.ts`（`#c4-2`） | 改 | 增加 `download.removeSong(songMid)`，并说明与 `remove(id)` 的分工。 |
| `CORE.html` | §4.60 `download/manager.ts`（`#c4-60`） | 改 | 增加 `removeDownloadedSong` 签名，写明删除全部 `done` 任务、音频、`.part` 与封面；同一小节并入旧索引字段归一化，见 §3.1。 |
| `CORE.html` | §4.71 `stores/download.ts`（`#c4-71`） | 改 | 增加 `removeSong` 签名，说明本地快照更新、资产刷新，以及不依赖 `tasks` 是否已加载。 |
| `USER.html` | §5.2.4 歌曲列表 / §5.2.8 歌单详情 | 不动 | 已描述用户可见的删除确认流程，API 粒度与文件清理只留在 CORE。 |

### 2.3 窗口标题的格式、回退与维护位置未定义

**问题描述**：TODO 只要求“应用标题显示当前在播放的歌曲”，没有规定是否带歌手、无歌曲时显示什么、由主进程还是渲染进程设置，也没有说明页面导航时是否重置。不同实现方式会影响测试与窗口管理器行为。

**解决方法**：

- 在 `utils/format.ts` 定义唯一标题格式：`歌名 - 歌手 · Lychee Player`，歌手为空时省略歌手段。
- 无当前歌曲时回退 `Lychee Player`。
- `App.vue` 监听 `player.current` 并立即写入 `document.title`，不新增 IPC；Electron 默认把页面标题同步到窗口 / 任务栏。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.1 窗口与布局（`#u5-2-1`） | 改 | 增加窗口标题契约：歌曲 / 歌手格式、歌手为空、无歌曲回退与切歌即时更新。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） | 改 | 记录 `player.current` → `document.title` 的监听与立即执行。 |
| `CORE.html` | §4.32 `utils/format.ts`（`#c4-32`） | 改 | 增加 `appTitle(song)` 签名与格式、回退规则。 |
| `README.md` | §2 用户交互 · 窗口标题行 | 增 | 增加窗口 / 任务栏标题跟随当前歌曲的用户可见能力。 |
| `ABOUT.html` | 用户交互 · 窗口标题行 | 增 | 与 README 同步，避免两份用户说明不一致。 |

## 3. 其它技术上踩的坑

### 3.1 旧下载索引缺少新增的必填字段

**问题描述**：`DownloadTask` 为本地搜索新增了必填的 `singers` / `albumName`，但磁盘上的 `.lychee-downloads-*.json` 是旧版本写入的，运行时反序列化后这两个字段是 `undefined`。TypeScript 只检查代码里的对象，不会检查磁盘 JSON，直接调用 `singers.join()` 会崩溃。

**解决方法**：

- `loadIndex()` 对所有旧任务做归一化：`singers` 不是数组时回退空数组并过滤非字符串项，`albumName` 不是字符串时回退空字符串。
- 新任务入队时初始化空字段，出队解析歌曲信息后再回填。
- 归一化后的任务继续按原索引结构持久化，不升级索引版本号。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.60 `download/manager.ts`（`#c4-60`） | 不动 | `loadIndex()` 的旧索引归一化并入 §2.2 对同一小节的修改，不再单独改；实现时保留出队回填时机。 |
| `CORE.html` | §4.1 `DownloadTask`（`#c4-1`） | 不动 | 字段注释已说明“入队阶段为空”，迁移细节只放 manager，避免与本节重复。 |

### 3.2 渲染层的任务快照不能作为删除下载的依据

**问题描述**：下载 store 的 `tasks` 只在下载中心可见时才加载；播放条和歌单页只刷新资产状态。此时页面可能已经知道歌曲“已下载”，但 `tasks` 数组里没有对应任务，靠任务 ID 删除会失败或静默不删文件。

**解决方法**：

- 删除动作以 `songMid` 为主键交给主进程执行，主进程直接查自己的任务表，不依赖渲染层缓存。
- store 的 `removeSong()` 调用 IPC 后只更新本地 `done` 任务并刷新该曲资产状态，即使 `tasks` 为空也能正确工作。
- 下载中心仍可按任务 ID 删除，但那是任务行自己的入口，不用于“已下载歌曲”的统一删除。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.71 `stores/download.ts`（`#c4-71`） | 不动 | “`removeSong` 不依赖 `tasks` 已加载、调用后刷新资产”并入 §2.2 对同一小节的修改，不再重复改。 |
| `CORE.html` | §2 CONVENTIONS（`#c2`） | 不动 | 已由 §1.3 增加“磁盘删除由主进程执行”的下载按钮约定；本条只引用，不重复修改同一张表。 |
| `CORE.html` | §4.60 `download/manager.ts`（`#c4-60`） | 不动 | 已在上一条说明删除范围；这里只强调主进程是唯一执行者，不再重复清理规则。 |

### 3.3 组合式函数返回对象里的 ref 不会在模板中自动解包

**问题描述**：`useDownloadAction()` 返回包含 `pendingDelete` 的对象。若组件把它整体保存为 `const action = useDownloadAction()`，模板里的 `action.pendingDelete` 仍是 Ref 对象，`!== null` 判断会一直成立，确认框可能常驻。Vue 只自动解包顶层 ref，不会递归解包普通对象属性。

**解决方法**：

- 调用方在 `setup` 顶层解构 `pendingDelete`、`confirmDownloadDelete`、`cancelDownloadDelete`。
- `DownloadDeleteDialog` 只读取解构后的顶层 ref，`App.vue` 全局只挂载一次。
- 测试同时从两个调用方读取同一 `pendingDelete`，确认模块级状态确实共享。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.84 `composables/download-action.ts`（`#c4-84`） | 不动 | 模板解包约定已并入 §1.3 新增的同一小节，不再单独改。 |
| `CORE.html` | §4.85 `DownloadDeleteDialog.vue`（`#c4-85`） | 不动 | 已说明组件读取共享状态，模板解包细节只在 §4.84 记录，避免两处重复。 |

### 3.4 歌词接口不返回译文，且译文判断依赖时间戳，译文开关不可见

**问题描述**：旧歌词接口 `fcg_query_lyric_new.fcg` 对 `Snap Out Of It - Arctic Monkeys` 只返回原文，`trans` 为空，客户端根本没有译文可展示。同时原实现把翻译按时间戳合并进原文行，再用 `line.trans` 判断是否存在译文，时间戳不一致或译文无时间戳时还会再丢一次。两个问题叠加后，左下角译文开关不渲染，表现为“歌词翻译按钮不可见”。

**解决方法**：

- 歌词只调用 `music.musichallSong.PlayLyricInfo / GetPlayLyricInfo`，按数字 `songID` 请求并解码 Base64 的 `lyric` / `trans`；旧接口因译文缺失已删除，不保留回退。
- `lyric.get` IPC / preload / `useLyrics` 改为传 `songId`，从 `player.current.songId` 传入；`songMid` 只作为渲染层缓存键。
- 判断标准改为译文文本是否存在：只要解析出非空译文行，就认为有译文并显示开关，不再要求与原文时间戳配对。
- 译文按行序附加到对应原文行，写入 `LyricLine.trans`；不按时间戳匹配，时间戳不同也不影响配对，译文行数超出原文时忽略多余项。
- 原文与译文仍在同一个 `.lyric-line` 内显示为上下两行，共享同一个活动行状态；`translationVisible` 只控制行内译文是否渲染。
- 上游用纯斜杠（如 `//`）表示无译文占位时，规范化为 `●●●` 后再附加到原文行。
- 原文与译文都没有时间戳时按行序生成稳定序号，保证仍能展示和配对。
- `activeLyricIndex` 在原文行之间取离播放位置最近的一行，最多提前 `80ms`；活动行内的译文随原文一起高亮。
- 新增 `test/lyric.test.ts` 与 `test/api/lyric.test.ts`，覆盖新版接口取译文、空译文、非数字 ID、按行序配对原文 / 译文与共享活动行。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.2 `src/shared/ipc.ts`（`#c4-2`） | 改 | `lyric.get` 改为只接收 `songId`。 |
| `CORE.html` | §4.14 `src/main/api/lyric.ts`（`#c4-14`） | 改 | 只使用 `PlayLyricInfo / GetPlayLyricInfo`，说明 Base64 解码、`songID` 参数与非数字 ID 处理。 |
| `CORE.html` | §5.9 歌词与评论（`#c5-9`） | 改 | 调用链改为 `get(songId)` → `GetPlayLyricInfo`，删除旧接口回退分支。 |
| `PROVIDER.html` | §4.1 消费的 HTTP 接口（`#p4-1`） | 改 | 只保留 `GetPlayLyricInfo` 与参数，删除旧歌词接口。 |
| `PROVIDER.html` | §4.3 数据模型与转换（`#p4-3`） | 改 | 只保留 `QqPlayLyricInfoData` 与 `Lyric` 转换，删除 `QqLyricResponse` / QRC 消费说明。 |
| `CORE.html` | §4.33 `utils/lrc.ts`（`#c4-33`） | 改 | `LyricLine.trans` 保存行内译文；`withTranslations` 按行序配对，说明无时间戳回退与就近活动行。 |
| `CORE.html` | §4.34 `composables/lyrics.ts`（`#c4-34`） | 改 | `hasTranslation` 由 `line.trans` 派生；`translationVisible` 只控制行内译文渲染，不再过滤行。 |
| `CORE.html` | §4.41 `LyricsPanel.vue`（`#c4-41`） | 改 | 原文与译文在同一个 `.lyric-line` 内紧贴显示，共享活动行高亮。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 保留 `.lyric-trans` 上下双行样式，活动行内译文使用强调色混合。 |
| `CORE.html` | §4.64 `utils/qrc.ts`（`#c4-64`） | 不动 | 已改为复用 §4.33 的 `withTranslations`，不再维护独立的翻译合并规则。 |
| `USER.html` | §5.2.5 歌词与评论（`#u5-2-5`） | 改 | 改为“原文与译文紧贴为上下两行并共享当前行高亮；无译文文本时不显示开关”。 |
| `README.md` | §2 用户交互 · 歌词 / 评论行 | 改 | 与 USER 同步，恢复“上下两行共享高亮”。 |
| `ABOUT.html` | 用户交互 · 歌词 / 评论行 | 改 | 与 README 同步。 |

### 3.5 播放模式 revealer 展开后当前模式失去高亮

**问题描述**：`.mode-wrap.open` 只把按钮提升到浮层之上，没有改变按钮自身的颜色与背景。默认态是透明背景 + muted 图标，因此 revealer 一展开，当前播放模式虽然仍由按钮图标表示，却不再保持 purple-light 高亮，用户无法在菜单打开时确认当前模式。

**解决方法**：

- 在 `.mode-wrap.open .mode-button` 增加 `color: var(--accent-strong)` 与 `background: var(--accent-soft)`。
- 增加 `.mode-wrap.open .mode-button:hover`，背景复用普通 hover 的 `--accent` 34% 混合，图标继续使用 `--accent-strong`；不另造灰紫混色。
- 保留默认透明背景 + muted 图标，以及普通 hover 的 accent 混合背景；只在 revealer 打开期间持续高亮。
- 不修改菜单项的渲染逻辑与点击循环顺序。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.3 播放条（`#u5-2-3`） | 改 | 补“revealer 弹出期间保持 purple-light 高亮，悬停沿用普通 accent 34% 背景”。 |
| `CORE.html` | §4.40 `PlayerBar.vue`（`#c4-40`） | 改 | 补 `mode-wrap.open` 期间按钮使用 `--accent-strong` / `--accent-soft`，悬停复用普通 hover 背景。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 补 `.mode-wrap.open .mode-button` 与 `:hover` 的颜色、背景契约。 |
| `README.md` | §2 用户交互 · 播放行 | 不动 | 只描述当前项由按钮图标表示，不涉及 revealer 打开态，避免与 USER/CORE 重复。 |
| `ABOUT.html` | 用户交互 · 播放行 | 不动 | 与 README 同步保持现状。 |

### 3.6 滚动容器的 overflow 会裁剪向外绘制的键盘焦点环

**问题描述**：默认焦点环绘制在元素边框之外。发现页的 `.discover-strip` / `.discover-playlists` 使用 `overflow-x: auto`，侧栏 `.nav` 使用 `overflow-x: hidden` + `overflow-y: auto`；当焦点环超出容器内容区时，超出部分被容器裁掉，表现为 30 首歌曲条目顶部、每日 30 首歌单卡片顶部与导航按钮左侧的描边缺失。焦点环可能出现在任意可聚焦元素上，逐个调整容器 padding 无法覆盖所有滚动场景，且会改变既有间距。

**解决方法**：

- 为 `a`、`button`、`[role="button"]` 与 `[tabindex]` 的 `:focus-visible` 增加统一焦点环：`outline: 2px solid var(--accent-strong)`，并用 `outline-offset: -2px` 向内收 2px。
- 焦点环完全落在元素边框盒内，父级滚动容器的 `overflow` 不再影响描边；元素自身的圆角仍由 `outline` 跟随。
- 输入框、文本域与滑杆继续使用各自已有的聚焦样式，不叠加全局焦点环。
- 不取消滚动容器的 `overflow`，滚动行为保持不变；`overflow` 只影响向外绘制的描边，焦点环内收后不再受其影响。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 补全局 `:focus-visible` 焦点环的选择器、颜色与 `outline-offset: -2px`，说明向内绘制用于避免滚动容器裁剪，输入框沿用自身聚焦样式。 |
| `USER.html` | §2 CONVENTIONS（`#u2`） | 改 | 增加“键盘焦点”约定：Tab 遍历时显示 2px 强调色焦点环，绘制在元素内侧，滚动容器不会裁掉描边。 |
| `CORE.html` | §4.68 `DiscoverView.vue`（`#c4-68`） | 不动 | 焦点环契约由 §4.49 统一维护；发现页只负责提供滚动容器，不重复记录样式。 |
| `USER.html` | §5.2.8 页面结构 · 发现（`#u5-2-8`） | 不动 | 已由 §2 的共用约定覆盖，不再逐页描述键盘焦点。 |
| `README.md` | §2 用户交互 | 不动 | 键盘焦点是通用交互细节，不作为首页能力条目重复列出。 |
| `ABOUT.html` | 用户交互 | 不动 | 与 README 同步保持现状。 |

### 3.7 发现页歌单卡片 hover 上移后被滚动容器裁掉顶边

**问题描述**：`.card:hover` 使用 `transform: translateY(-2px)` 制造上浮反馈，卡片本身不参与布局重排。`.discover-playlists` 用 `overflow-x: auto` 提供横向滚动，且顶部没有内边距；卡片上移 2px 后，顶部 1px 边框与上浮后的背景落到滚动容器裁剪区之外，表现为悬停时顶边消失。3.6 的焦点环内收只能解决键盘描边，无法覆盖 hover 位移。

**解决方法**：

- 在 `.discover-playlists` 预留顶部空间：`padding-top: 4px`，同时把 `margin-top` 从 `10px` 收到 `6px`，卡片与上方内容的整体间距仍为 10px。
- 4px 内边距大于 2px 的上移距离，hover 后卡片顶边仍留 2px 余量；容器继续使用 `overflow-x: auto`。
- 不取消 `.card:hover` 的上浮效果，也不改卡片边框颜色与阴影。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 补 `.discover-playlists` 的 `margin-top: 6px` 与 `padding-top: 4px`，说明为 `.card:hover` 的 `translateY(-2px)` 预留空间。 |
| `USER.html` | §5.2.8 页面结构 · 发现（`#u5-2-8`） | 不动 | 悬停上浮属于样式细节，由 §4.49 记录；页面结构描述不重复。 |
| `CORE.html` | §4.68 `DiscoverView.vue`（`#c4-68`） | 不动 | 组件结构不变，只由样式文件提供裁剪余量。 |

### 3.8 上游日推歌单名缺少账号昵称前缀

**问题描述**：每日推荐取到的动态歌单 `PlaylistMeta.name` 是上游原值“的今日私享”，前面缺少“某某”的昵称；发现页分区标题、歌单卡片、歌单详情、最近歌单与我的歌单卡片都会直接显示这个原值。上游没有在歌单元数据里提供昵称，昵称由登录资料接口（`user.getProfile`）单独返回，因此不能只改上游映射。

**解决方法**：

- 在 `utils/format.ts` 增加 `dailyPlaylistName(name, nickname)`：仅当名称以“的今日私享”开头且昵称非空时，拼成“昵称 + 名称”；昵称为空、普通歌单名、已经带昵称的名称都原样返回。
- 只在展示层调用：发现页分区标题与歌单卡片、歌单详情标题与删除确认、最近歌单、我的歌单卡片；不修改主进程缓存和 `PlaylistMeta`，避免把昵称写进持久化歌单数据。
- 昵称取 `auth.profile.nickname`；资料未加载时先显示原名，加载后由 Vue 响应式更新。
- 增加 `test/format.test.ts` 用例，覆盖补前缀、空昵称、普通歌单名与已带昵称四种情况。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §2 CONVENTIONS（`#u2`） | 改 | 增加“日推歌单名称”约定：显示为“当前账号昵称 + 的今日私享”，昵称未加载时先显示原名。 |
| `CORE.html` | §4.32 `utils/format.ts`（`#c4-32`） | 改 | 增加 `dailyPlaylistName(name, nickname)` 签名与规则。 |
| `CORE.html` | §4.68 `DiscoverView.vue`（`#c4-68`） | 改 | 分区标题与歌单卡片统一走 `dailyPlaylistName`。 |
| `CORE.html` | §4.46 `PlaylistView.vue`（`#c4-46`） | 改 | 歌单头标题与删除确认使用同一展示名。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） / §4.45 `LibraryView.vue`（`#c4-45`） | 改 | 最近歌单与我的歌单卡片也使用同一展示名。 |
| `USER.html` | §5.2.8 页面结构（`#u5-2-8`） | 不动 | 已由 §2 共用约定覆盖，不逐页重复。 |

### 3.9 发现页每日推荐同时渲染歌曲列表与伪歌单入口

**问题描述**：每日推荐分区同时渲染 30 首歌曲条目与“昵称的今日私享”歌单卡片；两者指向同一份日推内容，歌曲列表让每日推荐区域重复且多占 3 行高度。骨架也按“30 条歌曲 + 1 张卡片”渲染，加载完成后移除列表会产生明显跳动。

**解决方法**：

- 增加 `showsSongStrip(section)`：仅当分区没有 `playlists` 且 `songs` 非空时渲染歌曲条目；每日推荐有歌单卡片后不再渲染 30 首列表。
- 每日推荐骨架只渲染 1 张歌单卡片占位；`DiscoverSkeleton` 在 `songs === 0` 时不输出空的 `.discover-strip`，避免占位高度残留。
- 专属雷达 / 猜你喜欢没有歌单入口，继续渲染固定宽度歌曲条目；推荐数据加载与歌单卡片跳转逻辑不变。
- 不删除 `section.songs`：日推歌单仍需要预加载与歌单详情缓存，只停止在发现页重复展示。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §1 TERMS（`#u1`） | 改 | 增加“伪歌单”术语：推荐数据生成、外观与歌单卡片一致的单入口，不写入账号歌单。 |
| `USER.html` | §5.2.8 页面结构 · 发现（`#u5-2-8`） | 改 | 每日推荐只保留“昵称的今日私享”伪歌单入口；其余分区保留 3 行横向滚动歌曲条目；骨架按两种布局渲染。 |
| `CORE.html` | §4.68 `DiscoverView.vue`（`#c4-68`） | 改 | 记录 `showsSongStrip` 判定、骨架传参与每日推荐只渲染卡片。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 明确有歌单入口的分区不渲染歌曲条目，其余分区继续 3 行横向滚动。 |
| `README.md` | §2 用户交互 · 发现行 | 改 | 同步伪歌单入口与其余分区条目。 |
| `ABOUT.html` | 用户交互 · 发现行 | 改 | 与 README 同步。 |
| `CORE.html` | §4.62 `stores/recommend.ts`（`#c4-62`） | 不动 | 仍按三分区返回 30 首日推；本轮只改展示，不调整推荐抓取与缓存。 |

### 3.10 每日推荐按自然日过期，不能手动刷新

**资料结论**：QQ 音乐没有公开日推的精确切换时间，但上游卡片 `time` 是日期时间戳，日推封面也是 `calendar/MMDD_300.jpg` 形式；第三方实现（simple-music 的 QQ 音乐接口文档）同样使用“上海日键”并每 60 秒检查跨日。因此按上海自然日 0 点失效更符合上游语义，不应从首次加载起滚动 24 小时。

**问题描述**：发现页把三个推荐分区统一按 24 小时 TTL 缓存，每日推荐还提供单区刷新按钮，顶部“换一批”也会强制刷新全部；页面跨过 0 点后不会自动更新，用户可能一整天看到昨天的日推。

**解决方法**：

- `RecommendSection` 增加 `expiresAtMs`：每日推荐为下一个上海自然日 0 点，雷达 / 猜你喜欢为抓取后 24 小时，占位分区为 0。
- 主进程缓存直接按 `expiresAtMs` 判断；`force` 只对雷达 / 猜你喜欢生效，不能绕过仍在有效期内的当天日推。读取日推歌单期间若跨过 0 点，立即把 `expiresAtMs` 标为当前时间，避免缓存昨天的内容。
- 渲染层 `load(force)` 不再强制日推；`refreshSection('daily')` 只在占位或过期时走普通 `get`，未过期的当天日推直接忽略。
- 新增 `isDailyExpired()` 与 `refreshDailyIfExpired()`；发现页挂载后每 60 秒检查一次，跨日后自动重取，卸载时清除定时器。
- 移除每日推荐分区的刷新按钮；顶部“换一批”只刷新雷达与猜你喜欢，并补充 tooltip。
- 增加 store 测试，覆盖强制加载不刷新日推、有效日推拒绝手动刷新、过期检测与自动重取、未过期不重取。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §1 TERMS · 推荐分区（`#u1`） | 改 | 每日推荐按上海自然日 0 点失效；雷达 / 猜你喜欢缓存 24 小时。 |
| `USER.html` | §2 CONVENTIONS（`#u2`） | 改 | 增加“每日推荐刷新”约定：0 点自动过期、无手动刷新、每分钟检查跨日。 |
| `USER.html` | §5.2.8 页面结构 · 发现（`#u5-2-8`） | 改 | 日推无单区刷新；雷达 / 猜你喜欢保留刷新；顶部“换一批”只作用于后两者。 |
| `CORE.html` | §4.1 `src/shared/types.ts`（`#c4-1`） | 改 | `RecommendSection` 增加 `expiresAtMs` 并说明日推与其他分区的差异。 |
| `CORE.html` | §4.53 `src/main/api/recommend.ts`（`#c4-53`） | 改 | 缓存改按 `expiresAtMs`；日推按上海自然日、`force` 不生效；读歌单跨日立即过期。 |
| `CORE.html` | §4.62 `stores/recommend.ts`（`#c4-62`） | 改 | 增加 `isDailyExpired` / `refreshDailyIfExpired`，说明 `load` 与 `refreshSection` 的日推限制。 |
| `CORE.html` | §4.68 `DiscoverView.vue`（`#c4-68`） | 改 | 移除日推刷新按钮，增加 60 秒跨日定时器与“换一批”范围。 |
| `CORE.html` | §5.13 推荐加载（`#c5-13`） | 改 | 调用树区分日推缓存 / 跨日重取与定时器分支。 |
| `CORE.html` | §4.50 `src/shared/constants.ts`（`#c4-50`） | 改 | `RECOMMEND_CACHE_TTL_MS` 只用于雷达 / 猜你喜欢。 |
| `README.md` | §2 用户交互 · 发现行 | 改 | 同步日推 0 点自动更新与无手动刷新。 |
| `ABOUT.html` | 用户交互 · 发现行 | 改 | 与 README 同步。 |

### 3.11 猜你喜欢改为连续队列

**问题描述**：猜你喜欢原本按普通推荐分区渲染 30 首歌曲条目，点击只把当前分区当成静态列表播放；需求是改成“伪歌单”入口，点击后以拉取的 5 首启动连续队列，播放到队尾自动补 5 首，并在队列激活期间锁定顺序播放。

**解决方法**：

- `loadGuess` 只取第 1 页 5 首作为伪歌单封面与连续队列首批；新增 `fetchGuessBatch(page, size = GUESS_RADIO_BATCH_SIZE)`，通过 `page` / `pageNo` / `offset` / `num` 拉取单批。
- 新增 `recommend.guess(page)` IPC、preload 与渲染层契约，返回 `Song[]`；主进程只负责单批读取，不维护队列状态。
- 播放器新增 `startRadioQueue(songs)`：`queueSource` 增加 `radio` 类型，模式强制为 `sequence`，从第 2 页开始预取。
- `playAt()` 定位到队尾时调用 `ensureRadioBatch()`：同一 radio 会话单飞、最多翻 3 页、按 `songMid` 去重后追加；预取较慢且队尾已停止时补入后自动续播。开始其他歌单 / 歌曲时递增 radio 会话并解除锁定。
- 新增 `modeLocked`：队列激活期间 `setMode` / `cycleMode` / `setShuffle` / `setLoopStatus` 与 MPRIS 命令均不改变模式；播放条模式按钮禁用并关闭菜单。
- 发现页猜你喜欢改为伪歌单卡片（封面取首批第一首），点击调用 `startRadioQueue()`；骨架与标题计数同步改为卡片形态。
- 测试覆盖 5 首分页请求参数、连续队列启动与模式锁定、队尾补批、切回普通队列解锁。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §1 TERMS（`#u1`） | 改 | 增加“猜你喜欢连续队列”定义，并补充伪歌单入口行为。 |
| `USER.html` | §5.2.3 播放条（`#u5-2-3`） | 改 | 连续队列激活时模式按钮禁用，固定顺序播放。 |
| `USER.html` | §5.2.8 页面结构 · 发现（`#u5-2-8`） | 改 | 猜你喜欢改为伪歌单入口，点击启动连续队列。 |
| `USER.html` | §5.2.9 播放队列（`#u5-2-9`） | 改 | 补充每批 5 首自动续接、不显示批次边界。 |
| `CORE.html` | §4.2 `src/shared/ipc.ts`（`#c4-2`） | 改 | 增加 `recommend.guess(page)` 契约。 |
| `CORE.html` | §4.29 `stores/player.ts`（`#c4-29`） | 改 | 增加 `QueueSource.kind = radio`、`startRadioQueue`、`ensureRadioBatch`、`modeLocked` 与模式守卫。 |
| `CORE.html` | §4.40 `PlayerBar.vue`（`#c4-40`） | 改 | 模式按钮在队列锁定时禁用并关闭菜单。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 增加 `.mode-button:disabled` 样式。 |
| `CORE.html` | §4.53 `src/main/api/recommend.ts`（`#c4-53`） | 改 | 增加 `fetchGuessBatch`，猜你喜欢改为 5 首分页。 |
| `CORE.html` | §4.68 `DiscoverView.vue`（`#c4-68`） | 改 | 猜你喜欢伪歌单卡片、骨架与启动入口。 |
| `CORE.html` | §5.13 推荐加载（`#c5-13`） | 改 | 猜你喜欢首批 5 首的调用链。 |
| `CORE.html` | §5.20 猜你喜欢连续队列（`#c5-20`） | 增 | 记录启动、队尾预取、停止与模式锁定的完整调用树。 |
| `CORE.html` | §4.50 `src/shared/constants.ts`（`#c4-50`） | 改 | 增加 `GUESS_RADIO_BATCH_SIZE = 5`。 |
| `PROVIDER.html` | §4.1 消费的 HTTP 接口（`#p4-1`） | 改 | 说明猜你喜欢按 5 首分页。 |
| `PROVIDER.html` | §4.3 数据模型与转换（`#p4-3`） | 改 | 说明单批 5 首与跨批去重。 |
| `README.md` | §2 用户交互 · 发现行 | 改 | 同步猜你喜欢连续队列。 |
| `ABOUT.html` | 用户交互 · 发现行 | 改 | 与 README 同步。 |

### 3.12 发现页首行合并两个伪歌单入口

**问题描述**：每日推荐与猜你喜欢各占一个分区行，各自带分区标题、计数与刷新入口，首屏被拆成多行；需求是把两个伪歌单卡片并排放在第一行，猜你喜欢排第一位，并去掉这两个分区的标题、刷新键与页面整体“换一批”。

**解决方法**：

- 用 `topSections`（guess → daily）与 `listSections`（radar）拆分渲染；首行 `.discover-top` 使用 flex 横向左对齐排列，两张卡片固定原 150px 尺寸，保留封面 1:1 的比例与高度上限，不随首行宽度放大，也不填满整行。
- 首行两张卡片不再渲染 `section-title`、计数与单区刷新按钮；骨架也改为两个卡片占位，并取消骨架内部 `.discover-playlists` 的顶部间距与横向滚动。
- 移除页面顶部“换一批”按钮；专属雷达继续保留标题、计数、刷新入口与 3 行歌曲条目，日推由自然日过期自动更新。
- 卡片点击行为不变：猜你喜欢启动连续队列，每日推荐进入歌单详情。
- 只调整布局与可见入口，不改变推荐抓取、卡片点击与连续队列逻辑。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.8 页面结构 · 发现（`#u5-2-8`） | 改 | 猜你喜欢在左、每日推荐在右并排在第一行，不显示分区标题与刷新键；专属雷达保留标题与刷新。 |
| `CORE.html` | §4.68 `DiscoverView.vue`（`#c4-68`） | 改 | 记录 `topSections` 顺序、移除“换一批”与首行布局。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 增加 `.discover-top` 左对齐 flex、固定卡片尺寸与骨架间距覆盖。 |
| `README.md` | §2 用户交互 · 发现行 | 改 | 同步首行两个伪歌单卡片与移除整体换一批。 |
| `ABOUT.html` | 用户交互 · 发现行 | 改 | 与 README 同步。 |

### 3.13 评论正文混用真实换行与字面量 `\n`

**问题描述**：部分多行评论能正常换行，另一些直接显示字面量 `\n`。检查后确认不是渲染层转义问题：评论区使用 Vue 文本插值并按纯文本渲染，CSS 的 `white-space: pre-wrap` 会把真实换行显示出来；但上游 `Content` 字段不统一，有的记录返回真实换行，有的返回字面量 `\n` / `\r\n` / `\r` 两个字符，后者自然只会显示为反斜杠加 n。同一首歌的不同评论、甚至不同页之间都可能混用两种格式。

**解决方法**：

- 在 `src/main/api/comment.ts` 新增 `normalizeCommentContent()`：先把真实 `\r\n` / `\r` 统一为 `\n`，再把字面量 `\r\n` / `\n` / `\r` 统一替换为真实换行，最后写入 `Comment.content`。
- 渲染层继续保持纯文本插值与 `white-space: pre-wrap`，不引入 HTML / Markdown 解析，避免上游内容被当作标签执行。
- 扩展 `test/api/comment.test.ts`，覆盖字面量 `\n`、字面量 `\r\n`、字面量 `\r` 与真实 CRLF 四种输入，统一映射为真实换行。
- 明确这是上游数据格式不统一，不是渲染逃逸逻辑错误；评论区只需在数据映射边界做归一化。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUES.md` | 第 1 项“评论里的 `\n` 字样” | 改 | 行尾追加 ` [已解决]`。 |
| `USER.html` | §5.2.5 歌词与评论（`#u5-2-5`） | 改 | 说明真实换行与字面量 `\n` / `\r\n` / `\r` 都统一显示为换行，正文不解析 HTML。 |
| `CORE.html` | §4.15 `src/main/api/comment.ts`（`#c4-15`） | 改 | 记录 `normalizeCommentContent()` 的归一化规则与渲染层 `white-space: pre-wrap` 约束。 |
| `PROVIDER.html` | §2 CONVENTIONS · 评论正文换行（`#p2`） | 增 | 说明上游 `Content` 混用真实换行与字面量转义，应用在映射时统一为真实换行。 |
| `PROVIDER.html` | §4.3 数据模型与转换（`#p4-3`） | 改 | 在 `QqCommentList` 字段说明中补充 `Content` 换行归一化。 |
