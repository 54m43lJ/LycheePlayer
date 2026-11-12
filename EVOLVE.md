# EVOLVE

## 1. 播放模式切换按钮默认外观

**需求**：调整播放模式切换按钮外观：未 hover 时不高亮按钮，使用透明背景与 muted 色图标；hover 时保留原有 accent 软填充反馈，按钮尺寸、图标、弹层与交互逻辑均不变。

**实现思路**：

- 修改 `src/renderer/styles/main.css` 的 `.mode-button`：`color` 从 `--accent-strong` 改为 `--muted`，`background` 从 `--accent-soft` 改为 `transparent`。
- 保留 `.mode-button:hover` 现有的 `color-mix(...)` 背景与过渡，不改动按钮尺寸、圆角、图标映射、revealer 弹层和触屏手势。
- 同步更新 `USER.html` / `CORE.html` / `ABOUT.html` / `README.md` 中“按钮常驻 accent 高亮”的表述，使文档与当前视觉状态一致。

**文档操作**：

| 文档 | 章节 | 操作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 1 项“调整播放模式切换按钮外观” | 改 | 行尾追加 ` [已解决]`。 |
| `EVOLVE.md` | 新增“播放模式切换按钮默认外观” | 增 | 记录需求、实现思路与本次文档操作。 |
| `USER.html` | §5.2.3 播放条（`#u5-2-3`） | 改 | 播放模式按钮由“常驻 accent 软填充与强调色图标”改为“默认透明背景 + muted 图标，悬停时显示 accent 软填充”。 |
| `CORE.html` | §4.40 `PlayerBar.vue`（`#c4-40`） | 改 | `.mode-button` 改为默认透明背景与 `--muted` 图标，悬停时使用 `--accent` 34% 混合背景。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 样式契约同步为默认透明背景 + muted 图标，悬停使用 accent 混合背景。 |
| `ABOUT.html` | 用户交互 · 播放行 | 改 | “当前项由按钮本身高亮”改为“当前项由按钮图标表示”。 |
| `README.md` | §2 用户交互 · 播放行 | 改 | 与 ABOUT 同步，移除默认态高亮表述。 |

## 2. 歌词译文开关与双行展示

**需求**：实现歌词翻译展示：原文与译文紧贴为上下两行并共享当前行高亮；歌词模块左下角提供译文开关；默认关闭译文。

**实现思路**：

- `useLyrics()` 增加 `hasTranslation`、`translationVisible` 与 `toggleTranslation()`；是否显示译文持久化在 `localStorage` 的 `lychee.lyrics.translation`，只有值为 `on` 时显示，默认关闭。
- `LyricsPanel.vue` 仅在 `hasTranslation` 为真时渲染左下角开关；`translationVisible` 为真时才渲染 `.lyric-trans`，原文与译文仍位于同一 `.lyric-line`，共享活动行状态；切换后重新居中当前行。
- `main.css` 将 `.lyric-trans` 改为紧贴原文（`margin-top: 0`、`line-height: 1.45`），新增 `.lyrics-trans-toggle` / `.lyrics-trans-switch` 的定位、开关与活动态样式。

**文档操作**：

| 文档 | 章节 | 操作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 2 项“实现歌词翻译功能” | 改 | 行尾追加 ` [已解决]`。 |
| `EVOLVE.md` | 新增“歌词译文开关与双行展示” | 增 | 记录需求、实现思路与本次文档操作。 |
| `USER.html` | §5.2.5 歌词与评论（`#u5-2-5`） | 改 | 补译文开关、默认关闭、原文 / 译文上下两行共享高亮，以及无译文时不显示开关。 |
| `CORE.html` | §4.34 `composables/lyrics.ts`（`#c4-34`） | 改 | 补 `hasTranslation` / `translationVisible` / `toggleTranslation()` 与本地持久化说明。 |
| `CORE.html` | §4.41 `LyricsPanel.vue`（`#c4-41`） | 改 | 补开关渲染条件、译文显隐与共享活动行高亮。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 补译文按钮定位、开关样式与译文紧贴原文的样式契约。 |
| `CORE.html` | §5.9 歌词与评论（`#c5-9`） | 改 | 补 `toggleTranslation()` 与 `localStorage` 写入调用链。 |
| `README.md` | §2 用户交互 · 歌词 / 评论行 | 改 | 补译文开关默认关闭与双行共享高亮。 |
| `ABOUT.html` | 用户交互 · 歌词 / 评论行 | 改 | 与 README 同步。 |

