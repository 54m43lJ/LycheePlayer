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

### 3.14 界面冗余文字说明

**问题描述**：ISSUES 列出一批界面文案多余：侧栏账号行重复写“已登录”、logo 块带“QQ Music · Linux”副标题、设置页为缓存清理与退出应用附加说明、发现页猜你喜欢带“连续推荐 · 顺序播放”副标题、歌单页重复显示已载入数量、播放历史页头显示容量说明，以及所有搜索框都带占位文字。这些信息要么与已有标题 / 数值重复，要么属于实现细节，挤占本已紧凑的窄屏和列表空间。

**解决方法**：

- `App.vue` 删除品牌块副标题；登录账号 pill 的次级行只显示 `musicid`；播放队列筛选框去掉占位文字，保留 `aria-label`。
- `SettingsView.vue` 删除播放缓存上限与退出应用的 `setting-desc`；清理策略与退出行为仍由功能与文档说明。
- `DiscoverView.vue` 删除猜你喜欢卡片的“连续推荐 · 顺序播放”副标题，只保留标题。
- `PlaylistView.vue` 删除歌单头的已载入数；底部 footer 只在加载中 / 中断时显示“正在加载”或“加载中断 + 重试”，完整加载后不占位；筛选框去掉占位文字，保留 `aria-label`。
- `HistoryView.vue` 删除页头记录数 / 容量说明，搜索框去掉占位文字，保留 `aria-label`。
- 在线搜索与下载中心搜索框去掉占位文字，改为 `aria-label`；删除不再使用的 `.brand-sub` 样式。
- 删除搜索结果中歌手 / 专辑卡片“查看歌手信息与歌曲”“查看专辑信息与歌曲”的说明性副标题，只保留名称；设置项“播放缓存（不影响已下载）”恢复为“播放缓存”；播放历史空状态去掉容量说明。
- 把规则写入 USER §2 CONVENTIONS「界面文案」：界面只显示操作名、状态、数据值与必要错误；不用小字、副标题或说明行解释 UI 行为、实现细节或操作后果；空状态只说明下一步，不重复容量或策略。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUES.md` | 第 2 项“清理多余的文字解释” | 改 | 行尾追加 ` [已解决]`。 |
| `USER.html` | §2 CONVENTIONS · 界面文案（`#u2`） | 增 | 明确禁止用小字 / 副标题 / 说明行解释 UI 行为、清理策略、实现细节或操作后果；解释归文档。 |
| `USER.html` | §5.2.2 侧栏与导航（`#u5-2-2`） | 改 | 品牌区只显示应用名；账号次级行只显示 musicid；同步原型。 |
| `USER.html` | §5.2.7 设置页（`#u5-2-7`） | 改 | 播放缓存上限与退出应用不显示解释文案；同步原型。 |
| `USER.html` | §5.2.4 歌曲列表（`#u5-2-4`） / §5.2.9 播放队列（`#u5-2-9`） | 改 | 歌单筛选与队列筛选输入框不显示占位文字。 |
| `USER.html` | §5.2.8 页面结构 · 搜索 / 发现 / 歌单详情 / 播放历史 / 下载中心（`#u5-2-8`） | 改 | 搜索框无占位文字；猜你喜欢无副标题；歌单不显示已载入数量；播放历史页头不显示记录数；下载中心搜索框无占位文字。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） | 改 | 删除品牌副标题与“已登录”前缀；队列筛选框改为 `aria-label`。 |
| `CORE.html` | §4.44 `SearchView.vue`（`#c4-44`） | 改 | 在线搜索框不显示占位文字，保留无障碍名称；歌手 / 专辑卡片不再显示说明性副标题。 |
| `CORE.html` | §4.46 `PlaylistView.vue`（`#c4-46`） | 改 | 删除已载入数量；footer 只在加载中 / 中断时显示；筛选框改为 `aria-label`。 |
| `CORE.html` | §4.48 `SettingsView.vue`（`#c4-48`） | 改 | 播放缓存上限与退出应用不显示解释文案；“播放缓存”标题去掉“不影响已下载”括号说明。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | `.feed-footer` 只在加载中 / 中断时占位；删除 `.brand-sub`。 |
| `CORE.html` | §4.67 `DownloadsView.vue`（`#c4-67`） | 改 | 下载搜索框不显示占位文字，保留无障碍名称。 |
| `CORE.html` | §4.68 `DiscoverView.vue`（`#c4-68`） | 改 | 猜你喜欢卡片只显示标题，删除“连续推荐 · 顺序播放”。 |
| `CORE.html` | §4.87 `HistoryView.vue`（`#c4-87`） | 改 | 页头只显示标题；搜索框改为 `aria-label`；空状态只提示下一步，不再说明容量。 |

### 3.15 歌单卡片播放按钮不随播放状态切换

**问题描述**：歌单卡片的中心按钮只有“播放整个歌单”一种状态。当前卡片对应歌单已经在播放时，按钮仍显示播放图标，点击会重新起播而不是暂停；也无法从卡片恢复已暂停的歌单。用户要求按钮跟随播放器状态，在当前正在播放时显示暂停并点击暂停，暂停后还能点击继续。

**解决方法**：

