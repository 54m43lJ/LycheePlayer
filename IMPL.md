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