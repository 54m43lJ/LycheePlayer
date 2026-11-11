# IMPL — 开发过程记录

本文只记录实现 `doc/evol-2` 蓝图时暴露出的文档问题、未写明细节与技术坑，作为后续修订 `EVOLVE.md` / `PROVIDER.html` / `CORE.html` / `USER.html` / `BUILD.html` 的输入，不改写产品文档本身。

阅读约定：同一事实若前后章节冲突，以较后的章节为准；与实现不一致时以 `src/` 代码为准。受后续修改影响的早期结论已在原节标注“后续修正”，避免把历史方案当成当前实现。

## 1. 开发中发现文档的错误

### 1.1 歌手歌曲接口的响应层级与 PROVIDER 不一致 [已解决]

问题描述：`PROVIDER.html` 的 `§4.1` 说歌手歌曲来自 `musichall.song_list_server / GetSingerSongList`，顶层节点是 `singerSongList`；`§4.3` 的 `QqArtistSongData` 又写成 `singerSongList.data.{totalNum,songList}`。但 `test/fixtures/singer-songs.json` 的 `req_0.data` 是扁平的 `{ singerMid, totalNum, songList }`，并没有 `singerSongList` 包裹。如果严格按文档取值，歌手页会永远显示空列表。


解决方法：
- `api/artist.ts` 同时接受扁平 data 与 `singerSongList.data` 包裹两种形状，优先扁平；
- 歌曲列表统一经 `songInfo → rawSongToSong` 映射，分页用 `totalNum` 与已载入数计算 `hasMore`；
- 以 fixture 回放测试锁定扁平响应的映射结果，避免后续误改。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1 歌手歌曲行 | 改 | 注明 `musicu` 返回的 `req_0.data` 为扁平 `{songList,totalNum}`，`singerSongList` 仅可能是外层兼容形状。 |
| `PROVIDER.html` | §4.3 `QqArtistSongData` | 改 | 改为扁平模型，并补一句“兼容 `singerSongList.data` 包裹”。 |
| `CORE.html` | §4.75 `api/artist.ts` | 改 | 记录双形状解析与 `songInfo` 映射。 |
| `EVOLVE.md` | #4 | 不动 | 响应模型以 PROVIDER 为主责，见本表前两行。 |

实际操作（2026-11-10，分支 `docs/artist-song-response-shape`）：

- `PROVIDER.html` §4.1 歌手歌曲行：删除“顶层节点 `singerSongList`”，改为 `req_0.data` 扁平 `{ totalNum, songList }`，并注明 `singerSongList.data` 仅为外层兼容形状。
- `PROVIDER.html` §4.3 `QqArtistSongData`：改为扁平字段模型，保留可选 `singerSongList.data` 兼容包裹；同步更新 `QqArtistSongData → ArtistDetail.songs` 映射行。
- `CORE.html` §4.75 `api/artist.ts`（原建议写 §4.74，实际章节为 §4.75）：记录 `const node = data.singerSongList?.data ?? data` 的扁平优先解析，以及 `songList[].songInfo` 统一经 `rawSongToSong` 映射。
- `CORE.html` §5 歌手页调用树说明：把“歌曲来自 `singerSongList` 顶层节点”同步改为 `req_0.data` 扁平 `songList`，并注明兼容包裹。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“不动”未处理。

验证：

- 对照 `src/main/api/artist.ts`：`ArtistSongData extends ArtistSongNode`，`node = data.singerSongList?.data ?? data`；`songList[].songInfo` 统一走 `rawSongToSong`。
- `grep singerSongList PROVIDER.html CORE.html` 后仅剩兼容说明，不再把 `singerSongList` 描述为唯一顶层节点。

状态：已解决。

### 1.2 PROVIDER 的验证状态与 fixture 证据不一致 [已解决]

问题描述：`PROVIDER.html` 顶部 note 仍写着“推荐、歌单创建 / 改名 / 删除与 MV 接口仍未完成 fixture 验证”，但 `§4.1 / §4.3` 已列出真实方法名，`EVOLVE.md` #14 也要求删除该 note。同时现有 fixture 并不能覆盖所有映射：`recommend-anonymous.json` 没有 `subtype:510` 的每日推荐卡片，`mv-search.json` 的 `mv.list` 为空，`mv-url.json` 的 `freeflow_url` / `url` 也都是空。文档同时存在“已落地”和“未验证”两种表述，且缺少对 fixture 覆盖范围的说明。


解决方法：
- 代码按 `PROVIDER` 给出的模块名、方法名与参数实现；
- 对空 fixture 按“合法空结果”处理，不伪造数据；
- 映射测试只验证可回放字段；接口真实可用性以实际请求结果为准，不在文档里提前宣称已验证；
- 在实现中保留降档、空状态与错误分支，避免 fixture 为空时页面崩溃。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1 / §4.3 note | 改 | 删除“仍未完成 fixture 验证”，增加“fixtures 覆盖范围与未覆盖字段”说明。 |
| `EVOLVE.md` | #14 实现思路 | 改 | 把“完成 fixture 验证”细化为必须覆盖的字段清单，并允许记录“fixture 为空”的合法结论。 |
| `CORE.html` | §4.53 / §4.55 / §4.56 | 不动 | 签名按 #14 验证结果维护，见本表前两行。 |

实际操作（2026-11-10，分支 `doc/provider-fixture-coverage`）：

- `PROVIDER.html` §3.4 末尾 note：删除“推荐、歌单创建 / 改名 / 删除与 MV 接口仍未完成 fixture 验证”。
- `PROVIDER.html` §4.1 note：补充“fixture 只覆盖部分映射、真实可用性以实际请求为准”，并链接到 §4.3 的覆盖说明。
- `PROVIDER.html` §4.3 note：新增 fixture 覆盖范围、未覆盖字段与空 fixture 处理原则：
  - 已用于回放测试：`search-song.json`、`singer-detail.json`、`singer-songs.json`、`album-detail.json`、`album-songs.json`、`mv-detail.json`、`comment-like.json`。
  - 部分覆盖：`recommend-anonymous.json` 只用于 `RecommendFeed` 入口，缺少 `subtype:510` 每日推荐卡，每日推荐映射未覆盖；雷达 / 猜你喜欢由测试内联数据覆盖。
  - 未覆盖：`mv-search.json` 的 `mv.list` 为空；`mv-url.json` 的 `freeflow_url` / `url` 为空。
  - 仓库中存在但当前未被回放测试引用：`recommend-shelves.json`、`comment-list.json`、`playlist-write.json`，不计入已验证范围。
  - 空 fixture 只按合法空结果处理；映射测试只锁定可回放字段，未覆盖字段以真实请求与代码防御分支为准。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“不动”未处理。
- `CORE.html` §4.53 / §4.55 / §4.56：按原表“不动”未处理。

验证：

- `grep "仍未完成 fixture 验证" PROVIDER.html` 无结果。
- 对照 `test/api/*.test.ts` 与 `test/fixtures/`：覆盖清单与测试实际引用的 fixture 一致；空列表 / 空 URL 仅作为合法空结果记录。

状态：已解决。

### 1.3 EVOLVE #13 的实现入口清单不完整 [已解决]

问题描述：`EVOLVE.md` #13 列出了 `mpv.ts`、`remote-engine.ts`、IPC、preload、types、constants、audio-protocol、player store、SettingsView、install.sh，但没有点名 `src/main/index.ts`（`stopMpv` 导入与 `before-quit`）、`src/main/settings.ts`（`audioEngine` 默认值与 sanitize）以及 `src/renderer/stores/settings.ts`（渲染进程默认设置）。如果只按清单逐项删除，类型检查仍会因为残留引用失败，或者设置页加载到已删除字段。


解决方法：
- 删除文件后全仓搜索 `mpv` / `audioEngine`，而不是只按清单删除；
- 同步清理 `main/index.ts` 的导入与退出钩子、主进程 settings 的默认值 / sanitize、渲染进程 settings store 的默认值；
- 用 `npm run typecheck` 作为收口条件，确认没有残留引用。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `EVOLVE.md` | #13 实现思路 | 改 | 补 `src/main/index.ts`、`src/main/settings.ts`、`src/renderer/stores/settings.ts` 三个清理入口。 |
| `CORE.html` | §1 File tree | 改 | 明确 `src/main/audio/` 删除后不再有目录条目，`src/renderer/audio/` 只保留 `engine.ts`。 |
| `CORE.html` | §4.6 `settings.ts` | 改 | 明确 `createDefaultSettings` 与 `sanitize` 都删除 `audioEngine`。 |
| `CORE.html` | §4.5 `main/ipc.ts` | 不动 | 该节不列具体 IPC 通道，mpv handler 清理属于代码侧，见 #13。 |

实际操作（2026-11-10，分支 `doc/core-mpv-cleanup`）：

- `CORE.html` §1 File tree note：明确 `src/main/audio/` 已随 mpv 方案删除、文件树不再保留该目录；`src/renderer/audio/` 只保留 `engine.ts`（HTML5 Audio 实现）。
- `CORE.html` §4.6 `settings.ts` note：明确 `createDefaultSettings` 与 `sanitize` 都不再包含 `audioEngine`，旧字段不读取、不写回。
- `CORE.html` §4.5 `main/ipc.ts`：按原表“不动”未处理。
- `EVOLVE.md`：仓库中已不存在该文件，无法补充 #13 的实现入口清单。

验证：

- `src/main/audio/` 不存在；`src/renderer/audio/` 只有 `engine.ts`。
- `grep -r "audioEngine\|mpv" src` 无结果；`src/main/settings.ts` 的 `createDefaultSettings` / `sanitize` 不再处理该字段。
- `CORE.html` §1 note 与 §4.6 note 已写入上述约束。

状态：已解决。

### 1.4 README.md 的同步约定与本次分支要求冲突 [已解决]

问题描述：`EVOLVE.md` §0 要求 `ABOUT.html` 与 `README.md` 同步，并规定“`README.md` 最终以 `ABOUT.html` 的转换结果为准”，各清单项的文档操作也反复要求“`README.md` 同步生成”。但本次任务明确要求删除 `README.md`；当时仓库里还保留 `convert-about.yml`，只要文档提交就会重新生成该文件。文档约定与分支目标直接冲突。


解决方法：
- 以 `ABOUT.html` 作为唯一产品说明来源，本次不维护 `README.md`；
- 删除 `README.md` 后不再让文档操作引用它；
- 转换 workflow 是否保留需单独决定，避免 CI 把已删除文件重新提交回来。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `EVOLVE.md` | §0 使用约定 | 改 | 把 `ABOUT.html` / `README.md` 同步改为“以 `ABOUT.html` 为准；本分支不保留 `README.md`”。 |
| `GUIDELINES.md` | 文档边界 | 改 | 明确 ABOUT 的维护入口，避免各清单项继续要求生成 md。 |
| `ABOUT.html` | 全文 | 不动 | 产品说明内容不变，只停止生成 Markdown 副本。 |

实际操作（2026-11-10，分支 `doc/about-single-source`）：

- `GUIDELINES.md` 文档边界：删除“`README.md` 是单独维护的项目首页”的表述，改为 `ABOUT.html` 是项目说明的唯一维护入口，本分支不保留 `README.md`。
- `ABOUT.html`：按原表“不动”，产品说明内容未改。
- `EVOLVE.md`：仓库中已不存在该文件，无法修改 §0 使用约定。
- 仓库中 `README.md` 不存在；`.github/workflows/` 只剩 `release.yml`，没有会重新生成 Markdown 的 `convert-about.yml`。

验证：

- `README.md` 不存在。
- `GUIDELINES.md` 中 `README.md` 只出现在“本分支不保留”的说明里，不再作为独立维护入口。
- `grep -r "convert-about" .github` 无结果。

状态：已解决。

## 2. 开发中发现文档没写明的细节

### 2.1 下载任务 / 索引缺少精确类型与持久化契约（批次模型后由 §4.15 取消） [已解决]

> 后续修正：§4.15 已彻底取消下载批次模型，`DownloadBatch`、`batchId` / `playlistId`、`DownloadSource = 'batch'`、索引中的 `batches` 与批次状态派生都不再存在。下载索引只有 `{ tasks }`，任务来源只保留 `network` / `cache`；本节的批次结论以 §4.15 为准。

问题描述：文档描述了 `DownloadTask.batchId`、`playlistId`、`source`、`DownloadBatch`、`SongAssetState` 与“按账号索引”，但没有给出 `source` 的枚举值、索引 JSON 的字段、哪些状态需要落盘，以及“清除已完成”对记录的处理。实现时这些都必须自行决定，否则主进程、preload 与 UI 三端无法对齐。


解决方法：
- 在 `shared/types.ts` 定义 `DownloadSource = 'network' | 'cache'`、`SongAssetState` 与 `DownloadTask`（批次类型后来由 §4.15 删除）；
- 索引固定为 `{ tasks }`，只持久化 `done` / `paused` 任务；启动时 `downloading/pending` 统一转为 `paused`；
- `clearCompleted` 只删除已完成任务记录，不删除文件；批次记录已随 §4.15 取消。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.1 `types.ts` | 增 | `DownloadSource`、`SongAssetState`、索引 JSON 结构；不再定义 `DownloadBatch`。 |
| `CORE.html` | §4.60 `download/manager.ts` | 改 | 补索引字段、持久化状态与 `clearCompleted` 语义；批次模型已由 §4.15 删除。 |
| `USER.html` | §1 TERMS 下载任务 / 下载中心 | 不动 | 术语由 #2 维护，见 CORE 两行。 |
| `EVOLVE.md` | #2 | 不动 | 类型契约以 CORE 为主责，避免与本文重复定义。 |

实际操作（2026-11-10，分支 `doc/download-index-contract`）：

- `CORE.html` §4.1 `types.ts`：新增 `DownloadSource = 'network' | 'cache'`、`DownloadIndex { tasks }`；`DownloadTask` 删除 `batchId` / `playlistId`，`source` 改为 `DownloadSource`；删除 `DownloadBatch`；`DownloadStorageInfo` 删除 `batchCount`。
- `CORE.html` §4.60 `download/manager.ts`：签名改为 `listDownloads(): DownloadTask[]`、`startDownload` / `startDownloads`、`assetStates` 以及 `clearDownloadDirectory` / `findDownloadedAudio` 等当前函数；说明索引只有 `{ tasks }`、只持久化 `done` / `paused`、启动时未完成任务转 `paused`、`loadedScope` 保护、退出同步原子写、`clearCompleted` 只清记录等规则。
- 为避免删除 `DownloadBatch` 后留下悬空引用，同步把 CORE 中直接依赖批次的章节改为无批次模型：§4.2 `download` IPC、§4.31 download store、§4.46 “下载全部”、§4.50 下载常量、§5.16 下载调用树与文件树注释。
- `USER.html` §1 TERMS：按原表“不动”未处理。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“不动”未处理。

验证：

- `grep "DownloadBatch\|startBatch\|pauseBatch\|resumeBatch\|removeBatch\|retryFailed\|DOWNLOAD_BATCH_MAX" CORE.html` 无结果。
- `DownloadTask.source`、`DownloadIndex`、`DownloadStorageInfo` 与 `src/shared/types.ts` 一致；`listDownloads` / `startDownloads` / `assetStates` 等签名与 `src/main/download/manager.ts` 一致。
- 索引只持久化 `done` / `paused`，启动时 `downloading` / `pending` 归一为 `paused`，与 `loadIndex` 实现一致。

状态：已解决。

### 2.2 下载文件命名与同名覆盖规则未定义 [已解决]

> 后续修正：§4.23 已将下载文件命名改为 `downloadFileName()` 的“歌名-歌手-专辑”，仅三者完全相同的文件才会覆盖；本节关于 `safeName(song.name)` 与同名覆盖的规则是当时的临时方案。

问题描述：文档只要求“文件放到 `downloadDir`”，没有规定文件名格式、歌手/歌名如何拼接、同名歌曲如何处理、是否允许覆盖已有文件。实现若直接使用歌名，遇到同名歌曲会互相覆盖；若加随机后缀，又会让用户难以在文件管理器里识别。


解决方法：
- 当时使用 `safeName(song.name) + 扩展名`，过滤文件系统非法字符并压缩空白；该方案已由 §4.23 的“歌名-歌手-专辑”规则取代；
- 同名文件按覆盖处理，不做静默改名；§4.23 之后仅“歌名 + 歌手 + 专辑”完全相同的文件才覆盖；
- 在文档补齐规则前，不引入随机 UUID 后缀，避免下载目录不可读。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `BUILD.html` | §11 存储 | 增 | 下载文件命名模板、非法字符处理、同名覆盖规则。 |
| `CORE.html` | §4.60 `download/manager.ts` | 改 | 明确 `downloadFileName` 的命名规则与仅完全相同曲目覆盖；`safeName` 仅用于入队占位路径。 |
| `USER.html` | §5.3 错误与通知 | 不动 | 不新增错误码，行为由 #2 维护。 |

实际操作（2026-11-10，分支 `doc/download-naming-template`）：

- `BUILD.html` §11 存储：下载行补文件名模板 `歌名-歌手-专辑.<mp3|flac>`、多歌手顿号连接、缺失片段跳过、非法字符替换与空白压缩、全空回退 `audio`；明确只有“歌名 + 歌手 + 专辑”完全相同的文件才会覆盖，入队占位路径使用 `songMid`，最终路径在出队时生成；同时把该行残留的批次描述改为单任务模型。
- `CORE.html` §4.60 `download/manager.ts`：在 `downloadFileName` 说明中补多歌手顿号连接、仅完全相同曲目覆盖，以及 `safeName(songMid)` 只用于入队占位路径、最终路径在出队时生成。
- `USER.html` §5.3：按原表“不动”未处理。

验证：

- 对照 `src/main/download/manager.ts`：`downloadFileName` 使用“歌名-歌手-专辑”并用 `-` 连接，`cleanName` 过滤 `\ / : * ? " < > |`，出队时调用 `downloadFileName(resolved.name, resolved.singers, resolved.albumName)`；入队占位路径为 `safeName(songMid)`。
- `BUILD.html` §11 下载行不再出现批次描述，命名与覆盖规则与代码一致。

状态：已解决。

### 2.3 歌单写入的读回校验、重复添加与创建 ID 选择未定义 [已解决]

> 后续修正：§4.35 修正了可编辑判定；§4.36 把 `id`（tid）与 `dirId` 分开，创建时必须同时返回两者；§4.39 又将写后读回 / 整单扫描移出写 API，`addSongs` / `removeSongs` 只返回 `{ changed }`，刷新统一由 `stores/playlist-edit.ts` 的 `refreshAfterWrite` 触发；§4.49 进一步规定内容写操作不删除歌单缓存。本节原有的 20 页读回、重复过滤与 `dirId` 回退 `tid` 等细节均已失效。

问题描述：文档要求“写后读回或成员可见性校验”，但没有说明读回多少页、如何判断重复添加、创建接口同时返回 `dirId` / `tid` 时选哪个、`dirId:0` 时是否回退 `tid`。如果实现只读第一页，新增歌曲在歌单末尾时会永远校验失败；如果只认 `dirId`，创建可能拿不到有效 ID。


解决方法：
- 写接口不读回成员，也不做写前整单扫描；写后刷新由渲染层统一触发（§4.39）；
- `addSongs` 只提交 `AddSonglist`，`removeSongs` 只提交 `DelSonglist`；80092 视为 `{ changed: false }`，其余错误继续抛出；
- 创建时 `id = result.tid`、`dirId = result.dirId`，两者都必须为正整数；
- 重复提示使用写接口返回的 `changed`，不再依赖本地成员集合或 `songCount` 变化。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1 歌单写入 / 歌单增删歌曲 | 改 | 明确 `dirId` 与 `tid` 的区别；写后确认由 CORE 的刷新流程负责，不在写接口内读回。 |
| `CORE.html` | §4.55 `api/playlist-write.ts` | 改 | 写 API 只负责写入并返回 `changed`；创建时 `id = tid`、`dirId = dirId`；写后刷新见 §4.39。 |
| `EVOLVE.md` | #14 | 不动 | 写后刷新与 ID 契约由 CORE 主责，见上一行。 |

实际操作（2026-11-10，分支 `doc/playlist-write-contract`）：

- `PROVIDER.html` §3.4 收藏写入：把“写后必须读回状态与成员可见性”改为写接口只负责写入，写后刷新由 CORE 的统一歌单刷新流程负责。
- `PROVIDER.html` §4.1 歌单写入 / 歌单增删歌曲：明确 `AddPlaylist` 的 `result.dirId` 是目录 ID、`result.tid` 是歌单标识；增删歌曲的 `dirId` / `tid` 不能混用；参数行删除未使用的 `dirName`。
- `PROVIDER.html` §4.2 写操作成功判定：区分收藏写入的读回与普通歌单增删歌曲的渲染层刷新。
- `PROVIDER.html` §4.3 `QqPlaylistWriteResult` 映射：补 `id = String(result.tid)`、`dirId = result.dirId`，两者不能互换。
- `CORE.html` §4.55 `api/playlist-write.ts`：创建补 `id = tid` / `dirId = dirId` 与参数 `{ bFmtUtf8: 1, dirName }`；改名改为先读详情拿 `dirId`、成功后返回 `readMeta`；删除改为先读 `dirId`、删除后由主进程清缓存、渲染层重载；保留 `PlaylistMutationResult { changed }` 与 80092 语义。
- `CORE.html` §4.61 `stores/playlist.ts`：把删除后的 `applyRemoval` 更正为当前 `removeMembers`，并补 `stop` / `refresh` / `clearRecent` 签名，使乐观移除与统一刷新流程一致。
- `CORE.html` §5.14 歌单编辑调用树：添加歌曲改为 `fetchTrackIdentities` + `CgiGetTrackInfo`；删除改为本地乐观移除 + `refreshAfterWrite` 统一刷新，不再写后读回成员。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“不动”未处理。

验证：

- 对照 `src/main/api/playlist-write.ts`：`createPlaylist` 返回 `id: String(tid)`、`dirId`；`addSongs` / `removeSongs` 只提交写入并返回 `{ changed }`，80092 返回 `changed:false`；`renamePlaylist` / `removePlaylist` 先 `readMeta` 获取 `dirId`。
- 对照 `src/renderer/stores/playlist-edit.ts`：`addSongs` / `removeSongs` 写后统一调用 `refreshAfterWrite(id)`。
- `grep "写后读回成员可见性" CORE.html PROVIDER.html` 无结果。

状态：已解决。

### 2.4 评论点赞的返回结构、`liked` 来源与点赞数处理未定义 [已解决]

问题描述：文档定义了 `CommentSort` 与评论列表映射，但评论模型里没有说明 `liked` 来自哪个上游字段；点赞接口只写了“返回最新点赞状态 / 数量”，fixture 里只有 `code/msg/subcode`，没有数量。实现必须自己决定 `liked` 的来源，以及点赞数为 0 时是否隐藏、失败回滚时如何恢复计数。


解决方法：
- 读取可选的 `IsPraised` 字段映射为 `Comment.liked`，并保留 `IsLiked` 作为兼容回退，字段缺失时按 `false`；登录后携带凭证，未登录等价匿名（§4.7）；
- `CommentLikeResult` 的 `likedCount` 设为可选；上游不返回数量时由前端乐观更新并在失败时回滚；
- 点赞 / 取消点赞统一走 `UpdateHotComment`，`type` 3 / 4；
- UI 在 `likedCount === 0` 时只显示按钮、不显示数字。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.3 `QqComment` | 改 | 增可选 `IsPraised` 字段（兼容 `IsLiked`）及“缺失按未点赞处理”的说明；登录后才按当前用户返回。 |
| `CORE.html` | §4.1 `types.ts` | 改 | `Comment.liked?`、`CommentLikeResult.likedCount?`。 |
| `CORE.html` | §4.15 `api/comment.ts` | 改 | 补 `IsPraised → liked`、`IsLiked` 兼容回退、登录凭据与点赞数量缺失的映射。 |
| `EVOLVE.md` | #5 / #14 | 不动 | 排序与点赞 UI 分别由 #5 / #14 维护，见对应项。 |

实际操作（2026-11-10，分支 `doc/comment-like-contract`）：

- `PROVIDER.html` §4.3 `QqComment`：新增可选 `IsPraised` / `IsLiked`。
- `PROVIDER.html` §4.3 `QqCommentList` 说明：消费字段补 `IsPraised` / `IsLiked`；明确 `IsPraised` 优先、`IsLiked` 兼容回退、两者缺失按未点赞，登录后才按当前用户返回。
- `PROVIDER.html` §4.3 `QqCommentList → CommentPage` 映射：补 `IsPraised` / `IsLiked → liked`，缺失为 `false`。
- `PROVIDER.html` §4.3 `QqCommentLikeResult → CommentLikeResult` 映射：明确上游不返回点赞数量，`likedCount` 为可选，前端乐观更新并在失败时回滚。
- `CORE.html` §4.1 `types.ts`：`Comment.liked` 改为可选，`CommentLikeResult.likedCount` 改为可选。
- `CORE.html` §4.15 `api/comment.ts`：补 `IsPraised → liked`、`IsLiked` 兼容回退、登录 Cookie 读取与点赞数量缺失语义；删除“以读回评论校正”的旧描述。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“不动”未处理。

验证：

- 对照 `src/main/api/comment.ts`：`liked: Number(raw.IsPraised ?? raw.IsLiked ?? 0) === 1`；`updateLike` 返回 `{ commentId, liked }`，不带数量；读取评论时携带当前凭证。
- `Comment` / `CommentLikeResult` 与 `src/shared/types.ts` 一致。

状态：已解决。

### 2.5 推荐分区刷新返回范围与缓存存储未定义 [已解决]

问题描述：文档新增了 `recommend.refresh(sectionId?)`，但没说明传入 `sectionId` 时是只返回该分区还是返回完整 feed，也没说明 24 小时缓存是内存缓存还是落盘、刷新失败时是否保留旧分区、空分区算合法结果还是错误。实现若猜错，渲染层会把其他分区覆盖成空。


解决方法：
- 主进程在传 `sectionId` 时只加载并返回该分区；渲染层按分区 id 合并到现有 feed；
- 24 小时缓存放在内存 `Map`，不落盘；
- 单个分区失败时优先保留该分区旧缓存，没有旧缓存则返回合法空分区；
- 空分区不抛错，由 UI 显示空状态。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.2 `ipc.ts` | 改 | 明确 `recommend.refresh(sectionId?)` 只返回被刷新分区。 |
| `CORE.html` | §4.53 `api/recommend.ts` | 改 | 补 24h 内存缓存、单分区失败保留旧值、空分区语义。 |
| `CORE.html` | §4.62 `stores/recommend.ts` | 改 | 补按分区合并与刷新失败处理。 |
| `EVOLVE.md` | #14 | 不动 | 分区刷新细节由 CORE 主责，见以上三行。 |

实际操作（2026-11-10，分支 `doc/recommend-section-cache`）：

- `CORE.html` §4.2 `ipc.ts`：`recommend.get` / `recommend.refresh` 改为当前签名 `(sectionId: string | null, token: number)`，补 `recommend.cancel(token)`；note 明确已登录时传 `sectionId` 只加载并返回该分区，`null` 才返回完整 feed，未登录返回完整空分区用于登录引导。
- `CORE.html` §4.53 `api/recommend.ts`：明确 24 小时缓存是进程内 `Map`、不落盘、`force` 绕过缓存；单分区失败保留旧 section，无旧缓存返回合法空分区；空分区不抛错；`AUTH_EXPIRED` 继续抛出，取消时抛中止错误且不继续填充后续分区。
- `CORE.html` §4.62 `stores/recommend.ts`：明确 `refreshSection` 只请求指定分区、成功按 id 替换且不覆盖其他分区，失败只写 `errors[id]` 并保留原内容。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“不动”未处理。

验证：

- 对照 `src/main/api/recommend.ts`：`cache` 为 `Map`，`buildFeed` 按 `only ? [only] : RECOMMEND_SECTION_IDS` 处理；失败时 `sections.push(hit?.section ?? emptySection(id))`，`AUTH_EXPIRED` 继续抛出。
- 对照 `src/renderer/stores/recommend.ts`：`fetchSection` 只替换返回的分区，`refreshSection` 只刷新指定 id。
- `CORE.html` §4.2 / §4.53 / §4.62 与当前 token 取消接口一致。

状态：已解决。

### 2.6 MV 降档后的 `quality` 语义与搜索分页未定义 [已解决]

问题描述：文档要求“默认最高清晰度，不可用时按 `fhd → hd → sd` 降档”，但没有说明返回的 `MvStream.quality` 表示请求档还是实际档；也没说明 MV 搜索与歌曲搜索是否共用 `pageNo`。如果返回请求档，UI 会高亮一个实际没取到的清晰度；如果分页各自为政，搜索页页码会错乱。


解决方法：
- `getMvStream` 返回实际采用的清晰度；`MvView` 的清晰度按钮跟随实际值高亮；
- 请求档不可用时在 API 内降档，`url: null` 表示从请求档起向下所有档位都不可用；
- MV 搜索复用歌曲搜索的页码与每页条数，搜索结果只合并 `mvs`，不影响歌曲分页。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.56 `api/mv.ts` | 改 | 明确 `MvStream.quality` 为实际档，`url:null` 的语义与降档顺序。 |
| `CORE.html` | §4.69 `MvView.vue` | 改 | 补按钮跟随实际清晰度与空流重试。 |
| `USER.html` | §5.2.8 MV 播放 | 不动 | 用户交互由 #14 维护，见 CORE 两行。 |

实际操作（2026-11-10，分支 `doc/mv-quality-semantics`）：

- `CORE.html` §4.56 `api/mv.ts`：明确成功时 `MvStream.quality` 是实际采用的档位，不是请求档；全部失败时返回请求档并令 `url: null`，表示从请求档起向下所有档位都不可用；补 MV 搜索与歌曲搜索共用页码 / 每页条数，搜索结果只合并 `mvs`。
- `CORE.html` §4.69 `MvView.vue`：明确清晰度按钮跟随 `stream.quality` 实际档高亮，不跟随请求档；`url: null` 时展示失败重试。
- `CORE.html` §4.70 `stores/mv.ts`：明确 `quality` 写回 `MvStream.quality`，成功为实际档、失败为请求档。
- `USER.html` §5.2.8：按原表“不动”未处理。

验证：

- 对照 `src/main/api/mv.ts`：`QUALITY_ORDER = fhd → hd → sd`，命中地址时返回 `{ quality: candidate, url }`，全部失败返回 `{ quality, url: null }`；`searchMv` 复用 `pageNo` 与搜索页大小。
- 对照 `src/renderer/stores/mv.ts`：`quality.value = result.quality`。
- `MvView` 的清晰度高亮条件为 `mv.quality === quality.value`。

状态：已解决。

### 2.7 最近歌单校验失败分类与 `stale` 字段未定义 [已解决]

问题描述：文档要求“删除或无权限则移除，校验失败保留条目并标 stale”，但没有定义 `stale` 放在哪个类型字段、`AUTH_EXPIRED` 算删除还是保留、缓存存在但网络失败时用哪份元数据展示。实现若处理不一致，会出现登录过期后最近歌单被永久删掉，或已删除歌单一直残留。


解决方法：
- `RecentPlaylist` 增加可选 `stale`；
- `NO_PERMISSION` / `UPSTREAM_CHANGED` 视为删除或无权限，移除条目且不补位；
- 网络 / 超时等其余失败保留条目并标 `stale`，展示缓存元数据；
- `AUTH_EXPIRED` 当前按移除处理，用户重新登录后重新积累最近列表。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.61 `stores/playlist.ts` | 改 | 补失败分类、`AUTH_EXPIRED` 处理、节流 / 单飞与不补位规则。 |
| `CORE.html` | §4.1 `types.ts` | 改 | `RecentPlaylist.stale?: boolean`。 |
| `USER.html` | §2 CONVENTIONS 最近歌单 | 改 | 补校验失败时保留 / 移除的用户可见行为。 |
| `EVOLVE.md` | #11 | 不动 | 实现细节由 CORE / USER 主责，见以上三行。 |

实际操作（2026-11-10，分支 `doc/recent-playlist-stale`）：

- `CORE.html` §4.61 `stores/playlist.ts`：补失败分类：`NO_PERMISSION` / `AUTH_EXPIRED` / `UPSTREAM_CHANGED` / 歌单不存在时移除且不补位；网络 / 超时等其余失败保留并标记 `stale`，展示缓存元数据；保留 5 秒节流 + 单飞。
- `CORE.html` §4.1 `types.ts`：`RecentPlaylist.stale?: boolean` 已存在，内容与代码一致，无需改动。
- `CORE.html` §5.17 最近歌单调用树：把移除条件补为 `NO_PERMISSION` / `AUTH_EXPIRED` / `UPSTREAM_CHANGED`，其余失败标记 `stale` 并展示缓存元数据。
- `USER.html` §2 CONVENTIONS 最近歌单：补用户可见行为：已删除 / 无权限 / 登录失效 / 上游结构变化时移除且不补位；网络 / 超时等临时失败保留并标记失效，继续显示缓存元数据。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“不动”未处理。

验证：

- 对照 `src/renderer/stores/playlist.ts` 的 `validateRecent()`：`NO_PERMISSION` / `AUTH_EXPIRED` / `UPSTREAM_CHANGED` 走 `continue` 移除；其余错误使用 `cachedMeta ?? item` 并置 `stale: true`。
- `RecentPlaylist.stale?` 与 `src/shared/types.ts` 一致。

状态：已解决。

### 2.8 运行期依赖的发行版包名映射未定义 [已解决]

问题描述：`BUILD.html §1` 只列了 GTK / libsecret / NSS / ALSA / D-Bus 这些库名，`install.sh` 却需要具体的发行版包名。文档没有给出 Arch 的 `pacman` 包名映射，脚本若猜错会安装失败或装到无关包。非 Arch 发行版的行为也需要明确。


解决方法：
- Arch 使用 `gtk3 libsecret nss alsa-lib dbus` 五个包，`pacman -S --needed`；
- 只对检测到 `pacman` 的系统执行；其他发行版打印提示并跳过；
- 依赖安装失败只提示“可能影响启动”，不影响客户端本体安装。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `BUILD.html` | §1 环境要求 | 增 | Arch 包名映射表与“其他发行版自行安装”的说明。 |
| `BUILD.html` | §5 curl 安装 | 改 | 说明脚本按该映射安装，检测不到 `pacman` 时跳过。 |
| `EVOLVE.md` | #12 | 不动 | 包清单以 BUILD §1 为准，见上一行。 |

实际操作（2026-11-10，分支 `doc/arch-runtime-packages`）：

- `BUILD.html` §1 环境要求：新增 Arch 包名映射表：GTK → `gtk3`、libsecret → `libsecret`、NSS → `nss`、ALSA → `alsa-lib`、D-Bus → `dbus`；补 note 说明 `install.sh --with-deps` 只对检测到 `pacman` 的系统使用该映射，其他发行版需自行安装等价依赖。
- `BUILD.html` §5 curl 安装：运行期依赖 note 补脚本按 §1 映射执行 `pacman -S --needed gtk3 libsecret nss alsa-lib dbus`，未检测到 `pacman` 时跳过并提示自行安装。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“不动”未处理。

验证：

- 对照 `install.sh`：`PKGS="gtk3 libsecret nss alsa-lib dbus"`，通过 `command -v pacman` 判断后执行 `pacman -S --needed`；未检测到时打印跳过提示。
- `BUILD.html` §1 的五项映射与脚本包名一致。

