# IMPL

开发过程心得，按“文档错误 / 文档缺漏 / 技术坑 / 需求演进”分组。前三组每条只记录一个独立问题，跨组不重复同一结论；第 4 组按功能条目记录描述、解决方案与文档操作。表中的动作表示建议落点；`不动` 表示该处已有内容、本轮不再重复编辑，或以其它条目为准。

## 4. 需求演进记录

按功能条目记录描述、解决方案与当时的文档操作；前三组记录开发中发现的问题，本节记录已推进的需求变更。

### 4.16 Toast 消息收敛、样式与使用原则 [已解决] 

**描述**：TODO 第一项要求整理现有 Toast：不再对每件事都弹提示，只在关键节点告知用户；把 Toast 改为播放条上方居中的无边框半透明弹出；确定使用原则并写入文档，且按实际使用情况修正该原则。

**解决方案**：

- 盘点渲染层全部 78 个 Toast 调用点，按“该事件在界面上是否已有直接可见结果”分类。
- 移除 21 个成功路径提示：评论已发表、单曲加入下载任务、已删除下载、歌单创建 / 改名 / 删除 / 从歌单移除、已退出登录（两处）、扫码登录成功、默认音质 / 关闭到托盘 / 缓存上限 / 主题 / 缓存清理 / 账号缓存清理 / 下载目录更新 / 下载目录清空等设置变更、手动续期。
- 页面级加载失败（MV 详情、搜索首屏）只保留页内错误区，不再同时弹 Toast；下载中心的“已删除 / 已清除 / 已清空”提示随 `run()` 的消息参数一并移除。
- 保留无可见结果的提示：已添加到歌单、已在歌单中、歌曲不在歌单中、整单下载入队、启动参数保存、评论分页达到上限（文案“评论太多，仅跳过 1000 条”，数值由 `COMMENT_LOAD_ALL_PAGE_MAX * COMMENT_PAGE_SIZE` 计算）；全部用户操作失败、风控截断、播放错误继续使用 error Toast。
- “猜你喜欢暂时没有更多歌曲”是队列自然结束的告知，改用 info 样式。
- `main.css` 的 `.toast-stack` 改为固定于播放条上方水平居中，子项向上堆叠；`.toast` 去掉边框与左侧色条，使用 72% 面板底色 + 14px 背景模糊，error 叠加 22% danger 色调；窄屏只收窄最大宽度，不再改左右定位。
- `USER.html` 新增 §5.3.1 记录触发原则、成功结果、失败与无变化、合并四类规则，并更新 §5.2.8 的 Toast 视觉契约；`CORE.html` §4.35 补充自动消失与原则链接。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 1 项“整理一下目前已有的Toast消息” | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“Toast 消息收敛、样式与使用原则” | 增 | 记录需求、实现思路与本次文档操作。 |
| `USER.html` | §5.2.8 页面结构 · Toast 行 | 改 | 改为“内容区水平居中、播放条上方；无边框、半透明面板底色并做背景模糊；多条向上堆叠，窄屏左右各留 12px；error 使用 danger 色调背景”，并链接 §5.3.1。 |
| `USER.html` | §5.3.1 Toast（`#u5-3-1`） | 增 | 记录触发原则、成功结果、失败与无变化、合并规则，以及整单下载例外与猜你喜欢提示的定位。 |
| `USER.html` | §5.3 错误与通知 · 展示方式 | 改 | 补充“是否提示与提示范围见 §5.3.1”。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 补充补拉达到上限仍未到底时的提示“评论太多，仅跳过 1000 条”。 |
| `CORE.html` | §4.41 `CommentsPanel.vue`（`#c4-41`） | 改 | 补拉上限仍未到底时的 Toast 引用 USER §5.2.5 文案。 |
| `CORE.html` | §4.35 `composables/toast.ts`（`#c4-35`） | 改 | 补充 `show()` 按 `TOAST_DURATION_MS` 自动移除、`error()` 仅改变 kind，以及 USER §5.3.1 的契约链接。 |
| `README.md` | §2 用户交互 · 播放 / 整单下载行 | 不动 | 已有“切换不弹 Toast”“整单下载入队后 Toast 提示”，与新原则一致。 |
| `ABOUT.html` | 用户交互 · 播放 / 整单下载行 | 不动 | 与 README 同步，无需改动。 |

**工作记录**：

- `npm run typecheck` 与 `npm test`（43 个测试文件、199 个用例）通过。
- 用 Electron 离屏截图核对新 Toast：居中、无边框、半透明、error 危险色调、多条向上堆叠、播放条上方间距符合契约。
- 按 review 反馈把评论补拉上限的提示由“评论较多，已加载前 N 条”改为“评论太多，仅跳过 1000 条”，数值由 `COMMENT_LOAD_ALL_PAGE_MAX * COMMENT_PAGE_SIZE` 计算，不再使用逐次累加的 `pages`。
- `IMPL.md` 已按约定移除上一轮全部已关闭条目，本条为新的需求演进记录。

### 4.17 窄屏播放条重排与放大 [已解决] 

**描述**：TODO 第二项要求改进窄屏播放条：歌曲图标与信息为一组固定布局元素，播放控制为一组固定布局元素，收藏 / 下载 / 音质 / 音量等为另一组固定布局元素；歌曲信息与右侧交互放在同一行，播放控制单独一行并居中；屏幕进一步收窄时，歌曲信息与右侧交互可再拆成两行；窄屏下播放条整体加高一倍，元素等比放大填充空间。

**解决方案**：

