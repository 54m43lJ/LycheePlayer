# IMPL

开发过程心得，按“文档错误 / 文档缺漏 / 技术坑 / 需求演进”分组。前三组每条只记录一个独立问题，跨组不重复同一结论；第 4 组按功能条目记录描述、解决方案与文档操作。表中的动作表示建议落点；`不动` 表示该处已有内容、本轮不再重复编辑，或以其它条目为准。

## 1. 开发中发现文档的错误

### 1.1 README 仍把歌词 / 评论描述为 `/lyrics` 页面 [已解决] 

**描述**：README 的用户交互表写着“点击播放条封面进入 `/lyrics` 页面”，但 USER / CORE 已明确歌词与评论是覆盖内容区的弹出层，CORE 更直接写明 `/lyrics` 不再存在。开发译文开关与评论输入框时，如果按 README 实现就会多出无意义的路由分支。

**解决方案**：

- 以 USER §5.2.5 与 CORE §4.72 的弹出层契约为唯一实现依据，不新增 `/lyrics` 路由。
- 译文开关、评论输入框都挂在 `LyricsOverlay` 内，关闭入口只改 `ui.lyricsOpen`。
- 把 README 的旧表述留作本次修订项，避免后续开发者按旧文案重新引入页面。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `README.md` | §2 用户交互 · 歌词 / 评论行 | 改 | 将“进入 `/lyrics` 页面”改为“点击封面开合歌词 / 评论弹出层”，与 ABOUT 的表述对齐。 |
| `USER.html` | §5.2.5 歌词与评论（`#u5-2-5`） | 不动 | 已定义弹出层、译文开关与评论输入框，作为用户侧权威来源，不再重复修改。 |
| `CORE.html` | §4.72 `LyricsOverlay.vue`（`#c4-72`） | 不动 | 已写明 `/lyrics` 不再存在，作为实现约束引用即可。 |

**工作记录**：

- README 已是目标表述（既有提交 `f864799`），无需改动；USER / CORE 维持原文。

### 1.2 下载相关文案仍停留在批次模型 [已解决] 

**描述**：README / ABOUT 原先写“下载中心支持批次级暂停 / 继续 / 删除 / 重试”“整单下载创建一个批次”，但 CORE 与下载实现已经统一为单队列，没有批次字段或批次级操作。USER §5.2.8 歌单详情也仍写“下载全部按钮显示完成 / 总数 / 失败，全部完成显示已全部下载”，而实际只提示“已加入下载队列”。这些残留会让实现者误以为需要维护批次状态。

**解决方案**：

- 以 CORE §4.60 / §5.16 的统一队列为唯一模型，不引入批次 ID、批次汇总或批次级操作。
- “下载全部”只按歌单顺序去重入队并 Toast 提示，按钮不显示任务完成进度。
- 本轮已把 README / ABOUT 的下载行改为统一队列语义；USER 歌单详情中的批次进度句仍需修正。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `README.md` | §2 用户交互 · 下载 / 整单下载行 | 不动 | 本轮已改为统一队列，不再提批次；后续保持该表述，不重新引入批次概念。 |
| `ABOUT.html` | 用户交互 · 下载 / 整单下载行 | 不动 | 已与 README 同步，避免重复改同一段用户文案。 |
| `USER.html` | §5.2.8 页面结构 · 歌单详情（`#u5-2-8`） | 改 | 删除“按钮显示完成 / 总数 / 失败，全部完成显示已全部下载”，改为“加入统一队列后 Toast 提示”。 |
| `CORE.html` | §4.60 `download/manager.ts` / §5.16 下载（`#c4-60` / `#c5-16`） | 不动 | 已完整描述单队列、串行下载与无批次语义，作为模型来源。 |

**工作记录**：

- README / ABOUT 实际仍保留“按钮显示完成 / 总数 / 失败”的旧表述，已同步改为“不显示完成 / 总数 / 失败，入队后 Toast 提示”；USER 按计划修改。

### 1.3 下载调用树只记录歌曲表一个入口 [已解决] 

**描述**：CORE §5.16 原先只画了 `SongTable::emit('download') → download.start`，播放条的实际下载入口没有出现在调用树里。结果是“已下载时确认删除”先只加到了歌单页，播放条继续走旧入队逻辑，文档也没有暴露这个缺口。

**解决方案**：

- 把下载按钮的判定、入队、删除确认与提示收敛到 `useDownloadAction().requestDownload()`。
- `PlayerBar` 与所有歌曲表页面只负责把歌曲对象和音质传给该入口，不再各自判断资产状态。
- 调用树改为 `SongTable / PlayerBar → requestDownload → 入队或删除分支`，并新增全局 `DownloadDeleteDialog`。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §5.16 下载（`#c5-16`） | 改 | 把单入口调用树改为 `SongTable` / `PlayerBar → requestDownload`，并补已下载时的删除分支。 |
| `CORE.html` | §4.84 `composables/download-action.ts`（`#c4-84`） | 增 | 记录共用下载入口、`pendingDelete`、确认 / 取消函数，以及返回的 ref 需在调用方顶层解构。 |
| `CORE.html` | §4.85 `components/DownloadDeleteDialog.vue`（`#c4-85`） | 增 | 记录全局唯一删除下载确认框及挂载位置。 |
| `CORE.html` | §2 CONVENTIONS（`#c2`） | 增 | 增加“下载按钮行为”约定：所有入口共用 `requestDownload`，不各自判断已下载状态；磁盘删除由主进程执行。 |
| `USER.html` | §5.2.3 播放条 / §5.2.4 歌曲列表 | 不动 | 已声明所有歌曲表与播放条共用同一行为，避免与本节重复。 |

**工作记录**：

- §5.16 调用树与 §4.85 确认框已在文档中存在；§4.84 只补顶层 `Ref` 解构说明；§2 按计划新增“下载按钮行为”约定。

## 2. 开发中发现文档没写明的细节

### 2.1 “纯本地搜索”的匹配范围与空状态未定义 [已解决] 

**描述**：TODO 只写了“支持纯本地搜索功能”，没有说明搜索哪些字段、是否扫描下载目录、是否允许触发上游请求，也没有区分“没有任务”和“搜索无匹配”。实现时必须自行决定契约，否则不同页面容易做出不同的搜索语义。

**解决方案**：

- 只匹配已加载的任务快照，不请求上游、不重新扫描目录。
- 匹配歌名、`songMid`、歌手、专辑与文件路径，统一做小写包含匹配。
- 与状态筛选叠加；搜索无结果时显示“没有匹配的下载任务”，未搜索时保留“没有符合条件的任务”。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.8 页面结构 · 下载中心（`#u5-2-8`） | 改 | 补充搜索字段、只过滤已加载任务、与状态筛选叠加及两类空状态。 |
| `CORE.html` | §4.67 `DownloadsView.vue`（`#c4-67`） | 改 | 记录搜索框位置、匹配范围、空状态与不触发上游 / 目录扫描。 |
| `CORE.html` | §4.83 `utils/download-filter.ts`（`#c4-83`） | 增 | 记录 `matchesDownloadKeyword()` 的字段集合与大小写规则。 |
| `CORE.html` | §4.1 `DownloadTask`（`#c4-1`） | 不动 | 已声明 `singers` / `albumName` 的用途，搜索规则只放在 §4.83，避免重复。 |

**工作记录**：

- CORE §4.67 / §4.83 已在文档中存在；本轮只修改 USER §5.2.8，补齐搜索字段、清除按钮与两类空状态。

### 2.2 删除下载的 IPC 粒度与清理范围未写明 [已解决] 

**描述**：文档只有按任务 ID 的 `download.remove(id)`，没有回答“歌曲已经下载，但当前页面只有 `songMid`、没有任务 ID”时如何删除。也没有说明同一歌曲存在多条 `done` 任务时删哪条，以及是否清理 `.part` 和下载封面。

**解决方案**：

- 增加按歌曲删除的 `download.removeSong(songMid)` 与主进程 `removeDownloadedSong()`。
- 删除该歌曲全部 `done` 任务，同时移除音频、残留 `.part` 与下载封面，并保存索引。
- 保留 `download.remove(id)` 供下载中心按行删除单任务；渲染层使用按歌曲接口，避免依赖任务列表是否加载。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.2 `src/shared/ipc.ts`（`#c4-2`） | 改 | 增加 `download.removeSong(songMid)`，并说明与 `remove(id)` 的分工。 |
| `CORE.html` | §4.60 `download/manager.ts`（`#c4-60`） | 改 | 增加 `removeDownloadedSong` 签名，写明删除全部 `done` 任务、音频、`.part` 与封面；同一小节并入旧索引字段归一化，见 §3.1。 |
| `CORE.html` | §4.71 `stores/download.ts`（`#c4-71`） | 改 | 增加 `removeSong` 签名，说明本地快照更新、资产刷新，以及不依赖 `tasks` 是否已加载。 |
| `USER.html` | §5.2.4 歌曲列表 / §5.2.8 歌单详情 | 不动 | 已描述用户可见的删除确认流程，API 粒度与文件清理只留在 CORE。 |

**工作记录**：

- §4.60 的 `removeDownloadedSong` 与清理范围已在文档中存在；§4.2 补 `remove(id)` / `removeSong(songMid)` 分工，§4.71 补“不依赖 `tasks` 已加载”。

### 2.3 窗口标题的格式、回退与维护位置未定义 [已解决] 

**描述**：TODO 只要求“应用标题显示当前在播放的歌曲”，没有规定是否带歌手、无歌曲时显示什么、由主进程还是渲染进程设置，也没有说明页面导航时是否重置。不同实现方式会影响测试与窗口管理器行为。

**解决方案**：

- 在 `utils/format.ts` 定义唯一标题格式：`歌名 - 歌手 · Lychee Player`，歌手为空时省略歌手段。
- 无当前歌曲时回退 `Lychee Player`。
- `App.vue` 监听 `player.current` 并立即写入 `document.title`，不新增 IPC；Electron 默认把页面标题同步到窗口 / 任务栏。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.1 窗口与布局（`#u5-2-1`） | 改 | 增加窗口标题契约：歌曲 / 歌手格式、歌手为空、无歌曲回退与切歌即时更新。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） | 改 | 记录 `player.current` → `document.title` 的监听与立即执行。 |
| `CORE.html` | §4.32 `utils/format.ts`（`#c4-32`） | 改 | 增加 `appTitle(song)` 签名与格式、回退规则。 |
| `README.md` | §2 用户交互 · 窗口标题行 | 增 | 增加窗口 / 任务栏标题跟随当前歌曲的用户可见能力。 |
| `ABOUT.html` | 用户交互 · 窗口标题行 | 增 | 与 README 同步，避免两份用户说明不一致。 |

**工作记录**：

- 逐项核对 `USER §5.2.1`、`CORE §4.23` / `§4.32`、`README` 与 `ABOUT`：五处窗口标题契约均已存在，无需改动。

## 3. 其它技术上踩的坑

### 3.1 旧下载索引缺少新增的必填字段 [已解决] 

**描述**：`DownloadTask` 为本地搜索新增了必填的 `singers` / `albumName`，但磁盘上的 `.lychee-downloads-*.json` 是旧版本写入的，运行时反序列化后这两个字段是 `undefined`。TypeScript 只检查代码里的对象，不会检查磁盘 JSON，直接调用 `singers.join()` 会崩溃。

**解决方案**：

- `loadIndex()` 对所有旧任务做归一化：`singers` 不是数组时回退空数组并过滤非字符串项，`albumName` 不是字符串时回退空字符串。
- 新任务入队时初始化空字段，出队解析歌曲信息后再回填。
- 归一化后的任务继续按原索引结构持久化，不升级索引版本号。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.60 `download/manager.ts`（`#c4-60`） | 不动 | `loadIndex()` 的旧索引归一化并入 §2.2 对同一小节的修改，不再单独改；实现时保留出队回填时机。 |
| `CORE.html` | §4.1 `DownloadTask`（`#c4-1`） | 不动 | 字段注释已说明“入队阶段为空”，迁移细节只放 manager，避免与本节重复。 |

**工作记录**：

- 核对 `CORE §4.60` 的 `loadIndex()` 旧索引归一化与出队回填、`CORE §4.1` 的 `singers` / `albumName` 字段注释：均已存在，无需改动。

### 3.2 渲染层的任务快照不能作为删除下载的依据 [已解决] 

**描述**：下载 store 的 `tasks` 只在下载中心可见时才加载；播放条和歌单页只刷新资产状态。此时页面可能已经知道歌曲“已下载”，但 `tasks` 数组里没有对应任务，靠任务 ID 删除会失败或静默不删文件。

**解决方案**：

- 删除动作以 `songMid` 为主键交给主进程执行，主进程直接查自己的任务表，不依赖渲染层缓存。
- store 的 `removeSong()` 调用 IPC 后只更新本地 `done` 任务并刷新该曲资产状态，即使 `tasks` 为空也能正确工作。
- 下载中心仍可按任务 ID 删除，但那是任务行自己的入口，不用于“已下载歌曲”的统一删除。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.71 `stores/download.ts`（`#c4-71`） | 不动 | “`removeSong` 不依赖 `tasks` 已加载、调用后刷新资产”并入 §2.2 对同一小节的修改，不再重复改。 |
| `CORE.html` | §2 CONVENTIONS（`#c2`） | 不动 | 已由 §1.3 增加“磁盘删除由主进程执行”的下载按钮约定；本条只引用，不重复修改同一张表。 |
| `CORE.html` | §4.60 `download/manager.ts`（`#c4-60`） | 不动 | 已在上一条说明删除范围；这里只强调主进程是唯一执行者，不再重复清理规则。 |

**工作记录**：

- 核对 `CORE §4.71` 的 `removeSong`、`§2` 的下载按钮约定、`§4.60` 的主进程删除范围：均已存在，无需改动。

### 3.3 组合式函数返回对象里的 ref 不会在模板中自动解包 [已解决] 

**描述**：`useDownloadAction()` 返回包含 `pendingDelete` 的对象。若组件把它整体保存为 `const action = useDownloadAction()`，模板里的 `action.pendingDelete` 仍是 Ref 对象，`!== null` 判断会一直成立，确认框可能常驻。Vue 只自动解包顶层 ref，不会递归解包普通对象属性。

**解决方案**：

- 调用方在 `setup` 顶层解构 `pendingDelete`、`confirmDownloadDelete`、`cancelDownloadDelete`。
- `DownloadDeleteDialog` 只读取解构后的顶层 ref，`App.vue` 全局只挂载一次。
- 测试同时从两个调用方读取同一 `pendingDelete`，确认模块级状态确实共享。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.84 `composables/download-action.ts`（`#c4-84`） | 不动 | 模板解包约定已并入 §1.3 新增的同一小节，不再单独改。 |
| `CORE.html` | §4.85 `DownloadDeleteDialog.vue`（`#c4-85`） | 不动 | 已说明组件读取共享状态，模板解包细节只在 §4.84 记录，避免两处重复。 |

**工作记录**：

- 核对 `CORE §4.84` 的顶层 `Ref` 解构说明与 `§4.85` 的共享状态读取：均已存在，无需改动。

### 3.4 歌词接口不返回译文，且译文判断依赖时间戳，译文开关不可见 [已解决] 

**描述**：旧歌词接口 `fcg_query_lyric_new.fcg` 对 `Snap Out Of It - Arctic Monkeys` 只返回原文，`trans` 为空，客户端根本没有译文可展示。同时原实现把翻译按时间戳合并进原文行，再用 `line.trans` 判断是否存在译文，时间戳不一致或译文无时间戳时还会再丢一次。两个问题叠加后，左下角译文开关不渲染，表现为“歌词翻译按钮不可见”。

**解决方案**：

- 歌词只调用 `music.musichallSong.PlayLyricInfo / GetPlayLyricInfo`，按数字 `songID` 请求并解码 Base64 的 `lyric` / `trans`；旧接口因译文缺失已删除，不保留回退。
- `lyric.get` IPC / preload / `useLyrics` 改为传 `songId`，从 `player.current.songId` 传入；`songMid` 只作为渲染层缓存键。
- 判断标准改为译文文本是否存在：只要解析出非空译文行，就认为有译文并显示开关，不再要求与原文时间戳配对。
- 译文按行序附加到对应原文行，写入 `LyricLine.trans`；不按时间戳匹配，时间戳不同也不影响配对，译文行数超出原文时忽略多余项。
- 原文与译文仍在同一个 `.lyric-line` 内显示为上下两行，共享同一个活动行状态；`translationVisible` 只控制行内译文是否渲染。
- 上游用纯斜杠（如 `//`）表示无译文占位时，规范化为 `●●●` 后再附加到原文行。
- 原文与译文都没有时间戳时按行序生成稳定序号，保证仍能展示和配对。
- `activeLyricIndex` 在原文行之间取离播放位置最近的一行，最多提前 `80ms`；活动行内的译文随原文一起高亮。
- 新增 `test/lyric.test.ts` 与 `test/api/lyric.test.ts`，覆盖新版接口取译文、空译文、非数字 ID、按行序配对原文 / 译文与共享活动行。

**文档操作**：

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

**工作记录**：

- 逐项核对上述落点，`CORE §4.2` / `§4.14` / `§5.9` / `§4.33` / `§4.34` / `§4.41` / `§4.49`、`PROVIDER §4.1` / `§4.3`、`USER §5.2.5`、`README` 与 `ABOUT` 均已存在，无需改动。
- 另删除 `USER §1 TERMS` 歌词术语中的实现描述“支持逐字歌词时按逐字时间轴高亮，界面按时间戳合并翻译”，只保留术语定义“LRC 原文与可选的翻译文本”；该处不在本条计划内。

### 3.5 播放模式 revealer 展开后当前模式失去高亮 [已解决] 

**描述**：`.mode-wrap.open` 只把按钮提升到浮层之上，没有改变按钮自身的颜色与背景。默认态是透明背景 + muted 图标，因此 revealer 一展开，当前播放模式虽然仍由按钮图标表示，却不再保持 purple-light 高亮，用户无法在菜单打开时确认当前模式。

**解决方案**：

- 在 `.mode-wrap.open .mode-button` 增加 `color: var(--accent-strong)` 与 `background: var(--accent-soft)`。
- 增加 `.mode-wrap.open .mode-button:hover`，背景复用普通 hover 的 `--accent` 34% 混合，图标继续使用 `--accent-strong`；不另造灰紫混色。
- 保留默认透明背景 + muted 图标，以及普通 hover 的 accent 混合背景；只在 revealer 打开期间持续高亮。
- 不修改菜单项的渲染逻辑与点击循环顺序。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.3 播放条（`#u5-2-3`） | 改 | 补“revealer 弹出期间保持 purple-light 高亮，悬停沿用普通 accent 34% 背景”。 |
| `CORE.html` | §4.40 `PlayerBar.vue`（`#c4-40`） | 改 | 补 `mode-wrap.open` 期间按钮使用 `--accent-strong` / `--accent-soft`，悬停复用普通 hover 背景。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 补 `.mode-wrap.open .mode-button` 与 `:hover` 的颜色、背景契约。 |
| `README.md` | §2 用户交互 · 播放行 | 不动 | 只描述当前项由按钮图标表示，不涉及 revealer 打开态，避免与 USER/CORE 重复。 |
| `ABOUT.html` | 用户交互 · 播放行 | 不动 | 与 README 同步保持现状。 |

