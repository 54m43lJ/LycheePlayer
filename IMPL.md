# IMPL — 开发过程记录

本文只记录实现 `doc/evol-2` 蓝图时暴露出的文档问题、未写明细节与技术坑，作为后续修订 `EVOLVE.md` / `PROVIDER.html` / `CORE.html` / `USER.html` / `BUILD.html` 的输入，不改写产品文档本身。

## 1. 开发中发现文档的错误

### 1.1 歌手歌曲接口的响应层级与 PROVIDER 不一致

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
| `CORE.html` | §4.74 `api/artist.ts` | 改 | 记录双形状解析与 `songInfo` 映射。 |
| `EVOLVE.md` | #4 | 不动 | 响应模型以 PROVIDER 为主责，见本表前两行。 |

### 1.2 PROVIDER 的验证状态与 fixture 证据不一致

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

### 1.3 EVOLVE #13 的实现入口清单不完整

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

### 1.4 README.md 的同步约定与本次分支要求冲突

问题描述：`EVOLVE.md` §0 要求 `README.html` 与 `README.md` 同步，并规定“`README.md` 最终以 `README.html` 的转换结果为准”，各清单项的文档操作也反复要求“`README.md` 同步生成”。但本次任务明确要求删除 `README.md`；仓库里还保留 `convert-readme.yml`，只要文档提交就会重新生成该文件。文档约定与分支目标直接冲突。


解决方法：
- 以 `README.html` 作为唯一产品说明来源，本次不维护 `README.md`；
- 删除 `README.md` 后不再让文档操作引用它；
- 转换 workflow 是否保留需单独决定，避免 CI 把已删除文件重新提交回来。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `EVOLVE.md` | §0 使用约定 | 改 | 把 `README.html` / `README.md` 同步改为“以 `README.html` 为准；本分支不保留 `README.md`”。 |
| `GUIDELINES.md` | 文档边界 | 改 | 明确 README 的维护入口，避免各清单项继续要求生成 md。 |
| `README.html` | 全文 | 不动 | 产品说明内容不变，只停止生成 Markdown 副本。 |

## 2. 开发中发现文档没写明的细节

### 2.1 下载任务 / 批次 / 索引缺少精确类型与持久化契约

问题描述：文档描述了 `DownloadTask.batchId`、`playlistId`、`source`、`DownloadBatch`、`SongAssetState` 与“按账号索引”，但没有给出 `source` 的枚举值、批次状态的派生规则、索引 JSON 的字段、哪些状态需要落盘，以及“清除已完成”对批次记录的处理。实现时这些都必须自行决定，否则主进程、preload 与 UI 三端无法对齐。


解决方法：
- 在 `shared/types.ts` 定义 `DownloadSource = 'network' | 'cache' | 'batch'`、`DownloadBatch`、`SongAssetState` 与扩展后的 `DownloadTask`；
- 索引固定为 `{ tasks, batches }`，只持久化 `done` / `paused` 任务；启动时 `downloading/pending` 统一转为 `paused`；
- 批次 `total/done/failed` 由实际任务实时重算，批次状态按“有活动任务 / 暂停 / 有失败 / 完成”派生；
- `clearCompleted` 只删除已完成任务记录，不删除文件，也不删除批次记录本身。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.1 `types.ts` | 增 | `DownloadSource`、`DownloadBatch`、`SongAssetState`、索引 JSON 结构。 |
| `CORE.html` | §4.60 `download/manager.ts` | 改 | 补索引字段、批次状态派生、持久化状态与 `clearCompleted` 语义。 |
| `USER.html` | §1 TERMS 下载任务 / 下载中心 | 不动 | 术语由 #2 维护，见 CORE 两行。 |
| `EVOLVE.md` | #2 | 不动 | 类型契约以 CORE 为主责，避免与本文重复定义。 |

### 2.2 下载文件命名与同名覆盖规则未定义