## 3. 评论发表输入框与按钮

**需求**：在评论模块底部提供输入框与发表按钮；登录用户可对当前歌曲发表评论，正文上限 300 字；未登录时禁用输入；发表成功后刷新最新评论列表，失败保留草稿并提示。

**实现思路**：

- 在 `shared/constants.ts` 增加 `COMMENT_CONTENT_MAX = 300`，同时用于输入框 `maxlength`、渲染层提交校验与主进程 IPC 参数校验。
- 增加跨进程模型 `CommentPostResult { commentId }` 与 `comment.post` IPC；主进程调用 `music.globalComment.CommentWriteServer / AddComment`，参数为 `{ Content, BizType: 1, BizId: 数字歌曲 ID, BizSubType: 2 }`。
- `postComment()` 要求登录，正文去首尾空白后校验非空与长度；`SubCode === 0` 才成功，`1000` 映射登录失效，`VerifyUrl` 非空映射为需要验证码的 `NO_PERMISSION`，其余非 0 按 `Msg` 返回失败。
- `CommentsPanel` 底部新增固定输入框与发表按钮；未登录禁用，提交中按钮显示 spinner；成功清空草稿、提示并重新 `load()` 最新评论，失败保留草稿并 Toast；切歌清空草稿。
- 评论滚动区底部留白与右下角跳转按钮位置上移，避免被输入框遮挡；不本地插入返回评论，顺序始终以上游最新列表为准。
- 补充 `test/api/comment.test.ts`，覆盖 `AddComment` 请求参数、`AddedCmId` 映射与 `VerifyUrl` 的验证码错误映射。

**文档操作**：

| 文档 | 章节 | 操作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 3 项“实现发表评论功能” | 改 | 行尾追加 ` [已解决]`。 |
| `EVOLVE.md` | 新增“评论发表输入框与按钮” | 增 | 记录需求、实现思路与本次文档操作。 |
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

## 4. 歌手页歌曲 / 专辑切换与专辑筛选

**需求**：歌手页在歌曲浏览之外增加专辑浏览，通过“歌曲 / 专辑”切换；专辑支持最热 / 最新排序，并按上游元信息提供 LP / EP / 单曲 / 现场 / 其他版本筛选，筛选条位于歌曲 / 专辑切换下方；专辑卡片可进入专辑页。

**实现思路**：

- 新增 `ArtistAlbumSort`、`ArtistAlbumKind`、`ArtistAlbum`、`ArtistAlbumPage` 跨 IPC 模型，以及 `CATALOG_PAGE_SIZE = 50`、`ARTIST_ALBUM_PAGE_SIZE = 80`、`ARTIST_ALBUM_PAGE_MAX = 20` 常量。
- 主进程 `getArtistAlbums()` 调用 `music.musichallAlbum.AlbumListServer / GetAlbumList`，`sort` 映射为 `hot → order=1`、`latest → order=0`；读取 `albumMid` / `albumName` / `publishDate` / `albumType`，封面由 `albumMid` 拼接。
- `albumType` 归一化为 `lp`（录音室 / 专辑 / LP）、`ep`（EP）、`single`（Single / 单曲）、`live`（演唱会 / 现场 / Live）和 `other`；筛选只基于该元信息，不根据专辑名猜测。
- 新增 `artist.getAlbums` IPC 与 preload 方法；渲染层切到专辑视图或切换排序时从偏移 0 连续补拉，直到无下一页或达到页数上限，一次渲染完整列表。
- `ArtistView` 顶部增加“歌曲 / 专辑”切换；歌曲视图保留原有滚动分页与排序，专辑视图增加最热 / 最新与版本筛选；切换歌手时重置为歌曲视图并清空专辑缓存。
- 补充 `test/api/catalog.test.ts`，覆盖专辑排序参数、`albumType` 分类映射与分页元信息。

