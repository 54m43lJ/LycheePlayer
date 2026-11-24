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

### 4.31 评论媒体加载失败占位改为撕裂纸张 [已解决] 

**描述**：ISSUE 指出评论内表情 / 附图加载失败时使用的“折角纸张 + 右下角 X”图标不理想，要求改为纸中间断裂的占位图标，去掉叉号，并优化尺寸使其与文字行对齐。

**解决方案**：

- `AppIcon` 新增 `paper-torn`：由左右两片锯齿边缘的纸张与折角线组成，中间形成断裂缝隙，不包含叉号；移除不再使用的 `file-broken`。
- `CommentsPanel` 的表情占位与附图占位统一改用 `paper-torn`。
- 表情占位由固定 20×20px / `vertical-align: -4px` 改为随字号缩放的 `1.15em`，图标本身 `0.95em`，并以 `vertical-align: -0.18em` 与正文基线对齐；附图占位保持 56×42px 块状尺寸。
- 刷新评论、切歌时仍清空失败记录并重新尝试加载，行为不变。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 评论媒体加载失败占位条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“评论媒体加载失败占位改为撕裂纸张” | 增 | 记录图标、尺寸与对齐调整。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 占位改为纸中间锯齿断裂图标，表情占位随字号缩放并与正文行对齐。 |
| `CORE.html` | §4.36 `AppIcon.vue`（`#c4-36`） | 改 | 记录 `paper-torn` 图标用途。 |
| `CORE.html` | §4.41 `CommentsPanel.vue`（`#c4-41`） | 改 | 记录占位图标与表情占位的字号 / 基线规则。 |

**工作记录**：

- `npm run typecheck`、`npm test`（49 个测试文件、239 个用例）与 `npm run build` 通过。
- 按 review 反馈把初版“左右两片纸”改为参考图的形态：折角纸张 + 中段人字形断裂缝隙。
- 图标实际以约 12–14px 显示，进一步把裂缝加宽到 3px 网格单位并去掉横向小肩部，只保留大 V 形断裂，避免小尺寸下细节糊掉。
- 未做真实评论截图验收；图标路径与尺寸由代码审阅确认。

### 4.32 歌词译文开关改为无边框“译”字按钮 [已解决] 

**描述**：ISSUE 要求把歌词译文开关从“译文 + 轨道开关”改为一个简单的不带边框的“译”字按钮；点击切换译文，开启时用高亮背景表示状态。

**解决方案**：

- `LyricsPanel` 的译文开关移除“译文”文案与 `.lyrics-trans-switch` 轨道，只保留单个“译”字。
- 按钮保持 28×28px 圆角方块，去掉边框、面板底色、阴影与背景模糊；默认透明背景 + muted 文字，悬停使用 `--subtle-bg`，开启时背景 `--accent-soft`、文字 `--accent-strong`。
- 保留 `aria-pressed` 与动态 `aria-label`（显示 / 隐藏译文），键盘与屏幕阅读器行为不变。
- 默认关闭与“重新居中当前行”的切换逻辑不变；无译文时不显示按钮。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 歌词译文开关条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“歌词译文开关改为无边框‘译’字按钮” | 增 | 记录按钮形态与状态样式。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 左下角为无边框“译”字按钮，开启时高亮背景。 |
| `CORE.html` | §4.41 `LyricsPanel.vue`（`#c4-41`） | 改 | 记录 28×28px 单字按钮与无障碍状态。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 记录无边框、透明背景与开启态配色。 |
| `README.md` / `ABOUT.html` | 歌词 / 评论行 | 改 | “译文开关”改为“译”字按钮。 |

**工作记录**：

- `npm run typecheck`、`npm test`（49 个测试文件、239 个用例）与 `npm run build` 通过。
- 未做真实歌词截图验收；状态样式由 CSS 与模板确认。

### 4.33 播放条短歌名末尾多余空白 [已解决] 

**描述**：ISSUE 指出 Marino - Im Doing Fine 的歌名在播放条里右侧出现明显多余空白。该曲歌名较短，但歌手行“Marino / Promoting Sounds · Im Doing Fine”较长，播放条标题行被撑到歌手行宽度后，`.player-title` 的 `flex: 1 1 auto` 把音质标记与 MV 入口推到列尾，短歌名与标记之间留下大段空白。

**解决方案**：

- `.player-title` 由 `flex: 1 1 auto` 改为 `flex: 0 1 auto`，与歌曲表 `.song-title .marquee` 的既有规则一致：歌名按内容宽度显示，超宽时才收缩并跑马灯滚动。
- 音质标记与 MV 入口紧随歌名，不再被 `flex-grow` 推到标题行右端；标题行宽度仍由较长的歌手行或可用宽度决定，不影响跑马灯的溢出判断。
- 歌手行、MV 补查、音质标记与 MV 按钮的渲染逻辑不变。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | Marino 歌名多余空白条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“播放条短歌名末尾多余空白” | 增 | 记录根因、布局修正与文档操作。 |
| `USER.html` | §5.2.3 播放条 | 改 | “音质标记固定最右”改为歌名按内容宽度显示、音质标记与 MV 按钮紧随歌名，短歌名不被撑满的跑马灯推到列尾。 |
| `CORE.html` | §4.40 `PlayerBar.vue`（`#c4-40`） | 改 | 记录标题行使用 `MarqueeText`、标记紧随歌名，并链接 §4.49。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 增加 `.player-title` 使用 `flex: 0 1 auto` 的规则与行为说明。 |
| `README.md` / `ABOUT.html` | 播放行 | 不动 | 既有文案未承诺标题与音质标记的横向排列，无需改动。 |

**工作记录**：

- 用 Chromium 复现布局：344px 信息列、歌手行较长时，旧规则下歌名文本与 FLAC 标记之间约 102px 空白；改为 `flex: 0 1 auto` 后间距回到 8px，歌名按内容宽度显示。
- `npm run typecheck`、`npm test`（49 个测试文件、239 个用例）与 `npm run build` 通过。
- 未做真实播放窗口截图验收；该缺陷为纯 CSS 伸缩规则，已用浏览器布局测量确认。

### 4.34 会员状态术语、图标与展示位置统一 [已解决] 

**描述**：ISSUE 要求统一会员状态的展示：`绿钻`、`豪华绿钻`、`超级会员` 作为术语明确并与上游字段映射；三者分别使用绿色实心钻石、绿色钻石 + 右下金色 V、金色钻石 + 中央暗金 V 的图标；侧栏账号入口只显示图标，设置页显示图标 + 文字。排查发现内部 `VipLevel` 的命名与上游字段名相反：上游 `svip` 是豪华绿钻，却被映射成 `level='huge_vip'`；上游 `HugeVip` 是超级会员，却被映射成 `level='svip'`。设置页据此只显示 `VIP` / `SVIP`，豪华绿钻还会显示成 `VIP`。

**解决方案**：

- 术语与档位统一：`VipLevel` 改为 `none / vip / deluxe / super`，分别表示非会员 / 绿钻 / 豪华绿钻 / 超级会员；`identity.vip` → `vip`，`svip` → `deluxe`，`identity.HugeVip` / `huge_vip` → `super`，`VipStatus.level` 取最高档。
- 播放权限的档位顺序同步为 `none < vip < deluxe < super`，`pay_month === 0` 的阻断条件改读 `deluxe`，判定结果不变。
- 新增 `MemberBadge.vue` 作为会员档位的唯一展示组件：仅 `state='known'`、`isVip` 为真且档位非 `none` 时渲染；图标为 24×24 视框的实心钻石，绿钻为绿色、豪华绿钻为绿色钻石 + 右下金色 V、超级会员为金色钻石 + 中央暗金 V；仅图标时以 `role="img"` + `aria-label` 表达档位。
- 侧栏账号 pill 在昵称右侧渲染 14px 仅图标标记，`user-name-row` 保证昵称省略但不裁掉图标；设置页账号区渲染 16px 图标 + 档位文字，并改用全局 `auth.vip`，删除设置页自己的 `user.vipStatus` 查询与 `VIP` / `SVIP` 徽标。
- 调色板新增 `green` 与 `gold-bright`，语义变量为 `--member-green` / `--member-gold`；钻石边缘由填充色与当前 `bg` 混色，超级会员的暗金 V 使用 `gold`，不引入调色盘外字面量。
- 文档同步修正 PROVIDER 中“`svip` 为超级会员”等旧描述，并补齐 USER 术语、展示约定与调色板。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 会员状态展示条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“会员状态术语、图标与展示位置统一” | 增 | 记录档位命名修正、图标与展示位置。 |
| `USER.html` | §1 TERMS | 增 | 新增会员状态、绿钻、豪华绿钻、超级会员，并注明 `VipStatus.level` 与上游字段映射。 |
| `USER.html` | §2 CONVENTIONS | 增 | 新增“会员状态展示”：仅已知非 `none` 档位显示；统一档位文字、图标形态、侧栏仅图标与设置页图标 + 文字。 |
| `USER.html` | §5.1 调色板 | 改 | 增加 `green` / `gold-bright` 与 `--member-green` / `--member-gold`，补充会员钻石取色规则。 |
| `USER.html` | §5.2.2 侧栏与导航 | 改 | 账号 pill 昵称右侧增加仅图标会员标记；原型同步。 |
| `USER.html` | §5.2.7 设置页 | 改 | 账号区改为档位图标 + 文字（绿钻 / 豪华绿钻 / 超级会员）；原型同步。 |
| `CORE.html` | §1 文件树 | 增 | 新增 `components/MemberBadge.vue`。 |
| `CORE.html` | §4.1 `types.ts`（`#c4-1`） | 改 | `VipLevel` 改为 `none / vip / deluxe / super`，补充档位映射说明。 |
| `CORE.html` | §4.13 `api/user.ts`（`#c4-13`） | 改 | 更新上游字段到新档位的映射与会员徽标入口。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） | 改 | 侧栏账号 pill 昵称右侧渲染仅图标 `MemberBadge`。 |
| `CORE.html` | §4.28 `auth.ts`（`#c4-28`） | 改 | `vip` 同时供播放权限与会员徽标使用，设置页不再单独查询。 |
| `CORE.html` | §4.48 `SettingsView.vue`（`#c4-48`） | 改 | 账号区改用 `auth.vip` 与 `MemberBadge`，删除本地查询与 `VIP` / `SVIP` 徽标。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 增加会员调色板变量与 `.member-badge` 系列样式。 |
| `CORE.html` | §4.105 `permission.ts`（`#c4-105`） | 改 | 档位顺序改为 `none < vip < deluxe < super`，阻断条件同步。 |
| `CORE.html` | §5.11 可播性判定 | 改 | 调用树中的 `huge_vip` 改为 `deluxe`。 |
| `CORE.html` | §4.107 `MemberBadge.vue`（`#c4-107`） | 增 | 记录 props、显隐条件、档位文字、图标形态与无障碍名称。 |
| `PROVIDER.html` | §2 VIP 状态 / §4.1 接口说明 | 改 | 修正为 `identity.vip` = 绿钻、`svip` = 豪华绿钻、`HugeVip` = 超级会员。 |
| `PROVIDER.html` | §4.3 VIP 数据模型 | 改 | `VipStatus.level` 最高档改为 `super > deluxe > vip`。 |
| `README.md` / `ABOUT.html` | 登录行 | 改 | 补充侧栏仅图标、设置页图标 + 文字的会员档位展示。 |
| `DOC/style.css` | 原型样式 | 改 | 增加 `--p-green` 与 `.u-badge.green`，用于会员图标原型。 |

**工作记录**：

- 档位映射沿用 IMPL 4.23 的真实账号购买前后对照结论：`identity.vip` = 绿钻，`svip` = 豪华绿钻，`HugeVip` = 超级会员；本轮只修正内部命名与展示，不改变上游判断依据。
- 新增 `test/member-badge.test.ts`：覆盖绿钻仅图标、豪华绿钻与超级会员的图标 / 文字、未知与非会员不渲染；同步更新 VIP 状态与播放权限测试到新档位名。
- 用 48px 栅格图核对深色 / 浅色图标：绿钻为绿色钻石，豪华绿钻的 V 位于右下侧，超级会员为金色钻石 + 中央暗金 V；14–16px 下形状与对比度可辨。
- 按草稿把初版菱形改为钻石轮廓：平顶桌面 + 下尖亭部，去掉水平腰线；按反馈把钻石加宽到 6:5，V 以 Roboto Black 为参照重建为左右镜像的等宽字形，消除左右笔画粗细不均。豪华绿钻的 V 位于右下区域，超级会员的 V 水平/垂直居中并与四周边框留出间距。
- `npm run typecheck`、`npm test`（50 个测试文件、243 个用例）与 `npm run build` 通过。
- 未用真实会员账号做窗口截图验收；展示由组件 SSR 测试、类型检查与静态图标预览确认。

### 4.35 MV 播放入口与音乐互斥 [已解决] 

**描述**：ISSUE 要求优化 MV 播放交互：播放列表与单曲搜索结果页也要带 MV 按钮；按钮内的播放三角形加大（参考 YouTube 比例并再大一点）；MV 播放与音乐播放互斥，播放一方时暂停另一方；MV 播放页不需要额外的全屏按钮，播放控件自带全屏；MV 播放需要记住音量。

**解决方案**：