问题描述：文档只要求“文件放到 `downloadDir`”，没有规定文件名格式、歌手/歌名如何拼接、同名歌曲如何处理、是否允许覆盖已有文件。实现若直接使用歌名，遇到同名歌曲会互相覆盖；若加随机后缀，又会让用户难以在文件管理器里识别。


解决方法：
- 当前使用 `safeName(song.name) + 扩展名`，过滤文件系统非法字符并压缩空白；
- 同名文件按覆盖处理，不做静默改名；
- 在文档补齐规则前，不引入随机 UUID 后缀，避免下载目录不可读。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `BUILD.html` | §11 存储 | 增 | 下载文件命名模板、非法字符处理、同名覆盖规则。 |
| `CORE.html` | §4.60 `download/manager.ts` | 改 | 明确 `safeName` 规则与同名覆盖行为。 |
| `USER.html` | §5.3 错误与通知 | 不动 | 不新增错误码，行为由 #2 维护。 |

### 2.3 歌单写入的读回校验、重复添加与创建 ID 选择未定义

问题描述：文档要求“写后读回或成员可见性校验”，但没有说明读回多少页、如何判断重复添加、创建接口同时返回 `dirId` / `tid` 时选哪个、`dirId:0` 时是否回退 `tid`。如果实现只读第一页，新增歌曲在歌单末尾时会永远校验失败；如果只认 `dirId`，创建可能拿不到有效 ID。


解决方法：
- 读回最多 20 页成员，按 `songMid` 建集合；
- `addSongs` 先过滤已存在 mid，写后校验全部出现；`removeSongs` 写后校验全部消失；
- 创建时优先取正整数 `dirId`，否则回退正整数 `tid`；
- 添加到歌单的重复提示同时使用本地缓存成员集合与 `songCount` 是否变化判断。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1 歌单写入 / 歌单增删歌曲 | 改 | 补读回校验范围、重复添加判定与 `dirId` / `tid` 优先级。 |
| `CORE.html` | §4.55 `api/playlist-write.ts` | 改 | 记录 20 页读回上限、重复过滤、创建 ID 回退规则。 |
| `EVOLVE.md` | #14 | 不动 | 写后校验细节由 CORE 主责，见上一行。 |

### 2.4 评论点赞的返回结构、`liked` 来源与点赞数处理未定义

问题描述：文档定义了 `CommentSort` 与评论列表映射，但评论模型里没有说明 `liked` 来自哪个上游字段；点赞接口只写了“返回最新点赞状态 / 数量”，fixture 里只有 `code/msg/subcode`，没有数量。实现必须自己决定 `liked` 的来源，以及点赞数为 0 时是否隐藏、失败回滚时如何恢复计数。


解决方法：
- 读取可选的 `IsLiked` 字段映射为 `Comment.liked`，字段缺失时按 `false`；
- `CommentLikeResult` 的 `likedCount` 设为可选；上游不返回数量时由前端乐观更新并在失败时回滚；
- 点赞 / 取消点赞统一走 `UpdateHotComment`，`type` 3 / 4；
- UI 在 `likedCount === 0` 时只显示按钮、不显示数字。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.3 `QqComment` | 改 | 增可选 `IsLiked` 字段及“缺失按未点赞处理”的说明。 |
| `CORE.html` | §4.1 `types.ts` | 改 | `Comment.liked?`、`CommentLikeResult.likedCount?`。 |
| `CORE.html` | §4.15 `api/comment.ts` | 改 | 补点赞返回状态、数量缺失与类型映射。 |
| `EVOLVE.md` | #5 / #14 | 不动 | 排序与点赞 UI 分别由 #5 / #14 维护，见对应项。 |

### 2.5 推荐分区刷新返回范围与缓存存储未定义

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

### 2.6 MV 降档后的 `quality` 语义与搜索分页未定义

问题描述：文档要求“默认最高清晰度，不可用时按 `fhd → hd → sd` 降档”，但没有说明返回的 `MvStream.quality` 表示请求档还是实际档；也没说明 MV 搜索与歌曲搜索是否共用 `pageNo`。如果返回请求档，UI 会高亮一个实际没取到的清晰度；如果分页各自为政，搜索页页码会错乱。