**工作记录**：

- 核对 `USER §5.2.3`、`CORE §4.40`、`CORE §4.49`：`mode-wrap.open` 期间的高亮、悬停背景与样式契约均已存在，无需改动。

### 3.6 滚动容器的 overflow 会裁剪向外绘制的键盘焦点环 [已解决] 

**描述**：默认焦点环绘制在元素边框之外。发现页的 `.discover-strip` / `.discover-playlists` 使用 `overflow-x: auto`，侧栏 `.nav` 使用 `overflow-x: hidden` + `overflow-y: auto`；当焦点环超出容器内容区时，超出部分被容器裁掉，表现为 30 首歌曲条目顶部、每日 30 首歌单卡片顶部与导航按钮左侧的描边缺失。焦点环可能出现在任意可聚焦元素上，逐个调整容器 padding 无法覆盖所有滚动场景，且会改变既有间距。

**解决方案**：

- 为 `a`、`button`、`[role="button"]` 与 `[tabindex]` 的 `:focus-visible` 增加统一焦点环：`outline: 2px solid var(--accent-strong)`，并用 `outline-offset: -2px` 向内收 2px。
- 焦点环完全落在元素边框盒内，父级滚动容器的 `overflow` 不再影响描边；元素自身的圆角仍由 `outline` 跟随。
- 输入框、文本域与滑杆继续使用各自已有的聚焦样式，不叠加全局焦点环。
- 不取消滚动容器的 `overflow`，滚动行为保持不变；`overflow` 只影响向外绘制的描边，焦点环内收后不再受其影响。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 补全局 `:focus-visible` 焦点环的选择器、颜色与 `outline-offset: -2px`，说明向内绘制用于避免滚动容器裁剪，输入框沿用自身聚焦样式。 |
| `USER.html` | §2 CONVENTIONS（`#u2`） | 改 | 增加“键盘焦点”约定：Tab 遍历时显示 2px 强调色焦点环，绘制在元素内侧，滚动容器不会裁掉描边。 |

**工作记录**：

- 核对 `CORE §4.49` 与 `USER §2` 的“键盘焦点”：全局 `:focus-visible` 选择器、`outline-offset: -2px` 与滚动容器不裁剪描边的约定均已存在，无需改动。
| `CORE.html` | §4.68 `DiscoverView.vue`（`#c4-68`） | 不动 | 焦点环契约由 §4.49 统一维护；发现页只负责提供滚动容器，不重复记录样式。 |
| `USER.html` | §5.2.8 页面结构 · 发现（`#u5-2-8`） | 不动 | 已由 §2 的共用约定覆盖，不再逐页描述键盘焦点。 |
| `README.md` | §2 用户交互 | 不动 | 键盘焦点是通用交互细节，不作为首页能力条目重复列出。 |
| `ABOUT.html` | 用户交互 | 不动 | 与 README 同步保持现状。 |

### 3.7 发现页歌单卡片 hover 上移后被滚动容器裁掉顶边 [已解决] 

**描述**：`.card:hover` 使用 `transform: translateY(-2px)` 制造上浮反馈，卡片本身不参与布局重排。`.discover-playlists` 用 `overflow-x: auto` 提供横向滚动，且顶部没有内边距；卡片上移 2px 后，顶部 1px 边框与上浮后的背景落到滚动容器裁剪区之外，表现为悬停时顶边消失。3.6 的焦点环内收只能解决键盘描边，无法覆盖 hover 位移。

**解决方案**：

- 在 `.discover-playlists` 预留顶部空间：`padding-top: 4px`，同时把 `margin-top` 从 `10px` 收到 `6px`，卡片与上方内容的整体间距仍为 10px。
- 4px 内边距大于 2px 的上移距离，hover 后卡片顶边仍留 2px 余量；容器继续使用 `overflow-x: auto`。
- 不取消 `.card:hover` 的上浮效果，也不改卡片边框颜色与阴影。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 补 `.discover-playlists` 的 `margin-top: 6px` 与 `padding-top: 4px`，说明为 `.card:hover` 的 `translateY(-2px)` 预留空间。 |
| `USER.html` | §5.2.8 页面结构 · 发现（`#u5-2-8`） | 不动 | 悬停上浮属于样式细节，由 §4.49 记录；页面结构描述不重复。 |
| `CORE.html` | §4.68 `DiscoverView.vue`（`#c4-68`） | 不动 | 组件结构不变，只由样式文件提供裁剪余量。 |

**工作记录**：

- 核对 `CORE §4.49`：`.discover-playlists` 的 `margin-top: 6px`、`padding-top: 4px` 与为上浮预留空间的说明均已存在，无需改动。

### 3.8 上游日推歌单名缺少账号昵称前缀 [已解决] 

**描述**：每日推荐取到的动态歌单 `PlaylistMeta.name` 是上游原值“的今日私享”，前面缺少“某某”的昵称；发现页分区标题、歌单卡片、歌单详情、最近歌单与我的歌单卡片都会直接显示这个原值。上游没有在歌单元数据里提供昵称，昵称由登录资料接口（`user.getProfile`）单独返回，因此不能只改上游映射。

**解决方案**：

- 在 `utils/format.ts` 增加 `dailyPlaylistName(name, nickname)`：仅当名称以“的今日私享”开头且昵称非空时，拼成“昵称 + 名称”；昵称为空、普通歌单名、已经带昵称的名称都原样返回。
- 只在展示层调用：发现页分区标题与歌单卡片、歌单详情标题与删除确认、最近歌单、我的歌单卡片；不修改主进程缓存和 `PlaylistMeta`，避免把昵称写进持久化歌单数据。
- 昵称取 `auth.profile.nickname`；资料未加载时先显示原名，加载后由 Vue 响应式更新。
- 增加 `test/format.test.ts` 用例，覆盖补前缀、空昵称、普通歌单名与已带昵称四种情况。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §2 CONVENTIONS（`#u2`） | 改 | 增加“日推歌单名称”约定：显示为“当前账号昵称 + 的今日私享”，昵称未加载时先显示原名。 |
| `CORE.html` | §4.32 `utils/format.ts`（`#c4-32`） | 改 | 增加 `dailyPlaylistName(name, nickname)` 签名与规则。 |
| `CORE.html` | §4.68 `DiscoverView.vue`（`#c4-68`） | 改 | 分区标题与歌单卡片统一走 `dailyPlaylistName`。 |
| `CORE.html` | §4.46 `PlaylistView.vue`（`#c4-46`） | 改 | 歌单头标题与删除确认使用同一展示名。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） / §4.45 `LibraryView.vue`（`#c4-45`） | 改 | 最近歌单与我的歌单卡片也使用同一展示名。 |
| `USER.html` | §5.2.8 页面结构（`#u5-2-8`） | 不动 | 已由 §2 共用约定覆盖，不逐页重复。 |

**工作记录**：

- 核对 `USER §2` 的“日推歌单名称”、`CORE §4.32` 的 `dailyPlaylistName` 以及 `§4.68` / `§4.46` / `§4.23` / `§4.45` 的展示调用：均已存在，无需改动。

### 3.9 发现页每日推荐同时渲染歌曲列表与伪歌单入口 [已解决] 

**描述**：每日推荐分区同时渲染 30 首歌曲条目与“昵称的今日私享”歌单卡片；两者指向同一份日推内容，歌曲列表让每日推荐区域重复且多占 3 行高度。骨架也按“30 条歌曲 + 1 张卡片”渲染，加载完成后移除列表会产生明显跳动。

**解决方案**：

- 增加 `showsSongStrip(section)`：仅当分区没有 `playlists` 且 `songs` 非空时渲染歌曲条目；每日推荐有歌单卡片后不再渲染 30 首列表。
- 每日推荐骨架只渲染 1 张歌单卡片占位；`DiscoverSkeleton` 在 `songs === 0` 时不输出空的 `.discover-strip`，避免占位高度残留。
- 专属雷达 / 猜你喜欢没有歌单入口，继续渲染固定宽度歌曲条目；推荐数据加载与歌单卡片跳转逻辑不变。
- 不删除 `section.songs`：日推歌单仍需要预加载与歌单详情缓存，只停止在发现页重复展示。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §1 TERMS（`#u1`） | 改 | 增加“伪歌单”术语：推荐数据生成、外观与歌单卡片一致的单入口，不写入账号歌单。 |
| `USER.html` | §5.2.8 页面结构 · 发现（`#u5-2-8`） | 改 | 每日推荐只保留“昵称的今日私享”伪歌单入口；其余分区保留 3 行横向滚动歌曲条目；骨架按两种布局渲染。 |
| `CORE.html` | §4.68 `DiscoverView.vue`（`#c4-68`） | 改 | 记录 `showsSongStrip` 判定、骨架传参与每日推荐只渲染卡片。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 明确有歌单入口的分区不渲染歌曲条目，其余分区继续 3 行横向滚动。 |
| `README.md` | §2 用户交互 · 发现行 | 改 | 同步伪歌单入口与其余分区条目。 |
| `ABOUT.html` | 用户交互 · 发现行 | 改 | 与 README 同步。 |
| `CORE.html` | §4.62 `stores/recommend.ts`（`#c4-62`） | 不动 | 仍按三分区返回 30 首日推；本轮只改展示，不调整推荐抓取与缓存。 |

**工作记录**：

- `CORE §4.68` 原先只有 `topSections` / `listSections` 与骨架描述，缺 `showsSongStrip` 判定与骨架传参；本轮补记为“非每日推荐 / 猜你喜欢、无歌单入口且 `songs` 非空才渲染歌曲条目；首行骨架 `songs=0` / `playlists=1`，列表分区 `songs=30` / `playlists=0`”。
- `USER §1` / `§5.2.8`、`CORE §4.49`、`README` 与 `ABOUT` 的对应落点均已存在。

### 3.10 每日推荐按自然日过期，不能手动刷新 [已解决] 

**资料结论**：QQ 音乐没有公开日推的精确切换时间，但上游卡片 `time` 是日期时间戳，日推封面也是 `calendar/MMDD_300.jpg` 形式；第三方实现（simple-music 的 QQ 音乐接口文档）同样使用“上海日键”并每 60 秒检查跨日。因此按上海自然日 0 点失效更符合上游语义，不应从首次加载起滚动 24 小时。

**描述**：发现页把三个推荐分区统一按 24 小时 TTL 缓存，每日推荐还提供单区刷新按钮，顶部“换一批”也会强制刷新全部；页面跨过 0 点后不会自动更新，用户可能一整天看到昨天的日推。

**解决方案**：

- `RecommendSection` 增加 `expiresAtMs`：每日推荐为下一个上海自然日 0 点，雷达 / 猜你喜欢为抓取后 24 小时，占位分区为 0。
- 主进程缓存直接按 `expiresAtMs` 判断；`force` 只对雷达 / 猜你喜欢生效，不能绕过仍在有效期内的当天日推。读取日推歌单期间若跨过 0 点，立即把 `expiresAtMs` 标为当前时间，避免缓存昨天的内容。
- 渲染层 `load(force)` 不再强制日推；`refreshSection('daily')` 只在占位或过期时走普通 `get`，未过期的当天日推直接忽略。
- 新增 `isDailyExpired()` 与 `refreshDailyIfExpired()`；发现页挂载后每 60 秒检查一次，跨日后自动重取，卸载时清除定时器。
- 移除每日推荐分区的刷新按钮；顶部“换一批”只刷新雷达与猜你喜欢，并补充 tooltip。
- 增加 store 测试，覆盖强制加载不刷新日推、有效日推拒绝手动刷新、过期检测与自动重取、未过期不重取。

**文档操作**：

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

**工作记录**：

- `USER §1 TERMS` 已按新的术语规则收敛为定义并链接 `§2` 的“每日推荐刷新”，不再承载缓存时长细节；`USER §2` / `§5.2.8` 与 `README` / `ABOUT` 的对应表述均已存在。
- `CORE §4.1` 的 `expiresAtMs`、`§4.53` 的按自然日缓存、`§4.62` 的 `isDailyExpired` / `refreshDailyIfExpired`、`§4.68` 的 60 秒定时器、`§5.13` 的调用树与 `§4.50` 的常量分工均已存在，无需改动。

### 3.11 猜你喜欢改为连续队列 [已解决] 

**描述**：猜你喜欢原本按普通推荐分区渲染 30 首歌曲条目，点击只把当前分区当成静态列表播放；需求是改成“伪歌单”入口，点击后以拉取的 5 首启动连续队列，播放到队尾自动补 5 首，并在队列激活期间锁定顺序播放。

**解决方案**：

- `loadGuess` 只取第 1 页 5 首作为伪歌单封面与连续队列首批；新增 `fetchGuessBatch(page, size = GUESS_RADIO_BATCH_SIZE)`，通过 `page` / `pageNo` / `offset` / `num` 拉取单批。
- 新增 `recommend.guess(page)` IPC、preload 与渲染层契约，返回 `Song[]`；主进程只负责单批读取，不维护队列状态。
- 播放器新增 `startRadioQueue(songs)`：`queueSource` 增加 `radio` 类型，模式强制为 `sequence`，从第 2 页开始预取。
- `playAt()` 定位到队尾时调用 `ensureRadioBatch()`：同一 radio 会话单飞、最多翻 3 页、按 `songMid` 去重后追加；预取较慢且队尾已停止时补入后自动续播。开始其他歌单 / 歌曲时递增 radio 会话并解除锁定。
- 新增 `modeLocked`：队列激活期间 `setMode` / `cycleMode` / `setShuffle` / `setLoopStatus` 与 MPRIS 命令均不改变模式；播放条模式按钮禁用并关闭菜单。
- 发现页猜你喜欢改为伪歌单卡片（封面取首批第一首），点击调用 `startRadioQueue()`；骨架与标题计数同步改为卡片形态。
- 测试覆盖 5 首分页请求参数、连续队列启动与模式锁定、队尾补批、切回普通队列解锁。

**文档操作**：

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

**工作记录**：

- 核对 `USER §1` / `§5.2.3` / `§5.2.8` / `§5.2.9`、`CORE §4.2` / `§4.29` / `§4.40` / `§4.49` / `§4.53` / `§4.68` / `§5.13` / `§5.20` / `§4.50`、`PROVIDER §4.1` / `§4.3`、`README` 与 `ABOUT`：猜你喜欢连续队列、5 首分页、队尾续接、模式锁定与伪歌单入口均已存在，无需改动。

### 3.12 发现页首行合并两个伪歌单入口 [已解决] 

**描述**：每日推荐与猜你喜欢各占一个分区行，各自带分区标题、计数与刷新入口，首屏被拆成多行；需求是把两个伪歌单卡片并排放在第一行，猜你喜欢排第一位，并去掉这两个分区的标题、刷新键与页面整体“换一批”。

**解决方案**：

- 用 `topSections`（guess → daily）与 `listSections`（radar）拆分渲染；首行 `.discover-top` 使用 flex 横向左对齐排列，两张卡片固定原 150px 尺寸，保留封面 1:1 的比例与高度上限，不随首行宽度放大，也不填满整行。
- 首行两张卡片不再渲染 `section-title`、计数与单区刷新按钮；骨架也改为两个卡片占位，并取消骨架内部 `.discover-playlists` 的顶部间距与横向滚动。
- 移除页面顶部“换一批”按钮；专属雷达继续保留标题、计数、刷新入口与 3 行歌曲条目，日推由自然日过期自动更新。
- 卡片点击行为不变：猜你喜欢启动连续队列，每日推荐进入歌单详情。
- 只调整布局与可见入口，不改变推荐抓取、卡片点击与连续队列逻辑。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.8 页面结构 · 发现（`#u5-2-8`） | 改 | 猜你喜欢在左、每日推荐在右并排在第一行，不显示分区标题与刷新键；专属雷达保留标题与刷新。 |
| `CORE.html` | §4.68 `DiscoverView.vue`（`#c4-68`） | 改 | 记录 `topSections` 顺序、移除“换一批”与首行布局。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 增加 `.discover-top` 左对齐 flex、固定卡片尺寸与骨架间距覆盖。 |
| `README.md` | §2 用户交互 · 发现行 | 改 | 同步首行两个伪歌单卡片与移除整体换一批。 |
| `ABOUT.html` | 用户交互 · 发现行 | 改 | 与 README 同步。 |

**工作记录**：

- 核对 `USER §5.2.8`、`CORE §4.68` / `§4.49`、`README` 与 `ABOUT`：首行两张伪歌单卡片、`topSections` 顺序、固定尺寸与移除“换一批”的说明均已存在，无需改动。

### 3.13 评论正文混用真实换行与字面量 `\n` [已解决] 

**描述**：部分多行评论能正常换行，另一些直接显示字面量 `\n`。检查后确认不是渲染层转义问题：评论区使用 Vue 文本插值并按纯文本渲染，CSS 的 `white-space: pre-wrap` 会把真实换行显示出来；但上游 `Content` 字段不统一，有的记录返回真实换行，有的返回字面量 `\n` / `\r\n` / `\r` 两个字符，后者自然只会显示为反斜杠加 n。同一首歌的不同评论、甚至不同页之间都可能混用两种格式。

**解决方案**：

- 在 `src/main/api/comment.ts` 新增 `normalizeCommentContent()`：先把真实 `\r\n` / `\r` 统一为 `\n`，再把字面量 `\r\n` / `\n` / `\r` 统一替换为真实换行，最后写入 `Comment.content`。
- 渲染层继续保持纯文本插值与 `white-space: pre-wrap`，不引入 HTML / Markdown 解析，避免上游内容被当作标签执行。
- 扩展 `test/api/comment.test.ts`，覆盖字面量 `\n`、字面量 `\r\n`、字面量 `\r` 与真实 CRLF 四种输入，统一映射为真实换行。
- 明确这是上游数据格式不统一，不是渲染逃逸逻辑错误；评论区只需在数据映射边界做归一化。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 第 1 项“评论里的 `\n` 字样” | 改 | 行尾追加 ` [已解决]`。 |
| `USER.html` | §5.2.5 歌词与评论（`#u5-2-5`） | 改 | 说明真实换行与字面量 `\n` / `\r\n` / `\r` 都统一显示为换行，正文不解析 HTML。 |
| `CORE.html` | §4.15 `src/main/api/comment.ts`（`#c4-15`） | 改 | 记录 `normalizeCommentContent()` 的归一化规则与渲染层 `white-space: pre-wrap` 约束。 |
| `PROVIDER.html` | §2 CONVENTIONS · 评论正文换行（`#p2`） | 增 | 说明上游 `Content` 混用真实换行与字面量转义，应用在映射时统一为真实换行。 |
| `PROVIDER.html` | §4.3 数据模型与转换（`#p4-3`） | 改 | 在 `QqCommentList` 字段说明中补充 `Content` 换行归一化。 |