- `usePlaylistPlay` 增加 `isSourcePlaying()` / `isSourcePaused()` / `toggleSource()`：按 `player.queueSource` 的 `kind + id` 判断卡片是否对应当前队列；正在播放或已暂停时调用 `player.toggle()`，其他来源或已停止时执行原起播函数。
- `CardPlayButton` 增加 `playing` / `paused` / `pauseLabel` / `resumeLabel`：播放时显示 `pause` 图标与“暂停播放”，暂停后显示 `play` 图标与“继续播放”，加载态仍优先显示 spinner；`title` / `aria-label` 同步切换。
- “我的歌单”、搜索结果、发现页每日推荐均以 `playlist / <id>` 来源接入；猜你喜欢以 `radio / guess` 来源接入，首次播放仍调用 `startRadioQueue()`。
- 扩展 `test/playlist-play.test.ts`，覆盖同来源播放 / 暂停切换、其他来源重新起播与已停止状态重新启动。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUES.md` | 第 3 项“歌单 hover 播放按钮智能切换” | 改 | 行尾追加 ` [已解决]`。 |
| `USER.html` | §1 TERMS · 歌单卡片播放（`#u1`） | 改 | 补播放中显示暂停、暂停后继续，以及猜你喜欢同样支持。 |
| `USER.html` | §5.2.8 页面结构（`#u5-2-8`） | 改 | 搜索 / 我的歌单 / 发现行补充卡片按钮随播放状态切换；增加全局状态同步说明。 |
| `CORE.html` | §4.44 `SearchView.vue`（`#c4-44`） | 改 | 歌单卡片改用 `toggleSource`。 |
| `CORE.html` | §4.45 `LibraryView.vue`（`#c4-45`） | 改 | 歌单卡片改用 `toggleSource` 并传入播放 / 暂停状态。 |
| `CORE.html` | §4.68 `DiscoverView.vue`（`#c4-68`） | 改 | 每日推荐接入 `playlist` 来源；猜你喜欢接入 `radio / guess` 来源。 |
| `CORE.html` | §4.89 `CardPlayButton.vue`（`#c4-89`） | 改 | 增加 `playing` / `paused` 与暂停 / 继续文案，图标和 aria 标签随状态切换。 |
| `CORE.html` | §4.90 `playlist-play.ts`（`#c4-90`） | 改 | 增加 `isSourcePlaying` / `isSourcePaused` / `toggleSource` 签名与判定规则。 |
| `CORE.html` | §5.22 歌单卡片直接播放（`#c5-22`） | 改 | 调用树增加同来源暂停 / 继续分支，原起播流程挂在其他来源 / 已停止分支下。 |
| `README.md` | §2 用户交互 · 歌单卡片播放行 | 改 | 补充播放中暂停、暂停后继续。 |
| `ABOUT.html` | 用户交互 · 歌单卡片播放行 | 改 | 与 README 同步。 |

### 3.16 评论正文中的 U+FFFC：表情占位与图片评论

**问题描述**：ISSUES 反馈部分评论“有些文字没正常渲染”，例子为“好听哈￼”（Im Doing Fine，2026-10-24 10:22）。初次定位时只看到该条记录末尾的 ￼ 是 `U+FFFC`（对象替换符），且 `Pic` / `EmoPic` 都为空，于是按“无对应对象的空框”直接删除。复查另一条评论（No Jam，2026-05-29 20:05，用户 Aelita）后发现两处的 ￼ 确实是同一个码位 `U+FFFC`，但这条的 `Content` 只有这个占位符、`Pic` 却是一张 1179×1095 的梗图；直接删除会把整条图片评论过滤掉。

进一步抽样评论数据后确认 `U+FFFC` 是上游客户端的通用内嵌媒体占位：

- `Pic` 是评论附图，可独立存在（正文 + 图、纯图、正文为空 + 图都出现过），文本中通常不再出现占位符。
- `EmoPic` 是内嵌表情图，URL 对应正文中的 `U+FFFC` 位置；有的评论 `EmoPic` 非空但没有占位符，表示表情追加在正文末尾。
- 两者都为空时，`U+FFFC` 才是没有对象的残留占位，例如“好听哈￼”“求歌词翻译￼。￼”。
- 现有过滤条件 `content.trim().length > 0` 还会丢掉“正文为空但有 `Pic` / `EmoPic`”的纯图片 / 纯表情评论。

**解决方法**：

- `RawComment` 增加 `Pic` / `EmoPic`，`Comment` 增加 `imageUrl` / `emojiUrl`；媒体 URL 与头像共用 `http:` → `https:` 归一化。
- `normalizeCommentContent()` 仅归一化换行；`EmoPic` 非空时保留 `U+FFFC` 供渲染层定位，`EmoPic` 为空时移除所有占位符，避免空框。
- `CommentsPanel` 按 `U+FFFC` 切分正文，把第一个占位符替换为 `emojiUrl`；没有占位符时把表情追加到正文末尾，多余占位符丢弃。`imageUrl` 附图单独显示在正文下方，只有图片或表情的评论也照常显示。
- 过滤条件改为“有正文或有图片或有表情”，正文与媒体都为空才丢弃。
- 扩展 `test/api/comment.test.ts`：覆盖无媒体的残留占位、`Pic` 附图（含纯图与正文仅占位）、`EmoPic` 内嵌表情（含无占位符）、纯媒体评论保留与空评论过滤。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUES.md` | 第 1 项“评论渲染支持” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §5.2.5 歌词与评论（`#u5-2-5`） | 改 | 说明表情按 `U+FFFC` 位置内联、附图显示在正文下方、无表情的占位符移除、纯媒体评论保留。 |
| `CORE.html` | §4.1 内部类型（`#c4-1`） | 改 | `Comment` 增加 `imageUrl` / `emojiUrl`。 |
| `CORE.html` | §4.15 `src/main/api/comment.ts`（`#c4-15`） | 改 | 记录 `Pic` / `EmoPic` 映射、`U+FFFC` 保留 / 移除规则与纯媒体评论过滤条件。 |
| `CORE.html` | §4.42 `CommentsPanel.vue`（`#c4-42`） | 改 | 记录正文切分、表情内联 / 追加与附图展示。 |
| `PROVIDER.html` | §2 CONVENTIONS · 评论正文换行（`#p2`） | 改 | 说明 `Content` 的 `U+FFFC` 与 `Pic` / `EmoPic` 的关系及映射规则。 |
| `PROVIDER.html` | §4.3 数据模型与转换（`#p4-3`） | 改 | `QqComment` 增加 `Pic` / `EmoPic`；转换表补充两个媒体字段。 |
| `README.md` | §2 用户交互 · 歌词 / 评论行 | 改 | 补充评论支持内嵌表情与附图。 |
| `ABOUT.html` | 用户交互 · 歌词 / 评论行 | 改 | 与 README 同步。 |