解决方法：
- `getMvStream` 返回实际采用的清晰度；`MvView` 的清晰度按钮跟随实际值高亮；
- 请求档不可用时在 API 内降档，`url: null` 表示该档及以上都不可用；
- MV 搜索复用歌曲搜索的页码与每页条数，搜索结果只合并 `mvs`，不影响歌曲分页。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.56 `api/mv.ts` | 改 | 明确 `MvStream.quality` 为实际档，`url:null` 的语义与降档顺序。 |
| `CORE.html` | §4.69 `MvView.vue` | 改 | 补按钮跟随实际清晰度与空流重试。 |
| `USER.html` | §5.2.8 MV 播放 | 不动 | 用户交互由 #14 维护，见 CORE 两行。 |

### 2.7 最近歌单校验失败分类与 `stale` 字段未定义

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

### 2.8 运行期依赖的发行版包名映射未定义

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

## 3. 其它技术上踩的坑

### 3.1 退出时异步写索引被截断，且未加载下载模块会写空索引

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

### 3.2 整单下载被单次 IPC 的 100 首上限挡住

问题描述：`download.startBatch` 的请求走 `midArray` 校验，而 `midArray` 默认上限是 `IPC_SONG_MIDS_MAX = 100`。整单下载允许最多 `DOWNLOAD_BATCH_MAX = 2000` 首，结果超过 100 首的歌单点击“下载全部”会直接被参数校验拒绝，而不是进入批次队列。


解决方法：
- `download.startBatch` 单独使用 `DOWNLOAD_BATCH_MAX` 作为 `midArray` 上限；
- `song.getUrls` / `song.probe` 等仍保持 100 首限制；
- 渲染层资产查询按 100 首分块，批次创建不按 100 分块。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.2 `ipc.ts` | 改 | 逐通道列出批量上限：批次用 `DOWNLOAD_BATCH_MAX`，播放链接 / 探测仍用 100。 |
| `CORE.html` | §4.60 `download/manager.ts` | 改 | 明确批次上限与单曲 IPC 上限分离。 |
| `EVOLVE.md` | #1 | 不动 | 批次能力见 #2，上限由 CORE 主责。 |

### 3.3 资产状态查询触发上游探测风暴

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

### 3.4 音频代理的 200 / 206 完整响应判定与进度节流

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

### 3.5 缓存转下载的硬链接会跨设备失败

问题描述：“缓存达到最高档时本地转移”优先用硬链接。但缓存目录在 `userData`，下载目录可能在另一块磁盘或另一分区，`link()` 会抛 `EXDEV`。如果异常直接冒泡，任务会被标记失败；实际上复制文件即可完成转移。另外缓存文件可能在转移过程中被清理，失败后应回退网络下载而不是让任务停在失败态。


解决方法：
- `linkCachedAudio` 先 `link`，捕获任何失败后 `copyFile`；
- 缓存转移整体包一层 try/catch，失败时把 `source` 改回 `network` 并继续正常下载；
- 只有网络下载失败才把任务标记 `failed`。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.60 `download/manager.ts` | 改 | 明确硬链接失败复制、缓存转移失败回退网络下载。 |
| `BUILD.html` | §11 存储 | 增 | 缓存与下载可能跨文件系统，说明硬链接优先 / 复制兜底。 |
| `EVOLVE.md` | #2 | 不动 | 转移规则见 #2，技术细节由 CORE / BUILD 主责。 |

### 3.6 旧窄屏 64px / 56px 常驻侧栏样式与抽屉冲突

问题描述：`main.css` 原有的 `@media (max-width: 900px)` 把侧栏收成 64px 常驻图标栏，`@media (max-width: 560px)` 又改成 56px，并把 `.nav-item` 的 `font-size` 设为 0。新方案要求窄屏改成默认隐藏的覆盖式抽屉，但旧规则仍会先命中；如果只改组件类名，抽屉会被压成一条图标栏，文字也消失。