**工作记录**：

- `ISSUE.md` 中“评论里的 `\n` 字样”条目已随 ISSUE 列表更新移除，当前没有可追加 `[已解决]` 的行；未回加历史条目。
- `USER §5.2.5`、`CORE §4.15`、`PROVIDER §2` 与 `§4.3` 的换行归一化说明均已存在，无需改动。

### 3.14 界面冗余文字说明 [已解决] 

**描述**：ISSUES 列出一批界面文案多余：侧栏账号行重复写“已登录”、logo 块带“QQ Music · Linux”副标题、设置页为缓存清理与退出应用附加说明、发现页猜你喜欢带“连续推荐 · 顺序播放”副标题、歌单页重复显示已载入数量、播放历史页头显示容量说明，以及所有搜索框都带占位文字。这些信息要么与已有标题 / 数值重复，要么属于实现细节，挤占本已紧凑的窄屏和列表空间。

**解决方案**：

- `App.vue` 删除品牌块副标题；登录账号 pill 的次级行只显示 `musicid`；播放队列筛选框去掉占位文字，保留 `aria-label`。
- `SettingsView.vue` 删除播放缓存上限与退出应用的 `setting-desc`；清理策略与退出行为仍由功能与文档说明。
- `DiscoverView.vue` 删除猜你喜欢卡片的“连续推荐 · 顺序播放”副标题，只保留标题。
- `PlaylistView.vue` 删除歌单头的已载入数；底部 footer 只在加载中 / 中断时显示“正在加载”或“加载中断 + 重试”，完整加载后不占位；筛选框去掉占位文字，保留 `aria-label`。
- `HistoryView.vue` 删除页头记录数 / 容量说明，搜索框去掉占位文字，保留 `aria-label`。
- 在线搜索与下载中心搜索框去掉占位文字，改为 `aria-label`；删除不再使用的 `.brand-sub` 样式。
- 删除搜索结果中歌手 / 专辑卡片“查看歌手信息与歌曲”“查看专辑信息与歌曲”的说明性副标题，只保留名称；设置项“播放缓存（不影响已下载）”恢复为“播放缓存”；播放历史空状态去掉容量说明。
- 把规则写入 USER §2 CONVENTIONS「界面文案」：界面只显示操作名、状态、数据值与必要错误；不用小字、副标题或说明行解释 UI 行为、实现细节或操作后果；空状态只说明下一步，不重复容量或策略。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 第 2 项“清理多余的文字解释” | 改 | 行尾追加 ` [已解决]`。 |
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

**工作记录**：

- `ISSUE.md` 中“清理多余的文字解释”条目已随 ISSUE 列表更新移除，没有可追加 `[已解决]` 的行；未回加历史条目。
- `USER §2` / `§5.2.2` / `§5.2.4` / `§5.2.7` / `§5.2.8` / `§5.2.9` 与 `CORE §4.23` / `§4.44` / `§4.46` / `§4.48` / `§4.49` / `§4.67` / `§4.68` / `§4.87` 的界面文案清理与 `aria-label` 说明均已存在，无需改动。

### 3.15 歌单卡片播放按钮不随播放状态切换 [已解决] 

**描述**：歌单卡片的中心按钮只有“播放整个歌单”一种状态。当前卡片对应歌单已经在播放时，按钮仍显示播放图标，点击会重新起播而不是暂停；也无法从卡片恢复已暂停的歌单。用户要求按钮跟随播放器状态，在当前正在播放时显示暂停并点击暂停，暂停后还能点击继续。

**解决方案**：

- `usePlaylistPlay` 增加 `isSourcePlaying()` / `isSourcePaused()` / `toggleSource()`：按 `player.queueSource` 的 `kind + id` 判断卡片是否对应当前队列；正在播放或已暂停时调用 `player.toggle()`，其他来源或已停止时执行原起播函数。
- `CardPlayButton` 增加 `playing` / `paused` / `pauseLabel` / `resumeLabel`：播放时显示 `pause` 图标与“暂停播放”，暂停后显示 `play` 图标与“继续播放”，加载态仍优先显示 spinner；`title` / `aria-label` 同步切换。
- “我的歌单”、搜索结果、发现页每日推荐均以 `playlist / <id>` 来源接入；猜你喜欢以 `radio / guess` 来源接入，首次播放仍调用 `startRadioQueue()`。
- 扩展 `test/playlist-play.test.ts`，覆盖同来源播放 / 暂停切换、其他来源重新起播与已停止状态重新启动。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 第 3 项“歌单 hover 播放按钮智能切换” | 改 | 行尾追加 ` [已解决]`。 |
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

**工作记录**：

- `ISSUE.md` 中“歌单 hover 播放按钮智能切换”条目已随 ISSUE 列表更新移除，没有可追加 `[已解决]` 的行；未回加历史条目。
- `USER §1 TERMS` 已按新的术语规则收敛为“从歌单卡片直接起播整个歌单的入口”并链接 `§5.2.8`，播放 / 暂停细节不再放入 TERMS；`USER §5.2.8`、`CORE §4.44` / `§4.45` / `§4.68` / `§4.89` / `§4.90` / `§5.22`、`README` 与 `ABOUT` 的对应落点均已存在，无需改动。

### 3.16 评论正文中的 U+FFFC：表情占位与图片评论 [已解决] 

**描述**：ISSUES 反馈部分评论“有些文字没正常渲染”，例子为“好听哈￼”（Im Doing Fine，2026-10-24 10:22）。初次定位时只看到该条记录末尾的 ￼ 是 `U+FFFC`（对象替换符），且 `Pic` / `EmoPic` 都为空，于是按“无对应对象的空框”直接删除。复查另一条评论（No Jam，2026-05-29 20:05，用户 Aelita）后发现两处的 ￼ 确实是同一个码位 `U+FFFC`，但这条的 `Content` 只有这个占位符、`Pic` 却是一张 1179×1095 的梗图；直接删除会把整条图片评论过滤掉。

进一步抽样评论数据后确认 `U+FFFC` 是上游客户端的通用内嵌媒体占位：

- `Pic` 是评论附图，可独立存在（正文 + 图、纯图、正文为空 + 图都出现过），文本中通常不再出现占位符。
- `EmoPic` 是内嵌表情图，URL 对应正文中的 `U+FFFC` 位置；有的评论 `EmoPic` 非空但没有占位符，表示表情追加在正文末尾。
- 两者都为空时，`U+FFFC` 才是没有对象的残留占位，例如“好听哈￼”“求歌词翻译￼。￼”。
- 现有过滤条件 `content.trim().length > 0` 还会丢掉“正文为空但有 `Pic` / `EmoPic`”的纯图片 / 纯表情评论。

**解决方案**：

- `RawComment` 增加 `Pic` / `EmoPic`，`Comment` 增加 `imageUrl` / `emojiUrl`；媒体 URL 与头像共用 `http:` → `https:` 归一化。
- `normalizeCommentContent()` 仅归一化换行；`EmoPic` 非空时保留 `U+FFFC` 供渲染层定位，`EmoPic` 为空时移除所有占位符，避免空框。
- `CommentsPanel` 按 `U+FFFC` 切分正文，把第一个占位符替换为 `emojiUrl`；没有占位符时把表情追加到正文末尾，多余占位符丢弃。`imageUrl` 附图单独显示在正文下方，只有图片或表情的评论也照常显示。
- 过滤条件改为“有正文或有图片或有表情”，正文与媒体都为空才丢弃。
- 扩展 `test/api/comment.test.ts`：覆盖无媒体的残留占位、`Pic` 附图（含纯图与正文仅占位）、`EmoPic` 内嵌表情（含无占位符）、纯媒体评论保留与空评论过滤。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 第 1 项“评论渲染支持” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §5.2.5 歌词与评论（`#u5-2-5`） | 改 | 说明表情按 `U+FFFC` 位置内联、附图显示在正文下方、无表情的占位符移除、纯媒体评论保留。 |
| `CORE.html` | §4.1 内部类型（`#c4-1`） | 改 | `Comment` 增加 `imageUrl` / `emojiUrl`。 |
| `CORE.html` | §4.15 `src/main/api/comment.ts`（`#c4-15`） | 改 | 记录 `Pic` / `EmoPic` 映射、`U+FFFC` 保留 / 移除规则与纯媒体评论过滤条件。 |
| `CORE.html` | §4.42 `CommentsPanel.vue`（`#c4-42`） | 改 | 记录正文切分、表情内联 / 追加与附图展示。 |
| `PROVIDER.html` | §2 CONVENTIONS · 评论正文换行（`#p2`） | 改 | 说明 `Content` 的 `U+FFFC` 与 `Pic` / `EmoPic` 的关系及映射规则。 |
| `PROVIDER.html` | §4.3 数据模型与转换（`#p4-3`） | 改 | `QqComment` 增加 `Pic` / `EmoPic`；转换表补充两个媒体字段。 |
| `README.md` | §2 用户交互 · 歌词 / 评论行 | 改 | 补充评论支持内嵌表情与附图。 |
| `ABOUT.html` | 用户交互 · 歌词 / 评论行 | 改 | 与 README 同步。 |

**工作记录**：

- `ISSUE.md` 中的对应条目已随 ISSUE 列表更新移除，没有可追加 `[已解决]` 的行；未回加历史条目。
- 其余文档操作已逐项核对，无需改动。

### 3.17 QQ 网页登录凭证没有走正确的续期路径 [已解决] 

**描述**：ISSUES 反馈凭证到期后应用没有主动续期，最终只能重新登录。原实现虽然已有 30 分钟定时检查和到期前 10 分钟窗口，但 `refreshMusickey()` 只调用 `music.login.LoginServer/Login` 的 `refresh_token` 流程，这是移动端 / 微信登录的续期方式；QQ 网页扫码登录的稳定路径是 `QQConnectLogin.LoginServer/QQLogin`，用旧 `musickey` 加 `expired_in` 直接换新 key，旧 key 已过期时仍可尝试恢复。续期路径不匹配时，定时器每次失败后只能等下个 30 分钟，到期瞬间的请求也会直接返回 `AUTH_EXPIRED`。

**解决方案**：

- `refreshMusickey()` 改为优先调用 `QQConnectLogin.LoginServer/QQLogin`，参数 `{ expired_in: 7776000, musicid, musickey }`，其中 `expired_in` 声明 90 天会话；微信账号或 QQLogin 失败且存在 `refresh_token` 时，回退到原 `music.login.LoginServer/Login` 流程。
- 新增 `mergeRefreshedCredential()` 统一合并续期响应：更新 `musickey`、按 `musickeyCreateTime + keyExpiresIn` 重算 `expiredAtMs`，并在响应携带时更新 `refresh_token` / `access_token` / `openid` / `unionid` / `refresh_key` / `loginType`。
- `client.ts` 增加 `setCredentialRefresher()` 注册入口，避免 client ↔ login 循环依赖；`musicu` 收到 `1000` / `104401` / `104400` 时自动续期一次并换新凭证重试原请求。收藏等自行持有凭证的流程通过 `withCredentialRefresh()` 获得同样的一次续期重试。
- 续期失败保留旧凭证与原错误，定时器继续按到期时间重试。
- 新增 `test/api/login-refresh.test.ts` 与 `test/api/client-auth-refresh.test.ts`，覆盖 QQLogin 主路径、refresh_token 回退、微信账号顺序、到期窗口判断、登录失效自动重试、显式匿名凭证不续期与续期失败保留原错误。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 第 2 项“凭证到期后自动续期” | 改 | 行尾追加 ` [已解决] `。 |
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

**工作记录**：

- `ISSUE.md` 中的对应条目已随 ISSUE 列表更新移除，没有可追加 `[已解决]` 的行；未回加历史条目。
- 其余文档操作已逐项核对，无需改动。

### 3.18 后退手势在浮层打开时执行页面导航 [已解决] 

**描述**：鼠标侧键后退由 Chromium 直接遍历历史，应用没有统一的浮层拦截。歌词 / 评论、播放队列、窄屏侧栏或确认对话框打开时按下后退，会直接切换路由；浮层要么被路由变化顺带关闭，要么继续覆盖新页面。各组件只处理 Esc 与关闭按钮，没有共享的“后退优先关闭最上层浮层”入口。

**解决方案**：

- 新增 `composables/back-navigation.ts`：模块级关闭栈、`pushBackDismiss` / `dismissTopPopup`、`useBackDismiss` 与 `installBackNavigation`。浮层打开时入栈，关闭或卸载时注销；后退只关闭栈顶，没有浮层才调用 `router.back()`。
- 主进程监听窗口 `app-command` 的 `browser-backward`，通过 `navigation:back` 推送给渲染层，不在主进程执行导航；Linux 按下 / 抬起各触发一次，主进程与渲染层都以 200ms 窗口去重。
- 渲染层在捕获阶段拦截后退侧键的 `mouseup`，阻止 Chromium 自带历史导航，确保一次按键只产生一次浮层关闭或路由后退。
- 歌词 / 评论、播放队列、窄屏侧栏、`ConfirmDialog`、`ReauthDialog`、`PlaylistPicker`、`PlaylistEditDialog` 接入统一浮层栈；“下载”删除确认框复用 `ConfirmDialog`，随其生效。
- 新增 `test/back-navigation.test.ts` 覆盖后进先出的关闭顺序。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 第 1 项“在任何弹出时‘后退’操作的行为应该是关闭弹出” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §2 CONVENTIONS · 后退手势（`#u2`） | 增 | 说明后退优先关闭最上层浮层，没有浮层才沿路由历史返回。 |
| `CORE.html` | §1 文件树 · `composables/back-navigation.ts` / `test/back-navigation.test.ts` | 增 | 登记浮层关闭栈与测试。 |
| `CORE.html` | §4.2 `src/shared/ipc.ts`（`#c4-2`） | 改 | 增加 `navigation.onBack` 与 `navigation:back` 通道。 |
| `CORE.html` | §4.4 `src/main/index.ts`（`#c4-4`） | 改 | 记录 `app-command` 后退转发与去重。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） | 改 | 安装后退分发，播放队列与窄屏侧栏注册关闭。 |
| `CORE.html` | §4.66 / §4.72 / §4.77 / §4.81 / §4.91 | 改 | 各对话框与歌词 / 评论浮层补充后退关闭注册。 |
| `CORE.html` | §4.92 `back-navigation.ts`（`#c4-92`） | 增 | 记录关闭栈、打开状态监听、后退分发与鼠标侧键拦截。 |

**工作记录**：

- `ISSUE.md` 中的对应条目已随 ISSUE 列表更新移除，没有可追加 `[已解决]` 的行；未回加历史条目。
- 其余文档操作已逐项核对，无需改动。

### 3.19 QQ 网页登录续期被上游以 10006 拒绝 [已解决] 

**描述**：QQ 网页扫码登录后，续期日志持续出现 `temp-failed`，上游返回 `10006（QQConnectLogin.LoginServer.QQLogin(refresh)）`。续期请求只发送了 `expired_in`、字符串 `musicid` 与旧 `musickey`，`comm` 只有 `tmeLoginType`；缺少网页登录拿到的 `access_token` / `refresh_token` / `openid`、数字账号与 `uin` / `g_tk` 等公共参数，被上游按参数错误拒绝，并非上游故障。

**解决方案**：

- `refreshViaQqLogin` 参数补齐 `onlyNeedAccessToken` / `forceRefreshToken`（0）、`access_token`、`refresh_token`、`openid` 与数字 `musicid`；OAuth 字段缺失时从 `Credential.webCookies` 的 `psrf_qqaccess_token` / `psrf_qqrefresh_token` / `psrf_qqopenid` 回退读取。
- 请求 `comm` 补齐 `uin`、`g_tk`（由旧 `musickey` 计算）、`format`、`ct`、`cv` 与 `platform`；登录方式仍固定为 QQ，不跨方式回退。
- 续期响应解析兼容 `req_0` / `req` / `req1`，避免只在顶层节点名不同时误判为响应缺失。
- 扩展 `test/api/login-refresh.test.ts`：覆盖完整 QQ 续期参数、网页 Cookie 字段回退与 `req1` 响应。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 第 2 项“QQ登录刷新时报错” | 改 | 行尾追加 ` [已解决] `。 |
| `CORE.html` | §4.16 `src/main/api/login.ts`（`#c4-16`） | 改 | 记录 QQ 续期所需 OAuth 参数、`comm` 字段、Cookie 回退与 `req1` 响应兼容。 |
| `PROVIDER.html` | §4.1 上游方法（`#p4-1`） | 改 | 补充 QQLogin 续期的 OAuth 参数与 10006 触发原因。 |
| `PROVIDER.html` | §4.5 请求画像（`#p4-5`） | 改 | 同步 QQ 续期请求画像与公共参数。 |

**工作记录**：

- `ISSUE.md` 中的对应条目已随 ISSUE 列表更新移除，没有可追加 `[已解决]` 的行；未回加历史条目。
- 其余文档操作已逐项核对，无需改动。

### 3.20 评论附图与表情缺少加载失败占位和大图查看 [已解决] 

**描述**：评论的附图（`Pic`）与内嵌表情（`EmoPic`）直接绑定 `<img>`，源图 404 或网络失败时浏览器显示破图图标，且没有统一的失败态；附图也无法放大查看。ISSUES 要求两者都显示“折角纸张 + 右下角 X”的小占位，并让附图支持全屏查看、适应屏幕 / 原始大小切换与拖动。

**解决方案**：

- `CommentsPanel` 用 `failedMedia` 按 URL 记录加载失败的媒体；`img` 触发 `error` 后改渲染 `file-broken` 占位。表情占位保持 20px 行内尺寸，附图占位固定 56×42px；刷新评论或切歌时清空失败记录重新尝试。
- `AppIcon` 新增 `file-broken` 图标：折角纸张轮廓与右下角 X。
- 新增 `ImageLightbox`：通过 `Teleport` 覆盖全屏，背景变暗、右上角关闭；点击图片在适应屏幕与原始大小之间切换，原始大小超出视口时按指针拖动平移并夹紧边界。Esc、空白点击与返回手势都能关闭，且打开时优先于歌词 / 评论层处理 Esc 与返回。
- 附图加载成功后点击打开查看器；表情保持不可点击。
- 新增样式：评论媒体 `zoom-in` 指针、失败占位虚线框、查看器背景 / 图片 / 关闭按钮与拖动光标。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 第 3 项“评论 pic / emopic 占位与附图查看” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §5.2.5 歌词与评论（`#u5-2-5`） | 改 | 补充加载失败占位、附图全屏查看、尺寸切换与拖动。 |
| `CORE.html` | §1 文件树 · `components/ImageLightbox.vue` | 增 | 登记评论图片查看器。 |
| `CORE.html` | §4.42 `CommentsPanel.vue`（`#c4-42`） | 改 | 记录 `failedMedia`、占位尺寸与附图查看入口。 |
| `CORE.html` | §4.93 `ImageLightbox.vue`（`#c4-93`） | 增 | 记录全屏层、尺寸切换、拖动平移与关闭方式。 |
| `README.md` | §2 用户交互 · 歌词 / 评论行 | 改 | 补充附图可点击查看大图。 |
| `ABOUT.html` | 用户交互 · 歌词 / 评论行 | 改 | 与 README 同步。 |