- ≤900px 的 `.player` 改为三行：第一行左侧 `.player-now`（封面 64px）与右侧 `.player-right` 同行；第二行进度条独占整宽；第三行播放控制跨整宽居中。`--player-height` 由 84px 调整为 168px。
- 通过 `.player-center { display: contents; }` 拆开原有的中列，使控制与进度分别落到第 3 / 2 行；不改动组件模板与脚本。
- 控制按钮由 32px 放大到 40px、主播放按钮 38px → 46px、图标 17px → 19px、音质芯片 58×30px；`.mode-menu` / `.like-menu` / `.volume-menu` 的 `padding-bottom` 同步到 40px，避免弹层与放大后的按钮错位。
- ≤720px 改为四行：歌曲信息与 `.player-right` 各占一行并居中，进度第三行、播放控制第四行；封面 56px、标题 14px、歌手 / 专辑 11px；`--player-height` 为 204px。宽屏 92px 的三列布局保持不变。
- 同步更新 `USER.html` §5.2.1 的播放条高度 / 响应式断点、§5.2.3 的窄屏布局契约，`CORE.html` §4.49 的 grid 结构与 revealer 尺寸，`README.md` / `ABOUT.html` 的外观行。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 2 项“窄屏模式下播放条的样式需要改进” | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“窄屏播放条重排与放大” | 增 | 记录需求、实现思路与本次文档操作。 |
| `USER.html` | §5.2.1 窗口与布局 · 播放条高度 | 改 | 改为“92px；≤900px 为 168px；≤720px 为 204px”。 |
| `USER.html` | §5.2.1 窗口与布局 · 响应式断点 | 改 | 900px 增加播放条三行重排（信息与交互同行、控制单独一行）；新增 720px 信息与交互拆两行；560px 不再声明播放条双行。 |
| `USER.html` | §5.2.3 播放条 | 改 | 增加窄屏三行布局（信息与交互同行、进度一行、控制单独居中一行）、≤720px 拆行与元素尺寸契约。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 增加窄屏播放条 grid 结构、两档高度与按钮 / 音质芯片尺寸；补充窄屏 revealer 的 `padding-bottom`。 |
| `README.md` | §2 用户交互 · 外观行 | 改 | 补充窄屏播放条的信息与交互同行、控制单独一行及进一步拆行。 |
| `ABOUT.html` | 用户交互 · 外观行 | 改 | 与 README 同步。 |

**工作记录**：

- 用 Electron 离屏截图核对 1280 / 900 / 760 / 721 / 700 / 560 / 430px：宽屏布局不变；760 / 721 为信息与交互同行、进度一行、控制单独一行；≤720 信息与交互拆成两行，进度与控制依次排在下面；深色与浅色均正常。
- `npm run typecheck`、`npm test`（43 个测试文件、199 个用例）与 `npm run build` 通过。

### 4.18 歌单选择器去重与跳转到当前歌曲 [已解决] 

**描述**：TODO 第三项要求优化歌单交互：添加到歌单时预检歌曲是否已在某个歌单中，命中则将该歌单置灰、不可点击，并保留“已在歌单中”的 Toast 兜底；检测机制需先调查上游是否存在单次跨歌单查询接口；正在播放的歌单与播放历史在顶部 / 底部跳转按钮之间增加“跳转到当前歌曲”，使用圆点准星图标。

**解决方案**：

- 检测机制调查结论：已消费接口中没有“一次查询歌曲是否存在于当前账号全部歌单”的入口；`GetPlaylistByUin` 只返回歌单元数据，`CgiGetDiss` 按单个歌单读取，跨歌单只能逐单请求。为避免打开选择器时向上游发起 N 次请求，采用本地完整歌单缓存预检。
- `PlaylistPicker` 打开时对 `listMine()` 返回的可编辑普通歌单并行调用 `playlist.getCached`；仅 `complete` 快照参与判断，当前歌曲（多选时为全部 mid）命中时将该行置灰、`disabled` 并显示“已在歌单中”。
- 缓存不完整或检测尚未完成时保持可点击；点击仍先查本地缓存，再由 `addSongs` 的 `changed = false` 与 `playlist-edit` 的 Toast“已在歌单中”兜底。
- `PageJump` 新增 `showCurrent` prop 与 `current` 事件，按钮顺序固定为顶部、当前歌曲、底部；新增 `locate` 圆点准星图标。
- `SongTable` 数据行增加 `data-song-mid`；`PlaylistView` 在当前页面为播放来源且当前歌曲在筛选结果中时显示按钮，`HistoryView` 在当前歌曲仍在列表（含筛选结果）中时显示，不要求播放来源。
- `utils/page-jump` 抽出 `scrollToSongRow(root, mid)`，两个页面共用：按 `tr[data-song-mid]` 定位并把该行滚到内容区中间，复用 `scrollWithTransition` 的 400ms 过渡。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 3 项“歌单交互优化” | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“歌单选择器去重与跳转到当前歌曲” | 增 | 记录需求、调查结论、实现思路与本次文档操作。 |
| `USER.html` | §2 CONVENTIONS · 长页面跳转 | 改 | 增加歌单详情与播放历史的“跳转到当前歌曲”按钮与居中滚动行为。 |
| `USER.html` | §5.2.4 歌曲列表 · 添加到歌单 | 改 | 增加选择器预检、置灰与 Toast 兜底。 |
| `USER.html` | §5.2.8 页面结构 · 歌单详情 / 播放历史 | 改 | 补充当前歌曲按钮与滚动定位。 |
| `CORE.html` | §4.36 `AppIcon.vue`（`#c4-36`） | 改 | 记录 `locate` 圆点准星图标。 |
| `CORE.html` | §4.39 `SongTable.vue`（`#c4-39`） | 改 | 记录数据行的 `data-song-mid` 定位属性。 |
| `CORE.html` | §4.46 `PlaylistView.vue`（`#c4-46`） | 改 | 记录 `showCurrent` 条件与 `scrollToCurrent()` 的居中滚动。 |
| `CORE.html` | §4.77 `PlaylistPicker.vue`（`#c4-77`） | 改 | 记录本地缓存预检、置灰行、上游无跨歌单接口与 Toast 兜底。 |
| `CORE.html` | §4.87 `HistoryView.vue`（`#c4-87`） | 改 | 记录当前歌曲跳转按钮与 `scrollToSongRow`。 |
| `CORE.html` | §4.96 `utils/page-jump.ts`（`#c4-96`） | 改 | 记录 `scrollToSongRow(root, mid)` 签名与行为。 |
| `CORE.html` | §4.97 `PageJump.vue`（`#c4-97`） | 改 | 更新 props / emits 与三按钮顺序、`locate` 图标。 |
| `CORE.html` | §5.14 收藏与歌单编辑（`#c5-14`） | 改 | 补 `detectDuplicates()` 与 `addTo()` 的本地预检调用链。 |
| `CORE.html` | §5.23 跳转到当前歌曲（`#c5-23`） | 增 | 记录歌单详情 / 播放历史的显隐条件与 400ms 居中滚动。 |
| `PROVIDER.html` | §4.1 接口 · 说明 | 增 | 注明没有单次跨歌单成员查询接口，成员判断使用本地缓存。 |
| `README.md` | §2 用户交互 · 歌单 / 收藏管理 / 播放历史行 | 改 | 补充添加歌单去重、当前歌曲跳转与播放历史跳转。 |
| `ABOUT.html` | 用户交互 · 歌单 / 收藏管理 / 播放历史行 | 改 | 与 README 同步。 |