解决方法：
- 在样式表末尾追加窄屏覆盖块，重新设置 `--sidebar-width: 0`、单列 grid、`position: fixed`、`transform: translateX(...)`；
- 恢复抽屉内的 `.nav-item` 字号、间距、`.user-meta` 与 `.brand` 文本；
- 把旧断点规则视为历史残留，后续统一清理为单一 900px 抽屉规则，避免依赖样式顺序。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.49 `styles/main.css` | 改 | 明确 900px / 560px 断点只保留抽屉规则，删除 64px / 56px 常驻栏。 |
| `CORE.html` | §4.23 `App.vue` | 改 | 补窄屏单列 grid、固定抽屉与 revealer 的组合关系。 |
| `USER.html` | §5.2.1 窗口与布局 | 不动 | 布局契约由 #11 维护，见 CORE 两行。 |

### 3.7 歌曲表内的链接 / 按钮会触发行双击播放

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

### 3.8 筛选后的索引映射容易误删 / 误播

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

### 3.9 评论“最旧”排序分页追加后会失去全局顺序

问题描述：最旧排序允许在已加载评论上本地重排。如果只在请求单页后排序，再把下一页直接 append，第二页的评论会整体排在第一页后面，跨页顺序并不正确；评论还可能因为刷新与翻页重叠而重复。


解决方法：
- 每次追加新一页后，对合并结果按 `createdAtMs` 重新升序排序；
- 追加前按评论 `id` 去重；
- “最新 / 点赞”依赖上游顺序，不做本地重排；最旧排序的重排只作用于已加载集合。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.42 `CommentsPanel.vue` | 改 | 补最旧排序在每次分页追加后全局重排、按 id 去重。 |
| `CORE.html` | §4.15 `api/comment.ts` | 不动 | 上游透传与本地排序分工由 #5 维护。 |
| `PROVIDER.html` | §4.1 歌曲评论行 | 不动 | 上游排序方法不变，见 #5。 |

### 3.10 播放模式悬停菜单的定时器与外部监听泄漏

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

### 3.11 音频代理取消时 `reader.cancel` 拒绝产生未处理 Promise

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

## 4. ISSUES 未决项修复记录

### 4.1 播放条合并为单轨进度条并补齐缓冲进度

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

### 4.2 播放模式改为“按钮即当前项”的 revealer

问题描述：ISSUES 要求播放模式切换改成 revealer 式，按钮与弹出一体化，按钮本身表示当前选中项，弹出层只展示其它选项。原实现把当前模式同时渲染在按钮图标和弹出菜单最后一项里，按钮只有非顺序模式才高亮，菜单与按钮之间还有 8px 间距，视觉上是两个独立控件，当前项重复出现。

解决方法：
- 抽出 `MODE_ICON` 映射，触发按钮改用 `.mode-button`，常驻 `accent-soft` 背景 + `accent-strong` 图标，直接表示当前模式，不再依赖 `active` 条件；
- 弹出层改为 `otherModes = 固定顺序.filter(mode !== 当前)`，只渲染其它三种模式，去掉重复的当前项；
- 菜单改为 `bottom: 0` 包住按钮：`width: 100%` 与按钮同宽、底部预留按钮高度、背景使用 surface 且无边框；按钮浮在弹层底部并始终保留全部 9px 圆角，形成包含式 revealer，并加 `scaleY` 向上展开动画；
- `toggleModeMenu()` 在切换前清理打开 / 关闭定时器，避免悬停定时器在点击关闭后又把菜单重新打开；悬停、外部点击、Esc 与选择后关闭的行为保持不变。

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

### 4.3 音量改为响应式：宽屏常驻滑块，窄屏悬停 revealer

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

### 4.4 按钮文字不再自动换行

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