### 3.17 QQ 网页登录凭证没有走正确的续期路径

**问题描述**：ISSUES 反馈凭证到期后应用没有主动续期，最终只能重新登录。原实现虽然已有 30 分钟定时检查和到期前 10 分钟窗口，但 `refreshMusickey()` 只调用 `music.login.LoginServer/Login` 的 `refresh_token` 流程，这是移动端 / 微信登录的续期方式；QQ 网页扫码登录的稳定路径是 `QQConnectLogin.LoginServer/QQLogin`，用旧 `musickey` 加 `expired_in` 直接换新 key，旧 key 已过期时仍可尝试恢复。续期路径不匹配时，定时器每次失败后只能等下个 30 分钟，到期瞬间的请求也会直接返回 `AUTH_EXPIRED`。

**解决方法**：

- `refreshMusickey()` 改为优先调用 `QQConnectLogin.LoginServer/QQLogin`，参数 `{ expired_in: 7776000, musicid, musickey }`，其中 `expired_in` 声明 90 天会话；微信账号或 QQLogin 失败且存在 `refresh_token` 时，回退到原 `music.login.LoginServer/Login` 流程。
- 新增 `mergeRefreshedCredential()` 统一合并续期响应：更新 `musickey`、按 `musickeyCreateTime + keyExpiresIn` 重算 `expiredAtMs`，并在响应携带时更新 `refresh_token` / `access_token` / `openid` / `unionid` / `refresh_key` / `loginType`。
- `client.ts` 增加 `setCredentialRefresher()` 注册入口，避免 client ↔ login 循环依赖；`musicu` 收到 `1000` / `104401` / `104400` 时自动续期一次并换新凭证重试原请求。收藏等自行持有凭证的流程通过 `withCredentialRefresh()` 获得同样的一次续期重试。
- 续期失败保留旧凭证与原错误，定时器继续按到期时间重试。
- 新增 `test/api/login-refresh.test.ts` 与 `test/api/client-auth-refresh.test.ts`，覆盖 QQLogin 主路径、refresh_token 回退、微信账号顺序、到期窗口判断、登录失效自动重试、显式匿名凭证不续期与续期失败保留原错误。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUES.md` | 第 2 项“凭证到期后自动续期” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §5.2.7 设置页（`#u5-2-7`） | 改 | 说明 QQ 网页登录凭证到期前自动续期，登录失效时立即尝试续期并重试；手动 Cookie 不提供“立即续期”按钮。 |
| `USER.html` | §5.3 错误与通知（`#u5-3`） | 改 | `AUTH_EXPIRED` 先自动续期一次并重试，仍失败才提示重新登录。 |
| `CORE.html` | §4.8 `src/main/api/client.ts`（`#c4-8`） | 改 | 增加 `setCredentialRefresher()` / `withCredentialRefresh()` 签名与登录失效重试说明。 |
| `CORE.html` | §4.16 `src/main/api/login.ts`（`#c4-16`） | 改 | 记录 QQLogin 主路径、refresh_token 回退与 `mergeRefreshedCredential()`。 |
| `CORE.html` | §4.50 `src/shared/constants.ts`（`#c4-50`） | 改 | 增加 `SESSION_REFRESH_EXPIRED_IN`。 |
| `CORE.html` | §5.7 会话续期（`#c5-7`） | 改 | 调用树增加 QQLogin 主路径、回退分支与 `musicu` 登录失效重试。 |
| `PROVIDER.html` | §4.1 上游方法（`#p4-1`） | 改 | 拆分 QQ 网页登录续期、refresh_token 回退与 QQ 登录换证，并补充 QQLogin 续期参数。 |
| `PROVIDER.html` | §4.5 请求画像（`#p4-5`） | 改 | 增加 QQLogin 续期请求画像。 |
| `README.md` | §2 用户交互 · 登录行 | 改 | 补充凭证到期前自动续期。 |
| `ABOUT.html` | 用户交互 · 登录行 | 改 | 与 README 同步。 |

### 3.18 后退手势在浮层打开时执行页面导航

**问题描述**：鼠标侧键后退由 Chromium 直接遍历历史，应用没有统一的浮层拦截。歌词 / 评论、播放队列、窄屏侧栏或确认对话框打开时按下后退，会直接切换路由；浮层要么被路由变化顺带关闭，要么继续覆盖新页面。各组件只处理 Esc 与关闭按钮，没有共享的“后退优先关闭最上层浮层”入口。