状态：已解决。

## 3. 其它技术上踩的坑

### 3.1 退出时异步写索引被截断，且未加载下载模块会写空索引 [已解决]

问题描述：下载索引最初用异步 `writeFile` + 防抖落盘。`before-quit` 里 `void save()` 不会等待 Promise，进程退出后最后一批完成 / 暂停状态可能丢失。更严重的是：本次启动若从未打开下载模块，内存里没有任务，退出时仍会写出一份空索引，把上次的下载记录覆盖掉；切换账号时旧的防抖定时器也可能把旧账号任务写进新账号索引。


解决方法：
- 增加 `loadedScope` 保护：从未加载过下载模块时，`flushDownloads` / `saveIndex` 直接返回；
- 退出时改为同步 `writeFileSync` + `renameSync` 写入 `.part` 再原子替换；
- 切换账号前先清掉旧定时器并把旧账号索引落盘，再清空内存、加载新索引。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.60 `download/manager.ts` | 改 | 补索引生命周期：`loadedScope` 保护、退出同步落盘、切号先写旧索引。 |
| `BUILD.html` | §11 存储 | 增 | 索引 `.part` 原子替换、退出时同步写入的约束。 |
| `EVOLVE.md` | #2 | 不动 | 持久化细节由 CORE / BUILD 主责，见以上两行。 |

实际操作（2026-11-10，分支 `doc/download-index-atomic-save`）：

- `CORE.html` §4.60 `download/manager.ts`：已在 §2.1 更新中写入 `loadedScope` 保护、退出同步 `writeFileSync` + `renameSync` 原子替换、切换账号前先落盘旧账号索引；本次核对与代码一致，无需再改。
- `BUILD.html` §11 存储：下载行补索引生命周期约束：先写 `<index>.part` 再原子替换；退出时同步写盘；从未加载下载模块时不写空索引；切换账号前先把旧账号索引落盘。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“不动”未处理。

验证：

- 对照 `src/main/download/manager.ts`：`flushDownloads()` 使用 `writeFileSync` + `renameSync`；`saveIndex()` / `flushDownloads()` 均有 `if (!loadedScope) return`；切换账号流程先落盘旧索引。
- `BUILD.html` §11 与 CORE §4.60 对索引原子写、退出同步写、空索引保护的描述一致。

状态：已解决。

### 3.2 整单下载被单次 IPC 的 100 首上限挡住 [已解决]

> 后续修正：§4.15 已将 `download.startBatch` 改为 `download.startMany`，常量 `DOWNLOAD_BATCH_MAX` 更名为 `DOWNLOAD_QUEUE_MAX`；“整单入队上限与单曲 IPC 上限分离”的结论不变。

问题描述：`download.startMany` 的请求走 `midArray` 校验，而 `midArray` 默认上限是 `IPC_SONG_MIDS_MAX = 100`。整单下载允许最多 `DOWNLOAD_QUEUE_MAX = 2000` 首，结果超过 100 首的歌单点击“下载全部”会直接被参数校验拒绝，而不是进入统一队列。


解决方法：
- `download.startMany` 单独使用 `DOWNLOAD_QUEUE_MAX` 作为 `midArray` 上限；
- `song.getUrls` 等仍保持 100 首限制；`song.probe` 使用 `PROBE_MIDS_MAX = 50`；
- 渲染层资产查询按 100 首分块，整单入队不按 100 分块。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.2 `ipc.ts` | 改 | 逐通道列出批量上限：整单入队用 `DOWNLOAD_QUEUE_MAX`，播放链接等仍用 100，探测用 `PROBE_MIDS_MAX = 50`。 |
| `CORE.html` | §4.60 `download/manager.ts` | 改 | 明确整单入队上限与单曲 IPC 上限分离。 |
| `EVOLVE.md` | #1 | 不动 | 整单下载能力见 #2，上限由 CORE 主责。 |

实际操作（2026-11-10，分支 `doc/download-queue-limit`）：

- `CORE.html` §4.2 `ipc.ts`：新增批量上限说明：`download.startMany` 的 `midArray` 上限为 `DOWNLOAD_QUEUE_MAX = 2000`；`song.getUrls`、`playlist.addSongs` / `removeSongs`、`favorite.get` 等其余 mid 数组使用 `IPC_SONG_MIDS_MAX = 100`；`song.probe` 使用 `PROBE_MIDS_MAX = 50`，渲染层探测调度也按 50 分批。
- `CORE.html` §4.60 `download/manager.ts`：明确 `DOWNLOAD_QUEUE_MAX` 只作用于整单入队，`song.getUrls` 等单曲 IPC 仍受 `IPC_SONG_MIDS_MAX = 100` 限制，`song.probe` 使用 `PROBE_MIDS_MAX = 50`。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“不动”未处理。

验证：

- 对照 `src/main/ipc.ts`：`download.startMany` 使用 `DOWNLOAD_QUEUE_MAX`；`song.getUrls`、`playlist.addSongs` / `removeSongs`、`favorite.get` 使用默认 `IPC_SONG_MIDS_MAX`；`song.probe` 显式使用 `PROBE_MIDS_MAX`。
- 对照 `src/shared/constants.ts`：`DOWNLOAD_QUEUE_MAX = 2000`、`IPC_SONG_MIDS_MAX = 100`、`PROBE_MIDS_MAX = 50`（已由早期 30 调整为 50）。

状态：已解决。

### 3.3 资产状态查询触发上游探测风暴 [已解决]

问题描述：`download.assetStates` 最初直接调用 `probeAvailability` 补 `maxQuality`。一个 1000 首歌单会分 20 批、每批 50 首，触发大量歌曲详情与 vkey 请求；而 UI 的下载图标其实只依赖缓存 / 下载状态。这个实现会让打开歌单就明显增加上游压力，也更容易触发限流。


解决方法：
- `availability.ts` 新增 `peekAvailability`，只读现有可用性缓存，不主动探测；
- `assetStates` 的 `maxQuality` 改为从该缓存取，未探测过就返回 `null`；
- 列表页原有的 `useAvailability` 负责按可视需要探测，资产查询不再额外打上游。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.58 `cache/audio.ts` / `availability.ts` | 改 | 增 `peekAvailability` 只读接口及其使用边界。 |
| `CORE.html` | §4.60 `download/manager.ts` | 改 | 明确 `assetStates` 不触发上游探测，`maxQuality` 可为空。 |
| `CORE.html` | §4.2 `ipc.ts` | 不动 | IPC 通道与参数不变，只改主进程查询来源。 |

实际操作（2026-11-10，分支 `doc/availability-peek-cache`）：

- `CORE.html` §4.52 `api/availability.ts`（原建议写 §4.58，实际接口在 §4.52）：签名补 `peekAvailability(mids): Map<string, SongAvailability>`；note 明确它只读现有缓存、不探测、不写缓存，未探测歌曲不出现在结果中。
- `CORE.html` §4.60 `download/manager.ts`：明确 `assetStates` 用 `peekAvailability` 补 `maxQuality`，不主动探测上游；未探测过时 `maxQuality` 为 `null`。
- `CORE.html` §4.2 `ipc.ts`：按原表“不动”未处理，IPC 通道与参数未变。
- 注：`cache/audio.ts` 的 `getCachedAudioInfo` 原本就是只读本地文件，无需改动；`peekAvailability` 属于可用性缓存，不在 `cache/audio.ts`。

验证：

- 对照 `src/main/api/availability.ts`：`peekAvailability` 只读取 `accountCache()` 中未过期条目，不发请求；`probeAvailability` 才执行探测。
- 对照 `src/main/download/manager.ts`：`assetStates` 调用 `peekAvailability(unique)`，`maxQuality` 缺失时为 `null`。

状态：已解决。

### 3.4 音频代理的 200 / 206 完整响应判定与进度节流 [已解决]

问题描述：`lychee-audio` 代理既要透传 Range，又要判断什么时候可以落盘缓存、什么时候上报进度。最初只看 status：200 算完整，206 算局部。但不少上游对 `Range: bytes=0-` 返回 206，且 `Content-Range` 覆盖整个文件；若一律按局部处理，永远不会缓存，也不会发完成进度。反过来把局部 206 当完整又会产生半截缓存。


解决方法：
- 用 `Content-Range` 的 `bytes 0-{end}/{total}` 判断是否覆盖完整文件，200 直接视为完整；
- 完整分支累积 chunks，结束后写缓存并上报 `complete=true`；
- 局部 206 只透传，不缓存、不推进完成度；
- 进度按 300ms 节流；缓存命中时直接上报 100% 完整；请求取消时同时中止上游 `net.fetch`。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.59 `media/audio-protocol.ts` | 改 | 补 200/206/full-range 的完整判定、缓存命中 100%、300ms 节流。 |
| `CORE.html` | §5.17 音频缓存进度 | 改 | 调用树补完整 / 局部 / 缓存命中三个分支。 |
| `EVOLVE.md` | #3 | 不动 | 进度语义由 #3 定，实现细节见 CORE 两行。 |

实际操作（2026-11-10，分支 `doc/audio-progress-branches`）：

- `CORE.html` §4.59 `media/audio-protocol.ts`：完整响应判定、缓存命中 100%、局部 206 不落盘等规则已存在；本次把进度节流明确为 `CACHE_PROGRESS_THROTTLE_MS = 300`。
- `CORE.html` §5.18 音频缓存进度（原建议写 §5.17，实际章节为 §5.18）：调用树改为 `handleStream` 的四个分支：缓存命中 / 200 完整 / 覆盖完整文件的 206 / 局部 206；完整分支写缓存并按 300ms 节流上报，局部 206 只透传。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“不动”未处理。

验证：

- 对照 `src/main/media/audio-protocol.ts`：`complete = status === 200 || (Content-Range 为 bytes 0-(n-1)/n)`；完整分支写缓存并按 `CACHE_PROGRESS_THROTTLE_MS` 节流；缓存命中与本地下载文件直接上报 `complete: true`；局部 206 直接透传。
- `src/shared/constants.ts` 中 `CACHE_PROGRESS_THROTTLE_MS = 300`。

状态：已解决。

### 3.5 缓存转下载的硬链接会跨设备失败 [已解决]

> 后续修正：硬链接方案已弃用。缓存与下载可能跨文件系统，硬链接的收益不足以抵消 `EXDEV` / 回退分支带来的复杂度；现在统一复制，复制失败直接回退网络下载。

问题描述：“缓存达到最高档时本地转移”优先用硬链接。但缓存目录在 `userData`，下载目录可能在另一块磁盘或另一分区，`link()` 会抛 `EXDEV`。如果异常直接冒泡，任务会被标记失败；实际上复制文件即可完成转移。另外缓存文件可能在转移过程中被清理，失败后应回退网络下载而不是让任务停在失败态。


解决方法：
- 不再使用硬链接；缓存转下载统一 `copyFile`（`copyCachedAudio`）；
- 复制失败时把 `source` 改回 `network` 并继续正常下载；
- 只有网络下载失败才把任务标记 `failed`。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.60 `download/manager.ts` | 改 | 明确缓存转下载统一复制、不使用硬链接；复制失败回退网络下载。 |
| `BUILD.html` | §11 存储 | 增 | 缓存与下载可能跨文件系统，说明统一复制 / 复制失败回退网络下载。 |
| `EVOLVE.md` | #2 | 不动 | 转移规则见 #2，技术细节由 CORE / BUILD 主责。 |

实际操作（2026-11-10，分支 `fix/cache-copy-only`）：

- `src/main/cache/audio.ts`：删除 `link` 导入与硬链接分支；`linkCachedAudio` 重命名为 `copyCachedAudio`，统一 `copyFile`。
- `src/main/download/manager.ts`：改用 `copyCachedAudio`；复制失败仍把 `source` 改回 `network` 并继续下载。
- `test/download-manager.test.ts`：同步重命名 mock。
- `CORE.html` §4.60 / §5.16：改为“统一复制缓存文件，不使用硬链接”。
- `BUILD.html` §11 存储：改为“统一复制；复制失败时改回网络下载”。
- `USER.html` §2 CONVENTIONS 缓存与下载：删除“优先硬链接，失败回退复制”，改为“复制缓存文件”。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“不动”未处理。

验证：

- `grep -rn "linkCachedAudio\|await link(" src test` 无结果。
- 对照 `src/main/cache/audio.ts`：`copyCachedAudio` 只调用 `copyFile`；`src/main/download/manager.ts` 在复制异常时把 `source` 改回 `network`。
- `npm run typecheck` 通过；`npx vitest run test/download-manager.test.ts` 通过。

状态：已解决。

### 3.6 旧窄屏 64px / 56px 常驻侧栏样式与抽屉冲突 [已解决]

> 后续修正：旧的 64px / 56px 常驻图标栏规则已从样式表删除；900px 断点只保留单列 grid + 覆盖式抽屉，560px 只收窄抽屉宽度。

问题描述：`main.css` 原有的 `@media (max-width: 900px)` 把侧栏收成 64px 常驻图标栏，`@media (max-width: 560px)` 又改成 56px，并把 `.nav-item` 的 `font-size` 设为 0。新方案要求窄屏改成默认隐藏的覆盖式抽屉，但旧规则仍会先命中；如果只改组件类名，抽屉会被压成一条图标栏，文字也消失。


解决方法：
- 在样式表末尾追加窄屏覆盖块，重新设置 `--sidebar-width: 0`、单列 grid、`position: fixed`、`transform: translateX(...)`；
- 恢复抽屉内的 `.nav-item` 字号、间距、`.user-meta` 与 `.brand` 文本；
- 删除旧的 64px / 56px 常驻栏、隐藏文本与图标化规则；900px 只保留抽屉规则，560px 只收窄抽屉宽度。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.49 `styles/main.css` | 改 | 说明 900px / 560px 只保留单列 grid + 覆盖式抽屉；删除 64px / 56px 常驻栏规则。 |
| `CORE.html` | §4.23 `App.vue` | 改 | 补窄屏单列 grid、固定抽屉与 revealer 的组合关系；抽屉覆盖内容区，不压缩主内容。 |
| `USER.html` | §5.2.1 窗口与布局 | 不动 | 布局契约由 #11 维护，见 CORE 两行。 |

实际操作（2026-11-10，分支 `doc/sidebar-drawer-rules`）：

- `src/renderer/styles/main.css`：删除 `@media (max-width: 900px)` / `(max-width: 560px)` 中 64px / 56px 常驻图标栏、隐藏品牌文本 / 导航文字、`.nav-item` 字号归零与 `.user-meta` 隐藏规则；保留 560px 的 `.brand-mark` 尺寸与通用页面间距。抽屉规则由末尾覆盖块统一提供。
- `CORE.html` §4.49：改为“900px 单列 grid + 固定覆盖式抽屉，560px 只收窄抽屉宽度；抽屉覆盖内容区，不压缩主内容”。
- `CORE.html` §4.23：补单列 grid、固定抽屉、revealer 与覆盖式布局的关系。
- `USER.html` §5.2.1：按原表“不动”未处理。

验证：

- `grep -n "64px\|56px" src/renderer/styles/main.css` 只剩非侧栏用途（如时长列宽、品牌尺寸等），不再有 `--sidebar-width: 64px/56px` 或 64/56 常驻栏 grid。
- 末尾 `@media (max-width: 900px)` 设置 `--sidebar-width: 0`、单列 grid、`position: fixed` 抽屉；560px 只设置抽屉宽度与页面间距。
- `npm run build` 通过。

状态：已解决。

### 3.7 歌曲表内的链接 / 按钮会触发行双击播放 [已解决]

问题描述：`SongTable` 的整行绑定了 `dblclick` 播放，操作列又有收藏、下载、下一首、添加歌单、删除等按钮，歌名 / 歌手 / 专辑还改成了 `RouterLink`。如果不在这些子元素上阻止冒泡，双击链接或连续点击按钮会同时触发行播放；窄屏“...”菜单还会被 document 的全局点击监听立刻关掉。


解决方法：
- 所有操作按钮与 `RouterLink` 加 `@click.stop`；
- 窄屏菜单外层容器加 `@click.stop`，document 监听只负责点击外部关闭；
- 用 `matchMedia('(max-width: 900px)')` 同步 CSS 断点，断点切换时关闭已打开菜单；
- 操作列宽屏 160px、窄屏 40px，避免五个图标挤压表格。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.39 `SongTable.vue` | 改 | 补链接 / 按钮事件边界、菜单外部关闭、matchMedia 同步与列宽。 |
| `CORE.html` | §4.40 `PlayerBar.vue` | 不动 | 播放条事件不在本项，见 #9。 |
| `USER.html` | §5.2.4 歌曲列表 | 不动 | 列与操作项由 #4 / #8 / #14 维护。 |

实际操作（2026-11-11，分支 `doc/songtable-event-boundary`）：

- `CORE.html` §4.39 `SongTable.vue`：
  - 补充事件边界：行 `dblclick` 只绑定在 `tr` 上，歌手 / 专辑链接与操作列按钮统一使用 `@click.stop`，点击不触发行播放；
  - 补充窄屏菜单：`.song-more-wrap` 使用 `@click.stop` 隔断行事件，document 的 click 只负责点击外部关闭，Esc 同样关闭，选择菜单项时先关闭菜单再发出 emit；
  - 补充 `matchMedia('(max-width: 900px)')` 与样式断点同步，断点变化时更新 `compact` 并关闭已打开菜单；click / keydown 与 media query 监听在卸载时清理；
  - 补充操作列列宽：宽屏 160px，≤900px 为 40px。
- `CORE.html` §4.40 `PlayerBar.vue`：按原表“不动”未处理。
- `USER.html` §5.2.4 歌曲列表：按原表“不动”未处理。

验证：

- 对照 `src/renderer/components/SongTable.vue`：行只在 `tr` 上绑定 `@dblclick`；操作按钮与歌手 / 专辑 `RouterLink` 均为 `@click.stop`；`.song-more-wrap` 为 `@click.stop`；`onDocumentClick`、`onKeydown` 与 `matchMedia` 的 `change` 监听均在 `onBeforeUnmount` 移除。
- 对照 `src/renderer/styles/main.css`：`.song-action` 末尾覆盖为 160px，`@media (max-width: 900px)` 收窄为 40px。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 3.8 筛选后的索引映射容易误删 / 误播 [已解决]

问题描述：歌单筛选和队列筛选都会改变展示数组的下标。`SongTable` 的 emit 使用的是筛选后下标；如果把该下标直接传给播放队列或 `removeFromQueue`，会操作到真实队列里的另一首歌。队列筛选还要求“保留原始序号”，否则用户看到的序号会跳变。


解决方法：
- 歌单页用 `filteredSongs[index]` 解析歌曲对象，播放与下载都基于歌曲对象而不是全量数组下标；
- 队列筛选生成 `{ song, index }` 列表，`index` 始终是真实 `playOrder` 下标，移除时传原始下标；
- 筛选只影响展示，不重建播放队列、不改变随机顺序或队列快照。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.46 `PlaylistView.vue` | 改 | 补筛选下标到歌曲对象 / 队列构建的映射规则。 |
| `CORE.html` | §4.23 `App.vue` | 改 | 明确队列筛选保留原始 index 与移除语义。 |
| `USER.html` | §5.2.9 播放队列 | 不动 | 移除行为由 #6 维护，见该节。 |

实际操作（2026-11-11，分支 `doc/filtered-index-mapping`）：

- `CORE.html` §4.46 `PlaylistView.vue`：
  - 补充筛选下标映射规则：播放、下一首、收藏、下载、删除与加入歌单都先用 `filteredSongs[index]` 解析歌曲对象，再调用对应 API；
  - 补充删除路径：按解析出的 `songMid` 调用 `removeSongs`，乐观移除与失败恢复基于歌曲对象，不使用筛选下标操作全量数组；
  - 补充播放路径：“播放全部”与单曲播放在筛选结果中定位起始曲，队列仍由 playlist store 用完整 `songs` 快照构建，筛选不重建队列。
- `CORE.html` §4.23 `App.vue`：按实现明确队列筛选行为——`filteredQueue` 由 `player.queue.map((song, index) => ({ song, index }))` 生成，`index` 是当前曲之后的队列下标，序号显示 `index + 1` 且筛选后不重排；移除时把该下标交给 `removeFromQueue`，由 store 加上当前曲在 `playOrder` 中的位置后删除。原“index 始终是真实 playOrder 下标”的表述按代码修正为“队列下标 + store 映射”。
- `USER.html` §5.2.9 播放队列：按原表“不动”未处理。

验证：

- 对照 `src/renderer/views/PlaylistView.vue`：`startAt` / `addNextAt` / `toggleFavorite` / `downloadAt` / `removeAt` / `openPicker` 均先取 `filteredSongs.value[index]`；删除只把解析出的 `songMid` 传给 `playlistEdit.removeSongs`。
- 对照 `src/renderer/App.vue`：`filteredQueue` 保留 `player.queue` 的原始下标，模板把 `queueIndex` 传给 `player.removeFromQueue`；`src/renderer/stores/player.ts` 的 `removeFromQueue` 用 `index.value + 1 + queueIndex` 映射到 `playOrder`。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 3.9 评论“最旧”排序分页追加后会失去全局顺序（该排序后由 §4.41 取消） [已解决]

> 后续修正：§4.41 已完全取消“最旧”排序与 `CommentSort`，评论只保留最新评论的 `LastCommentSeqNo` 游标分页；本节关于最旧排序跨页重排的规则不再适用，追加时按 `id` 去重仍然有效。

问题描述：最旧排序允许在已加载评论上本地重排。如果只在请求单页后排序，再把下一页直接 append，第二页的评论会整体排在第一页后面，跨页顺序并不正确；评论还可能因为刷新与翻页重叠而重复。


解决方法：
- 每次追加新一页后，对合并结果按 `createdAtMs` 重新升序排序（该重排已由 §4.41 随最旧排序一并删除）；
- 追加前按评论 `id` 去重；
- “最新”依赖上游顺序，不做本地重排；最旧排序及其重排已由 §4.41 删除。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.42 `CommentsPanel.vue` | 改 | 已由 §4.41 删除最旧排序；追加时按 `id` 去重仍有效。 |
| `CORE.html` | §4.15 `api/comment.ts` | 不动 | 上游透传与本地排序分工由 #5 维护。 |
| `PROVIDER.html` | §4.1 歌曲评论行 | 不动 | 上游排序方法不变，见 #5。 |

实际操作（2026-11-11，分支 `doc/comment-append-dedupe`）：

- `CORE.html` §4.42 `CommentsPanel.vue`：保留“只提供最新评论、已删除最旧排序”的说明，并新增追加规则——下一页按现有评论的 `id` 集合去重，只插入未出现过的评论；顺序完全沿用上游“最新”顺序，不按 `createdAtMs` 本地重排。
- `CORE.html` §4.15 `api/comment.ts`：按原表“不动”未处理。
- `PROVIDER.html` §4.1 歌曲评论行：按原表“不动”未处理。

验证：

- 对照 `src/renderer/components/CommentsPanel.vue` 的 `loadMore()`：用 `new Set(comments.value.map((comment) => comment.id))` 记录已有 id，只追加 `page.comments.filter((comment) => !known.has(comment.id))`；组件内没有按 `createdAtMs` 重排的逻辑，也没有“最旧”分支。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 3.10 播放模式悬停菜单的定时器与外部监听泄漏 [已解决]

问题描述：播放模式菜单用 120ms 延迟打开、200ms 延迟关闭，还挂了 document 的点击 / 键盘监听。如果组件卸载或路由切换时只清菜单状态、不清定时器，延迟回调仍会操作已卸载组件的 ref；document 监听也会在多次挂载后重复注册。


解决方法：
- `onBeforeUnmount` 清理打开 / 关闭两个定时器；
- 同一个生命周期里移除 document 的 `click`（捕获阶段）与 `keydown`；
- 点击外部、Esc、选择模式后都立即关闭菜单并清掉待执行关闭定时器；
- 菜单包裹层负责 mouseenter / mouseleave，避免移入菜单本身触发关闭。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.40 `PlayerBar.vue` | 改 | 补 120/200ms 定时器与 document 监听的卸载清理。 |
| `CORE.html` | §4.49 `styles/main.css` | 不动 | 菜单定位与高亮样式由 #9 维护。 |
| `USER.html` | §5.2.3 播放模式 | 不动 | 交互契约由 #9 维护，见该节。 |

实际操作（2026-11-11，分支 `doc/playerbar-mode-timer-cleanup`）：

- `CORE.html` §4.40 `PlayerBar.vue`：补充播放模式菜单的定时器与监听生命周期——`modeOpenTimer` / `modeCloseTimer` 管理 120ms 打开与 200ms 关闭；Esc 走 `closeMenus()` 清除模式、音质与音量的待执行定时器；挂载时注册 document `click`（捕获阶段）与 `keydown`，`onBeforeUnmount` 清除模式定时器并移除这两个监听。
- `CORE.html` §4.49 `styles/main.css`：按原表“不动”未处理。
- `USER.html` §5.2.3 播放模式：按原表“不动”未处理。

验证：

- 对照 `src/renderer/components/PlayerBar.vue`：`openModeMenu()` / `scheduleCloseModeMenu()` 分别使用 120ms / 200ms 定时器；`onMounted` 以捕获阶段注册 `document.addEventListener('click', ..., true)` 并注册 `keydown`；`onBeforeUnmount` 清理 `modeOpenTimer` / `modeCloseTimer` 并移除两个监听。
- 点击外部只关闭已打开的菜单；Esc 调用 `closeMenus()`，会同时清空模式、音质与音量的待执行定时器。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 3.11 音频代理取消时 `reader.cancel` 拒绝产生未处理 Promise [已解决]

问题描述：运行中偶发出现 `UnhandledPromiseRejectionWarning: Error: net::ERR_CONNECTION_CLOSED`，堆栈位于 Electron 的 `SimpleURLLoaderWrapper` / `IncomingMessage`。触发条件不稳定，常见于切歌、seek、关闭音频流或上游提前断开连接之后。

原因：`audio-protocol.ts` 的响应流 `cancel(reason)` 先 `abortUpstream()` 中止上游 `net.fetch`，随后用 `void reader.cancel(reason)` 丢弃取消 Promise。上游连接已经因 abort 或对端关闭而断开时，`reader.cancel()` 会以 `net::ERR_CONNECTION_CLOSED` / `ERR_CONTENT_LENGTH_MISMATCH` 拒绝；`void` 既不等待也不捕获，于是变成进程级未处理拒绝。用 Electron `net.fetch` + 中途断开的本机 HTTP 服务可稳定复现同一堆栈：连接关闭后调用未捕获的 `reader.cancel()` 即触发 `UnhandledPromiseRejectionWarning`。

解决方法：

- `cancel(reason)` 改为 `reader.cancel(reason).catch(() => undefined)`；取消路径上的连接关闭属于预期结果，只吞掉该拒绝，不影响正常读取错误；
- 新增 `test/audio-protocol.test.ts`：mock `net.fetch` 返回一个 `cancel()` 会拒绝的流，调用协议响应体的 `cancel()`，断言不会产生 `unhandledRejection`；
- 保留 `abortUpstream()`，继续确保取消时释放上游连接，避免半读连接留在 socket 池。

验证：

- 修复前测试稳定收到 `unhandledRejection: net::ERR_CONNECTION_CLOSED`，修复后通过；
- `npm run typecheck` 通过；
- `npx vitest run` 18 个测试文件 / 67 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.59 `media/audio-protocol.ts` | 改 | 补取消路径约束：`abortUpstream` 后 `reader.cancel()` 必须以 catch 吞掉连接关闭类拒绝，不能留下未处理 Promise。 |
| `USER.html` | — | 不动 | 未处理拒绝只产生控制台警告，不改变用户可见的播放 / 切歌行为。 |
| `EVOLVE.md` | — | 不动 | 现有“切歌中止上游流”要求不变，仅补齐取消异常处理。 |

实际操作（2026-11-11，分支 `doc/audio-protocol-cancel-catch`）：

- `CORE.html` §4.59 `media/audio-protocol.ts`：补充取消路径约束——先 `abortUpstream()`，再用 `reader.cancel(reason).catch(() => undefined)` 等待并吞掉取消 Promise；说明 abort / 对端关闭会触发 `net::ERR_CONNECTION_CLOSED` / `ERR_CONTENT_LENGTH_MISMATCH`，不能用 `void` 丢弃，且只吞取消路径的关闭类拒绝。
- `USER.html`：按原表“不动”未处理。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“不动”未处理。

验证：

- 对照 `src/main/media/audio-protocol.ts`：响应体的 `cancel(reason)` 先调用 `abortUpstream()`，随后执行 `reader.cancel(reason).catch(() => undefined)`。
- `test/audio-protocol.test.ts` 覆盖 `cancel()` 拒绝 `net::ERR_CONNECTION_CLOSED` 的场景，断言不会产生 `unhandledRejection`。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

## 4. ISSUES 未决项修复记录

### 4.1 播放条合并为单轨进度条并补齐缓冲进度 [已解决]

问题描述：ISSUES 第一项指出播放条实际渲染成两条：播放进度用 `<input class="range">` 的渐变背景表示，缓存进度又在其下单独渲染一条 2px 细线，视觉上分成两行。同时该细线只消费主进程 `audioCache:progress` 的完整响应进度；一旦上游对 `Range` 请求返回局部 206，协议层不会上报进度，界面就长期没有缓冲呈现。ISSUES 要求改成同一条进度条：1 个背景 + 2 个 overlay，分别是缓冲进度与播放进度。

解决方法：
- 播放条改为单条 `.progress-track`：`progress-buffer` 位于底层、`progress-played` 位于上层，范围输入框透明覆盖在轨道上，只负责拖动与点击定位；
- 缓冲 overlay 的宽度取 `max(音频缓存进度, HTML5 Audio buffered 进度)`：缓存完整时仍显示 100%，局部 Range 或缓存关闭时则由 `audio.buffered` 保证有可视缓冲；
- `AudioEngineHandlers` 新增可选 `onBufferChange`，`engine.ts` 在 `progress` / `loadedmetadata` / `canplay` / `seeked` / `emptied` 时读取 `audio.buffered` 的最大 end；播放器 store 新增 `bufferedMs` 并在切歌时清零，供 `PlayerBar` 计算百分比；
- 缓存事件的匹配条件从只看 `songMid` 收紧为 `songMid + quality`，避免切歌或降档后旧事件画到新进度条上；
- 进度条 tooltip 在缓存完整时显示“缓存完成”，否则显示“缓冲 N%”；空状态仍保留 0 进度灰轨，不渲染 overlay。

验证：
- `npm run typecheck` 通过；
- `npx vitest run` 11 个测试文件 / 39 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.40 `PlayerBar.vue` | 改 | 播放条改为单轨背景 + 缓冲 / 播放两个 overlay；缓冲取 `max(缓存进度, audio.buffered)`，范围输入框透明覆盖。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | 删除 `.cache-progress` 细线，改为 `.progress-track` / `.progress-buffer` / `.progress-played` / `.progress-range` 单轨样式。 |
| `CORE.html` | §4.27 `src/renderer/audio/engine.ts` | 改 | 补 `onBufferChange` 与 `audio.buffered` 监听事件列表。 |
| `CORE.html` | §4.29 `src/renderer/stores/player.ts` | 改 | 补 `bufferedMs` 状态、切歌清零与暴露给播放条。 |
| `USER.html` | §5.2.3 播放条 · 进度条 | 改 | 描述单条进度条的背景 / 缓冲 / 播放三层结构；tooltip 改为“缓冲 N% / 缓存完成”。 |
| `EVOLVE.md` | #3 播放条可视化缓存进度 | 改 | 把“进度条下方增加细缓存进度线”改为“在单条进度条内叠加缓冲 overlay”。 |

实际操作（2026-11-11，分支 `doc/playerbar-buffer-overlay`）：

- `CORE.html` §4.40 `PlayerBar.vue`：删除“下方细缓存进度线”描述，改为单轨 `.progress-track` + `.progress-buffer` / `.progress-played` 两个 overlay + 透明 `.progress-range`；缓冲宽度取 `max(cachePercent, bufferedPercent)`，tooltip 按已下载 / 缓存完成 / 缓冲百分比显示；空状态改为“进度与缓冲 overlay 为 0 并隐藏”。
- `CORE.html` §4.49 `styles/main.css`：把缓存进度细线说明改为 `.progress-track` / `.progress-buffer` / `.progress-played` / `.progress-range` 单轨样式，缓冲使用 `--buffer`，播放使用 `--accent`。
- `CORE.html` §4.27 `audio/engine.ts`：签名补 `onBufferChange?(bufferedMs)`，并补 `progress` / `loadedmetadata` / `canplay` / `seeked` 读取 `audio.buffered`、`emptied` 归零的事件约定。
- `CORE.html` §4.29 `stores/player.ts`：签名补 `readonly bufferedMs`，并说明切歌前清零、播放条用它计算缓冲 overlay。
- `CORE.html` §5.18 音频缓存进度：同步流程图，把“更新缓存进度线”改为“更新缓冲 overlay（与 `audio.buffered` 取较大值）”。
- `USER.html` §5.2.3 播放条：补充单条进度条的背景 / 缓冲 / 播放三层结构、范围输入覆盖定位、两侧时间与 tooltip；空状态同步改为缓冲 overlay。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“改动”无法执行；对应约束已落到 CORE / USER。

验证：

- 对照 `src/renderer/components/PlayerBar.vue`：`bufferPercent = Math.max(cachePercent, bufferedPercent)`，模板渲染 `.progress-buffer` 与 `.progress-played`，`.progress-range` 只负责 seek；`bufferLabel` 在已下载 / 缓存完成 / 其他情况下分别输出对应文案。
- 对照 `src/renderer/audio/engine.ts`：`onBufferChange` 为可选回调，`progress` / `loadedmetadata` / `canplay` / `seeked` 调用 `reportBuffered()`，`emptied` 上报 0。
- 对照 `src/renderer/stores/player.ts`：暴露 `bufferedMs`，`onBufferChange` 写入，切歌加载前清零。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.2 播放模式改为“按钮即当前项”的 revealer [已解决]

> 后续修正：§4.20 / §4.33 已把播放模式按钮点击从“开合菜单”改为按固定顺序 `sequence → repeat-all → repeat-one → shuffle` 循环；悬停仍打开其余模式菜单，按钮仍表示当前模式。本节其余样式与菜单结构结论有效。

问题描述：ISSUES 要求播放模式切换改成 revealer 式，按钮与弹出一体化，按钮本身表示当前选中项，弹出层只展示其它选项。原实现把当前模式同时渲染在按钮图标和弹出菜单最后一项里，按钮只有非顺序模式才高亮，菜单与按钮之间还有 8px 间距，视觉上是两个独立控件，当前项重复出现。

解决方法：
- 抽出 `MODE_ICON` 映射，触发按钮改用 `.mode-button`，常驻 `accent-soft` 背景 + `accent-strong` 图标，直接表示当前模式，不再依赖 `active` 条件；
- 弹出层改为 `otherModes = 固定顺序.filter(mode !== 当前)`，只渲染其它三种模式，去掉重复的当前项；
- 菜单改为 `bottom: 0` 包住按钮：`width: 100%` 与按钮同宽、底部预留按钮高度、背景使用 surface 且无边框；按钮浮在弹层底部并始终保留全部 9px 圆角，形成包含式 revealer，并加 `scaleY` 向上展开动画；
- 当时 `toggleModeMenu()` 在切换前清理打开 / 关闭定时器，避免悬停定时器在点击关闭后又把菜单重新打开；该函数后由 §4.20 的 `cycleMode()` 取代，悬停、外部点击、Esc 与选择后关闭的行为保持不变。