**工作记录**：

- `npm run typecheck`、`npm test`（43 个测试文件、201 个用例）与 `npm run build` 通过；新增 `PageJump` 三按钮顺序与单独显示的 SSR 测试。
- 按追加需求把“跳转到当前歌曲”扩展到播放历史：历史页不要求播放来源，只要当前歌曲仍在列表（含筛选）中就显示；定位逻辑抽到 `scrollToSongRow` 供两个页面共用。
- 未登录真实账号环境，选择器与当前歌曲跳转的上游行为未做端到端验收；缓存预检逻辑按 `getCached` 返回的 `complete` 与成员集合判断。
- 已存在的未提交 `DOC/ISSUE.md` 改动不属于本项，未纳入提交。

### 4.19 歌曲列表页面接线复用 [已解决] 

**描述**：检查播放历史与“我喜欢”页的代码复用情况。`SongTable` 本身已复用，但搜索、歌单详情、歌手、专辑、播放历史五个页面各自重复维护收藏状态、资产状态、下一首播放、收藏、下载、加入歌单选择器与 SongTable 事件接线；要求把歌曲列表相关逻辑收敛为共用实现。

**解决方案**：

- 新增 `SongListTable.vue`：内部渲染 `SongTable` 与 `PlaylistPicker`，统一读取 `playlist-edit.favorites` / `download.assets`，处理下一首播放、收藏、下载与添加到歌单，并透传 `play` / `remove` / `added`。
- “我喜欢”页不是独立页面，而是 `PlaylistView` 的 `kind === 'favorites'` 分支；复用该组件后与普通歌单共用同一套列表接线。
- 五个页面只保留数据加载、筛选、页面级播放语义（歌单详情构建队列、其余使用 `playList`）、删除确认与页面头部操作；不再各自持有选择器状态或收藏 / 下载处理函数。
- `PlaylistView` 继续保留下载计数、整单下载与心跳；`HistoryView` 继续在挂载时加载收藏状态。用户可见行为不变。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `IMPL.md` | 新增“歌曲列表页面接线复用” | 增 | 记录复用范围、实现方式与文档操作。 |
| `CORE.html` | §1 文件树 · components | 增 | 新增 `SongListTable.vue` 条目。 |
| `CORE.html` | §4.39 `SongTable.vue`（`#c4-39`） | 改 | 明确 SongTable 只负责展示与事件，选择器与操作接线由 `SongListTable` 统一处理。 |
| `CORE.html` | §4.101 `SongListTable.vue`（`#c4-101`） | 增 | 记录 props / emits、内部接线与队列语义由页面提供的边界。 |
| `CORE.html` | §4.44 / §4.46 / §4.73 / §4.74 / §4.87 | 改 | 各页面改为复用 `SongListTable`，移除“页面直接调用 requestDownload / 打开 PlaylistPicker”的旧描述。 |
| `CORE.html` | §5.14 / §5.16 调用树 | 改 | 收藏、下载与删除入口改为 `SongListTable`。 |

**工作记录**：

- `npm run typecheck`、`npm test`（43 个测试文件、201 个用例）与 `npm run build` 通过。
- 净减少约 180 行页面接线代码；`DOC/ISSUE.md` 的未提交改动不属于本项，未纳入提交。

### 4.20 跳转到当前歌曲与播放来源解耦 [已解决] 

**描述**：从播放历史播放歌曲后，在歌单详情（如“今日私享”的 30 首）没有看到“跳转到当前歌曲”。原实现把歌单页的按钮绑定在 `queueSource === 当前歌单`，因此只有从该歌单起播时才显示；只要当前歌曲出现在列表里，就应允许定位，与队列由谁构建无关。

**解决方案**：

- 新增 `useCurrentSongJump(rootRef, songs)`：仅判断当前歌曲是否在传入列表（含筛选结果）中，不读取 `queueSource`；定位滚动复用 `scrollToSongRow`。
- `PlaylistView` 与 `HistoryView` 改用该 composable，删除各自的 `showCurrent` 条件与 `scrollToCurrent` 实现；歌单详情（含普通歌单、我喜欢、今日私享）与播放历史行为一致。
- “今日私享”仍由 `PlaylistView` 承载，因此自动获得相同能力；`SongListTable` 已在歌单 / 历史 / 今日私享中复用，不新增通用复用规则。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `IMPL.md` | 新增“跳转到当前歌曲与播放来源解耦” | 增 | 记录问题、解耦方式与文档操作。 |
| `USER.html` | §2 CONVENTIONS · 长页面跳转 | 改 | 去掉“正在播放的歌单”限制，改为当前歌曲在列表中即可定位。 |
| `USER.html` | §5.2.8 页面结构 · 歌单详情 / 播放历史 | 改 | 明确与播放队列来源无关。 |
| `CORE.html` | §1 文件树 · composables | 增 | 新增 `current-song-jump.ts` 条目。 |
| `CORE.html` | §4.46 / §4.87 | 改 | 改用 `useCurrentSongJump`，删除来源判断。 |
| `CORE.html` | §4.101 `SongListTable.vue`（`#c4-101`） | 改 | 明确歌单详情包含“我喜欢”与“今日私享”。 |
| `CORE.html` | §4.102 `current-song-jump.ts`（`#c4-102`） | 增 | 记录显隐条件与与播放来源解耦的契约。 |
| `CORE.html` | §5.23 跳转到当前歌曲（`#c5-23`） | 改 | 移除 `queueSource` 判断，改为列表成员判断。 |
| `README.md` / `ABOUT.html` | 歌单行 | 改 | “当前歌曲在该歌单列表中时提供”。 |

**工作记录**：

- 新增 `test/current-song-jump.test.ts`：覆盖 `queueSource = null` 时当前歌曲在列表中仍显示，以及列表变化后重新判断。
- `npm run typecheck`、`npm test` 与 `npm run build` 通过。

### 4.21 歌单重复提示缩短为“已添加” [已解决] 

**描述**：添加到歌单时，已存在歌曲的歌单行与兜底 Toast 使用“已在歌单中”，五个字过长；统一改为“已添加”。

**解决方案**：