**解决方法**：

- 新增 `composables/back-navigation.ts`：模块级关闭栈、`pushBackDismiss` / `dismissTopPopup`、`useBackDismiss` 与 `installBackNavigation`。浮层打开时入栈，关闭或卸载时注销；后退只关闭栈顶，没有浮层才调用 `router.back()`。
- 主进程监听窗口 `app-command` 的 `browser-backward`，通过 `navigation:back` 推送给渲染层，不在主进程执行导航；Linux 按下 / 抬起各触发一次，主进程与渲染层都以 200ms 窗口去重。
- 渲染层在捕获阶段拦截后退侧键的 `mouseup`，阻止 Chromium 自带历史导航，确保一次按键只产生一次浮层关闭或路由后退。
- 歌词 / 评论、播放队列、窄屏侧栏、`ConfirmDialog`、`ReauthDialog`、`PlaylistPicker`、`PlaylistEditDialog` 接入统一浮层栈；“下载”删除确认框复用 `ConfirmDialog`，随其生效。
- 新增 `test/back-navigation.test.ts` 覆盖后进先出的关闭顺序。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUES.md` | 第 1 项“在任何弹出时‘后退’操作的行为应该是关闭弹出” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §2 CONVENTIONS · 后退手势（`#u2`） | 增 | 说明后退优先关闭最上层浮层，没有浮层才沿路由历史返回。 |
| `CORE.html` | §1 文件树 · `composables/back-navigation.ts` / `test/back-navigation.test.ts` | 增 | 登记浮层关闭栈与测试。 |
| `CORE.html` | §4.2 `src/shared/ipc.ts`（`#c4-2`） | 改 | 增加 `navigation.onBack` 与 `navigation:back` 通道。 |
| `CORE.html` | §4.4 `src/main/index.ts`（`#c4-4`） | 改 | 记录 `app-command` 后退转发与去重。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） | 改 | 安装后退分发，播放队列与窄屏侧栏注册关闭。 |
| `CORE.html` | §4.66 / §4.72 / §4.77 / §4.81 / §4.91 | 改 | 各对话框与歌词 / 评论浮层补充后退关闭注册。 |
| `CORE.html` | §4.92 `back-navigation.ts`（`#c4-92`） | 增 | 记录关闭栈、打开状态监听、后退分发与鼠标侧键拦截。 |

### 3.19 QQ 网页登录续期被上游以 10006 拒绝

**问题描述**：QQ 网页扫码登录后，续期日志持续出现 `temp-failed`，上游返回 `10006（QQConnectLogin.LoginServer.QQLogin(refresh)）`。续期请求只发送了 `expired_in`、字符串 `musicid` 与旧 `musickey`，`comm` 只有 `tmeLoginType`；缺少网页登录拿到的 `access_token` / `refresh_token` / `openid`、数字账号与 `uin` / `g_tk` 等公共参数，被上游按参数错误拒绝，并非上游故障。

**解决方法**：

- `refreshViaQqLogin` 参数补齐 `onlyNeedAccessToken` / `forceRefreshToken`（0）、`access_token`、`refresh_token`、`openid` 与数字 `musicid`；OAuth 字段缺失时从 `Credential.webCookies` 的 `psrf_qqaccess_token` / `psrf_qqrefresh_token` / `psrf_qqopenid` 回退读取。
- 请求 `comm` 补齐 `uin`、`g_tk`（由旧 `musickey` 计算）、`format`、`ct`、`cv` 与 `platform`；登录方式仍固定为 QQ，不跨方式回退。
- 续期响应解析兼容 `req_0` / `req` / `req1`，避免只在顶层节点名不同时误判为响应缺失。
- 扩展 `test/api/login-refresh.test.ts`：覆盖完整 QQ 续期参数、网页 Cookie 字段回退与 `req1` 响应。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUES.md` | 第 2 项“QQ登录刷新时报错” | 改 | 行尾追加 ` [已解决] `。 |
| `CORE.html` | §4.16 `src/main/api/login.ts`（`#c4-16`） | 改 | 记录 QQ 续期所需 OAuth 参数、`comm` 字段、Cookie 回退与 `req1` 响应兼容。 |
| `PROVIDER.html` | §4.1 上游方法（`#p4-1`） | 改 | 补充 QQLogin 续期的 OAuth 参数与 10006 触发原因。 |
| `PROVIDER.html` | §4.5 请求画像（`#p4-5`） | 改 | 同步 QQ 续期请求画像与公共参数。 |

### 3.20 评论附图与表情缺少加载失败占位和大图查看

**问题描述**：评论的附图（`Pic`）与内嵌表情（`EmoPic`）直接绑定 `<img>`，源图 404 或网络失败时浏览器显示破图图标，且没有统一的失败态；附图也无法放大查看。ISSUES 要求两者都显示“折角纸张 + 右下角 X”的小占位，并让附图支持全屏查看、适应屏幕 / 原始大小切换与拖动。

**解决方法**：