### 4.5 侧栏新增“我喜欢”入口

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
| `CORE.html` | §4.23 `App.vue` | 改 | 侧栏“浏览”组顺序改为搜索 / 发现 / 我喜欢 / 我的歌单；“我喜欢”登录后显示并指向固定收藏歌单。 |
| `CORE.html` | §4.50 `shared/constants.ts` | 改 | 增 `FAVORITES_PLAYLIST_ID = 'liked'`。 |
| `CORE.html` | §4.12 `main/api/playlist.ts` | 改 | 固定收藏歌单 ID 改为引用共享常量，删除模块内重复字面量。 |
| `USER.html` | §5.2.2 侧栏与导航 | 改 | 浏览组顺序补“我喜欢”；说明登录后显示、与“我的歌单”同级。 |
| `EVOLVE.md` | #11 优化左侧导航 | 改 | 侧栏内容补“我喜欢”快捷入口。 |

### 4.6 最近歌单子条目按当前路由高亮

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

### 4.7 评论点赞状态未加载

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

### 4.8 点击歌词跳转失效与高亮样式调整

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

### 4.9 歌手页改为滚动到底自动分页

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

### 4.10 歌手歌曲排序能力验证与“最热 / 最新”切换

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

### 4.11 部分歌手因旧详情接口返回 `code -1` 无法加载

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

### 4.12 歌手页空闲时连续出现 104009 播放链接错误

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

### 4.13 song.probe 请求量与 IP 104009 风控核查（未完成）

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

状态：ISSUES 已新增顶层记录，未标记已解决；待完成上述策略调整后再补充验证结果。

### 4.14 歌曲标题的版本标签、尾部空白与徽标位置

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

### 4.15 整单下载彻底取消批次并复用统一队列

问题描述：ISSUES 先要求整单下载与单曲下载共用队列、歌曲信息在出队时再拉取；后续又明确要求下载任务不按批次合并，完全取消“批次”概念。原实现虽然已经不再预取歌曲详情，但仍保留 `DownloadBatch`、`batchId` / `playlistId`、`startBatch` 与批次级暂停 / 继续 / 删除 / 重试，下载中心也按批次分组。

解决方法：
- 删除 `DownloadBatch`、`DownloadTask.batchId` / `playlistId` 与 `DownloadSource = 'batch'`，任务来源只保留 `network` / `cache`；
- 下载索引简化为 `{ tasks }`；旧索引中的 `batches` 字段加载时忽略，旧 `source: 'batch'` 归一化为 `network`；
- 新增 `startDownloads(songMids, quality)`：按给定顺序去重后逐首调用同一个 `enqueueTask`，已存在同曲任务时复用；`startDownload` 直接复用它；
- 移除批次 IPC（`batches` / `startBatch` / `pauseBatch` / `resumeBatch` / `removeBatch` / `retryFailed`），新增 `download.startMany`；
- 渲染层下载 store 删除批次状态与批次方法；下载中心改为单一任务列表；歌单“下载全部”直接调用 `download.startMany`，不再创建批次；
- `DOWNLOAD_BATCH_MAX` 更名为 `DOWNLOAD_QUEUE_MAX`，仅限制单次“下载全部”的入队数量；
- 歌曲名、文件路径与音质解析仍只在 `pump` 出队时逐首执行，保持 `DOWNLOAD_CONCURRENCY = 1`。

### 4.16 已下载歌曲改用本地文件播放并修正缓存进度

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

- 设置页“缓存与下载”的下载目录行增加“清空目录”按钮，下载中心底部同步提供同一操作；点击前用确认框展示实际目录，并说明会删除目录内全部文件与下载记录，播放缓存不受影响；
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
| `USER.html` | §5.2.8 页面结构 · 下载中心 | 改 | 下载中心只展示单一任务列表，不再按批次分组；底部提供“清空目录”。 |
| `EVOLVE.md` | #2 下载队列 | 改 | 删除批次模型与批次控制，补充统一入队、出队时解析歌曲信息、已下载文件本地播放与清空下载目录约束。 |

### 4.17 下载按钮的缓存 / 下载状态在播放条与歌曲表统一

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