验证：
- `npm run typecheck` 通过；
- `npx vitest run` 11 个测试文件 / 39 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.40 `PlayerBar.vue` | 改 | 当前模式由常驻按钮表示，菜单只列其它模式；弹层包住按钮并保留悬停 / 点击 / Esc 逻辑。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | 增加 `.mode-button`、`.mode-wrap.open`、`.mode-menu` 的包含式 reveal 样式；删除 `.mode-option.current`。 |
| `USER.html` | §5.2.3 播放条 · 播放模式 | 改 | 改为“按钮本身即当前模式高亮，展开后只显示其余模式”。 |
| `EVOLVE.md` | #9 播放模式 | 改 | 把“当前模式固定在菜单底部”改为“当前模式固定在触发按钮上”。 |

实际操作（2026-11-11，分支 `doc/mode-revealer-button`）：

- `CORE.html` §4.40 `PlayerBar.vue`：把播放模式说明改为“按钮本身即当前模式”——`.mode-button` 常驻 accent 背景与当前模式图标，点击循环切换；悬停 / 聚焦菜单只渲染 `otherModes`（当前模式之外的其余三项），不重复显示当前项。
- `CORE.html` §4.49 `styles/main.css`：改为包含式 revealer 样式——`.mode-button` 为 32px / 9px 圆角，`.mode-wrap.open` 提升按钮层级，`.mode-menu` 使用 `bottom: 0`、`width: 100%`、`padding-bottom: 32px`、panel 背景与向上阴影，`mode-reveal` 使用 `scaleY` 展开；明确不再有 `.mode-option.current`。
- `USER.html` §5.2.3 播放条：改为按钮本身高亮当前模式，菜单只展示其余三种；保留点击循环、悬停 / Esc / 外部关闭与触屏手势。
- `USER.html` §2 术语表“播放模式”：同步为“按钮显示当前模式，菜单只列其余三种”。
- `CORE.html` §4.36 `AppIcon.vue`：删除“当前模式另叠加对勾标记”的过时描述，改为当前模式由按钮本身表示。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“改动”无法执行；对应约束已落到 CORE / USER。

验证：

- 对照 `src/renderer/components/PlayerBar.vue`：`MODE_ICON` 提供四种模式图标；`otherModes` 为固定顺序过滤掉当前模式；模板按钮调用 `cyclePlayMode()`，菜单 `v-for="otherModes"`。
- 对照 `src/renderer/styles/main.css`：`.mode-button` 为 32×32、9px 圆角、`var(--accent-soft)` 背景；`.mode-menu` 为 `bottom: 0` / `width: 100%` / `padding: 0 0 32px`；`@keyframes mode-reveal` 使用 `scaleY(0.72) → 1`。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.3 音量改为响应式：宽屏常驻滑块，窄屏悬停 revealer [已解决]

问题描述：ISSUES 要求音量复用播放模式 revealer：按钮即静音键，鼠标悬停弹出音量条并与按钮合为一体；弹层用 surface 背景、按钮保留四角圆角、底部向下延伸包住按钮、内部无 padding / margin。同时宽屏与窄屏需要保留响应式区分：宽屏继续使用常驻横向滑块，窄屏才使用弹出式竖直滑块。原实现的窄屏 popover 带 padding、边框和更宽尺寸，按钮点击只负责开合弹层，无法与按钮形成包含关系；而把宽屏也统一成弹层则破坏了宽屏的常驻音量条。

解决方法：
- 保留 `compact`（`max-width: 900px`）响应式分支：宽屏渲染常驻横向滑块 `v-if="!compact"`，窄屏隐藏该滑块并仅在 `compact && volumeOpen` 时渲染弹层；
- 音量按钮在宽窄屏都只负责静音 / 恢复；仅窄屏允许悬停 120ms 打开、离开 200ms 关闭 popup，Esc 与外部点击关闭；宽屏悬停不打开 popup；
- 窄屏弹层复用模式 revealer 的结构：`bottom: 0`、`width: 100%`、`padding-bottom: 34px` 预留按钮高度、`border-radius: 9px`、`background: var(--panel)`、无边框；按钮通过 `z-index` 浮在弹层底部，并始终保留四角圆角；
- 竖直滑块使用 96px 容器，视觉轨道上下各留 10px margin；输入元素扩成 34px 宽作为点击热区，视觉轨道改用独立的 `.volume-track` / `.volume-fill` 绘制成 4px 圆角条，避免背景图条带出现直角；
- 旋转定位用负 margin 归中，避免 `translate(-50%, -50%)` 在旋转后产生 2px 偏移；
- 重新监听 `matchMedia('(max-width: 900px)')`：窗口变宽时关闭 popup 并清理音量定时器；`closeMenus` 统一清理模式 / 音量四个定时器，并在打开模式或音质菜单时关闭音量弹层。

验证：
- `npm run typecheck` 通过；
- `npx vitest run` 11 个测试文件 / 39 个用例通过；
- `npm run build` 通过；
- 用静态页面实测窄屏弹层与按钮同宽、底边对齐，滑块热区 34×76px，视觉轨道居中 4px 且上下各留 10px；宽屏分支保留 `v-if="!compact"` 的常驻横向滑块。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.40 `PlayerBar.vue` | 改 | 音量保留宽 / 窄屏分支：宽屏常驻横向滑块，窄屏悬停 revealer；按钮统一为静音键，补齐 120 / 200ms 定时器与媒体查询清理。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | 删除旧 `.volume-popover` / `.vertical-range` 的 padding、边框与百分比文案，新增 `.volume-menu` / `.volume-slider` 的包含式 revealer、4px 圆角轨道与上下 10px margin；宽屏滑块使用 `.volume-range-inline`。 |
| `USER.html` | §5.2.3 播放条 · 右区音量 | 改 | 宽屏为“静音按钮 + 常驻横向滑块”，窄屏为“静音按钮 + 悬停竖直音量条”；窄屏弹层用 surface 背景并包住按钮。 |
| `USER.html` | §5.2.1 响应式断点 | 改 | 把“≤900px 音量改为点击弹出竖直滑块”改为“≤900px 改为悬停触发的竖直 revealer”，宽屏仍保留常驻横向滑块。 |
| `EVOLVE.md` | — | 增 | 蓝图缺少独立音量条目，建议新增“音量 revealer”项，或在相近条目中补充同类交互约定。 |

实际操作（2026-11-11，分支 `doc/volume-responsive-revealer`）：

- `CORE.html` §4.40 `PlayerBar.vue`：补充音量宽 / 窄屏分支——宽屏 `v-if="!compact"` 常驻横向滑块，窄屏仅在 `compact && volumeOpen` 时渲染竖直弹层；按钮统一为静音 / 恢复，窄屏悬停 120ms / 离开 200ms，Esc 与外部点击关闭，跨过 900px 变宽时关闭弹层并清理定时器。
- `CORE.html` §4.49 `styles/main.css`：新增窄屏音量包含式 revealer 样式——`.volume-menu`、`.volume-slider`、`.volume-track`、`.volume-fill`、旋转输入热区与 `.volume-range-inline`，并说明删除旧 `.volume-popover` / `.vertical-range` 的 padding、边框与百分比文案。
- `USER.html` §5.2.3 播放条 · 右区音量：改为“宽屏静音按钮 + 常驻横向滑块；窄屏静音按钮 + 悬停 120 / 200ms 触发的竖直 revealer”，补充 surface 背景、包住按钮与无 padding / 边框。
- `USER.html` §5.2.1 响应式断点：把“音量改为弹出式”改为“悬停触发的竖直 revealer，宽屏保留常驻横向滑块”。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“新增”无法执行；对应交互约定已落到 CORE / USER。

验证：

- 对照 `src/renderer/components/PlayerBar.vue`：`openVolumeMenu()` 在 `!compact` 时直接返回；弹层为 `v-if="compact && volumeOpen"`，横向滑块为 `v-if="!compact"`；媒体查询变化到宽屏时清除 `volumeOpenTimer` / `volumeCloseTimer` 并关闭弹层。
- 对照 `src/renderer/styles/main.css`：`.volume-menu` 为 `bottom: 0` / `width: 100%` / `padding: 0 0 34px` / 9px 圆角 / `var(--panel)`；`.volume-slider` 高 96px；`.volume-track` 为 4px 宽、上下各 10px；`.volume-slider .volume-range` 为 76×34px、`rotate(-90deg)` 并用负 margin 归中；`.volume-range-inline` 宽度 `clamp(56px, 6vw, 84px)`。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.4 按钮文字不再自动换行 [已解决]

问题描述：ISSUES 指出按钮没有固定宽度，歌单界面的“播放全部 / 下载全部”会出现文字换行。`.btn` 虽然是 `inline-flex`，但没有 `white-space: nowrap`；`.playlist-actions` 只在 ≤900px 时才 `flex-wrap`，宽屏下按钮作为 flex 子项默认 `flex-shrink: 1`，空间不足时被压缩，中文标题就会在按钮内部折行。仅写死宽度并不能解决问题：宽度不足时文字仍会换行，正确做法是禁止文字折行并让整组按钮换行。

解决方法：
- `.btn` 增加 `white-space: nowrap`，图标与文字始终保持单行；
- `.playlist-actions` 始终 `flex-wrap: wrap`，一排放不下时整组按钮换到下一行，而不是压缩单个按钮；
- `.playlist-actions .btn` 设为 `flex: 0 0 auto`，按钮保持内容决定的稳定宽度（实测“播放全部 / 下载全部”各 109px，“返回我的歌单”112px）；
- 删除 ≤900px 媒体查询里重复的 `.playlist-actions { flex-wrap: wrap }`。

验证：
- `npm run typecheck` 通过；
- `npx vitest run` 11 个测试文件 / 39 个用例通过；
- `npm run build` 通过；
- 静态页面实测：210px 容器下三个按钮仍各占一行、文字均单行，操作区整体换行；520px 容器下保持单行。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.49 `styles/main.css` | 改 | 补 `.btn { white-space: nowrap }`、`.playlist-actions { flex-wrap: wrap }` 与 `.playlist-actions .btn { flex: 0 0 auto }`。 |
| `CORE.html` | §4.46 `PlaylistView.vue` | 改 | 说明“播放全部 / 下载全部 / 返回”按钮文字单行，窄容器时整组换行而不是按钮内折行。 |
| `USER.html` | §5.2.8 歌单详情 | 改 | 补一句：歌单头操作按钮保持文字单行，空间不足时按钮组整体换行。 |
| `EVOLVE.md` | — | 不动 | 按钮排版属于样式实现细节，由 CORE / USER 主责。 |

实际操作（2026-11-11，分支 `doc/button-nowrap-wrap`）：

- `CORE.html` §4.49 `styles/main.css`：补充 `.btn { white-space: nowrap }`、`.playlist-actions { flex-wrap: wrap }`、`.playlist-actions .btn { flex: 0 0 auto }`，并说明 ≤900px 媒体查询不再重复声明 `flex-wrap`。
- `CORE.html` §4.46 `PlaylistView.vue`：补充歌单头操作按钮文字单行、空间不足时整组换行的布局规则。
- `USER.html` §5.2.8 歌单详情：补充“操作按钮文字保持单行，空间不足时按钮组整体换行”。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“不动”未处理。

验证：

- 对照 `src/renderer/styles/main.css`：`.btn` 含 `white-space: nowrap`；`.playlist-actions` 声明 `display: flex; flex-wrap: wrap; gap: 10px`；`.playlist-actions .btn` 为 `flex: 0 0 auto`；900px 媒体查询中没有重复的 `.playlist-actions { flex-wrap: wrap }`。
- 对照 `src/renderer/views/PlaylistView.vue`：歌单头操作区使用 `.playlist-actions`，播放全部 / 下载全部 / 返回按钮都复用 `.btn`。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.5 侧栏新增“我喜欢”入口 [已解决]

> 后续修正：§4.19 将侧栏“浏览”组顺序改为“发现 → 搜索 → 我喜欢 → 我的歌单”，并把根路径默认页改为发现页；“我喜欢”入口本身不变。

问题描述：ISSUES 要求在导航栏“我的歌单”上方增加“我喜欢”。此前“我喜欢”只能从“我的歌单”页面的卡片进入，侧栏没有快捷入口；同时渲染层没有引用固定收藏歌单 ID 的常量，若在组件里再写一份 `'liked'` 容易与主进程漂移。

解决方法：
- `src/shared/constants.ts` 新增 `FAVORITES_PLAYLIST_ID = 'liked'`；
- `src/main/api/playlist.ts` 删除本地 `FAVORITES_ID`，改为引用共享常量，固定收藏歌单 ID 只保留一处；
- `App.vue` 在“我的歌单”之前增加 `RouterLink`，登录后显示，图标 `heart`、文案“我喜欢”，指向 `/playlist/${FAVORITES_PLAYLIST_ID}`；
- 复用现有 `PlaylistView` 的 favorites 分支，不新增路由或 IPC；点击后沿用 `onSidebarNavigate()` 关闭窄屏抽屉。

验证：
- `npm run typecheck` 通过；
- `npx vitest run` 11 个测试文件 / 39 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.23 `App.vue` | 改 | 侧栏“浏览”组顺序改为“发现 / 搜索 / 我喜欢 / 我的歌单”；“我喜欢”登录后显示并指向固定收藏歌单。 |
| `CORE.html` | §4.50 `shared/constants.ts` | 改 | 增 `FAVORITES_PLAYLIST_ID = 'liked'`。 |
| `CORE.html` | §4.12 `main/api/playlist.ts` | 改 | 固定收藏歌单 ID 改为引用共享常量，删除模块内重复字面量。 |
| `USER.html` | §5.2.2 侧栏与导航 | 改 | 浏览组顺序补“我喜欢”；说明登录后显示、与“我的歌单”同级。 |
| `EVOLVE.md` | #11 优化左侧导航 | 改 | 侧栏内容补“我喜欢”快捷入口。 |

实际操作（2026-11-11，分支 `doc/sidebar-favorites-entry`）：

- `CORE.html` §4.23 `App.vue`：新增“浏览”组顺序“发现 / 搜索 / 我喜欢 / 我的歌单”，说明“我喜欢”仅登录后显示、与“我的歌单”同级、链接到 `/playlist/${FAVORITES_PLAYLIST_ID}`，点击走 `onSidebarNavigate()` 关闭窄屏抽屉，并复用 PlaylistView 的 favorites 分支。
- `CORE.html` §4.50 `shared/constants.ts`：签名补 `FAVORITES_PLAYLIST_ID: string // 'liked'`。
- `CORE.html` §4.12 `main/api/playlist.ts`：说明固定收藏歌单 ID 引用共享常量，模块内不再保留本地 `FAVORITES_ID` 字面量。
- `USER.html` §5.2.2 侧栏与导航：两处侧栏原型和文字说明同步为“发现 / 搜索 / 我喜欢 / 我的歌单”，补充“我喜欢”仅登录后显示并与“我的歌单”同级。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“改动”无法执行；对应约束已落到 CORE / USER。

验证：

- 对照 `src/shared/constants.ts`：存在 `FAVORITES_PLAYLIST_ID = 'liked'`。
- 对照 `src/main/api/playlist.ts`：导入 `FAVORITES_PLAYLIST_ID`，收藏分支与收藏歌单元数据均使用该常量，模块内没有本地 `FAVORITES_ID`。
- 对照 `src/renderer/App.vue`：导入共享常量，`favoritesPath = /playlist/${FAVORITES_PLAYLIST_ID}`；“我喜欢”链接 `v-if="auth.loggedIn"`，位于“我的歌单”之前，点击调用 `onSidebarNavigate()`。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.6 最近歌单子条目按当前路由高亮 [已解决]

问题描述：ISSUES 指出侧栏“我的歌单”下的最近歌单子条目，在打开对应歌单时不会高亮。原实现只把 `item.id` 与 `currentPlaylistId` 比较，而 `currentPlaylistId` 来自 `player.queueSource`（正在播放的歌单），与当前浏览路由无关；因此打开一个未在播放的歌单时，子条目没有高亮。

解决方法：
- `App.vue` 引入 `useRoute()`，新增 `viewedPlaylistId`：仅当 `route.name === 'playlist'` 时读取 `route.params.id`，避免 `/mv/:id` 等同样使用 `id` 参数的路由误命中；
- 最近子条目的 `active` 改为 `item.id === viewedPlaylistId || item.id === currentPlaylistId`：刚打开的歌单立即高亮，正在播放的歌单仍保留原有高亮与“正在播放”图标；
- 不修改 `playlistStore.recent` 的排序、校验与 `visit` 逻辑，路由切换只影响展示态。

验证：
- `npm run typecheck` 通过；
- `npx vitest run` 11 个测试文件 / 39 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.23 `App.vue` | 改 | 最近歌单子条目高亮同时读取当前 `playlist` 路由与 `player.queueSource`；说明 `/mv/:id` 不得误命中。 |
| `CORE.html` | §4.61 `stores/playlist.ts` | 改 | 把“当前播放歌单高亮读取 `queueSource`”改为“高亮读取路由 + `queueSource`；播放图标仍只由 `queueSource` 决定”。 |
| `USER.html` | §5.2.2 侧栏与导航 | 改 | 高亮规则改为：当前打开的最近歌单与正在播放的歌单都高亮，播放状态由音量图标单独表示。 |
| `EVOLVE.md` | #11 优化左侧导航 | 改 | 把“当前正在播放的歌单在最近列表中高亮，与当前路由无关”改为同时考虑当前路由。 |

实际操作（2026-11-11，分支 `doc/recent-playlist-route-highlight`）：

- `CORE.html` §4.23 `App.vue`：最近歌单子条目高亮改为 `item.id === viewedPlaylistId || item.id === currentPlaylistId`；说明 `viewedPlaylistId` 只在 `route.name === 'playlist'` 时读取路由参数，避免 `/mv/:id` 等误命中；“正在播放”图标仍只由 `queueSource` 决定。
- `CORE.html` §4.61 `stores/playlist.ts`：把“当前播放歌单高亮读取 `queueSource`”改为“当前 `playlist` 路由与 `queueSource` 都参与高亮；播放图标只由 `queueSource` 决定”，并说明 store 不读取路由、不改变 recent 排序 / 校验 / `visit`。
- `USER.html` §5.2.2 侧栏与导航：高亮规则改为“当前打开与正在播放的歌单都高亮，播放状态由音量图标单独表示”。
- `USER.html` §2 术语表“最近歌单”相关三处：同步为“当前打开或正在播放的歌单高亮”，并删除“与当前路由无关”。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“改动”无法执行；对应约束已落到 CORE / USER。

验证：

- 对照 `src/renderer/App.vue`：`viewedPlaylistId` 仅在 `route.name === 'playlist'` 时读取 `route.params.id`；最近条目 class 使用 `item.id === viewedPlaylistId || item.id === currentPlaylistId`，播放图标仅用 `item.id === currentPlaylistId`。
- `playlistStore.recent` 的排序、校验与 `visit` 逻辑未在本次文档中改写，文档仍与 store 实现一致。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.7 评论点赞状态未加载 [已解决]

问题描述：ISSUES 指出评论区刷新后已点赞的评论会回到未点赞状态，但服务端实际仍保留点赞；此时再次点击“点赞”会让 UI 数字继续增加，而服务端不重复计数，随后取消点赞会出现数字 `-2`。原实现同时存在两个问题：

- 评论列表把点赞状态映射自 `IsLiked`，但 fixture 与上游真实响应字段是 `IsPraised`，导致 `liked` 永远为 `false`；
- 评论读取被强制设为匿名（`credential: null`），上游拿不到当前用户，即使字段名正确也不会返回“我是否已点赞”。

解决方法：
- `RawComment` 增加可选 `IsPraised`，`liked` 优先读取 `IsPraised`，并保留 `IsLiked` 作为兼容回退；
- `getComments` 不再强制匿名，改为使用当前登录凭证；未登录时 `musicu` 本身不会注入 Cookie，行为仍等价匿名；
- 点赞 / 取消点赞仍先乐观更新，接口成功后以返回的 `liked` 校正按钮状态；初始状态正确后，数字按一次 +1 / -1 变化，不再出现 `-2`；
- 新增回放测试，覆盖 `IsPraised`、旧字段 `IsLiked`、字段缺失三种映射，以及读取评论时携带登录 `Cookie` 与 `comm.uin`。

验证：
- `npm run typecheck` 通过；
- `npx vitest run` 11 个测试文件 / 40 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.3 `QqComment` | 改 | 点赞状态字段改为 `IsPraised?: number`（可兼容 `IsLiked`），并注明需要登录 Cookie 才会按当前用户返回。 |
| `PROVIDER.html` | §4.1 歌曲评论行 / 验证记录 | 改 | 删除“评论请求固定匿名”的表述，改为“未登录匿名；登录后携带 Cookie 以读取 `IsPraised`”。 |
| `CORE.html` | §4.15 `api/comment.ts` | 改 | 修正 `liked` 来源与凭据策略：`IsPraised → liked`，登录时携带凭证，`IsLiked` 仅作兼容。 |
| `EVOLVE.md` | #5 / #14 | 不动 | 页面与点赞流程不变，仅修正上游字段与鉴权细节。 |

实际操作（2026-11-11，分支 `doc/comment-liked-credential`）：

- `PROVIDER.html` §4.1 请求约定“评论读取”：删除“固定匿名发送，不携带凭证”，改为“未登录匿名；登录后携带 Cookie 以读取 `IsPraised`”，并把应用固定条数改为 25。
- `PROVIDER.html` §4.1 端点表“歌曲评论 `GetNewCommentList`”：特别配置改为“未登录匿名；登录后携带 Cookie 以读取 `IsPraised`”。
- `PROVIDER.html` §4.3 `QqComment`：核对后已包含 `IsPraised?: number` 与兼容字段 `IsLiked?: number`，映射行也已注明“登录后才会按当前用户返回点赞状态”，本次无需再改。
- `CORE.html` §4.15 `api/comment.ts`：在 `liked` 映射说明中明确 `IsLiked` 仅作旧字段兼容，`IsPraised` 优先。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“不动”未处理。

验证：

- 对照 `src/main/api/comment.ts`：`RawComment` 含 `IsPraised?: number` 与 `IsLiked?: number`；`liked: Number(raw.IsPraised ?? raw.IsLiked ?? 0) === 1`；读取评论使用当前凭证，未登录时由 `musicu` 自然匿名。
- 对照 `PROVIDER.html`：评论读取与端点表不再出现“固定匿名 / 不携带 Cookie”；`QqComment` 字段与映射说明保持 `IsPraised` 优先、`IsLiked` 兼容。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.8 点击歌词跳转失效与高亮样式调整 [已解决]

问题描述：ISSUES 指出歌词页点击某一行不再跳转到对应时间。`LyricsPanel.vue` 的 `@click="seekLine(...)"` 仍存在，但拖拽实现从 `pointerdown` 起就对整个列表调用 `setPointerCapture`。指针捕获后，`pointerup` 目标被重定向到列表容器，浏览器派发的 `click` 目标是按下与抬起目标的共同祖先，不再是 `.lyric-line` 按钮，因此按钮的 click 永远不触发。该回归是在加入“拖拽与滚轮滚动歌词”后出现的。

同项还要求调整高亮呈现：歌词水平居中、去掉左侧紫色高亮边、左右不留空白。

解决方法：
- 将“按下”与“拖拽”拆成两个状态：`pointerdown` 只记录起点，不立即捕获；移动距离超过 6px 后才设置 `dragging` 并调用 `setPointerCapture`；
- 未达到阈值时松开鼠标，指针从未被捕获，原生 `click` 正常命中 `.lyric-line`，沿用现有 `seekLine()` 跳转；
- 达到阈值后继续走原有拖拽滚动，`suppressClick` 仍用于兜底阻止拖拽结束后的误点击；`pointercancel` / `pointerleave` 负责清理按下状态；
- `.lyrics-page-list` 水平 padding 改为 `0`；`.lyrics-page-list .lyric-line` 改为 `text-align: center`、左右 padding 为 `0`、移除左侧边框，使高亮背景条铺满整行且不再有紫色竖边。

验证：
- `npm run typecheck` 通过；
- `npx vitest run` 11 个测试文件 / 40 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.41 `LyricsPanel.vue` | 改 | 说明指针捕获必须在超过拖拽阈值后才启用，确保未拖拽时原生 click 可触发歌词跳转。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | 补歌词页 `.lyrics-page-list` 水平 padding 为 0、`.lyric-line` 居中且无左边框，高亮条铺满整行。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 明确歌词文字水平居中、高亮背景无左侧强调边、背景条左右不留空白，并保留点击定位与拖拽滚动。 |
| `EVOLVE.md` | #5 | 不动 | 交互需求未变，仅修正实现回归与视觉细节。 |

实际操作（2026-11-11，分支 `doc/lyrics-click-drag-threshold`）：

- `CORE.html` §4.41 `LyricsPanel.vue`：补充拖拽阈值与指针捕获约束——`pointerdown` 只记录起点，纵向移动超过 6px 才进入拖拽并 `setPointerCapture`；未拖动时保留原生 click，拖拽结束用 `suppressClick` 兜底，`pointercancel` / `pointerleave` 清理按下状态。
- `CORE.html` §4.49 `styles/main.css`：补充歌词页布局——`.lyrics-page-list` 水平 padding 为 0，`.lyric-line` 水平居中、左右 padding 与左边框为 0，高亮背景铺满整行。
- `USER.html` §5.2.5 歌词与评论：明确歌词文字水平居中、高亮背景无左侧强调边且铺满整行；拖拽超过 6px 才进入滚动，未拖动时点击歌词行仍正常跳转。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“不动”未处理。

验证：

- 对照 `src/renderer/components/LyricsPanel.vue`：`DRAG_THRESHOLD = 6`；`onPointerDown` 不调用 `setPointerCapture`，`onPointerMove` 仅在超过阈值后设置 `dragging` 并捕获指针；`seekLine()` 受 `suppressClick` 保护，`pointercancel` / `pointerleave` 清理状态。
- 对照 `src/renderer/styles/main.css`：`.lyrics-page-list` 为 `padding: 38% 0`（水平 0）；`.lyrics-page-list .lyric-line` 为 `padding: 0`、`border-left: 0`、`text-align: center`。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.9 歌手页改为滚动到底自动分页 [已解决]

问题描述：ISSUES 要求歌手页不再通过“加载更多”按钮翻页，而是在滚动到底部时自动加载下一页。原 `ArtistView.vue` 只在 `detail.hasMore` 时渲染一个按钮，用户必须手动点击；而应用的实际滚动容器是 `App.vue` 的 `<main class="main">`，不是 `window`。

解决方法：
- 给歌手页根节点增加 `pageRef`，`onMounted` 时通过 `closest('.main')` 找到外层滚动容器，注册 `passive` 的 `scroll` 监听，`onBeforeUnmount` 时移除；
- 距离底部小于 160px 且 `hasMore=true`、当前既未首屏加载也未追加加载时，自动调用 `load(false)`；
- 移除“加载更多”按钮，底部改为状态提示：追加中显示 spinner 与“正在加载更多”，否则提示“继续向下滚动加载更多”；没有更多歌曲时显示“已经到底了”；
- 保留原有并发保护与失败处理，滚动触发的请求不会覆盖首屏请求，也不会重复追加。

验证：
- `npm run typecheck` 通过；
- `npx vitest run` 11 个测试文件 / 40 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.73 `ArtistView.vue` | 改 | 删除“或点击‘加载更多’”，改为监听 `.main` 滚动容器、距底部 160px 自动追加下一页，并补底部状态提示。 |
| `USER.html` | §5.2.8 页面表 · 歌手页 / 专辑页行 | 改 | 明确歌手页滚动到底自动加载下一页，不提供“加载更多”点击操作。 |
| `EVOLVE.md` | #4 歌手 / 专辑详情 | 改 | 分页交互补“滚动到底自动加载”，不再要求点击按钮。 |

实际操作（2026-11-11，分支 `doc/artist-scroll-pagination`）：

- `CORE.html` §4.73 `ArtistView.vue`：删除“或点击‘加载更多’”，改为 `pageRef.closest('.main')` 获取外层滚动容器、注册 passive `scroll` 监听，距底部小于 160px 且 `hasMore` 时自动追加下一页；补充底部 spinner / “正在加载更多” / “继续向下滚动加载更多” / “已经到底了”状态与卸载移除监听。
- `USER.html` §5.2.8 页面表 · 歌手页 / 专辑页行：明确歌手页滚动到底自动加载下一页，不提供“加载更多”点击操作。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“改动”无法执行；对应约束已落到 CORE / USER。

验证：

- 对照 `src/renderer/views/ArtistView.vue`：`SCROLL_LOAD_THRESHOLD = 160`；`onMounted` 使用 `pageRef.value?.closest('.main')` 获取 `scrollRoot` 并以 `{ passive: true }` 注册 `scroll`，`onBeforeUnmount` 移除；`maybeLoadMore` 在距底部小于阈值且 `hasMore`、非加载中时调用 `load(false)`。
- 模板没有“加载更多”按钮；`feed-footer` 在加载中显示 spinner，否则提示滚动加载，无更多时显示“已经到底了”。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.10 歌手歌曲排序能力验证与“最热 / 最新”切换 [已解决]

问题描述：ISSUES 要求确认歌手页的歌曲接口是否支持不同排序方式。`GetSingerSongList` 一直写死 `order: 1`，文档也未说明其它取值的行为，无法判断能否提供排序选项。

验证方法与结论：以匿名 `comm.uin=0` 直接请求 `musichall.song_list_server / GetSingerSongList`，对周杰伦（`0025NhlN2yWrP4`）、林俊杰（`001BLpXF2DyJe2`）分别取 `order = -1, 0…11, 20` 对比首页与第 50 首起的结果：

- `order=1` 返回最热歌曲（周杰伦为《晴天》《发如雪》《搁浅》…）；
- `order=0` 及其它所有非 1 取值返回完全相同的结果，是最新顺序；`begin` 翻页后两者仍然稳定不同；
- 每种顺序的 `totalNum` 一致，说明排序不改变总数；
- 上游只存在“最热 / 最新”两种有效顺序，没有字母、发行时间倒序等其它模式；未知值不会报错，而是回退到最新。

解决方法：
- `shared/types.ts` 新增 `ArtistSongSort = 'hot' | 'latest'` 与 `ArtistSongPage`；`artist.get` IPC 增加可选 `sort`，默认 `hot`，保持原有歌手页默认顺序；
- 新增 `artist.getSongs(mid, offset?, sort?)`，只请求 `GetSingerSongList`，不重复拉取歌手详情；滚动分页也改走该接口，避免每翻一页都重查歌手信息；
- `api/artist.ts` 按 `sort` 映射上游 `order`：`hot → 1`，`latest → 0`；
- 歌手页歌曲标题右侧增加“最热 / 最新”切换；切换时只重新请求歌曲列表，歌手头部、封面、简介保持不动，列表区显示加载态；分页强制从 `offset=0` 重新开始，不保留已滚动加载的页数，滚动位置回到页面顶部；切换失败时保留旧列表并回退到原排序；
- 首次进入歌手页仍使用 `artist.get` 同时加载详情和首屏歌曲；
- 新增回放测试，断言 `hot` 请求携带 `order=1`、`latest` 携带 `order=0`，并验证 `getArtistSongs` 不会请求歌手详情接口。

验证：
- 匿名实测覆盖 2 位歌手、14 个 `order` 取值与首页 / 第二页；
- `npm run typecheck` 通过；
- `npx vitest run` 11 个测试文件 / 42 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1 歌手歌曲行 / §4.3 `QqArtistSongData` | 改 | 注明 `order=1` 为最热，`order=0` 及其它值等价于最新，仅两种有效顺序，未知值不报错。 |
| `CORE.html` | §4.2 `ipc.ts` | 改 | `artist.get(mid, offset?, sort?)` 增加 `ArtistSongSort`，默认 `hot`；新增 `artist.getSongs(mid, offset?, sort?)` 仅返回歌曲页。 |
| `CORE.html` | §4.73 `ArtistView.vue` | 改 | 增加“最热 / 最新”切换：只重载歌曲列表并重置偏移，不刷新歌手头部；滚动分页走 `artist.getSongs`。 |
| `CORE.html` | §4.75 `api/artist.ts` | 改 | 记录 `hot → order=1`、`latest → order=0` 的映射，并补 `getArtistSongs` 不拉取歌手详情。 |
| `USER.html` | §5.2.8 页面表 · 歌手页 / 专辑页行 | 改 | 歌手页补充歌曲排序控件：最热 / 最新，默认最热。 |
| `EVOLVE.md` | #4 歌手 / 专辑详情 | 改 | 补歌手歌曲排序能力与“最热 / 最新”切换。 |

实际操作（2026-11-11，分支 `doc/artist-song-sort`）：

- `PROVIDER.html` §4.1 歌手歌曲行：注明 `order=1` 为最热，`order=0` 及其它值等价于最新，未知值不报错，仅两种有效顺序；请求参数行改为 `order（1 最热 / 0 最新）`。
- `PROVIDER.html` §4.3 `QqArtistSongData`：补充 `order` 语义注释（1 最热、0 及其它值最新）。
- `CORE.html` §4.2 `ipc.ts`：`artist.get(mid, offset?, sort?)` 增加 `ArtistSongSort`，新增 `artist.getSongs(mid, offset?, sort?)` 返回 `ArtistSongPage`。
- `CORE.html` §4.73 `ArtistView.vue`：补充“最热 / 最新”切换控件、默认 `hot`、只重载歌曲列表并重置偏移、保留头部信息、失败回退与滚动分页走 `artist.getSongs`。
- `CORE.html` §4.75 `api/artist.ts`：签名补 `getArtist(... sort?)` 与 `getArtistSongs(...)`；记录 `hot → order=1`、`latest → order=0`，并注明 `getArtistSongs` 不拉取歌手详情。
- `USER.html` §5.2.8 页面表 · 歌手页 / 专辑页行：补充歌曲排序控件“最热 / 最新”，默认最热，切换只重载歌曲列表。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“改动”无法执行；对应约束已落到 PROVIDER / CORE / USER。

验证：

- 对照 `src/renderer/views/ArtistView.vue`：`SONG_SORTS` 为 `hot` / `latest`，默认 `songSort = 'hot'`；`changeSort()` 滚动回顶并调用 `reloadSongs()`，后者调用 `artist.getSongs(id, 0, next)`，失败回退原排序并保留旧列表。
- 对照 `src/main/api/artist.ts`：`fetchArtistSongs` 使用 `order: sort === 'hot' ? 1 : 0`；`getArtistSongs` 只调用 `fetchArtistSongs`，不请求歌手详情；`getArtist` 并行加载详情与歌曲。
- 对照 `src/shared/ipc.ts` / `src/main/ipc.ts`：`artist.get` 与 `artist.getSongs` 均接受 `sort`，IPC 把 `latest` 归一为 `latest`，其余为 `hot`。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.11 部分歌手因旧详情接口返回 `code -1` 无法加载 [已解决]

问题描述：ISSUES 新增记录，部分歌手（如 Charlie Jeer）打开歌手页时报 `[ipc] UPSTREAM_CHANGED: 歌手详情响应缺少 getSingerInfo`，页面完全加载不出来。