**工作记录**：

- `ISSUE.md` 中的对应条目已随 ISSUE 列表更新移除，没有可追加 `[已解决]` 的行；未回加历史条目。
- 其余文档操作已逐项核对，无需改动。

### 3.21 评论占位符语义、缺图占位与 Yi 文种缺字 [已解决] 

**描述**：上一轮只处理了 `<img>` 加载失败，`好听哈￼`（Im Doing Fine，2026-10-24 10:22）这类 `Content` 带 `U+FFFC`、`Pic` / `EmoPic` 都为空的评论被主进程提前删除占位符，界面不会出现占位图标。另一个歧义是 `Pic` 是否使用 `U+FFFC`；抽样上游评论后确认：Ladyfingers 的 `我的故事总是发生在夏天￼`（2026-10-11 21:27，CmId `1!hAwDtmYh-7PDqHWNGYz5WwGArLvZcxQNY05CpPH8snrdd3vHJnsoIIQY9h5-YbOO`）**只有 `Pic`，没有 `EmoPic`**：`Pic` 为 `https://music-file.y.qq.com/comment/u/oK6kowEAoK4z7K-kow6qoeSsNv/23ab0/0d56550082963481998aac593c23eea5cddc2b9d_20242f.jpg`，`EmoPic` 为空字符串。继续翻取该歌曲 758 条评论后统计：`Pic` 非空 88 条，其中仅 1 条同时带 `U+FFFC`；`EmoPic` 非空 6 条，全部不带 `U+FFFC`；无任何媒体的 `U+FFFC` 4 条。另一首 Im Doing Fine 的 200 条样本同样未出现 `EmoPic + U+FFFC` 的稳定组合。因此附图没有可靠的占位映射，`U+FFFC` 只能按内嵌表情位置或残留占位处理。另有 Ladyfingers 2026-11-13 20:04 的评论包含 `ꈍ◡ꈍ`，其中 `U+A20D` 在缺少 Yi 字体的 Linux 上显示为缺字方框。

**解决方案**：

- `normalizeCommentContent` 明确区分三种情况：有 `EmoPic` 时保留 `U+FFFC` 供表情定位；只有 `Pic` 时移除残留占位；两者都没有时保留占位，交给渲染层显示失败图标。
- 评论过滤改为先移除 `U+FFFC` 再判断正文是否为空，避免只剩占位符且没有媒体的记录进入列表。
- `CommentsPanel` 的 `contentParts` 把第一个占位替换为 `EmoPic`，其余占位生成 `missing` 部分并显示 `file-broken` 占位；`Pic` 始终单独渲染在正文下方，不消费占位符。
- 新增 `@fontsource/noto-sans-yi` 的 Yi 子集并在正文 `font-family` 末尾加入 `Noto Sans Yi`，缺失字形时回退到内置字体；OFL 许可证随打包资源分发。
- 更新 `test/api/comment.test.ts`：无媒体占位符保留，带 `Pic` 的占位符仍移除。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.5 歌词与评论（`#u5-2-5`） | 改 | 明确 `U+FFFC` 只对应表情，无媒体占位显示失败图标，`Pic` 单独展示。 |
| `CORE.html` | §4.15 `comment.ts`（`#c4-15`） | 改 | 记录 `EmoPic` / `Pic` / 无媒体三种占位处理与过滤规则。 |
| `CORE.html` | §4.42 `CommentsPanel.vue`（`#c4-42`） | 改 | 记录首个占位换表情、其余占位显示失败图标、附图不消费占位。 |
| `CORE.html` | §3 SBOM / §4.22 `main.ts` | 改 | 登记 `@fontsource/noto-sans-yi` 与 `Noto Sans Yi` 字体回退。 |
| `PROVIDER.html` | §2 CONVENTIONS / §4.3 数据模型与转换 | 改 | 说明 `Pic` 不参与 `U+FFFC` 映射及无媒体占位的处理。 |
| `README.md` / `ABOUT.html` | 用户交互 · 歌词 / 评论行 | 改 | 补充加载失败占位。 |

**工作记录**：

- 逐项核对目标文档落点，均已存在，无需改动。

### 3.22 xlogin / 微信扫码视图位置漂移并覆盖播放条 [已解决] 

**描述**：登录组件的 `WebContentsView` 用渲染层上报的占位矩形定位。宽屏登录卡达到 `max-width: 800px` 后，窗口继续变宽只会改变卡片的水平中心，`ResizeObserver` 观察尺寸但不观察位置，因此上报的 `x` 不再更新，视图像被固定在旧坐标；微信扫码同样复用这条链路。窗口变矮时占位矩形可以伸到 `.main` 之外，而原生视图不参与 CSS 裁剪，会直接覆盖底部播放条。

**解决方案**：

- `LoginView` 同时监听窗口 `resize`、滚动与占位元素尺寸变化；窗口宽度超过卡片最大宽度时也能重新上报中心位置。
- 新增纯函数 `clampEmbedRect(rect, area)`，把占位矩形与 `.main` 的可见矩形求交集；短窗口下裁剪高度，完全滚出内容区时得到零尺寸。
- `web-login.applyBounds` 对零宽 / 零高调用 `setVisible(false)`，恢复可见时再 `setVisible(true)` + `setBounds`；零尺寸只隐藏视图，不取消登录，保留 `null` 原有的取消语义。
- 新增 `test/embed-bounds.test.ts` 覆盖完整可见、底部裁剪与完全移出三种情况。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 第 4 项“xlogin 扫码登录嵌入位置” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §5.2.6 登录页（`#u5-2-6`） | 改 | 说明组件随窗口 / 滚动更新、裁剪到内容区且不覆盖播放条。 |
| `CORE.html` | §1 文件树 / §4.17 `web-login.ts` / §4.47 `LoginView.vue` | 改 | 记录零尺寸隐藏语义、位置同步与内容区裁剪。 |
| `CORE.html` | §4.94 `embed-bounds.ts`（`#c4-94`） | 增 | 记录占位矩形交集计算与测试。 |

**工作记录**：

- `ISSUE.md` 中的对应条目已随 ISSUE 列表更新移除，没有可追加 `[已解决]` 的行；未回加历史条目。
- 其余文档操作已逐项核对，无需改动。

### 3.23 设置页账号区缺少 VIP 标记 [已解决] 

**描述**：设置页账号区已按 ISSUES 去掉“已登录”徽标，但右侧没有 VIP 标记。主进程已有 `isVipUser()`（`VipLogin.VipLoginInter/vip_login_base`，按账号缓存 5 分钟），但没有跨 IPC 暴露；渲染层无法在不重复请求上游的情况下显示 VIP 状态。

**解决方案**：

- `LycheeApi.user` 增加 `isVip()`，preload 调用 `user.isVip`，主进程直接复用 `isVipUser()`，不新增上游请求路径。
- 设置页在登录态或 `musicid` 变化时查询 VIP；结果只在为真时渲染 `.pay-badge` 的“VIP”徽标，未登录、接口失败或无法检测时隐藏。请求带自增序号，避免切换账号时旧响应覆盖新状态。
- VIP 查询沿用主进程缓存，不会在每次进入设置页时轰炸上游。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 第 5 项“设置页账号信息” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §5.2.7 设置页（`#u5-2-7`） | 改 | 账号区补充 VIP 标记与检测失败隐藏规则，原型同步。 |
| `CORE.html` | §4.2 `src/shared/ipc.ts`（`#c4-2`） | 改 | 增加 `user.isVip` 签名。 |
| `CORE.html` | §4.13 `src/main/api/user.ts`（`#c4-13`） | 改 | 记录设置页消费 VIP 状态与失败隐藏。 |
| `CORE.html` | §4.48 `SettingsView.vue`（`#c4-48`） | 改 | 记录登录态 / 账号变化时查询 VIP 与徽标渲染规则。 |

**工作记录**：

- `ISSUE.md` 中的对应条目已随 ISSUE 列表更新移除，没有可追加 `[已解决]` 的行；未回加历史条目。
- 其余文档操作已逐项核对，无需改动。

### 3.24 长页面快速跳转按钮未覆盖全部动态页面 [已解决] 

**描述**：ISSUES 要求所有动态高度页面都要有快速跳到顶部 / 底部的按钮。最初只补了下载中心，漏掉播放历史；继续盘点后确认需要接入的路由页还有我的歌单、歌手、专辑。歌单详情与评论已有各自的实现，但两处滚动监听、阈值与按钮模板重复，新页面继续复制会再次漏项。

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

**解决方案**：

- 新增纯函数 `utils/page-jump::jumpVisibility`：距顶 / 距底超过 `120px` 才显示对应按钮，内容不足一屏时都不显示。
- 新增 `composables/page-jump::usePageJump(rootRef)`：从页面根节点取得 `.main` 滚动容器，注册 passive 滚动与 `ResizeObserver`，返回两个显隐状态和平滑滚动函数；卸载时自动清理。
- 新增 `components/PageJump.vue`：统一右下角两个圆形按钮的模板，页面只传显隐状态并接滚动函数，不再复制按钮结构。
- `LibraryView` / `ArtistView` / `AlbumView` / `HistoryView` / `DownloadsView` 全部接入；`PlaylistView` 与 `DownloadsView` 的旧重复实现改为共用。发现与搜索经确认不接入。
- 新增 `test/page-jump.test.ts` 覆盖不足一屏、顶部、底部与阈值边界。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 第 6 项“所有动态高度的页面” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §2 CONVENTIONS · 长页面跳转 / §5.2.8 下载中心 | 改 | 列出全部接入页面与排除页面，下载中心补充按钮说明。 |
| `CORE.html` | §1 文件树 / §4.46 `PlaylistView` / §4.67 `DownloadsView` | 改 | 改为共用 `usePageJump`，下载中心补充跳转按钮。 |
| `CORE.html` | §4.95 `page-jump.ts`（composable）/ §4.96 `utils/page-jump.ts` / §4.97 `PageJump.vue` | 增 | 记录滚动监听、显隐判定、接入页面与统一按钮模板。 |

**工作记录**：

- `ISSUE.md` 中的对应条目已随 ISSUE 列表更新移除，没有可追加 `[已解决]` 的行；未回加历史条目。
- 其余文档操作已逐项核对，无需改动。

### 3.25 未开始下载任务的标题显示歌曲 ID [已解决] 

**描述**：下载任务入队时只保存 `songMid`，`name` 直接写成 mid，歌手与专辑留空；歌曲信息要等 pump 出队解析时才回填。因此在任务真正开始前，下载中心列表标题是一串看不出规律的 ID。若为了补标题在入队阶段调用歌曲详情接口，又会在批量下载时额外轰炸上游。

**解决方案**：

- 新增跨 IPC 的 `DownloadRequest`：`songMid` / `name` / `singers` / `albumName`，由渲染层从当前歌曲对象直接取值，不新增上游请求。
- `download.start` / `download.startMany` 改为接收 `DownloadRequest`；主进程逐项校验 mid、截断歌手数量，单曲与整单入口共用。
- `enqueueTask` 直接使用请求中的已知元数据生成任务标题、歌手、专辑与占位文件名；pump 出队后仍用上游解析结果覆盖，并重算最终路径。
- `useDownloadAction` 从 `Song` 取歌名 / 歌手 / 专辑；歌单“下载全部”为每首歌构造同样的请求。
- 更新 `test/download-manager.test.ts` 与 `test/download-action.test.ts`，断言入队阶段不请求详情且标题立即正确。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 第 7 项“未开始的下载任务标题” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §5.2.8 下载中心 | 改 | 说明任务加入后立即显示已知歌名 / 歌手 / 专辑。 |
| `CORE.html` | §4.1 内部类型 / §4.2 IPC / §4.60 `download/manager.ts` / §4.71 `stores/download.ts` | 改 | 增加 `DownloadRequest`，更新入队与出队解析说明。 |
| `CORE.html` | §5.16 下载调用树 | 改 | 入队调用改为携带 `DownloadRequest`。 |
| `README.md` / `ABOUT.html` | 用户交互 · 下载行 | 改 | 补充未开始任务立即显示已知歌曲信息。 |

**工作记录**：

- `ISSUE.md` 中的对应条目已随 ISSUE 列表更新移除，没有可追加 `[已解决]` 的行；未回加历史条目。
- 其余文档操作已逐项核对，无需改动。

### 3.26 下载页缺少按当前视图清空任务的入口 [已解决] 

**描述**：下载中心只有“清除已完成”和“清空目录”。前者不能处理进行中 / 失败 / 暂停任务，后者会连同磁盘文件一起删除；用户想要整理任务列表、保留已下载文件时没有入口。固定语义的“清空全部任务”也不够灵活，无法只清空“进行中”“已完成”或搜索结果。

**解决方案**：

- 主进程新增 `clearDownloadTasks(ids)`：只停止并移除给定 ID 的任务记录，写回索引，不删除磁盘文件、分片或封面。
- `download.clearTasks` IPC / preload / store 同步新增；store 移除对应任务、刷新相关歌曲资产与目录用量，并在没有活动任务时停止轮询。
- 下载中心工具栏在“全部开始”旁增加“清空”，取当前 `filteredTasks`（状态筛选叠加搜索）的 ID 作为清空范围，没有可见任务时禁用；确认文案显示当前任务数量，并说明文件保留在本机。
- 这样同一个按钮即可清空全部、进行中、已完成、未成功或某个搜索关键词下的任务。
- 新增下载管理器测试：清空指定记录后列表为空，但原文件仍存在；下载中心 SSR 测试断言“清空”按钮。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 第 9 项“下载页需要清空任务按钮” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §5.2.8 下载中心 | 改 | 工具栏补充按当前筛选 / 搜索范围清空的“清空”按钮，区分保留文件与“清空目录”。 |
| `CORE.html` | §4.2 IPC / §4.60 `download/manager.ts` / §4.67 `DownloadsView` / §4.71 `stores/download.ts` | 改 | 增加 `clearDownloadTasks` / `download.clearTasks` / `clearTasks(ids)` 与按钮说明。 |
| `README.md` / `ABOUT.html` | 用户交互 · 下载行 | 改 | 补充“清空”按当前显示范围移除记录。 |

**工作记录**：

- `ISSUE.md` 中的对应条目已随 ISSUE 列表更新移除，没有可追加 `[已解决]` 的行；未回加历史条目。
- 其余文档操作已逐项核对，无需改动。

### 3.27 搜索页 MV、歌手头像与分页缺失 [已解决] 

**描述**：搜索页存在三个独立缺口。MV 搜索被附加在单曲结果底部，不是真正的分类；歌手结果只渲染姓名首字，完全没有使用上游 `singerPic`；真实搜索响应的总数在 `data.meta.sum`，原解析只读 `body.meta.sum`，导致 `total` 恒为 0、分页器永远不显示，也没有滚动加载。

**解决方案**：

- `SearchRequest.type` 增加 `mv`；`searchByType` 对 `mv` 转交 `searchMv`，并让 `searchMv` 接受每页条数、读取 `data.meta` 总数。搜索页新增独立 MV 标签，删除单曲结果底部的 MV 追加逻辑。
- `Singer` 增加可选 `avatarUrl`，搜索映射读取 `singerPic ?? pic ?? avatar` 并转 https；歌手卡片显示头像，加载失败时清空该字段回退姓名首字。
- 搜索结果总数兼容 `data.meta` / `body.meta`。页面改为累计分页：第一页替换，后续页按类型主键去重后追加；`.main` 滚动到底自动加载，同时保留“加载更多”按钮。新关键词 / 切换标签重置到第一页并回顶，追加失败只 Toast、保留已有结果。
- 扩展 `test/api/search.test.ts`：覆盖顶层 `meta`、歌手头像映射与 `mv` 类型路由。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 第 10 项“搜索页优化” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §5.2.8 搜索页 | 改 | 五类标签、独立 MV、歌手头像、滚动 / 加载更多。 |
| `CORE.html` | §4.1 类型 / §4.10 `search.ts` / §4.44 `SearchView` / §4.56 `mv.ts` | 改 | 记录 `mv` 类型、头像字段、顶层 meta 与累计分页。 |
| `README.md` / `ABOUT.html` | 用户交互 · 搜索行 | 改 | 同步五类搜索与滚动加载。 |

**工作记录**：

- `ISSUE.md` 中的对应条目已随 ISSUE 列表更新移除，没有可追加 `[已解决]` 的行；未回加历史条目。
- 其余文档操作已逐项核对，无需改动。

### 3.28 搜索页分页数量与卡片网格按屏幕自适应 [已解决] 

**描述**：搜索页虽然改成累计分页，但仍沿用每页 20 条；宽屏卡片使用 `auto-fill`，歌手 / 专辑结果在页尾留下大片空白，窄屏列数也随宽度漂移。MV 仍使用方形封面，无法体现上游 640×360 的缩略图比例，也没有明确保证动图正常播放。

**解决方案**：

- `SEARCH_PAGE_SIZE_DEFAULT` 改为 48；歌手固定 `SEARCH_SINGER_PAGE_SIZE = 24`（上游单页超过 40 会返回空结果），`searchByType` 按类型夹紧，页面用同一有效页大小计算总页数。这样分页数量不再依赖屏幕宽度。
- 搜索结果的歌手 / 专辑 / 歌单网格固定列数：宽屏 8 列、窄屏（≤900px）3 列；MV 宽屏 6 列、窄屏 2 列。卡片宽度由 `minmax(0, 1fr)` 随内容区缩放，不再用 `auto-fill` 由卡片最小宽度决定列数。
- MV 封面增加 `mv-cover`，使用上游缩略图的 16:9 比例；封面继续使用原生 `<img>`，GIF / WebP 动图由浏览器原生播放，不做首帧冻结。
- 扩展 `test/api/search.test.ts`：验证歌手页大小固定为 24。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.8 搜索页 | 改 | 补充固定列数、48 / 24 条分页、MV 16:9 与动图。 |
| `CORE.html` | §4.44 `SearchView` / §4.50 常量 | 改 | 记录固定网格、有效页大小与 MV 封面比例。 |
| `README.md` / `ABOUT.html` | 用户交互 · 搜索行 | 改 | 同步列数与 MV 封面说明。 |

**工作记录**：

- 逐项核对目标文档落点，均已存在，无需改动。

### 3.29 搜索少返回行为核实与 MV 动图核实 [已解决] 

**描述**：歌单搜索结果每页实际常返回 48/46/45 条，歌手结果也可能因过滤少于 24 条；需要确认这是否由请求参数控制。MV 的 `mv_pic_url` 示例 Bound 2 (Network Edit) 实际是 640×360 的静态 JPEG，不是 GIF / WebP。