- 新增 `MvButton.vue` 作为歌曲 MV 入口的唯一实现：根节点为 `RouterLink`，`mvId` 为空时不渲染；沿用 26×18px 的 `.mv-mark` 外观，播放三角默认 13px（原 9px），无障碍名称“播放 MV”；`@click.stop` / `@dblclick.stop` 避免触发行播放 / 队列移除。
- 播放条改用 `MvButton`；歌曲表在标题徽标之后渲染同一按钮（歌单、搜索单曲结果、专辑、歌手、历史等所有 `SongTable` 场景），播放队列行在歌名后渲染；列表只读取 `Song.mvId`，无绑定不显示，不逐行补查。
- 队列 `.song-title` 改为 flex，歌名由 `.queue-title` 单独省略，MV 图标不被压缩；歌曲表 `.song-mv` 与队列 `.queue-mv` 使用 6px 左间距。
- `MvView` 增加互斥：视频 `play` 事件在 `player.status === 'playing'` 时调用 `player.pause()`；监听 `player.status`，变为 `playing` 时调用视频 `pause()`。互斥只暂停，不切换当前歌曲、队列或 MV 路由。
- `MvView` 移除页面内的“全屏”按钮与 `fullscreen()`，全屏 / 退出全屏只使用原生视频控件；页面保留清晰度切换与失败重试。
- MV 音量复用播放器已有的全局音量与 `localStorage['lychee.volume']`，不新增存储：`loadedmetadata` 时写入视频并取消静音，`volumechange` 时写回 `player.setVolume()`，同时监听 `player.volume` 双向同步。
- 修正 CORE / USER 中“MV 播放与音频播放互不影响”的旧描述，改为统一互斥规则。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | “优化MV播放交互”条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“MV 播放入口与音乐互斥” | 增 | 记录按钮复用、列表入口与互斥实现。 |
| `USER.html` | §2 CONVENTIONS | 增 | 新增“MV 与音乐互斥”：开始播放一方暂停另一方，仅暂停不切换歌曲 / 队列 / 页面。 |
| `USER.html` | §5.2.3 播放条 | 改 | MV 按钮改为 26×18px、13px 播放三角；链接 §2 互斥规则。 |
| `USER.html` | §5.2.4 歌曲列表 | 改 | 标题徽标后显示同一 MV 按钮，点击进入 MV 页且不触发行播放；无绑定不显示、不逐行补查。 |
| `USER.html` | §5.2.8 MV 播放 | 改 | 补充 MV 与音乐互斥；明确全屏由原生控件提供，页面不额外放置全屏按钮；MV 音量复用并持久化全局音量。 |
| `USER.html` | §5.2.9 播放队列 | 改 | 队列行歌名后显示 MV 按钮，点击不触发移除。 |
| `CORE.html` | §1 文件树 | 增 | 新增 `components/MvButton.vue`。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） | 改 | 队列行增加 MV 按钮，沿用行内标题布局。 |
| `CORE.html` | §4.39 `SongTable.vue`（`#c4-39`） | 改 | 标题徽标后渲染 `MvButton`，阻止行播放事件。 |
| `CORE.html` | §4.40 `PlayerBar.vue`（`#c4-40`） | 改 | MV 入口改用 `MvButton`，三角由 9px 增大到 13px。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 记录 `.mv-mark` 尺寸、`.song-mv` / `.queue-mv` 间距与队列标题 flex / 省略结构。 |
| `CORE.html` | §4.56 `api/mv.ts`（`#c4-56`） | 改 | 删除“MV 播放与音频播放互不影响”，互斥归属渲染层。 |
| `CORE.html` | §4.69 `MvView.vue`（`#c4-69`） | 改 | 记录 video play → `player.pause()` 与 `player.status` → video pause 的互斥链路；删除页面全屏按钮，全屏交由原生控件；记录音量复用 `player.volume` 的双向同步。 |
| `CORE.html` | §4.108 `MvButton.vue`（`#c4-108`） | 增 | 记录 props、路由、13px 三角与事件阻断。 |
| `CORE.html` | §5.15 MV 播放（`#c5-15`） | 改 | 调用树补充 MV ↔ 音乐互斥、全屏原生控件与音量持久化调用。 |
| `PROVIDER.html` | MV 接口 | 不动 | 互斥属于渲染层媒体状态，不改变上游协议。 |
| `ISSUE.md` | 子项“MV播放页不需要额外的全屏按钮” | 不动 | 随父项统一标记为已解决，未单独追加标记。 |
| `ISSUE.md` | 子项“MV播放能否记住音量？” | 不动 | 随父项统一标记为已解决，未单独追加标记。 |
| `README.md` / `ABOUT.html` | 播放行 | 改 | 补充歌曲表 / 队列 MV 入口与互斥规则。 |

**工作记录**：

- 新增 `test/mv-button.test.ts`：覆盖链接目标、无障碍名称、默认 13px 三角、自定义尺寸与空 `mvId` 不渲染。
- 用 4× 放大图对比 9 / 11 / 13 / 15px 三角，选择 13px：在 26×18px 按钮内明显大于原尺寸，同时不挤压边框。
- 移除 MV 页的额外全屏按钮与 `requestFullscreen()` 调用，全屏行为回归原生 `<video controls>`。
- 原生 `<video>` 没有跨会话音量记忆；直接复用播放器已有的 `player.volume` 与 `lychee.volume` 持久化，未新增 `Settings` 字段或存储键。MV 音量与音乐音量共用同一全局值，任一侧调整都会同步。
- `npm run typecheck`、`npm test`（51 个测试文件、246 个用例）与 `npm run build` 通过。
- 未做真实 MV 与音乐同时播放的窗口验收；互斥由 `MvView` 的事件 / 状态监听实现，类型检查与代码审阅确认。

### 4.36 窄屏歌词 / 评论分页手势限定在分页轨道内 [已解决] 

**描述**：ISSUE 询问能否把窄屏歌词 / 评论页的拖动效果限制在元素内，使其它位置仍支持横向拖动唤起侧栏抽屉。原实现只要 `ui.lyricsOpen` 为真，`App.vue` 的窄屏侧栏拖拽在 `pointerdown` / `pointerup` 全部提前返回，导致弹出层头部、播放条等非分页区域也无法拖动唤起侧栏。

**解决方案**：

- `App.vue` 的 `onPointerDown` 不再因为歌词 / 评论打开而整体返回；仅当按下点位于 `.lyrics-page-track`（歌词 / 评论分页轨道）内时跳过侧栏拖拽，仍保留输入框、按钮、链接、`[role="button"]` 与 `.range` 的排除规则。
- `onPointerUp` 不再在 `ui.lyricsOpen` 时清空拖拽起点；从轨道外开始的手势按既有 60px 阈值打开 / 收起侧栏。
- 分页逻辑仍完全由 `LyricsOverlay` 的轨道指针事件处理；轨道内拖动不会同时触发侧栏，轨道外拖动不会触发分页。
- 同步更新侧栏手势、歌词 / 评论分页与组件职责说明。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 窄屏歌词 / 评论拖动范围条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“窄屏歌词 / 评论分页手势限定在分页轨道内” | 增 | 记录原限制与轨道内外的分工。 |
| `USER.html` | §2 CONVENTIONS · 侧栏手势 | 改 | 改为分页手势只在分页轨道内生效；轨道外仍可拖动唤起侧栏，左边缘 revealer 保留。 |
| `USER.html` | §5.2.2 侧栏与导航 | 改 | 同步弹出层打开时轨道内 / 外的拖拽边界。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 同步分页手势范围；轨道外仍可唤起侧栏抽屉。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） | 改 | 记录 `onPointerDown` 只跳过 `.lyrics-page-track`，`onPointerUp` 不再因 `lyricsOpen` 清空起点。 |
| `CORE.html` | §4.72 `LyricsOverlay.vue`（`#c4-72`） | 改 | 改为按元素范围隔离分页手势，不再声明整体独占。 |
| `README.md` / `ABOUT.html` | 无 | 不动 | 用户交互摘要未描述该手势边界。 |

**工作记录**：

- 这次只调整手势归属判断，未修改分页阈值、方向仲裁、指针捕获或侧栏开关吸附逻辑。
- `npm run typecheck`、`npm test`（51 个测试文件、246 个用例）与 `npm run build` 通过。
- 未做窄屏触屏真机验收；轨道内 / 外的分工由 `pointerdown` 的目标选择器决定，方向仲裁仍由现有 `swipe` 单测覆盖。

### 4.37 评论罕见字符 Linear B 缺字修复 [已解决] 

**描述**：ISSUE 报告 Travis - Bus 的评论昵称 `Neon藏雀𐂂` 显示异常。`𐂂` 是 `U+10082 LINEAR B IDEOGRAM B104 DEER`，属于 Linear B 表意文字区；现有字体栈只内置了 Noto Sans Yi，Electron 在系统回退时没有选中可覆盖该码位的字体，画布对比显示与缺字方框完全一致。

**解决方案**：

- 新增依赖 `@fontsource/noto-sans-linear-b`（OFL-1.1），与现有 `@fontsource/noto-sans-yi` 的接入方式一致。
- `src/renderer/main.ts` 导入 `@fontsource/noto-sans-linear-b/linear-b-400.css`，只加载 Linear B 子集。
- 正文 `font-family` 在 `Noto Sans Yi` 之后加入 `Noto Sans Linear B`，仅在现有字体缺字时回退；不修改评论文本，也不替换原字符。
- 该字体子集覆盖 `U+10000-100FF`，包含 `U+10082`；线性 B 表意文字会按原字符显示。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | `Neon藏雀𐂂` 显示异常条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“评论罕见字符 Linear B 缺字修复” | 增 | 记录码位、缺字原因与字体回退方案。 |
| `CORE.html` | §3 SBOM | 增 | 新增 `@fontsource/noto-sans-linear-b`（OFL-1.1），说明覆盖 `U+10000-100FF`。 |
| `CORE.html` | §4.22 `main.ts`（`#c4-22`） | 改 | 记录 Linear B 样式导入与 `Noto Sans Linear B` 回退。 |
| `USER.html` | §5.2.5 歌词与评论 | 增 | 注明昵称 / 正文中的 Yi、Linear B 等罕见文种字符使用内置字体回退，不显示缺字方框。 |
| `package.json` | dependencies | 改 | 新增 `@fontsource/noto-sans-linear-b`。 |
| `README.md` / `ABOUT.html` | 无 | 不动 | 用户交互摘要不涉及字体回退细节。 |

**工作记录**：

- `fc-scan` 确认字体子集字符集包含 `10080-100fa`，覆盖 `U+10082`。
- 用该 woff2 在 Chromium 画布中对比 `U+10082` 与缺字码位：渲染结果不同（829 像素差，720 个墨点），确认不再走 `.notdef`。
- `npm run build` 产物包含 `noto-sans-linear-b-linear-b-400-normal-*.woff2` / `.woff`。
- `npm run typecheck`、`npm test`（51 个测试文件、246 个用例）与 `npm run build` 通过。
- 未做真实评论窗口截图验收；字符覆盖由字体字符集与画布渲染验证。

### 4.38 Rhinestone Eyes 译文错位与空行处理 [已解决] 

**描述**：ISSUE 报告 Gorillaz - Rhinestone Eyes 的歌词显示不匹配，要求确认是歌词源问题还是空行处理问题。拉取真实歌词后确认：原文 50 条带时间戳行，译文 74 条带时间戳条目；译文额外包含 24 条时间戳不在原文中的空行（如 `00:15.54`、`00:20.08`、`01:02.56`），用于上游的分段换行。现有 `withTranslations` 把这些空条目也按行序计入，导致 `00:16.12` 之后的所有译文整体错位。

**解决方案**：

- 结论：上游译文源确实包含额外空行，但直接原因是渲染层把空行也当作占位行参与行序配对；属于“源数据形态 + 空行处理”共同导致。
- 机制固定为“先匹配、再转义、最后渲染”：原文有时间戳时，为每条原文寻找时间差 ≤100ms 的最近未使用译文；匹配不到时 `trans = null`，原文不存在的多余译文行（含空行）直接忽略，不再按行序整体推移。
- 匹配完成后再把纯斜杠（`//`）规范化为空字符串；原文或译文没有时间戳时退化为按行序配对。
- 渲染层只输出非空译文，`hasTranslation` 只统计非空译文；纯斜杠占位不生成译文元素，也不显示“译”字开关。
- 新增测试：时间戳相差过大不匹配、容差内匹配、缺少中间译文时后续不整体前移、多余空行被忽略、接近原文的空占位保留、原斜杠占位继续通过。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | Rhinestone Eyes 歌词不匹配条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“Rhinestone Eyes 译文错位与空行处理” | 增 | 记录源数据计数、根因与过滤规则。 |
| `CORE.html` | §4.33 `lrc.ts`（`#c4-33`） | 改 | 记录时间戳匹配、容差、无匹配留空、斜杠转义与渲染隐藏空译文。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 注明译文按原文时间戳匹配，匹配不到留空，纯斜杠占位不显示。 |
| `README.md` / `ABOUT.html` | 无 | 不动 | 用户交互摘要不涉及歌词空行的内部处理。 |

**工作记录**：

- 用真实歌曲 `Rhinestone Eyes`（songID `2419277`）拉取原文 / 译文：原文 50 条、译文 74 条（其中 24 条空行）；修复后 50 条原文全部有译文，45 条非空、5 条纯斜杠占位，首尾行与译文一致。
- 修复前 `00:16.12` 行会取到 `00:15.54` 的空行，之后整体错位；修复后该行正确显示“你那双人造钻石的眼睛 好像是远方的工厂出品”。
- 按 review 把初版的“过滤多余空行后仍按行序配对”改为明确的时间戳匹配机制：每条原文独立寻找最近的未使用译文，缺失行留空；斜杠转义与空译文隐藏保留在后续阶段。
- `npm run typecheck`、`npm test`（51 个测试文件、250 个用例）与 `npm run build` 通过。
- 未做真实窗口截图验收；用真实歌词数据直接调用 `parseLyric()` 验证行序。

### 4.39 浏览器式页面后退与前进栈 [已解决] 

**描述**：TODO 要求用类似浏览器的方式管理页面后退，确保每次后退都回到上一个页面；所有弹出是例外，弹出窗口对后退键的处理保持独立且明确。后续补充要求同样实现前进。原实现没有显式页面栈，系统后退、Alt + ← 与页面返回按钮都依赖 `router.back()` / 浏览器历史，重复访问当前页时会出现“后退没有反应”，栈底行为也不确定。