### 4.18 设置页新增带节点的播放缓存上限滑动条

问题描述：ISSUES 要求设置里的缓存选项增加一个带节点的滑动条，用固定档位调整缓存大小：最小 128MB、最大 2GB，档位为 128M → 256M → 512M → 1G → 1.5G → 2G。原实现只有播放缓存开关与“清空”按钮，容量上限写死为 `AUDIO_CACHE_MAX_BYTES = 2 GiB`，用户无法调整；`Settings` 与设置页也没有对应字段。

解决方法：

- `shared/constants.ts` 新增 `AUDIO_CACHE_LIMIT_STEPS_BYTES`（6 个固定档位）、`AUDIO_CACHE_DEFAULT_BYTES`（沿用旧行为，默认 2 GiB）与纯函数 `normalizeAudioCacheLimitBytes`：合法档位原样返回，越界 / 非档位值归一到最近档位，非法值回退默认档位；
- `Settings` 新增 `audioCacheMaxBytes`；主进程 `createDefaultSettings` / `sanitize` 与渲染层 `defaultSettings` 同步补默认值和归一化；
- `cache/audio.ts` 的 LRU 清理不再读常量，改为每次按 `getSettings().audioCacheMaxBytes` 执行，并导出 `enforceAudioCacheLimit()`：写入缓存后仍自动清理，设置页下调上限时也立即清理；
- `settings.set` 保存后若缓存上限发生变化，调用 `enforceAudioCacheLimit()`；关闭播放缓存仍沿用原有清空逻辑，返回实际落盘后的 `saved` 设置；
- 设置页在播放缓存开关下方新增全宽 `cache-limit-row`：左侧显示“播放缓存上限 / 超出后按最久未使用自动清理”，右侧显示当前档位；滑杆固定 6 个节点，已选节点与轨道填充使用 accent 色，未到节点保持弱色；
- 滑杆拖动时只更新本地预览档位，释放（`change`）后才写入设置并刷新缓存占用，失败时回退到当前设置值并提示；`aria-label` 为“播放缓存上限”，节点标签为 128M / 256M / 512M / 1G / 1.5G / 2G；
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

### 4.19 首页改为发现页并交换侧栏“发现 / 搜索”顺序

问题描述：ISSUES 要求把首页改成发现页，并把导航栏中的“发现”和“搜索”交换位置。原实现根路径 `/` 重定向到 `/search`，侧栏“浏览”组顺序也是“搜索 → 发现”，因此应用启动后落在搜索页，发现页需要手动点击。

解决方法：

- `router/index.ts` 的根路径重定向从 `/search` 改为 `/discover`，启动与访问 `/` 都默认进入发现页；
- `App.vue` 侧栏“浏览”组改为“发现 → 搜索 → 我喜欢 → 我的歌单”，发现项继续使用 `compass` 图标，搜索项使用 `search` 图标；
- `/search` 路由、搜索结果内的返回链接、歌词页无历史时的回退目标与登录后跳转 `/library` 均保持不变，本次只调整默认首页与导航顺序；
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
| `USER.html` | §5.2.2 侧栏与导航 | 改 | 浏览组顺序改为“发现 / 搜索 / 我的歌单”，并说明启动默认落在发现页。 |
| `USER.html` | §3.4 页面 / URL 架构图 | 改 | 注明根路径 `/` 默认进入 `/discover`。 |
| `EVOLVE.md` | #11 优化左侧导航 | 改 | 补“发现”在“搜索”之前、根路径默认进入发现页的导航约定。 |

### 4.20 播放模式按钮点击遍历与顺序播放图标区分

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

### 4.21 空播放条封面去掉边框并统一收敛全部阴影

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

### 4.22 歌手简介过长时提供展开 / 收起

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

### 4.23 下载文件改为“歌名-歌手-专辑.格式”命名

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