**核实结果**：

- 上游会读取并回显 `num_per_page`，把它作为每页上限；同一页连续请求三次，返回条数与 ID 顺序完全一致，说明不是随机“凭喜好”返回。
- 返回条数可能少于请求值，例如 `perpage=48` 的连续页返回 46 / 45 / 46；`meta.ein` 也小于 `perpage`，属于服务端内部过滤，页面无法通过参数补齐。
- 歌手 `perpage=48/50` 会直接返回空列表与 `is_filter=-2`，因此歌手固定请求 24 条。
- Bound 2 (Network Edit) 的封面 URL 为 `.jpg`，下载后确认是单帧 640×360 JPEG；同 URL 的 `.webp` 也是单帧。搜索响应只有 `mv_pic_url`，没有动图字段，客户端看到的动态效果来自视频预览。

**解决方案**：

- 不做缓冲补页：页面按上游实际返回条数累加并去重，接受末行可能不满；这是上游不可控行为，额外补页只会增加请求而不改变数据。
- 保留歌手 24 / 其余 48 的每页请求大小，保留固定网格列数（宽 8 / 窄 3，MV 宽 6 / 窄 2）。
- `SearchResult` 增加可选 `hasMore`，来自上游 `meta.nextpage`；页面不再依赖可能波动的 `total` 判断是否继续加载。
- MV 封面继续使用原生 `<img>`，GIF / WebP 会自然播放；当前搜索接口示例封面为静态 JPEG，不能从该字段获得动图。
- 新增/更新搜索 API 测试，验证 `nextpage` 映射、歌手 24 条页大小与 MV 总数。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.8 搜索页 | 改 | 补充歌手 24 条、上游可能少返回与 MV 静态封面现状。 |
| `CORE.html` | §4.44 `SearchView` / §4.56 `mv.ts` | 改 | 记录上游过滤行为、`hasMore` 与静态封面事实。 |
| `README.md` / `ABOUT.html` | 用户交互 · 搜索行 | 改 | 同步末行可能不满与动态封面说明。 |

**工作记录**：

- 逐项核对目标文档落点，均已存在，无需改动。

### 3.30 长页面跳转沿用浏览器平滑滚动，过渡时长随距离增长 [已解决] 

**描述**：所有长页面的“跳转到顶部 / 底部”按钮都调用 `scrollTo({ behavior: 'smooth' })`，实际时长由 Chromium 按滚动距离决定，页面越长过渡越慢，长列表需要一秒以上才停稳；评论区的“跳转到底部”又直接写 `scrollTop`，与顶部按钮不一致。需求是过渡时长固定为 `JUMP_TRANSITION=400ms`，做不到才取消过渡。

**解决方案**：

- `utils/page-jump.ts` 新增 `JUMP_TRANSITION_MS = 400`、`jumpProgress()`、`scrollWithTransition()` 与 `cancelJumpScroll()`：用 `requestAnimationFrame` 逐帧写入 `scrollTop`，进度采用缓出三次曲线，固定 400ms 结束，不依赖滚动距离。
- 目标位置先夹在 `[0, scrollHeight - clientHeight]`；起止位置相同或时长非正时直接落位。新的跳转先取消上一段过渡，页面卸载时按滚动容器取消，避免残留动画继续写位置。
- `usePageJump` 的 `scrollToTop()` / `scrollToBottom()` 改调 `scrollWithTransition()`；评论面板的顶部与底部按钮同样接入，跳转到底部在补拉完成后也走 400ms 过渡。
- 歌词自动回中仍使用 `scrollIntoView({ behavior: 'smooth' })`，它跟随播放位置而不是用户跳转，不在本次固定时长范围内。
- 扩展 `test/page-jump.test.ts`：覆盖固定 400ms 进度端点、目标夹紧、过渡结束落位与重复跳转取消上一段。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 第 1 项“跳转到底部/顶部时过渡时间太长” | 改 | 行尾追加 ` [已解决] `。 |
| `USER.html` | §2 CONVENTIONS · 长页面跳转（`#u2`） | 改 | 两个按钮点击后固定 400ms 过渡滚动，不随距离变长。 |
| `USER.html` | §5.2.5 歌词与评论（`#u5-2-5`） | 改 | 评论顶部 / 底部跳转统一固定 400ms，补拉完成后同样过渡。 |
| `USER.html` | §5.2.8 页面结构 · 歌单详情（`#u5-2-8`） | 改 | “点击平滑滚动”改为“点击后固定 400ms 过渡滚动”。 |
| `CORE.html` | §1 文件树 · `utils/page-jump.ts` | 改 | 说明同时承载显隐判定与固定 400ms 过渡。 |
| `CORE.html` | §4.42 `CommentsPanel.vue`（`#c4-42`） | 改 | 顶部 / 底部按钮改调 `scrollWithTransition`，补拉完成后也走 400ms。 |
| `CORE.html` | §4.46 `PlaylistView.vue`（`#c4-46`） | 改 | 歌单详情跳转改为固定 400ms 过渡。 |
| `CORE.html` | §4.95 `page-jump.ts`（composable）（`#c4-95`） | 改 | 点击改调 `scrollWithTransition`，卸载时取消进行中的过渡。 |
| `CORE.html` | §4.96 `utils/page-jump.ts`（`#c4-96`） | 改 | 增加 `JUMP_TRANSITION_MS`、`jumpProgress`、`scrollWithTransition`、`cancelJumpScroll` 签名与夹紧 / 取消规则。 |
| `CORE.html` | §4.97 `PageJump.vue`（`#c4-97`） | 改 | 事件接到固定 400ms 过渡函数，不再称为平滑滚动。 |
| `test/page-jump.test.ts` | — | 增 | 覆盖固定时长进度、目标夹紧、结束落位与重复跳转取消。 |

**工作记录**：

- `ISSUE.md` 第 1 项已标记 `[已解决]`；其余文档落点均已存在，无需改动。
- 其余文档操作已逐项核对，无需改动。

### 3.31 歌曲表操作列在超窄屏回退到 96px [已解决] 

**描述**：歌曲表操作列宽屏为 160px，≤900px 收窄为 40px；但 40px 放不下 11px 的“操作”表头，表头会换成两行。同时 `@media (max-width: 560px)` 里还留着旧的 `.song-table .song-action { width: 96px !important; }`，它特异性更高且带 `!important`，在超窄屏把已经收成一个“…”按钮的操作列重新撑到 96px。另有一条被后续规则覆盖的 `.song-action { width: 128px; }` 死规则。

**解决方案**：

- 删除 `.song-action` 的 `width: 128px`，保留 `text-align: left !important`。
- 删除 `@media (max-width: 560px)` 中 `.song-table .song-action { width: 96px !important; }`。
- 将 `@media (max-width: 900px)` 的 `.song-action` 宽度统一为 44px：11px 字号 + 0.08em 字距的“操作”约 23.77px，加左右各 10px 内边距约 43.77px，44px 是刚好不换行的整数列宽。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.39 `SongTable.vue`（`#c4-39`） | 改 | 操作列宽屏 160px，≤900px 收窄到 44px，注明刚好容纳“操作”表头不换行。 |

**工作记录**：

- `src/renderer/styles/main.css`：删除 `.song-action` 的 `width: 128px` 与 560px 下的 96px `!important` 规则；900px 下的宽度由 40px 改为 44px。
- 用实际字体测量“操作”两字（11px、`letter-spacing: 0.08em`、左右各 10px padding）约 43.77px；44px 时表头保持单行，43px 时换行。
- 保留 `.song-action { text-align: left !important; }`，避免丢失表头对齐。
- `npm run build` 通过（typecheck + electron-vite build）。

## 4. 需求演进记录

按功能条目记录描述、解决方案与当时的文档操作；前三组记录开发中发现的问题，本节记录已推进的需求变更。

### 4.1 播放模式切换按钮默认外观 [已解决] 

**描述**：调整播放模式切换按钮外观：未 hover 时不高亮按钮，使用透明背景与 muted 色图标；hover 时保留原有 accent 软填充反馈，按钮尺寸、图标、弹层与交互逻辑均不变。

**解决方案**：

- 修改 `src/renderer/styles/main.css` 的 `.mode-button`：`color` 从 `--accent-strong` 改为 `--muted`，`background` 从 `--accent-soft` 改为 `transparent`。
- 保留 `.mode-button:hover` 现有的 `color-mix(...)` 背景与过渡，不改动按钮尺寸、圆角、图标映射、revealer 弹层和触屏手势。
- 同步更新 `USER.html` / `CORE.html` / `ABOUT.html` / `README.md` 中“按钮常驻 accent 高亮”的表述，使文档与当前视觉状态一致。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 1 项“调整播放模式切换按钮外观” | 改 | 行尾追加 ` [已解决]`。 |
| `IMPL.md` | 新增“播放模式切换按钮默认外观” | 增 | 记录需求、实现思路与本次文档操作。 |
| `USER.html` | §5.2.3 播放条（`#u5-2-3`） | 改 | 播放模式按钮由“常驻 accent 软填充与强调色图标”改为“默认透明背景 + muted 图标，悬停时显示 accent 软填充”。 |
| `CORE.html` | §4.40 `PlayerBar.vue`（`#c4-40`） | 改 | `.mode-button` 改为默认透明背景与 `--muted` 图标，悬停时使用 `--accent` 34% 混合背景。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 样式契约同步为默认透明背景 + muted 图标，悬停使用 accent 混合背景。 |
| `ABOUT.html` | 用户交互 · 播放行 | 改 | “当前项由按钮本身高亮”改为“当前项由按钮图标表示”。 |
| `README.md` | §2 用户交互 · 播放行 | 改 | 与 ABOUT 同步，移除默认态高亮表述。 |

**工作记录**：

- `TODO.md` 已替换为新列表，旧条目不再存在，未回加；本条 IMPL 记录与规格落点均已存在。

### 4.2 歌词译文开关与双行展示 [已解决] 

**描述**：实现歌词翻译展示：原文与译文紧贴为上下两行并共享当前行高亮；歌词模块左下角提供译文开关；默认关闭译文。

**解决方案**：

- `useLyrics()` 增加 `hasTranslation`、`translationVisible` 与 `toggleTranslation()`；是否显示译文持久化在 `localStorage` 的 `lychee.lyrics.translation`，只有值为 `on` 时显示，默认关闭。
- `LyricsPanel.vue` 仅在 `hasTranslation` 为真时渲染左下角开关；`translationVisible` 为真时才渲染 `.lyric-trans`，原文与译文仍位于同一 `.lyric-line`，共享活动行状态；切换后重新居中当前行。
- `main.css` 将 `.lyric-trans` 改为紧贴原文（`margin-top: 0`、`line-height: 1.45`），新增 `.lyrics-trans-toggle` / `.lyrics-trans-switch` 的定位、开关与活动态样式。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 2 项“实现歌词翻译功能” | 改 | 行尾追加 ` [已解决]`。 |
| `IMPL.md` | 新增“歌词译文开关与双行展示” | 增 | 记录需求、实现思路与本次文档操作。 |
| `USER.html` | §5.2.5 歌词与评论（`#u5-2-5`） | 改 | 补译文开关、默认关闭、原文 / 译文上下两行共享高亮，以及无译文时不显示开关。 |
| `CORE.html` | §4.34 `composables/lyrics.ts`（`#c4-34`） | 改 | 补 `hasTranslation` / `translationVisible` / `toggleTranslation()` 与本地持久化说明。 |
| `CORE.html` | §4.41 `LyricsPanel.vue`（`#c4-41`） | 改 | 补开关渲染条件、译文显隐与共享活动行高亮。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 补译文按钮定位、开关样式与译文紧贴原文的样式契约。 |
| `CORE.html` | §5.9 歌词与评论（`#c5-9`） | 改 | 补 `toggleTranslation()` 与 `localStorage` 写入调用链。 |
| `README.md` | §2 用户交互 · 歌词 / 评论行 | 改 | 补译文开关默认关闭与双行共享高亮。 |
| `ABOUT.html` | 用户交互 · 歌词 / 评论行 | 改 | 与 README 同步。 |

**工作记录**：

- `TODO.md` 已替换为新列表，旧条目不再存在，未回加；本条 IMPL 记录与规格落点均已存在。

### 4.3 评论发表输入框与按钮 [已解决] 

**描述**：在评论模块底部提供输入框与发表按钮；登录用户可对当前歌曲发表评论，正文上限 300 字；未登录时禁用输入；发表成功后刷新最新评论列表，失败保留草稿并提示。

**解决方案**：

- 在 `shared/constants.ts` 增加 `COMMENT_CONTENT_MAX = 300`，同时用于输入框 `maxlength`、渲染层提交校验与主进程 IPC 参数校验。
- 增加跨进程模型 `CommentPostResult { commentId }` 与 `comment.post` IPC；主进程调用 `music.globalComment.CommentWriteServer / AddComment`，参数为 `{ Content, BizType: 1, BizId: 数字歌曲 ID, BizSubType: 2 }`。
- `postComment()` 要求登录，正文去首尾空白后校验非空与长度；`SubCode === 0` 才成功，`1000` 映射登录失效，`VerifyUrl` 非空映射为需要验证码的 `NO_PERMISSION`，其余非 0 按 `Msg` 返回失败。
- `CommentsPanel` 底部新增固定输入框与发表按钮；未登录禁用，提交中按钮显示 spinner；成功清空草稿、提示并重新 `load()` 最新评论，失败保留草稿并 Toast；切歌清空草稿。
- 评论滚动区底部留白与右下角跳转按钮位置上移，避免被输入框遮挡；不本地插入返回评论，顺序始终以上游最新列表为准。
- 补充 `test/api/comment.test.ts`，覆盖 `AddComment` 请求参数、`AddedCmId` 映射与 `VerifyUrl` 的验证码错误映射。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 3 项“实现发表评论功能” | 改 | 行尾追加 ` [已解决]`。 |
| `IMPL.md` | 新增“评论发表输入框与按钮” | 增 | 记录需求、实现思路与本次文档操作。 |
| `USER.html` | §1 TERMS · 评论（`#u1`） | 改 | 补登录后可在底部输入并发表评论、正文上限 300 字。 |
| `USER.html` | §5.2.5 歌词与评论（`#u5-2-5`） | 改 | 原型增加底部输入框与发表按钮；补未登录禁用、发表中 / 成功 / 失败状态与跳转按钮上移。 |
| `USER.html` | §5.2.8 页面结构 · 歌词 / 评论弹出层（`#u5-2-8`） | 改 | 补“底部发表评论”。 |
| `USER.html` | §5.3 错误处理 · `NO_PERMISSION`（`#u5-3`） | 改 | 补评论验证码提示与草稿保留。 |
| `CORE.html` | §4.1 `src/shared/types.ts`（`#c4-1`） | 改 | 增加 `CommentPostResult` 及 `comment.post` 返回模型说明。 |
| `CORE.html` | §4.2 `src/shared/ipc.ts`（`#c4-2`） | 改 | 增加 `comment.post(songId, content)`。 |
| `CORE.html` | §4.15 `src/main/api/comment.ts`（`#c4-15`） | 改 | 增加 `postComment` 签名与 `AddComment` 参数、登录 / 长度 / `SubCode` / `VerifyUrl` 处理。 |
| `CORE.html` | §4.42 `CommentsPanel.vue`（`#c4-42`） | 改 | 记录底部输入框、发表状态、成功后刷新、失败保留草稿与切歌清空。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 记录 `.comment-composer` / `.comment-input` 样式与跳转按钮、滚动区留白调整。 |
| `CORE.html` | §4.50 `src/shared/constants.ts`（`#c4-50`） | 改 | 增加 `COMMENT_CONTENT_MAX = 300` 及三处校验说明。 |
| `CORE.html` | §5.9 歌词与评论（`#c5-9`） | 改 | 增加 `submitComment` → `comment.post` → `AddComment` 调用分支。 |
| `PROVIDER.html` | §2 CONVENTIONS · 评论发表（`#p2`） | 增 | 新增登录、1–300 字、`SubCode` 与验证码边界约定。 |
| `PROVIDER.html` | §4.1 消费的 HTTP 接口（`#p4-1`） | 改 | 增加评论发表接口行与 `Content` / `BizType` / `BizId` / `BizSubType` 参数。 |
| `PROVIDER.html` | §4.2 消息与错误（`#p4-2`） | 改 | 增加评论发表 `SubCode` 非 0 / `VerifyUrl` 的错误映射。 |
| `PROVIDER.html` | §4.3 数据模型与转换（`#p4-3`） | 改 | 增加 `QqAddCommentResult` 模型、字段说明与 `CommentPostResult` 转换。 |
| `README.md` | §2 用户交互 · 歌词 / 评论行 | 改 | 补评论底部输入框与发表按钮。 |
| `ABOUT.html` | 用户交互 · 歌词 / 评论行 | 改 | 与 README 同步。 |

**工作记录**：

- `TODO.md` 已替换为新列表，旧条目不再存在，未回加；本条 IMPL 记录与规格落点均已存在。
- `TERMS` 相关条目已按“只保留定义”的规则收敛，设计细节由对应章节承载。

### 4.4 歌手页歌曲 / 专辑切换与专辑筛选 [已解决] 

**描述**：歌手页在歌曲浏览之外增加专辑浏览，通过“歌曲 / 专辑”切换；专辑支持最热 / 最新排序，并按上游元信息提供 LP / EP / 单曲 / 现场 / 其他版本筛选，筛选条位于歌曲 / 专辑切换下方；专辑卡片可进入专辑页。

**解决方案**：

