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