- `CommentsPanel` 用 `failedMedia` 按 URL 记录加载失败的媒体；`img` 触发 `error` 后改渲染 `file-broken` 占位。表情占位保持 20px 行内尺寸，附图占位固定 56×42px；刷新评论或切歌时清空失败记录重新尝试。
- `AppIcon` 新增 `file-broken` 图标：折角纸张轮廓与右下角 X。
- 新增 `ImageLightbox`：通过 `Teleport` 覆盖全屏，背景变暗、右上角关闭；点击图片在适应屏幕与原始大小之间切换，原始大小超出视口时按指针拖动平移并夹紧边界。Esc、空白点击与返回手势都能关闭，且打开时优先于歌词 / 评论层处理 Esc 与返回。
- 附图加载成功后点击打开查看器；表情保持不可点击。
- 新增样式：评论媒体 `zoom-in` 指针、失败占位虚线框、查看器背景 / 图片 / 关闭按钮与拖动光标。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUES.md` | 第 3 项“评论 pic / emopic 占位与附图查看” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §5.2.5 歌词与评论（`#u5-2-5`） | 改 | 补充加载失败占位、附图全屏查看、尺寸切换与拖动。 |
| `CORE.html` | §1 文件树 · `components/ImageLightbox.vue` | 增 | 登记评论图片查看器。 |
| `CORE.html` | §4.42 `CommentsPanel.vue`（`#c4-42`） | 改 | 记录 `failedMedia`、占位尺寸与附图查看入口。 |
| `CORE.html` | §4.93 `ImageLightbox.vue`（`#c4-93`） | 增 | 记录全屏层、尺寸切换、拖动平移与关闭方式。 |
| `README.md` | §2 用户交互 · 歌词 / 评论行 | 改 | 补充附图可点击查看大图。 |
| `ABOUT.html` | 用户交互 · 歌词 / 评论行 | 改 | 与 README 同步。 |

### 3.21 评论占位符语义、缺图占位与 Yi 文种缺字

**问题描述**：上一轮只处理了 `<img>` 加载失败，`好听哈￼`（Im Doing Fine，2026-10-24 10:22）这类 `Content` 带 `U+FFFC`、`Pic` / `EmoPic` 都为空的评论被主进程提前删除占位符，界面不会出现占位图标。另一个歧义是 `Pic` 是否使用 `U+FFFC`；抽样上游评论后确认：Ladyfingers 的 `我的故事总是发生在夏天￼`（2026-10-11 21:27，CmId `1!hAwDtmYh-7PDqHWNGYz5WwGArLvZcxQNY05CpPH8snrdd3vHJnsoIIQY9h5-YbOO`）**只有 `Pic`，没有 `EmoPic`**：`Pic` 为 `https://music-file.y.qq.com/comment/u/oK6kowEAoK4z7K-kow6qoeSsNv/23ab0/0d56550082963481998aac593c23eea5cddc2b9d_20242f.jpg`，`EmoPic` 为空字符串。继续翻取该歌曲 758 条评论后统计：`Pic` 非空 88 条，其中仅 1 条同时带 `U+FFFC`；`EmoPic` 非空 6 条，全部不带 `U+FFFC`；无任何媒体的 `U+FFFC` 4 条。另一首 Im Doing Fine 的 200 条样本同样未出现 `EmoPic + U+FFFC` 的稳定组合。因此附图没有可靠的占位映射，`U+FFFC` 只能按内嵌表情位置或残留占位处理。另有 Ladyfingers 2026-11-13 20:04 的评论包含 `ꈍ◡ꈍ`，其中 `U+A20D` 在缺少 Yi 字体的 Linux 上显示为缺字方框。

**解决方法**：

- `normalizeCommentContent` 明确区分三种情况：有 `EmoPic` 时保留 `U+FFFC` 供表情定位；只有 `Pic` 时移除残留占位；两者都没有时保留占位，交给渲染层显示失败图标。
- 评论过滤改为先移除 `U+FFFC` 再判断正文是否为空，避免只剩占位符且没有媒体的记录进入列表。
- `CommentsPanel` 的 `contentParts` 把第一个占位替换为 `EmoPic`，其余占位生成 `missing` 部分并显示 `file-broken` 占位；`Pic` 始终单独渲染在正文下方，不消费占位符。
- 新增 `@fontsource/noto-sans-yi` 的 Yi 子集并在正文 `font-family` 末尾加入 `Noto Sans Yi`，缺失字形时回退到内置字体；OFL 许可证随打包资源分发。
- 更新 `test/api/comment.test.ts`：无媒体占位符保留，带 `Pic` 的占位符仍移除。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.5 歌词与评论（`#u5-2-5`） | 改 | 明确 `U+FFFC` 只对应表情，无媒体占位显示失败图标，`Pic` 单独展示。 |
| `CORE.html` | §4.15 `comment.ts`（`#c4-15`） | 改 | 记录 `EmoPic` / `Pic` / 无媒体三种占位处理与过滤规则。 |
| `CORE.html` | §4.42 `CommentsPanel.vue`（`#c4-42`） | 改 | 记录首个占位换表情、其余占位显示失败图标、附图不消费占位。 |
| `CORE.html` | §3 SBOM / §4.22 `main.ts` | 改 | 登记 `@fontsource/noto-sans-yi` 与 `Noto Sans Yi` 字体回退。 |
| `PROVIDER.html` | §2 CONVENTIONS / §4.3 数据模型与转换 | 改 | 说明 `Pic` 不参与 `U+FFFC` 映射及无媒体占位的处理。 |
| `README.md` / `ABOUT.html` | 用户交互 · 歌词 / 评论行 | 改 | 补充加载失败占位。 |

### 3.22 xlogin / 微信扫码视图位置漂移并覆盖播放条