- `PlaylistPicker` 的重复行标签与点击兜底 Toast 改为“已添加”。
- `playlist-edit.addSongs` 在 `changed = false` 时的兜底 Toast 同步改为“已添加”；成功写入仍为“已添加到歌单”。
- 同步更新 USER / CORE 中的提示文案与 IMPL 记录；80092 业务状态的“歌曲可能已在歌单中”属于错误说明，不在此次改动范围。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `IMPL.md` | 新增“歌单重复提示缩短为‘已添加’” | 增 | 记录文案调整范围。 |
| `USER.html` | §5.2.4 歌曲列表 · 添加到歌单 | 改 | 行标签与 Toast 改为“已添加”。 |
| `USER.html` | §5.2.8 页面结构 · 歌单详情 | 改 | 重复添加提示改为“已添加”。 |
| `USER.html` | §5.3.1 Toast · 失败与无变化 | 改 | 示例改为“已添加”。 |
| `CORE.html` | §4.55 / §4.77 / §5.14 | 改 | 同步重复预检与 Toast 文案。 |

**工作记录**：

- `npm run typecheck`、`npm test`（44 个测试文件、203 个用例）与 `npm run build` 通过。

### 4.22 本地缓存结构失效即清除重建 [已解决] 

**描述**：补充健壮性原则：本地缓存的数据结构与应用当前模型不符时，一律视为缓存失效，清除该缓存并重新获取/从空状态恢复，不做旧结构兼容。

**解决方案**：

- 新增 `src/shared/validation.ts`，作为 `Song`、`PlaylistMeta`、`PlaylistSnapshot`、`PlaylistCacheEntry`、`RecentPlaylist` 的结构校验唯一来源，完整检查嵌套字段。
- 新增 `src/renderer/utils/persisted-cache.ts` 的 `readPersistedJson(key, validate)`：解析失败或校验失败时删除 key 并返回 `null`。
- 歌单磁盘缓存 `readPlaylistCache` 改用完整校验；失败或 `meta.id` 不匹配时删除文件并返回缺失，触发重新拉取。
- 播放历史、最近歌单改为整份数组校验；任一条目失效就清除该账号 key，按空状态恢复，不再逐条过滤旧条目。
- 设置文件与下载索引属于用户持久数据，不属于缓存，不纳入清除规则；仍按各自加载逻辑回退默认值或跳过非法项。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `IMPL.md` | 新增“本地缓存结构失效即清除重建” | 增 | 记录原则与实现范围。 |
| `CORE.html` | §2 CONVENTIONS · 本地缓存结构校验 | 增 | 声明结构化缓存严格校验、失效清除；设置与下载索引除外。 |
| `CORE.html` | §1 文件树 · shared / utils | 增 | 新增 `validation.ts`、`persisted-cache.ts` 条目。 |
| `CORE.html` | §4.57 `cache/playlist.ts`（`#c4-57`） | 改 | 读取时完整校验并删除损坏文件。 |
| `CORE.html` | §4.61 `stores/playlist.ts`（`#c4-61`） | 改 | 最近歌单整份校验，失败清除 key。 |
| `CORE.html` | §4.86 `stores/history.ts`（`#c4-86`） | 改 | 播放历史整份校验，失败清除 key。 |
| `CORE.html` | §4.103 `validation.ts`（`#c4-103`） | 增 | 记录校验函数与职责边界。 |
| `CORE.html` | §4.104 `persisted-cache.ts`（`#c4-104`） | 增 | 记录 `readPersistedJson` 的失效清除行为。 |

**工作记录**：

- 更新历史 store 测试：损坏条目不再逐条丢弃，而是整份清除；新增结构校验与 `readPersistedJson` 测试。
- `npm run typecheck`、`npm test`（46 个测试文件、214 个用例）与 `npm run build` 通过。

### 4.23 VIP 状态从布尔值改为结构化三态 [已解决] 

**描述**：补充点 6 指出 `isVipUser()` 只返回布尔值，接口失败时与“确实不是 VIP”无法区分；需要确认 QQ 音乐是否提供会员等级信息，并提供后再改进内部 API。

**解决方案**：

- 上游 `vip_login_base` 实际提供 `identity.vip`、`svip`、`identity.HugeVip` / `huge_vip`、`identity.overdate`、`identity.HugeVipEnd` 等字段，不需要另找接口。
- 经同一账号购买超级会员前后对照确认映射：`vip` = 绿钻，`svip` = 豪华绿钻，`HugeVip` / `huge_vip` = 超级会员；购买后 `HugeVip` 从 0 变 1，`svip` 保持不变。
- 新增 `VipStatus`：`state`（known / unknown）、`isVip`、`level`（none / vip / huge_vip / svip）、`expiresAtMs`；超级会员到期读 `HugeVipEnd`，豪华绿钻到期读 `overdate`（缺失时 `LMEnd`），最后回退 `userinfo.expire`。`userinfo.expire` 实测为 `-1`，不能单独作为到期来源。
- `getVipStatus()` 负责查询、映射与缓存：成功缓存 `VIP_CACHE_MS`，失败缓存 `VIP_UNKNOWN_CACHE_MS` 并返回 `unknown`；未登录返回已知非会员。
- `isVipUser()` 保留为兼容包装：已知返回布尔值，未知返回 `null`。
- IPC 由 `user.isVip` 改为 `user.vipStatus`；设置页在已知会员时显示 `VIP` / `SVIP` 徽标，未知或失败时不显示。
- `getStreamUrls` 的 `NO_STREAM` 文案区分已知 VIP、已知非 VIP 与 unknown，不再把查询失败当作非 VIP。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `IMPL.md` | 新增“VIP 状态从布尔值改为结构化三态” | 增 | 记录调查结论与 API 调整。 |
| `CORE.html` | §4.1 `types.ts`（`#c4-1`） | 改 | 新增 `VipLevel` / `VipStatus` 定义。 |
| `CORE.html` | §4.2 `ipc.ts`（`#c4-2`） | 改 | `user.isVip` 改为 `user.vipStatus`。 |
| `CORE.html` | §4.13 `api/user.ts`（`#c4-13`） | 改 | 记录 `getVipStatus()`、`isVipUser()` 兼容包装与缓存策略。 |
| `CORE.html` | §4.48 `SettingsView.vue`（`#c4-48`） | 改 | 徽标改为读取 `vipStatus`，未知不显示。 |
| `CORE.html` | §4.50 `constants.ts`（`#c4-50`） | 改 | 新增 `VIP_UNKNOWN_CACHE_MS`。 |
| `CORE.html` | §5.5 播放单曲调用树 | 改 | 无可用 result 时回退 `getVipStatus()`。 |
| `PROVIDER.html` | §4.1 VIP 状态行 / 数据模型 `QqVipData` | 改 | 记录会员字段、`vip` / `svip` / `HugeVip` 映射与 `HugeVipEnd` / `overdate` 到期来源。 |