- 新增 `ArtistAlbumSort`、`ArtistAlbumKind`、`ArtistAlbum`、`ArtistAlbumPage` 跨 IPC 模型，以及 `CATALOG_PAGE_SIZE = 50`、`ARTIST_ALBUM_PAGE_SIZE = 80`、`ARTIST_ALBUM_PAGE_MAX = 20` 常量。
- 主进程 `getArtistAlbums()` 调用 `music.musichallAlbum.AlbumListServer / GetAlbumList`，`sort` 映射为 `hot → order=1`、`latest → order=0`；读取 `albumMid` / `albumName` / `publishDate` / `albumType`，封面由 `albumMid` 拼接。
- `albumType` 归一化为 `lp`（录音室 / 专辑 / LP）、`ep`（EP）、`single`（Single / 单曲）、`live`（演唱会 / 现场 / Live）和 `other`；筛选只基于该元信息，不根据专辑名猜测。
- 新增 `artist.getAlbums` IPC 与 preload 方法；渲染层切到专辑视图或切换排序时从偏移 0 连续补拉，直到无下一页或达到页数上限，一次渲染完整列表。
- `ArtistView` 顶部增加“歌曲 / 专辑”切换；歌曲视图保留原有滚动分页与排序，专辑视图增加最热 / 最新与版本筛选；切换歌手时重置为歌曲视图并清空专辑缓存。
- 补充 `test/api/catalog.test.ts`，覆盖专辑排序参数、`albumType` 分类映射与分页元信息。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 4 项“歌手页可以在歌曲浏览和专辑之间切换” | 改 | 行尾追加 ` [已解决]`。 |
| `IMPL.md` | 新增“歌手页歌曲 / 专辑切换与专辑筛选” | 增 | 记录需求、实现思路与本次文档操作。 |
| `USER.html` | §1 TERMS · 歌手页 / 专辑页（`#u1`） | 改 | 补歌曲 / 专辑切换与专辑版本筛选能力。 |
| `USER.html` | §5.2.8 页面结构 · 歌手页 / 专辑页（`#u5-2-8`） | 改 | 补歌曲 / 专辑切换、专辑排序、筛选条位置与专辑卡片行为。 |
| `CORE.html` | §4.1 `src/shared/types.ts`（`#c4-1`） | 改 | 增加 `ArtistAlbumSort` / `ArtistAlbumKind` / `ArtistAlbum` / `ArtistAlbumPage`。 |
| `CORE.html` | §4.2 `src/shared/ipc.ts`（`#c4-2`） | 改 | 增加 `artist.getAlbums(mid, offset, sort)`。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 记录顶部切换、专辑排序、筛选 chip 与专辑卡片样式。 |
| `CORE.html` | §4.50 `src/shared/constants.ts`（`#c4-50`） | 改 | 增加 `CATALOG_PAGE_SIZE`、`ARTIST_ALBUM_PAGE_SIZE = 80` 与 `ARTIST_ALBUM_PAGE_MAX = 20`。 |
| `CORE.html` | §4.73 `ArtistView.vue`（`#c4-73`） | 改 | 记录歌曲 / 专辑切换、专辑连续补拉、排序、筛选、空状态与切歌重置。 |
| `CORE.html` | §4.75 `src/main/api/artist.ts`（`#c4-75`） | 改 | 增加 `getArtistAlbums` 签名、`GetAlbumList` 参数与 `albumType` 归一化规则。 |
| `CORE.html` | §5.19 歌手 / 专辑加载（`#c5-19`） | 改 | 增加 `getArtistAlbums` → `GetAlbumList` 的调用分支。 |
| `PROVIDER.html` | §2 CONVENTIONS · 歌手专辑（`#p2`） | 增 | 新增歌手专辑分页、排序与 `albumType` 元信息约定。 |
| `PROVIDER.html` | §4.1 消费的 HTTP 接口（`#p4-1`） | 改 | 增加歌手专辑接口与 `singerMid` / `order` / `begin` / `num` 参数。 |
| `PROVIDER.html` | §4.3 数据模型与转换（`#p4-3`） | 改 | 增加 `QqArtistAlbum` / `QqArtistAlbumData` 模型与 `ArtistAlbumPage` 转换。 |
| `README.md` | §2 用户交互 · 歌手 / 专辑行 | 改 | 补歌手页歌曲 / 专辑切换、专辑排序与版本筛选。 |
| `ABOUT.html` | 用户交互 · 歌手 / 专辑行 | 改 | 与 README 同步。 |

**工作记录**：

- `TODO.md` 已替换为新列表，旧条目不再存在，未回加；本条 IMPL 记录与规格落点均已存在。
- `TERMS` 相关条目已按“只保留定义”的规则收敛，设计细节由对应章节承载。

### 4.5 下载管理：纯本地搜索与已下载歌曲删除确认 [已解决] 

**描述**：强化下载管理：下载中心支持纯本地搜索，只过滤已加载的下载任务而不请求上游；歌单中点击已下载歌曲的下载按钮时先询问是否删除本机下载文件，确认后删除文件与下载记录。

**解决方案**：

- `DownloadTask` 增加 `singers` / `albumName`，在出队解析歌曲信息时回填并随索引持久化；旧索引缺少字段时归一化为空数组 / 空字符串，保证向后兼容。
- 新增 `utils/download-filter.ts` 的 `matchesDownloadKeyword()`，对歌名、`songMid`、歌手、专辑与文件路径做不区分大小写的本地包含匹配；`DownloadsView` 增加搜索框与状态过滤叠加，空结果区分“无匹配”和“无符合过滤条件”。
- 新增 `download.removeSong(songMid)` IPC、preload 与 store 方法；主进程 `removeDownloadedSong()` 删除该曲全部 `done` 任务的音频、`.part` 与下载封面，并落盘索引。
- `PlaylistView` 的下载按钮先读取 `download.assets[mid].downloadedQuality`：已下载时打开危险态 `ConfirmDialog`，确认后调用 `download.removeSong()` 并刷新资产；未下载时保持原入队流程。
- 补充 `test/download-filter.test.ts`，并扩展下载任务与管理器测试，覆盖元信息回填、本地匹配和按歌曲删除文件。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 5 项“强化下载管理” | 改 | 行尾追加 ` [已解决]`。 |
| `IMPL.md` | 新增“下载管理：纯本地搜索与已下载歌曲删除确认” | 增 | 记录需求、实现思路与本次文档操作。 |
| `USER.html` | §1 TERMS · 下载任务 / 下载中心（`#u1`） | 改 | 补下载中心纯本地搜索能力。 |
| `USER.html` | §5.2.4 歌曲列表（`#u5-2-4`） | 改 | 补歌单详情中已下载歌曲的下载按钮改为删除确认。 |
| `USER.html` | §5.2.8 页面结构 · 歌单详情（`#u5-2-8`） | 改 | 补已下载歌曲下载按钮的删除确认行为。 |
| `USER.html` | §5.2.8 页面结构 · 下载中心（`#u5-2-8`） | 改 | 补工具栏下方的纯本地搜索框与过滤叠加规则。 |
| `CORE.html` | §1 文件树（`#c1`） | 改 | 增加 `utils/download-filter.ts` 条目。 |
| `CORE.html` | §4.1 `src/shared/types.ts`（`#c4-1`） | 改 | 增加 `DownloadTask.singers` / `albumName` 及用途说明。 |
| `CORE.html` | §4.2 `src/shared/ipc.ts`（`#c4-2`） | 改 | 增加 `download.removeSong(songMid)`。 |
| `CORE.html` | §4.46 `PlaylistView.vue`（`#c4-46`） | 改 | 补已下载歌曲下载按钮的确认删除分支与资产刷新。 |
| `CORE.html` | §4.60 `src/main/download/manager.ts`（`#c4-60`） | 改 | 增加 `removeDownloadedSong` 签名，补元信息回填、旧索引归一化与删除范围。 |
| `CORE.html` | §4.67 `DownloadsView.vue`（`#c4-67`） | 改 | 补纯本地搜索框、匹配范围、空状态与过滤叠加。 |
| `CORE.html` | §4.71 `stores/download.ts`（`#c4-71`） | 改 | 增加 `removeSong` 签名与本地快照更新说明。 |
| `CORE.html` | §4.83 `src/renderer/utils/download-filter.ts`（`#c4-83`） | 增 | 新增本地搜索匹配函数的签名与约定。 |
| `CORE.html` | §5.16 下载（`#c5-16`） | 改 | 增加歌单中 `downloadAt` → `removeSong` → `removeDownloadedSong` 的调用分支。 |
| `README.md` | §2 用户交互 · 下载 / 整单下载行 | 改 | 补纯本地搜索与已下载歌曲删除确认，并同步当前统一队列语义。 |
| `ABOUT.html` | 用户交互 · 下载 / 整单下载行 | 改 | 与 README 同步。 |

**工作记录**：

- `TODO.md` 已替换为新列表，旧条目不再存在，未回加；本条 IMPL 记录与规格落点均已存在。
- `TERMS` 相关条目已按“只保留定义”的规则收敛，设计细节由对应章节承载。

### 4.6 下载按钮机制抽象与共用 [已解决] 

**描述**：播放条的下载按钮没有跟上“已下载时确认删除”的行为；把下载按钮的判定、入队、删除确认与提示抽成唯一共用机制，供播放条、所有歌曲表页面与后续入口调用，避免再次出现行为漂移。

**解决方案**：

- 新增 `composables/download-action.ts`：`requestDownload()` 统一判断 `downloadedQuality`，已下载时只设置模块级 `pendingDelete`，未下载时调用 `download.start()` 并提示；`confirmDownloadDelete()` 统一调用 `download.removeSong()`，取消只清空状态。
- 新增 `components/DownloadDeleteDialog.vue`，读取共享的 `pendingDelete` 并复用 `ConfirmDialog`；`App.vue` 全局只挂载一次，删除确认不再由各页面分别持有。
- `PlayerBar`、`PlaylistView`、`SearchView`、`ArtistView`、`AlbumView` 的下载入口全部改为调用 `requestDownload()`，移除各自的入队 / 删除判断与页面级确认框。
- 新增 `test/download-action.test.ts`，覆盖已下载确认删除、未下载入队、取消与跨调用方共享状态。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `IMPL.md` | 新增“下载按钮机制抽象与共用” | 增 | 记录需求、实现思路与本次文档操作。 |
| `USER.html` | §5.2.3 播放条（`#u5-2-3`） | 改 | 补已下载时点击下载按钮弹出删除确认，并说明与歌曲表共用同一机制。 |
| `USER.html` | §5.2.4 歌曲列表（`#u5-2-4`） | 改 | 将删除确认从“仅歌单详情”改为所有歌曲表与播放条共用。 |
| `USER.html` | §5.2.8 页面结构 · 歌单详情（`#u5-2-8`） | 改 | 补该行为与其他下载入口共用。 |
| `CORE.html` | §1 文件树（`#c1`） | 改 | 增加 `composables/download-action.ts` 与 `components/DownloadDeleteDialog.vue`。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） | 改 | 记录全局唯一删除下载确认框及其共享状态来源。 |
| `CORE.html` | §4.40 `PlayerBar.vue`（`#c4-40`） | 改 | 下载按钮改为调用 `useDownloadAction` 的 `requestDownload`。 |
| `CORE.html` | §4.44 `SearchView.vue`（`#c4-44`） | 改 | 下载入口统一走 `requestDownload`。 |
| `CORE.html` | §4.46 `PlaylistView.vue`（`#c4-46`） | 改 | 移除页面级删除确认，统一走 `requestDownload` 与全局确认框。 |
| `CORE.html` | §4.73 `ArtistView.vue`（`#c4-73`） | 改 | 下载入口统一走 `requestDownload`。 |
| `CORE.html` | §4.74 `AlbumView.vue`（`#c4-74`） | 改 | 下载入口统一走 `requestDownload`。 |
| `CORE.html` | §4.84 `composables/download-action.ts`（`#c4-84`） | 增 | 新增共用下载行为、模块级确认状态与函数签名。 |
| `CORE.html` | §4.85 `components/DownloadDeleteDialog.vue`（`#c4-85`） | 增 | 新增全局删除下载确认组件说明。 |
| `CORE.html` | §5.16 下载（`#c5-16`） | 改 | 调用链改为 `SongTable` / `PlayerBar` → `requestDownload` → 入队或删除分支。 |
| `README.md` | §2 用户交互 · 下载行 | 改 | 删除确认入口从歌单扩展到任意歌曲表与播放条。 |
| `ABOUT.html` | 用户交互 · 下载行 | 改 | 与 README 同步。 |

**工作记录**：

- 逐项核对目标文档落点，均已存在，无需改动。

### 4.7 应用标题跟随当前歌曲 [已解决] 

**描述**：应用窗口 / 任务栏标题显示当前正在播放的歌曲与歌手，切歌时即时更新；没有当前歌曲时回退为应用名，页面导航不改变标题。

**解决方案**：

- 在 `utils/format.ts` 增加 `appTitle(song)`：有歌曲时返回 `歌名 - 歌手 · Lychee Player`，歌手为空时省略歌手段；传入 `null` 时返回 `Lychee Player`。应用名常量只在该文件维护。
- `App.vue` 增加对 `player.current` 的 `watch(..., { immediate: true })`，把 `appTitle(current)` 写入 `document.title`；Electron 默认将页面标题同步到窗口与任务栏。
- 复用现有 `singerNames()` 处理空歌手名与多歌手分隔，不新增 IPC 或主进程窗口标题逻辑。
- 扩展 `test/format.test.ts`，覆盖无歌曲回退、歌名 + 歌手与空歌手三种标题。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 6 项“应用标题显示当前在播放的歌曲” | 改 | 行尾追加 ` [已解决]`。 |
| `IMPL.md` | 新增“应用标题跟随当前歌曲” | 增 | 记录需求、实现思路与本次文档操作。 |
| `USER.html` | §5.2.1 窗口与布局（`#u5-2-1`） | 改 | 增加“窗口标题”契约：歌曲 / 歌手格式、无歌曲回退与切歌即时更新。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） | 改 | 补 `player.current` 监听与 `document.title` 同步说明。 |
| `CORE.html` | §4.32 `utils/format.ts`（`#c4-32`） | 改 | 增加 `appTitle(song)` 签名与标题格式、回退规则。 |
| `README.md` | §2 用户交互 · 窗口标题行 | 增 | 增加窗口 / 任务栏标题跟随当前歌曲的能力说明。 |
| `ABOUT.html` | 用户交互 · 窗口标题行 | 增 | 与 README 同步。 |

**工作记录**：

- `TODO.md` 已替换为新列表，旧条目不再存在，未回加；本条 IMPL 记录与规格落点均已存在。

### 4.8 播放历史 [已解决] 

**描述**：在导航条“浏览”组的最后增加播放历史入口，记录最近播放的 1000 首歌曲；歌曲开始播放即入队，页面提供搜索框过滤，并优先使用官方 API、没有可用官方 API 时改用本地持久化缓存。

**解决方案**：

- 播放历史放在渲染进程：QQ 音乐开放平台的最近播放接口仅面向企业合作方，客户端 SDK 的播放上报也标明仅供内部使用，均无法作为个人桌面客户端可依赖的写入契约；因此按账号持久化到 `localStorage` 的 `lychee:play-history:<musicid|anonymous>`，未登录使用独立的匿名作用域。
- `shared/constants.ts` 增加 `PLAY_HISTORY_LIMIT = 1000` 与 `PLAY_HISTORY_STORAGE_PREFIX`；原有 `PLAY_HISTORY_MAX = 100` 继续只服务“上一首”回退的会话历史，两套数据互不影响。
- 新增 `stores/history.ts`：`load()` 读取当前账号记录并丢弃损坏条目，`record(song)` 在歌曲实际开始播放后按 `songMid` 去重、移回顶部并截断到 1000 条，`clear()` 清空内存与当前账号的 key。
- `player.loadAndPlay()` 在取流成功、引擎开始播放且 token 仍有效后调用 `history.record(song)`；取流失败、加载被新请求取代、暂停后继续与同一首重载音质都不重复写入。
- `App.vue` 在启动恢复登录态后调用 `history.load()`，并监听 `auth.musicid` 在登录 / 退出 / 切换账号时重新加载对应作用域；侧栏“浏览”组在最近歌单子条目之后增加 `/history` 入口与 `history` 图标。
- 新增 `views/HistoryView.vue`：页头提供记录数、“播放全部”与需要确认的“清空历史”，搜索框按歌名 / 歌手 / 专辑做本地匹配；列表复用 `SongTable`，支持播放、下一首播放、收藏与共用下载入口，并区分无历史与无匹配两类空状态。
- 新增 `test/history-store.test.ts` 覆盖去重置顶、1000 条上限、账号隔离、损坏数据与清空；扩展 `test/player-store.test.ts` 覆盖成功播放后写入、无播放链接时不写入。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 1 项“实现播放历史功能” | 改 | 行尾追加 ` [已解决]`。 |
| `IMPL.md` | 新增“播放历史” | 增 | 记录需求、实现思路与本次文档操作。 |
| `USER.html` | §1 TERMS · 播放历史 | 增 | 增加播放历史定义：按账号本机保存、最多 1000 首、开始播放即写入并去重置顶、本地搜索、不同步云端。 |
| `USER.html` | §5.2.1 窗口与布局（`#u5-2-1`） | 改 | 路由说明补充播放历史页面。 |
| `USER.html` | §5.2.2 侧栏与导航（`#u5-2-2`） | 改 | 两个侧栏原型与笔记补充“播放历史”为浏览组最后一项、`/history` 路由与点击行为。 |
| `USER.html` | §3.4 页面 / URL 架构图（`#u3-4`） | 改 | 路由说明补充播放历史为 `/history` 完整页面；架构图增加历史节点。 |
| `diagram/page-url-architecture.puml` / `.svg` | 页面与 URL 跳转关系图 | 改 | 增加“播放历史 `/history`”节点、歌手 / 专辑跳转边与侧栏全局入口注记，并重新导出 SVG。 |
| `USER.html` | §5.2.8 页面结构 · 播放历史（`#u5-2-8`） | 增 | 补页面结构、写入与上限、账号隔离、本地搜索、播放全部、清空确认与空状态。 |
| `CORE.html` | §1 文件树（`#c1`） | 改 | 增加 `stores/history.ts`、`views/HistoryView.vue` 与 `test/history-store.test.ts`。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） | 改 | 补侧栏播放历史入口、启动加载与账号切换监听。 |
| `CORE.html` | §4.25 `router/index.ts`（`#c4-25`） | 改 | 路由说明补充 `/downloads` 与 `/history`。 |
| `CORE.html` | §4.29 `stores/player.ts`（`#c4-29`） | 改 | 说明用户可见历史与会话历史的区别，以及 `loadAndPlay()` 成功后的写入时机。 |
| `CORE.html` | §4.50 `src/shared/constants.ts`（`#c4-50`） | 改 | 增加 `PLAY_HISTORY_LIMIT = 1000` / `PLAY_HISTORY_STORAGE_PREFIX` 并说明与 `PLAY_HISTORY_MAX` 的分工。 |
| `CORE.html` | §4.86 `stores/history.ts`（`#c4-86`） | 增 | 新增历史 store 的签名、去重上限、账号作用域、损坏数据与清空行为。 |
| `CORE.html` | §4.87 `views/HistoryView.vue`（`#c4-87`） | 增 | 新增播放历史页的结构、本地搜索、播放全部与清空确认。 |
| `CORE.html` | §5.21 播放历史写入与展示（`#c5-21`） | 增 | 增加 `loadAndPlay` → `history.record` → `localStorage` 与页面加载 / 过滤 / 播放调用链。 |
| `PROVIDER.html` | §2 CONVENTIONS · 播放历史（`#p2`） | 增 | 说明不接入官方云端最近播放接口的理由与本机持久化边界。 |
| `README.md` | §2 用户交互 · 播放历史行 | 增 | 增加侧栏入口、本机 1000 首、搜索 / 播放全部 / 清空能力说明。 |
| `ABOUT.html` | 用户交互 · 播放历史行 | 增 | 与 README 同步。 |

**工作记录**：

- `TODO.md` 已替换为新列表，旧条目不再存在，未回加；本条 IMPL 记录与规格落点均已存在。
- `TERMS` 相关条目已按“只保留定义”的规则收敛，设计细节由对应章节承载。