**问题描述**：登录组件的 `WebContentsView` 用渲染层上报的占位矩形定位。宽屏登录卡达到 `max-width: 800px` 后，窗口继续变宽只会改变卡片的水平中心，`ResizeObserver` 观察尺寸但不观察位置，因此上报的 `x` 不再更新，视图像被固定在旧坐标；微信扫码同样复用这条链路。窗口变矮时占位矩形可以伸到 `.main` 之外，而原生视图不参与 CSS 裁剪，会直接覆盖底部播放条。

**解决方法**：

- `LoginView` 同时监听窗口 `resize`、滚动与占位元素尺寸变化；窗口宽度超过卡片最大宽度时也能重新上报中心位置。
- 新增纯函数 `clampEmbedRect(rect, area)`，把占位矩形与 `.main` 的可见矩形求交集；短窗口下裁剪高度，完全滚出内容区时得到零尺寸。
- `web-login.applyBounds` 对零宽 / 零高调用 `setVisible(false)`，恢复可见时再 `setVisible(true)` + `setBounds`；零尺寸只隐藏视图，不取消登录，保留 `null` 原有的取消语义。
- 新增 `test/embed-bounds.test.ts` 覆盖完整可见、底部裁剪与完全移出三种情况。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUES.md` | 第 4 项“xlogin 扫码登录嵌入位置” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §5.2.6 登录页（`#u5-2-6`） | 改 | 说明组件随窗口 / 滚动更新、裁剪到内容区且不覆盖播放条。 |
| `CORE.html` | §1 文件树 / §4.17 `web-login.ts` / §4.47 `LoginView.vue` | 改 | 记录零尺寸隐藏语义、位置同步与内容区裁剪。 |
| `CORE.html` | §4.94 `embed-bounds.ts`（`#c4-94`） | 增 | 记录占位矩形交集计算与测试。 |

### 3.23 设置页账号区缺少 VIP 标记

**问题描述**：设置页账号区已按 ISSUES 去掉“已登录”徽标，但右侧没有 VIP 标记。主进程已有 `isVipUser()`（`VipLogin.VipLoginInter/vip_login_base`，按账号缓存 5 分钟），但没有跨 IPC 暴露；渲染层无法在不重复请求上游的情况下显示 VIP 状态。

**解决方法**：

- `LycheeApi.user` 增加 `isVip()`，preload 调用 `user.isVip`，主进程直接复用 `isVipUser()`，不新增上游请求路径。
- 设置页在登录态或 `musicid` 变化时查询 VIP；结果只在为真时渲染 `.pay-badge` 的“VIP”徽标，未登录、接口失败或无法检测时隐藏。请求带自增序号，避免切换账号时旧响应覆盖新状态。
- VIP 查询沿用主进程缓存，不会在每次进入设置页时轰炸上游。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUES.md` | 第 5 项“设置页账号信息” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §5.2.7 设置页（`#u5-2-7`） | 改 | 账号区补充 VIP 标记与检测失败隐藏规则，原型同步。 |
| `CORE.html` | §4.2 `src/shared/ipc.ts`（`#c4-2`） | 改 | 增加 `user.isVip` 签名。 |
| `CORE.html` | §4.13 `src/main/api/user.ts`（`#c4-13`） | 改 | 记录设置页消费 VIP 状态与失败隐藏。 |
| `CORE.html` | §4.48 `SettingsView.vue`（`#c4-48`） | 改 | 记录登录态 / 账号变化时查询 VIP 与徽标渲染规则。 |

### 3.24 长页面快速跳转按钮未覆盖全部动态页面

**问题描述**：ISSUES 要求所有动态高度页面都要有快速跳到顶部 / 底部的按钮。最初只补了下载中心，漏掉播放历史；继续盘点后确认需要接入的路由页还有我的歌单、歌手、专辑。歌单详情与评论已有各自的实现，但两处滚动监听、阈值与按钮模板重复，新页面继续复制会再次漏项。

**全量盘点**：

| 页面 / 区域 | 结论 | 说明 |
|---|---|---|
| 发现 | 不接入 | 分区与雷达数量有限，不按长页面处理。 |
| 搜索 | 不接入 | 结果按分页浏览，不按长页面处理。 |
| 我的歌单 | 接入 | 歌单卡片数量随账号变化。 |
| 歌单详情 | 接入 | 已有实现，改为共用；含“我喜欢”。 |
| 歌手 | 接入 | 歌曲分页、专辑全量。 |
| 专辑 | 接入 | 歌曲表与加载更多。 |
| 播放历史 | 接入 | 本地记录可持续累积。 |
| 下载中心 | 接入 | 任务列表随任务数增长。 |
| 评论 | 保留现有 | 按钮在评论面板内，跳到底部需先补拉剩余页。 |
| 播放队列面板 | 不接入 | 固定高度面板内的独立列表，不属于路由页面；如需要应单独设计按钮位置。 |
| 设置 / 登录 / MV | 不接入 | 内容高度稳定或为单视频页，不随数据形成长列表。 |

**解决方法**：