问题描述：ISSUES 指出按点赞排序评论时报 `[ipc] UPSTREAM_CHANGED: 上游返回错误码 10000（music.globalComment.CommentRead.GetHotCommentList）`。原实现把 `hot` 当作评论排序交给 `GetHotCommentList`，而该方法的响应只有 `req_0.code = 10000` 与空的 `CommentList`，页面直接进入错误态。

对 API 的正确理解：QQ 音乐的 Hot 是评论浏览列表之外的“热评”附加模块，只展示少量最热门评论，冷门歌曲可能为空；它不是可按页浏览的评论排序，也不能替代“按点赞数排序”。

实测结论（歌曲 `97773`，匿名请求）：

- `GetHotCommentList` 无论使用原参数、最小参数、`WithHot=1`、`PageNum=1` 还是去掉 `LastCommentSeqNo`，均返回 HTTP 200、顶层 `code=0`、`req_0.code=10000`，`CommentList.Comments` 为空；
- `GetNewCommentList + WithHot=1` 返回的 `CommentList2` 是上述热评附加模块：首次 21 条、`Total=3965`、包含 22488 / 265810 等高赞评论；`PageNum=1` / `PageNum=2` 时 `CommentList2` 为空，说明它只有首屏，不是可分页的评论列表；
- `GetNewCommentList` 额外传 `Order` / `Sort` / `SortType` / `OrderType` / `CommentSort` / `Hot` / `Type` / `SortMode` / `OrderBy` / `SortBy` / `Rank` 时，返回的评论顺序与点赞数完全一致，确认上游没有真正的“按点赞数排序”参数；
- 因此不能把 `CommentList2` 强行当作评论排序结果，正确做法是取消该排序功能。

解决方法：

- `CommentSort` 从 `hot | latest | oldest` 改为 `latest | oldest`；
- 评论排序控件删除“点赞”，只保留“最新 / 最旧”；默认仍为“最新”；
- `comment.ts` 统一调用 `GetNewCommentList` 并读取 `CommentList`，不再使用 `GetHotCommentList`、`WithHot` 或 `CommentList2`；`oldest` 继续在已加载评论上按 `createdAtMs` 本地升序重排；
- `comment.get` IPC 只接受 `latest` / `oldest`，旧渲染层若仍传入 `hot` 会回退为 `latest`，不会再把上游错误码暴露给用户；
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
| `CORE.html` | §4.15 `comment.ts` | 改 | `CommentSort` 改为 `latest | oldest`；删除 hot 分支与 `CommentList2` 读取；说明评论只支持最新 / 最旧。 |
| `USER.html` | §5.2.5 歌词与评论 | 改 | 评论排序选项改为“最新 / 最旧”，删除“点赞”；若展示热评，应在评论列表外单独说明。 |
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
| `CORE.html` | §4.31 `stores/download.ts` / §4.72 `DownloadDrawer.vue` | 改 | 仅在下载中心打开时轮询与渲染任务列表；资产状态只刷新状态变化的任务，禁止每次轮询全量查询。 |
| `CORE.html` | §4.50 `shared/constants.ts` | 改 | 增 `UPSTREAM_BLOCK_MS`，推荐值 60_000。 |
| `USER.html` | §5.3 错误与通知 | 改 | 收到 104009 时提示已暂停上游请求 60 秒，请检查网络 / VPN / 代理出口；期间播放、搜索、下载等上游操作直接失败。 |
| `USER.html` | §5.2.8 下载中心 | 改 | 下载中心关闭时不渲染全量任务列表、不扫描目录用量；有活动任务时仍轮询状态以更新歌曲表图标，全部结束后停止；打开时刷新用量与完整进度。 |
| `PROVIDER.html` | §4.1 vkey / 错误码表 | 改 | 补 104009 触发全局 60 秒截断：两个 vkey 入口都拒绝后不再请求上游。 |

### 4.31 下载中心改为完整页面

问题描述：ISSUES 要求把下载中心从右侧弹出抽屉改为完整页面；清空目录、打开文件夹等操作按钮放在顶部；页面顶部的进度栏横跨窗口，并显示整体进度（形如 `(1/100)`）。