**解决方案**：

- `back-navigation.ts` 新增模块级页面访问栈与前进栈：`installPageHistory(router, home)` 在安装时用当前路由初始化，并在每个 `router.afterEach` 记录最终 `fullPath`。
- 记录规则：连续重复路径不重复入栈；`/` 与 `/login` 不记录，登录成功后 `replace('/library')` 只把目标页入栈，后退不会回到登录页；深链接首屏在 `/discover` 之后入栈，保证有上一页。任何普通新导航清空前进栈。
- `goBack()` 先关闭最上层浮层（浮层不动页面栈）；没有浮层时弹出当前页并压入前进栈，用 `router.replace()` 回到栈顶上一页，栈底回到 `/discover`，当前已是发现页则不动。
- `goForward()` 在浮层打开时不动作；否则从前进栈恢复最近后退前的页面并压回页面栈，前进栈为空时不动作。`navigatingHistory` 标记阻止后退 / 前进自身触发的 `afterEach` 再次入栈。
- `installBackNavigation(router)` 安装页面栈并接管系统后退 / 前进、`Alt + ←` / `Alt + →` 与鼠标侧键；`navigation.onBack` / `onForward` 由主进程分别推送。专辑 / 歌手 / MV 页的返回按钮改用共享 `goBack()`，不再直接调用 `router.back()`。
- 浮层栈与页面栈保持独立：所有现有弹层仍通过 `useBackDismiss` / `pushBackDismiss` 处理后退，只关闭自身；前进不关闭浮层。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | “优化后退机制”条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“浏览器式页面后退与前进栈” | 增 | 记录页面栈、前进栈、去重、登录页排除与栈底规则。 |
| `USER.html` | §2 CONVENTIONS · 后退 / 前进手势 | 改 | 补充后退压入前进栈、前进恢复页面、新导航清空前进栈、浮层打开时前进不动作。 |
| `CORE.html` | §4.92 `back-navigation.ts`（`#c4-92`） | 改 | 记录 `installPageHistory` / `goBack` / `goForward` / `installBackNavigation(router)`、双栈与浮层栈的独立关系。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`） | 改 | 安装后退 / 前进分发，分别调用 `goBack()` / `goForward()`。 |
| `CORE.html` | §4.2 IPC 表 / `LycheeApi` | 改 | 新增 `navigation:forward` 与 `navigation.onForward`。 |
| `CORE.html` | §4.4 `main/index.ts`（`#c4-4`） | 改 | `app-command` 同时处理 `browser-backward` / `browser-forward`，分别转发后退 / 前进。 |
| `CORE.html` | §4.73 `ArtistView.vue` / §4.74 `AlbumView.vue` | 改 | 返回按钮改用共享 `goBack()`；栈底回到发现页。 |
| `CORE.html` | §1 文件树 · 测试 | 改 | back-navigation 测试说明改为后退 / 前进页面栈顺序。 |
| `README.md` / `ABOUT.html` | 无 | 不动 | 用户交互摘要未描述后退细节。 |

**工作记录**：

- 新增页面栈测试：连续访问多页逐步后退、前进恢复后退前页面、新导航清空前进栈、浮层优先且不导航、浮层打开时前进不动作、登录页不入栈、深链接首屏回发现页、重复访问当前页不重复入栈。
- 原浮层测试保留；`test/back-navigation.test.ts` 共 9 个用例。
- `npm run typecheck`、`npm test`（51 个测试文件、258 个用例）与 `npm run build` 通过。
- 未做真实鼠标侧键 / 系统手势窗口验收；页面栈与前进栈由 fake router 单测覆盖，事件入口沿用原有已验证监听。

### 4.40 MV 评论 [已解决] 

**描述**：TODO 询问 MV 是否有评论接口，若有则实现 MV 评论，加载机制参考歌曲评论。调查确认上游存在 MV 评论：`music.globalComment.CommentRead / GetNewCommentList` 使用 `BizType 5`、`BizId` 为 MV 的 vid，即可读取；对 `t0016l53c3r`（Rhinestone Eyes）实测返回 17 条评论。

**解决方案**：

- `api/comment.ts` 抽出共享的读取 / 发表链路：歌曲继续使用 `BizType 1` + `BizSubType 2`；新增 `getMvComments` / `postMvComment`，使用 `BizType 5`、`BizId` 为 vid，读取与 AddComment 均不传 `BizSubType`。该参数组合与官方网页客户端一致。
- 新增 `comment.getMv` / `comment.postMv` IPC 与 preload 方法，返回模型沿用 `CommentPage` / `CommentPostResult`；点赞仍按 `comment_id`，目标类型无关。
- `CommentsPanel` 增加 `targetType: 'song' | 'mv'` 与 `targetId` props：歌曲模式省略 `targetId` 时跟随当前播放歌曲，MV 模式使用传入 vid；按目标类型选择 `comment.get` / `getMv` 与 `comment.post` / `postMv`，空状态文案与图标同步区分。
- `MvView` 在视频信息下方增加固定高度 `.mv-comments` 区域，复用 `CommentsPanel`；分页、刷新、点赞、表情 / 附图、跳转顶部 / 底部与发表评论全部沿用歌曲评论机制。
- 切换 MV 时评论目标变化，自动重载并清空草稿；未登录可浏览、不能发表。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | “MV有评论接口吗”条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“MV 评论” | 增 | 记录 BizType 5 / vid、共享评论区与 IPC。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 注明评论区同时用于 MV 播放页，规则一致。 |
| `USER.html` | §5.2.8 MV 播放 | 改 | 增加下方评论区、分页 / 点赞 / 发表与未登录限制。 |
| `CORE.html` | §4.1 / §4.2 | 改 | 评论模型补充 `getMv` / `postMv` IPC。 |
| `CORE.html` | §4.15 `api/comment.ts`（`#c4-15`） | 改 | 增加 `getMvComments` / `postMvComment` 与 BizType 5 参数说明。 |
| `CORE.html` | §4.42 `CommentsPanel.vue`（`#c4-42`） | 改 | 记录 `targetType` / `targetId`、API 分支与目标变化重载。 |
| `CORE.html` | §4.69 `MvView.vue`（`#c4-69`） | 改 | 记录视频下方 MV 评论区。 |
| `CORE.html` | §5.26 MV 评论（`#c5-26`） | 增 | 记录 MV 评论读取 / 发表 / 点赞调用树。 |
| `PROVIDER.html` | §4 接口 / 数据模型 / 记录表 | 改 | 补充 MV 评论 `BizType 5`、`BizId` 为 vid、不传 `BizSubType`。 |
| `README.md` / `ABOUT.html` | MV 行 | 改 | 补充 MV 评论区与歌曲评论机制复用。 |

**工作记录**：

- 真实匿名读取 `Rhinestone Eyes`（vid `t0016l53c3r`）：`BizType 5`、无 `BizSubType` 返回 `Total=17`、首屏 5 条、`HasMore=1`。
- 对照官方网页客户端请求：读取与 `AddComment` 均使用 `BizType 5` + `BizId=vid`，不携带 `BizSubType`；应用沿用该组合。
- 新增 API 测试：MV 读取使用 BizType 5 / vid 且无 BizSubType；MV 发表使用 AddComment BizType 5 / vid 且无 BizSubType。
- `npm run typecheck`、`npm test`（51 个测试文件、260 个用例）与 `npm run build` 通过。
- 未使用真实登录账号发表 MV 评论（避免产生公开内容）；读取用真实接口验证，发表参数对照官方客户端请求。

### 4.41 评论回复、回复分页与已删除评论 [已解决] 

**描述**：TODO 要求实现评论回复：回复按钮位于点赞按钮右侧，点击在评论与回复区之间展开输入框；回复区使用 surface 背景，0 条回复隐藏；默认显示前 3 条，可点“更多评论”展开；展开后每页 10 条，底部提供上一页、最多 10 个邻近页码与下一页；回复支持时间戳与点赞；已删除评论需要标记，歌曲评论同样适用并复用同一实现。

**解决方案**：

- 调查确认上游回复接口为 `music.globalComment.CommentRead / GetReplyCommentList`，参数 `RootCmId`（顶层评论 CmId）、`LastCommentSeqNo` 游标、`PageSize`、`LastRankScore`、`RankType`、`PicEnable`、`PageNum`；单页取 10 条，`PageNum` 不生效，`SeqNo` 需按字符串保留精度。
- 回复发表沿用 `AddComment`：歌曲传 `BizType 1` + `BizSubType 2`，MV 传 `BizType 5`，两者都追加 `RepliedCmId` 指向顶层评论 CmId。
- `Comment` 增加 `deleted` 与 `replyToNickname`：`State === 2` 映射为已删除，`RepliedComments[0].Nick` 映射为被回复昵称。已删除记录即使正文为空也保留，交给界面显示占位；其余空记录仍过滤。
- `api/comment.ts` 抽出 `toCommentPage()` 统一顶层评论与回复的过滤、总数与游标计算；新增 `getCommentReplies()` / `postCommentReply()`。新增 `comment.getReplies` / `comment.postReply` IPC 与 preload 方法。
- `CommentsPanel` 为每条顶层评论维护独立回复线程：首屏预取 10 条，折叠显示前 3 条；展开后按 10 条分页，页码窗口最多 10 个，点击未加载页码时按游标串行补拉；刷新、切歌与目标变化清空线程与回复草稿，在途请求按 token 丢弃。
- 回复区使用 `--panel` 背景，`replyCount === 0` 不渲染；回复条目为 16px 小头像 + 昵称 + 冒号 + 正文的紧凑行，回复另一条回复时显示“回复 @昵称”，下行左侧时间、右侧点赞按钮；回复点赞复用 `toggleLike()` 的乐观更新与回滚。此处仅渲染上游已有的被回复昵称，不提供回复的回复入口；入口与嵌套回复框在 4.44 实现。
- 已删除顶层评论与回复统一显示“该评论已删除”，不展示正文、媒体、点赞与回复入口。
- 新增 `COMMENT_REPLY_PAGE_SIZE = 10`、`COMMENT_REPLY_PREVIEW = 3`、`COMMENT_REPLY_PAGE_LINK_MAX = 10`。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | “实现评论回复功能”条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“评论回复、回复分页与已删除评论” | 增 | 记录接口调查、数据映射与回复分页实现。 |
| `USER.html` | §1 TERMS · 评论 | 改 | 改为顶层评论与回复，链接 §5.2.5。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 增加回复入口、回复框、3 条预览与 10 条分页、回复时间 / 点赞、已删除占位；拆分原评论正文说明为独立条目。 |
| `USER.html` | §5.2.8 MV 播放 | 改 | 说明 MV 评论的回复与删除占位与歌曲一致。 |
| `CORE.html` | §1 文件树 · `comment.ts` | 改 | 描述改为评论（歌曲 / MV / 回复）。 |
| `CORE.html` | §4.1 `types.ts`（`#c4-1`） | 改 | `Comment` 增加 `deleted` / `replyToNickname`。 |
| `CORE.html` | §4.2 `ipc.ts`（`#c4-2`） | 改 | 增加 `comment.getReplies` / `comment.postReply`。 |
| `CORE.html` | §4.15 `api/comment.ts`（`#c4-15`） | 改 | 增加回复读取 / 发表签名、`GetReplyCommentList` 参数、`RepliedCmId` 与 `State` 映射。 |
| `CORE.html` | §4.42 `CommentsPanel.vue`（`#c4-42`） | 改 | 记录回复线程状态、预取与分页、回复框、紧凑布局与删除占位。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 增加回复区、回复条目与分页按钮样式。 |
| `CORE.html` | §4.50 `constants.ts`（`#c4-50`） | 改 | 增加回复页大小、预览条数与页码上限。 |
| `CORE.html` | §5.9 歌词与评论（`#c5-9`） | 改 | 增加回复读取、分页与发表调用树及说明。 |
| `CORE.html` | §5.26 MV 评论（`#c5-26`） | 改 | 注明回复复用 `CommentsPanel`，调用树见 §5.9。 |
| `PROVIDER.html` | §2 CONVENTIONS | 增 | 增加评论回复与删除状态约定。 |
| `PROVIDER.html` | §4.1 接口 / 请求参数 | 改 | 增加 `GetReplyCommentList`、`RepliedCmId` 与回复参数。 |
| `PROVIDER.html` | §4.3 数据模型 / 转换 | 改 | `QqComment` 增加 `State` / `RepliedComments`，`QqCommentList` 增加 `FromComment`，转换补充删除与回复目标。 |
| `README.md` / `ABOUT.html` | 歌词 / 评论行、MV 行 | 改 | 补充回复入口、3 条预览、10 条分页与删除占位；MV 回复复用歌曲机制。 |

**工作记录**：

- 使用匿名真实接口验证回复读取：`GetReplyCommentList` 对同一顶层评论返回回复列表，`HasMore` 与 `LastCommentSeqNo` 游标可用，`PageNum` 不生效；后续页 `Total` 为 0，因此分页总数以首屏为准。
- 对照官方网页客户端请求确认：回复读取为 `music.globalComment.CommentRead / GetReplyCommentList`，回复发表为 `CommentWriteServer / AddComment` + `RepliedCmId`。
- `State` 映射来自官方网页脚本：0 仅自己可见、1 正常、2 已删除、3 热评、4 置顶、5 未知；应用只把 2 标记为删除占位。
- 新增 API 测试：回复读取参数与游标、已删除记录保留、`RepliedComments` 映射、歌曲 / MV 回复发表参数。
- `npm run typecheck`、`npm test`（51 个测试文件、263 个用例）与 `npm run build` 通过。
- 未在真实登录账号下发表回复（避免产生公开内容）；未做真实窗口截图验收，回复交互由模板、类型检查与接口测试确认。

### 4.42 评论昵称中的控制字符乱码 [已解决] 