**文档操作**：

| 文档 | 章节 | 操作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 4 项“歌手页可以在歌曲浏览和专辑之间切换” | 改 | 行尾追加 ` [已解决]`。 |
| `EVOLVE.md` | 新增“歌手页歌曲 / 专辑切换与专辑筛选” | 增 | 记录需求、实现思路与本次文档操作。 |
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

## 5. 下载管理：纯本地搜索与已下载歌曲删除确认

**需求**：强化下载管理：下载中心支持纯本地搜索，只过滤已加载的下载任务而不请求上游；歌单中点击已下载歌曲的下载按钮时先询问是否删除本机下载文件，确认后删除文件与下载记录。

**实现思路**：

- `DownloadTask` 增加 `singers` / `albumName`，在出队解析歌曲信息时回填并随索引持久化；旧索引缺少字段时归一化为空数组 / 空字符串，保证向后兼容。
- 新增 `utils/download-filter.ts` 的 `matchesDownloadKeyword()`，对歌名、`songMid`、歌手、专辑与文件路径做不区分大小写的本地包含匹配；`DownloadsView` 增加搜索框与状态过滤叠加，空结果区分“无匹配”和“无符合过滤条件”。
- 新增 `download.removeSong(songMid)` IPC、preload 与 store 方法；主进程 `removeDownloadedSong()` 删除该曲全部 `done` 任务的音频、`.part` 与下载封面，并落盘索引。
- `PlaylistView` 的下载按钮先读取 `download.assets[mid].downloadedQuality`：已下载时打开危险态 `ConfirmDialog`，确认后调用 `download.removeSong()` 并刷新资产；未下载时保持原入队流程。
- 补充 `test/download-filter.test.ts`，并扩展下载任务与管理器测试，覆盖元信息回填、本地匹配和按歌曲删除文件。

**文档操作**：

| 文档 | 章节 | 操作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 5 项“强化下载管理” | 改 | 行尾追加 ` [已解决]`。 |
| `EVOLVE.md` | 新增“下载管理：纯本地搜索与已下载歌曲删除确认” | 增 | 记录需求、实现思路与本次文档操作。 |
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

## 6. 下载按钮机制抽象与共用

**需求**：播放条的下载按钮没有跟上“已下载时确认删除”的行为；把下载按钮的判定、入队、删除确认与提示抽成唯一共用机制，供播放条、所有歌曲表页面与后续入口调用，避免再次出现行为漂移。

**实现思路**：

- 新增 `composables/download-action.ts`：`requestDownload()` 统一判断 `downloadedQuality`，已下载时只设置模块级 `pendingDelete`，未下载时调用 `download.start()` 并提示；`confirmDownloadDelete()` 统一调用 `download.removeSong()`，取消只清空状态。
- 新增 `components/DownloadDeleteDialog.vue`，读取共享的 `pendingDelete` 并复用 `ConfirmDialog`；`App.vue` 全局只挂载一次，删除确认不再由各页面分别持有。
- `PlayerBar`、`PlaylistView`、`SearchView`、`ArtistView`、`AlbumView` 的下载入口全部改为调用 `requestDownload()`，移除各自的入队 / 删除判断与页面级确认框。
- 新增 `test/download-action.test.ts`，覆盖已下载确认删除、未下载入队、取消与跨调用方共享状态。

**文档操作**：

| 文档 | 章节 | 操作 | 内容 |
|---|---|---|---|
| `EVOLVE.md` | 新增“下载按钮机制抽象与共用” | 增 | 记录需求、实现思路与本次文档操作。 |
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