- 新增纯函数 `utils/page-jump::jumpVisibility`：距顶 / 距底超过 `120px` 才显示对应按钮，内容不足一屏时都不显示。
- 新增 `composables/page-jump::usePageJump(rootRef)`：从页面根节点取得 `.main` 滚动容器，注册 passive 滚动与 `ResizeObserver`，返回两个显隐状态和平滑滚动函数；卸载时自动清理。
- 新增 `components/PageJump.vue`：统一右下角两个圆形按钮的模板，页面只传显隐状态并接滚动函数，不再复制按钮结构。
- `LibraryView` / `ArtistView` / `AlbumView` / `HistoryView` / `DownloadsView` 全部接入；`PlaylistView` 与 `DownloadsView` 的旧重复实现改为共用。发现与搜索经确认不接入。
- 新增 `test/page-jump.test.ts` 覆盖不足一屏、顶部、底部与阈值边界。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUES.md` | 第 6 项“所有动态高度的页面” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §2 CONVENTIONS · 长页面跳转 / §5.2.8 下载中心 | 改 | 列出全部接入页面与排除页面，下载中心补充按钮说明。 |
| `CORE.html` | §1 文件树 / §4.46 `PlaylistView` / §4.67 `DownloadsView` | 改 | 改为共用 `usePageJump`，下载中心补充跳转按钮。 |
| `CORE.html` | §4.95 `page-jump.ts`（composable）/ §4.96 `utils/page-jump.ts` / §4.97 `PageJump.vue` | 增 | 记录滚动监听、显隐判定、接入页面与统一按钮模板。 |

### 3.25 未开始下载任务的标题显示歌曲 ID

**问题描述**：下载任务入队时只保存 `songMid`，`name` 直接写成 mid，歌手与专辑留空；歌曲信息要等 pump 出队解析时才回填。因此在任务真正开始前，下载中心列表标题是一串看不出规律的 ID。若为了补标题在入队阶段调用歌曲详情接口，又会在批量下载时额外轰炸上游。

**解决方法**：

- 新增跨 IPC 的 `DownloadRequest`：`songMid` / `name` / `singers` / `albumName`，由渲染层从当前歌曲对象直接取值，不新增上游请求。
- `download.start` / `download.startMany` 改为接收 `DownloadRequest`；主进程逐项校验 mid、截断歌手数量，单曲与整单入口共用。
- `enqueueTask` 直接使用请求中的已知元数据生成任务标题、歌手、专辑与占位文件名；pump 出队后仍用上游解析结果覆盖，并重算最终路径。
- `useDownloadAction` 从 `Song` 取歌名 / 歌手 / 专辑；歌单“下载全部”为每首歌构造同样的请求。
- 更新 `test/download-manager.test.ts` 与 `test/download-action.test.ts`，断言入队阶段不请求详情且标题立即正确。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUES.md` | 第 7 项“未开始的下载任务标题” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §5.2.8 下载中心 | 改 | 说明任务加入后立即显示已知歌名 / 歌手 / 专辑。 |
| `CORE.html` | §4.1 内部类型 / §4.2 IPC / §4.60 `download/manager.ts` / §4.71 `stores/download.ts` | 改 | 增加 `DownloadRequest`，更新入队与出队解析说明。 |
| `CORE.html` | §5.16 下载调用树 | 改 | 入队调用改为携带 `DownloadRequest`。 |
| `README.md` / `ABOUT.html` | 用户交互 · 下载行 | 改 | 补充未开始任务立即显示已知歌曲信息。 |

### 3.26 下载页缺少按当前视图清空任务的入口

**问题描述**：下载中心只有“清除已完成”和“清空目录”。前者不能处理进行中 / 失败 / 暂停任务，后者会连同磁盘文件一起删除；用户想要整理任务列表、保留已下载文件时没有入口。固定语义的“清空全部任务”也不够灵活，无法只清空“进行中”“已完成”或搜索结果。

**解决方法**：

- 主进程新增 `clearDownloadTasks(ids)`：只停止并移除给定 ID 的任务记录，写回索引，不删除磁盘文件、分片或封面。
- `download.clearTasks` IPC / preload / store 同步新增；store 移除对应任务、刷新相关歌曲资产与目录用量，并在没有活动任务时停止轮询。
- 下载中心工具栏在“全部开始”旁增加“清空”，取当前 `filteredTasks`（状态筛选叠加搜索）的 ID 作为清空范围，没有可见任务时禁用；确认文案显示当前任务数量，并说明文件保留在本机。
- 这样同一个按钮即可清空全部、进行中、已完成、未成功或某个搜索关键词下的任务。
- 新增下载管理器测试：清空指定记录后列表为空，但原文件仍存在；下载中心 SSR 测试断言“清空”按钮。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUES.md` | 第 9 项“下载页需要清空任务按钮” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §5.2.8 下载中心 | 改 | 工具栏补充按当前筛选 / 搜索范围清空的“清空”按钮，区分保留文件与“清空目录”。 |
| `CORE.html` | §4.2 IPC / §4.60 `download/manager.ts` / §4.67 `DownloadsView` / §4.71 `stores/download.ts` | 改 | 增加 `clearDownloadTasks` / `download.clearTasks` / `clearTasks(ids)` 与按钮说明。 |
| `README.md` / `ABOUT.html` | 用户交互 · 下载行 | 改 | 补充“清空”按当前显示范围移除记录。 |

### 3.27 搜索页 MV、歌手头像与分页缺失

**问题描述**：搜索页存在三个独立缺口。MV 搜索被附加在单曲结果底部，不是真正的分类；歌手结果只渲染姓名首字，完全没有使用上游 `singerPic`；真实搜索响应的总数在 `data.meta.sum`，原解析只读 `body.meta.sum`，导致 `total` 恒为 0、分页器永远不显示，也没有滚动加载。

**解决方法**：

- `SearchRequest.type` 增加 `mv`；`searchByType` 对 `mv` 转交 `searchMv`，并让 `searchMv` 接受每页条数、读取 `data.meta` 总数。搜索页新增独立 MV 标签，删除单曲结果底部的 MV 追加逻辑。
- `Singer` 增加可选 `avatarUrl`，搜索映射读取 `singerPic ?? pic ?? avatar` 并转 https；歌手卡片显示头像，加载失败时清空该字段回退姓名首字。
- 搜索结果总数兼容 `data.meta` / `body.meta`。页面改为累计分页：第一页替换，后续页按类型主键去重后追加；`.main` 滚动到底自动加载，同时保留“加载更多”按钮。新关键词 / 切换标签重置到第一页并回顶，追加失败只 Toast、保留已有结果。
- 扩展 `test/api/search.test.ts`：覆盖顶层 `meta`、歌手头像映射与 `mv` 类型路由。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUES.md` | 第 10 项“搜索页优化” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §5.2.8 搜索页 | 改 | 五类标签、独立 MV、歌手头像、滚动 / 加载更多。 |
| `CORE.html` | §4.1 类型 / §4.10 `search.ts` / §4.44 `SearchView` / §4.56 `mv.ts` | 改 | 记录 `mv` 类型、头像字段、顶层 meta 与累计分页。 |
| `README.md` / `ABOUT.html` | 用户交互 · 搜索行 | 改 | 同步五类搜索与滚动加载。 |