**工作记录**：

- 新增 `test/api/vip-status.test.ts`：覆盖绿钻、豪华绿钻（`svip=1`）、超级会员（`HugeVip=1`）、到期时间来源、已知非会员、接口失败返回 unknown 与 `isVipUser() === null`。
- 更新歌曲流测试的 user 模块 mock。
- 使用真实登录态实测 `vip_login_base`：`vip=1`、`HugeVip=0`、`svip=1`、`yearflag=1`、`overdate=2027-03-16`、`userinfo.expire=-1`。账号实际为豪华绿钻、没有超级会员，据此修正此前来自第三方文档的映射：`svip` = 豪华绿钻，`HugeVip` = 超级会员；随后用同一账号购买 3 个月超级会员复测：`HugeVip` 从 0 变为 1，新增 `HugeVipStart/HugeVipEnd`，`svip` 保持不变，确认映射成立。超级会员到期时间读取 `HugeVipEnd`；同时修复 `expiresAtMs` 对 `-1` 的回退。
- `npm run typecheck`、`npm test`（47 个测试文件、221 个用例）与 `npm run build` 通过。

### 4.24 取消 vkey 批量探测，改为元数据判断可播性 [已解决] 

**描述**：排查 104009 风控后确认，根因是歌单页的可用性探测通过批量申请 vkey 实现：每 50 首一批，逐档请求 `flac → 320k → 128k`，一次打开大歌单可能产生数十次 vkey、数百到数千首歌的媒体授权，形态与批量抓取接近。上游没有“不申请播放链接即可判断当前账号可播性”的独立接口；`file.size_*` 只能说明曲库是否存在某档音质，`status` 与 `pay` 字段只能提供状态与付费条件，最终可播性仍由播放时 vkey 决定。因此取消列表级 vkey 探测，改为基于元数据的前置判断，实际播放失败再由 `NO_STREAM` 流程兜底。

**解决方案**：

- 播放权限按“阻断判定栈”派生（特例保留：判定栈以代码块表达，不拆成条目）：

  ```text
  status ∈ {1, 2} → 不可播，结束

  pay_play == 1
  ├── VIP == unknown → 不可播，结束
  ├── VIP < huge_vip
  │   └── pay_month == 0 → 不可播，结束
  └── VIP < vip
      ├── pay_status == 0 → 不可播，结束
      ├── pay_month == unknown → 不可播，结束
      └── pay_month == 1 → 不可播，结束

  未命中任一阻断 → 可播
  ```

- 判定语义：自上而下求值，命中任一阻断即不可播，全部未命中才可播，不写正向可播分支。
- 档位与取值：`none < vip < huge_vip < svip`；`VIP < L` 只比较已知档位；`VIP == unknown`（接口失败或未返回）直接阻断；`pay_month == 0` 要求 `huge_vip` 及以上，`1` 与 `unknown`（缺失、非数值或无法识别）要求 `vip` 及以上；`pay_status` 仅在 `VIP < vip` 分支生效，仅 `0` 阻断。
- 不参与阻断：`status == 3`、`price_track` / `price_album`、`time_free`、`size_try`；`status` / `pay_play` 缺失不阻断。
- VIP 字段映射：`vip` = 绿钻，`svip` = 豪华绿钻，`HugeVip` = 超级会员（同一账号购买前后对照确认）。
- 模型：`Song` 增加 `status`、`pay_play`、`pay_month`、`pay_status`，由 `toSong()` / `rawSongToSong()` 映射；播放历史与歌单缓存同步持久化。
- 校验：`shared/validation.ts` 的 `isSong` 要求新字段；旧歌单缓存、播放历史、最近歌单按 IMPL 4.22 整份清除并重新获取。
- 删除探测链路：`useAvailability`、`song.probe` IPC / preload、`api/availability.ts` 的 `probeAvailability`、`PROBE_*` 常量；`resolveStreamUrls` 只保留给真实播放与下载。
- `PlaylistView`：移除 `useAvailability` / `setProbeState`；队列快照不再按 `playable === false` 过滤，`metadataReady()` 不再依赖探测结果。
- 新增 `shared/permission.ts` 的 `playbackPermission(song, vip)` 作为判定栈唯一实现；`SongTable` 的不可播标记、播放 / 下载按钮禁用与音质角标统一读取其返回值。
- 会员状态进入 `stores/auth.ts` 的全局 `vip`：登录态变化时查询 `user.vipStatus`，失败保持 `unknown`，退出登录重置为已知 `none`。
- 下载资产：移除 `SongAssetState.maxQuality` 与 `peekAvailability` 依赖；音质角标改由 `Song.maxQuality`（`file.size_*` 派生）提供。
- 播放：不可播、区域限制与失败只在播放时处理；保留 `NO_STREAM` 沿队列向后尝试与连续 10 首停止。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `IMPL.md` | 新增“取消 vkey 批量探测，改为元数据判断可播性” | 增 | 记录根因、阻断判定栈（解决方案内的特例）与待办文档操作。 |
| `USER.html` | §5.2.3 / §5.2.4 / §5.2.8 | 改 | 删除探测驱动的“最高可用音质 / 不可播标记”描述；音质角标改为“曲库最高音质”；元数据已判定不可播的歌曲显示标记，其余默认可播、播放失败由 `NO_STREAM` 兜底。 |
| `USER.html` | §5.3.1 Toast · 合并 | 不动 | 既有“连续不可播跳歌”汇总提示描述的是播放失败，与新逻辑一致。 |
| `CORE.html` | §4.1 `types.ts`（`#c4-1`） | 改 | `Song` 增加 `status` / `pay_play` / `pay_month` / `pay_status` / `maxQuality`，新增 `PlaybackPermission`；删除 `SongAvailability` / `ProbeOptions`。 |
| `CORE.html` | §4.105 `permission.ts`（`#c4-105`） | 增 | 新增阻断判定栈、档位比较与 `unknown` 语义。 |
| `CORE.html` | §4.11 `song.ts`（`#c4-11`） | 改 | `toSong()` 映射新增字段与 `maxQuality`；`VKEY_BATCH_SIZE` / `SONG_DETAIL_CONCURRENCY` 改名。 |
| `CORE.html` | §4.28 `auth.ts`（`#c4-28`） | 改 | 新增全局 `vip` 与 `loadVip()`。 |
| `CORE.html` | §4.39 `SongTable.vue`（`#c4-39`） | 改 | 音质 / 不可播标记改为读取 `PlaybackPermission`，不再接收 `availability`。 |
| `CORE.html` | §4.46 `PlaylistView.vue`（`#c4-46`） | 改 | 删除 `useAvailability`、`setProbeState`，播放 / 下载全部改按权限过滤。 |
| `CORE.html` | §4.52 `api/availability.ts`（`#c4-52`） | 删 | 删除整个探测模块与 `probeAvailability` / `peekAvailability`。 |
| `CORE.html` | §4.61 `stores/playlist.ts`（`#c4-61`） / §4.65 队列快照 | 改 | 删除 `playable !== false` 过滤与 `metadataReady()` 的探测门控。 |
| `CORE.html` | §4.65 `composables/availability.ts`（`#c4-65`） | 删 | 删除探测调度与 `song.probe` 调用。 |
| `CORE.html` | §4.101 `SongListTable.vue`（`#c4-101`） | 改 | 删除 `availability` prop 透传。 |
| `CORE.html` | §4.103 `validation.ts`（`#c4-103`） | 改 | `isSong` 要求权限字段；旧缓存整份失效。 |
| `CORE.html` | §4.2 `ipc.ts` / §4.50 `constants.ts` | 改 | 删除 `song.probe` IPC 与 `PROBE_*` 常量；保留并改名 `VKEY_BATCH_SIZE` / `SONG_DETAIL_CONCURRENCY`。 |
| `CORE.html` | §1 文件树 / §2 CONVENTIONS | 改 | 删除 `api/availability.ts`、`composables/availability.ts`、`utils/queue.ts`；新增 `shared/permission.ts`；队列快照与可播性判定约定同步。 |
| `CORE.html` | §5.11 可播性判定与播放兜底（`#c5-11`） | 改 | 删除 vkey 探测调用树，改为阻断判定栈与 `NO_STREAM` 兜底。 |
| `CORE.html` | §5.5 播放单曲 / §5.16 下载 | 不动 | 既有调用树已经只描述真实播放与下载取流，与“列表不申请播放链接”一致。 |
| `PROVIDER.html` | §4.1 / §4.3 `QqSong` | 改 | 补充 `status`、`pay.pay_play` / `pay_month` / `pay_status`、`file.size_*` 的消费语义；删除“用于候选音质”的探测描述。 |
| `README.md` / `ABOUT.html` | 歌单 / 歌曲列表行 | 改 | 删除探测驱动的“最高可用音质”承诺；音质角标改为“曲库最高音质”，不可播标记改由元数据判定。 |