### 4.9 窄屏歌词 / 评论左右滑动分页 [已解决] 

**描述**：优化窄屏歌词 / 评论页，把原来的上下堆叠改为左右滑动切换，并在歌词 / 评论区域底部用一排两个横置胶囊形状的指示点标识当前页。

**解决方案**：

- 在 `LyricsOverlay.vue` 增加 `activePage: 'lyrics' | 'comments'`，默认歌词；用 `matchMedia('(max-width: 900px)')` 驱动 `narrow`，桌面宽屏仍同时显示左右两列，只有窄屏启用分页。
- 把原来的主题内容包进 `.lyrics-page-track`：宽屏保持三列 grid（歌词 / 分隔线 / 评论）；≤900px 改为横向 flex 轨道，两个面板各占轨道 100%，通过 `translateX(calc(-100% + dragOffset))` 在两页之间平移。
- 横向拖动支持触屏、鼠标与触控笔：忽略输入框、链接、非歌词行按钮等交互目标；歌词行本身是用于点击 seek 的 button，但允许作为分页起点。新增 `utils/swipe.ts` 的 `resolveSwipeIntent()` 做方向仲裁——纵向先超过 10px 且不弱于横向时放弃切页，交给原生滚动或歌词纵向拖拽；横向超过 10px 且明确占优时锁定横向并捕获指针，此后只按横向位移计算，完全忽略纵向位移。松手位移超过 `max(40, min(100, 宽度 × 0.15))` 才切页；边缘拖动带阻尼，拖动时关闭 CSS 过渡。
- 拖动结束用 `SWIPE_CLICK_SUPPRESS_MS = 350` 的时间窗抑制紧随 click：叠加层在轨道捕获 click，歌词面板在 `seekLine()` 入口检查同一窗口，避免延迟合成的 click 绕过冒泡拦截而触发歌词定位或链接。`LyricsPanel` 同时记录所有指针类型的起点，在窗口级 `pointerup` 判断是否发生横向拖动。
- `LyricsPanel` 的纵向拖拽同步改为“纵向位移超过 6px 且明确大于横向”才启动，避免与叠加层的横向分页抢手势；新增 `test/swipe.test.ts` 覆盖等待、横向锁定、纵向优先、对角线与自定义阈值。
- 底部新增 `.lyrics-page-dots`：两个横向胶囊按钮（28×6，外层 30×20 点击区），当前页用 `--accent` 高亮，其余用 `--border-strong`；点击直接切换，带 `role="tablist"` / `role="tab"` 与 `aria-selected`，`prefers-reduced-motion` 时关闭页面过渡。
- 切页只改变显示页，不卸载歌词 / 评论面板，不重置滚动位置，也不触发新的歌词或评论请求；非当前页设置 `inert` / `aria-hidden` 避免键盘与读屏访问屏幕外内容。桌面布局、歌词拖拽 / 定位与评论输入行为保持不变。
- 手势重叠采用“弹出层打开期间独占横向手势”的最小改动方案：`App.vue` 的 `onPointerDown` / `onPointerUp` 在 `ui.lyricsOpen` 时提前返回并清空侧栏拖拽起点，分页因此可以覆盖整个内容区，不需要额外维护 25% / 75% 分区；左边缘 revealer 是按钮，点击仍可打开侧栏。相比只在歌词 / 评论页划分左右触发区或全局收窄侧栏唤起区，该方案只增加两处判断，行为边界也最清晰。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 2 项“优化窄屏歌词/评论页” | 改 | 行尾追加 ` [已解决]`。 |
| `IMPL.md` | 新增“窄屏歌词 / 评论左右滑动分页” | 增 | 记录需求、实现思路与本次文档操作。 |
| `USER.html` | §1 TERMS · 歌词 / 评论分页（窄屏） | 增 | 定义 ≤900px 的两页切换、默认页、滑动与胶囊指示点。 |
| `USER.html` | §5.2.1 窗口与布局（`#u5-2-1`） | 改 | 侧栏手势与响应式断点补充：歌词 / 评论打开时横向手势由分页独占；560px 保持分页方式。 |
| `USER.html` | §5.2.2 侧栏与导航（`#u5-2-2`） | 改 | 窄屏抽屉手势增加例外：歌词 / 评论打开时不响应侧栏拖拽，左边缘 revealer 点击仍保留。 |
| `USER.html` | §5.2.5 歌词与评论（`#u5-2-5`） | 改 | 补窄屏单页显示、触屏 / 鼠标 / 触控笔横向拖动、歌词行上拖动不触发 seek、纵向优先仲裁、分页独占横向手势、指示点样式与点击切换，以及切换不中断加载 / 滚动。 |
| `USER.html` | §5.2.8 页面结构 · 歌词 / 评论弹出层（`#u5-2-8`） | 改 | 同步宽屏左右两列与窄屏分页、底部胶囊指示点。 |
| `CORE.html` | §1 文件树（`#c1`） | 改 | 增加 `utils/swipe.ts` 与 `test/swipe.test.ts`。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） | 改 | 窄屏侧栏拖拽在 `ui.lyricsOpen` 时提前返回并清空起点，横向手势交给分页独占。 |
| `CORE.html` | §4.41 `LyricsPanel.vue`（`#c4-41`） | 改 | 纵向拖拽增加“纵向位移明确大于横向”条件，避免与分页横向拖动抢手势；横向拖动后在同一 click 抑制窗口内跳过 seek。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 记录 `.lyrics-page-track` 的 grid / flex 切换、平移与 `touch-action`、胶囊指示点尺寸与配色、reduced-motion 处理。 |
| `CORE.html` | §4.72 `LyricsOverlay.vue`（`#c4-72`） | 改 | 增加 `activePage`、窄屏 matchMedia、轨道平移、多指针横向拖动与纵向优先仲裁、歌词行作为拖动起点、click 抑制时间窗、分页独占横向手势、指示点与无障碍状态。 |
| `CORE.html` | §4.88 `utils/swipe.ts`（`#c4-88`） | 增 | 新增方向仲裁函数签名、`pending` / `horizontal` / `vertical` 语义与 click 抑制时间窗常量。 |
| `CORE.html` | §5.9 歌词与评论（`#c5-9`） | 改 | 说明窄屏滑动只切换显示页，不卸载面板、不重置滚动、不触发新请求；弹出层打开时侧栏拖拽跳过。 |
| `README.md` | §2 用户交互 · 歌词 / 评论行 | 改 | 补窄屏左右滑动分页（触屏 / 鼠标 / 触控笔）、单页显示与两个胶囊指示点，并同步弹出层入口表述。 |
| `ABOUT.html` | 用户交互 · 歌词 / 评论行 | 改 | 与 README 同步。 |

**工作记录**：

- `TODO.md` 已替换为新列表，旧条目不再存在，未回加；本条 IMPL 记录与规格落点均已存在。
- `TERMS` 相关条目已按“只保留定义”的规则收敛，设计细节由对应章节承载。

### 4.10 歌单卡片悬停播放 [已解决] 

**描述**：所有歌单卡片在悬停时显示居中的播放按钮，点击后直接播放整个歌单，无需先进入歌单详情；猜你喜欢伪歌单则直接启动连续推荐队列。

**解决方案**：

- 新增 `components/CardPlayButton.vue`：封面中心的圆形播放按钮，支持 `loading` 与自定义文案，点击 / keydown 阻止冒泡；加载中显示 spinner 并禁用，避免重复触发。
- 新增 `composables/playlist-play.ts`：`playPlaylist()` 优先读取整份缓存，命中则立即用缓存歌曲起播；缓存缺失时读取第一页，避免等待完整快照。起播后先用已读取的歌曲调用 `appendPlaylistQueue()` 补齐待播队列，再调用 `playlist.beginQueueBuild()`，并在后台 `playlist.load(id)`，由既有队列构建流程去重并替换为整单队列。`playingId` 为模块级单例，同一时间只允许一个歌单进入加载流程。
- “我的歌单”、搜索结果歌单卡片、发现页每日推荐卡片统一接入该入口；猜你喜欢卡片直接调用 `startRadioQueue(section.songs)`，不读取歌单接口。搜索页与发现页的卡片外层由 `button` 改为 `div[role="button"]`，避免嵌套按钮并保留整卡跳转。
- `styles/main.css` 新增 `.card-cover-wrap` 定位，`.card-play` 改为封面中心 44px 圆形按钮：默认透明且 `pointer-events: none`，卡片 `:hover` / `:focus-within` 时显示；触摸设备首次点击仍只触发整卡行为。
- 新增 `test/playlist-play.test.ts`，覆盖缓存优先、无缓存回退第一页与空歌单不入队。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 3 项“所有歌单悬停中心播放按钮” | 改 | 行尾追加 ` [已解决]`。 |
| `IMPL.md` | 新增“歌单卡片悬停播放” | 增 | 记录需求、实现思路与本次文档操作。 |
| `USER.html` | §1 TERMS · 歌单卡片播放 | 增 | 定义悬停中心按钮、直接播放整单、缓存 / 第一页起播与猜你喜欢差异。 |
| `USER.html` | §5.2.8 页面结构 · 搜索（`#u5-2-8`） | 改 | 歌单结果卡片悬停显示中心播放按钮，点击播放整单，其余区域进入详情。 |
| `USER.html` | §5.2.8 页面结构 · 我的歌单（`#u5-2-8`） | 改 | 歌单卡片悬停显示中心播放按钮，直接播放整单。 |
| `USER.html` | §5.2.8 页面结构 · 发现（`#u5-2-8`） | 改 | 两张首行卡片均显示播放按钮；每日推荐播放整单，猜你喜欢启动连续队列。 |
| `CORE.html` | §1 文件树（`#c1`） | 改 | 增加 `CardPlayButton.vue`、`playlist-play.ts` 与 `playlist-play.test.ts`。 |
| `CORE.html` | §4.44 `SearchView.vue`（`#c4-44`） | 改 | 歌单结果卡片改为 `div[role="button"]` 并接入共用播放按钮。 |
| `CORE.html` | §4.45 `LibraryView.vue`（`#c4-45`） | 改 | 我的歌单卡片接入共用播放按钮与加载态。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 记录 `.card-cover-wrap` 与 `.card-play` 的居中、悬停 / 聚焦显示、触摸点击穿透与 spinner 样式。 |
| `CORE.html` | §4.68 `DiscoverView.vue`（`#c4-68`） | 改 | 首行两张卡片接入播放按钮；每日推荐播放整单，猜你喜欢启动连续队列。 |
| `CORE.html` | §4.89 `CardPlayButton.vue`（`#c4-89`） | 增 | 新增居中播放按钮的 props / emits、阻止冒泡与加载禁用行为。 |
| `CORE.html` | §4.90 `playlist-play.ts`（`#c4-90`） | 增 | 新增缓存 / 首页起播、队列构建、后台完整快照与共享 `playingId` 说明。 |
| `CORE.html` | §5.22 歌单卡片直接播放（`#c5-22`） | 增 | 增加 `CardPlayButton` → `playPlaylist` → 缓存 / 首页 → `startPlaylistPlayback` → `load` 调用链。 |
| `README.md` | §2 用户交互 · 歌单卡片播放行 | 增 | 增加悬停中心播放、整单直接播放与猜你喜欢差异说明。 |
| `ABOUT.html` | 用户交互 · 歌单卡片播放行 | 增 | 与 README 同步。 |

**工作记录**：

- `TODO.md` 已替换为新列表，旧条目不再存在，未回加；本条 IMPL 记录与规格落点均已存在。
- `TERMS` 相关条目已按“只保留定义”的规则收敛，设计细节由对应章节承载。

### 4.11 微信扫码登录入口 [已解决] 

**描述**：登录页顶部提供 xlogin 与微信扫码切换；微信接入官方网页扫码链路，登录成功后与 QQ 共用同一份凭证模型并保留续期字段；凭证显式记录登录方式，v1 凭证读取时直接清空；微信登录与续期在真实账号验证前标注未验证。

**解决方案**：

- 登录方式提升为 `LoginMethod = 'qq' | 'wechat'` 并写入 `Credential.method`；QQ 与微信共用 `musicid`、`musickey`、`expiredAtMs`、`webCookies`，微信额外保存 `refreshToken`、`accessToken`、`openid`、`unionid`、`refreshKey`。`tmeLoginType` 由 method 派生（QQ=2，微信=1）。
- 凭证存储升级为 v2；读取 v1 时不再迁移，直接清空并要求用户重新登录。清空逻辑属于 v1 读取链路，不进入重新登录弹层。
- `web-login.ts` 引入按方式分流的登录运行上下文：QQ 使用 `lychee-xlogin` 与 OAuth code / Cookie 换证；微信使用 `lychee-wechat-login`，加载 `open.weixin.qq.com/connect/qrconnect`，从 `wx_redirect.html?login_type=2` 捕获 code，调用 `music.login.LoginServer/Login`（`tmeLoginType=1`、`strAppid` + code）换证。
- 微信成功后把捕获到的网页 Cookie 与凭证字段合并为 `webCookies`（补齐 `uin` / `wxuin`、`qqmusic_key` / `qm_keyst`、`login_type=2`、`wxopenid` / `wxunionid`、`wxrefresh_token` / `wxaccess_token`）；若官方页已写入 Cookie，则保留 Cookie 兜底解析。
- 同一时间只保留一个登录运行；切换方式或离开登录页会取消旧流程、清理旧分区并摘除旧视图，旧 Promise 的拒绝由渲染层按序号忽略。`openWebLogin(method)` 贯通 IPC / preload / auth store，`AuthStatus` 增加 `method`。
- 续期按 `Credential.method` 分流：微信只走 `music.login.LoginServer/Login` 的 `loginMode=2`；QQ 保持 QQLogin 主路径与既有 refresh_token 回退。本轮不改变续期状态机与全局重新登录 UI。
- 新增微信换证与 v1 凭证清空单测；微信真实扫码、收藏写入与续期尚未验收，文档按未验证记录。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 1 项“实现微信登录入口” | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“微信扫码登录入口” | 增 | 记录需求、实现思路与本次文档操作。 |
| `PROVIDER.html` | §1 TERMS · 登录凭证 / 登录方式 / 微信扫码 | 改 | 凭证改为两种扫码方式共用；新增 `LoginMethod` 与微信扫码定义。 |
| `PROVIDER.html` | §3.1 QQ 扫码登录协议（`#p3-1`） | 改 | 标明 `method=qq`，补充微信入口链接。 |
| `PROVIDER.html` | §3.1.1 微信扫码登录协议（`#p3-1-1`） | 增 | 增加微信二维码、回调 code、换证、Cookie 合并、续期与未验证说明。 |
| `PROVIDER.html` | §4.1 上游方法 / 参数 / 请求画像（`#p4-1`） | 改 | 增加微信换证、微信续期、微信二维码与请求画像；回退续期改称微信续期。 |
| `PROVIDER.html` | §4.3 数据模型与转换（`#p4-3`） | 改 | `Credential` 增加 `method`、移除 `loginType`；`QqLoginPayload` 增加 `expired_at` 与微信字段说明。 |
| `CORE.html` | §1 文件树（`#c1`） | 改 | 增加微信换证 / v1 凭证清空测试。 |
| `CORE.html` | §4.1 `src/shared/types.ts`（`#c4-1`） | 改 | 增加 `LoginMethod`、`Credential.method`、`AuthStatus.method`。 |
| `CORE.html` | §4.2 `src/shared/ipc.ts`（`#c4-2`） | 改 | `login.openWebLogin(method)`。 |
| `CORE.html` | §4.5 `src/main/ipc.ts`（`#c4-5`） | 改 | 说明登录方式参数校验与 `AuthStatus.method`。 |
| `CORE.html` | §4.7 `src/main/credential.ts`（`#c4-7`） | 改 | 记录 v2 存储、v1 清空与微信字段保留。 |
| `CORE.html` | §4.16 `src/main/api/login.ts`（`#c4-16`） | 改 | 增加 `exchangeWechatLoginCode`、微信续期与按 method 分流。 |
| `CORE.html` | §4.17 `src/main/api/web-login.ts`（`#c4-17`） | 改 | 增加按方式分区、登录运行取消、微信 code 捕获与 Cookie 合并。 |
| `CORE.html` | §4.28 `src/renderer/stores/auth.ts`（`#c4-28`） | 改 | 增加 `method` 与 `openWebLogin(method)`。 |
| `CORE.html` | §4.47 `src/renderer/views/LoginView.vue`（`#c4-47`） | 改 | 增加顶部方式切换、切换取消与微信占位区。 |
| `CORE.html` | §4.49 `src/renderer/styles/main.css`（`#c4-49`） | 改 | 增加方式切换胶囊、微信二维码占位区样式。 |
| `CORE.html` | §4.50 `src/shared/constants.ts`（`#c4-50`） | 改 | 增加微信分区、appid、回调地址常量。 |
| `CORE.html` | §5.3 扫码登录（`#c5-3`） | 改 | 调用树改为按方式创建视图 / 取消旧流程，并新增微信分支。 |
| `CORE.html` | §5.3.1 微信扫码登录（`#c5-3-1`） | 增 | 增加微信二维码、code 捕获、换证、Cookie 合并与未验证说明。 |
| `CORE.html` | §5.7 会话续期（`#c5-7`） | 改 | 续期分支改为按 `Credential.method` 分流。 |
| `USER.html` | §1 TERMS · 登录方式 | 增 | 定义 QQ / 微信扫码方式。 |
| `USER.html` | §2 登录凭证边界 | 改 | QQ / 微信扫码均保存 `webCookies`。 |
| `USER.html` | §3.2 登录（`#u3-2`） | 改 | 补充顶部方式切换、微信扫码与未验证状态。 |
| `USER.html` | §5.2.6 登录页（`#u5-2-6`） | 改 | 原型增加方式切换与微信二维码占位；补切换、失败与登录方式展示。 |
| `USER.html` | §5.2.7 设置页（`#u5-2-7`） | 改 | 账号区展示登录方式；续期表述改为 QQ / 微信扫码凭证。 |
| `README.md` | §2 用户交互 · 登录行 | 改 | 补充 xlogin / 微信扫码切换与未验证状态。 |
| `ABOUT.html` | 用户交互 · 登录行 | 改 | 与 README 同步。 |
| `diagram/general-architecture.puml` | 登录组件与授权 | 改 | 登录组件标注增加微信扫码。 |
| `diagram/seq-login.puml` | 登录流程 | 改 | 增加微信扫码分支。 |
| `diagram/prov-login-wechat.puml` | 微信扫码协议 | 增 | 新增微信二维码、回调 code 与换证时序图。 |

**工作记录**：

- `TODO.md` 已替换为新列表，旧条目不再存在，未回加；本条 IMPL 记录与规格落点均已存在。
- `TERMS` 相关条目已按“只保留定义”的规则收敛，设计细节由对应章节承载。

### 4.12 旧版凭证清空与全局重新登录弹层 [已解决] 