### 3.28 搜索页分页数量与卡片网格按屏幕自适应

**问题描述**：搜索页虽然改成累计分页，但仍沿用每页 20 条；宽屏卡片使用 `auto-fill`，歌手 / 专辑结果在页尾留下大片空白，窄屏列数也随宽度漂移。MV 仍使用方形封面，无法体现上游 640×360 的缩略图比例，也没有明确保证动图正常播放。

**解决方法**：

- `SEARCH_PAGE_SIZE_DEFAULT` 改为 48；歌手固定 `SEARCH_SINGER_PAGE_SIZE = 24`（上游单页超过 40 会返回空结果），`searchByType` 按类型夹紧，页面用同一有效页大小计算总页数。这样分页数量不再依赖屏幕宽度。
- 搜索结果的歌手 / 专辑 / 歌单网格固定列数：宽屏 8 列、窄屏（≤900px）3 列；MV 宽屏 6 列、窄屏 2 列。卡片宽度由 `minmax(0, 1fr)` 随内容区缩放，不再用 `auto-fill` 由卡片最小宽度决定列数。
- MV 封面增加 `mv-cover`，使用上游缩略图的 16:9 比例；封面继续使用原生 `<img>`，GIF / WebP 动图由浏览器原生播放，不做首帧冻结。
- 扩展 `test/api/search.test.ts`：验证歌手页大小固定为 24。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.8 搜索页 | 改 | 补充固定列数、48 / 24 条分页、MV 16:9 与动图。 |
| `CORE.html` | §4.44 `SearchView` / §4.50 常量 | 改 | 记录固定网格、有效页大小与 MV 封面比例。 |
| `README.md` / `ABOUT.html` | 用户交互 · 搜索行 | 改 | 同步列数与 MV 封面说明。 |

### 3.29 搜索少返回行为核实与 MV 动图核实

**问题描述**：歌单搜索结果每页实际常返回 48/46/45 条，歌手结果也可能因过滤少于 24 条；需要确认这是否由请求参数控制。MV 的 `mv_pic_url` 示例 Bound 2 (Network Edit) 实际是 640×360 的静态 JPEG，不是 GIF / WebP。

**核实结果**：

- 上游会读取并回显 `num_per_page`，把它作为每页上限；同一页连续请求三次，返回条数与 ID 顺序完全一致，说明不是随机“凭喜好”返回。
- 返回条数可能少于请求值，例如 `perpage=48` 的连续页返回 46 / 45 / 46；`meta.ein` 也小于 `perpage`，属于服务端内部过滤，页面无法通过参数补齐。
- 歌手 `perpage=48/50` 会直接返回空列表与 `is_filter=-2`，因此歌手固定请求 24 条。
- Bound 2 (Network Edit) 的封面 URL 为 `.jpg`，下载后确认是单帧 640×360 JPEG；同 URL 的 `.webp` 也是单帧。搜索响应只有 `mv_pic_url`，没有动图字段，客户端看到的动态效果来自视频预览。

**解决方法**：

- 不做缓冲补页：页面按上游实际返回条数累加并去重，接受末行可能不满；这是上游不可控行为，额外补页只会增加请求而不改变数据。
- 保留歌手 24 / 其余 48 的每页请求大小，保留固定网格列数（宽 8 / 窄 3，MV 宽 6 / 窄 2）。
- `SearchResult` 增加可选 `hasMore`，来自上游 `meta.nextpage`；页面不再依赖可能波动的 `total` 判断是否继续加载。
- MV 封面继续使用原生 `<img>`，GIF / WebP 会自然播放；当前搜索接口示例封面为静态 JPEG，不能从该字段获得动图。
- 新增/更新搜索 API 测试，验证 `nextpage` 映射、歌手 24 条页大小与 MV 总数。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.8 搜索页 | 改 | 补充歌手 24 条、上游可能少返回与 MV 静态封面现状。 |
| `CORE.html` | §4.44 `SearchView` / §4.56 `mv.ts` | 改 | 记录上游过滤行为、`hasMore` 与静态封面事实。 |
| `README.md` / `ABOUT.html` | 用户交互 · 搜索行 | 改 | 同步末行可能不满与动态封面说明。 |