**工作记录**：

- 本节按 GUIDELINES 的 IMPL 格式整理为 描述 / 解决方案 / 文档操作 / 工作记录；判定栈作为解决方案内的特例以代码块保留。
- 判断逻辑改为纯阻断判定栈：`status` 与 `pay_play=1` 下三个并列轴（`VIP == unknown`、`VIP < huge_vip`、`VIP < vip`）嵌套公共前缀；可播只由“未命中任一阻断”得出。`unknown` 单独作为第一分支无条件阻断，已知 `none` 由档位比较拦截。
- 代码实现：新增 `src/shared/permission.ts` 与 `test/permission.test.ts`；`Song` 增加权限字段与 `maxQuality`；删除 `src/main/api/availability.ts`、`src/renderer/composables/availability.ts`、`src/renderer/utils/queue.ts` 及其测试；`SongAssetState.maxQuality` 移除。
- 校验器要求新字段，旧歌单缓存、播放历史与最近歌单按 4.22 整份清除重建；播放历史持久化改为先取原始对象再序列化，避免 1000 条列表逐字段穿过响应式代理导致测试超时。
- `npm run typecheck`、`npm test`（47 个测试文件、226 个用例）与 `npm run build` 通过。

### 4.25 全局快捷键与设置页改键 [已解决] 

**描述**：TODO 第 4 项要求窗口内支持空格播放 / 暂停、`Ctrl + ←` / `Ctrl + →` 上一首 / 下一首、`Ctrl + D` 喜欢当前歌曲、`Ctrl + S` 收藏当前歌曲到歌单，并在设置页提供快捷键配置。

**解决方案**：

- 新增 `shared/shortcuts.ts`：集中定义 `DEFAULT_SHORTCUTS`、动作顺序与标签、结构校验、按键匹配、录制转换与显示格式化；`ShortcutKeyInput` 只声明按键与修饰键，避免主进程编译单元依赖 DOM 类型。
- `Settings` 增加 `shortcuts`；主进程 `settings.ts` 逐项校验，缺失或非法项回退默认；渲染层 `defaultSettings()` 提供同一份默认值。
- `App.vue` 的全局 `keydown` 先处理 Esc，再按 `Settings.shortcuts` 匹配动作；输入框 / 文本域 / 可编辑区域、`event.repeat`、输入法组合中与已打开弹窗不响应，空格在按钮 / 链接上保留原生激活行为，命中后 `preventDefault`。
- 动作直接复用现有入口：`player.toggle()`、`player.previous()`、`player.playNext()`、`playlistEdit.toggleFavorite()`、`ui.openSongPicker()`。
- `ui` store 新增全局 `songPicker` 请求；`PlayerBar` 的收藏弹层与 `Ctrl + S` 共用同一选择器，Esc / 选择完成 / 关闭统一清理。
- 设置页新增“快捷键”面板：点击进入录制态，window 捕获阶段拦截按键并阻止全局快捷键；只按修饰键不生效，Esc 取消，冲突时提示占用，保存即时写盘，“恢复默认”重置全部动作。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 4 项“窗口内支持基本的播放控制” | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“全局快捷键与设置页改键” | 增 | 记录需求、实现方案与文档操作。 |
| `USER.html` | §2 CONVENTIONS · 全局快捷键 | 增 | 记录默认键位、输入框 / 弹窗边界与可改键。 |
| `USER.html` | §5.2.3 播放条 | 改 | 播放控制与喜欢 / 收藏到歌单同时绑定全局快捷键。 |
| `USER.html` | §5.2.7 设置页 | 改 | 原型增加快捷键面板；记录录制、冲突、Esc 取消与恢复默认；`Settings.shortcuts` 持久化字段。 |
| `CORE.html` | §1 文件树 / §4.1 `types.ts` | 改 | 新增 `shared/shortcuts.ts`；`Settings` 增加 `shortcuts`，新增 `ShortcutAction` / `ShortcutBinding` / `Shortcuts`。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） | 改 | 记录全局 keydown 的匹配顺序、可编辑目标与弹窗边界。 |
| `CORE.html` | §4.31 `stores/ui.ts`（`#c4-31`） | 改 | 新增全局 `songPicker` 与开关方法。 |
| `CORE.html` | §4.48 `SettingsView.vue`（`#c4-48`） | 改 | 记录快捷键面板、录制拦截与保存行为。 |
| `CORE.html` | §4.106 `shortcuts.ts`（`#c4-106`） | 增 | 记录默认值、校验、匹配、录制与格式化接口。 |
| `CORE.html` | §5.24 全局快捷键（`#c5-24`） | 增 | 记录 keydown → 动作 → 现有播放 / 收藏 / 选择器入口的调用树。 |
| `README.md` / `ABOUT.html` | 用户交互 · 快捷键行 | 增 | 记录默认键位与设置页可改键。 |

