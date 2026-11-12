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