实测原因：
- 旧详情接口 `c.y.qq.com/v8/fcg-bin/fcg_v8_singer_detail_cp.fcg` 对 Charlie Jeer（`000ONBNm2PwShq`）返回 HTTP 200，但响应体只有 `{"code":-1,"subcode":-1,"msg":""}`，没有任何歌手字段；
- 同一歌手的 `GetSingerSongList` 正常，`totalNum=28`，歌曲的 `singer[]` 里能拿到名称；
- `music.musichallSinger.SingerInfoInter / GetSingerDetail` 对该歌手正常返回 `singer_list[0].basic_info.name`、`ex_info.desc` 与 `pic.pic`，周杰伦、林俊杰等歌手也正常。

解决方法：
- `fetchArtistInfo` 不再在缺少 `getSingerInfo` 时抛错，改为返回 `null`，避免整个歌手页被旧接口拖垮；
- 新增 `fetchSingerProfile`：调用 `music.musichallSinger.SingerInfoInter / GetSingerDetail`（`singer_mids: [mid]`、`pic/ex_singer/wiki_singer/group_singer: 1`）读取名称、简介与头像，并把 `http:` 头像改为 `https:`；
- 旧接口缺失时以新接口补齐；新接口也失败时，名称回退到歌曲列表里同 `mid` 的歌手名，头像回退到 `T001R500x500M000<mid>.jpg`；
- 歌曲总数仍优先取旧接口 `total_song`，缺失时用歌曲列表 `totalNum`；专辑数缺失时按 0 处理，页面在专辑数为 0 时隐藏该标签，避免显示错误的“0 张专辑”；
- 新增回放测试：旧接口返回 `code -1` 时，仍能通过 `SingerInfoInter` 得到 Charlie Jeer 的名称、简介、头像与歌曲列表。

验证：
- 匿名实测 Charlie Jeer（`000ONBNm2PwShq`）旧接口返回 `code -1`，新接口与歌曲列表均正常；
- `npm run typecheck` 通过；
- `npx vitest run` 11 个测试文件 / 43 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1 歌手详情行 / §4.3 `QqArtistDetail` | 改 | 说明旧 `fcg_v8_singer_detail_cp.fcg` 对部分歌手只返回 `code -1`；补 `SingerInfoInter.GetSingerDetail` 的 `singer_mids`、`pic/ex_singer` 参数与 `singer_list[].basic_info/ex_info/pic` 字段。 |
| `CORE.html` | §4.75 `api/artist.ts` | 改 | 记录旧详情失败返回 `null`、`fetchSingerProfile` 兜底、名称回退歌曲歌手名、头像与计数降级规则。 |
| `USER.html` | §5.2.8 页面表 · 歌手页 / 专辑页行 | 不动 | 页面结构与交互不变，仅修复上游数据源。 |
| `EVOLVE.md` | #4 歌手 / 专辑详情 | 改 | 接口验证补“旧详情接口可能返回 code -1，需使用 SingerInfoInter 兜底”。 |

实际操作（2026-11-11，分支 `doc/artist-detail-fallback`）：

- `PROVIDER.html` §4.1 歌手详情行：注明旧 `fcg_v8_singer_detail_cp.fcg` 对部分歌手只返回 `code -1`，需使用下方 `SingerInfoInter` 兜底；新增“歌手资料兜底”行，记录 `singer_mids: [mid]`、`pic / ex_singer / wiki_singer / group_singer` 参数及 `singer_list[].basic_info/ex_info/pic` 字段。
- `PROVIDER.html` §4.3：新增 `QqSingerProfile` 接口与注释，记录 `SingerInfoInter / GetSingerDetail` 的响应结构。
- `CORE.html` §4.75 `api/artist.ts`：补充旧详情接口失败返回 `null`、`fetchSingerProfile` 兜底、名称回退歌曲歌手名、头像回退规则，以及歌曲数 / 专辑数降级与“仅在 `albumCount > 0` 时显示专辑数”。
- `USER.html` §5.2.8 页面表 · 歌手页 / 专辑页行：按原表“不动”未处理。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“改动”无法执行；对应约束已落到 PROVIDER / CORE。

验证：

- 对照 `src/main/api/artist.ts`：`fetchArtistInfo` 在缺少 `getSingerInfo` 或请求异常时返回 `null`；`fetchSingerProfile` 请求 `SingerInfoInter / GetSingerDetail` 并携带 `singer_mids`、`group_singer`、`wiki_singer`、`ex_singer`、`pic`、`photos`；`normalizeCover` 把 `http://` 改为 `https://`。
- `getArtist` 在 `info` 为空时使用 `profile.name`，缺失则 `singerNameFromSongs`；`coverUrl` 使用 `profile.coverUrl`，缺失则保持 `T001R500x500M000<mid>.jpg`；`songCount` 优先 `total_song`，`albumCount` 缺失为 0。
- 对照 `src/renderer/views/ArtistView.vue`：专辑数仅在 `detail.albumCount > 0` 时渲染。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.12 歌手页空闲时连续出现 104009 播放链接错误 [已解决]

问题描述：用户停在歌手页、没有播放任何歌曲时，控制台仍连续输出 `[ipc] UPSTREAM_NETWORK: QQ 音乐拒绝了播放链接请求（104009）…`。

排查结论：该错误只可能来自“取播放链接”链路，而歌手页本身不播放、也不探测可用性。真正来源是上一个歌单页的可用性探测：

- `PlaylistView` 使用 `useAvailability`，在 `requestIdleCallback` 中延迟调用 `song.probe`；
- 跳转到歌手页时，组件卸载但没有取消已排队的 idle 回调，也没有让 `generation` 失效，导致探测在歌手页继续执行；
- `probeAvailability` 用 `resolveStreamUrls(..., 'flac')` 取链接：`vkey.GetVkeyServer.CgiGetVkey` 返回 104009 后会回退到 `music.vkey.GetVkey.UrlGetVkey`，两个接口都拒绝时抛出 `UPSTREAM_NETWORK`；
- 原逻辑只在 `QUOTA_LIMITED` / `AUTH_EXPIRED` 时暂停，网络类失败不会暂停；如果歌单在探测期间继续更新，`rerun` 还会让同一轮探测再跑一次，于是出现多条相同日志；
- 主进程 `envelope()` 默认记录所有 IPC 错误，所以背景探测失败也会以 `[ipc]` 形式刷屏。

解决方法：
- `useAvailability` 注册 `onScopeDispose`：组件卸载时递增 `generation` 并取消待执行的 idle / timeout，已发出的请求结果也不再落入状态；
- 探测遇到 `UPSTREAM_NETWORK`（含 104009）时同样置 `suspended`，停止后续批次与 `rerun`，避免继续轰炸上游；
- 为 IPC 注册增加 `{ silent: true }` 选项，`song.probe` 使用静默模式：失败仍返回给渲染层按未知状态处理，但不再输出容易误导的 `[ipc]` 错误日志；
- 不影响用户主动播放失败时的错误提示与日志。

验证：
- `npm run typecheck` 通过；
- `npx vitest run` 11 个测试文件 / 43 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.65 `composables/availability.ts` | 改 | 补 `onScopeDispose` 取消调度并使 generation 失效；`UPSTREAM_NETWORK` 与限流 / 鉴权异常一样暂停探测。 |
| `CORE.html` | §4.2 `ipc.ts` | 改 | `handle` 增加 `{ silent?: boolean }`；`song.probe` 失败不写 IPC 错误日志。 |
| `USER.html` | §5.3 错误与通知 | 不动 | 背景探测仍静默处理，不新增用户可见提示。 |
| `EVOLVE.md` | #5 歌词 / 评论或 #4 歌手页 | 不动 | 属于可用性探测的生命周期修复，不改变产品交互。 |

实际操作（2026-11-11，分支 `doc/availability-dispose-silent-probe`）：

- `CORE.html` §4.65 `composables/availability.ts`：补充 `onScopeDispose` 卸载清理——递增 `generation` 并取消待执行 idle / timeout，已发出请求的结果不再落入状态；探测暂停条件加入 `UPSTREAM_NETWORK`（含 104009），并停止后续批次与 `rerun`。
- `CORE.html` §4.2 `ipc.ts`：`handle` 签名补 `{ silent?: boolean }`，说明异常仍以 `IpcResult` 返回但不写 `[ipc]` 日志；`song.probe` 使用静默模式。
- `USER.html` §5.3 错误与通知：按原表“不动”未处理。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“不动”未处理。

验证：

- 对照 `src/renderer/composables/availability.ts`：`onScopeDispose` 中 `generation += 1`，并调用 `cancelIdleCallback` / `clearTimeout` 取消 `scheduled`；`probe` 的 catch 在 `QUOTA_LIMITED` / `AUTH_EXPIRED` / `UPSTREAM_NETWORK` 时设置 `suspended = true`，循环与 `rerun` 均受其约束。
- 对照 `src/main/ipc.ts`：`envelope(fn, logError = true)` 按 `logError` 决定是否 `console.error`；`handle(..., options: { silent?: boolean })` 传入 `!options.silent`；`song.probe` 注册时带 `{ silent: true }`。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.13 song.probe 请求量与 IP 104009 风控核查（后由 §4.25 / §4.30 完成） [已解决]

> 后续修正：§4.25 已采用本节“方案 2”，把逐首详情改为 `CgiGetTrackInfo` 批量详情（50 首/次，缺失才单曲兜底）；§4.30 又补充了 104009 后的 60 秒全局截断。本节“未完成 / 待决定”的状态仅代表当时，后续已按方案 2 + 全局截断落地。

问题描述：4.12 的泄漏问题修复后，用户 IP 仍被 QQ 音乐风控，播放链接请求持续返回 104009。需要确认 `song.probe` 是否绕过了限流，以及现有令牌桶是否过于宽松。

核查结论（代码层面）：

- **限流没有失效**。探测链路为 `song.probe → probeAvailability → resolveStreamUrls → fetchTrack / requestQuality → musicu → upstreamRequest → fetchOnce`，而 `fetchOnce` 在真正发请求前统一调用 `throttleUpstream()`；所有探测请求与播放、搜索、歌单请求共用同一个进程级令牌桶。
- `requestQuality` 在经典 vkey 接口返回 104009 时会再请求 `music.vkey.GetVkey / UrlGetVkey`；若返回成功但没有 purl，`resolveStreams` 还会按 `flac → 320k → 128k` 继续尝试，因此最坏情况下一个探测批次会发出“50 次歌曲详情 + 3 次 vkey”。
- 当前全局限速为 `UPSTREAM_RATE_LIMIT_PER_SECOND = 4`、`UPSTREAM_RATE_LIMIT_BURST = 8`。打开一个有 50 首歌的歌单，首次探测约需 12 秒连续请求 51 次；滚动加载下一页会再叠加同样规模，且 10 分钟后缓存过期可重来。
- 限流器只约束“每秒请求数”，没有区分前台播放 / 搜索与后台探测，也没有单端点预算或探测冷却；对 QQ 的风控模型而言，这种“短时间集中请求同一首歌单的 50 首详情再批量取 vkey”的模式仍然很像抓取，即使瞬时速率没有超过 4 req/s。

评估：限流机制本身没有失效，但对 `song.probe` 来说**过于宽松且请求形态集中**，是触发风控的高风险来源。当前尚未完成修复，待决定以下方向：

1. 为后台探测增加独立的更严格限速（例如 1 req/s、burst 2），或让探测批次之间强制冷却；
2. 避免逐首调用歌曲详情：歌曲列表响应本身已带 `file.media_mid`，可把 `mediaMid` 带到 `Song`/探测参数中，探测时直接批量取 vkey，把 50 次详情降为 1 次 vkey；
3. 缩小探测范围：只探测首屏 / 当前可见行，而不是一次探测整页；
4. 在 104009 / `UPSTREAM_NETWORK` 后增加全局退避与更长的冷却时间，而不只是暂停当前组件；
5. 评估是否需要把可用性缓存 TTL 从 10 分钟延长，减少重复探测。

状态（当时）：ISSUES 已新增顶层记录，未标记已解决；后续已按方案 2 + 全局截断落地，见 §4.25 / §4.30。

实际操作（2026-11-11，分支 `doc/song-probe-batch-status`）：

- 本节是风控核查记录，没有独立的“修订建议”表；实际修复已由 §4.25（批量详情）与 §4.30（104009 全局截断）完成，本节只补充状态，不重复这两项的文档动作。
- 核对 `src/shared/constants.ts`：存在 `SONG_DETAIL_BATCH = 50` 与 `UPSTREAM_BLOCK_MS = 60_000`。
- 核对 `src/main/api/song.ts`：`fetchTrackBatch` 按 `SONG_DETAIL_BATCH` 分块调用批量详情，`fetchTracksById` 只对缺失歌曲单曲兜底；vkey 使用 `deferBlock`，两个入口都 104009 后才触发截断。
- 核对 `src/main/api/client.ts`：`tripUpstreamBlock` / `upstreamBlockRemainingMs` / `assertUpstreamAvailable` 提供进程级截断，`fetchOnce` 在取令牌前后检查。

验证：