**工作记录**：

- 新增 `test/shortcuts.test.ts`、`test/ui-store.test.ts` 与设置持久化用例，覆盖默认键位格式化、修饰键精确匹配、录制归一化、非法绑定回退、改键落盘与全局选择器开关。
- 按 review 反馈为“恢复默认”动作区增加 16px 上间距，避免紧贴最后一行设置项而下方留白过多。
- `npm run typecheck`、`npm test`（49 个测试文件、236 个用例）与 `npm run build` 通过。
- 键盘交互未做真实 GUI 自动化验收；共享匹配函数与设置持久化由单测覆盖，全局事件链路由类型检查与实现审阅确认。

### 4.26 歌曲 MV 检测与播放条入口 [已解决] 

**描述**：TODO 第 5 项要求确定歌曲与 MV 是否存在现成绑定；存在则直接绑定，不存在再按歌曲信息模糊匹配。检测到 MV 后在播放条歌名与音质之后增加一个矮长方形、圆角内嵌播放三角形的 MV 按钮。

**解决方案**：

- 调查结论：上游歌曲模型自带 `mv.vid` 绑定。既有 fixture 中 `album-songs.json` / `singer-songs.json` 的歌曲均带嵌套 `mv`，非空时 `vid` 可直接作为 MV ID；歌手歌曲接口另有扁平 `vid`。因此采用现成绑定，不做按标题模糊匹配。
- `Song` 增加 `mvId`；`toSong()` 优先取 `mv.vid`，缺失时回退扁平 `vid`，空值写空字符串。`shared/validation.ts` 的 `isSong` 同步要求该字段，旧歌单缓存、播放历史与最近歌单按 4.22 整份清除。
- `api/song.ts` 的 `TrackMeta` 缓存增加 `mvId`；新增 `getMvId(mid)`：优先读取流已缓存的详情，未命中时单曲补拉 `CgiGetTrackInfo`。新增 `song.getMvId` IPC / preload。
- `PlayerBar` 在音质标记后渲染 MV 入口：`mvId` 非空时显示 26×18px 圆角边框 + 9px 播放三角，`RouterLink` 进入 `/mv/:id`；无绑定隐藏。搜索 / 推荐等列表未携带绑定时，等 `player.loading` 结束再补查，复用取流缓存，切歌用请求序号丢弃旧结果。
- 不新增模糊匹配与额外搜索请求；补查失败或无绑定时不显示按钮，不影响播放。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 5 项“歌曲MV检测” | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“歌曲 MV 检测与播放条入口” | 增 | 记录绑定调查结论、实现方案与文档操作。 |
| `USER.html` | §5.2.3 播放条 | 改 | 原型加入 MV 入口；记录显示条件、按钮形态与补查时机。 |
| `CORE.html` | §4.1 `types.ts`（`#c4-1`） | 改 | `Song` 增加 `mvId`。 |
| `CORE.html` | §4.2 `ipc.ts`（`#c4-2`） | 改 | 新增 `song.getMvId`。 |
| `CORE.html` | §4.11 `song.ts`（`#c4-11`） | 改 | 记录 `mv.vid` / 扁平 `vid` 映射、`getMvId` 与详情缓存。 |
| `CORE.html` | §4.40 `PlayerBar.vue`（`#c4-40`） | 改 | 记录 MV 入口渲染条件、补查时机与切歌请求序号。 |
| `CORE.html` | §4.103 `validation.ts`（`#c4-103`） | 改 | `isSong` 要求 `mvId`，旧缓存整份失效。 |
| `CORE.html` | §5.25 歌曲 MV 检测（`#c5-25`） | 增 | 记录播放条 → IPC → 缓存 / 详情补查的调用树。 |
| `PROVIDER.html` | §4.3 `QqSong` | 改 | 补充 `mv.vid` / 扁平 `vid` 字段与 `mvId` 转换，注明无需模糊匹配。 |
| `README.md` / `ABOUT.html` | 用户交互 · 播放行 | 改 | 补充 MV 入口。 |

**工作记录**：

- 新增歌曲详情测试：`mv.vid` 映射、缓存命中不重复请求、无绑定返回空字符串。
- `npm run typecheck`、`npm test`（49 个测试文件、239 个用例）与 `npm run build` 通过。
- 绑定字段来自既有录制 fixture；未用真实账号再次拉取验证。缺失绑定或补查失败时按钮隐藏，不影响播放。

### 4.27 移除应用内悬停 tooltip [已解决] 

**描述**：ISSUE 指出侧栏“退出”按钮悬停时出现突兀的原生 tooltip；要求删除该提示，定义禁用 tooltip 的规则并清理所有悬停 tooltip。

**解决方案**：

