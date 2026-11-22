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

### 4.24 取消 vkey 批量探测，改为元数据判断可播性

**状态**：设计已定稿，代码与 USER / CORE / PROVIDER 文档待实施。

**描述**：排查 104009 风控后确认，根因是歌单页的可用性探测通过批量申请 vkey 实现：每 50 首一批，逐档请求 `flac → 320k → 128k`，一次打开大歌单可能产生数十次 vkey、数百到数千首歌的媒体授权，形态与批量抓取接近。上游没有“不申请播放链接即可判断当前账号可播性”的独立接口；`file.size_*` 只能说明曲库是否存在某档音质，`status` 与 `pay` 字段只能提供状态与付费条件，最终可播性仍由播放时 vkey 决定。因此取消列表级 vkey 探测，改为基于元数据的前置判断，实际播放失败再由 `NO_STREAM` 流程兜底。

**最终判断逻辑**：只定义“不可播”的阻断条件，自顶向下顺序检查；命中阻断立即判不可播并跳过后续判断，全部通过则默认可播。

```text
status ∈ {1, 2} → 不可播，结束

pay_play == 1:
  ├── pay_month == 1 且 VIP 确认有效（known && isVip）→ 可播，结束
  ├── pay_month == 0 且 超级会员确认有效（known && level == 'svip'）→ 可播，结束
  └── 最后检查 pay_status == 0 → 不可播

全部通过 → 可播
```

规则说明：

- `pay_status` 只在 `pay_play=1` 的最后一步检查；`pay_play=0` / 缺失时直接跳过整个付费判断。
- 会员权益足够时直接判可播，不再检查 `pay_status`。
- 会员权益不满足时，才看最终兜底：`pay_status == 0` 表示没有单独购买，判不可播；`pay_status == 1` 表示已购买，继续落到默认可播。
- `pay_status` 缺失不等于 0，不产生阻断，最终默认可播。
- `pay_play=1 & pay_month=1 & VIP=unknown`：不会命中“VIP 确认有效”，最终由 `pay_status` 决定；若 `pay_status=0` 则不可播，若缺失则默认可播。
- `pay_play=1 & pay_month=0` 只有确认的超级会员（`HugeVip=1`，内部 `level='svip'`）可直接通过；豪华绿钻、绿钻、unknown 都落到最终 `pay_status` 判断。
- `status=3`（仅限部分区域）不阻断，继续走付费判断；区域允许列表不可得，播放失败后兜底。
- VIP 字段映射：`vip` = 绿钻，`svip` = 豪华绿钻，`HugeVip` = 超级会员；已用同一账号购买超级会员前后对照确认。
- `price_track` / `price_album` 不作为任何判断依据。
- `time_free` 不作为限免判断；实测限免歌 `time_free=0` 且 `pay_play=0`，已由 `pay_play=0` 跳过付费判断覆盖。
- `size_try>0` 不能单独判定只有试听；普通付费歌也带试听片段，只有完整档位全为 0 时才可能只有试听。
- 字段缺失不设置阻断，最终保持可播；不存在单独的“可播条件”列表。

**目标实现范围**：

1. `Song` 内部模型增加 `status`、`pay_play`、`pay_month`、`pay_status`；`toSong()` / `rawSongToSong()` 负责映射，播放历史与歌单缓存同步持久化这些字段。
2. `shared/validation.ts` 的 `isSong` 同步要求新字段；旧歌单缓存、播放历史、最近歌单按 IMPL 4.22 自动整份清除并重新获取。
3. 删除列表级探测链路：`useAvailability`、`song.probe` IPC / preload、`api/availability.ts` 的 `probeAvailability`、`PROBE_*` 相关常量；`resolveStreamUrls` 只保留给真实播放与下载。
4. `PlaylistView` 不再调用 `useAvailability`、`setProbeState`；队列快照不再按 `playable === false` 过滤，`metadataReady()` 不再依赖探测结果。
5. `SongTable` 的不可播标记、音质角标、播放 / 下载按钮禁用改为读取 `PlaybackPermission`（由 `Song` 元数据派生）；音质角标只表示“曲库最高音质”，不再暗示当前账号一定可取流。
6. 下载资产状态的 `maxQuality` 改为读取 `file.size_*` 或移除该字段，不再依赖探测缓存。
7. 播放权限判断按“阻断条件级联”实现：先看会员权益，最后检查 `pay_status == 0`；命中不可播立即返回，未命中阻断则默认可播。不维护可播条件列表。
8. 播放失败、不可播与区域限制只在播放时处理；保留 `NO_STREAM` 沿队列向后尝试与连续 10 首停止逻辑。

**文档操作**：

| 文档 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `IMPL.md` | 新增“取消 vkey 批量探测，改为元数据判断可播性” | 增 | 记录根因、最终判断逻辑、目标实现范围与待办文档操作。 |
| `USER.html` | §5.2.3 / §5.2.4 / §5.2.8 | 改 | 删除列表级“最高可用音质 / 不可播标记”的探测描述；音质角标改为“曲库最高音质”；不可播只在播放时确认并提示。 |
| `USER.html` | §5.3.1 Toast · 合并 | 改 | 删除“连续不可播跳歌”作为探测结果的表述，保留播放失败时的汇总提示。 |
| `CORE.html` | §4.39 `SongTable.vue`（`#c4-39`） | 改 | 音质 / 不可播标记改为读取 `PlaybackPermission` 与 `file.size_*`，不再接收 `availability`。 |
| `CORE.html` | §4.46 `PlaylistView.vue`（`#c4-46`） | 改 | 删除 `useAvailability`、`setProbeState` 与队列快照的探测依赖。 |
| `CORE.html` | §4.52 `api/availability.ts`（`#c4-52`） | 删 | 删除整个探测模块与 `probeAvailability` / `peekAvailability`。 |
| `CORE.html` | §4.65 / §4.61 队列快照 | 改 | 删除 `playable !== false` 过滤与 `metadataReady()` 的 availability 门控。 |
| `CORE.html` | §4.2 `ipc.ts` / §4.50 `constants.ts` | 改 | 删除 `song.probe` IPC 与 `PROBE_*` 常量。 |
| `CORE.html` | §5.11 歌单可用性检测（`#c5-11`） | 删 | 删除 vkey 探测调用树，改为播放时 `NO_STREAM` 处理说明。 |
| `CORE.html` | §5.5 播放单曲 / §5.16 下载 | 改 | 明确 vkey 只用于真实播放与下载；列表不申请播放链接。 |
| `PROVIDER.html` | §4.1 / §4.3 `QqSong` | 改 | 补充 `status`、`pay.pay_play` / `pay_month` / `pay_status`、`file.size_*` 的消费语义；删除“用于候选音质”的探测描述。 |
| `README.md` / `ABOUT.html` | 歌单 / 歌曲列表行 | 改 | 删除“最高可用音质 / 不可播标记”的承诺，改为播放时确认。 |

**工作记录**：

- 当前只完成设计记录，未删除探测代码，也未修改上述文档；避免在逻辑定稿前破坏现有行为。
- 实现时先扩展 `Song` 与校验器，再删除探测链路，最后同步文档与测试。