- 本节无独立文档修订动作；`CORE.html` / `PROVIDER.html` / `USER.html` 中与批量详情、104009 截断有关的同步由 §4.25 / §4.30 跟踪。
- `npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.14 歌曲标题的版本标签、尾部空白与徽标位置 [已解决]

问题描述：ISSUES 指出部分歌曲名尾部有多余空白，VIP / 音质徽标因此被推离标题；同时 Big Dawgs 在 QQ 音乐手机客户端显示为 `Big Dawgs (Remix|Explicit)`，本应用只显示 `Big Dawgs`。需要确认 Explicit / Remix 等标签是歌词名称的一部分还是单独元数据。

实测结论（搜索接口 + `songInfo`）：

- `name` 是去掉版本标签的基础名，部分数据带尾部空格；
- `title` 是官方展示标题，包含版本标签：
  - `Big Dawgs` → `Big Dawgs (Explicit)`
  - Remix 版 → `Big Dawgs (Remix|Explicit)`
  - `Company` 的混音版 → `Company (It's different Reimx)`
- `subtitle` 在这些样本中为空；
- `album.name` / `album.title` 也带标签，且使用方括号，如 `Big Dawgs (Remix) [Explicit]`；
- 原始歌曲对象没有独立的 `explicit` / `remix` 布尔字段；存在数值字段 `version`（样本中 0 = 普通、6 = Remix、15 = Explicit）与 `tag`（0 / 11），但没有稳定的文档语义。官方客户端展示的是 `title` 字符串，而不是从布尔字段拼接。

解决方法：
- `toSong` 的显示名改为优先使用 `title`，为空时回退 `name`，两者都 `trim()`；
- 专辑名与歌手名同样 `trim()`，避免尾部空白把 VIP / 音质徽标推远；
- 徽标仍保持在标题后的固定位置（`.pay-badge` / `.quality-badge` 为 `flex: 0 0 auto`），标题过长时只压缩 / 滚动歌名，徽标不被裁掉；
- 新增搜索映射测试：`title` 优先、`title` 缺失时回退 `name`、尾部空白与专辑名、歌手名均被清理。

追加修复（少数短标题歌曲仍有大段空白）：

- 实际抽查 `Daydream In Blue`、`Company`、`Ojos Tristes` 的搜索与歌曲详情响应，`name` / `title` 均无尾部空白，排除 API 数据、trim 失效和缓存问题；
- 真正原因是 CSS 选择器优先级：`.song-title .marquee { flex: 1 1 auto }` 覆盖了 `.song-title-text { flex: 0 1 auto }`，跑马灯容器因此总是撑满标题列，短标题后面的 VIP / 音质徽标被推到列尾，看起来像歌名尾部多出一段空白；长标题刚好填满所以不明显；
- 将该规则改为 `flex: 0 1 auto`，歌名按内容宽度显示、徽标紧随其后；标题过长时仍会收缩并滚动，徽标保持常驻；
- 用 1200px 静态布局复测：三首歌的徽标与歌名间距均为 7px，短标题不再出现大段空白。

验证：
- 匿名实测 `Big Dawgs`、`Big Dawgs (Remix|Explicit)`、`Company`、`Company (Explicit)` 等样本的 `name` / `title` / `album` / `version` / `tag`；
- 追加抽查 `Daydream In Blue`、`Ojos Tristes` 的搜索与详情响应，确认无尾部空白字符；
- `npm run typecheck` 通过；
- `npx vitest run` 11 个测试文件 / 44 个用例通过；
- `npm run build` 通过；
- 静态布局实测短标题与徽标相邻，长标题正常收缩。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.3 `QqSong` | 改 | 补 `title` / `subtitle` / `version` / `tag` 字段，注明 `name` 为基础名、`title` 为含 Explicit / Remix 等标签的展示标题，标签没有独立布尔字段。 |
| `CORE.html` | §4.11 `api/song.ts` | 改 | 显示名改为 `title.trim() || name.trim()`，并说明专辑名、歌手名同步 trim；徽标仍固定在标题后。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | `.song-title .marquee` 使用 `flex: 0 1 auto`，不得撑满标题列；VIP / 音质徽标紧随歌名。 |
| `USER.html` | §5.2.4 歌曲列表 · 标题与徽标 | 改 | 明确歌曲显示名使用上游展示标题（含 Explicit / Remix 版本标签），VIP / 音质徽标紧随标题且不被尾部空白推离。 |

实际操作（2026-11-11，分支 `doc/song-title-display-badges`）：

- `PROVIDER.html` §4.3 `QqSong`：补 `subtitle` / `version` / `tag` 字段，并注明 `name` 是基础名、`title` 是含 Explicit / Remix 标签的展示标题，原始响应没有独立标签布尔字段。
- `CORE.html` §4.11 `api/song.ts`：补充显示名规则 `title.trim() || name.trim()`，专辑名与歌手名同步 `trim()`，避免尾部空白推开徽标。
- `CORE.html` §4.49 `styles/main.css`：补充 `.song-title .marquee` 使用 `flex: 0 1 auto`，不得撑满标题列，短标题时徽标紧随歌名。
- `USER.html` §5.2.4 歌曲列表：明确显示名使用上游展示标题（含版本标签），首尾空白被清理，VIP / 音质徽标紧随标题。

验证：

- 对照 `src/main/api/song.ts`：`toSong` 中 `name = (raw.title ?? '').trim() || (raw.name ?? '').trim()`；`singers[].name` 与 `album.name` 均 `trim()`。
- 对照 `src/renderer/styles/main.css`：`.song-title .marquee` 为 `flex: 0 1 auto; min-width: 0`；`.pay-badge` / `.quality-badge` 为 `flex: 0 0 auto`。
- 对照 `PROVIDER.html`：`QqSong` 已包含 `title` / `subtitle` / `version` / `tag`，并注明基础名与展示标题的区别。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.15 整单下载彻底取消批次并复用统一队列 [已解决]

问题描述：ISSUES 先要求整单下载与单曲下载共用队列、歌曲信息在出队时再拉取；后续又明确要求下载任务不按批次合并，完全取消“批次”概念。原实现虽然已经不再预取歌曲详情，但仍保留 `DownloadBatch`、`batchId` / `playlistId`、`startBatch` 与批次级暂停 / 继续 / 删除 / 重试，下载中心也按批次分组。

解决方法：
- 删除 `DownloadBatch`、`DownloadTask.batchId` / `playlistId` 与 `DownloadSource = 'batch'`，任务来源只保留 `network` / `cache`；
- 下载索引简化为 `{ tasks }`；旧索引中的 `batches` 字段加载时忽略，旧 `source: 'batch'` 归一化为 `network`；
- 新增 `startDownloads(songMids, quality)`：按给定顺序去重后逐首调用同一个 `enqueueTask`，已存在同曲任务时复用；`startDownload` 直接复用它；
- 移除批次 IPC（`batches` / `startBatch` / `pauseBatch` / `resumeBatch` / `removeBatch` / `retryFailed`），新增 `download.startMany`；
- 渲染层下载 store 删除批次状态与批次方法；下载中心改为单一任务列表；歌单“下载全部”直接调用 `download.startMany`，不再创建批次；
- `DOWNLOAD_BATCH_MAX` 更名为 `DOWNLOAD_QUEUE_MAX`，仅限制单次“下载全部”的入队数量；
- 歌曲名、文件路径与音质解析仍只在 `pump` 出队时逐首执行，保持 `DOWNLOAD_CONCURRENCY = 1`。

实际操作（2026-11-11，分支 `doc/download-unified-queue`）：

- `CORE.html` §4.1 `types.ts`：核对后已无 `DownloadBatch`、`batchId` / `playlistId`、`DownloadSource = 'batch'` 与 `DownloadStorageInfo.batchCount`，本次无需再改。
- `CORE.html` §4.60 `download/manager.ts`：核对后已有 `clearDownloadDirectory` 的中止、清空与根目录 / 主目录保护，补充“该操作不影响播放缓存”。
- `CORE.html` §4.2 `ipc.ts`：补充 `download.startMany` 取代批次接口，`clearDirectory` 删除目录内容与记录且不影响播放缓存。
- `CORE.html` §4.59 `audio-protocol.ts`：`audioStreamUrl` 签名补可选 `filePath`，说明 `handleStream` 优先读取本地下载文件并上报完成态缓存进度。
- `CORE.html` §4.11 `api/song.ts`：补充 `getStreamUrls` 先查已下载文件，命中时跳过详情 / vkey。
- `CORE.html` §4.40 `PlayerBar.vue`：核对后已说明“当前曲已下载时缓存进度按 100%”与 tooltip“已下载到本机”，本次无需再改（原表章节号写作 §4.49，按实际组件章节落到 §4.40）。
- `USER.html` §1 TERMS “下载任务 / 下载中心”与“下载限制”：改为统一队列、无批次，整单下载按歌单顺序入队。
- `USER.html` §5.2.7 设置页：下载目录行补“清空目录”，说明确认框展示实际目录、删除文件与记录、播放缓存不受影响。
- `USER.html` §5.2.8 页面结构：歌单详情“下载全部”改为加入统一队列；下载中心改为 `/downloads` 完整页面、单一任务列表、顶部“清空目录”等操作。
- `USER.html` §5.3 错误与通知：下载说明改为无批次、单任务删除与清空目录语义。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“改动”无法执行；对应约束已落到 CORE / USER。

验证：

- 对照 `src/shared/types.ts`：只有 `DownloadSource = 'network' | 'cache'`、`DownloadTask` 与 `DownloadIndex { tasks }`，没有批次字段。
- 对照 `src/main/download/manager.ts`：`startDownloads` 逐首走 `enqueueTask`；`findDownloadedAudio` 与 `clearDownloadDirectory` 存在；清空目录拒绝根目录、主目录及其上级。
- 对照 `src/main/ipc.ts` / `src/shared/ipc.ts`：下载命名空间使用 `startMany` 与 `clearDirectory`，没有批次通道。
- 对照 `src/main/media/audio-protocol.ts`：`audioStreamUrl` 接受可选 `filePath`，`handleStream` 命中本地文件时立即上报完成态。
- 对照 `src/main/api/song.ts`：`getStreamUrls` 先查已下载文件，命中时直接返回本地代理 URL。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.16 已下载歌曲改用本地文件播放并修正缓存进度 [已解决]

问题描述：ISSUES 指出歌曲已下载后，播放条缓存进度仍跟着播放缓冲变化。排查确认不是单纯 UI 问题：`audio-protocol.handleStream` 只检查播放缓存 `getCachedAudio`，不读取下载目录；`getStreamUrls` 也总是先请求上游链接。因此已下载歌曲既没有用上本地文件，缓存进度事件也不会立即变成完成态。

解决方法：
- 新增 `download/registry.ts` 作为下载文件查询边界，避免 `api/song` 与 `download/manager` 循环引用；
- `download/manager` 注册 `findDownloadedAudio(songMid, quality)`：优先返回请求档位，否则返回最高已下载档，并校验文件仍存在；
- `getStreamUrls` 先查询已下载文件；命中时直接返回带本地文件路径的音频代理 URL，不再请求上游详情 / vkey；
- `audioStreamUrl` 支持可选 `filePath`；`handleStream` 优先读取本地下载文件，并立即上报 `complete: true` 的缓存进度；
- `PlayerBar` 对已下载当前曲直接把缓存进度视为 100%，tooltip 显示“已下载到本机”，不再表现为跟随播放缓冲。

验证：
- `test/download-manager.test.ts`：整单入队不预取详情、出队逐首调用 `getDetail`；清空目录删除文件、分片、封面与记录；
- `test/api/song-stream.test.ts` 新增已下载文件命中用例：不调用任何上游 `musicu`，直接返回本地播放 URL；
- `npm run typecheck` 通过；
- `npx vitest run` 12 个测试文件 / 47 个用例通过；
- `npm run build` 通过。

追加需求：清空下载目录按钮。

- 设置页“缓存与下载”的下载目录行增加“清空目录”按钮，下载中心顶部操作区同步提供同一操作（下载中心后于 §4.31 改为完整页面，操作区在顶部）；点击前用确认框展示实际目录，并说明会删除目录内全部文件与下载记录，播放缓存不受影响；
- 主进程新增 `clearDownloadDirectory()`：先中止活动下载、清空任务记录，再删除下载目录内的全部内容并写回空索引；
- 阻止清空文件系统根目录、用户主目录及其上级目录，避免误选目录造成系统级删除；
- 新增 IPC `download.clearDirectory`，preload 与渲染层下载 store 同步清空本地任务 / 资产快照；设置页清空后刷新存储占用；
- 该操作与“清除已完成记录”区分：后者仍只清记录不删文件。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.1 `types.ts` | 改 | 删除 `DownloadBatch`、`batchId` / `playlistId` 与 `DownloadSource = 'batch'`；`DownloadStorageInfo` 删除 `batchCount`。 |
| `CORE.html` | §4.60 `download/manager.ts` | 改 | 说明 `startDownload` / `startDownloads` 共用 `enqueueTask`；彻底移除批次与批次控制；补 `findDownloadedAudio`、`clearDownloadDirectory` 与根目录 / 主目录保护。 |
| `CORE.html` | §4.2 `ipc.ts` | 改 | `download` 命名空间用 `startMany` 取代批次接口；保留 `clearDirectory`，明确其删除下载目录内容与记录、不影响播放缓存。 |
| `CORE.html` | §4.59 `media/audio-protocol.ts` | 改 | `audioStreamUrl` 支持本地下载文件；`handleStream` 优先读取下载文件并上报完成态缓存进度。 |
| `CORE.html` | §4.11 `api/song.ts` | 改 | `getStreamUrls` 先查询已下载文件，命中时跳过上游详情 / vkey。 |
| `CORE.html` | §4.49 `components/PlayerBar.vue` | 改 | 当前曲已下载时缓存进度按 100% 显示，tooltip 使用“已下载到本机”。 |
| `USER.html` | §1 TERMS 下载限制 | 改 | 明确下载任务只有统一队列，没有批次；已下载歌曲直接本地播放，不再重新缓冲。 |
| `USER.html` | §5.2.7 设置页 · 缓存与下载 | 改 | 下载目录行增加“清空目录”，确认后删除目录内已下载文件、封面、分片与记录；播放缓存独立清理。 |
| `USER.html` | §5.2.8 页面结构 · 下载中心 | 改 | 下载中心只展示单一任务列表，不再按批次分组；顶部操作区提供“清空目录”（§4.31 改为完整页面后位置由底部移到顶部）。 |
| `EVOLVE.md` | #2 下载队列 | 改 | 删除批次模型与批次控制，补充统一入队、出队时解析歌曲信息、已下载文件本地播放与清空下载目录约束。 |

实际操作（2026-11-11，分支 `doc/downloaded-local-playback`）：

- 表内前六行（`types.ts`、`download/manager.ts`、`ipc.ts`、`audio-protocol.ts`、`api/song.ts`、`PlayerBar.vue`）与 §4.15 共用，已在 `doc/download-unified-queue` 中完成；本节核对后无需重复修改。
- `CORE.html` §4.40 `PlayerBar.vue`（原表章节号写作 §4.49）：已说明当前曲已下载时缓存进度按 100% 显示、tooltip 使用“已下载到本机”，本次核对无需再改。
- `CORE.html` §4.59 / §4.11：已分别说明 `audioStreamUrl` 可选 `filePath`、`handleStream` 优先本地下载文件并上报完成态，以及 `getStreamUrls` 命中已下载文件时跳过上游。
- `CORE.html` §4.60：已说明播放取源固定为“本机下载文件 > 播放缓存 > 网络”。
- `USER.html` §1 TERMS“下载限制”：补充“已下载歌曲直接使用本地文件播放，不再重新请求上游链接或重新缓冲”。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“改动”无法执行；对应约束已落到 CORE / USER。

验证：

- 对照 `src/main/download/manager.ts`：`findDownloadedAudio(songMid, quality)` 优先请求档位、其次最高已下载档，并校验文件存在。
- 对照 `src/main/api/song.ts`：`getStreamUrls` 命中已下载文件时返回 `audioStreamUrl('', mid, quality, filePath)`，不调用上游详情 / vkey。
- 对照 `src/main/media/audio-protocol.ts`：`audioStreamUrl` 接受可选 `filePath`；`handleStream` 命中后直接读取本地文件并上报 `complete: true`。
- 对照 `src/renderer/components/PlayerBar.vue`：当前曲已下载时 `cachePercent = 100`，tooltip 为“已下载到本机”。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.17 下载按钮的缓存 / 下载状态在播放条与歌曲表统一 [已解决]

> 后续修正：本节后半的“追加修复（遗留问题）”已取代前半的 2px inset 边框方案，最终统一为 24px `::before` 状态框（缓存态 surface 背景、下载态 accent 填充）。以追加修复与本节末尾结论为准。

问题描述：ISSUES 指出歌曲下载按钮在“已缓存”状态下，图标本身变成了带外框的样式，且按钮的圆角边框需要更粗；同时播放条的下载按钮与歌单 / 歌曲表内的呈现不一致，已缓存的边框与已下载的高亮在播放条上都没有生效。

排查确认：

- `AppIcon` 的 `download-cached` 是一个带圆角方框的下载箭头，缓存状态看起来像“图标被框住”，与需求相反；
- 歌曲表仅有 `.song-icon.cached { outline: 1px }` 与 `.song-icon.downloaded` 两条样式，播放条的按钮虽然已经绑定 `cached` / `downloaded` class，但 CSS 中没有 `.icon-btn.cached` / `.icon-btn.downloaded`，因此播放条完全看不到缓存边框和下载高亮；
- 两处选择图标优先级的逻辑本来一致（`downloaded → cached → normal`），差异只在样式层。

解决方法：

- `AppIcon` 的 `download-cached` 改为与普通下载图标一致的下载箭头 + 完整底线（`M12 4v11 / M8 11l4 4 4-4 / M5 19h14`），缓存状态不再由图标外框或断线表达；
- 已缓存状态改由按钮自身的圆角边框表达：`.song-icon.cached` 与 `.icon-btn.cached` 共用 `box-shadow: inset 0 0 0 2px var(--border-strong)`，由原来的 1px `outline` 加粗到 2px，并使用 inset 阴影避免改变按钮尺寸、同时跟随各自圆角（歌曲表 7px / 播放条 9px）；
- 已下载高亮同样共用：`.song-icon.downloaded` 与 `.icon-btn.downloaded` 统一使用 `var(--accent-soft)` 背景与 `var(--accent-strong)` 图标色；
- 播放条按钮基础尺寸为 34px、图标 17px，直接铺满背景时图标四周留白约 8.5px，比歌曲表更空。仅为 `.icon-btn.downloaded` 增加 `padding: 4px` 与 `background-clip: content-box`，高亮收缩为 26px，图标四周留白降到约 4.5px（约一半），点击热区仍保持 34px；
- 播放条与歌曲表继续共用同一套三态图标与 class 绑定，样式层改为同一组选择器，后续调整只需改一处。

验证：

- 本地静态页读取 computed style：播放条与歌曲表的缓存态均为 2px inset 圆角边框；两处下载态均为 `accent-soft` 背景 + `accent-strong` 图标色，播放条高亮内容盒为 26px、歌曲表为 26px；缓存图标路径不含外框且底线完整；
- `npm run typecheck` 通过；
- `npx vitest run` 12 个测试文件 / 47 个用例通过；
- `npm run build` 通过。

追加修复（遗留问题）：

- 缓存态的边框仍画在按钮外沿：播放条 34px / 图标 17px、歌曲表 26px / 图标 15px，四周留白分别约 8.5px 与 5.5px，明显大于已下载高亮。改为所有状态共用一个 24px 的居中状态框（用 `::before` 伪元素绘制）：缓存态为 surface 背景块（`var(--panel)`），下载态为 `accent-soft` 填充；边框方案因观感生硬被弃用，播放条与歌曲表尺寸完全一致，按钮点击热区不变；
- 状态选择收敛为单一枚举：新增 `utils/download-state.ts` 的 `resolveDownloadState` / `downloadStateIcon`，按 `downloaded → cached → none` 返回唯一状态；`SongTable` / `PlayerBar` 的 class、图标与 tooltip 都由该状态派生，不再分别判断 `cachedQuality` / `downloadedQuality`，即使资产同时带两个档位也只显示已下载；
- tooltip 不再拼接“已下载 … · 已缓存 …”：有下载时只显示“已下载 X”，否则显示“已缓存 X”或“下载”；
- 播放取源顺序核对：`api/song.ts` 的 `getStreamUrls` 先调用 `resolveDownloadedAudio`，命中则跳过上游；`media/audio-protocol.ts` 的 `handleStream` 固定按“下载文件 > 播放缓存 > 网络”返回，并补注释锁定该顺序。现有 `test/api/song-stream.test.ts` 已覆盖已下载时不请求上游，新增 `test/download-state.test.ts` 覆盖展示状态优先级。

追加验证：

- 静态页实测播放条与歌曲表的缓存态为 24×24 的 surface 背景块、下载态为 24×24 的 accent 填充；同时挂 `cached` 与 `downloaded` class 时只显示下载填充；
- `npx vitest run` 13 个测试文件 / 51 个用例通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.36 `AppIcon.vue` | 改 | 明确 `download-cached` 与普通下载图标一致（下载箭头 + 完整底线）；缓存状态由按钮的 surface 状态块表达，不再使用带框或断线图标。 |
| `CORE.html` | §1 File tree · `src/renderer/utils/` | 增 | 新增 `download-state.ts`，提供 `resolveDownloadState` / `downloadStateIcon`，作为下载按钮状态的唯一来源。 |
| `CORE.html` | §4.39 `SongTable.vue` | 改 | 下载按钮三态由 `resolveDownloadState` 派生，class / 图标 / tooltip 使用同一状态；已缓存与已下载互斥，下载优先；状态框固定 24px，点击热区不变。 |
| `CORE.html` | §4.40 `PlayerBar.vue` | 改 | 与歌曲表共用 `download-state` 状态与 24px 状态框；tooltip 只显示当前优先级状态，不再拼接“已下载 · 已缓存”。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | 删除按钮外沿的 inset 边框与 `background-clip` 方案；改用 `.cached / .downloaded` 共用的 24px `::before` 状态框：缓存态 surface 背景、下载态 accent 填充，并让下载态覆盖缓存态。 |
| `CORE.html` | §4.11 `api/song.ts` / §4.59 `media/audio-protocol.ts` | 改 | 明确取源优先级为“本机下载文件 > 播放缓存 > 网络”，两处顺序一致并加注释锁定。 |
| `USER.html` | §5.2.3 播放条 · 右区下载 | 改 | 三态呈现改为：普通图标 / 24px surface 背景块（已缓存）/ 24px accent 实心高亮（已下载）；缓存与下载互斥，有下载时只显示已下载，tooltip 不再同时列出两种状态。 |
| `USER.html` | §5.2.4 歌曲列表 · 操作列 | 改 | 与播放条一致：已缓存为 24px surface 背景块，已下载为 accent 高亮；两种状态只显示一种，下载优先。 |
| `EVOLVE.md` | #2 下载队列 / #9 播放条 | 改 | 删除“tooltip 补充缓存档位”与状态可共存表述，改为单一状态且下载优先；播放取源固定下载 > 缓存 > 网络。 |

实际操作（2026-11-11，分支 `doc/download-badge-states`）：

- `CORE.html` §4.36 `AppIcon.vue`：说明 `download-cached` 与普通下载图标同形（箭头 + 完整底线），缓存态改由按钮的 24px surface 状态框表达。
- `CORE.html` §1 File tree + 新增 §4.79 `utils/download-state.ts`：记录 `DownloadState`、`resolveDownloadState` / `downloadStateIcon` 作为下载按钮状态的唯一来源。
- `CORE.html` §4.39 `SongTable.vue`：三态改由 `resolveDownloadState` 派生，class / 图标 / tooltip 共用同一状态，缓存与下载互斥、下载优先，状态框 24px。
- `CORE.html` §4.40 `PlayerBar.vue`：与歌曲表共用状态与 24px 状态框，tooltip 只显示当前优先级状态，不再拼接“已下载 · 已缓存”。
- `CORE.html` §4.49 `styles/main.css`：删除外沿 inset 边框与 `background-clip` 方案，改为 `.cached` / `.downloaded` 共用 24px `::before`，缓存态 `var(--panel)`、下载态 `var(--accent-soft)` 且覆盖缓存态。
- `CORE.html` §4.11 / §4.59：明确取源优先级“本机下载文件 > 播放缓存 > 网络”，两处一致且注释锁定。
- `USER.html` §5.2.3 / §5.2.4 / §1 TERMS“已缓存 / 已下载”：统一为单一状态呈现，缓存为 24px surface 块、下载为 24px accent 高亮，下载优先且 tooltip 不再同时列出两种状态。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“改动”无法执行；对应约束已落到 CORE / USER。

验证：

- 对照 `src/renderer/components/AppIcon.vue`：`download` 与 `download-cached` 路径均为 `M12 4v11` / `M8 11l4 4 4-4` / `M5 19h14`。
- 对照 `src/renderer/utils/download-state.ts`：`resolveDownloadState` 按 `downloaded → cached → none` 返回单一状态。
- 对照 `src/renderer/components/SongTable.vue` / `PlayerBar.vue`：两者均导入 `downloadStateIcon` / `resolveDownloadState`，class 与 tooltip 由同一状态派生。
- 对照 `src/renderer/styles/main.css`：`.cached` / `.downloaded` 共用 24×24 `::before`，下载态 `var(--accent-soft)` 覆盖缓存态 `var(--panel)`。
- 对照 `src/main/api/song.ts` / `src/main/media/audio-protocol.ts`：取源顺序为下载文件 > 播放缓存 > 网络，且注释已锁定。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.18 设置页新增带节点的播放缓存上限滑动条

> 后续修正：本节后半的“追加修复（缓存上限持久化）”已取代前面“只在 `change` 时写盘”的描述；最终为 `input` 防抖 200ms 保存、`change` 立即 flush、卸载兜底，主进程使用同步原子写。

问题描述：ISSUES 要求设置里的缓存选项增加一个带节点的滑动条，用固定档位调整缓存大小：最小 128MB、最大 2GB，档位为 128M → 256M → 512M → 1G → 1.5G → 2G。原实现只有播放缓存开关与“清空”按钮，容量上限写死为 `AUDIO_CACHE_MAX_BYTES = 2 GiB`，用户无法调整；`Settings` 与设置页也没有对应字段。

解决方法：

- `shared/constants.ts` 新增 `AUDIO_CACHE_LIMIT_STEPS_BYTES`（6 个固定档位）、`AUDIO_CACHE_DEFAULT_BYTES`（沿用旧行为，默认 2 GiB）与纯函数 `normalizeAudioCacheLimitBytes`：合法档位原样返回，越界 / 非档位值归一到最近档位，非法值回退默认档位；
- `Settings` 新增 `audioCacheMaxBytes`；主进程 `createDefaultSettings` / `sanitize` 与渲染层 `defaultSettings` 同步补默认值和归一化；
- `cache/audio.ts` 的 LRU 清理不再读常量，改为每次按 `getSettings().audioCacheMaxBytes` 执行，并导出 `enforceAudioCacheLimit()`：写入缓存后仍自动清理，设置页下调上限时也立即清理；
- `settings.set` 保存后若缓存上限发生变化，调用 `enforceAudioCacheLimit()`；关闭播放缓存仍沿用原有清空逻辑，返回实际落盘后的 `saved` 设置；
- 设置页在播放缓存开关下方新增全宽 `cache-limit-row`：左侧显示“播放缓存上限 / 超出后按最久未使用自动清理”，右侧显示当前档位；滑杆固定 6 个节点，已选节点与轨道填充使用 accent 色，未到节点保持弱色；
- 滑杆拖动时立即更新本地档位并安排 200ms 防抖保存，释放（`change`）时取消防抖并立即落盘；组件卸载时若有待保存值则立即 flush；失败时回退到当前设置值并提示；`aria-label` 为“播放缓存上限”，节点标签为 128M / 256M / 512M / 1G / 1.5G / 2G；
- `styles/main.css` 增加滑杆、填充轨道、滑块、节点与焦点环样式；轨道两端各留 7px 与滑块半径对齐，节点使用绝对定位，首尾标签不会挤出面板。

验证：

- 静态页实测 578px 宽滑杆的 6 个节点中心与轨道档位对齐，首尾标签均落在面板内；选择 1G 时轨道填充到 60%，1.5G / 2G 节点保持未激活色；
- 新增 `test/cache-limit.test.ts` 覆盖固定档位、合法值保留、就近归一与非法值回退；
- `npm run typecheck` 通过；
- `npx vitest run` 13 个测试文件 / 51 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.50 `shared/constants.ts` | 改 | 增 `AUDIO_CACHE_LIMIT_STEPS_BYTES`、`AUDIO_CACHE_DEFAULT_BYTES` 与 `normalizeAudioCacheLimitBytes`；说明 `AUDIO_CACHE_MAX_BYTES` 为默认 / 最大档位。 |
| `CORE.html` | §4.1 `types.ts` | 改 | `Settings` 增加 `audioCacheMaxBytes: number`，取值限定为 6 个档位。 |
| `CORE.html` | §4.6 `main/settings.ts` | 改 | 默认值与 `sanitize` 补 `audioCacheMaxBytes`，非法值按最近档位归一。 |
| `CORE.html` | §4.2 `ipc.ts` | 改 | `settings.set` 在缓存上限变化后调用 `enforceAudioCacheLimit()`，返回落盘后的设置。 |
| `CORE.html` | §4.58 `cache/audio.ts` | 改 | 缓存上限改为读取设置而非固定常量；导出 `enforceAudioCacheLimit()`，写入缓存与下调上限时都按当前档位做 mtime LRU 清理。 |
| `CORE.html` | §4.48 `SettingsView.vue` | 改 | 缓存区增加带 6 个节点的上限滑杆；拖动仅预览，释放后写盘并刷新占用；显示当前档位。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | 增 `.cache-limit-row` / `.cache-slider` / `.cache-slider-nodes` 样式：accent 填充、滑块、节点激活色与焦点环。 |
| `USER.html` | §5.2.7 设置页 · 缓存与下载 | 改 | 播放缓存区增加上限滑杆：128M / 256M / 512M / 1G / 1.5G / 2G，默认 2G；下调后立即按最久未使用清理超限文件。 |
| `USER.html` | §5.2.7 设置页 · Settings 字段 | 改 | 持久化字段补 `audioCacheMaxBytes`。 |
| `EVOLVE.md` | #2 下载与缓存系统 | 改 | 补设置页播放缓存上限档位与超限清理行为。 |

追加修复（缓存上限持久化）：

问题描述：ISSUES 指出缓存上限设置没有持久化保存。排查后确认有两处会丢值：设置页原来只在滑杆 `change` 事件写盘，拖动 / 键盘调整期间不保存，`change` 未送达（快速切页或退出）时值不会落盘；主进程 `saveSettings` 使用异步 `writeFile`，`before-quit` 里又不等待 Promise，退出瞬间的最后一次写入可能被进程终止，且直接覆盖不是原子写，异常中断会留下半截 JSON。

解决方法：

- 设置页 `input` 时立即更新本地档位并安排 200ms 防抖保存；`change` 时取消防抖并立即落盘；组件卸载时若有待保存值则立即 flush，避免快速切换页面导致丢值；
- 主进程 `saveSettings` 改为同步原子写：先写 `settings.json.part`，再 `renameSync` 覆盖正式文件；`before-quit` 的保存因此会在进程退出前完成，也不会留下半截文件；
- 新增 `test/settings-persistence.test.ts`：保存 512M 后直接读取磁盘并重新 `loadSettings()` 校验；非档位值按最近档位归一。

追加验证：

- `npx vitest run` 15 个测试文件 / 58 个用例通过；
- 设置页保存路径：拖动结束立即写盘，未触发 `change` 时 200ms 内也会写盘，卸载时兜底 flush。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.48 `SettingsView.vue` | 改 | 缓存上限滑杆 `input` 防抖保存、`change` 立即 flush、卸载兜底保存，保证调整后一定落盘。 |
| `CORE.html` | §4.6 `main/settings.ts` | 改 | `saveSettings` 改为同步原子写（`.part` + `renameSync`），退出时保存不依赖异步 Promise。 |
| `CORE.html` | §4.2 `ipc.ts` | 不改 | `settings.set` 仍在返回前完成保存；持久化实现改动不影响 IPC 契约。 |
| `USER.html` | §5.2.7 设置页 · 缓存与下载 | 改 | 缓存上限调整后自动保存，重启应用保持所选档位。 |
| `BUILD.html` | §11 存储 | 增 | `settings.json` 使用 `.part` 原子替换，退出时同步写入。 |
| `EVOLVE.md` | #2 下载与缓存系统 | 改 | 补缓存上限档位持久化与退出时原子写要求。 |

实际操作（2026-11-11，分支 `doc/cache-limit-slider`）：

- `CORE.html` §4.50 `shared/constants.ts`：补 `AUDIO_CACHE_LIMIT_STEPS_BYTES`（6 档）、`AUDIO_CACHE_DEFAULT_BYTES` 与 `normalizeAudioCacheLimitBytes`，并说明 `AUDIO_CACHE_MAX_BYTES` 为默认 / 最大档。
- `CORE.html` §4.1 `types.ts`：`Settings` 增加 `audioCacheMaxBytes: number`，取值限定为 6 个档位。
- `CORE.html` §4.6 `main/settings.ts`：默认值与 `sanitize` 补 `audioCacheMaxBytes`，非法值按最近档位归一；`saveSettings` 改为同步 `.part` + `renameSync` 原子写。
- `CORE.html` §4.2 `ipc.ts`：`settings.set` 在缓存上限变化后调用 `enforceAudioCacheLimit()`，返回落盘后的设置。
- `CORE.html` §4.58 `cache/audio.ts`：签名补 `enforceAudioCacheLimit()`；缓存上限改为读取设置，写入缓存与下调上限时都按 mtime LRU 清理。
- `CORE.html` §4.48 `SettingsView.vue`：缓存区增加 6 节点上限滑杆；`input` 200ms 防抖、`change` 立即 flush、卸载兜底保存，失败回退原档位。
- `CORE.html` §4.49 `styles/main.css`：补 `.cache-limit-row` / `.cache-slider` / `.cache-slider-nodes` 的填充、节点、焦点环与 7px 端点对齐。
- `USER.html` §5.2.7 设置页：原型与说明补上限滑杆（128M / 256M / 512M / 1G / 1.5G / 2G，默认 2G）、下调后立即清理、自动保存与重启保持；Settings 字段补 `audioCacheMaxBytes`。
- `BUILD.html` §11 存储：`settings.json` 改为 `.part` + `renameSync` 原子替换，退出时同步写入。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“改动”无法执行；对应约束已落到 CORE / USER / BUILD。

验证：

- 对照 `src/shared/constants.ts`：存在 6 档 `AUDIO_CACHE_LIMIT_STEPS_BYTES`、`AUDIO_CACHE_DEFAULT_BYTES = AUDIO_CACHE_MAX_BYTES` 与 `normalizeAudioCacheLimitBytes`。
- 对照 `src/shared/types.ts` / `src/main/settings.ts` / `src/renderer/stores/settings.ts`：`audioCacheMaxBytes` 已进入类型、默认值、`sanitize` 与渲染层默认设置。
- 对照 `src/main/settings.ts`：`saveSettings` 使用 `writeFileSync(temp)` + `renameSync(temp, file)`。
- 对照 `src/main/cache/audio.ts`：清理上限读取 `getSettings().audioCacheMaxBytes`，`enforceAudioCacheLimit()` 已导出；`src/main/ipc.ts` 在缓存上限变化后调用。
- 对照 `src/renderer/views/SettingsView.vue`：`input` 调度 200ms 防抖，`change` 调用 `saveCacheLimit()`，`onBeforeUnmount` flush 待保存值。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.19 首页改为发现页并交换侧栏“发现 / 搜索”顺序 [已解决]

问题描述：ISSUES 要求把首页改成发现页，并把导航栏中的“发现”和“搜索”交换位置。原实现根路径 `/` 重定向到 `/search`，侧栏“浏览”组顺序也是“搜索 → 发现”，因此应用启动后落在搜索页，发现页需要手动点击。

解决方法：

- `router/index.ts` 的根路径重定向从 `/search` 改为 `/discover`，启动与访问 `/` 都默认进入发现页；
- `App.vue` 侧栏“浏览”组改为“发现 → 搜索 → 我喜欢 → 我的歌单”，发现项继续使用 `compass` 图标，搜索项使用 `search` 图标；
- `/search` 路由、搜索结果内的返回链接与登录后跳转 `/library` 均保持不变；歌词 / 评论后由 §4.29 改为弹出层，不再保留 `/lyrics` 路由及其返回逻辑；
- 路由 `active-class` 由现有 RouterLink 自动处理，无需额外状态。

验证：

- 源码核对根路径重定向为 `/discover`，侧栏浏览组顺序为“发现 / 搜索”；
- `npm run typecheck` 通过；
- `npx vitest run` 14 个测试文件 / 55 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.25 `router/index.ts` | 改 | 根路径重定向改为 `/discover`，启动默认进入发现页。 |
| `CORE.html` | §4.23 `App.vue` | 改 | 侧栏“浏览”组顺序改为“发现 / 搜索 / 我喜欢 / 我的歌单”。 |
| `USER.html` | §5.2.2 侧栏与导航 | 改 | 浏览组顺序改为“发现 / 搜索 / 我喜欢 / 我的歌单”，并说明启动默认落在发现页。 |
| `USER.html` | §3.4 页面 / URL 架构图 | 改 | 注明根路径 `/` 默认进入 `/discover`。 |
| `EVOLVE.md` | #11 优化左侧导航 | 改 | 补“发现”在“搜索”之前、根路径默认进入发现页的导航约定。 |

实际操作（2026-11-11，分支 `doc/home-discover-default`）：

- `CORE.html` §4.25 `router/index.ts`：根路径重定向说明改为 `/discover`，并补充启动与访问 `/` 默认进入发现页。
- `CORE.html` §4.23 `App.vue`：侧栏浏览组顺序已在 §4.5 改为“发现 / 搜索 / 我喜欢 / 我的歌单”，本次核对无需再改。
- `USER.html` §5.2.2 侧栏与导航：浏览组顺序已在 §4.5 同步，本次核对无需再改。
- `USER.html` §3.4 页面 / URL 架构图：根路径重定向改为 `/discover`，注明启动默认落在发现页。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“改动”无法执行；对应约束已落到 CORE / USER。

验证：

- 对照 `src/renderer/router/index.ts`：`{ path: '/', redirect: '/discover' }`。
- 对照 `src/renderer/App.vue`：浏览组 RouterLink 顺序为“发现 → 搜索 → 我喜欢 → 我的歌单”。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.20 播放模式按钮点击遍历与顺序播放图标区分 [已解决]

问题描述：ISSUES 要求播放模式按钮点击时按预设顺序遍历模式，而不是停留在当前模式；同时顺序播放图标与播放队列图标都使用 `list`（左侧三个点 + 三条横线），视觉上难以区分，要求把左侧三个点改成向下的长箭头。

解决方法：

- 播放模式按钮点击不再开合菜单，改为调用新增的 `cyclePlayMode()`：先清理模式 / 音量 / 音质弹层与定时器，再调用 `player.cycleMode()`；
- 沿用播放器 store 已有的固定顺序 `sequence → repeat-all → repeat-one → shuffle → sequence`，循环时从当前模式前进一格；悬停 120ms 仍打开其它模式菜单，菜单项仍可直接选择，Esc 与外部点击关闭逻辑不变；
- `AppIcon` 新增 `sequence` 图标：右侧保留三条横线，左侧由三个点改为“向下的长竖线 + 箭头”，向下箭头与右侧列表共同表示顺序播放；
- 播放队列按钮继续使用 `list` 图标（三个点 + 三条横线），`MODE_ICON.sequence` 改为 `sequence`，模式菜单中的顺序播放项也同步使用新图标，两处图标不再重复；
- 播放模式按钮的 `title` 仍显示当前模式名称，菜单 aria 属性与选择逻辑保持不变。

验证：

- 新增 `test/player-store.test.ts` 用例，确认 `cycleMode()` 按 `sequence → repeat-all → repeat-one → shuffle → sequence` 循环；
- 静态页以 64px / 16px 对比 `sequence` 与 `list`：顺序播放为“左向下箭头 + 右列表”，播放队列为“左三点 + 右列表”，16px 下仍可区分；
- `npm run typecheck` 通过；
- `npx vitest run` 14 个测试文件 / 56 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.36 `AppIcon.vue` | 改 | 新增 `sequence` 图标（左侧向下长箭头 + 三条横线）；`list` 专用于播放队列。 |
| `CORE.html` | §4.40 `PlayerBar.vue` | 改 | 播放模式按钮点击改为按固定顺序遍历，悬停菜单保留；`MODE_ICON.sequence` 使用 `sequence` 图标。 |
| `CORE.html` | §4.29 `stores/player.ts` | 改 | 说明 `cycleMode()` 的顺序为 `sequence → repeat-all → repeat-one → shuffle → sequence`，供模式按钮点击使用。 |
| `USER.html` | §5.2.3 播放条 · 播放模式 | 改 | 点击按钮按“顺序 / 列表循环 / 单曲循环 / 随机”依次切换；悬停展开菜单可直接选择其它模式。 |
| `USER.html` | §5.2.3 播放条 · 播放队列入口 | 改 | 播放队列继续使用三点 + 横线图标，与顺序播放的向下箭头图标区分。 |
| `EVOLVE.md` | #9 播放模式 | 改 | 补点击遍历顺序与 `sequence` 图标区分要求。 |

实际操作（2026-11-11，分支 `doc/sequence-icon-cycle`）：

- `CORE.html` §4.36 `AppIcon.vue`：补充 `sequence` 为左侧向下长箭头 + 三条横线，`list` 专用于播放队列（左侧三点 + 三条横线）。
- `CORE.html` §4.40 `PlayerBar.vue`：明确按钮点击按固定顺序遍历、`MODE_ICON.sequence` 使用 `sequence` 专用图标，菜单中的顺序播放项同用该图标。
- `CORE.html` §4.29 `stores/player.ts`：`cycleMode()` 改为说明供播放模式按钮点击使用，顺序为 `sequence → repeat-all → repeat-one → shuffle → sequence`。
- `USER.html` §5.2.3 播放条：播放模式补充“向下长箭头 + 三条横线”图标；播放队列入口明确继续使用“左侧三点 + 三条横线”图标。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“改动”无法执行；对应约束已落到 CORE / USER。

验证：

- 对照 `src/renderer/components/AppIcon.vue`：`sequence` 为 `M9 6h11` / `M9 12h11` / `M9 18h11` / `M4 3v16` / `M1.5 16.5 4 19l2.5-2.5`；`list` 为三条横线 + 三个点。
- 对照 `src/renderer/components/PlayerBar.vue`：`MODE_ICON.sequence = 'sequence'`，按钮点击调用 `cyclePlayMode()`。
- 对照 `src/renderer/stores/player.ts`：`cycleMode()` 使用 `MODES[(currentIndex + 1) % MODES.length]`，顺序固定。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.21 空播放条封面去掉边框并统一收敛全部阴影 [已解决]

问题描述：ISSUES 指出没有歌曲播放时，播放条封面占位元素仍有边框；并追加要求把阴影效果改为 fg 色、略降强度，且整体缩小尺寸。后续澄清：是整体阴影尺寸缩小，不是只压缩宽度，并且该策略要应用到所有阴影效果，而不只是封面。原实现中 `.player-empty-state .player-cover.placeholder` 使用 `1px dashed var(--border-strong)`；阴影则分散为多组黑色硬编码值（如 `0 18px 50px rgba(0,0,0,.45)`、`0 10px 26px`、`-24px 0 60px` 等），范围偏大且与主题前景色无关。

解决方法：

- 删除空状态占位封面的 `1px dashed` 边框，只保留 `color-mix(in srgb, var(--panel) 80%, var(--bg))` 的弱背景；
- 在主题 token 中新增 `--shadow-color`（深色 `var(--text)` 20%、浅色 14%）以及统一缩放后的阴影 token：
  - `--shadow-sm: 0 2px 6px`
  - `--shadow: 0 5px 16px`
  - `--shadow-lg: 0 7px 22px`
  - `--shadow-up: 0 -4px 12px`
  - `--shadow-left: -8px 0 24px`
  - `--shadow-right: 8px 0 24px`
  - `--shadow-handle: 3px 0 10px`
- 所有投影统一改用这些 token：品牌标记、主按钮、tab、封面 / 头像、弹层、面板、Toast、模态框、播放条上弹层、歌词 / 下载抽屉、窄屏侧栏与拖拽把手；品牌主按钮原先的 accent 色光晕也改为中性 fg 阴影；
- 焦点环（`0 0 0 Npx`）、输入框 inset 高光与遮罩层的纯背景色不属于投影，保持不变；
- 播放条封面改用 `--shadow-sm`，有歌曲封面与空状态占位共用同一套阴影；封面按钮 hover 的亮度反馈保持不变。

验证：

- 静态页确认空状态占位无边框，封面阴影为 fg 色；
- 检查 computed style：`--shadow-color` 为 `var(--text)` 混色，各投影均引用缩放后的 token，页面中不再存在硬编码黑色投影；
- `npm run typecheck` 通过；
- `npx vitest run` 14 个测试文件 / 56 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.49 `styles/main.css` · 主题 token | 改 | 主题 token 增 `--shadow-color` 与 `--shadow-sm/base/lg/up/left/right/handle`；说明深色 20%、浅色 14% 的 fg 混色与整体缩小的尺寸。 |
| `CORE.html` | §4.49 `styles/main.css` · 组件投影 | 改 | 删除空状态占位封面的虚线边框；全部投影改用 fg 阴影 token，焦点环与 inset 高光保持独立。 |
| `CORE.html` | §4.40 `PlayerBar.vue` | 改 | 空状态封面仅保留弱背景、无边框；有封面与占位共用 `--shadow-sm`。 |
| `USER.html` | §5.2.3 播放条 · 空状态 | 改 | 封面占位不再显示边框；全局阴影统一为 fg 色、略降强度并整体缩小。 |
| `USER.html` | §5.1 视觉规范 | 改 | 阴影统一使用 fg 混色而非纯黑，范围整体缩小；不再出现按宽度单独压缩的例外。 |
| `EVOLVE.md` | #5 播放条空状态 | 改 | 补封面占位无边框与全局 fg 轻阴影策略。 |

实际操作（2026-11-11，分支 `doc/shadow-tokens-empty-cover`）：

- `CORE.html` §4.49 `styles/main.css`：补 `--shadow-color` 与 `--shadow-sm/base/lg/up/left/right/handle` 主题 token，说明深色 fg 20%、浅色 14% 与整体缩小尺寸；删除空状态占位封面虚线边框，全部投影改用 fg 阴影 token，焦点环与 inset 高光保持独立。
- `CORE.html` §4.40 `PlayerBar.vue`：空状态封面改为无边框，有封面与占位共用 `--shadow-sm`。
- `USER.html` §5.2.3 播放条 · 空状态：补充占位无边框、全局阴影改为 fg 混色、略降强度并整体缩小。
- `USER.html` §5.1 视觉规范：补充阴影统一使用 `--shadow-color` 与缩放后的 token，不再使用纯黑硬编码投影或按宽度单独压缩。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“改动”无法执行；对应约束已落到 CORE / USER。

验证：

- 对照 `src/renderer/styles/main.css`：深色 `--shadow-color: color-mix(in srgb, var(--text) 20%, transparent)`，浅色为 14%；`--shadow-sm` 到 `--shadow-handle` 均为缩放后的 token；各组件 `box-shadow` 引用 token。
- `.player-empty-state .player-cover.placeholder` 只保留弱背景，没有 `border` / `dashed` 声明；`.player-cover` 使用 `box-shadow: var(--shadow-sm)`。
- 焦点环与输入框 inset 高光未改为阴影 token。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.22 歌手简介过长时提供展开 / 收起 [已解决]

> 后续修正：§4.44 已把简介折叠逻辑抽取到 `components/CatalogDescription.vue`，`ArtistView.vue` 不再保留 `descRef` / `descExpanded` / `descOverflow` / `measureDesc()` / `toggleDesc()`；本节关于这些局部实现的描述已被组件化取代，交互与溢出判断规则不变。

问题描述：ISSUES 要求歌手简介太长时提供展开 / 收起选项。原 `ArtistView.vue` 只渲染一整段 `.catalog-desc`，简介较长时会占据大量首屏空间，把歌曲列表推到很下方；短简介又不应出现无意义的切换按钮。因此需要按实际渲染高度判断是否溢出，而不是按字符数或固定长度猜测。

解决方法：

- 歌手简介外层改为 `.catalog-desc-block`，段落按 `descExpanded` 切换 `.clamped`：折叠态用 4 行 `-webkit-line-clamp` 截断，展开态恢复正常高度；
- 新增 `descRef` 与 `measureDesc()`：折叠态下用 `scrollHeight > clientHeight + 1` 判断是否被截断，只有溢出时才渲染“展开 / 收起”按钮；短简介不显示按钮；
- 使用 `ResizeObserver` 监听简介元素，窗口宽度或字体导致换行变化时重新判断；切换歌手或简介变化时重置折叠状态并重新测量；
- 展开后保留按钮以便收起，文案随 `descExpanded` 在“展开 / 收起”之间切换，并同步 `aria-expanded`；
- 样式上让 `.catalog-desc-block` 承担 900px 宽度与底部间距，块内段落取消自身外边距；切换按钮使用 accent 色、透明背景，悬停加下划线。

验证：

- 静态页实测 13px / 1.8 行高下折叠为 4 行（94px），长简介完整高度 117px，`scrollHeight > clientHeight + 1` 判定溢出；短简介为 23px，判定不溢出；移除 `.clamped` 后高度恢复为 117px；
- `npm run typecheck` 通过；
- `npx vitest run` 15 个测试文件 / 58 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.73 `ArtistView.vue` | 改 | 补简介折叠：4 行 line-clamp、按实际高度判断溢出、仅溢出时显示展开 / 收起、`ResizeObserver` 重新测量与切歌重置。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | 增 `.catalog-desc-block`、`.catalog-desc.clamped` 与 `.catalog-desc-toggle` 样式；块内简介取消自身宽度与间距。 |
| `USER.html` | §5.2.8 页面表 · 歌手页 / 专辑页行 | 改 | 歌手页简介超过 4 行时折叠并显示“展开”，展开后可“收起”；短简介不显示切换按钮。 |
| `EVOLVE.md` | #4 歌手 / 专辑详情 | 改 | 补歌手简介折叠与展开 / 收起交互要求。 |

实际操作（2026-11-11，分支 `doc/catalog-description-fold`）：

- `CORE.html` §4.73 `ArtistView.vue`：按后续修正记录为渲染 `CatalogDescription`：默认折叠 4 行、按 `scrollHeight > clientHeight + 1` 判断溢出、仅溢出时显示“展开 / 收起”、`ResizeObserver` 重新测量、文本变化重置折叠；短简介不显示按钮。
- `CORE.html` §4.49 `styles/main.css`：补 `.catalog-desc-block`、`.catalog-desc.clamped` 与 `.catalog-desc-toggle` 样式，块内简介取消自身宽度与外边距。
- `USER.html` §5.2.8 页面表 · 歌手页 / 专辑页行：补简介超过 4 行时折叠、可展开 / 收起，短简介不显示切换按钮。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“改动”无法执行；对应约束已落到 CORE / USER。

验证：

- 对照 `src/renderer/components/CatalogDescription.vue`：默认 `expanded=false`，`measure()` 使用 `scrollHeight > clientHeight + 1`，`ResizeObserver` 监听尺寸，`watch(text)` 重置展开状态。
- 对照 `src/renderer/styles/main.css`：`.catalog-desc-block` 为 `max-width: 900px`，`.catalog-desc.clamped` 为 4 行 `-webkit-line-clamp`，`.catalog-desc-toggle` 为 accent 文字 + 透明背景。
- 对照 `src/renderer/views/ArtistView.vue` / `AlbumView.vue`：均在 `description` 非空时渲染 `CatalogDescription`。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.23 下载文件改为“歌名-歌手-专辑.格式”命名 [已解决]

问题描述：ISSUES 要求解决下载文件冲突，使用“歌名-歌手-专辑.格式”的方式存储。原实现只用 `safeName(song.name) + 扩展名`，不同歌手或不同专辑下的同名歌曲会写到同一个文件并互相覆盖；`IMPL.md §2.2` 当时也把“同名覆盖”记录为临时规则。

解决方法：

- `download/manager.ts` 抽出 `cleanName`，继续过滤 `\ / : * ? " < > |`、压缩空白并 `trim`；
- 新增 `downloadFileName(name, singers, albumName)`：按“歌名-歌手-专辑”拼接，多个歌手先用顿号连接，缺失的片段直接跳过，避免出现多余分隔符；全部为空时回退 `audio`；
- 出队解析歌曲详情时同时带回歌手名与专辑名，实际文件路径在 `pump` 中改用 `downloadFileName(...) + 扩展名`；
- 入队占位路径仍使用 `songMid`，仅在真正下载前解析最终文件名；下载记录、封面、分片与本地播放都继续使用任务里的 `filePath`，无需额外迁移；
- 同一首歌重复下载仍复用已有任务；只有“歌名 + 歌手 + 专辑”完全相同的文件才会覆盖，正常同名歌曲不再冲突。

验证：

- 新增用例：`晴天/Live` + 周杰伦 / 杨瑞代 + 叶惠美 实际落盘为 `晴天_Live-周杰伦、杨瑞代-叶惠美.flac`；非法字符被替换，缺失歌手 / 专辑时只保留歌名；
- `npm run typecheck` 通过；
- `npx vitest run` 15 个测试文件 / 59 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.60 `download/manager.ts` | 改 | 补 `downloadFileName` 规则：`歌名-歌手-专辑`、多歌手顿号连接、缺失片段跳过、非法字符清洗与全空回退 `audio`；文件路径在出队时生成。 |
| `BUILD.html` | §11 存储 | 改 | 下载文件名模板改为“歌名-歌手-专辑.格式”；说明非法字符替换、缺失字段跳过与完全相同曲目覆盖。 |
| `USER.html` | §5.2.7 设置页 · 缓存与下载 | 改 | 说明下载文件按“歌名-歌手-专辑”命名，不同歌手的同名歌曲不会互相覆盖。 |
| `EVOLVE.md` | #2 下载队列 | 改 | 补下载文件命名模板与同名冲突处理要求。 |

实际操作（2026-11-11，分支 `doc/download-file-naming`）：

- `CORE.html` §4.60 `download/manager.ts`：核对后已包含 `downloadFileName` 签名与“歌名-歌手-专辑”、多歌手顿号连接、缺失片段跳过、非法字符清洗、全空回退 `audio`、出队时生成最终路径的说明，本次无需再改。
- `BUILD.html` §11 存储：核对后下载文件名模板与同名覆盖规则已同步，本次无需再改。
- `USER.html` §5.2.7 设置页 · 缓存与下载：补充下载文件按“歌名-歌手-专辑”命名，不同歌手或专辑的同名歌曲不会互相覆盖。
- `EVOLVE.md`：仓库中已不存在该文件，按原表“改动”无法执行；对应约束已落到 CORE / BUILD / USER。

验证：

- 对照 `src/main/download/manager.ts`：`cleanName` 过滤 `\ / : * ? " < > |`、压缩空白并 `trim`；`downloadFileName` 将歌名、歌手（顿号连接）、专辑过滤空段后以 `-` 拼接，全空回退 `audio`。
- 对照 `src/main/download/manager.ts` 的出队路径：最终 `task.filePath` 在 `pump` 中由 `downloadFileName(...)` + 扩展名生成，入队仍使用 `safeName(songMid)` 占位。
- 本次只修改文档，未改源码；`npm run typecheck` 通过；`npx vitest run` 25 个测试文件 / 107 个用例通过。

状态：已解决。

### 4.24 侧栏拖拽手势限定窄屏，并消除与文本选择的冲突

问题描述：ISSUES 指出在歌手详情页选中歌手介绍文字时，界面会突然变暗，且只有某些文本选中时发生。根因是 `App.vue` 的全局侧栏滑动手势：`pointerdown` 记录起点，`pointerup` 在水平位移超过 60px 时打开 / 关闭侧栏。用户在文字上向右拖动选择文本时，同一手势同时被判定为“向右拉出侧栏”，侧栏打开后 `.sidebar-backdrop` 覆盖主界面，看起来就像界面突然变暗；是否触发取决于拖动距离和方向。

修复要求：侧栏拖拽手势只在窄屏启用，宽屏完全不触发；触屏端长按选择文本、拖动触发手势；窄屏非触屏端在不引入长按逻辑的前提下，选择“完全禁用文本选择”的方案。

解决方法：

- `App.vue` 新增 `matchMedia('(max-width: 900px)')` 窄屏判断，`pointerdown` 在宽屏直接返回，宽屏不再记录拖拽起点；
- 触屏端保留原生长按选择行为；`pointerup` 仅在 `pointerType === 'touch'` 且存在非折叠选区时跳过侧栏切换，使长按选择优先于手势；
- 新增 `pointercancel` 清理拖拽起点，避免触屏长按触发指针取消后残留旧起点；
- 窄屏非触屏选择“完全禁止文本选择”方案：在 `@media (max-width: 900px) and (hover: hover) and (pointer: fine)` 下对 `.app-shell` 设置 `user-select: none`，输入框与文本域单独恢复 `user-select: text`；该方案只需 CSS，不引入长按计时器，代码影响最小。

验证：

- 源码核对：宽屏 `pointerdown` 直接返回；触屏 `pointerup` 在存在选区时不切换侧栏；窄屏鼠标环境由 CSS 禁止文本选择；
- `npm run typecheck` 通过；
- `npx vitest run` 15 个测试文件 / 59 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.23 `App.vue` | 改 | 补侧栏拖拽手势的启用条件：仅 ≤900px；触屏长按选择优先；`pointercancel` 清理状态。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | 增窄屏非触屏 `user-select: none` 规则，输入框 / 文本域恢复可选中。 |
| `USER.html` | §5.2.1 窗口与布局 | 改 | 明确宽屏不提供主界面拖拽手势；窄屏触屏长按选择文本、拖动切换侧栏；窄屏鼠标端不支持文本选择。 |
| `EVOLVE.md` | #11 优化左侧导航 | 改 | 补“拖拽手势仅窄屏启用”“触屏长按选择优先”“窄屏非触屏禁用文本选择”约束。 |

### 4.25 歌曲探测改用批量详情接口

问题描述：ISSUES 指出歌曲探测一首一首请求太笨拙，并引用 `sansenjian/qq-music-api` 的 `POST /batchGetSongInfo` 作为参考。原 `getDetail` 与 `resolveStreams` 都通过 `music.pf_song_detail_svr / get_song_detail_yqq` 逐首获取详情，再用并发 2 的 `mapLimit` 限制；打开一个 50 首歌单仍会产生约 50 次详情请求，再叠加 vkey 请求，探测形态集中且容易触发限流。

调研结论：参考项目的 `batchGetSongInfo` 只是对每首歌并发调用同一个单曲接口，本身并没有真正合并上游请求；QQ 音乐实际提供批量详情接口 `music.trackInfo.UniformRuleCtrl / CgiGetTrackInfo`，参数为等长数组 `mids`、`types`、`modify_stamp`，并带 `ctx: 0`、`client: 1`，响应为 `tracks[]`，字段与单曲详情的 `track_info` 一致。

解决方法：

- `shared/constants.ts` 新增 `SONG_DETAIL_BATCH = 50`，作为单次批量详情请求的歌曲上限；
- `api/song.ts` 新增 `fetchTrackBatch`：按 `SONG_DETAIL_BATCH` 分块调用 `CgiGetTrackInfo`，按 `mid` 建索引，响应顺序不影响结果；
- 新增 `fetchTracksById`：先走批量详情，仅对批量响应中缺失的歌曲回退到 `get_song_detail_yqq` 单曲接口，避免个别受限歌曲导致整批失败；单曲兜底仍使用 `PROBE_DETAIL_CONCURRENCY = 2`；
- `getDetail` 与 `resolveStreams` 的详情获取统一改为 `fetchTracksById`，并继续写入 `trackMetaCache`；
- vkey 的 50 首批量是**一次** `musicu` 请求携带 50 组 `songmid` / `songtype` / `filename`，上游在 `midurlinfo[]` 中逐首返回，不是逐首发请求；
- 50 首歌的探测由约 50 次详情请求降为 1 次批量详情请求，只有缺失歌曲才产生额外单曲请求。

验证：

- 新增 `test/api/song-detail.test.ts`：多首歌只发一次 `CgiGetTrackInfo`，参数包含 `mids` / `types` / `modify_stamp`；超过 50 首按 50 分块；批量响应缺歌时回退单曲详情且保持请求顺序；
- 新增两次完整 50 首批量用例：模拟每批 300ms 上游延迟，验证两批串行等待、第二次在第一次返回后才发起，且乱序响应仍能按原请求顺序还原；
- 更新 `test/api/song-stream.test.ts` 的详情 mock 为 `CgiGetTrackInfo` 响应，并新增 50 首歌只为一次 vkey 请求：请求携带 50 组 `songmid` / `filename`，响应 `midurlinfo[]` 覆盖 50 首；原有取流 / 104003 / 104004 / 104009 用例保持通过；
- `npm run typecheck` 通过；
- `npx vitest run` 16 个测试文件 / 64 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1 歌曲详情行 / §4.3 数据模型 | 改 | 增批量详情 `music.trackInfo.UniformRuleCtrl / CgiGetTrackInfo`：`mids` / `types` / `modify_stamp` / `ctx` / `client` 与 `tracks[]` 响应；注明字段与 `get_song_detail_yqq` 的 `track_info` 一致。 |
| `CORE.html` | §4.11 `api/song.ts` | 改 | 补 `fetchTrackBatch` / `fetchTracksById`：50 首分块、按 mid 索引、缺失歌曲单曲兜底；`getDetail` / `resolveStreams` 共用。 |
| `CORE.html` | §4.50 `shared/constants.ts` | 改 | 增 `SONG_DETAIL_BATCH`，推荐值 50；`PROBE_DETAIL_CONCURRENCY` 仅用于批量缺口的单曲兜底。 |
| `USER.html` | §5.2.4 歌曲列表 / §5.3 错误与通知 | 不动 | 探测结果与用户可见状态不变，仅减少上游请求次数。 |
| `EVOLVE.md` | — | 增 | 补“歌曲详情改用批量接口探测，50 首分块，缺失才单曲兜底”的要求。 |

### 4.26 设置页“退出应用”移到右侧独立区块

问题描述：ISSUES 要求把设置里的“退出应用”按钮移到右边单独开一块。原实现把“退出应用”与“关闭到托盘”放在左侧“窗口”面板的同一个 `.panel-body` 里，两项都是窗口行为，但退出应用属于更高风险操作，混在普通设置中容易误触，也不符合用户要求的右侧独立区域。

解决方法：

- 从左侧“窗口”面板删除“退出应用”行，只保留“关闭到托盘”；
- 在右侧列“关于”面板之后新增独立的“应用”面板，放置“退出应用”说明与退出按钮；
- 继续复用现有 `.panel` / `.setting-row` / `.btn ghost small` 与 `AppIcon name="power"`，不新增 CSS 或交互逻辑；
- 退出仍调用原 `quitApp()`，不受“关闭到托盘”设置影响。

验证：

- 源码核对：左侧“窗口”面板只剩“关闭到托盘”，右侧列在“关于”之后渲染独立“应用”面板；
- `npm run typecheck` 通过；
- `npx vitest run` 16 个测试文件 / 64 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.48 `SettingsView.vue` | 改 | 说明“退出应用”位于右列独立“应用”面板，不再与“关闭到托盘”同组。 |
| `USER.html` | §5.2.7 设置页 · 窗口 / 应用 | 改 | “窗口”区只保留关闭到托盘；右侧“应用”区提供退出应用，且不受关闭到托盘影响。 |
| `EVOLVE.md` | — | 增 | 补设置页“退出应用”独立区块的位置要求。 |

### 4.27 托盘图标固定为 22×22 全彩资源

问题描述：ISSUES 指出托盘图标有时候全黑、有时候彩色，只希望保留彩色图标。原实现把 32×32 的 `resources/tray.png` 在运行时 `resize({ width: 22, height: 22 })` 后交给 `Tray`。在 2x 缩放的显示器上，缩放后的 `nativeImage` 会带有 1x / 2x 两个表示；Electron 导出 Linux `StatusNotifierItem` 的 `IconPixmap` 时采用 2x 位图，实际发送的是 44×44，而不是 22×22。部分托盘宿主（例如当前环境中的 Vicinae）按固定的 22×22 解析 pixmap，遇到 44×44 数据时会读错步长 / 通道，显示成整块黑色；在 1x 显示器上同一路径发送 22×22，颜色正常，于是表现为“有时候全黑”。

解决方法：

- 用 `resources/tray.svg` 重新导出 22×22 全彩 RGBA PNG，替换 `resources/tray.png` 与打包用副本 `build/tray.png`，不再保留黑色 / 单色托盘资源；
- `tray.ts` 的 `loadTrayImage()` 直接 `nativeImage.createFromPath()`，不再在运行时缩放，避免高 DPI 下再次生成 44×44 的 `IconPixmap`；
- 显式调用 `image.setTemplateImage(false)`，声明托盘图标为全彩图，而不是交给宿主按主题色 / 单色图标处理；
- 图标为空时输出警告并放弃创建托盘，避免用空图占位产生黑色方块；
- 新增 `test/tray-icon.test.ts`，锁定托盘资源必须是 22×22、8-bit RGBA（PNG color type 6），防止后续误换成单色或大尺寸图标。

验证：

- 用与 `loadTrayImage()` 相同的加载方式启动测试托盘，查询 D-Bus：`IconPixmap` 为 `22 22 1936`，像素采样包含 `A=255 / R=30 / G=215 / B=96` 的品牌绿色；修改前同一查询为 `44 44 7744`；
- `npm run typecheck` 通过；
- `npx vitest run` 17 个测试文件 / 66 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.19 `tray.ts` | 改 | 说明托盘图标固定加载 22×22 全彩 PNG，不在运行时缩放，且显式非模板图；空图标不创建托盘。 |
| `CORE.html` | §1 File tree · `resources/` | 改 | 注明 `tray.png` 为 22×22 全彩托盘资源，无单色变体。 |
| `USER.html` | §5.4 托盘 | 改 | 补一句：托盘只提供全彩图标，不随主题切换为单色 / 黑色图标。 |
| `EVOLVE.md` | — | 增 | 补“托盘图标固定 22×22 全彩资源，避免高 DPI 下导出 44×44 pixmap”的约束。 |

### 4.28 取消评论“点赞”排序（上游没有按点赞排序接口）

> 后续修正：§4.41 已完全删除“最旧”排序与 `CommentSort`，`comment.get` 只保留 `(songId, cursor?)`；本节“只保留最新 / 最旧”的结论以 §4.41 为准，`GetNewCommentList` + `LastCommentSeqNo` 的使用不变。

问题描述：ISSUES 指出按点赞排序评论时报 `[ipc] UPSTREAM_CHANGED: 上游返回错误码 10000（music.globalComment.CommentRead.GetHotCommentList）`。原实现把 `hot` 当作评论排序交给 `GetHotCommentList`，而该方法的响应只有 `req_0.code = 10000` 与空的 `CommentList`，页面直接进入错误态。

对 API 的正确理解：QQ 音乐的 Hot 是评论浏览列表之外的“热评”附加模块，只展示少量最热门评论，冷门歌曲可能为空；它不是可按页浏览的评论排序，也不能替代“按点赞数排序”。

实测结论（歌曲 `97773`，匿名请求）：

- `GetHotCommentList` 无论使用原参数、最小参数、`WithHot=1`、`PageNum=1` 还是去掉 `LastCommentSeqNo`，均返回 HTTP 200、顶层 `code=0`、`req_0.code=10000`，`CommentList.Comments` 为空；
- `GetNewCommentList + WithHot=1` 返回的 `CommentList2` 是上述热评附加模块：首次 21 条、`Total=3965`、包含 22488 / 265810 等高赞评论；`PageNum=1` / `PageNum=2` 时 `CommentList2` 为空，说明它只有首屏，不是可分页的评论列表；
- `GetNewCommentList` 额外传 `Order` / `Sort` / `SortType` / `OrderType` / `CommentSort` / `Hot` / `Type` / `SortMode` / `OrderBy` / `SortBy` / `Rank` 时，返回的评论顺序与点赞数完全一致，确认上游没有真正的“按点赞数排序”参数；
- 因此不能把 `CommentList2` 强行当作评论排序结果，正确做法是取消该排序功能。

解决方法：

- `CommentSort` 从 `hot | latest | oldest` 改为 `latest | oldest`（§4.41 随后完全删除 `CommentSort`）；
- 评论排序控件删除“点赞”，只保留“最新 / 最旧”（§4.41 后连“最旧”也删除，只显示“评论”）；默认仍为“最新”；
- `comment.ts` 统一调用 `GetNewCommentList` 并读取 `CommentList`，不再使用 `GetHotCommentList`、`WithHot` 或 `CommentList2`；`oldest` 继续在已加载评论上按 `createdAtMs` 本地升序重排（该重排随后由 §4.41 删除）；
- `comment.get` IPC 只接受 `latest` / `oldest`，旧渲染层若仍传入 `hot` 会回退为 `latest`，不会再把上游错误码暴露给用户（§4.41 后签名改为 `(songId, cursor?)`）；
- 更新 `test/api/comment.test.ts`：锁定最新 / 最旧都使用 `GetNewCommentList`、不携带 `WithHot`，并保留评论过滤与本地排序校验；
- 热评附加模块当前不实现；若后续需要在评论区之外展示，应作为独立区块单独加载，并允许空状态。

验证：

- 匿名实测 `GetHotCommentList` 返回 `req_0.code=10000`；`GetNewCommentList` 在多种排序参数下顺序均不变；`WithHot=1` 的 `CommentList2` 仅首屏可用；
- `npm run typecheck` 通过；
- `npx vitest run` 17 个测试文件 / 66 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1 歌曲评论行 / §4.3 `QqCommentList` | 改 | 删除“点赞排序走 `GetHotCommentList`”；注明上游没有按点赞排序参数，`GetHotCommentList` 返回业务码 `10000`；`WithHot=1` 的 `CommentList2` 是热评附加模块，仅首屏、可为空，不是评论排序。 |
| `CORE.html` | §4.15 `comment.ts` | 改 | 删除 hot 分支与 `CommentList2` 读取；`CommentSort` 最终由 §4.41 完全删除，评论只保留最新评论游标分页。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 评论排序先删除“点赞”，随后由 §4.41 删除“最新 / 最旧”切换，只显示“评论”标题；若展示热评，应在评论列表外单独说明。 |
| `EVOLVE.md` | — | 改 | 删除“评论按点赞排序”的要求；如需热评，改为独立的附加模块需求。 |

### 4.29 歌词 / 评论改为弹出层并由播放条封面开关

问题描述：ISSUES 要求播放条封面点击在“打开歌词 / 评论”和“关闭歌词 / 评论”之间切换，而不是只负责打开。原实现把歌词 / 评论作为独立路由页 `/lyrics`，`PlayerBar.vue` 的 `openLyrics()` 无条件 `router.push('/lyrics')`，已经在该页时再次点击封面没有反应。按新的交互要求，歌词 / 评论不再作为独立页面，而是覆盖当前内容区的弹出层，样式保持不变。

解决方法：

- `stores/ui.ts` 增加 `lyricsOpen`、`toggleLyrics()`、`closeLyrics()`，由界面状态而不是路由控制开关；
- 原 `views/LyricsView.vue` 移动为 `components/LyricsOverlay.vue`：保留原 header、双栏歌词 / 评论与全部 `.lyrics-page*` 样式，只把根节点包进 `.lyrics-overlay`；返回按钮改为关闭弹出层；
- `App.vue` 在 `.main` 之后按 `ui.lyricsOpen` 渲染 `LyricsOverlay`；路由变化、侧栏导航与 Esc 都关闭弹出层，避免覆盖新页面；
- `PlayerBar.vue` 不再依赖路由：封面点击调用 `ui.toggleLyrics()`，title 根据 `ui.lyricsOpen` 在“歌词与评论 / 关闭歌词与评论”之间切换；
- 删除 `/lyrics` 路由与上一版临时使用的 `utils/navigation.ts`、`test/navigation.test.ts`；
- `styles/main.css` 新增 `.lyrics-overlay`：固定在内容区（左侧让出侧栏、底部让出播放条），使用 `var(--bg)` 背景；原有 `.lyrics-page` 样式保持不变。

验证：

- `npm run typecheck` 通过；
- `npx vitest run` 18 个测试文件 / 67 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.31 `stores/ui.ts` | 改 | 增 `lyricsOpen` / `toggleLyrics` / `closeLyrics`；歌词 / 评论由界面状态控制，不占路由。 |
| `CORE.html` | §4.40 `PlayerBar.vue` | 改 | 封面点击切换 `ui.lyricsOpen`，不再导航；title 随状态切换。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | 增 `.lyrics-overlay`：固定在内容区、位于播放条下方 / 侧栏右侧；歌词页样式沿用。 |
| `CORE.html` | §4.72 `LyricsView.vue` | 改 | 文件改为 `components/LyricsOverlay.vue`；返回按钮关闭弹出层；从路由表删除 `/lyrics`。 |
| `USER.html` | §3.4 页面表 / §5.2.5 歌词与评论 | 改 | 歌词 / 评论改为从播放条封面打开的弹出层，不再作为独立路由页；再次点击封面或返回按钮关闭。 |
| `EVOLVE.md` | — | 改 | 删除“歌词 / 评论为普通路由页”的要求，改为内容区弹出层。 |

### 4.30 批量下载卡住页面与 104009 全局截断

> 后续修正：§4.31 已删除 `DownloadDrawer`，下载中心改为 `/downloads` 完整页面；§4.50 / §4.52 又移除数字指示并把进度条改为 fixed overlay。本节“仅在 `ui.downloadOpen` 时渲染抽屉”的修复被页面改造取代；轮询只在状态变化时刷新资产、下载不受页面生命周期取消、104009 全局截断等结论继续有效。

问题描述：ISSUES 指出开始批量下载歌曲后，设置页、搜索页等界面无法打开，同时播放会收到 104009；要求先分析旧代码确认根因，确认改用批量接口后是否仍存在，再决定跳过或修复；并要求作为兜底，收到 104009 时触发 60 秒超时，期间任何上游请求都被截断并 toast 提示。

根因分析：

1. 上游请求侧（批量接口已解决）：
   - 旧实现的 `getDetail` / `resolveStreamUrls` 对每首歌调用 `music.pf_song_detail_svr / get_song_detail_yqq`；`song.probe` 打开一个 50 首歌单页会先发 50 次详情，批量下载出队时每首也要先发 1 次详情再发 1 次 vkey。
   - 所有请求共用进程级 FIFO 令牌桶（4 req/s）。搜索、歌单等前台请求会排在大批后台探测 / 下载请求之后，表现为“页面迟迟打不开”。
   - 改用 `music.trackInfo.UniformRuleCtrl / CgiGetTrackInfo` 后：50 首探测降为 1 次批量详情 + 1 次 vkey；下载出队仍只解析当前一首（1 次详情 + 1 次 vkey）；已下载歌曲直接本地播放、不再请求上游。该部分已由 4.25 覆盖，无需额外改造。
2. 渲染侧（批量接口没有解决，仍然存在）：
   - `stores/download.ts` 每 1.5 秒轮询 `download.list`，并把“所有已缓存资产 + 所有任务歌曲”重新提交给 `download.assetStates`；主进程对每个 mid 都要遍历全部任务，任务上千时单次轮询就是平方级开销，且 100 首一块的分块请求会互相叠加。
   - `DownloadDrawer` 即使关闭也会渲染全部任务行；上千任务时每次轮询都会重排整张列表，阻塞渲染线程，使设置、搜索等较重的路由看起来无法打开。
3. 104009 兜底缺失：收到 104009 时只做一次备用入口尝试并提示当前歌曲失败，没有进程级冷却；下载泵还会把后续待下载任务快速标记为失败。

解决方法：

- 渲染侧：
  - `DownloadDrawer` 仅在 `ui.downloadOpen` 为真时渲染进度条、空状态与任务列表；关闭时不再保留上千行 DOM；
  - `download` store 在有活动任务时继续轮询以更新歌曲表图标，但下载中心关闭后不渲染任务列表、也不扫描目录用量；任务全部结束后自动停止轮询；`startMany` 不再假装打开下载中心；
  - 轮询只在任务状态发生变化时刷新对应歌曲的资产状态，首次载入不再把所有任务重新查一遍；`remove` / `clearDirectory` / `reset` 同步清理状态记录。
- 104009 全局截断：
  - `shared/constants.ts` 新增 `UPSTREAM_BLOCK_MS`，推荐值 `60_000`；
  - `api/client.ts` 增加进程级截断窗口：`tripUpstreamBlock()` 设置截止时间并通知渲染层，`upstreamBlockRemainingMs()` 返回剩余时长，`assertUpstreamAvailable()` 在窗口内直接抛错；
  - `fetchOnce` 在取令牌前后各检查一次，窗口内不再发出任何网络请求；`favorite.ts` 的签名写入与 `login.ts` 的 OAuth authorize 等绕过 `fetchOnce` 的请求，也在取令牌后显式检查；
  - `musicu` 默认在 104009 时触发截断；vkey 需要先尝试备用入口，`song.ts` 用 `deferBlock` 暂停截断，只有两个入口都返回 104009 时才触发，备用入口成功则不进入冷却；
  - 截断期间的错误统一为 `UPSTREAM_NETWORK`、`upstreamCode = 104009`，文案包含剩余秒数，不重试；
  - `download/manager.ts` 在截断窗口内停止出队；若正在解析的任务收到 104009，则保持 `pending`、不标记失败，并在窗口结束后自动恢复下载；
  - 主进程通过 `upstream:blocked` 事件广播截断通知，preload 暴露 `upstream.onBlocked`，`App.vue` 收到后 toast 提示暂停秒数与原因；同一窗口内只通知一次，避免并发失败刷屏。

验证：

- 新增 `test/api/client-block.test.ts`：104009 触发截断、后续请求在发出 fetch 前即失败、重复触发只通知一次、60 秒后自动解除、`deferBlock` 期间不触发；
- `test/api/song-stream.test.ts` 增加断言：备用入口成功时不触发截断，两个入口都 104009 时触发一次；
- `npm run typecheck` 通过；
- `npx vitest run` 19 个测试文件 / 70 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.2 `ipc.ts` / `api/client.ts` | 改 | 补 104009 全局截断：`UPSTREAM_BLOCK_MS`、`tripUpstreamBlock` / `upstreamBlockRemainingMs` / `assertUpstreamAvailable`；`fetchOnce` 取令牌前后检查；`musicu` 默认截断，vkey 用 `deferBlock` 等两次入口都失败后再截断；`upstream:blocked` 广播。 |
| `CORE.html` | §4.60 `download/manager.ts` | 改 | 截断窗口内停止出队；任务遇到 104009 保持待下载并在窗口结束后自动恢复，不标记失败。 |
| `CORE.html` | §4.31 `stores/download.ts` / DownloadsView（原 `DownloadDrawer.vue` 已由 §4.31 删除） | 改 | 仅在下载中心可见时轮询与渲染任务列表；资产状态只刷新状态变化的任务，禁止每次轮询全量查询。 |
| `CORE.html` | §4.50 `shared/constants.ts` | 改 | 增 `UPSTREAM_BLOCK_MS`，推荐值 60_000。 |
| `USER.html` | §5.3 错误与通知 | 改 | 收到 104009 时提示已暂停上游请求 60 秒，请检查网络 / VPN / 代理出口；期间播放、搜索、下载等上游操作直接失败。 |
| `USER.html` | §5.2.8 下载中心 | 改 | 下载中心关闭时不渲染全量任务列表、不扫描目录用量；有活动任务时仍轮询状态以更新歌曲表图标，全部结束后停止；打开时刷新用量与完整进度。 |
| `PROVIDER.html` | §4.1 vkey / 错误码表 | 改 | 补 104009 触发全局 60 秒截断：两个 vkey 入口都拒绝后不再请求上游。 |

### 4.31 下载中心改为完整页面

> 后续修正：§4.50 已删除 `(完成/总数)` 与失败数等数字指示；§4.52 将整体进度条改为不占布局的 fixed overlay；§4.51 在筛选同行右侧新增“全部开始”。本节关于数字指示、吸顶 / 通栏布局与操作栏的描述以这三节为准。

问题描述：ISSUES 要求把下载中心从右侧弹出抽屉改为完整页面；清空目录、打开文件夹等操作按钮放在顶部；页面顶部的进度栏横跨窗口，并显示整体进度（形如 `(1/100)`）。

解决方法：

- 新增 `views/DownloadsView.vue`，删除 `components/DownloadDrawer.vue`，新增 `/downloads` 路由；侧栏“下载”由按钮改为 `RouterLink`，按当前路由高亮；
- 页面顶部增加整体进度栏，横跨内容区宽度：最初显示完成数 / 总数（如 `(1/100)`）与失败数，进度按 `done / total` 计算（数字指示已由 §4.50 删除）；任务列表为空时显示空状态；
- 后续布局调整：不再显示“整体进度”字样；进度条贴在页面最顶部并左右延伸到内容区边缘，`(完成/总数)` 与失败数绝对定位在进度条下方右对齐（数字指示已由 §4.50 删除，进度条最终由 §4.52 改为 fixed overlay）；标题区直接复用普通 `.page` 布局，顶部留白、背景与“设置 / 我的歌单”页一致，不使用不透明吸顶背景，避免页面顶部光晕被遮住后只在标题下方露出；
- 下载条目区顶部增加“全部 / 进行中 / 已完成 / 未成功”过滤切换，并包含在任务面板边框内；过滤只影响展示，整体进度仍按全部任务计算；
- 任务按队列顺序降序展示，新任务在最前；该顺序仅为视觉调整，不改变主进程统一队列的处理顺序；
- `page-head-actions` 集中放置“清除已完成”“清空目录”“打开文件夹”，其中“清除已完成”只清记录，“清空目录”仍保留目录确认与路径提示；
- 列表复用原任务行样式，保留单任务暂停 / 继续 / 删除；页面底部不再保留抽屉式操作栏；
- 删除 `ui.downloadOpen` 及 `toggleDownload` / `closeDownload`：下载中心不再与播放队列 / 侧栏互斥，也不再作为弹出层；播放条与各歌曲表的单曲下载只加入队列并提示，不再自动打开下载中心；
- `download` store 的 `setOpen` 改名为 `setVisible`：下载页挂载时开启轮询并刷新目录用量，离开时若仍有活动任务则保留轮询以更新歌曲表图标，全部结束后自动停止；新任务由 `replace` 追加到数组末尾，页面倒序展示；
- 修复下载页任务偶发为空：`reset()`（登录态变化时会调用）原先总是停止轮询；若此时下载页仍可见，列表被清空后不会再自动加载。现在 `reset()` 在页面可见时立即重新 `load()`，仅在页面不可见时停止轮询；
- 新增 `utils/download-progress.ts` 与对应测试，统一整体进度计算。

验证：

- 新增 `test/download-progress.test.ts`：空列表、混合状态、全部完成三种情况的计数与百分比；
- 新增 `test/download-store.test.ts`：下载页可见时加载任务；`reset()` 后页面仍可见时自动重新加载；
- 新增 `test/downloads-view.test.ts`：组件能够从下载 store 渲染任务行；Vitest 配置补充 Vue 插件以支持 SFC 测试；
- `npm run typecheck` 通过；
- `npx vitest run` 22 个测试文件 / 76 个用例通过；
- `npm run build` 通过，产物新增 `DownloadsView` 分包。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §1 文件树 / §4.67 | 改 | 删除 `components/DownloadDrawer.vue`，改为 `views/DownloadsView.vue`；下载中心为 `/downloads` 路由页，不再占弹出层。 |
| `CORE.html` | §4.31 `stores/ui.ts` | 改 | 删除 `downloadOpen` / `toggleDownload` / `closeDownload`；下载中心不再参与抽屉互斥。 |
| `CORE.html` | §4.31 `stores/download.ts` | 改 | `setOpen` 改为 `setVisible`；下载页可见时轮询并刷新目录用量，不可见时仅在存在活动任务时继续轮询；新任务追加到列表末尾，页面倒序展示；`reset()` 在页面可见时立即重新加载。 |
| `CORE.html` | §4.71 `utils/download-progress.ts` | 增 | 补 `downloadOverallProgress`：总任务 / 完成 / 失败 / 进行中 / 百分比。 |
| `USER.html` | §3.4 页面表 / §5.2.8 下载中心 | 改 | 下载中心改为侧栏可进入的完整页面；顶部整体进度条为不占布局的 fixed overlay，不显示数字 / 失败数指示；标题区与设置 / 我的歌单页使用相同的页面留白与背景；条目区面板边框内顶部提供“全部 / 进行中 / 已完成 / 未成功”过滤，右侧提供“全部开始”；任务按新到旧展示。 |
| `USER.html` | §5.2.2 侧栏 | 改 | “下载”改为路由入口，指向 `/downloads`；不再打开右侧抽屉。 |
| `EVOLVE.md` | — | 改 | 下载中心由抽屉改为完整页面，补充顶部操作区与整体进度栏要求。 |

### 4.32 无歌曲时播放条按钮状态与音质弹出

> 后续修正：§4.33 将音质按钮点击改为按 `auto → 128k → 320k → flac` 固定顺序循环，悬停仍展开其余档位；本节“点击按钮仍可切换”以 §4.33 为准。

问题描述：ISSUES 指出没有歌曲在播放时，播放条的喜欢 / 下载按钮没有变灰；同时切换音质按钮失效。要求音质切换改为类似播放模式的弹出：按钮本身表示当前档位，弹层只列出其它档位并与按钮一体化。后续新增子项：播放条与设置页的音质设置没有对齐，播放条不能选“自动”，两边配置没有联动；两者应共用内部 API 与状态。

解决方法：

- 喜欢 / 下载按钮原本已有 `:disabled="!hasSong"`，但 `.icon-btn` 缺少禁用态样式；补充全局 `.icon-btn:disabled`（使用 `faint` 色、降低透明度、禁用 hover 高亮），上一首 / 下一首 / 播放按钮也同步获得一致的灰化表现；
- 移除音质按钮的 `:disabled="!hasSong"`，无歌曲时仍可切换档位，实际值由 `player.setQuality()` 写入 `requestedQuality`，下次播放生效；
- 音质按钮改为与播放模式一致的 revealer：
  - 按钮保留当前档位文本并常驻高亮；
  - 弹层只渲染“其它档位”，当前档位不再重复出现；
  - 鼠标悬停打开、离开延迟关闭，点击按钮循环切换档位（§4.33）；展开时按钮位于弹层底部并与弹层左右 / 下边缘对齐；
  - 档位文案压缩为 `128K / 320K / FLAC`，弹层宽度与按钮一致，避免窄按钮配宽弹层；
- 弹层打开时关闭音量 / 播放模式弹层，并补齐对应定时器清理与 Esc / 点击外部关闭逻辑。
- 播放条与设置页音质共用状态：
  - `stores/settings.ts` 导出 `QUALITY_PREFERENCE_OPTIONS`（自动 / 128K / 320K / FLAC），设置页与播放条共用这组选项；
  - `settings.settings.defaultQuality` 作为唯一持久化偏好，播放条新增 `qualityPreference` 只读状态；
  - `player.updateDefaultQuality(pref)` 作为两者共用的写入入口：更新设置、应用 `requestedQuality`，当前有歌曲时重新加载；
  - 播放条按钮显示偏好档位（`AUTO / 128K / 320K / FLAC`），弹层包含“自动”及其它档位；`auto` 按登录态解析为 FLAC 或 320K，tooltip 同时显示当前实际请求档位；
  - 设置页删除本地音质选项常量，改用同一组选项并调用 `player.updateDefaultQuality()`，两处状态即时联动。

验证：

- `npm run typecheck` 通过；
- `npx vitest run` 22 个测试文件 / 77 个用例通过（含播放条与设置页共用音质偏好的用例）；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.40 `PlayerBar.vue` | 改 | 喜欢 / 下载按钮禁用态灰化；音质改为按钮即当前偏好的 revealer，弹层包含自动与其它档位，悬停展开、关闭时清理定时器；无歌曲时仍可切换档位。 |
| `CORE.html` | §4.31 `stores/settings.ts` / `stores/player.ts` | 改 | 导出 `QUALITY_PREFERENCE_OPTIONS`；`defaultQuality` 为唯一持久化偏好，播放条暴露 `qualityPreference`；`updateDefaultQuality()` 作为设置页与播放条共用写入入口。 |
| `CORE.html` | §4.44 `SettingsView.vue` | 改 | 删除本地音质选项，改用共享选项并调用 `player.updateDefaultQuality()`，与播放条状态联动。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | 补 `.icon-btn:disabled` 灰化样式；音质弹层与播放模式共用向上 reveal 的定位 / 动画约定。 |
| `USER.html` | §5.2.2 播放条 / §5.2.7 设置页 | 改 | 无歌曲时喜欢 / 下载 / 上一首 / 下一首 / 播放按钮灰化不可用；音质按钮始终可用，按钮显示当前偏好（含“自动”），悬停弹出其它档位；设置页与播放条共用同一份音质偏好并即时联动。 |
| `EVOLVE.md` | — | 改 | 补充音质切换与播放模式一致的 revealer 交互要求。 |

### 4.33 Revealer 统一交互

> 后续修正：§4.54 将播放条收藏定义为特殊 revealer（点击收藏 / 取消收藏，弹层只有“加入歌单”），§4.55 将音量触屏改为按拖动距离 delta 调节；统一“点击循环”规则只适用于播放模式与音质，收藏 / 音量为例外。

问题描述：ISSUES 要求所有带选项的 revealer 统一设计模式：按钮本身点击按固定顺序切换选项、弹层按固定顺序列出除当前项外的其余选项、按钮始终高亮当前项；音量条作为特殊个例单独说明。排查后唯一缺口是播放条音质切换按钮仍为点击展开 / 关闭弹层，而不是点击循环切换。

解决方法：

- `stores/player.ts` 新增 `cycleQualityPreference()`：按 `QUALITY_PREFERENCE_OPTIONS` 的固定顺序 `auto → 128k → 320k → flac → auto` 调用共享的 `updateDefaultQuality()`；
- `PlayerBar.vue` 音质按钮点击改为 `cycleQuality()`：关闭当前弹层并循环切换偏好；悬停仍按 120ms / 200ms 展开其余档位；
- 弹层继续只显示除当前偏好外的档位，顺序与共享选项一致；按钮本身显示当前偏好（`AUTO / 128K / 320K / FLAC`）并保持高亮；
- 播放模式按钮已符合规则（点击 `cycleMode()` 循环，悬停展开其余模式）；音量条保持特殊个例：点击切换静音、悬停展开音量条、≤900px 才启用弹出滑块。
- 样式约束同步：
  - USER §2 将 Revealer 约定扩展为交互与样式两部分：统一描述弹层向上展开、与按钮同宽对齐、按钮位于弹层底部并高于弹层、当前项由按钮表示、弹层使用面板底色与向上阴影、选项悬停使用 `--subtle-bg`、按钮不带边框；只描述行为 / 呈现，不写具体数值，也不规定悬停延迟；
  - 音质 revealer 移除按钮边框；音质选项 hover 背景由 `--subtle-bg-strong` 改为 `--subtle-bg`，与播放模式一致。

文档同步：

- `USER.html` §2 新增 Revealer 统一交互约定，并修正播放模式 / 音质的点击行为；§5.2.2 播放条与 §5.2.7 设置页补充音质共享偏好与空状态可用性；
- `CORE.html` §4.29 / §4.30 / §4.40 补充 `QUALITY_PREFERENCE_OPTIONS`、`qualityPreference`、`updateDefaultQuality`、`cycleQualityPreference` 与音质 revealer 行为；
- `EVOLVE.md` 新增 #15 统一 revealer 交互需求；
- `ABOUT.html` 播放行同步“点击循环、悬停展开”的交互描述。

验证：

- `test/player-store.test.ts` 新增音质偏好按固定顺序循环的用例；
- `npm run typecheck` 通过；
- `npx vitest run` 22 个测试文件 / 78 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §2 CONVENTIONS · Revealer 统一交互与样式 | 增 | 统一描述 revealer 的行为 / 呈现；按钮不带边框，弹层选项 hover 使用 `--subtle-bg`；悬停延迟不规定。 |
| `USER.html` | §2 播放模式切换 / §5.2.2 播放条 / §5.2.7 设置页 | 改 | 点击循环切换；音质包含自动档并与设置页共用偏好；空状态下音质仍可用。 |
| `CORE.html` | §4.29 `stores/player.ts` / §4.30 `stores/settings.ts` | 改 | 增加共享音质选项、`qualityPreference`、`updateDefaultQuality`、`cycleQualityPreference` 与固定顺序约定。 |
| `CORE.html` | §4.40 `PlayerBar.vue` | 改 | 播放模式与音质按钮点击循环；音质弹层只列其余档位；revealer 样式契约引用 USER §2。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | 音质按钮移除边框；音质选项 hover 改用 `--subtle-bg`，与模式选项一致。 |
| `EVOLVE.md` | #15 | 增 | 记录统一 revealer 交互需求与音量特例。 |
| `ABOUT.html` | §2 用户交互 · 播放行 | 改 | 描述点击循环、悬停展开与音质偏好共享。 |

### 4.34 清空播放队列按钮置顶并改为图标

问题描述：ISSUES 要求把播放队列的“清空队列”按钮移到面板顶部，并用图标代替文字。原实现在队列列表底部渲染 `.queue-footer` 与文字按钮，队列较长时需要滚动到底才能操作；按钮位于 `v-else` 的列表分支内，筛选结果为空时又完全不可见，入口不稳定。

解决方法：

- 把清空操作移到队列面板头部 `.lyrics-head` 的右侧操作区 `.lyrics-head-actions`，与“关闭播放队列”按钮并排，滚动或筛选都不影响入口；
- 按钮改为 `.icon-btn` + `AppIcon` 的 `trash` 图标，保留 `title` / `aria-label` 为“清空播放队列”，不再显示文字；
- 队列为空时按钮使用现有 `.icon-btn:disabled` 灰化并禁用，避免无意义点击；
- 删除列表底部的 `.queue-footer` 与文字按钮，并移除已无引用的 `.queue-footer` 样式；`player.clearQueue()` 的行为不变，仍只清空当前之后的队列；
- 新增 `.lyrics-head-actions` 作为头部按钮组，固定不收缩、水平排列并与标题区两端对齐。

验证：

- 源码核对：清空按钮位于 `.lyrics-head` 内、以 `trash` 图标渲染，队列为空时带 `disabled`；队列列表底部不再有按钮；
- `npm run typecheck` 通过；
- `npx vitest run` 22 个测试文件 / 78 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.23 `App.vue` | 改 | 播放队列的“清空队列”改为头部图标按钮，与关闭按钮同组；空队列时禁用；删除底部 `.queue-footer`。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | 增 `.lyrics-head-actions` 头部按钮组样式，删除无引用的 `.queue-footer`。 |
| `USER.html` | §5.2.9 播放队列 | 改 | 明确清空队列入口固定在面板顶部、使用垃圾桶图标，队列为空时不可用。 |
| `EVOLVE.md` | — | 不动 | 队列操作位置属于页面实现细节，由 CORE / USER 主责。 |

### 4.35 歌单详情恢复“从歌单删除”按钮与写后校验

> 后续修正：§4.39 已把写后读回 / 整单扫描移出写 API，删除链路改为 `playlist.removeSongs` 返回 `{ changed }` 后由 `stores/playlist-edit.ts` 的 `refreshAfterWrite` 统一刷新；本节关于“DelSonglist → 读回成员确认”的描述以 §4.39 为准，可编辑判定与乐观移除仍有效。

问题描述：ISSUES 指出从歌单删除歌曲的按钮和功能没有实现。排查后确认渲染层与 IPC 链路本身已存在，但 `PlaylistView` 只有在 `PlaylistMeta.editable && kind === 'normal'` 时才把 `removable` 传给 `SongTable`，而 `fetchPlaylistPage` 对所有普通歌单都硬编码 `editable: false`：

- `listMine()` 返回的“我的歌单”虽然带 `editable: true`，进入详情页后会被 `CgiGetDiss` 的 `fetchPlaylistPage` 结果覆盖成 `false`；
- 因此歌单详情永远不会渲染删除按钮，删除功能也不可达；
- 公开 / 搜索歌单也不应显示删除按钮，不能直接把普通歌单一律改成可编辑。

解决方法：

- `CgiGetDiss` 的 `dirinfo` 补充 `owndir`、`host_uin`、`creator.musicid` 字段；
- 新增 `canEdit(data)`：优先读取上游 `owndir === 1`；字段缺失或为 0 时，回退比较当前登录 `musicid` 与 `creator.musicid` / `host_uin`；未登录或无归属信息时返回 `false`；
- 普通歌单的 `editable` 改为 `canEdit(data)`，“我喜欢”仍为可编辑；公开 / 搜索歌单保持不可编辑；
- 详情页原有删除链路保持不变：确认框 → 本地乐观移除并更新计数 → `playlist.removeSongs` → `DelSonglist` → 由 §4.39 的统一刷新流程确认 → 失败回滚；
- 新增 `test/api/playlist-write.test.ts`，用 mock 上游校验删除请求携带数字 `songId` 与真实 `songType`、写接口返回 `{ changed }` 且不读回成员、非成员歌曲不发起写请求；
- 扩展 `test/api/playlist-cache.test.ts`，覆盖 `owndir` 判定、非本人歌单不可编辑与 `creator.musicid` 回退。

验证：

- 匿名实测公开歌单 `CgiGetDiss` 返回 `dirinfo.owndir = 0`，确认不能靠“普通歌单即可编辑”判断；
- 新增 / 扩展测试覆盖归属判定与 `removeSongs` 写入链路；
- `npm run typecheck` 通过；
- `npx vitest run` 23 个测试文件 / 81 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1 歌单详情行 / §4.3 `QqPlaylistDirinfo` | 改 | 增 `dirinfo.owndir`、`host_uin`、`creator.musicid`，并说明 `owndir === 1` 表示当前账号拥有该歌单。 |
| `CORE.html` | §4.12 `api/playlist.ts` | 改 | `fetchPlaylistPage` 的普通歌单 `editable` 改为 `owndir` 优先、创建者 ID 回退；未登录或非本人歌单为 `false`。 |
| `CORE.html` | §4.46 `PlaylistView.vue` | 改 | 说明删除入口只在普通且 `editable` 的歌单出现，并保留确认、乐观更新与失败回滚；写后刷新见 §4.39。 |
| `CORE.html` | §4.55 `api/playlist-write.ts` | 改 | 补 `removeSongs` 的归属前置校验由详情接口提供，删除时按数字 `songId` / `songType` 写 `DelSonglist`；写后刷新由 §4.39 统一流程负责。 |
| `USER.html` | §5.2.8 歌单详情 | 改 | 说明自己创建的歌单在歌曲操作列显示“从歌单删除”，公开歌单不显示；删除只影响歌单成员，不改变播放队列。 |
| `EVOLVE.md` | #14 | 不动 | 删除歌曲的交互与写后校验已由 CORE / USER 记录，本次仅修复可编辑判定。 |

### 4.36 添加到歌单写错 dirId / tid 导致 80092

> 后续修正：§4.39 已把 80092 的处理收敛为写 API 返回 `{ changed: false }`，写后读回与刷新由渲染层 `refreshAfterWrite` 负责；本节原“写后读回若已达成目标状态则视为成功”的结论已失效，`dirId` / `tid` 契约不变。

问题描述：测试“添加到歌单”时持续报 `UPSTREAM_CHANGED: 上游返回错误码 80092（music.musicasset.PlaylistDetailWrite.AddSonglist）`。排查确认不是简单重复添加，而是写接口的两个 ID 被混用：

- `PlaylistDetailWrite` 的 `dirId` 是当前账号下的歌单目录 ID，`tid` 才是歌单标识（disstid / 歌曲列表接口里的歌单 ID），两者不是同一个值；
- 原实现把 `PlaylistMeta.id` 同时当作 `dirId` 发送，并固定 `tid: 0`；`PlaylistMeta` 也没有保存详情返回的 `dirinfo.dirid`；
- 创建歌单时又把 `result.dirId` 当成 `id`，丢失了 `result.tid`，后续添加 / 删除 / 打开都拿不到正确的歌单标识；
- 改名 / 删除歌单也直接用 `PlaylistMeta.id` 当 `dirId`，同样会写错目录；
- `mapUpstreamCode` 对未知错误码没有保留 `upstreamCode`，导致 80092 这种业务状态无法在写后读回时被识别。

解决方法：

- `PlaylistMeta` 新增可选 `dirId`：`listMine` 从 `dirId / dirid` 读取，`CgiGetDiss` 从 `dirinfo.dirid` 读取，“我喜欢”固定为 201；
- 创建歌单改为 `id = result.tid`、`dirId = result.dirId`，两者都必须为正整数；
- `addSongs` / `removeSongs` 使用 `dirId: meta.dirId` 与 `tid: meta.id`，写请求参数收敛为 `{ dirId, tid, bFmtUtf8, v_songInfo }`，不再把歌单名当作写参数；
- 改名 / 删除歌单先读取详情拿到当前 `dirId`，再提交 `EditPlaylist` / `DelPlaylist`，不再用歌单标识冒充目录 ID；
- `mapUpstreamCode` 的未知错误统一携带原始 `upstreamCode`；`assertWrite` 同样保留 `retCode`；
- 80092 不再直接失败：写 API 视为 `{ changed: false }`，是否真正添加由 §4.39 的统一刷新流程确认；未变化时给出“歌曲可能已在歌单中 / 歌单状态已变化”的明确提示；
- 更新 `test/api/playlist-write.test.ts`：覆盖添加 / 删除携带 `dirId + tid`、创建返回 `id=tid`、改名 / 删除使用详情目录 ID、80092 视为未变化；扩展 `test/api/playlist-cache.test.ts` 校验详情返回的 `dirId`。

验证：

- 对照上游实现约定核对：`AddPlaylist` 返回的 `result.tid` 是歌单标识，`result.dirId` 是目录 ID；`PlaylistDetailWrite` 同时需要两者；80092 属于业务状态码，写 API 视为未变化，由统一刷新流程确认；
- `npm run typecheck` 通过；
- `npx vitest run` 23 个测试文件 / 85 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1 歌单写入行 / §4.3 歌单模型 | 改 | 明确 `dirId` 是当前账号目录 ID、`tid` 才是歌单标识；`AddPlaylist` 返回的 `result.dirId` / `result.tid` 分别对应两者；80092 属于业务状态码而非请求失败。 |
| `CORE.html` | §4.1 `types.ts` | 改 | `PlaylistMeta` 增加 `dirId?: number`，与 `id`（歌单标识）分开存储。 |
| `CORE.html` | §4.12 `api/playlist.ts` | 改 | `listMine` 与 `CgiGetDiss` 都要回填 `dirId`；创建歌单以 `result.tid` 作为 `id`、`result.dirId` 作为目录 ID。 |
| `CORE.html` | §4.55 `api/playlist-write.ts` | 改 | 增删歌曲按 `dirId + tid + bFmtUtf8 + v_songInfo` 写入；改名 / 删除先读取详情获取 `dirId`；80092 视为未变化，刷新由 §4.39 统一处理。 |
| `CORE.html` | §4.2 `ipc.ts` / `api/client.ts` | 改 | 未知上游错误需保留 `upstreamCode`，供写操作识别 80092 等业务状态。 |
| `USER.html` | §5.3 错误与通知 | 改 | 80092 在统一刷新确认未变化时提示歌曲可能已在歌单中或歌单状态已变化。 |
| `EVOLVE.md` | #14 | 不动 | 写接口细节由 CORE / PROVIDER 主责，本次仅修正参数契约。 |

### 4.37 原生删除确认替换为应用内确认框

问题描述：歌单删除仍使用 `window.confirm`，样式由操作系统决定，与应用主题和圆角面板不一致；原生弹窗还会阻塞渲染进程，且无法表达危险操作、补充说明和统一键盘行为。

解决方法：

- 新增 `components/ConfirmDialog.vue`：复用现有 `.dialog-backdrop` / `.dialog` 视觉，提供标题、说明、确认文案与危险态；说明支持换行；
- 打开时默认聚焦“取消”，`Esc`、点击遮罩或关闭按钮都取消，避免破坏性操作被回车误确认；
- 删除确认统一使用红色危险按钮，新增 `.btn.danger` 与 `.confirm-message` 样式；
- 替换渲染层全部 `window.confirm`：
  - 歌单详情删除歌曲；
  - 我的歌单删除歌单；
  - 下载中心删除任务、清空下载目录；
  - 设置页清空下载目录；
- 各页面只保存待确认对象 / 待执行动作，确认后再调用原有删除或清空逻辑，业务链路不变。

验证：

- `grep window.confirm src/renderer` 无结果；
- `npm run typecheck` 通过；
- `npx vitest run` 24 个测试文件 / 87 个用例通过；
- `npm run build` 通过，产物包含独立 `ConfirmDialog` 分包。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §1 文件树 / §4.36 附近 | 增 | 新增 `components/ConfirmDialog.vue`。 |
| `CORE.html` | §4.39 `SongTable.vue` / §4.46 `PlaylistView.vue` / §4.48 `SettingsView.vue` / §4.67 `DownloadsView.vue` / §4.68 `LibraryView.vue` | 改 | 删除 / 清空确认统一使用应用内 `ConfirmDialog`，不再调用 `window.confirm`。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | 增 `.btn.danger`、`.confirm-dialog`、`.confirm-message` 样式。 |
| `USER.html` | §5.2.8 歌单详情 / §5.2.7 设置页 / §5.2.8 下载中心 | 改 | 确认框为应用内圆角面板，危险操作使用红色确认按钮，Esc / 点击遮罩取消。 |
| `EVOLVE.md` | — | 增 | 补“不调用原生 `window.confirm`，统一使用应用内确认框”的约束。 |

### 4.38 添加到歌单链路耗时分析与优化

> 后续修正：§4.39 已把写后读回 / 整单扫描移出写 API，改为渲染层触发统一的歌单刷新流程。本节保留原问题分析、实测耗时与优化背景，最终职责划分以 §4.39 为准。

问题描述：添加到歌单从点击目标歌单到出现“已添加到歌单”等待时间很长。按代码链路排查，主要耗时来自写前后的整单成员扫描和重复元数据请求，而不是写入本身。

原链路与请求数（添加 1 首，歌单 N 首）：

1. 渲染层 `PlaylistPicker.isDuplicate` 读取整单缓存（本地 IPC，通常 1–10ms）；
2. 主进程 `addSongs`：
   - `readMemberMids` 预先扫描整单，`ceil(N / 50)` 次 `CgiGetDiss`；
   - `readMeta` 再请求第 0 页，1 次 `CgiGetDiss`；
   - `fetchTrackIdentities` 逐首请求歌曲详情，1 次 `get_song_detail_yqq`；
   - `AddSonglist` 写入，1 次；
   - 写后 `readMemberMids` 再扫描整单，`ceil(N / 50)` 次；
   - 最后 `readMeta` 再请求第 0 页，1 次；
3. 合计 `2 × ceil(N / 50) + 4` 次上游请求，耗时随歌单长度线性增长。

实测匿名上游 RTT（本机网络、5 次中位数）：

| 请求 | 中位耗时 |
|---|---|
| `CgiGetDiss` 单页 | 294ms |
| 单曲 `get_song_detail_yqq` | 338ms |
| 批量 `CgiGetTrackInfo` | 97ms |
| `PlaylistDetailWrite` | 87ms（匿名被拒，仅测到网络往返） |

按上述 RTT 估算添加 1 首：

| 歌单规模 | 原请求数 | 原估算耗时 | 优化后请求数 | 优化后估算 |
|---|---|---|---|---|
| 50 首 | 6 | ≈1.6s | 4 | ≈0.8s |
| 500 首 | 24 | ≈6.9s | 4 | ≈0.8s |
| 1000 首 | 44 | ≈12.8s | 4 | ≈0.8s |

实际认证写入可能比匿名的 87ms 更慢，且限流令牌不足时会排队；但主要增长项是整单扫描。

解决方法：

- 删除写入前的整单成员预扫描；重复歌曲由上游 80092 + 写后读回判断，不再为了去重先扫全单；
- 元数据只读一次，拿到 `dirId`、`tid` 与旧总数；
- 歌曲身份改为批量详情 `CgiGetTrackInfo`（按 `SONG_DETAIL_BATCH` 分块，缺失歌曲再单曲兜底）；
- 写后只读取“旧总数之后”的尾部页确认新歌，通常 1 次请求；只有尾部找不到或遇到 80092 时才回退完整扫描；
- 添加成功后直接使用尾部页返回的最新 `PlaylistMeta`，不再额外请求一次 `readMeta`；
- 删除歌曲同样去掉写前整单扫描，写后完整扫描一次并复用最后一页的元数据，避免“扫描 → 单页 → 写入 → 扫描 → 单页”的重复路径。

优化后添加 1 首的请求链：

1. `readMeta` 1 次 `CgiGetDiss`；
2. 批量歌曲身份 1 次 `CgiGetTrackInfo`；
3. `AddSonglist` 1 次；
4. 尾部读回 1 次 `CgiGetDiss`。

正常追加场景与歌单长度无关，约 4 次请求；只有重复添加或上游未按尾部追加时才回退完整扫描。

验证：

- 匿名实测各接口 RTT，确认耗时主要来自整单扫描而非写入；
- `npm run typecheck` 通过；
- `npx vitest run` 24 个测试文件 / 87 个用例通过（含批量身份、尾部读回与 80092 读回判定）；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.55 `api/playlist-write.ts` | 改 | 增删歌曲不再写前全量扫描；添加用批量详情 + 尾部读回，重复 / 异常才回退完整扫描；删除写后扫描一次并复用末页元数据。 |
| `CORE.html` | §4.11 `api/song.ts` | 改 | 歌曲身份统一走批量详情 `CgiGetTrackInfo`，按 50 首分块，缺失再单曲兜底。 |
| `PROVIDER.html` | §4.1 歌单增删歌曲行 | 改 | 说明 `AddSonglist` 通常追加到末尾；写后读回可只查尾部页，重复 / 异常时再全量扫描；80092 不能单独作为失败依据。 |
| `USER.html` | §5.2.8 歌单详情 | 改 | 添加到歌单正常应在约 1 秒内完成，且不随歌单长度明显变慢；重复添加直接提示“已在歌单中”。 |
| `EVOLVE.md` | #14 | 改 | 补“歌单写入确认不得每次全量扫描，优先尾页读回”的性能约束。 |

### 4.39 纠正：写后刷新应复用歌单刷新流程

问题描述：§4.38 把“写后读回 / 整单扫描”定义在 `api/playlist-write.ts` 内部，误解了职责边界。添加 / 删除写接口只应负责写入，写后歌单内容与计数的确认必须触发现有歌单刷新流程，由同一份代码统一处理；否则每个写操作都会重复实现一套“扫描 + 校验”，既慢又容易与轮询 / 缓存逻辑漂移。

解决方法：

- `api/playlist-write.ts` 的 `addSongs` / `removeSongs` 只负责写入：
  - 读取一次歌单元数据拿到 `dirId` / `tid`；
  - 批量取歌曲身份并提交 `AddSonglist` / `DelSonglist`；
  - 成功返回 `{ changed: true }`，`80092` 视为“状态未变化”返回 `{ changed: false }`；
  - 删除 `readMembers`、尾部读回、整单扫描与写后元数据读取，不再在写 API 内定义刷新逻辑；
- 新增共享类型 `PlaylistMutationResult`，IPC 的 `playlist.addSongs` / `playlist.removeSongs` 返回 `{ changed }`；
- 渲染层在 `stores/playlist-edit.ts` 统一处理写后刷新：
  - 新增 `refreshAfterWrite(id)`：`playlist.invalidate(id)` 后立即 `playlist.poll(id)`；
  - `addSongs` / `removeSongs` 共用该函数，不再各自实现刷新；
  - 当前打开该歌单时 `poll` 会走已有的 `load(force)` 分页加载流程；未打开时只失效缓存，下次进入重新加载；
- `PlaylistPicker` 改为调用 `playlistEdit.addSongs`，由 store 统一提示与刷新；移除播放选择器里基于返回 `songCount` 的重复判断；
- `PlaylistView` 删除歌曲后不再额外提示，避免与 store 提示重复；乐观移除仍保留，统一刷新负责最终对齐；
- `createAndAdd` 也复用同一个 `addSongs` 入口。

验证：

- 源码核对：`api/playlist-write.ts` 不再包含 `readMembers` / 整单扫描；`playlist-edit.ts` 的添加与删除共用 `refreshAfterWrite`；
- `npm run typecheck` 通过；
- `npx vitest run` 24 个测试文件 / 87 个用例通过（`playlist-write` 用例改为校验只写入与 `{ changed }` 结果）；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.55 `api/playlist-write.ts` | 改 | 明确写接口只负责写入并返回 `PlaylistMutationResult`；不得在写 API 内做写后读回或整单扫描。 |
| `CORE.html` | §4.31 `stores/playlist-edit.ts` | 改 | `addSongs` / `removeSongs` 写后统一调用 `refreshAfterWrite(id)`：`invalidate(id)` + `poll(id)`；当前页走已有分页加载，未打开只失效缓存。 |
| `CORE.html` | §4.2 `ipc.ts` / §4.1 `types.ts` | 改 | `playlist.addSongs` / `playlist.removeSongs` 返回 `PlaylistMutationResult { changed }`。 |
| `CORE.html` | §4.65 `composables/availability.ts` 附近 / §4.61 `stores/playlist.ts` | 改 | 说明写后刷新复用 `invalidate` + `poll`，不要在写操作内重复实现刷新或校验。 |
| `USER.html` | §5.2.8 歌单详情 | 改 | 添加 / 删除后歌单内容与计数由统一刷新流程更新；重复添加提示“已在歌单中”，未变化删除提示“歌曲不在歌单中”。 |
| `EVOLVE.md` | #14 | 改 | 补“歌单写后刷新必须复用既有歌单刷新流程，不得在写接口内单独实现扫描 / 读回”的约束。 |

### 4.40 评论区取消正文截断并修复分页游标

> 后续修正：§4.41 已删除“最旧”排序与 `CommentSort`，本节“最旧排序继续在合并结果上本地重排”的结论失效；游标分页、`SeqNo` 精度、正文不截断与按 id 去重仍然有效。

问题描述：ISSUES 指出两条评论问题：

- 太长的评论会被省略号截断；
- 评论区加载更多不起作用。

排查结论：

- 截断来自 `styles/main.css` 后段 v2 覆盖规则：`.comment-text` 使用 `display: -webkit-box` + `-webkit-line-clamp: 2` + `overflow: hidden`，所有正文被强制限制为两行；
- 加载更多来自分页参数误解：`getComments` 一直把 `PageNum` 当作页码传给 `GetNewCommentList`，但匿名实测 `PageNum = 0 / 1 / 2 / 3` 返回完全相同的第一页；
- 上游真正的分页方式是 `LastCommentSeqNo` 游标，传入上一页最后一条评论的 `SeqNo` 才会返回下一页；
- 评论 `SeqNo` 是 19 位整数，超过 `Number.MAX_SAFE_INTEGER`。普通 `JSON.parse` 会丢精度，游标一旦被四舍五入，可能重复返回上一页最后一条评论或产生重叠；
- 上游单页会包含正文为空的记录，现有过滤逻辑会丢掉这些评论，因此下一页游标必须取原始最后一条评论的 `SeqNo`，不能取过滤后的最后一条。

解决方法：

- 删除 `.comment-text` 的两行 clamp，评论正文完整展示，仍保留自动换行与 `pre-wrap`；
- 评论分页改为游标：
  - `CommentPage` 新增可选 `nextCursor`；
  - `comment.get` 的 IPC 第三参数由 `pageNo` 改为 `cursor`；
  - `getComments(songId, sort, cursor)` 将游标传入 `LastCommentSeqNo`，`PageNum` 固定 0；
  - `hasMore` 同时要求上游 `HasMore` 为真且 `nextCursor` 为非空数字；
  - `CommentsPanel` 用 `cursor` 状态替代 `pageNo`，滚动到底时携带当前游标加载下一页；
- 防止 `SeqNo` 精度丢失：
  - `UpstreamRequest` / `MusicuOptions` 新增可选 `stringFields`；
  - `upstreamRequest` 在 `JSON.parse` 前把指定字段的裸数字字面量改成字符串；
  - 评论请求传入 `stringFields: ['SeqNo']`，`nextCursor` 始终为精确字符串；
- 加载更多仍使用现有滚动到底触发，不新增按钮；追加后按评论 `id` 去重；最旧排序及其重排已由 §4.41 删除。

验证：

- 匿名实测同一歌曲（`BizId=97773`）：
  - `PageNum = 0 / 1 / 2 / 3` 均返回相同第一页；
  - `LastCommentSeqNo = 上一页最后一条 SeqNo` 返回下一页；
  - 游标偏移 +1 会重复返回上一条，说明必须使用精确 `SeqNo`；
- 新增回放测试：大整数 `SeqNo` 按字符串保留、第一页 `nextCursor` 正确、第二页请求携带 `LastCommentSeqNo`、`PageNum` 固定 0、`hasMore` 正确结束；
- `npm run typecheck` 通过；
- `npx vitest run` 24 个测试文件 / 88 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1 歌曲评论行 / §4.3 `QqCommentList` | 改 | 增 `SeqNo` 字段；注明 `PageNum` 不生效，分页必须使用最后一条评论的 `SeqNo` 作为 `LastCommentSeqNo`，且 `SeqNo` 需按字符串保留精度。 |
| `CORE.html` | §4.1 `types.ts` / §4.2 `ipc.ts` | 改 | `CommentPage` 增 `nextCursor`；`comment.get` 第三参数改为 `cursor`。 |
| `CORE.html` | §4.15 `api/comment.ts` | 改 | `getComments` 使用 `LastCommentSeqNo` 游标，`PageNum` 固定 0；`hasMore` 需游标非空；`SeqNo` 通过 `stringFields` 保留精度。 |
| `CORE.html` | §4.42 `CommentsPanel.vue` | 改 | 删除 `pageNo`，改用 `nextCursor`；滚动到底携带游标加载下一页；正文不截断。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | 删除 `.comment-text` 的 `-webkit-line-clamp` 与 `overflow: hidden`，正文完整展示。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 评论正文完整展示、不截断；滚动到底加载更多。 |
| `EVOLVE.md` | #5 | 改 | 补“长评论完整展示”与“使用 `LastCommentSeqNo` 游标分页”的要求。 |

### 4.41 取消最旧排序，改为评论区跳转顶部 / 底部

> 后续修正：§4.42 实测单页上限为 25 条，并把 `COMMENT_LOAD_ALL_PAGE_MAX` 从 50 调整为 40；本节记录的是调整前的 20 条/页、最多 50 页，最终数值以 §4.42 与代码为准（25 × 40 ≈ 1000 条）。

问题描述：按要求完全取消“最旧”排序，不再保留旧版评论接口与 `nextPage` 分页；评论区顶部只显示“评论”两个字。同时在右下角增加智能出现的独立圆形“跳转到顶部 / 跳转到底部”按钮，使用指向底线的箭头图标。点击“跳转到底部”时先一次性补拉全部剩余评论，再直接滚动到底部。顶部区域下方的分隔线去掉。

解决方法：

- 删除最旧排序：
  - `CommentSort`、`nextPage`、`pageNo` 与旧版 `fcg_global_comment_h5.fcg` 请求全部移除；
  - `comment.get` 只保留 `(songId, cursor?)`，继续使用 `LastCommentSeqNo` 游标；
  - 工具栏删除“最新 / 最旧”切换，左侧替换为“评论”文本；
- 新增跳转按钮：
  - 在 `AppIcon` 增加 `to-top` / `to-bottom` 两个“箭头指向底线”的图标；
  - 评论区右下角绝对定位两个独立圆形按钮，按滚动位置智能显示：
    - `scrollTop > 120` 显示“跳转到顶部”；
    - 还有下一页或未滚到底部时显示“跳转到底部”；
  - 两个按钮分别执行平滑回顶、直接拉到底部；
- “跳转到底部”补拉逻辑：
  - 若仍有 `hasMore`，按 `loadMore()` 串行分页，直到没有下一页或达到当时 `COMMENT_LOAD_ALL_PAGE_MAX = 50` 页（20 × 50 = 1000 条；§4.42 后为 25 条/页、40 页）；
  - 串行请求天然受全局限速约束，避免并发轰炸上游；
  - 达到页数上限时提示“评论较多，已加载前 N 条”，避免热门歌曲无限拉取；
  - 使用现有 `token` 作为取消标记：关闭歌词 / 评论弹出层（组件卸载）、切歌或刷新时立即让循环失效，不再发起后续页请求；
  - 补拉完成后滚动到底部；按钮在补拉期间显示 spinner 并禁用；
- 样式：
  - `.comments-toolbar` 删除 `border-bottom`，去掉顶部区域下方分隔线；
  - `.comments-title` 提供“评论”文本样式；
  - `.comments-jump` / `.comments-jump-btn` 提供右下角圆形按钮、阴影与禁用态；
  - `.comments-scroll` 底部 padding 增加到 72px，避免最后一条评论被按钮遮挡。

验证：

- 源码核对：评论区已无“最旧”分支与旧版评论接口；跳转循环在 `token` 变化后停止；
- `npm run typecheck` 通过；
- `npx vitest run` 24 个测试文件 / 88 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.1 `types.ts` / §4.2 `ipc.ts` | 改 | 删除 `CommentSort` / `nextPage` / `pageNo`；`comment.get(songId, cursor?)` 只保留最新评论游标。 |
| `CORE.html` | §4.15 `api/comment.ts` | 改 | 删除最旧排序与旧版评论接口，只保留 `GetNewCommentList` + `LastCommentSeqNo`。 |
| `CORE.html` | §4.42 `CommentsPanel.vue` | 改 | 工具栏改为“评论”；增加右下角跳转顶部 / 底部圆形按钮；跳转底部串行补拉剩余评论，最多 40 页（§4.42 后；本节当时为 50 页），卸载 / 切歌 / 刷新时取消。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | 删除 `.comments-toolbar` 下边框；增加 `.comments-title`、`.comments-jump`、`.comments-jump-btn`；调整 `.comments-scroll` 底部 padding。 |
| `CORE.html` | §4.50 `shared/constants.ts` | 改 | §4.42 将 `COMMENT_LOAD_ALL_PAGE_MAX` 调整为 40（本节当时为 50）。 |
| `PROVIDER.html` | §4.3 `QqCommentList` | 改 | 删除最旧排序 / 旧版接口说明，只保留最新评论游标分页。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 删除最新 / 最旧排序，改为“评论”标题；增加右下角跳转顶部 / 底部按钮与跳转底部的补拉行为。 |
| `EVOLVE.md` | #5 | 改 | 删除最旧排序要求；补跳转顶部 / 底部交互、补拉上限与取消约束。 |

### 4.42 评论单次拉取上限实测与批量参数调整

问题描述：跳转到底部需要大量补拉评论，原实现每页 20 条、最多 50 页，会发出 50 次上游请求，在 4 req/s 全局限速下明显卡顿。需要确定单次请求能否直接拉 500 条。

实测结论（匿名 `GetNewCommentList`，歌曲 `97773`）：

| `PageSize` | 上游结果 |
|---:|---|
| 20 | 正常返回 20 条 |
| 24 | 正常返回 24 条 |
| 25 | 正常返回 25 条 |
| 26 / 30 / 40 / 50 / 100 / 200 / 300 / 500 / 1000 | `req_0.code = 10000`，评论 0 条 |

旧版 `fcg_global_comment_h5.fcg` 的 `pagesize > 25` 虽然返回 `code=0`，但实际只给 10 条，属于不可靠的静默截断，不能用于批量读取。

因此单次上限确定是 **25 条**，无法做到 500 条/页。

解决方法：

- `COMMENT_PAGE_SIZE` 从 20 调整为上游实测上限 **25**；
- `COMMENT_LOAD_ALL_PAGE_MAX` 从 50 调整为 **40**，保持“跳转到底部”最多约 1000 条；
- 批量补拉请求数从 50 次降为 40 次（减少 20%），但仍保持串行请求，不绕过全局令牌桶；
- 跳转底部的取消机制、spinner、达到上限提示不变；
- 单页变大后普通滚动分页也同步为 25 条/页。

验证：

- 匿名实测 25 成功、26 起返回业务码 10000，500 条/页不可用；
- 新增测试断言评论请求 `PageSize = 25`；
- `npm run typecheck` 通过；
- `npx vitest run` 24 个测试文件 / 88 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1 歌曲评论行 / §4.3 `QqCommentList` | 改 | 明确 `PageSize` 实测上限 25，26 起返回业务码 10000；不要尝试 500 条/页。 |
| `CORE.html` | §4.50 `shared/constants.ts` | 改 | `COMMENT_PAGE_SIZE = 25`；`COMMENT_LOAD_ALL_PAGE_MAX = 40`（约 1000 条）。 |
| `CORE.html` | §4.42 `CommentsPanel.vue` | 改 | 跳转底部最多 40 页、约 1000 条；保持串行请求与取消机制。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 评论单页 25 条；跳转底部最多约 1000 条。 |
| `EVOLVE.md` | #5 | 改 | 补评论单页上限 25 与跳转底部 40 页的约束。 |

### 4.43 歌词页拖拽滚动滞后于指针

问题描述：ISSUES 指出歌词页上下拖动手感不对、不跟手。`LyricsPanel.vue` 在 `pointermove` 中直接写 `listRef.value.scrollTop`，但 `.lyrics-list` 同时设置了 `scroll-behavior: smooth`。按 CSSOM 语义，写 `scrollTop` 会使用元素自身的 `scroll-behavior`，浏览器会把每次赋值变成一段平滑滚动；指针已经移动，列表还在追赶动画，快速拖动时尤其明显。另一个冲突来源是 `activeIndex` 的自动回中也走平滑滚动：按下之后、越过 6px 拖拽阈值之前 `dragging` 仍为 `false`，此时歌词推进仍会触发 `centerActive()`，与用户手势抢滚动位置。

解决方法：
- `.lyrics-list` 的 `scroll-behavior` 改为 `auto`，拖拽写 `scrollTop` 立即生效、与指针位移 1:1；自动回中仍由 `scrollIntoView({ block: 'center', behavior: 'smooth' })` 显式平滑，不依赖容器默认值；
- `onPointerDown` 忽略 `pointerType === 'touch'`，触屏交给原生滚动与惯性，避免原生滚动和自定义 `scrollTop` 叠加造成双倍位移；鼠标 / 触控笔仍走自定义拖拽；
- `activeIndex` 监听在 `pressing` 期间也跳过自动回中（原先只判断 `dragging`），避免按住但尚未越过阈值时被回中动画抢走位置；
- 保留 6px 拖拽阈值与“越过阈值后才 `setPointerCapture`”，继续保证未拖拽时原生 click 能触发歌词跳转。

验证：
- `npm run typecheck` 通过；
- `npx vitest run` 24 个测试文件 / 88 个用例通过；
- `npm run build` 通过；
- 未在图形界面中实拖验证；修改点依据 CSSOM `scroll-behavior` 语义与指针事件顺序确认。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.41 `LyricsPanel.vue` | 改 | 说明拖拽写 `scrollTop` 必须即时生效；触屏不进入自定义拖拽；`pressing` 期间不自动回中。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | `.lyrics-list` 的 `scroll-behavior` 为 `auto`；平滑只用于 `scrollIntoView` 自动回中。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 明确鼠标拖拽与指针 1:1 跟手；触屏使用原生惯性滚动；点击定位与拖拽互不误触。 |
| `EVOLVE.md` | #5 | 改 | 在歌词交互中补充“拖拽即时跟手、触屏走原生滚动”的约束。 |

### 4.44 专辑简介支持展开 / 收起并抽取共用简介组件

问题描述：ISSUES 要求专辑页也提供简介展开 / 收起。歌手页在 §4.22 已实现“折叠 4 行、按实际高度判断溢出、仅溢出时显示展开 / 收起”，但专辑页仍直接渲染完整 `.catalog-desc`，简介较长时会把歌曲列表推到首屏之外。两页的测量、溢出判断与展开状态完全一致，复制一份逻辑会形成两份需要同步维护的实现。

解决方法：
- 新增 `components/CatalogDescription.vue`，把 §4.22 的折叠逻辑收敛为组件：接收 `text` prop，内部维护 `expanded` / `overflow`；
- 折叠态使用 `.catalog-desc.clamped` 的 4 行 `-webkit-line-clamp`，用 `scrollHeight > clientHeight + 1` 判断是否溢出；只有溢出时才渲染“展开 / 收起”按钮，并同步 `aria-expanded`；
- `ResizeObserver` 监听段落尺寸，窗口变宽、字体或换行变化时重新判断；`text` 变化时重置为折叠并重新测量；
- `ArtistView.vue` 删除原有的 `descRef` / `descExpanded` / `descOverflow` / `measureDesc()` / `toggleDesc()` / 两个 watcher 与卸载清理，改为渲染 `<CatalogDescription :text="detail.description" />`；
- `AlbumView.vue` 的简介段落同样改用该组件；页面仍在 `detail.description` 非空时才渲染组件，短简介不会出现切换按钮。

验证：
- 复用歌手页已验证的 4 行折叠与按实际高度判断溢出逻辑，专辑与歌手共用同一实现；
- `npm run typecheck` 通过；
- `npx vitest run` 24 个测试文件 / 88 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §1 File tree | 增 | 新增 `components/CatalogDescription.vue`，并链接到签名小节。 |
| `CORE.html` | §4 内部类型与方法签名 | 增 | 新增 `CatalogDescription.vue` 小节：`text` prop；内部 `measure()` / `toggle()`、溢出判断与 `ResizeObserver` 生命周期。 |
| `CORE.html` | §4.73 `ArtistView.vue` / §4.74 `AlbumView.vue` | 改 | 简介折叠逻辑移入 `CatalogDescription`；两个页面只在描述非空时渲染该组件。 |
| `USER.html` | §5.2.8 页面表 · 专辑页行 | 改 | 专辑简介超过 4 行时折叠并显示“展开”，展开后可“收起”；短简介不显示切换按钮。 |
| `EVOLVE.md` | #4 歌手 / 专辑详情 | 改 | 补专辑简介与歌手简介一致的折叠、展开 / 收起要求。 |

### 4.45 歌单改为后台整份刷新、原子替换与本地浏览

问题描述：ISSUES 要求重做歌单刷新：后台异步分页拉完整份歌单并校验，完整才一次性替换当前内容；任一分页失败保持旧内容并进入 5 分钟 timeout 后重试；离开页面终止拉取 / timeout；打开页面立即拉取；浏览分页改为纯本地；同时测试拉取上限、减少 API 调用。旧实现先拉第 0 页，再在后台逐页 `loadPage` 并把每页直接追加进 `feed`，因此浏览期间内容会持续增长、失败时留下半份内容、每页都写缓存，也没有 5 分钟重试；离开页面只能靠 `generation` 忽略结果，无法中止主进程请求。

上游实测（匿名 `CgiGetDiss`，固定 offset）：

| 歌单 | 请求 `song_num` | 返回条数 | 响应 `songnum` |
|---|---:|---:|---:|
| 7039749142（99 首） | 50 / 1000 / 5000 | 50 / 99 / 99 | 99 / 99 / 99 |
| 9744256455（1269 首） | 1000 / 1500 / 2000 | 1000 / 1269 / 1269 | 1269 / 1269 / 1269 |
| 8707546376（10000 首） | 1000 / 2000 / 5000 / 10000 | 999 / 1995 / 4991 / 9983 | 9999 / 9995 / 9991 / 9983 |

- 单次请求至少可返回约 1 万首，不存在评论接口那种 25 条硬上限；
- 大歌单会静默省略部分不可用曲目：按固定 offset 2000 拉 5 页，合计 9983 首且无重复，而上游总量约 9995–10000；
- 若按“已返回条数”递增 offset（0 → 1995 → 3992 → …），最后一页会与前面重叠，不能这样分页；
- 因此采用固定 offset 2000、最多 10 页（约 2 万首），并允许 2% / 至少 10 首的缺失容差。

解决方法：

- `shared/constants.ts`：新增 `PLAYLIST_FETCH_PAGE_SIZE = 2000`、`PLAYLIST_FETCH_PAGE_MAX = 10`、`PLAYLIST_REFRESH_RETRY_MS = 5 * 60_000`、`PLAYLIST_FETCH_MISSING_RATIO = 0.02` / `PLAYLIST_FETCH_MISSING_MIN = 10`；删除只服务旧逐页补全的 `PLAYLIST_PAGE_RETRY_*`；`PLAYLIST_PAGE_SIZE = 50` 保留给最近歌单校验 / 轮询首页。
- `api/playlist.ts`：新增 `fetchPlaylistSnapshot(id, signal)`：
  - 固定 `song_begin = 0, 2000, 4000, …` 逐页拉取，直到覆盖上游 `songnum` 或达到页数上限；
  - 任一页抛错、offset 小于 total 时返回空页、或最终条数低于容差，都整次失败；跨页重复 mid 直接去重，避免重叠页写进快照；
  - 成功后返回 `sourceTotal`（上游总数）与 `total = songs.length`（实际可展示条数），并把 `meta.songCount` 对齐到实际条数；
  - `requestPage` 增加 `pageSize` 与 `AbortSignal`，`musicu` / `upstreamRequest` 把调用方 signal 透传到 `fetch`，取消时立即中止当前网络请求。
- `main/ipc.ts`：新增 `playlist.getSnapshot(id, token)` / `playlist.cancelSnapshot(id, token)`；主进程按歌单 ID 保存 `{ token, AbortController }`，只允许匹配 token 的取消操作中止对应请求；新请求会先中止同歌单的旧请求。
- `preload` / `shared/ipc.ts` / `shared/types.ts`：暴露两个新方法；`PlaylistSnapshot` 增加可选 `sourceTotal`。
- `stores/playlist.ts` 重写刷新链路：
  - `load(id)` 进入页面时先读缓存并立即触发一次后台完整刷新；同一时刻只允许一个进行中的刷新；
  - 只有 `getSnapshot` 成功才调用 `replaceFeed` 一次性替换 `songs` / `total` / `meta`；旧内容在刷新失败时原样保留，完整缓存标记 `stale`，不完整缓存标记为中断；
  - 失败后安排 `PLAYLIST_REFRESH_RETRY_MS` 定时重试；手动重试、下一次打开或轮询触发刷新时清除旧 timer；
  - `stop(id)` 在离开页面时清除 timer、递增刷新序号并调用 `cancelSnapshot`，未完成的快照不会替换内容也不会写缓存；
  - 只在完整快照成功后写整份缓存；删除逐页 `loadPage` / `complete` / 部分快照落盘 / 旧重试退避；
  - 浏览不再发起分页请求，`feed.songs` 即完整本地列表；
  - `poll(id)` 仍用第 0 页轻量比较名称、封面、首屏顺序与总量（带容差），变化或 `stale` 时才触发一次完整刷新。
- `views/PlaylistView.vue`：切换歌单或卸载时调用 `playlist.stop()`；轮询、重试、筛选仍复用原有入口。

验证：

- 上游实测见上表：单请求可拉 1 万首；固定 offset 0/2000/4000/6000/8000 五个有效分页合计 9983 首且无重复；
- 新增 `fetchPlaylistSnapshot` 用例：2500 首分两页、100 首单请求、少量缺歌通过、静默截断拒绝、中间空页拒绝、已取消 signal 不再发请求；
- 新增歌单 store 用例：完整快照单次替换并只写完整缓存、失败保持旧内容、5 分钟后自动重试、缓存回退、重复打开重新拉取、离开页面取消、轮询变化原子替换；
- `npm run typecheck` 通过；
- `npx vitest run` 24 个测试文件 / 97 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1 歌单详情行 / §4.3 `QqPlaylist*` | 改 | 记录 `CgiGetDiss` 的 `song_num` 单次可返回约 1 万首；大歌单会静默省略不可用曲目；分页必须用固定 `song_begin` 递增，不能按返回条数累加。 |
| `CORE.html` | §4.12 `api/playlist.ts` | 改 | 新增 `fetchPlaylistSnapshot`：2000 首/页、固定 offset、最多 10 页、空页 / 截断 / 重复校验、`sourceTotal` 与 `AbortSignal`。 |
| `CORE.html` | §4.5 `main/ipc.ts` | 改 | 新增 `playlist.getSnapshot` / `cancelSnapshot`；按歌单 ID + token 管理 `AbortController`，只取消匹配请求。 |
| `CORE.html` | §4.50 `shared/constants.ts` | 改 | 更新歌单常量：`PLAYLIST_FETCH_PAGE_SIZE = 2000`、`PLAYLIST_FETCH_PAGE_MAX = 10`、`PLAYLIST_REFRESH_RETRY_MS = 5 分钟`、缺失容差 2% / 10 首；删除 `PLAYLIST_PAGE_RETRY_*`。 |
| `CORE.html` | §4.61 `stores/playlist.ts` | 改 | 改为后台整份刷新 + 原子替换 + 失败 5 分钟重试；`stop` 取消；浏览纯本地；仅完整快照写缓存；轮询变化再整份刷新。 |
| `CORE.html` | §4.46 `PlaylistView.vue` | 改 | 切换歌单与卸载时调用 `playlist.stop(id)`，终止进行中的完整刷新与重试 timer。 |
| `USER.html` | §5.2.8 页面表 · 歌单详情行 | 改 | 打开时立即后台刷新，完整后一次性更新；失败保留当前内容并 5 分钟后自动重试；滚动 / 筛选不再触发上游分页。 |
| `EVOLVE.md` | #5 歌单 / #14 接口 | 改 | 补“整份快照原子替换、失败 5 分钟重试、离开页面取消、浏览纯本地、大页拉取与固定 offset”的约束。 |

### 4.46 歌单缓存优先、静默刷新、已下载计数与快速跳转

问题描述：ISSUES 要求改进歌单缓存：打开页面即加载缓存，后台更新不再对用户可见，失败不提示；所有歌单按 ID 持久缓存，发现歌单不存在时清理缓存；把歌曲标题右侧的“668 / 668 首”改为提示已下载数量；并像评论页一样增加快速到达顶部 / 底部的按钮。

排查发现：
- §4.45 已经做到先读缓存、完整快照成功后才替换，缓存失败时保留旧内容且不弹 toast；但“歌单不存在”在上游不是错误码：`req_0.code` 仍为 0，实际是顶层 `data.code = -100006`、`dirinfo` 为空壳。原 `dataErrorCode` 只看 `data.retcode`，会把失效歌单当成空歌单并覆盖内容 / 写入缓存。
- 缓存本身已按 `账号 scope + 歌单 ID` 存成 JSON，但没有任何删除入口在地歌单失效时清理文件。
- 歌曲区标题仍是“已载入 / 总数”，与下载状态无关。
- 歌单页没有评论页那套滚动位置按钮。

解决方法：

- `api/client.ts`：`dataErrorCode` 同时读取顶层负数码 `data.code`，并在 `req_0.code` 为 0 / 1000 时优先采用；新增 `-100006` 映射为 `NO_PERMISSION`（歌单不存在或已失效）。
- `api/playlist.ts`：`fetchPlaylistSnapshot` 与轻量 `fetchPlaylistPage` 捕获 `NO_PERMISSION` 后调用 `invalidatePlaylistCache(id)`，确保已删除 / 无权限歌单的持久缓存被清理；最近歌单校验也走轻量页接口，因此会同步清掉缓存。
- 歌单 store 保持 §4.45 的缓存优先与静默刷新：有缓存时先展示缓存，后台整份拉取成功才替换；失败保留当前内容、标记 stale、不弹提示，并继续 5 分钟自动重试。
- `PlaylistView.vue`：
  - 歌曲区标题改为“已下载 X / Y 首”，X 由 `downloadedQuality` 统计，不把播放缓存算作已下载；筛选时额外显示“筛选 N ·”；
  - 增加 `pageRef`、`scrollRoot = .main`、`ResizeObserver` 与滚动监听，按 `scrollTop > 120` / 未到底部显示顶部 / 底部按钮；点击用 `scrollTo({ behavior: 'smooth' })`；
  - 页面卸载时移除监听与 observer，并继续调用 `playlist.stop()` 终止后台刷新。
- `styles/main.css`：评论跳转按钮样式扩展为 `.comments-jump-btn, .page-jump-btn` 共用；新增固定定位的 `.page-jump`，底部避开播放条。

验证：

- 实测失效歌单 `999999999` 的响应：`req_0.code=0`、`data.code=-100006`、`dirinfo` 为空壳、`songlist=[]`；新逻辑映射为 `NO_PERMISSION` 并清理缓存；
- 新增 `api/client` 用例：顶层 `data.code=-100006` 不再被当作成功空结果；
- 新增 `api/playlist` 用例：完整快照与轻量分页遇到 `NO_PERMISSION` 都会调用 `invalidatePlaylistCache`；
- `npm run typecheck` 通过；
- `npx vitest run` 24 个测试文件 / 100 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1 歌单详情行 / §4.3 `QqPlaylist*` | 改 | 补充失效歌单的响应形状：`req_0.code=0`、顶层 `data.code=-100006`、`dirinfo` 空壳；不能只看 `retcode`。 |
| `CORE.html` | §4.12 `api/playlist.ts` | 改 | 完整快照与轻量分页遇到 `NO_PERMISSION` 时调用 `invalidatePlaylistCache`；缓存按账号 + 歌单 ID 持久化。 |
| `CORE.html` | §4.46 `PlaylistView.vue` | 改 | 先展示缓存、后台静默刷新；标题显示已下载数量；增加 `.main` 滚动监听、顶部 / 底部跳转按钮与卸载清理。 |
| `CORE.html` | §4.49 `styles/main.css` | 改 | 新增 `.page-jump` 固定定位；`.page-jump-btn` 与评论跳转按钮共用样式。 |
| `USER.html` | §5.2.8 页面表 · 歌单详情行 | 改 | 打开立即显示缓存；后台更新失败不提示；歌曲区显示已下载数量；右下角提供快速到顶部 / 底部按钮。 |
| `EVOLVE.md` | #5 歌单 | 改 | 补缓存优先、静默刷新、失效歌单清理、已下载计数与快速跳转要求。 |

### 4.47 歌单缓存从未落盘：Vue 响应式代理无法通过 IPC 结构化克隆

问题描述：切换到歌单时仍会显示一段“正在加载歌单”。检查实际用户目录发现 `cache/playlist` 目录根本不存在，说明不是缓存读取慢，而是缓存从未写入；每次切换都在等完整网络快照。

根因：
- `stores/playlist.ts` 的 `persistCache()` 直接把 `current.meta` 和 `current.songs.slice()` 传给 `window.lychee.playlist.saveCache`；
- `feed` 是 `ref<PlaylistFeed>`，Vue 会深度转换为响应式 Proxy；`current.meta` 是 Proxy，`current.songs` 的数组元素也是 Proxy；
- Electron IPC 使用结构化克隆，`structuredClone(reactive(...))` 会抛 `DataCloneError: #<Object> could not be cloned`；
- `persistCache()` 的 `catch` 静默吞掉异常，因此主进程从未收到 `playlist.saveCache`，`cache/playlist` 目录也不会被创建。切换歌单只能重新走网络拉取，表现为持续 spinner。

这不是缓存结构本身导致的慢：命中缓存时只是一次 IPC + JSON 读取；真正的问题是缓存命中率恒为 0。次要风险是缓存上限（当时为 16MB）会让超大歌单（例如 1 万首约 20MB）写入后立刻被清理，以及同步 `readFileSync` 会占用主进程，但都不解释普通歌单每次切换都慢。后续已将上限提高到 64MB。

解决方法：
- 新增 `plainSong()`，把 `Song` 及其 `singers` / `album` / `pay` 逐层展开为普通对象；`meta` 使用 `{ ...current.meta }` 展开；
- `persistCache()` 只把纯对象快照交给 IPC，避免响应式 Proxy 进入结构化克隆；
- 不改变缓存文件结构与读取流程，现有按“账号 + 歌单 ID”的持久缓存继续使用。

验证：

- 复现：`structuredClone(reactive({ a: 1 }))` 抛 `DataCloneError`；修复前传给 `saveCache` 的 `meta` / `songs[0]` 均为 `isProxy() === true`；
- 新增 store 用例断言 `snapshot`、`meta`、`songs`、`songs[0]`、`album`、`pay` 都不是 Proxy；
- `npm run typecheck` 通过；
- `npx vitest run` 24 个测试文件 / 101 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.61 `stores/playlist.ts` | 改 | 明确写缓存前必须把响应式 feed 展开为纯对象；Electron IPC 不能克隆 Vue Proxy。 |
| `CORE.html` | §4.12 `api/playlist.ts` | 改 | 缓存快照结构不变；缓存上限提高到 64MB，1 万首左右的快照可正常保留。 |
| `USER.html` | §5.2.8 歌单详情 | 改 | 首次成功加载后写入缓存；后续打开优先命中缓存，避免重复网络等待。 |

### 4.48 发现页骨架加载、分区独立填充与离开取消

问题描述：ISSUES 要求确认“发现页加载时打开歌单容易触发风控”的根因，并写明“页面离开必须取消上游请求、下载例外”的统一约定；同时发现页不得等三块内容全部完成才渲染，应先显示骨架，再按组件分别填充。

根因确认：
- 所有元数据请求都经过 `client.ts` 的全局令牌桶（4 req/s，突发容量 8），`musicu`、vkey、收藏 / 登录等入口没有绕过限流；“完全没走限流”不成立。
- 真正的漏洞是**页面请求没有生命周期**：`DiscoverView.onMounted` 调用的 `recommend.load` 在离开页面后继续跑，主进程没有对应取消通道；打开歌单又会启动完整快照和整单可用性探测（`useAvailability` 每 50 首一批，每批可能发 1–3 次 vkey）。104009 主要打在 vkey / 播放链接上，因此打开歌单触发的整单探测才是请求风暴主体，发现页残留请求只是叠加；同时旧页面请求排队会进一步占用限流预算。
- 发现页原实现还要等 `daily → radar → guess` 全部加载完才渲染，进一步延长了请求窗口和首屏等待。

解决方法：
- `shared/constants.ts` 新增 `RECOMMEND_SECTION_IDS` / `RECOMMEND_SECTION_TITLES`，主进程与渲染层共用分区顺序和标题。
- `api/recommend.ts`：`loadDaily` / `loadRadar` / `loadGuess` / `loadSection` / `buildFeed` / `fetchRecommendFeed` 全部接受 `AbortSignal` 并透传到 `musicu` 与 `CgiGetDiss`；取消后不再吞掉中止错误，也不继续填充后续分区。
- `main/ipc.ts`：新增 `recommend.get(sectionId, token)` / `recommend.refresh(sectionId, token)` / `recommend.cancel(token)`，按 token 管理 `AbortController`；新 token 会中止旧发现页请求。
- `preload` / `shared/ipc.ts`：暴露新签名。
- `stores/recommend.ts`：
  - `feed` 始终包含三个占位分区（`refreshedAtMs = 0`），首帧即可渲染骨架；
  - `load` 按 `daily → radar → guess` 串行请求，每区完成立刻替换，不再等整份 feed；
  - 单区失败只写 `errors[id]`，保留占位或已有内容；
  - `refreshSection` 只走指定分区；`cancel` 递增会话序号并调用主进程取消当前 token；`reset` 恢复占位。
- `views/DiscoverView.vue`：登录后监听 `auth.loggedIn` 触发加载；删除整页 loading / 全局错误分支，改为每区骨架、单区错误与重试；顶部“换一批”仍刷新全部；卸载时调用 `recommend.cancel()`。
- 新增 `components/DiscoverSkeleton.vue`：占位直接复用真实条目的 `.discover-strip` / `.discover-item` / `.card` / `.card-cover` / `.card-name` / `.card-sub` 布局类，只把内部内容换成 `.skeleton` 线块；歌曲固定 30 条、每日推荐固定 1 张歌单卡，`.discover-strip` 增加 176px 最小高度。此前自定义 skeleton 使用独立尺寸（卡片 150px 无内边距、额外的 margin-top 与不同的行高），所以替换时会出现卡片变窄、行高变化和整块下移；现在标题 / 刷新按钮固定在外层，内容区尺寸与真实内容一致。
- 文档同步：
  - `GUIDELINES.md` 新增全局约束 #12：CONVENTIONS 只写通用规则，例外写在对应机制章节；
  - `CORE.html` §2 新增“页面请求生命周期”约定；§4.60 下载章节注明下载任务不随页面离开取消，是该约定的例外；
  - `USER.html` §2 新增页面骨架与离开停止加载的用户侧约定，并更新歌单缓存行为；
  - `CORE.html` §4.53 / §4.62 / §4.68 / §5.13 与 `USER.html` §5.2.8 发现页行同步为骨架、逐区填充与取消行为；骨架复用真实布局类，尺寸与内容一致。

验证：

- 新增 recommend store 用例：三区逐块填充、离开页面取消当前 token、单区刷新只请求该区；
- 新增 API 用例：已取消的 signal 不会再发起请求；
- `npm run typecheck` 通过；
- `npx vitest run` 25 个测试文件 / 105 个用例通过；
- `npm run build` 通过；
- 未在实际网络中复现 104009；根因由请求入口、限流实现与页面生命周期代码路径确认。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1 vkey / 播放链接行 | 改 | 明确 104009 主要作用于 vkey / 播放链接；整单可用性探测会放大触发概率。 |
| `CORE.html` | §4.1 `api/client.ts` | 改 | 记录全局令牌桶 4 req/s、突发 8；限流不等于取消，页面仍需主动 abort。 |
| `CORE.html` | §4.60 `download/manager.ts` | 不动 | 已在本节说明下载不受页面生命周期约束。 |
| `EVOLVE.md` | #5 / #14 | 改 | 补“页面离开取消上游请求、下载例外、发现页骨架与分区独立填充”的约束。 |

### 4.49 歌单写后仍保留缓存、心跳跟随页面并优先于 timeout

问题描述：歌单内容发生变动（添加 / 删除 / 改名 / 收藏）后，再打开该歌单会进入整页 loading 转圈；心跳也应只在页面活跃时运行，不能在后台一直跑。约束目标：打开歌单无论如何都立刻显示最近缓存并触发后台更新；心跳发现变化时立即刷新，优先级高于 5 分钟 timeout；只有其它失败场景（主要是切换歌单）才进入 timeout。

根因：
- 主进程在 `playlist.rename`、`playlist.addSongs`、`playlist.removeSongs`、`favorite.toggle` 成功后调用 `invalidatePlaylistCache()`，该函数直接删除缓存文件。写操作后缓存不存在，切回歌单时 `load()` 只能把 feed 置为 loading 并等待完整网络快照，表现为转圈。
- 心跳 interval 在 `PlaylistView` 挂载后一直存在，只在 tick 时判断 `visibilityState`，窗口隐藏时仍保留定时器；没有真正做到“跟随页面”。
- 心跳发现变化虽会调用 `refresh()`，但相关优先级没有在文档和测试中固定。

解决方法：
- 内容写操作不再删除歌单缓存：`playlist.rename` / `addSongs` / `removeSongs` / `favorite.toggle` 只返回写入结果，渲染层 `invalidate()` 把当前 feed 标记为 stale；下一次打开仍先展示旧快照，后台刷新成功后原子替换。
- 只有歌单被删除（`playlist.remove`）或上游明确返回 `NO_PERMISSION`（歌单不存在 / 无权限）时才调用 `invalidatePlaylistCache()` 清理文件。
- `PlaylistView` 心跳改为页面生命周期驱动：`onMounted` 仅在页面可见时启动 interval；`visibilitychange` 隐藏时清除 interval，恢复可见时立即 `poll()` 一次并重新计时；卸载或切换歌单时清除 interval 并调用 `playlist.stop()`。
- `playlist.poll()` 发现变化时调用 `refresh()`；`refresh()` 开始即 `clearRetry()`，因此心跳变化会自动取消待执行的 5 分钟 timeout，立即后台拉取。无变化时保留 timeout，等其到期重试。
- `load()` 保持缓存优先：只有没有缓存时才显示 loading；有缓存（包括 stale）时立即展示，再后台刷新。

验证：
- 新增 store 用例：刷新失败进入 timeout 后，心跳检测到变化立即再次请求并清除 timer，推进 5 分钟不会重复请求；
- 代码核对：写操作路径不再调用 `invalidatePlaylistCache`，删除歌单仍清理缓存；
- `npm run typecheck` 通过；
- `npx vitest run` 25 个测试文件 / 106 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.12 `api/playlist.ts` | 改 | 已更新：写操作不删除缓存，只有删除 / 无权限才清理；缓存上限 64MB。 |
| `CORE.html` | §4.61 `stores/playlist.ts` | 改 | 已更新：缓存优先、心跳变化优先于 timeout、stop 取消刷新。 |
| `CORE.html` | §4.46 `PlaylistView.vue` | 改 | 已更新：心跳只在页面可见时运行，隐藏停止，恢复立即检查。 |
| `USER.html` | §2 CONVENTIONS / §5.2.8 歌单详情 | 改 | 已更新：打开先显示缓存；心跳跟随页面；心跳变化优先于 timeout。 |
| `EVOLVE.md` | #5 歌单 | 改 | 补“写后保留旧缓存、心跳跟随页面、心跳优先于 timeout”的约束。 |

### 4.50 下载页移除数字进度指示并将进度条改为 muted

问题描述：ISSUES 要求下载页顶部的整体进度条不再显示下方的 `(1/100)` 数字指示，并把进度填充色改为 muted。

解决方法：
- `DownloadsView.vue` 删除 `.downloads-progress-count` 节点；保留顶部 `.downloads-progress-track` 的语义 `<div role="progressbar">` 与百分比宽度。
- `styles/main.css` 删除 `.downloads-progress-count` 及 900px / 560px 两处响应式规则。
- `.downloads-progress-track span` 背景由 `var(--palette-purple-light)` 改为 `var(--muted)`。
- 更新 `downloads-view` SSR 用例：不再出现 `(0/2)` 或 `downloads-progress-count`，同时确认进度条节点仍存在。

验证：
- `npm run typecheck` 通过；
- `npx vitest run` 25 个测试文件 / 106 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.8 页面结构 · 下载中心行 | 改 | 顶部只保留 muted 整体进度条，不显示数字 / 失败数量指示；失败数量仍在任务列表与筛选中体现。 |
| `CORE.html` | 下载中心对应小节 | 改 | 删除 `.downloads-progress-count` 说明；进度条填充使用 `--muted`。 |

### 4.51 下载页新增“全部开始”继续所有暂停任务

问题描述：补充需求：下载页需要“全部开始”按钮，把所有暂停任务继续，并与任务筛选切换放在同一行右侧。

解决方法：
- `download/manager.ts` 新增 `resumeAllDownloads()`：遍历任务，只把 `paused` 置为 `pending`、清空错误并 `touchTask`；有变化时 `schedulePump()`，返回被继续任务的快照。`downloading` / `done` / `failed` 不受影响。
- `ipc` / `preload` / `shared/ipc.ts` 新增 `download.resumeAll`，避免逐条任务 IPC。
- `stores/download.ts` 新增 `resumeAll()`：一次调用主进程，替换返回的任务快照，并在有任务时启动轮询。
- `DownloadsView.vue`：工具栏改为左右布局，左侧原筛选切换，右侧“全部开始”按钮；按钮在无暂停任务或请求进行中时禁用，请求中显示 spinner。
- `styles/main.css`：`.downloads-toolbar` 改为 flex 两端对齐；筛选组去掉旧的上 / 左外边距，与按钮同行垂直居中。

验证：
- 新增 store 用例：`resumeAll()` 只调用一次 IPC，并把暂停任务更新为 `pending`；
- `downloads-view` SSR 用例确认页面包含“全部开始”；
- `npm run typecheck` 通过；
- `npx vitest run` 25 个测试文件 / 107 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.8 页面结构 · 下载中心行 | 改 | 筛选切换同行右侧提供“全部开始”，继续所有暂停任务。 |
| `CORE.html` | §4.60 `download/manager.ts` | 改 | 新增 `resumeAllDownloads()`：只把 paused 置为 pending，并调度队列。 |
| `CORE.html` | 下载中心对应小节 | 改 | 工具栏左筛选、右“全部开始”；无暂停任务时禁用。 |

### 4.52 下载页整体进度条改为不占布局的顶部 overlay

问题描述：补充子任务：下载页整体进度条应改为不占地方的 overlay，常驻页面顶端。

解决方法：
- `.downloads-progress-track` 从普通文档流块改为固定定位：`position: fixed`、`top: 0`、`left: var(--sidebar-width)`、`right: 0`、`z-index: 14`。
- 增加 `pointer-events: none`，不拦截页面点击；高度保持 4px，滚动页面时始终停留在内容区顶端。
- 进度条不再占据页面高度，`.page` 的内容从原来的进度条下方改为从顶端开始。
- 填充色继续使用 `var(--muted)`；数字指示保持移除状态。

验证：
- `downloads-view` SSR 用例仍确认进度条节点存在且无数字指示；
- `npm run typecheck` 通过；
- `npx vitest run` 25 个测试文件 / 107 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.8 页面结构 · 下载中心行 | 改 | 顶部整体进度条为不占布局的 overlay，常驻内容区顶端；不显示数字指示。 |
| `CORE.html` | 下载中心对应小节 | 改 | `.downloads-progress-track` 使用 fixed 定位、`left: var(--sidebar-width)`、`pointer-events: none`。 |

### 4.53 侧栏退出按钮下方新增切换配色

问题描述：ISSUES 要求在左侧导航“退出”按钮下面增加一个切换配色按钮。

解决方法：
- `AppIcon.vue` 新增 `sun` / `moon` 两个图标：浅色模式显示太阳，深色模式显示月亮。
- `App.vue` 在“退出”按钮后增加仅图标、无文字的配色切换按钮：
  - 点击读取 `settings.settings.theme`，在 `dark` / `light` 之间切换；
  - 统一调用 `settings.update({ theme })`，与设置页主题选项共用同一写入与 `applyTheme()` 逻辑；
  - 成功切换不弹 Toast；失败走统一错误提示；
  - tooltip 显示“切换到深色 / 浅色模式”。
- 侧栏导航本身可纵向滚动，新增按钮不改变现有布局。

验证：
- `npm run typecheck` 通过；
- `npx vitest run` 25 个测试文件 / 107 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.2 侧栏与导航 | 改 | 已更新：应用组“退出”下方提供仅图标、无文字的配色切换按钮，与设置页共用 `Settings.theme`，切换不弹 Toast。 |
| `CORE.html` | §4.23 `App.vue` | 改 | 已更新：切换配色读取并写回 `Settings.theme`，复用同一 store 与即时应用逻辑。 |

### 4.54 播放条收藏改为特殊 revealer，并为 revealer 增加触屏手势

问题描述：ISSUES 要求把播放条收藏按钮做成特殊 revealer：按钮本身加入 / 取消我喜欢，弹出按钮为“加入歌单”，没有模式切换。同时尝试为所有 revealer 增加触屏交互：从按钮开始上下滑动时保持弹层打开并切换选项，松开确认；鼠标移出范围取消。

实现：
- 收藏按钮：
  - 外层改为 `likeWrap`，悬停 / 聚焦 120ms 打开、离开 200ms 关闭，点击外部与 Esc 关闭；
  - 按钮本身继续调用 `playlist-edit.toggleFavorite()`，不循环切换任何模式；
  - 弹层只有一个“加入歌单”图标按钮，点击后通过 `Teleport` 打开 `PlaylistPicker`，传入当前歌曲 mid；
  - 选中歌单后的添加、去重与提示继续由 `PlaylistPicker` / `playlist-edit` 统一处理。
- 新增 `composables/revealer-touch.ts`：
  - 仅处理 `pointerType === 'touch'`；纵向移动超过 8px 才打开弹层并捕获指针，轻点不拦截原有 click；
  - 弹层内带 `data-revealer-option` 的节点按中点与手指 Y 距离匹配最近项，写入 `highlighted`；
  - 松开确认，`pointercancel` 关闭；滑动后通过容器捕获阶段抑制随后的 click。
- 播放模式、音质、收藏三个 revealer 接入该手势；音量条仍为特殊个例，不参与纵向选项手势。
- 相关样式：新增 `like-wrap` / `like-menu` / `like-option`，并让 `.mode-button` / `.quality-chip` / `.like-button` 使用 `touch-action: none`；高亮项使用 `touch-active`。
- 文档更新：USER §2 revealer 约定补充触屏规则；USER §5.2.3 补充收藏特殊 revealer；CORE §4.40 记录实现，新增 §4.78 `revealer-touch.ts` 签名与手势约束。

验证：
- 触屏轻点仍走原有 click；滑动超过阈值才进入手势，避免点击被吞；
- 手势按手指位置高亮并松开确认，取消时关闭；
- `npm run typecheck` 通过；
- `npx vitest run` 25 个测试文件 / 107 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §2 CONVENTIONS · Revealer | 改 | 已更新：补充触屏滑动打开 / 高亮 / 松开确认、轻点保留原行为、鼠标离开取消。 |
| `USER.html` | §5.2.3 播放条 | 改 | 已更新：收藏为特殊 revealer，弹层仅“加入歌单”。 |
| `CORE.html` | §4.40 `PlayerBar.vue` / §4.78 `revealer-touch.ts` | 改 | 已更新：收藏 revealer、PlaylistPicker 接入与触屏手势实现。 |
| `EVOLVE.md` | #5 / #11 | 改 | 补收藏特殊 revealer 与 revealer 触屏手势约束；音量条仍为特殊个例。 |

### 4.55 音量 revealer 改按拖动距离 delta 调节

问题描述：音量是 revealer 的特殊个例，触屏上不能像模式 / 音质那样按选项定位；需求是拖动音量按钮时按拖动距离的 delta 改变音量，且轻点仍切换静音。

解决：
- `PlayerBar.vue` 为音量按钮增加独立 Pointer Events 手势（仅 `pointerType === 'touch'`）：
  - `pointerdown` 记录起始 Y 与起始音量，不立即改动；
  - 移动超过 4px 才进入手势并捕获指针；窄屏下同步打开音量弹层；
  - 音量按 `startVolume + (startY - clientY) / VOLUME_DRAG_RANGE` 计算，`VOLUME_DRAG_RANGE = 120` 表示拖动 120px 覆盖 0–1，结果夹紧到 0–1；
  - 松开 / 取消后关闭窄屏音量弹层；滑动后的 click 在容器捕获阶段抑制，轻点仍切换静音。
- `.volume-button` 增加 `touch-action: none`，避免手势被原生滚动打断。
- 音量仍不使用 `useRevealerTouch` 的选项定位逻辑，保持特殊个例。

验证：
- `npm run typecheck` 通过；
- `npx vitest run` 25 个测试文件 / 107 个用例通过；
- `npm run build` 通过。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.3 播放条 | 改 | 已更新：音量触屏拖动按 delta 调节，120px 覆盖 0–1，轻点仍静音。 |
| `CORE.html` | §4.40 `PlayerBar.vue` / §4.78 | 改 | 已更新：音量特殊手势与 4px 阈值、delta 计算、click 抑制。 |
| `EVOLVE.md` | #5 / #11 | 改 | 音量 revealer 的触屏例外改为“拖动距离 delta 调节”，不是无响应或绝对定位。 |