解决方法：

- 新增 `views/DownloadsView.vue`，删除 `components/DownloadDrawer.vue`，新增 `/downloads` 路由；侧栏“下载”由按钮改为 `RouterLink`，按当前路由高亮；
- 页面顶部增加吸顶的整体进度栏，横跨内容区宽度：显示完成数 / 总数（如 `(1/100)`）与失败数，进度按 `done / total` 计算；任务列表为空时显示空状态；
- 后续布局调整：标题栏与整体进度条合并为一个吸顶头部，不再显示“整体进度”字样；进度条贴在页面最顶部并左右延伸到内容区边缘，`(完成/总数)` 与失败数紧贴进度条下方右对齐；
- 下载条目区顶部增加“全部 / 进行中 / 已完成 / 未成功”过滤切换；过滤只影响展示，整体进度仍按全部任务计算；
- 任务按队列顺序降序展示，新任务在最前；该顺序仅为视觉调整，不改变主进程统一队列的处理顺序；
- `page-head-actions` 集中放置“清除已完成”“清空目录”“打开文件夹”，其中“清除已完成”只清记录，“清空目录”仍保留目录确认与路径提示；
- 列表复用原任务行样式，保留单任务暂停 / 继续 / 删除；页面底部不再保留抽屉式操作栏；
- 删除 `ui.downloadOpen` 及 `toggleDownload` / `closeDownload`：下载中心不再与播放队列 / 侧栏互斥，也不再作为弹出层；播放条与各歌曲表的单曲下载只加入队列并提示，不再自动打开下载中心；
- `download` store 的 `setOpen` 改名为 `setVisible`：下载页挂载时开启轮询并刷新目录用量，离开时若仍有活动任务则保留轮询以更新歌曲表图标，全部结束后自动停止；新任务由 `replace` 追加到数组末尾，页面倒序展示。
- 新增 `utils/download-progress.ts` 与对应测试，统一整体进度计算。

验证：

- 新增 `test/download-progress.test.ts`：空列表、混合状态、全部完成三种情况的计数与百分比；
- `npm run typecheck` 通过；
- `npx vitest run` 20 个测试文件 / 73 个用例通过；
- `npm run build` 通过，产物新增 `DownloadsView` 分包。

修订建议：

| 文档名 | 章节 | 动作 | 内容 |
|---|---|---|---|
| `CORE.html` | §1 文件树 / §4.67 | 改 | 删除 `components/DownloadDrawer.vue`，改为 `views/DownloadsView.vue`；下载中心为 `/downloads` 路由页，不再占弹出层。 |
| `CORE.html` | §4.31 `stores/ui.ts` | 改 | 删除 `downloadOpen` / `toggleDownload` / `closeDownload`；下载中心不再参与抽屉互斥。 |
| `CORE.html` | §4.31 `stores/download.ts` | 改 | `setOpen` 改为 `setVisible`；下载页可见时轮询并刷新目录用量，不可见时仅在存在活动任务时继续轮询；新任务追加到列表末尾，页面倒序展示。 |
| `CORE.html` | §4.71 `utils/download-progress.ts` | 增 | 补 `downloadOverallProgress`：总任务 / 完成 / 失败 / 进行中 / 百分比。 |
| `USER.html` | §3.4 页面表 / §5.2.8 下载中心 | 改 | 下载中心改为侧栏可进入的完整页面；吸顶头部最顶部为左右通栏进度条，`(完成/总数)` 与失败数紧贴进度条下方右对齐；条目区顶部提供“全部 / 进行中 / 已完成 / 未成功”过滤；任务按新到旧展示。 |
| `USER.html` | §5.2.2 侧栏 | 改 | “下载”改为路由入口，指向 `/downloads`；不再打开右侧抽屉。 |
| `EVOLVE.md` | — | 改 | 下载中心由抽屉改为完整页面，补充顶部操作区与整体进度栏要求。 |
