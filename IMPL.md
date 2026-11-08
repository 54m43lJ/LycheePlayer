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