**描述**：v1 凭证不再迁移，读取时直接清空并要求用户重新登录；同时先落地全局重新登录弹层，供本次 v1 清空与后续续期 auth-failed 共用，但清空凭证只在 v1 读取链路中执行，不进入弹层逻辑。

**解决方案**：

- `credential.ts` 只接受 v2；读到 `version: 1` 时不解密、不迁移，直接删除凭证文件、清空内存缓存并记录 `reauthReason = 'v1'`，随后按未登录继续启动。
- 新增 `ReauthReason = 'v1' | 'auth-failed'` 与 `AuthStatus.reauthReason`；主进程通过 `getReauthReason()` 暴露原因，登录成功保存新凭证时清除。
- 新增全局 `components/ReauthDialog.vue`：只负责展示标题 / 说明与“重新登录 / 稍后”，不读取、写入或清空凭证；`App.vue` 挂载该弹层，已在登录页时不重复显示。
- `stores/auth.ts` 保存 `reauthReason` 与本次已忽略的原因；选择“稍后”只关闭本次提示，登录成功、退出或原因消失时清除；后续 auth-failed 触发只改变 reason，复用同一弹层。
- 点击“重新登录”时由 `App.vue` 关闭弹层并路由到 `/login`；凭证清理仍由触发方负责，后续续期状态机不应调用弹层来清空凭证。
- 新增 `test/credential-store.test.ts`，覆盖 v1 直接删除、未解密、不触发普通缺省凭证的重新登录提示，以及缺失文件不误报。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 1 项子项“全局重新登录弹层” | 增 | 增加 v1 清空触发与弹层职责边界，并标记 `[已解决]`。 |
| `IMPL.md` | 新增“旧版凭证清空与全局重新登录弹层” | 增 | 记录需求、实现思路与本次文档操作。 |
| `PROVIDER.html` | §2 CONVENTIONS · 凭证版本 | 增 | 明确只接受 v2；v1 直接清空，迁移不属于登录协议或弹层。 |
| `PROVIDER.html` | §4.3 数据模型与转换（`#p4-3`） | 改 | `loginType` 仅存在于已废弃 v1，当前版本不读取。 |
| `CORE.html` | §1 文件树（`#c1`） | 改 | 移除 `credential-migration.ts`；增加 `ReauthDialog.vue` 与 `credential-store.test.ts`。 |
| `CORE.html` | §4.1 `src/shared/types.ts`（`#c4-1`） | 改 | 增加 `ReauthReason` 与 `AuthStatus.reauthReason`。 |
| `CORE.html` | §4.5 `src/main/ipc.ts`（`#c4-5`） | 改 | `currentAuthStatus` 读取 `reauthReason`，不在 IPC 内清空凭证。 |
| `CORE.html` | §4.7 `src/main/credential.ts`（`#c4-7`） | 改 | 只接受 v2；v1 直接删除并记录原因；新增 `getReauthReason()`。 |
| `CORE.html` | §4.23 `src/renderer/App.vue`（`#c4-23`） | 改 | 全局挂载 `ReauthDialog`，登录页不重复显示。 |
| `CORE.html` | §4.28 `src/renderer/stores/auth.ts`（`#c4-28`） | 改 | 增加 `reauthReason`、`dismissReauth()` 与“稍后”状态。 |
| `CORE.html` | §4.91 `ReauthDialog.vue`（`#c4-91`） | 增 | 新增全局重新登录弹层的 props / emits 与职责边界。 |
| `CORE.html` | §5.1 启动（`#c5-1`） | 改 | 补充 v1 凭证清空与全局弹层触发。 |
| `USER.html` | §3.2 登录（`#u3-2`） | 改 | 补充旧版本凭证清除与全局重新登录界面。 |
| `USER.html` | §5.2.6 登录页（`#u5-2-6`） | 改 | 补充弹层在任意页面出现、登录页不重复显示。 |
| `USER.html` | §5.3 错误与通知（`#u5-3`） | 改 | 补充重新登录弹层不使用 Toast，v1 与 auth-failed 共用弹层但触发逻辑分离。 |

**工作记录**：

- `TODO.md` 已替换为新列表，旧条目不再存在，未回加；本条 IMPL 记录与规格落点均已存在。

### 4.13 删除手动 Cookie 登录入口 [已解决] 

**描述**：移除用户粘贴 Cookie 的登录入口及配套链路；扫码成功后抓取的网页会话继续保留用于收藏写入；登录页收敛为“顶部切换 + 单个扫码区”，并顺带消除 Cookie 折叠面板造成的嵌入区偏移 / 重叠。

**解决方案**：

- `LoginView.vue` 删除 Cookie 输入区、提交函数、提交状态与相关引用；登录页只保留顶部 xlogin / 微信扫码切换、单个扫码占位区与失败重载按钮。
- 删除 `loginWithCookie` 的 IPC 通道、preload 方法、auth store action 与主进程公开入口；同时删除仅供手动 Cookie 使用的 `parseCookieString` / `probeCredential`。
- `webCookies` 与 `requestOAuthCodeWithCookies` 保留：前者是 QQ / 微信扫码后的网页会话，后者是 QQ 扫码换证步骤；收藏签名链路不变。
- 删除 `.cookie-box` 与文档样式 `.u-cookie`；登录页布局改为顶部切换 + 单个嵌入区，Cookie 面板消失后不再出现垂直居中位移导致的嵌入区偏移 / 重叠。
- 侧栏未登录文案改为“xlogin / 微信扫码”，80105 提示改为“退出后重新扫码登录”；不在手动 Cookie 路径上保留任何用户入口或错误文案。
- 文档删除 Cookie 登录协议与 `prov-cookie` 图，播放链接协议 / Web 签名协议依次前移；`seq-login` 只保留两种扫码分支。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 2 项“删除手动 Cookie 登录入口” | 改 | 行尾追加 ` [已解决]`。 |
| `IMPL.md` | 新增“删除手动 Cookie 登录入口” | 增 | 记录需求、实现思路与本次文档操作。 |
| `USER.html` | §2 登录凭证边界 | 改 | 只保留 QQ / 微信扫码保存 `webCookies`。 |
| `USER.html` | §3.2 登录（`#u3-2`） | 改 | 删除 Cookie 登录方式与分支链接，只保留两种扫码。 |
| `USER.html` | §5.2.6 登录页（`#u5-2-6`） | 改 | 原型删除 Cookie 折叠入口，页面收敛为顶部切换 + 单个扫码区。 |
| `USER.html` | §5.2.7 设置页（`#u5-2-7`） | 改 | 删除“手动 Cookie 凭证不提供立即续期”的表述。 |
| `USER.html` | §5.3 错误与通知（`#u5-3`） | 改 | 80105 提示改为退出后重新扫码登录。 |
| `CORE.html` | §4.2 `src/shared/ipc.ts`（`#c4-2`） | 改 | 删除 `login.loginWithCookie`。 |
| `CORE.html` | §4.16 `src/main/api/login.ts`（`#c4-16`） | 改 | 删除 `loginWithCookie` / `parseCookieString` / `probeCredential`。 |
| `CORE.html` | §4.28 `src/renderer/stores/auth.ts`（`#c4-28`） | 改 | 删除 `loginWithCookie` action。 |
| `CORE.html` | §4.47 `src/renderer/views/LoginView.vue`（`#c4-47`） | 改 | 登录页只保留扫码方式切换与扫码视图。 |
| `CORE.html` | §5.4 登录态恢复与重新登录提示（`#c5-4`） | 改 | 原 Cookie 登录调用栈替换为登录态恢复 / 重新登录弹层调用栈。 |
| `PROVIDER.html` | §2 CONVENTIONS · 网页会话 Cookie | 改 | 明确不提供手动粘贴 Cookie 登录入口。 |
| `PROVIDER.html` | §3.1 QQ 扫码登录协议（`#p3-1`） | 改 | 删除 Cookie 登录链接。 |
| `PROVIDER.html` | §3.2 Cookie 登录协议 | 删 | 整节删除，原播放链接协议前移为 §3.2。 |
| `PROVIDER.html` | §3.3 QQ Web 签名 / 加密协议（`#p3-3`） | 改 | 由原 §3.4 前移并同步内部链接。 |
| `PROVIDER.html` | §4.2 消息与错误（`#p4-2`） | 改 | 80105 提示改为重新扫码登录同步网页会话。 |
| `README.md` | §2 用户交互 · 登录行 | 改 | 删除粘贴浏览器 Cookie 的入口说明。 |
| `ABOUT.html` | 用户交互 · 登录行 | 改 | 与 README 同步。 |
| `diagram/seq-login.puml` | 登录流程 | 改 | 删除 Cookie 分支，只保留 xlogin / 微信扫码。 |
| `diagram/prov-cookie.puml` | Cookie 登录协议 | 删 | 删除 Cookie 登录时序图及其导出 SVG。 |

**工作记录**：

- `TODO.md` 已替换为新列表，旧条目不再存在，未回加；本条 IMPL 记录与规格落点均已存在。

### 4.14 优化刷新登录 [已解决] 

**描述**：续期严格按登录方式走各自协议，取消跨方式回退；续期结果分为正常、需要重新登录、临时失败；auth-failed 弹出全局重新登录界面，temp-failed 静默重试；失败不丢当前凭证；登录态实时同步，登录后始终允许手动续期。

**解决方案**：

- `refreshMusickey()` 改为严格分流：QQ 只调用 `QQConnectLogin.LoginServer/QQLogin`，微信只调用 `music.login.LoginServer/Login`（`loginMode=2`）；删除 QQLogin 失败后回退到 `refresh_token` 的跨方式分支。
- 新增 `RefreshState = 'ok' | 'auth-failed' | 'temp-failed'` 与 `AuthStatus.refreshState`；续期成功写 `ok`，`AUTH_EXPIRED` 写 `auth-failed`，网络 / 超时 / 限流等写 `temp-failed`。
- `auth-failed` 设置 `reauthReason='auth-failed'` 并暂停自动续期；`temp-failed` 不设置重新登录原因，按 `SESSION_REFRESH_RETRY_BASE_MS` 起指数退避、封顶 `SESSION_REFRESH_RETRY_MAX_MS` 静默重试。两者都保留旧凭证，只有重新扫码成功才覆盖。
- 登录模块增加 `setAuthStatusNotifier()`，由 IPC 注册为广播 `login:status`；登录、续期成功 / 失败、退出后都实时推送 `AuthStatus`，preload 暴露 `login.onStatus`，auth store 通过 `applyStatus()` 统一消费。
- 登录成功与退出调用 `resetRefreshState()` 清除续期状态、退避定时器与重新登录原因；手动续期始终可重试。
- 移除 `AuthStatus.canRefresh` 与设置页的禁用条件，登录后“立即续期”始终可用。
- 扩展 `test/api/login-refresh.test.ts`：覆盖 QQ 不跨方式回退、微信仅 token 续期、auth-failed 保留凭证并暂停自动重试、temp-failed 保留凭证、成功重置状态与到期窗口判断；新增 `test/auth-store.test.ts` 覆盖凭证仍存在时 auth-failed 弹层、稍后忽略与登录成功清除。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 3 项“优化刷新登录” | 改 | 行尾追加 ` [已解决]`。 |
| `IMPL.md` | 新增“优化刷新登录” | 增 | 记录需求、实现思路与本次文档操作。 |
| `PROVIDER.html` | §2 CONVENTIONS · 登录方式边界 | 改 | 明确续期严格按方式执行，不存在 QQ ↔ 微信跨方式回退。 |
| `CORE.html` | §4.1 `src/shared/types.ts`（`#c4-1`） | 改 | 增加 `RefreshState` 与 `AuthStatus.refreshState`。 |
| `CORE.html` | §4.2 `src/shared/ipc.ts`（`#c4-2`） | 改 | 增加 `login.onStatus` 订阅。 |
| `CORE.html` | §4.5 `src/main/ipc.ts`（`#c4-5`） | 改 | `currentAuthStatus` 增加 `refreshState`；注册 `login:status` 广播。 |
| `CORE.html` | §4.16 `src/main/api/login.ts`（`#c4-16`） | 改 | 增加续期状态机、严格分流、退避重试、状态广播与重置入口；删除跨方式回退。 |
| `CORE.html` | §4.28 `src/renderer/stores/auth.ts`（`#c4-28`） | 改 | 增加 `refreshState`、`applyStatus` 与实时状态订阅；移除 `canRefresh`。 |
| `CORE.html` | §4.48 `SettingsView.vue`（`#c4-48`） | 改 | 立即续期始终可用；AUTH_EXPIRED 交由全局弹层提示，不重复 Toast。 |
| `CORE.html` | §4.50 `src/shared/constants.ts`（`#c4-50`） | 改 | 增加续期临时失败重试基础延迟与退避上限。 |
| `CORE.html` | §5.7 会话续期（`#c5-7`） | 改 | 更新为严格分流、状态机、退避重试与 `login:status` 广播。 |
| `USER.html` | §5.2.7 设置页（`#u5-2-7`） | 改 | 说明续期结果实时同步、auth-failed 弹层，以及登录后始终允许手动续期。 |
| `USER.html` | §5.3 错误与通知（`#u5-3`） | 改 | `AUTH_EXPIRED` 区分 auth-failed 全局弹层与 temp-failed 静默重试。 |
| `README.md` | §2 用户交互 · 登录行 | 改 | 补充续期失败按状态处理与登录态实时同步。 |
| `ABOUT.html` | 用户交互 · 登录行 | 改 | 与 README 同步。 |

**工作记录**：

- `TODO.md` 已替换为新列表，旧条目不再存在，未回加；本条 IMPL 记录与规格落点均已存在。

### 4.15 登出保留用户缓存与按账号缓存管理 [已解决] 

**描述**：退出登录、认证失败等流程不再清空该用户的歌单缓存、播放缓存与本地记录；设置页新增“用户缓存管理”，弹窗按账号列出播放缓存、歌单缓存与本地记录占用，可选择性删除任意账号的缓存，不影响其他账号与下载文件。

**解决方案**：

- `login.logout` 只清理凭证与续期状态，移除 `clearPlaylistCache()`、`clearAvailabilityCache()`、`clearRecommendCache()` 调用；登录 / 续期时也只清理当前账号的可用性缓存。
- 推荐缓存改为按 `musicid` 分层，退出或切换账号不再依赖全局清空；音频缓存与歌单缓存继续按账号目录 / 文件名隔离。
- `App.vue` 的 `lychee:logout` 只重置内存 playlist / recommend / download 视图，不再调用 `clearRecent()`；最近歌单与播放历史的 localStorage key 按账号保留。
- 新增 `UserCacheInfo` 与 `cache.listUsers` / `cache.clearUser` IPC；主进程 `cache/user.ts` 汇总 `cache/audio/<musicid>` 与 `cache/playlist/<musicid>-*.json`，按账号删除两类缓存。
- 新增渲染层 `utils/cache-users.ts`：枚举 `lychee:recent-playlists:<musicid>` 与 `lychee:play-history:<musicid>`，与主进程统计合并；删除账号时一并清理这两类本地 key。
- 设置页“缓存与下载”增加“用户缓存管理”入口；新增 `CacheManagerDialog` 列出账号、总占用、播放缓存 / 歌单缓存 / 本地记录明细，删除按钮二次确认，删除后刷新列表与缓存占用。
- 新增 `test/cache-management.test.ts` 与 `test/cache-users.test.ts`，覆盖按账号统计、仅删除目标账号、保留 anonymous 与其他账号、localStorage 只删目标账号。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 4 项“登出保留用户缓存与按账号缓存管理” | 改 | 行尾追加 ` [已解决]`。 |
| `IMPL.md` | 新增“登出保留用户缓存与按账号缓存管理” | 增 | 记录需求、实现思路与本次文档操作。 |
| `USER.html` | §1 TERMS · 歌单（`#u1`） | 改 | 退出登录不再清空本机歌单缓存与最近列表。 |
| `USER.html` | §5.2.7 设置页（`#u5-2-7`） | 改 | 增加“用户缓存管理”入口与弹窗说明：按账号查看 / 删除播放缓存、歌单缓存与本地记录。 |
| `USER.html` | §5.2.8 页面结构 · 侧栏最近歌单（`#u5-2-8`） | 改 | 退出登录保留当前账号最近列表，切换账号加载对应列表。 |
| `CORE.html` | §1 文件树（`#c1`） | 改 | 增加 `cache/scope.ts`、`cache/user.ts`、`components/CacheManagerDialog.vue` 与 `utils/cache-users.ts`。 |
| `CORE.html` | §1 CONVENTIONS · 缓存作用域（`#c1`） | 改 | 退出登录不再清空歌单 / 可用性缓存；缓存由设置页按账号管理。 |
| `CORE.html` | §4.1 `src/shared/types.ts`（`#c4-1`） | 改 | 增加 `UserCacheInfo`。 |
| `CORE.html` | §4.2 `src/shared/ipc.ts`（`#c4-2`） | 改 | 增加 `cache.listUsers` / `cache.clearUser`。 |
| `CORE.html` | §4.5 `src/main/ipc.ts`（`#c4-5`） | 改 | 退出只清凭证与续期状态；新增缓存管理 IPC；登录 / 续期只清当前账号可用性缓存。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） | 改 | 退出登录只重置内存视图，不再清空最近歌单。 |
| `CORE.html` | §4.48 `SettingsView.vue`（`#c4-48`） | 改 | 增加用户缓存管理入口、统计刷新与按账号删除流程。 |
| `CORE.html` | §4.50 `src/shared/constants.ts`（`#c4-50`） | 改 | 增加最近歌单 localStorage key 前缀。 |
| `CORE.html` | §4.53 `api/recommend.ts`（`#c4-53`） | 改 | 推荐缓存改为按账号分层，退出登录不再全局清空。 |
| `CORE.html` | §4.57 `cache/playlist.ts`（`#c4-57`） | 改 | 增加按账号统计与删除歌单缓存的函数。 |
| `CORE.html` | §4.58 `cache/audio.ts`（`#c4-58`） | 改 | 增加按账号统计与删除播放缓存的函数。 |
| `CORE.html` | §4.98 `cache/user.ts`（`#c4-98`） | 增 | 新增按账号汇总与删除两类缓存的说明。 |
| `CORE.html` | §4.99 `components/CacheManagerDialog.vue`（`#c4-99`） | 增 | 新增用户缓存管理弹窗的 props、emits 与二次确认行为。 |
| `CORE.html` | §4.100 `utils/cache-users.ts`（`#c4-100`） | 增 | 新增本地记录枚举、合并统计与按账号删除函数。 |
| `README.md` | §2 用户交互 · 设置行 | 改 | 补充按账号管理缓存的入口。 |
| `ABOUT.html` | 用户交互 · 设置行 | 改 | 与 README 同步。 |

**工作记录**：

- `TODO.md` 已替换为新列表，旧条目不再存在，未回加；本条 IMPL 记录与规格落点均已存在。
- `TERMS` 相关条目已按“只保留定义”的规则收敛，设计细节由对应章节承载。