- 移除渲染层全部 DOM 元素的 `title` 属性，包括按钮、链接、截断文本、状态标记、图片与进度条；退出按钮不再出现悬停提示。
- 图标按钮保留或补齐 `aria-label` 作为无障碍名称；有可见文字或已有 `aria-label` 的控件只删除 `title`，不改变可访问名称来源。
- 组件 `title` prop（确认框 / 删除下载弹层标题）属于对话框标题，不是悬停提示，保持不变；系统托盘 tooltip 属于操作系统界面，保持现状。
- 删除因此不再使用的 `App.vue` `targetThemeLabel()` 与 `PlayerBar.vue` `bufferLabel`。
- `USER.html` §2 新增“悬停提示”约定，并清理相关章节对 tooltip 的描述；`CORE.html` 同步为“无障碍名称”表述。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 退出按钮 tooltip 条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“移除应用内悬停 tooltip” | 增 | 记录需求、实现范围与规则。 |
| `USER.html` | §2 CONVENTIONS · 悬停提示 | 增 | 应用内禁用原生 `title`；图标按钮用 `aria-label`；托盘 tooltip 除外。 |
| `USER.html` | §2 界面文案 / §5.2.3 播放条 / §5.2.4 歌曲列表 / §5.2.9 播放队列 | 改 | 删除 tooltip 描述，改为无障碍名称或直接移除。 |
| `CORE.html` | §4.23 `App.vue` / §4.39 `SongTable.vue` / §4.40 `PlayerBar.vue` / §4.79 `download-state.ts` | 改 | 把 tooltip 描述改为无障碍名称，并删除无用的 tooltip 派生值。 |

**工作记录**：

- 渲染层仅保留 6 处组件 `title` prop（确认框 / 删除下载弹层标题），DOM 元素无 `title`。
- `npm run typecheck`、`npm test`（49 个测试文件、239 个用例）与 `npm run build` 通过。

### 4.28 窄屏侧栏展开占满视口并覆盖播放条 [已解决] 

**描述**：ISSUE 指出窄屏模式下展开的导航抽屉只到播放条上沿，未占满屏幕高度；要求抽屉覆盖播放条，且变暗遮罩覆盖包括播放条在内的整个剩余屏幕。

**解决方案**：

- ≤900px 的 `.sidebar` 由 `top: 0; bottom: var(--player-height)` 改为 `top: 0; bottom: 0`，展开时占满整个视口高度，覆盖播放条；z-index 45 保持高于播放条的 30。
- `.sidebar-backdrop` 由 `inset: 0 0 var(--player-height) 0` 改为 `inset: 0`，遮罩覆盖整个屏幕，包括播放条。
- 内容区仍不被压缩；关闭、拖拽吸附、焦点回收等既有行为不变。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 窄屏导航抽屉条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“窄屏侧栏展开占满视口并覆盖播放条” | 增 | 记录改动与文档操作。 |
| `USER.html` | §5.2.2 侧栏与导航 | 改 | 抽屉展开占满视口高度并覆盖播放条；遮罩覆盖整个屏幕。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） | 改 | 记录抽屉覆盖内容区与播放条、backdrop 全屏。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 记录 `.sidebar` 的 `bottom: 0` 与 `.sidebar-backdrop` 的 `inset: 0`。 |

**工作记录**：

- 纯 CSS 调整，未改动组件结构或交互逻辑。
- `npm run typecheck`、`npm test` 与 `npm run build` 通过。

### 4.29 歌词纯斜杠译文占位改为空行 [已解决] 

**描述**：ISSUE 指出上游用 `//` 表示无译文时，界面显示为 `●●●` 仍然突兀；要求改为空行。

**解决方案**：

- `utils/lrc.ts` 的 `normalizeTranslationText` 把纯斜杠规范化为空字符串，不再生成 `●●●`。
- 时间戳译文不再过滤空文本条目，保证占位行仍占据行序；`LyricsPanel` 只输出非空译文，空字符串不生成译文元素，后续译文不会因过滤而整体错位，也不显示多余空行。
- 无时间戳译文继续按行序处理；纯斜杠行同样保留位置并显示为空。
- 译文开关仍按“存在非空译文”判断；全部为占位行时不显示开关。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 歌词纯斜杠占位条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“歌词纯斜杠译文占位改为空行” | 增 | 记录规范化与行序保持方式。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 纯斜杠占位由“三个大圆点”改为“空行”。 |
| `CORE.html` | §4.33 `utils/lrc.ts`（`#c4-33`） | 改 | 记录占位行规范化为空字符串并保留行序。 |

**工作记录**：

- 更新 `test/lyric.test.ts`：占位行返回空字符串，且其后的译文仍按行序对齐。
- `npm run typecheck`、`npm test` 与 `npm run build` 通过。

### 4.30 MV 搜索卡片跑马灯与歌手链接 [已解决] 

**描述**：ISSUE 指出 MV 搜索结果卡片没有跑马灯，长标题 / 歌手名显示不全；且歌手名只是纯文本，无法点击进入歌手页。

**解决方案**：

- `MvSummary` 增加 `singers: Singer[]`；`api/mv.ts` 的 `toSummary` / `getMvDetail` 从 `singer_list` / `singers` 映射结构化歌手并保留 `mid`，同时继续生成拼接文案 `singerName`。
- `MarqueeText` 支持默认插槽：`text` 改为可选；插槽内容按实际宽度测量并可滚动，第二份循环副本加 `inert` 与 `aria-hidden`，避免重复链接参与点击或焦点。
- `SearchView` 的 MV 卡片由 `<button>` 改为 `div[role="button"]`，标题使用 `MarqueeText`；歌手行使用带插槽的 `MarqueeText`，带 `mid` 的歌手渲染为 `RouterLink`（`/artist/:mid`）并 `@click.stop` / `@keydown.stop`，避免触发卡片跳转；点击卡片其余区域或 Enter 进入 `/mv/:id`。
- 增加 `.mv-card` 指针光标；窄屏两列布局不变。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | MV 搜索跑马灯与歌手点击条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“MV 搜索卡片跑马灯与歌手链接” | 增 | 记录结构化歌手、插槽跑马灯与卡片交互。 |
| `USER.html` | §5.2.8 搜索页 | 改 | MV 卡片标题 / 歌手跑马灯，歌手可点击进入歌手页。 |
| `CORE.html` | §4.38 `MarqueeText.vue`（`#c4-38`） | 改 | 记录可选 `text` 与默认插槽、`inert` 循环副本。 |
| `CORE.html` | §4.44 `SearchView.vue`（`#c4-44`） | 改 | 记录 MV 卡片结构、歌手链接与点击边界。 |
| `CORE.html` | §4.56 `mv.ts`（`#c4-56`） | 改 | 记录 `singer_list` 同时映射 `singerName` 与 `singers[]`。 |
| `README.md` / `ABOUT.html` | 搜索行 | 改 | 补充 MV 卡片跑马灯与歌手链接。 |

**工作记录**：

- 更新 MV 搜索与详情的映射测试，覆盖 `singers[]` 保留 `mid`。
- `npm run typecheck`、`npm test`（49 个测试文件、239 个用例）与 `npm run build` 通过。
- 未做真实窗口截图验收；卡片交互由模板结构与类型检查确认。
