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
- 译文和原文都作为独立 `LyricLine`，用 `translation: boolean` 区分，按 `timeMs` 排序；同一时间戳原文在前。
- 译文没有时间戳时按行序跟随对应原文；原文也没有时间戳时按行序生成稳定序号，至少保证两者都能展示。
- `activeLyricIndex` 在合并后的行里取离播放位置最近的一行，最多提前 `80ms`；原文与译文不再共享活动状态。
- `useLyrics` 增加 `visibleLines`，译文关闭时过滤翻译行；`activeIndex` 基于可见行计算，避免高亮到被隐藏的译文。
- 新增 `test/lyric.test.ts` 与 `test/api/lyric.test.ts`，覆盖新版接口取译文、空译文、非数字 ID、独立行排序、无时间戳译文与 QRC 就近高亮。

**修订建议**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.2 `src/shared/ipc.ts`（`#c4-2`） | 改 | `lyric.get` 改为只接收 `songId`。 |
| `CORE.html` | §4.14 `src/main/api/lyric.ts`（`#c4-14`） | 改 | 只使用 `PlayLyricInfo / GetPlayLyricInfo`，说明 Base64 解码、`songID` 参数与非数字 ID 处理。 |
| `CORE.html` | §5.9 歌词与评论（`#c5-9`） | 改 | 调用链改为 `get(songId)` → `GetPlayLyricInfo`，删除旧接口回退分支。 |
| `PROVIDER.html` | §4.1 消费的 HTTP 接口（`#p4-1`） | 改 | 只保留 `GetPlayLyricInfo` 与参数，删除旧歌词接口。 |
| `PROVIDER.html` | §4.3 数据模型与转换（`#p4-3`） | 改 | 只保留 `QqPlayLyricInfoData` 与 `Lyric` 转换，删除 `QqLyricResponse` / QRC 消费说明。 |
| `CORE.html` | §4.33 `utils/lrc.ts`（`#c4-33`） | 改 | 将 `LyricLine.trans` 改为 `translation: boolean`；增加 `withTranslations`，写明独立行排序、无时间戳回退与就近高亮。 |
| `CORE.html` | §4.34 `composables/lyrics.ts`（`#c4-34`） | 改 | 增加 `visibleLines`，说明 `hasTranslation` 由翻译行派生、`activeIndex` 基于可见行。 |
| `CORE.html` | §4.41 `LyricsPanel.vue`（`#c4-41`） | 改 | 渲染 `visibleLines`；译文作为独立 `.lyric-line.translation` 展示，不再嵌套 `.lyric-trans`。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 删除 `.lyric-trans` 样式，改为 `.lyric-line.translation` 的字号、颜色与活动态。 |
| `CORE.html` | §4.64 `utils/qrc.ts`（`#c4-64`） | 不动 | 已改为复用 §4.33 的 `withTranslations`，不再维护独立的翻译合并规则。 |
| `USER.html` | §5.2.5 歌词与评论（`#u5-2-5`） | 改 | 改为“原文与译文按时间顺序作为独立行排列并就近高亮；无译文文本时不显示开关”。 |
| `README.md` | §2 用户交互 · 歌词 / 评论行 | 改 | 与 USER 同步，替换“上下两行共享高亮”。 |
| `ABOUT.html` | 用户交互 · 歌词 / 评论行 | 改 | 与 README 同步。 |