**描述**：ISSUE 指出 Nas - Memory Lane (Sittin' in da Park) (Explicit) 在 2026-03-27 10:17 的评论用户名显示为乱码 `T*`。排查确认该昵称并非字体缺字，而是上游 `Nick` 实际为 `\u007f\u007f\u007f\u007fT*`：四个 `U+007F`（DEL，C0 控制字符）前缀。浏览器会为控制字符分配字形宽度并显示为缺字方框，导致昵称与头像首字母出现乱码。

**解决方案**：

- 新增 `stripControlChars(value, keepLineBreaks)`：移除 `U+0000–U+001F` 与 `U+007F–U+009F`；正文模式保留 `\n`，昵称模式全部移除。
- `cleanNickname()` 对 `Nick` 与 `RepliedComments[].Nick` 先移除控制字符再去首尾空白；`normalizeCommentContent()` 在换行归一化后移除控制字符（只保留换行）。
- 全部由控制字符组成的昵称映射为空字符串；界面对空昵称不做任何特殊处理，按原样渲染：不替换、不隐藏昵称，回复行仍保留昵称与冒号位置，头像首字母取昵称首字符（空昵称即为空）。
- 顶层评论、回复与回复目标昵称共用同一套清洗逻辑。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 控制字符昵称条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“评论昵称中的控制字符乱码” | 增 | 记录根因、清洗范围与文档操作。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 说明昵称 / 正文中的 C0 / C1 控制字符在展示前移除，正文只保留换行。 |
| `CORE.html` | §4.15 `api/comment.ts`（`#c4-15`） | 改 | 增加 `stripControlChars()` / `cleanNickname()` 的清洗规则与实测样例。 |
| `PROVIDER.html` | §2 CONVENTIONS | 增 | 增加“评论控制字符”约定与实测昵称。 |
| `PROVIDER.html` | §4.3 数据模型 / 转换 | 改 | `QqComment` 注明控制字符，转换补充昵称与正文清洗。 |

**工作记录**：

- 真实匿名读取歌曲 `1684775`（Nas - Memory Lane (Sittin' in da Park) (Explicit)）的评论，定位到 `PubTime=1774577826`（2026-03-27 10:17:06 +08:00）的记录：`Nick` 为 `['\x7f','\x7f','\x7f','\x7f','T','*']`，`Content` 正常，确认不是字体缺字。
- 在 Chromium 中测量：单个 `U+007F` 渲染宽度约 16px，`T*` 为 17px；因此控制字符会占据字形宽度并显示为方框，必须从数据层移除。
- 新增 API 测试：昵称与正文中的 C0 / C1 控制字符被移除，正文换行保留，回复目标昵称同步清洗。
- `npm run typecheck`、`npm test`（51 个测试文件、264 个用例）与 `npm run build` 通过。
- 未使用真实登录账号验证该评论在完整窗口中的显示；清洗规则由真实响应与单测覆盖。

### 4.43 回复区空框与无法打开的末页 [已解决] 

**描述**：ISSUE 指出 Ye - Famous (Explicit) 的 2026-10-10 23:22 评论出现空白回复区，回复计数为 1 但展开后为空；同一首歌 2025-10-07 12:47 评论的回复分成 4 页，第 4 页无法打开。要求客户端按实际返回结果渲染，不盲目相信上游计数与总数。

**解决方案**：

- 调查确认两组上游数据不一致：`Acedia` 评论 `ReplyCnt=1`，`GetReplyCommentList` 返回 `Total=1`、`HasMore=0`、`Comments=[]`；`FKA-肢肢日记` 评论 `ReplyCnt=36`，回复接口只有 30 条（3 页），第 3 页后 `HasMore=0`。
- `ReplyThread` 增加 `loaded`：首次请求返回后置为 `true`，用于区分“尚未加载”与“加载后确实为空”。
- 新增 `shouldShowReplies(comment)`：回复区只在加载中、加载失败或实际存在回复时渲染；加载完成后实际为空则整块隐藏，`replyCount` 不再单独决定显隐。
- 回复后续页返回空列表时不再追加空页，并清空游标、置 `hasMore=false`；页码按实际数据收敛。
- 新增 `utils/comment-replies.ts`：`replyPageCount()` 在 `hasMore=false` 时按实际条数计算页数，仍有下一页时才按 `Total` 保留远端页码；`replyPageLinks()` 统一生成最多 10 个邻近页码。
- 页码跳转后若目标页不存在，回落到最后一个非空页；末页不再出现无法打开的空页。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | Ye - Famous 空回复区与回复分页条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“回复区空框与无法打开的末页” | 增 | 记录真实上游数据、显隐与分页收敛方案。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 补充实际为空时隐藏回复区、上游总数偏大时页码收敛。 |
| `CORE.html` | §1 文件树 | 增 | 新增 `utils/comment-replies.ts` 与对应测试。 |
| `CORE.html` | §4.42 `CommentsPanel.vue`（`#c4-42`） | 改 | 记录 `loaded`、`shouldShowReplies()`、空页不追加与页码收敛。 |
| `CORE.html` | §4.109 `comment-replies.ts`（`#c4-109`） | 增 | 记录 `replyPageCount()` / `replyPageLinks()` 契约。 |
| `CORE.html` | §5.9 歌词与评论（`#c5-9`） | 改 | 补充回复计数与列表不一致时的实际数据优先规则。 |
| `PROVIDER.html` | §2 CONVENTIONS | 增 | 记录 `ReplyCnt` / `Total` 与真实列表不一致的实测案例。 |
| `PROVIDER.html` | §4.3 数据模型 | 改 | 注明回复首屏 `Total` 也可能大于实际条数。 |
| `README.md` / `ABOUT.html` | 歌词 / 评论行 | 改 | 补充回复区按实际返回结果显示、空列表时隐藏。 |

**工作记录**：

- 真实匿名读取歌曲 `107471791`（Ye - Famous (Explicit)）：`Acedia` 评论回复接口返回 `Total=1`、`HasMore=0`、`Comments=[]`；`FKA-肢肢日记` 评论回复接口首屏 `Total=36`，连续拉取 3 页共 30 条后 `HasMore=0`。
- 官方客户端同样会把 1 条“幽灵回复”显示成可展开的回复区，本应用改为按实际列表隐藏，比官方更严格。
- 新增 `test/comment-replies.test.ts`：覆盖 `HasMore=0` 时按实际条数收敛页数、仍有下一页时保留 Total 页码、空列表至少 1 页、10 个邻近页码窗口与边界夹取。
- `npm run typecheck`、`npm test`（52 个测试文件、271 个用例）与 `npm run build` 通过。
- 未做真实窗口截图验收；分页与显隐逻辑由纯函数测试、真实接口数据与类型检查覆盖。

### 4.44 回复的回复与 @ 渲染 [已解决] 

**描述**：ISSUE 要求实现“回复的回复”：渲染时隐藏被回复人昵称前的 `@`；用与评论回复一致的 UI 支持继续回复某条回复；发表时必须把被回复人作为 `RepliedCmId`，不能丢目标或调用错误的接口。该功能在 4.41 中尚未实现，4.41 只实现了对顶层评论的回复入口。

**解决方案**：

- 对照官方网页客户端确认：回复某条回复仍调用 `music.globalComment.CommentWriteServer / AddComment`，`RepliedCmId` 为该回复的 `CmId`；不需要额外的根评论参数，根评论只用于客户端把新回复挂回正确的回复线程。
- `CommentsPanel` 的 `replyingTo` 从顶层评论 ID 改为 `ReplyTarget { rootId, commentId, nickname }`：`rootId` 用于刷新线程，`commentId` 作为 `RepliedCmId`，`nickname` 用于回复框占位。
- 每条回复的点赞按钮右侧增加“回复”按钮；点击在该条回复下方展开与顶层回复相同的输入框，复用 `replyDraft` / `replyPosting` / `canPostReply`。发表成功后收起输入框、增加所在顶层评论的 `replyCount` 并重新加载该顶层线程。
- 回复正文中的被回复人显示为“回复 昵称”，移除昵称前的 `@`；新回复仍由上游 `RepliedComments[0].Nick` 映射为 `replyToNickname`，被回复人不会丢失。
- 回复框嵌套在单条回复内部，增加 `comment-reply-composer-nested` 的间距与 40px 输入框高度。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 实现回复的回复功能条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“回复的回复与 @ 渲染” | 增 | 记录官方请求格式、ReplyTarget 与 UI 复用。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 回复条目增加“回复”按钮，说明被回复人昵称前不显示 `@`，新回复保留被回复人。 |
| `CORE.html` | §4.15 `api/comment.ts`（`#c4-15`） | 改 | 明确 `RepliedCmId` 为被回复的顶层评论或回复 CmId。 |
| `CORE.html` | §4.42 `CommentsPanel.vue`（`#c4-42`） | 改 | 记录 `ReplyTarget`、回复的回复入口、嵌套回复框与线程刷新。 |
| `CORE.html` | §5.9 歌词与评论（`#c5-9`） | 改 | 增加 `startReplyToReply()` 与以目标回复 CmId 发表的调用树。 |
| `PROVIDER.html` | §2 CONVENTIONS / §4.1 | 改 | `RepliedCmId` 允许为顶层评论或回复 CmId，不需要根评论参数。 |
| `README.md` / `ABOUT.html` | 歌词 / 评论行 | 改 | 补充回复支持继续回复、被回复人昵称前不显示 @。 |

**工作记录**：

- 官方网页脚本确认：回复提交函数参数为 `{ type, id, content, replyCmId }`，`AddComment` 参数为 `{ BizType, BizId, Content, RepliedCmId }`；回复某条回复时 `replyCmId` 取该回复 `cmId`，根评论仅用于 `subCmtStateById[rootCmId]` 的本地归组。
- 官方脚本在本地插入新回复时会写入 `repliedCmts`，本应用改为重新请求线程，由 `RepliedComments[0].Nick` 保留被回复人。
- 新增 API 断言：`postCommentReply('song', '123', 'reply-1', ...)` 的 `RepliedCmId` 为 `reply-1`，BizType / BizId / BizSubType 保持正确。
- `npm run typecheck`、`npm test`（52 个测试文件、271 个用例）与 `npm run build` 通过。
- 未使用真实登录账号发表回复的回复（避免产生公开内容）；请求格式对照官方客户端脚本确认。

### 4.45 回复图片渲染 [已解决] 

**描述**：ISSUE 指出 King Gnu - AIZO 的 2026-07-17 19:26 评论下同时间回复的图片只显示 `[图片]` 占位符，回复图片没有真正渲染。

**解决方案**：

- 调查确认该回复 `Content` 为空、`Pic` 为有效 JPEG（1080×1920），`PicSize` 为 `1080x1920`；`toComment()` 已把回复的 `Pic` 映射为 `imageUrl`，问题只在回复模板。
- 回复条目在正文下方渲染 `reply.imageUrl`：使用 `comment-media` 基础样式与 `comment-reply-media` 紧凑尺寸（最大 180×160px、上间距 5px），点击调用 `openViewer()` 打开全屏查看器。
- 图片加载失败时显示 `paper-torn` 占位（64×48px），按 URL 记录到 `failedMedia`；只有附图、没有正文的回复照常显示图片。
- 删除原有 `[图片]` 文本占位。
- 回复与顶层评论共用 `Pic` / `EmoPic` 映射，无需新增 API 或 IPC。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 回复图片渲染条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“回复图片渲染” | 增 | 记录真实回复图片数据与模板调整。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 回复附图以缩略图显示，可点击查看大图，失败显示占位。 |
| `CORE.html` | §4.42 `CommentsPanel.vue`（`#c4-42`） | 改 | 记录回复图片渲染、点击查看器与失败占位。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 增加 `.comment-reply-media` / `.comment-reply-media-failed` 尺寸。 |
| `PROVIDER.html` | §2 CONVENTIONS · 评论回复 | 改 | 注明回复的 `Pic` / `EmoPic` 与顶层评论相同映射。 |
| `README.md` / `ABOUT.html` | 歌词 / 评论行 | 改 | 补充回复附图可点击查看大图。 |

**工作记录**：

- 真实匿名读取歌曲 `632959788`（King Gnu - AIZO）的回复：`Content=''`、`Pic='https://music-file.y.qq.com/comment/u/7eoPowvioivF/20a44/e8e7252591bb07376ebd36e86b81709c007032d6_148b58.jpeg'`、`PicSize='1080x1920'`。
- 更新回复读取测试：`Pic` 正确映射为 `https` 的 `imageUrl`。
- `npm run typecheck`、`npm test`（52 个测试文件、271 个用例）与 `npm run build` 通过。
- 未做真实窗口截图验收；图片模板与尺寸由代码审阅与接口映射测试覆盖。

### 4.47 回复目标昵称为空导致“回复”标记丢失 [已解决] 

**描述**：ISSUE 指出 Ye - Famous (Explicit) 下 2026-11-23 16:30 评论的 2026-11-23 23:05 回复是本应用发表的“回复的回复”，但没有呈现被回复人。

**解决方案**：

- 定位真实数据：根评论为 `双辻` 的“古战场”；23:05 回复由 `BraisedPurple` 发表，`RepliedComments[0].Nick` 为 `\u007f\u007f\u007f\u007f`（四个 DEL 控制字符），指向 16:43 的回复“新战场”。
- 控制字符清洗后 `replyToNickname` 为空字符串；原映射使用 `replyToNickname || undefined`，把“有被回复对象但昵称为空”错误折叠成 `undefined`，模板因此不渲染“回复”前缀。
- `toComment()` 改为按 `RepliedComments[0]` 是否存在决定字段：存在时保留清洗结果（允许空字符串），不存在时才为 `undefined`。
- `CommentsPanel` 新增 `hasReplyTarget()`，以 `replyToNickname !== undefined` 判断是否展示目标；被回复人昵称为空时仍显示“回复 ”前缀与冒号，不丢弃被回复对象。
- 发表回复时同样保留空的被回复昵称，不把空字符串转成 `undefined`。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 回复的回复未显示被回复人条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“回复目标昵称为空导致‘回复’标记丢失” | 增 | 记录真实数据、空值折叠原因与判断规则。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 说明被回复人昵称为空时仍保留“回复”前缀，不丢失对象。 |
| `CORE.html` | §4.1 `types.ts`（`#c4-1`） | 改 | 明确 `replyToNickname` 无目标为 `undefined`、空昵称保留空字符串。 |
| `CORE.html` | §4.15 `api/comment.ts`（`#c4-15`） | 改 | 记录以 `RepliedComments` 存在性判断回复目标，不按昵称真值。 |
| `CORE.html` | §4.42 `CommentsPanel.vue`（`#c4-42`） | 改 | 增加 `hasReplyTarget()` 与空昵称仍显示“回复”前缀。 |
| `PROVIDER.html` | §4.3 数据模型 / 转换 | 改 | 注明被回复昵称清洗后为空时保留空字符串。 |

**工作记录**：

- 真实匿名读取歌曲 `107471791`：根评论 `双辻` “古战场” `PubTime=1795422650`（2026-11-23 16:30）；回复 `BraisedPurple` “战至大道都磨灭了” `PubTime=1795446328`（2026-11-23 23:05）；`RepliedComments[0]` 的 `Nick` 为 `['\x7f','\x7f','\x7f','\x7f']`，`CmId` 指向 16:43 的“新战场”回复。
- 此前曾误判为“发表后重新拉取导致新回复不在当前页”，并做过本地插入改动；该改动已撤回，本次只修复空昵称被折叠为空目标的问题。
- 新增 API 测试：控制字符-only 的被回复昵称映射为 `''`，未被回复的评论保持 `undefined`。
- `npm run typecheck`、`npm test`（52 个测试文件、271 个用例）与 `npm run build` 通过。
- 未做真实窗口截图验收；显示条件由字段存在性与单测覆盖。

### 4.48 空昵称作为合法昵称的文档约定 [已解决] 

**描述**：复查指出“空昵称”必须作为原则落实：空字符串是合法昵称，不做任何特殊处理；同时不能把空昵称当作昵称缺失、评论作者不存在或被回复用户不存在。

**解决方案**：

- `USER` §2 新增“评论 / 回复空昵称”约定：空昵称按原样显示为空，不替换为“匿名用户”、不隐藏评论 / 回复、不判定用户不存在；被回复昵称为空仍有回复目标。
- `CORE` §2 新增同名约定：`nickname` / `replyToNickname` 以 `''` 为合法值，禁止用 `||`、三目真值或 `Boolean()` 折叠；`replyToNickname === undefined` 才表示无目标，目标是否存在以 `RepliedComments` 为准。
- `PROVIDER` §2 新增“评论空昵称”约定：上游 `Nick` 为空或清洗后为空仍是合法值，不等同于用户不存在；回复目标以 `RepliedComments` / 被回复 `CmId` 为准。
- 在 `USER` §5.2.5、`CORE` §4.1 / §4.15 / §4.42、`PROVIDER` §4.3 中补充指向该约定的链接，具体字段说明只保留实现细节。
- 代码复查：评论 / 回复的昵称直接渲染；`avatarLetter()` 取首字符，空昵称返回空字符串；`hasReplyTarget()` 以 `replyToNickname !== undefined` 判断；未发现对评论 / 回复昵称的真值回退。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `IMPL.md` | 新增“空昵称作为合法昵称的文档约定” | 增 | 记录原则、落地位置与代码复查。 |
| `USER.html` | §2 CONVENTIONS | 增 | 新增“评论 / 回复空昵称”约定。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 链接 §2 的空昵称约定。 |
| `CORE.html` | §2 CONVENTIONS | 增 | 新增“评论 / 回复空昵称”约定，禁止真值折叠。 |
| `CORE.html` | §4.1 / §4.15 / §4.42 | 改 | 补充约定链接，保留字段级实现细节。 |
| `PROVIDER.html` | §2 CONVENTIONS | 增 | 新增“评论空昵称”约定。 |
| `PROVIDER.html` | §4.3 数据模型 / 转换 | 改 | 链接 §2 的空昵称约定。 |

**工作记录**：

- 复查 `src/renderer/components/CommentsPanel.vue` 与 `src/main/api/comment.ts`：没有 `nickname ||`、`replyToNickname ||` 或对评论昵称的真值回退；空昵称保留为 `''`，只有没有 `RepliedComments` 时 `replyToNickname` 才是 `undefined`。
- 该原则只约束评论 / 回复昵称；侧栏账号头像等其它界面的昵称回退不在本次范围内。
- `npm run typecheck`、`npm test`（52 个测试文件、271 个用例）与 `npm run build` 通过。

### 4.49 限速收缩到 vkey 并改为专用安全取流 [已解决] 

**描述**：TODO 要求把限速从“全部上游请求共用一个全局令牌桶”收缩为只限制 vkey，vkey 走专门的安全 fetch 方法，300ms 内只能请求一次，并把“vkey 相关请求禁止批量操作”作为通用规则写入文档。此前 `client.ts` 的 `throttleUpstream()` 对所有上游请求按 4 req/s、突发 8 平滑，`song.ts` 仍按 50 首一批申请 vkey；全局限速既拖慢无关请求，也没有从结构上阻止批量取流。

**解决方案**：

- 删除 `client.ts` 的全局令牌桶与 `throttleUpstream()`；`fetchOnce` 只保留截断检查与请求本身，`favorite.ts` / `login.ts` 绕过统一入口的请求改为只检查 104009 截断窗口。
- 新增 `src/main/api/vkey.ts`：`fetchVkey()` 是 vkey 的唯一入口，参数固定为单首歌；`withVkeyGate()` 把请求串成单飞队列，相邻两次请求开始时间至少相差 `VKEY_MIN_INTERVAL_MS = 300`，失败不阻塞后续请求。
- 两个 vkey 入口与 104009 截断整体迁入 `vkey.ts`：经典入口返回 104009 才尝试备用入口，两个入口都拒绝才 `tripUpstreamBlock()`；备用请求同样经过 gate。
- `song.ts` 的 `requestQuality()` 改为逐首调用 `fetchVkey()`，删除 `VKEY_BATCH_SIZE` 分块与本地 vkey 参数组装。
- `shared/constants.ts` 删除 `UPSTREAM_RATE_LIMIT_PER_SECOND` / `UPSTREAM_RATE_LIMIT_BURST` / `VKEY_BATCH_SIZE`，新增 `VKEY_MIN_INTERVAL_MS`。
- 在 USER / CORE / PROVIDER 的 CONVENTIONS 中写入“vkey 请求禁止批量、单曲、300ms 串行”；只有真实播放与下载可以取流。
- 更新 `test/api/song-stream.test.ts` 的批量用例为逐首断言，新增 `test/api/vkey.test.ts` 覆盖单曲参数、串行间隔、失败后保持 gate 与备用入口。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 收缩限速机制到只对 vkey 相关请求限制条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“限速收缩到 vkey 并改为专用安全取流” | 增 | 记录全局限速问题、专用入口与 300ms 串行规则。 |
| `USER.html` | §2 CONVENTIONS | 增 | 新增“vkey 请求”：只有真实播放与下载取流，一次一首、间隔至少 300ms。 |
| `CORE.html` | §1 文件树 | 增 | 增加 `api/vkey.ts` 条目。 |
| `CORE.html` | §2 CONVENTIONS | 增 | 新增“vkey 请求”约定：唯一入口、单曲、禁止批量与并发、300ms 间隔。 |
| `CORE.html` | §4.8 `client.ts`（`#c4-8`） | 改 | 删除 `throttleUpstream` 签名与全局限速说明，截断检查只保留一次。 |
| `CORE.html` | §4.11 `song.ts`（`#c4-11`） | 改 | `requestQuality` 逐首调用 `fetchVkey()`，删除批量分块与本地 vkey 处理。 |
| `CORE.html` | §4.16 `login.ts` / §4.54 `favorite.ts` | 改 | 绕过统一入口的请求不再取令牌，只检查截断窗口。 |
| `CORE.html` | §4.50 `constants.ts`（`#c4-50`） | 改 | 删除 `UPSTREAM_RATE_LIMIT_*` 与 `VKEY_BATCH_SIZE`，新增 `VKEY_MIN_INTERVAL_MS`。 |
| `CORE.html` | §4.110 `vkey.ts`（`#c4-110`） | 增 | 新增签名、gate、单曲参数与备用入口说明。 |
| `CORE.html` | §5.5 播放单曲 | 改 | 调用树改为 `api/song::requestQuality → api/vkey::fetchVkey → api/client::musicu`。 |
| `PROVIDER.html` | §2 CONVENTIONS | 改 | “限速”改为“vkey 限速”，其他请求不做应用侧限速。 |
| `PROVIDER.html` | §3.2 播放链接协议（含 `prov-play` 图） | 改 | vkey 参数改为单曲数组，注明相邻请求间隔至少 300ms。 |
| `PROVIDER.html` | §4.1 播放链接 / §4.3 响应模型 | 改 | 删除“按 50 首一批”，改为逐首请求。 |

**工作记录**：

- 全局令牌桶删除后，搜索 / 歌单 / 评论等请求不再被应用侧节流；429、瞬时繁忙码退避与 104009 截断仍然保留。
- `fetchVkey()` 的 `songmid` / `songtype` / `filename` 数组固定长度为 1，批量只能由调用方逐首循环，无法再拼出批量请求。
- `test/api/vkey.test.ts` 使用假时钟验证 299ms 时第二次请求仍未发出、300ms 时发出；`song-stream` 的批量用例改为断言每次只带一首歌。
- `npm run typecheck`、`npm test`（53 个测试文件、275 个用例）与 `npm run build` 通过。
- 未做真实窗口验收；取流时序由接口测试覆盖。

### 4.50 每条评论的回复热评置顶 [已解决] 

**描述**：TODO 要求优化评论呈现：每条评论点赞数前三的回复作为回复热评，按点赞数降序移到该评论回复区的队首展示，且只有点赞数超过 3 的回复才纳入热评。顶层评论的热评不做，评论区仍只读取最新评论。此前回复只按时间游标分页，没有热评排序能力。

**解决方案**：

- `getCommentReplies()` 在首屏（`cursor === ''`）额外请求一次热评：同一接口 `GetReplyCommentList` 使用 `RankType: 1`、`LastRankScore` / `LastCommentSeqNo` 为空、`PageSize: COMMENT_HOT_REPLY_LIMIT = 3`，再按 `CmId` 去重、只保留点赞数超过 `COMMENT_HOT_REPLY_MIN_LIKES = 3` 的回复，按 `likedCount` 降序截断后写入 `CommentPage.hotReplies`；点赞数不超过 3 的回复不纳入热评；合格回复不足 3 条时按实际条数返回（1 条就返回 1 条，0 条时不显示热评）。热评请求失败降级为无热评，不影响普通回复页；后续页不再请求热评。
- 普通回复页仍使用 `RankType: 0` 与 `LastCommentSeqNo` 游标，热评模式的 `LastRankScore` 游标不与普通分页混用。
- `CommentPage` 增加可选字段 `hotReplies`；新增常量 `COMMENT_HOT_REPLY_LIMIT = 3` 与 `COMMENT_HOT_REPLY_MIN_LIKES = 3`（点赞数须超过该值才纳入热评）。
- `utils/comment-replies.ts` 新增 `hotRepliesFirst(hotReplies, replies)`：热评固定在最前，普通回复中与热评同 ID 的条目被移除，其余保持原顺序；热评为空时原样返回。
- `CommentsPanel` 的回复线程保存 `hot`；折叠时展示热评 + 前 `COMMENT_REPLY_PREVIEW = 3` 条普通回复，展开后每页展示 `COMMENT_REPLY_PAGE_SIZE = 10` 条普通回复，热评始终置顶且不占普通页码；仅存在热评时回复区照常显示。
- 顶层评论读取保持原样，不读取 `CommentList2` / `WithHot`，不新增评论热评。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 优化评论呈现条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“每条评论的回复热评置顶” | 增 | 记录热评请求、置顶与分页规则。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 每条评论的回复热评降序置顶，折叠 / 展开的展示规则。 |
| `CORE.html` | §4.1 `types.ts`（`#c4-1`） | 改 | `CommentPage` 增加 `hotReplies`。 |
| `CORE.html` | §4.15 `api/comment.ts`（`#c4-15`） | 改 | 回复首屏 `RankType=1` 热评请求、去重与降级规则。 |
| `CORE.html` | §4.42 `CommentsPanel.vue`（`#c4-42`） | 改 | 线程保存热评，折叠 / 展开时的置顶与去重。 |
| `CORE.html` | §4.50 `constants.ts`（`#c4-50`） | 改 | 新增 `COMMENT_HOT_REPLY_LIMIT = 3` 与 `COMMENT_HOT_REPLY_MIN_LIKES = 3`。 |
| `CORE.html` | §4.109 `utils/comment-replies.ts`（`#c4-109`） | 改 | 新增 `hotRepliesFirst()` 签名与规则。 |
| `CORE.html` | §5.9 歌词与评论 | 改 | 调用树补回复热评请求与折叠渲染说明。 |
| `PROVIDER.html` | §2 CONVENTIONS 评论回复 | 改 | 首屏 `RankType=1` 热评与 `LastRankScore` 游标。 |
| `PROVIDER.html` | §4.1 评论回复 / §4.3 映射 | 改 | 记录热评请求参数、点赞降序与两套游标边界。 |

**工作记录**：

- 真实匿名验证歌曲 `8136` 的根评论 `1!a3VJKpYIpBEwZLrtcAdhno…`（`Total=113`）：`RankType: 0` 按时间返回（PraiseNum 141,2,248,192,16,1017,…），`RankType: 1` 按点赞数降序返回（1017,747,248,192,141,52,16,12,4,4）；`PageSize: 3` 返回 1017 / 747 / 248。
- 同一根评论验证游标：热评模式用 `LastRankScore` 可续页；传 `LastCommentSeqNo` 会重复返回第一页，因此两套游标严格分开。
- 匿名读取时上游仍可能把 `ReplyCnt` 返回 0（实测上述根评论有 113 条回复但 `ReplyCnt=0`）；本次不改变回复区的出现条件，仍按现有 `replyCount > 0` 规则加载线程，登录态下按上游计数展示。
- 新增 / 更新测试覆盖首屏热评请求、后续页不请求热评、热评失败降级、点赞数不超过 3 的回复被排除、合格回复不足 3 条时按实际条数返回，以及 `hotRepliesFirst()` 的置顶 / 去重。
- `npm run typecheck`、`npm test`（53 个测试文件、280 个用例）与 `npm run build` 通过。
- 未做真实窗口验收；置顶顺序与分页边界由接口测试与工具函数单测覆盖。

### 4.51 评论栏新增同级热评区 [已解决] 

**描述**：TODO 要求加入热评区，用单独的部分展示热评，与评论区同级，标题就是“热评”。此前评论区只读取最新评论游标分页，上游热评附加模块 `CommentList2` 未被使用。

**解决方案**：

- 评论首屏请求追加 `WithHot: 1`，后续页不再请求；`api/comment.ts` 从 `CommentList2` 映射热评，按 `PraiseNum` 降序、按 `CmId` 去重后写入 `CommentPage.hotComments`，全量保留上游首屏返回的热评、不截断；热评模块不参与游标分页。歌曲与 MV 评论共用同一实现。
- `CommentPage` 增加可选字段 `hotComments`；回复热评仍使用独立的 `hotReplies`。
- `CommentsPanel` 保存 `hotComments`；区块构造与“热评是否存在”的检测解耦到 `utils/comment-sections.ts::buildCommentSections()`：热评非空才生成热评区块，其余区块始终保留并剔除重复条目。组件按返回的区块顺序把标题与条目展开为 `commentRows`，不再分散判断有没有热评，后续新增区块只需在构建函数中追加。
- 评论栏顶部增加常驻标题栏：绝对定位覆盖在滚动区上，带不透明背景与底部 1px 分隔线，充当遮罩；滚动内容从栏目顶部开始，初始区块标题被盖住，同一标题任何时候只出现一次。标题、条数与刷新入口随当前滚动区块切换，当前区块按所有 `.comments-heading` 与滚动区顶部的相对位置取下标。
- 区块内部的标题不再带条数统计与刷新按钮，仅作为分隔保留：字号 22px、下内边距 20px；首个区块标题始终被遮罩、不画线，其余区块标题在文字下方各画一条占内容宽度 33% 的 1px 短线；两个区块之间以空白分隔而非分区线。
- 热评条目复用顶层评论的点赞、回复、图片与表情渲染逻辑，并对有回复的热评预取回复线程；刷新、切歌或目标变化时随评论一起重载。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 加入热评区条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“评论栏新增同级热评区” | 增 | 记录热评来源、区块布局与去重规则。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 评论栏上下两个同级区块、遮罩式常驻标题栏、标题 22px 与细分隔线；热评全部降序展示，评论保留分页。 |
| `CORE.html` | §1 文件树 | 增 | 增加 `utils/comment-sections.ts` 条目。 |
| `CORE.html` | §4.1 `types.ts`（`#c4-1`） | 改 | `CommentPage` 增加 `hotComments`。 |
| `CORE.html` | §4.15 `api/comment.ts`（`#c4-15`） | 改 | 首屏 `WithHot=1` 读取 `CommentList2`，降序去重写入 `hotComments`。 |
| `CORE.html` | §4.42 `CommentsPanel.vue`（`#c4-42`） | 改 | 记录遮罩式常驻标题栏、`buildCommentSections()` 区块顺序、共用滚动与同 ID 去重。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | `.comments-toolbar` 改为绝对定位遮罩条并带底边线；标题 22px、下内边距 20px、标题下细分隔线，区块间用空白分隔。 |
| `CORE.html` | §4.111 `utils/comment-sections.ts`（`#c4-111`） | 增 | 区块构建签名与“热评存在性”集中控制说明。 |
| `CORE.html` | §5.9 歌词与评论 | 改 | 调用树补 `WithHot=1` 与 `commentRows`，说明首屏热评区块。 |
| `PROVIDER.html` | §2 CONVENTIONS 评论读取 | 改 | 首屏 `WithHot=1` 读取热评模块并全部降序展示。 |
| `PROVIDER.html` | §4.1 评论读取 / §4.3 `QqCommentList` | 改 | `WithHot` 仅首屏；`CommentList2` 作为“热评”区内容，不参与分页。 |

**工作记录**：

- 真实匿名请求歌曲 `107471791`：`WithHot=1` 时 `CommentList2` 返回 24 条 `State=3` 热评，`PraiseNum` 已按 1550 → 108 降序，与同页最新评论无重叠；`CommentList2.Total` 为 505 但不分页，应用只展示首屏模块内容。
- 热评在 API 层重新按 `likedCount` 降序并做 `CmId` 去重，不依赖上游顺序；渲染层按 `CmId` 从“评论”区块移除重复条目。
- 新增测试覆盖首屏 `WithHot`、后续页不携带、热评降序 / 去重 / 全量保留，以及 `buildCommentSections()` 的热评区块存在性与去重。
- 顶部标题栏改为绝对定位遮罩：滚动内容从栏目顶部开始，初始区块标题被标题栏覆盖；标题栏与区块标题不会同时出现同一文字，标题字号 22px，顶部标题栏与区块标题均带底边线。
- `npm run typecheck`、`npm test`（53 个测试文件、283 个用例）与 `npm run build` 通过。
- 未做真实窗口验收；区块顺序、遮罩层叠与去重逻辑由接口测试、工具函数单测与模板审阅覆盖。

### 4.52 页面级“返回”按钮复用后退逻辑 [已解决] 

**描述**：ISSUE 要求所有页面级“返回”按钮遵守与后退键相同的后退逻辑：“返回”表示回到进入本页的入口，应复用后退逻辑，而不是写死目标路由。

**解决方案**：

- 专辑页与歌手页的“返回搜索”、歌单页的“返回我的歌单”（含加载失败状态）统一改为“返回”并调用 `goBack()`，与后退键共用浮层关闭与页面访问栈逻辑。
- 移除 `AlbumView` / `PlaylistView` 中因此不再使用的 `useRouter` / `router`；已使用 `goBack()` 的专辑 / 歌手 / MV 页头返回按钮保持不变。
- 页面级返回不再依赖来自搜索或我的歌单的假设，入口可以是搜索、发现、最近歌单、歌手页等任意上一页。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 页面级返回按钮条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“页面级‘返回’按钮复用后退逻辑” | 增 | 记录统一入口与移除的写死路由。 |
| `USER.html` | §2 CONVENTIONS · 后退 / 前进手势 | 改 | 页面级“返回”按钮与后退键共用同一后退逻辑。 |
| `CORE.html` | §4.92 `back-navigation.ts`（`#c4-92`） | 改 | 返回按钮（含错误状态）统一调用 `goBack()`，不写死目标路由。 |

**工作记录**：

- 全仓检索页面级“返回”按钮：专辑 / 歌手 / MV 页头与专辑 / 歌手 / 歌单的详情动作区、歌单错误状态全部调用 `goBack()`，不再存在 `router.push('/search')` / `router.push('/library')` 形式的返回入口。
- `npm run typecheck`、`npm test`（53 个测试文件、283 个用例）与 `npm run build` 通过。
- 未做真实窗口验收；页面栈行为由既有 `test/back-navigation.test.ts` 覆盖，本次仅统一按钮入口。

### 4.53 评论昵称 Avestan 字母缺字修复 [已解决] 

**描述**：ISSUE 报告 Atwood - Hush 的 2020-02-26 18:36 评论昵称 `🥚🥚🖱️🖱️𐬼𐬻𐬺` 为乱码。核对上游原始响应：`Nick` 与上报文本完全一致，并非取字或清洗损坏。码位为 `U+1F95A` ×2、`U+1F5B1` + `U+FE0F` ×2 与 `U+10B3C` / `U+10B3B` / `U+10B3A`（Avestan 字母）。系统已安装 Noto Color Emoji 覆盖两个表情；但没有字体覆盖 Avestan 区，`fc-list :charset=10b3a` 为空，因此三个 Avestan 字母显示为缺字方框，整体看起来像乱码。

**解决方案**：

- 新增依赖 `@fontsource/noto-sans-avestan`（OFL-1.1），与 Yi、Linear B 的接入方式一致。
- `src/renderer/main.ts` 导入 `@fontsource/noto-sans-avestan/avestan-400.css`，只加载 Avestan 子集。
- 正文 `font-family` 在 `Noto Sans Linear B` 之后加入 `Noto Sans Avestan`，仅在现有字体缺字时回退；不修改评论文本，也不替换或过滤原字符。
- 表情仍由 Noto Color Emoji 渲染，Avestan 为 RTL 文字，按字体自身的书写方向显示。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | Atwood - Hush 评论昵称乱码条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“评论昵称 Avestan 字母缺字修复” | 增 | 记录真实码位、缺字原因与字体回退。 |
| `CORE.html` | §3 SBOM | 增 | 新增 `@fontsource/noto-sans-avestan`（OFL-1.1），覆盖 `U+10B00-10B3F`。 |
| `CORE.html` | §4.22 `main.ts`（`#c4-22`） | 改 | 记录 Avestan 样式导入与 `Noto Sans Avestan` 回退。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 罕见文种字体回退补充 Avestan。 |
| `package.json` | dependencies | 改 | 新增 `@fontsource/noto-sans-avestan`。 |

**工作记录**：

- 上游真实昵称经匿名读取确认：`Nick = "🥚🥚🖱️🖱️𐬼𐬻𐬺"`，评论正文为 `YSC🍟`，`PubTime=1582713379`。
- `fc-list :charset=1f95a` / `:charset=1f5b1` 均命中 `Noto Color Emoji`；`:charset=10b3a` 无结果，确认缺字来自 Avestan 区。
- `fc-scan` 确认字体子集字符集为 `10b00-10b35 10b39-10b3f`，覆盖 `U+10B3A`–`U+10B3C`。
- `npm run build` 产物包含 `noto-sans-avestan-avestan-400-normal-*.woff2` / `.woff`。
- `npm run typecheck`、`npm test`（53 个测试文件、283 个用例）与 `npm run build` 通过。
- 未做真实窗口截图验收；字符覆盖由 fontconfig 字符集与构建产物验证。

### 4.54 移除搜索页固定推荐搜索词 [已解决] 

**描述**：ISSUE 要求去掉搜索框下方固定的推荐搜索词 chips；若有可用的上游接口则改为动态推荐，没有则直接移除。

**解决方案**：

- 调查后确认没有可用的动态热词来源：旧接口 `c.y.qq.com/splcloud/fcgi-bin/gethotkey.fcg` 虽返回 `code=0`，但内容停留在 2019 年（“我们的歌”“冰雪奇缘2”“桥边姑娘”等），不再维护；musicu `music.search.SearchCgiService` 的 `GetHotKey`、`GetHotSearch`、`HotSearch`、`GetHotSearchKey`、`GetSearchTips`、`GetHotWords` 与 `music.search.HotSearchSvr / GetHotSearchList` 全部返回 `500003 / 860100001`；当前 `y.qq.com` 搜索页打包产物中没有热词接口引用。
- 按 ISSUE 的兜底要求移除固定推荐词：删除 `HOT_KEYWORDS` 常量、`useKeyword()` 与搜索框下方的 chips 模板。
- 删除只服务该区块的 `.chips` 样式；`.chip` 仍由歌手页的专辑筛选使用，保留。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 搜索页固定推荐搜索词条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“移除搜索页固定推荐搜索词” | 增 | 记录接口调查结论与移除范围。 |
| `USER.html` | §5.2.8 页面结构 · 搜索 | 改 | 页面结构去掉“热门关键词 chips”。 |
| `CORE.html` | §4.44 `SearchView.vue`（`#c4-44`） | 改 | 说明不显示热门关键词 / 固定推荐词及其原因。 |

**工作记录**：

- `gethotkey.fcg` 响应示例：`{"code":0,"data":{"hotkey":[{"k":"我们的歌 ","n":765562}, ...]}}`，数据与当前热门无关，不适合作为动态推荐。
- musicu 探测均返回 `req_0.code=500003`、`subcode=860100001`（方法不存在）。
- 移除后搜索页保留页头、搜索框、五类标签与结果区；`npm run typecheck`、`npm test`（53 个测试文件、283 个用例）与 `npm run build` 通过。
- 未做窗口截图验收；搜索页布局由模板与样式审阅覆盖。

### 4.55 播放条加入歌单报 IPC 克隆失败 [已解决] 

**描述**：ISSUE 报告 regression：从播放条把歌曲添加到歌单时报错 “An object could not be cloned”。

**解决方案**：

- 根因：`ui` store 用深层 `ref` 保存全局 `songPicker` 请求，`songMids` 数组被 Vue 转为响应式代理；`PlaylistPicker` 把 `props.songMids` 原样传给 `playlistEdit.addSongs()`，预加载再交给 `ipcRenderer.invoke('playlist.addSongs', id, mids)`，Electron 结构化克隆无法克隆 Proxy，于是抛出该错误。
- `src/renderer/stores/ui.ts` 的 `songPicker` 改为 `shallowRef`，请求对象与数组保持原始引用，不参与深层代理；`openSongPicker()` 仍用 `filter(Boolean)` 生成新的普通数组。
- 新增 `ui-store` 测试：`openSongPicker()` 后对请求对象和 `songMids` 执行 `structuredClone()` 不抛错，锁定 IPC 可克隆约束。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 播放条加入歌单克隆失败条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“播放条加入歌单报 IPC 克隆失败” | 增 | 记录根因、修复与测试。 |
| `CORE.html` | §4.31 `stores/ui.ts`（`#c4-31`） | 改 | 说明 `songPicker` 使用 `shallowRef` 以避免 IPC 克隆失败。 |

**工作记录**：

- 该回归由 `78c92d8`（收藏特殊 revealer 与触屏手势）引入：选择器请求从播放条内的 `computed` 数组改为 ui store 的深层 `ref`，数组因此变成 Proxy。
- `structuredClone(reactive(['a']))` 在 Node 中会抛 `DOMException: An object could not be cloned`，与报错一致；改用 `shallowRef` 后克隆正常。
- `npm run typecheck`、`npm test`（53 个测试文件、284 个用例）与 `npm run build` 通过。
- 未做真实窗口验收；IPC 可克隆性由 store 单测与 Electron 行为复现确认。

### 4.56 下载按钮缓存 / 下载标记与缓存完成刷新 [已解决] 

**描述**：ISSUE 要求改进下载按钮在已缓存 / 已下载两种状态下的标记对比度，并让缓存写入完成像下载完成一样主动触发按钮更新，覆盖歌单页与播放条。

**解决方案**：

- 已缓存按钮的 24px 背景块改用 purple-light，图标改为 purple；已下载按钮的背景块改用 purple，图标改用 `--on-accent`（dark 取 cream，light 取 highlight）；两种状态继续互斥，图标颜色不写死单主题色值。
- 主进程在完整音频写入播放缓存成功后新增 `audioCache:stored` 通知，携带 `songMid` 与 `quality`；只在真正落盘后发送一次，缓存命中与普通进度上报不触发。
- `preload` 暴露 `audioCache.onStored`；`stores/download` 创建时订阅该事件，收到后调用 `refreshAssets([songMid])`。歌曲表与播放条读取同一份 `assets`，按钮即时更新，不需要重新进入页面。
- 新增测试：音频协议完整响应落盘后发送一次 `audioCache:stored`；下载 store 收到通知后刷新该曲资产。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 下载按钮标记条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“下载按钮缓存 / 下载标记与缓存完成刷新” | 增 | 记录配色、事件通路与测试。 |
| `USER.html` | §5.2.3 播放条 / §5.2.4 歌曲列表 | 改 | 下载按钮状态改为 purple-light 背景 + purple 图标（已缓存）、purple 背景 + on-accent 图标（已下载，dark cream / light highlight），并说明缓存完成后即时更新。 |
| `CORE.html` | §4.1 `types.ts`（`#c4-1`） | 改 | 新增 `AudioCacheStored`。 |
| `CORE.html` | §4.2 `shared/ipc.ts`（`#c4-2`） | 改 | `audioCache` 增加 `onStored`。 |
| `CORE.html` | §4.59 `audio-protocol.ts`（`#c4-59`） | 改 | 说明落盘后推送 `audioCache:stored`。 |
| `CORE.html` | §4.71 `stores/download.ts`（`#c4-71`） | 改 | 订阅缓存写入完成并刷新资产。 |
| `CORE.html` | §5.18 音频缓存进度 | 改 | 调用树补充写入完成通知与下载 store 刷新。 |

**工作记录**：

- 已下载图标不使用 `purple-light`，改用 accent 前景角色 `--on-accent`：light 主题解析为 highlight `#E9DBF2`，dark 主题解析为 cream `#FFF7E4`，与下载按钮的 purple 填充形成对应关系。
- 缓存命中 `file` 分支与本地下载文件播放也会上报 `complete: true` 的进度；因此按钮刷新不复用进度事件，改用独立的写入完成通知，避免每次播放 / seek 都触发资产查询。
- `npm run typecheck`、`npm test`（54 个测试文件、286 个用例）与 `npm run build` 通过。
- 未做真实窗口验收；配色由 CSS token 审阅覆盖，事件链路由主进程协议测试与 store 单测覆盖。

### 4.57 歌曲可播状态改为官方权益位图判定 [已解决] 

**描述**：ISSUE 要求按 reference 文件夹的参考文献重做歌曲可用性逻辑。旧实现按 `status`、`pay_play`、`pay_month`、`pay_status` 的阻断判定栈判断，把付费墙显示成灰色不可播；调查表也确认 `status` / `pay` / `file.size_*` 无法单独表达地区版权与账号权限。

**解决方案**：

- 以 `DOC/reference/qq-music-web/playability.md`（官方网页端生产构建取证）为权威：`status` 1 / 2 直接不可播；`action.switch` 的 `play_lq` / `play_hq` / `play_sq` / `play_5_1` 任一位为 1 时可播；否则 `pay_play` 或 `pay_down` 为 1 时为付费墙；否则 `try` 位为 1 且 `file.size_try > 0` 时为试听；其余不可播。`switch` 缺失、为 0 或非法时为未知，界面保持正常并尝试播放。
- `Song` 增加 `playSwitch`、`payDown`、`sizeTry`、`tryStartMs`、`tryEndMs`，移除不再参与判定的 `pay_month` / `pay_status`；`PayInfo.free` 改为 `pay_play` 与 `pay_down` 都不为 1；旧缓存缺少新字段时按 4.22 整份失效。
- `shared/permission.ts` 由阻断判定栈改为 `songPlayState()` 五态（`playable` / `paywall` / `trial` / `disabled` / `unknown`）与 `canStartPlayback()` / `canDownloadSong()`；位读取使用除法取模，避免 32 位按位运算截断。
- `SongTable`：不可播行灰化并禁用播放 / 下一首 / 下载；付费墙行保持正常显示与可点击，由 player store 提示开通 VIP 或购买；试听行显示“试听”角标并允许播放；未知状态按正常行处理；下载只允许可播与未知状态。
- player store 在取流前拦截不可播与付费墙，`playList` / `playAt` / `startPlaylistPlayback` 在改变队列前同样拦截，避免点击付费墙歌曲后清空当前队列；自动续播与上一首只定位到可开始播放的歌曲；试听歌曲按 `try_begin`–`try_end` 裁剪，若上游直接返回片段则整段播放。
- `PlaylistView` 的“播放全部”从第一首可开始播放的歌曲起播，“下载全部”只入队可下载歌曲；CSS 增加 `.quality-badge.trial`。
- 搜索接口不返回 `switch`，搜索结果按未知状态展示并尝试播放，不为判灰逐行补详情。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | “重做歌曲可用性这块的逻辑”条目 | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“歌曲可播状态改为官方权益位图判定” | 增 | 记录判定公式、字段调整、交互与文档操作。 |
| `DOC/reference/qq-music-web/playability.md` | 新增 | 增 | 纳入官方网页端可播判定取证文档，作为可播逻辑的权威来源。 |
| `USER.html` | §1 TERMS | 改 | 权限（PayInfo）改为只表达角标；新增权益位图、可播状态、试听。 |
| `USER.html` | §2 CONVENTIONS | 改 | “不可播标记与曲库最高音质”改为“可播状态判定”与“可播状态的时效”。 |
| `USER.html` | §5.2.4 歌曲列表 | 改 | 五种状态的角标与交互、试听片段、下载范围。 |
| `USER.html` | §5.2.9 播放队列 / §5.3 错误与通知 | 改 | 自动续播跳过不可播与付费墙；未知状态尝试播放后兜底。 |
| `CORE.html` | §1 文件树 / §2 CONVENTIONS | 改 | `permission.ts` 改为可播状态派生；可播性判定改为读取权益位图。 |
| `CORE.html` | §4.1 `types.ts`（`#c4-1`） | 改 | 新增 `SongPlayState` 与 `Song` 新字段，删除 `PlaybackPermission` 与 `pay_month` / `pay_status`。 |
| `CORE.html` | §4.11 `api/song.ts`（`#c4-11`） | 改 | 记录 `action.switch`、`pay_down`、试听字段映射与 `PayInfo.free` 新语义。 |
| `CORE.html` | §4.29 `stores/player.ts`（`#c4-29`） | 改 | 记录取流前拦截、队列定位跳过与试听裁剪。 |
| `CORE.html` | §4.39 `SongTable.vue`（`#c4-39`） / §4.46 `PlaylistView.vue`（`#c4-46`） | 改 | 状态渲染、交互与播放 / 下载过滤。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 增加 `.quality-badge.trial` 样式契约。 |
| `CORE.html` | §4.103 `validation.ts`（`#c4-103`） | 改 | 校验新字段，旧结构失效。 |
| `CORE.html` | §4.105 `permission.ts`（`#c4-105`） | 改 | 记录五态判定公式、位读取与两个 helper。 |
| `CORE.html` | §5.11 可播性判定与播放兜底（`#c5-11`） | 改 | 调用树改为 switch 判定与试听裁剪。 |
| `PROVIDER.html` | §4.1 / §4.3 | 改 | 补充 `action.switch` / `pay_down` / 试听字段、位表、搜索无 switch 与 `PayInfo` 新映射。 |
| `README.md` / `ABOUT.html` | 歌单行 | 改 | 改为按权益位图标记可播 / 付费墙 / 试听 / 不可播 / 未知。 |

**工作记录**：

- `DOC/reference/` 原先只存在于另一个工作树且未提交；本轮把 `qq-music-web/playability.md` 纳入当前任务分支，作为可播判定唯一外部权威来源。
- 新增 / 更新测试：`test/permission.test.ts` 覆盖五态与官方样本（`81683` 可播、`16897793` 付费墙、`134283265` 不可播）；`test/api/song-detail.test.ts` 覆盖 `switch` / `pay_down` / 试听字段映射；`test/player-store.test.ts` 覆盖自动续播跳过付费墙与不可播、点击付费墙不替换队列；`test/validation.test.ts` 改为校验 `playSwitch`。
- `npm run typecheck`、`npm test`（54 个测试文件、291 个用例）与 `npm run build` 通过。
- 未做真实窗口截图验收；真实账号的 `switch` 位未重新抓取（reference 样本为未登录、非中国大陆出口），应用以当前账号响应为准，判定公式与官方代码一致。
- `investigate-song-meta.html` 仅作为早期调查参考，且被 `.gitignore` 忽略，不纳入文档集。

### 4.58 歌单权益改用批量详情复核与批量详情封装 [已解决] 

**描述**：上一版可播检测直接读取歌单 / 「我喜欢」列表返回的 `action.switch`。investigate-song-meta 分支的复核结论显示：668 首「我喜欢」中有 10 首列表仍带 play 位，但详情与 vkey `auth_switch` 已无 play 位，只读列表会把实际不可播的歌曲显示为可播。要求并入该分支的结论与方案，并按方案改进检测数据来源与批量详情实现。

**解决方案**：

- 并入 `investigate-song-meta` 的 `playability.md`（305 行）与 `song-availability-plan.md`，以详情侧 `action.switch` 作为判灰权威；列表只负责顺序与基础元数据。
- 新增 `src/main/api/track-info.ts` 的 `fetchTrackInfoByMids(mids)`：内部去重、过滤空白 mid、固定按 `TRACK_INFO_BATCH_MAX = 100` 分片串行请求 `CgiGetTrackInfo`，批量缺失的歌曲用 `get_song_detail_yqq` 单曲兜底（`SONG_DETAIL_CONCURRENCY = 2`）；仍缺失的歌曲不放入返回 Map，由调用方处理。
- 常量 `SONG_DETAIL_BATCH = 50` 改名为 `TRACK_INFO_BATCH_MAX = 100`，不向调用方暴露分片参数；上游 110–160 首会静默截断、180 首以上会断开 HTTP/2，因此固定 100。
- `song.ts` 删除本地分片与单曲兜底实现，`fetchTracksById()` 直接走封装；`playlist-write.ts` 的写入身份解析改用同一入口，删除重复分片。
- `playlist.ts` 的 `requestPage()` 在列表映射后调用封装入口批量取详情，用 `applyTrackEntitlements()` 覆盖 `action.switch` / `pay` / `status` / 试听字段后再返回并写入缓存；详情缺失时保留列表字段。新增 `fetchPlaylistMeta()` 供改名 / 删除等写操作读取 `dirId`，跳过整页权益复核。
- 新增 `test/api/track-info.test.ts`，覆盖任意数量按 100 分片、空输入、去重、响应乱序、单曲兜底、批量结构错误与仍然缺失；歌单测试增加“列表可播 / 详情不可播”覆盖样本。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `IMPL.md` | 新增“歌单权益改用批量详情复核与批量详情封装” | 增 | 记录列表快照问题、封装方案与文档操作。 |
| `DOC/reference/qq-music-web/playability.md` | 全文 | 改 | 并入调查分支的 305 行版本，补充列表 / 详情不一致实测与批量上限。 |
| `DOC/reference/qq-music-web/song-availability-plan.md` | 全文 | 增 | 纳入检测方法改正与批量封装方案，状态标记为已实施。 |
| `CORE.html` | §1 文件树 | 改 | 新增 `api/track-info.ts`。 |
| `CORE.html` | §2 CONVENTIONS · 可播性判定 | 改 | 声明歌单列表 `switch` 可能过期，必须由详情复核覆盖。 |
| `CORE.html` | §4.11 `song.ts`（`#c4-11`） | 改 | 删除本地分片描述，记录 `fetchTracksById` 与 `applyTrackEntitlements`。 |
| `CORE.html` | §4.12 `playlist.ts`（`#c4-12`） | 改 | 记录 `requestPage` 详情权益复核与 `fetchPlaylistMeta`。 |
| `CORE.html` | §4.50 常量（`#c4-50`） | 改 | `SONG_DETAIL_BATCH = 50` 改为 `TRACK_INFO_BATCH_MAX = 100`。 |
| `CORE.html` | §4.55 `playlist-write.ts`（`#c4-55`） | 改 | 改名读取改为 `fetchPlaylistMeta`，写入身份解析走 `fetchTrackInfoByMids`。 |
| `CORE.html` | §4.112 `track-info.ts`（`#c4-112`） | 增 | 记录封装入口、100 首上限、单曲兜底与调用方。 |
| `CORE.html` | §5.10 歌单加载（`#c5-10`） | 改 | 调用树补充 `fetchTrackInfoByMids` 详情复核。 |
| `CORE.html` | §5.11 可播性判定（`#c5-11`） | 改 | 补充列表 `switch` 过期与详情覆盖说明。 |
| `PROVIDER.html` | §4.1 批量歌曲详情 | 改 | 单次上限 50 → 100，补充静默截断 / 断连与详情判灰权威。 |
| `PROVIDER.html` | §4.3 `QqSong` / 说明 | 改 | `action.msgid` 入模型，补充列表 `switch` 过期与详情复核要求。 |
| `USER.html` | §2 CONVENTIONS · 可播状态判定 | 改 | 说明歌单 / 「我喜欢」加载时用批量详情复核权益。 |
| `ISSUE.md` | 歌曲可用性条目 | 不动 | 已在上一轮标记 ` [已解决] `，本轮为同一需求的实现修正。 |
| `README.md` / `ABOUT.html` | 歌单行 | 不动 | 用户可见状态语义未变化。 |

**工作记录**：

- `git merge investigate-song-meta` 并入 `78d2f9f`；`DOC/reference/qq-music-web/playability.md` 出现 add/add 冲突，按调查分支版本解决（该版本已包含上一轮实现说明与列表过期取证）。
- 批量详情封装内部顺序 `await` 分片，不加 300ms 间隔；vkey 限速策略不变，判灰仍然不申请 vkey。
- 歌单缓存结构未变；已写入的旧快照仍可读取，但页面加载会用详情复核后的结果覆盖并回写。
- `npm run typecheck`、`npm test`（55 个测试文件、299 个用例）与 `npm run build` 通过。
- 未用真实账号重新复核 668 首；数据来源与样本沿用调查分支的实测记录。

- 代表样本：OK / ALL THE LOVE 等 10 首列表 `switch` 为 `134331775`（OK 为 `134327679`，play 位为 1），详情与 vkey `auth_switch` 为 `134283265`（无 play 位），两边 `pay_play = pay_down = 0`、`size_try = 0`、`status = 0`，vkey `result = 104003`；已下架 4 首（Ambitionz Az A Ridah、6 Foot 7 Foot、Kangaroo Court、Blow）列表与详情均为 `65537`；可播样本 After Party 两侧均为 `16905999`。同账号 468 首歌单、BULLY - DELUXE 专辑 20 首两组对照均无列表 / 详情差异。
- 官方详情页 / 专辑页读取详情侧 `switch`，因此能正确置灰；只读歌单列表的客户端会误判。`action.icons` 最低位为 `copyright`、第 18 位为 `isVip`，`action.msgid`（本轮详情 `3` / 列表 `0`）可辅助解释灰显原因，但本应用不消费，不进入 `Song` 模型；判灰只使用 `switch`、`pay`、`size_try` 与 `status`。

### 4.59 清理 reference 参考文档 [已解决]

**描述**：可播检测与批量详情方案已落地，reference 文件夹中的取证与方案内容已并入 PROVIDER / CORE / IMPL，不再需要作为独立参考文件保留。

**解决方案**：

- 删除 `DOC/reference/qq-music-web/playability.md` 与 `DOC/reference/qq-music-web/song-availability-plan.md`。
- 移除 USER / CORE / PROVIDER 中指向 reference 文件的链接；switch 位表、灰色公式、列表快照过期结论保留在 PROVIDER §4.3、CORE §4.105 与 §5.10；100 首批量上限保留在 CORE §4.50 / §4.112。
- IMPL 4.57 / 4.58 保留历史实施记录，不再指向可访问的参考文件。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `DOC/reference/qq-music-web/playability.md` | 全文 | 删 | 删除官方网页端取证文档。 |
| `DOC/reference/qq-music-web/song-availability-plan.md` | 全文 | 删 | 删除批量详情与检测改正方案。 |
| `CORE.html` | §2 / §4.50 / §4.105 | 改 | 移除 reference 链接，保留结论引用。 |
| `PROVIDER.html` | §4.3 | 改 | 移除 reference 链接，位表与判定依据仍在本节。 |
| `USER.html` | §1 / §2 | 改 | 移除 reference 链接，指向 PROVIDER §4.3。 |
| `IMPL.md` | 新增“清理 reference 参考文档” | 增 | 记录删除范围与保留位置。 |

**工作记录**：

- 本次仅删除文档与链接，不改动代码、测试或协议；`DOC/reference/` 目录随文件删除一并移除。

### 4.60 评论区块标题与分隔线之间增加空白 [已解决]

**描述**：ISSUE 要求微调可滚动评论页面内的区块标题：在区块标题与下方分隔线之间增加空白，并从分隔线下面的空白中取等量空间补到上方，保持标题到内容的整体间距不变；后续追加线宽 2px 与左右固定伸出的要求。

**解决方案**：

- 带分隔线的区块标题 `.comments-heading-ruled .comments-title` 增加 `padding-bottom: 8px`，使短线相对标题文字下移 8px。
- 短线改为 2px；取消百分比宽度，标题使用 `width: fit-content` 收缩到文字宽度，左内边距 0、右内边距 24px，短线左端与文字对齐、右端伸出 24px。
- 同一区块 `.comments-heading-ruled` 的下内边距由 20px 减为 11px，其中 8px 抵新增空白、1px 抵线宽增量；标题、短线与内容的总高度与改动前一致，滚动区块定位不受影响。
- 首个区块标题没有分隔线，保持原有 20px 下内边距与遮罩行为不变；常驻标题栏 `.comments-toolbar` 与区块之间的额外上间距也不变。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `ISSUE.md` | 评论 / 热评标题与分隔线间距条目及“2px / 右侧固定伸出”子项 | 改 | 子项行尾追加 ` [已解决] `，最终取值更新为左侧 0px、右侧 24px。 |
| `IMPL.md` | 新增“评论区块标题与分隔线之间增加空白” | 增 | 记录间距调整与总高度不变的处理。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 记录 2px 短线随标题宽度、右端伸出 24px，标题与短线之间留 8px。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 记录 `fit-content`、右侧 24px 内边距、8px 标题间距与 11px 区块下内边距。 |

**工作记录**：

- 首次把“分隔线”误认为常驻标题栏 `.comments-toolbar` 的底边线，已撤回该改动；最终调整的是可滚动内容区内的区块标题。
- 仅调整 CSS，未改动组件结构、滚动监听或标题切换逻辑；标题新增的 8px 下内边距、1px 线宽增量与区块减少的 9px 下内边距相抵，带线标题的总高度不变。
- `npm run typecheck`、`npm test`（55 个测试文件、299 个用例）与 `npm run build` 通过。
- 间距按 CSS 盒模型核算，滚动定位依赖的标题总高度未变化；左右伸出最终经预览对比后定为左侧 0px、右侧 24px。
- 未做真实窗口截图验收。

### 4.61 会员成长等级显示 [已解决]

**描述**：TODO 第一项要求加入用户会员等级显示，使用 `Lv. X` 字样。现有会员标记只表达绿钻 / 豪华绿钻 / 超级会员档位，没有数字成长等级。

**解决方案**：

- `VipStatus` 增加 `growthLevel: number | null`，由 `vip_login_base` 的 `identity.level` 映射；只接受正整数，缺失、0 或非数值为 `null`，不参与会员档位与可播判断。
- `MemberBadge` 在档位图标 / 文字后追加 `Lv. X`；仅图标模式下把成长等级并入 `aria-label`（如“绿钻，Lv. 7”），使侧栏与设置页共用同一展示实现。
- 新增 `.member-level` 样式：10px、600 字重、muted 色、不收缩；侧栏昵称仍可省略，等级不被裁掉。
- 侧栏账号 pill 与设置页账号区沿用现有 `MemberBadge`，因此两处同时获得 `Lv. X`；非会员、未知状态或缺少等级时不显示。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 1 项“加入用户会员等级显示” | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“会员成长等级显示” | 增 | 记录字段映射、展示位置与无障碍处理。 |
| `USER.html` | §1 TERMS | 增 | 新增“会员成长等级”，说明与会员档位不是同一概念。 |
| `USER.html` | §2 CONVENTIONS · 会员状态展示 | 改 | 档位图标 / 文字后显示 `Lv. X`；非会员或缺失不显示。 |
| `USER.html` | §5.2.2 侧栏与导航 / §5.2.7 设置页 | 改 | 账号 pill 与账号区同步显示成长等级；设置页原型加入 `Lv. 7`。 |
| `CORE.html` | §1 文件树 / §4.1 `types.ts`（`#c4-1`） | 改 | `MemberBadge` 描述更新；`VipStatus` 增加 `growthLevel`。 |
| `CORE.html` | §4.13 `api/user.ts`（`#c4-13`） | 改 | 记录 `identity.level` → `growthLevel` 的正整数校验。 |
| `CORE.html` | §4.23 `App.vue`（`#c4-23`）/ §4.48 `SettingsView.vue`（`#c4-48`） | 改 | 账号区域补充 `Lv. X`。 |
| `CORE.html` | §4.49 `styles/main.css`（`#c4-49`） | 改 | 新增 `.member-level` 视觉契约。 |
| `CORE.html` | §4.107 `MemberBadge.vue`（`#c4-107`） | 改 | 记录成长等级渲染、显示条件与 `aria-label`。 |
| `PROVIDER.html` | §4.1 VIP 状态 / §4.3 `QqVipData` | 改 | 补充 `identity.level` 字段与 `growthLevel` 转换。 |
| `README.md` / `ABOUT.html` | 登录行 | 改 | 会员档位后补充 `Lv. X`。 |

**工作记录**：

- 用当前登录凭证实测 `vip_login_base`：`identity.vip = 1`、`identity.level = 7`、`nextlevel = 8`、值图标路径为 `lv_7.png`；确认 `identity.level` 是可直接展示的会员成长等级。
- 新增 / 更新测试：`test/member-badge.test.ts` 覆盖 `Lv. 7` 文本与仅图标模式的无障碍名称、缺失等级不渲染；`test/api/vip-status.test.ts` 覆盖 `identity.level` 映射与未知 / 非会员的 `null` 回退。
- `npm run typecheck`、`npm test`（55 个测试文件、301 个用例）与 `npm run build` 通过。
- 未做真实窗口截图验收；侧栏昵称省略与等级不收缩由 CSS 契约保证。

### 4.62 核心页面状态写入 URL 与页面栈 base URL 去重 [已解决]

**描述**：TODO 第二项要求把核心状态写入 URL 参数，方便前进 / 后退恢复；同时前进 / 后退栈需要按 base URL 去重，例如切换搜索类型时应替换当前栈项，而不是为每个类型新增一条后退记录。子项覆盖歌手页歌曲 / 专辑切换、下载页过滤与搜索页搜索词 / 类型。

**解决方案**：

- `back-navigation` 新增 `basePath()`，记录页面栈时比较去掉 query / hash 的路径：同一 base path 下只改 query 时替换栈顶，不新增后退步骤；不同路径仍正常入栈。
- 搜索页：关键词与类型同步到 `?q=` / `?type=`（`song` 省略）；提交搜索、切换类型时用 `router.replace` 更新 query；`watch(route.query)` 在直接打开、后退 / 前进时恢复状态并重新搜索，并用 `loading` / `searched` 避免 query 回写触发重复请求。
- 歌手页：歌曲 / 专辑页签同步到 `?view=albums`（歌曲省略）；切换页签用 `router.replace`，`watch(route.query.view)` 恢复页签并在需要时补拉专辑；切换歌手时按当前 URL 初始化页签。
- 下载中心：状态过滤同步到 `?filter=active|done|failed`（全部省略）；切换过滤用 `router.replace`，`watch(route.query.filter)` 在后退 / 前进时恢复。
- 默认值不写入 URL；直接打开带参数的地址时按参数恢复，非法参数按默认值处理。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `TODO.md` | 第 2 项“优化URL形式” | 改 | 行尾追加 ` [已解决] `。 |
| `IMPL.md` | 新增“核心页面状态写入 URL 与页面栈 base URL 去重” | 增 | 记录参数、恢复逻辑与页面栈去重。 |
| `USER.html` | §2 CONVENTIONS · 后退 / 前进手势 | 改 | 增加同一 base path 仅 query 变化时替换栈项。 |
| `USER.html` | §2 CONVENTIONS · 页面状态与 URL | 增 | 记录搜索 / 歌手 / 下载页的 query 参数、默认值省略与直接打开恢复。 |
| `USER.html` | §5.2.8 搜索页 / 歌手页 / 下载中心 | 改 | 补充对应 URL 参数与恢复行为。 |
| `CORE.html` | §4.44 `SearchView.vue`（`#c4-44`） | 改 | 记录 `q` / `type` 同步与 query 恢复去重。 |
| `CORE.html` | §4.67 `DownloadsView.vue`（`#c4-67`） | 改 | 记录 `filter` 同步与恢复。 |
| `CORE.html` | §4.73 `ArtistView.vue`（`#c4-73`） | 改 | 记录 `view=albums` 同步与恢复。 |
| `CORE.html` | §4.92 `back-navigation.ts`（`#c4-92`） | 改 | 记录 base path 去重替换栈顶。 |

**工作记录**：

- `test/back-navigation.test.ts` 新增两条用例：同一路径仅 query 变化时后退直接回到进入页、不同 base path 仍分别入栈。
- `test/downloads-view.test.ts` 的 SSR 渲染补装内存路由，以提供 `useRoute` / `useRouter` 上下文。
- `npm run typecheck`、`npm test`（55 个测试文件、303 个用例）与 `npm run build` 通过。
- 未做真实窗口导航验收；URL 参数与页面栈行为由单元测试和类型检查覆盖。
