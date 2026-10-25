# IMPL — 实现复盘与文档回灌清单

## 1. 开发中碰到的技术坑

### T07 Pinia store 循环依赖（auth → playlist → player → auth）

**问题描述**：退出登录需要清空歌单/推荐 store，但直接静态导入形成循环；改用动态导入又触发 Vite 分包告警。

**解决方法**：
- `auth.logout()` 只派发 `lychee:logout` 事件。
- `App.vue` 监听并重置 playlist/recommend。
- 收藏状态由 `App.vue` 监听登录态清理。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.23/4.28 | 增加 | 跨 store 重置通过应用层事件完成，不在 store 内互相导入 |

### T11 QRC 文件格式与 preload 解密边界

**问题描述**：`CORE §4.66` 要求渲染进程同步解密 QRC；QRC 实际是 hex → 3DES-ECB（固定密钥，无自动填充）→ zlib → `LyricContent` XML。浏览器既无同步 DES，也无同步 zlib，Node crypto 不在渲染上下文；文档只写“QRC 密文”，既没有格式说明，也把解密函数放在 `qrc.ts`，函数边界不可实现。

**解决方法**：
- `qrc.ts` 保留 `decryptQrc`/`parseQrcLyric` 入口，负责 XML/逐字解析；无有效数据回退 LRC。
- 解密原语经 preload contextBridge 暴露同步 `lyric.decryptQrc`，使用 Node `createDecipheriv` + `inflateSync`。
- QRC 编码链：hex → 3DES-ECB（`!@#)(*$%123ZXC!@!@#)(NHL`，无自动填充）→ inflate → `LyricContent`。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.66 | 修改 | 明确“qrc.ts 解析、preload 解密”；补 QRC 编码链 |
| `CORE.html` | §4.2 | 增加 | `lyric.decryptQrc` |
| `PROVIDER.html` | §4.3 | 修改 | 增补 QRC 格式说明（hex/3DES-ECB/无填充/zlib） |

### T14 单实例锁、调试启动与 credential 测试

**问题描述**：已有 Lychee 实例运行时，再启动带 `--remote-debugging-port` 的进程会直接退出并唤醒旧窗口，调试端口连不上；独立 Electron 脚本读取 `credential.bin` 时，未设置 `password-store=gnome-libsecret` 会报“Decryption is not available”，单实例与调试端口也互相干扰。

**解决方法**：
- 调试前按 PID 结束旧实例；调试脚本固定读取 `/json/list`；正式行为保持单实例。
- 独立测试/调试脚本显式 `app.setName`、`app.setPath('userData')`、`app.commandLine.appendSwitch('password-store','gnome-libsecret')`。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `BUILD.html` | §9 | 修改 | 故障排查：第二个实例只会唤醒已有窗口；调试前先退出旧实例；补充密钥环/password-store 说明 |
| `CORE.html` | §1 | 修改 | 测试相关说明归入 `test/` 注释 |

## 2. 文档的错误指导

### D06 `CORE §4.1` 的 `Settings` 缺少音频引擎和下载目录

**问题描述**：`USER §5.2.7`、`BUILD §11` 要求选择音频引擎和下载目录，但 `Settings` 没有 `audioEngine`/`downloadDir`，无法持久化。

**解决方法**：
- 在 `Settings` 增加可选 `audioEngine: 'auto'|'html5'|'mpv'` 与 `downloadDir?: string`。
- 主进程 sanitize 并提供默认值；设置页即时写盘。
- `audioEngine` 的持久化字段保留；引擎切换功能尚未正式上线，文档按“预留/未上线”标注，不把它当作已交付能力，读取时仍对未知值回退 `auto`。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.1 | 修改 | 更新 `Settings` 定义；`audioEngine` 标注“预留/未上线” |
| `CORE.html` | §4.6 | 修改 | 补充默认值与 sanitize 说明；未知 `audioEngine` 回退 `auto` |
| `USER.html` | §5.2.7 | 修改 | 标明确切字段；`audioEngine` 切换标注“预留/未上线”，仅保留持久化契约 |

### D07 `CORE §4.2` 的 `LycheeApi` 缺少实际使用的接口

**问题描述**：实现需要 `flags.get/save`、`download.storage/openFolder/chooseFolder/clearCache`、`mpv.loadAndPlay/play/pause/stop/seek/setVolume/onEvent`、`lyric.decryptQrc`，文档接口没有。

**解决方法**：
- 在 preload 与 `LycheeApi` 扩展这些方法。
- 主进程注册对应 IPC。
- `lyric.decryptQrc` 的文档细节归 T11；本条只补接口入口，不重复描述 QRC 解密边界。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.2 | 修改 | 补 `flags`/`download`/`mpv` 接口 |
| `CORE.html` | §4.2 | 不动 | `lyric.decryptQrc` 由 T11 负责，避免覆盖 |
| `CORE.html` | §4.61/4.62 | 修改 | 补 mpv 控制面 |
| `CORE.html` | §4.66 | 不动 | QRC 桥接由 T11 负责，不重复修改 |

### D08 `PROVIDER` 把收藏/歌单写入标为“待探测”，`USER` 却承诺可收藏/可编辑

**问题描述**：文档一边说接口未验证，一边在 README/USER 描述完整功能；实现时只能先做 UI 或做未验证协议。

**解决方法**：
- 收藏已按签名通道实现。
- 歌单创建/改名/删除仍为占位。
- 推荐/MV 为空实现并显示提示；收藏按钮实心/空心、写后刷新已完成。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §3.5/4.1 | 修改 | 将收藏移出“待探测” |
| `USER.html` | — | 修改 | 对仍待探测的歌单编辑/MV/推荐增加“暂不可用/待探测”标记 |
| `README.html` | §2 | 修改 | 从用户交互表移除未验证功能，或增加“待探测”标记 |

### D10 `BUILD §11` 的音频缓存路径与实际目录层级不一致

**问题描述**：文档写 `userData/cache/audio/<musicid>/`，实现按 `<musicid>/<quality>/` 分目录，便于同曲多档缓存。

**解决方法**：
- 保留 `<musicid>/<quality>/` 结构。
- 缓存统计递归扫描；按账号隔离并做容量 LRU。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `BUILD.html` | §11 | 修改 | 更新音频缓存路径 |
| `CORE.html` | §4.58 | 修改 | 说明 quality 子目录 |

### D11 `USER §5.4` 声称托盘图标随播放状态更新，实际只更新菜单/tooltip

**问题描述**：没有播放/暂停两套托盘图标资源，代码只重建菜单和 tooltip；文档描述超出实现。

**解决方法**：
- 保持菜单、启用状态、tooltip 更新。
- 托盘图标不随播放状态变化，不保留切换承诺；实现排期时再加回。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.4 | 修改 | 删除“图标随播放状态更新”及两套图标切换描述；实现排期时再补回 |

### D12 `CORE §5.5` 使用 `tray::updateState`，签名和实现是 `updateTray`

**问题描述**：调用栈名称与 `CORE §4.19` 签名不一致，增加检索成本。

**解决方法**：
- 代码统一使用 `updateTray(state)`。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §5.5 | 修改 | 调用栈名称改为 `updateTray(state)`，并检查其他 `updateState` 引用 |

### D15 `CORE §1` 的测试树缺少实际测试文件

**问题描述**：`CORE §1` 的测试树只写 `test/api`，实际还有 `test/player-store.test.ts`、`test/startup-flags.test.ts` 与 `test/replay.ts`；`vitest.config.ts` 也存在 CJS 告警。

**解决方法**：
- 在 `CORE §1` 文件树补 `test/player-store.test.ts`、`test/startup-flags.test.ts`、`test/replay.ts`，并注明覆盖范围。
- 暂不调整 `vitest.config.ts` 文件名；如后续改为 `.mts`，再同步文件树与构建文档。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §1 | 修改 | 测试树补 `player-store.test.ts`、`startup-flags.test.ts`、`replay.ts` 及覆盖范围 |
| `CORE.html` | §1 | 不动 | mock 约定由 E15 负责，D15 只维护测试文件树 |
| `CORE.html` | §1 | 修改 | 可选：`vitest.config.ts` 改为 `.mts` 后同步文件树 |
| `BUILD.html` | §2 | 修改 | 可选：同步 vitest 配置文件名 |
| `BUILD.html` | §2 | 不动 | 测试 mock 说明由 E15 负责 |

### D16 `PROVIDER` 写歌单单页上限 100，应用分页、探测与 vkey 批量需统一

**问题描述**：上游歌单单次最多 100 首，应用固定 50/页；此前可用性探测上限 30、vkey 批量 20，导致一个 50 首歌单页要拆成两次探测，每次探测再拆成多次 vkey 请求。三个常量分别控制分页、探测批次和 vkey 请求批次，语义不同但取值需要协同。

**解决方法**：
- `PLAYLIST_PAGE_SIZE=50`：应用固定页大小；上游 100 只作为能力上限。
- `PROBE_MIDS_MAX=50`：与页大小对齐，一个 50 首歌单页一次 `song.probe`。
- `PROBE_VKEY_BATCH=50`：与探测批量对齐，一次探测一次 vkey 请求（每档音质）；`song.getUrls` 单次上限仍为 `IPC_SONG_MIDS_MAX=100`，内部按 50 分两次请求。
- 约束一：`PROBE_MIDS_MAX ≤ IPC_SONG_MIDS_MAX`。
- 约束二：`PROBE_VKEY_BATCH ≤ IPC_SONG_MIDS_MAX`。
- 约束三：推荐 `PROBE_MIDS_MAX = PLAYLIST_PAGE_SIZE`、`PROBE_VKEY_BATCH = PROBE_MIDS_MAX`；修改任一值时同步评估其余两个常量。
- `PROBE_MAX_SONGS` 继续由 `PLAYLIST_PAGE_SIZE × PLAYLIST_PAGE_MAX` 派生，不受前两个常量影响。
- `hasMore` 按实际批次与 total 判断，不把 total 当唯一依据。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1/4.3 | 修改 | 明确“上游单次最多 100，应用固定 50”；说明 vkey 请求按应用批量分块 |
| `CORE.html` | §4.50 | 修改 | 常量推荐值：`PROBE_MIDS_MAX=50`、`PROBE_VKEY_BATCH=50`；补充对齐关系与 `IPC_SONG_MIDS_MAX` 上限约束 |
| `CORE.html` | §4.11 | 修改 | 说明 `getStreamUrls` 按 `PROBE_VKEY_BATCH=50` 分块；单次 IPC 上限仍为 100 |
| `CORE.html` | §4.52 | 修改 | `probeAvailability`/`song.probe` 单次上限为 `PROBE_MIDS_MAX=50`；说明一页一次探测 |

### D17 `BUILD §5` 的安装脚本仓库占位符与实际默认值不一致

**状态**：已解决。

**问题描述**：文档写 `<owner>/lychee-player`，脚本默认 `lychee-player/lychee-player`；`--dry-run` 仍会请求 GitHub API 探测最新版本，不是纯离线打印。

**解决方法**：
- 默认仓库改为实际仓库 `54m43lJ/LycheePlayer`，继续支持 `LYCHEE_REPO` 覆盖。
- sha256 校验强制。
- 新增 `--local <tarball>`，开发测试时可直接安装本地构建产物，不再依赖 GitHub Release。
- 新增 `.github/workflows/release.yml`：推送 `v<version>` tag 后自动构建并创建 Release，`install.sh` 的下载路径因此闭环。
- 安装时把桌面项 `Exec` / `TryExec` 改写为实际入口绝对路径，避免 GUI 会话 PATH 缺少 `~/.local/bin` 时无法启动。
- dry-run 保留网络探测；文档已注明不是纯离线模式。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `BUILD.html` | §5 | 修改 | 写明实际仓库地址、`LYCHEE_REPO`、`--local`、桌面项绝对路径与 dry-run 行为 |
| `BUILD.html` | §5.1 | 新增 | tag 驱动的自动发布流程、手动补发与本地安装方式 |

## 3. 文档没有提及、只能自行探索的细节

### E01 zzc 签名与 `ag-1` 加密协议

**问题描述**：文档未给出算法、密钥、端点、请求体编码、响应解码。没有这些无法实现收藏写入。

**解决方法**：
- 按 MIT 的 qmweb-sign 固定源码实现：SHA1 十六进制、指定索引、SCRAMBLE XOR + Base64 去 `+/=`、zzc 前缀。
- AES-128-GCM 随机 12 字节 IV，body 为 base64。
- 响应逐字节 XOR 后 UTF-8/JSON。
- 端点 `u6.y.qq.com/cgi-bin/musics.fcg?encoding=ag-1&sign=...`。
- 使用 Node crypto，不新增依赖。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §3.5/§4.1 | 增加 | “QQ Web 签名/加密协议”小节：算法来源、固定密钥、编码与响应解码 |
| `CORE.html` | §4.54 | 修改 | 引用该协议小节 |

### E02 收藏状态与写入的真实接口

**问题描述**：文档只写“收藏/歌单写入待探测”，没有 `SongFavRead/IsSongFanByMid`、`m_fan` 结构、201 目录参数字段。

**解决方法**：
- 读取用 `SongFavRead/IsSongFanByMid` 的 `v_songMid` 批量。
- 写入用 `PlaylistDetailWrite/AddSonglist|DelSonglist` 的 `dirId:201` + `v_songInfo:[{songId,songType}]`。
- 写后读回确认。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1 | 增加 | 两个接口和参数 |
| `PROVIDER.html` | §4.3 | 增加 | `m_fan`/`v_songInfo` 数据模型 |

### E07 自定义协议设计细节

**问题描述**：文档的 `audioProtocolUrl(filePath)` 只覆盖缓存文件，未说明未缓存流如何通过本地协议代理；同时没有定义 Range、Content-Range、Content-Length、Accept-Ranges 和回退策略。`CORE §4.59` 需要把 URL/token 设计与响应头/缓存协议放在同一份契约里，否则缓存命中、未缓存 stream、Range 请求和 mpv 复用会互相矛盾。

**解决方法**：
- URL 形式：`lychee-audio://stream/<token>` 与 `lychee-audio://file/<base64>`；stream token 映射上游 URL；scheme 在模块加载时注册 privileges，ready 后 handle。
- 响应协议：206 必须带 `Content-Range` 与 `Content-Length`，并声明 `Accept-Ranges: bytes`；200 或完整 206 才缓存；局部 Range 直接透传，不缓存；缓存文件手工切片响应；`Cache-Control: no-store`。
- 兼容规则：缓存命中走 `file` 分支，不需要 vkey；未命中走 `stream` 分支，token 解析为上游 URL 并转发 Range；局部 206 不落盘，完整响应才写入缓存。
- HTML5 与 mpv 共用同一套 URL/token 语义；mpv 通过 `resolveProtocolSource` 解析为本地缓存文件或上游 URL。
- `CORE §4.59` 应改成一张协议表，至少覆盖：URL 分支、上游状态、响应状态、必带响应头、是否缓存、回退条件；`CORE §4.62` 只描述 mpv 如何复用，不重复协议表。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.59 | 修改 | 合并为一张协议表：URL/token、缓存/流分支、Range/响应头、完整/局部响应、回退规则与兼容关系 |
| `CORE.html` | §4.62 | 修改 | 说明 mpv 如何复用 URL/token 与缓存文件，不重复 §4.59 的协议表 |
| `PROVIDER.html` | §3.3 | 修改 | 说明上游 Range 行为及 200/206 兼容要求 |
| `USER.html` | §3.1 | 修改 | 说明 seek 分段加载、缓存命中/未命中行为 |

### E08 启动参数文件必须在 ready 前同步读取

**问题描述**：文档要求模块加载阶段读取并应用，但 `readFlagsFile()` 是异步签名；同步等待不可行。

**解决方法**：
- `applyFlagsFromDisk()` 用 `readFileSync` 在导入时执行默认 flags + 文件 flags。
- 设置页仍用异步 `readFlagsFile/writeFlagsFile`。
- 限制 8 KiB、64 行并过滤非法 switch。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.51/5.2 | 修改 | 明确同步/异步两个入口 |
| `BUILD.html` | §10 | 修改 | 补限制与优先级 |

### E09 electron-builder 的资源路径、原生依赖与桌面文件

**问题描述**：文档只列产物，没有说明 `process.resourcesPath`、`extraResources`、`build/` 图标和桌面文件由谁生成；`electron-builder` 26.x 还会拒绝 `linux.desktop` 自定义字段，`mpris-service` 的 `abstract-socket` 原生模块需要 rebuild。

**解决方法**：
- `extraResources` 复制 icon/tray；`build/icon.png` 供 builder 使用。
- 移除 `linux.desktop` 配置，改由 `packaging/arch/lychee-player.desktop` 和打包脚本写入 tar 顶层。
- 依赖 `electron-builder` 自带 rebuild；实际执行 `electron-builder --linux dir` 和打包校验。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `BUILD.html` | §3/§4 | 修改 | 补 `electron-builder.yml` 的关键字段、图标路径、原生模块和桌面文件生成方式 |
| `CORE.html` | §1 | 修改 | 标注 `build/`、`packaging/` 的用途 |

### E14 下载暂停/继续与封面细节

**问题描述**：文档只给 `writePart(url, filePath)`，未说明 Range 续传、`.part`、临时文件、封面本地化、下载目录和失败重试。

**解决方法**：
- 任务内保存 AbortController；暂停保留 `.part`；继续使用 Range。
- 完成后重命名；封面下载为同名 `.jpg`。
- 只对失败任务手动继续；任务当前仅内存保存。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.60 | 修改 | 补下载状态机 |
| `BUILD.html` | §11 | 修改 | 注明任务不跨重启、目录默认值 |

### E15 Vitest 与 Electron/原生模块的导入和 mock 边界

**问题描述**：文档只给测试目标，没有说明导入链会经过 `credential`、`audio-protocol` 等主进程模块，Vitest 缺少 `electron.protocol` 会直接失败；player store 又依赖 `Audio`、localStorage 和 `window.lychee`。

**解决方法**：
- `vi.mock('electron')` 提供最小 app/safeStorage/protocol/net。
- player 测试 mock `AudioEngine`、localStorage、`window.lychee`；fixture 用 `Response` 替换 fetch。
- 测试文件清单和 vitest 配置文件名归 D15。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §1 | 修改 | `test/` 与 `test/replay.ts` 注释补 mock 约定 |
| `CORE.html` | §1 | 不动 | 测试文件树由 D15 负责 |
| `BUILD.html` | §2 | 修改 | 说明测试环境为何需要 mock Electron/原生协议、音频引擎与 `window.lychee`；测试默认不触网 |
| `BUILD.html` | §2 | 不动 | vitest 配置文件名由 D15 负责 |

## 4. 刚刚修复的 ISSUES

### I01 音量弹出点击别处不关闭

**问题描述**：旧实现用 z-index 低于播放条的遮罩，点击播放条按钮不关闭，且遮罩会吞掉页面点击。

**解决方法**：
- 删除遮罩；document 捕获阶段监听点击，用 qualityWrap/volumeWrap ref 判断内外。
- 外部点击关闭且不阻断目标点击；音质菜单共用逻辑。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.3 | 修改 | 补“音质/音量弹层点击外部关闭且点击穿透” |
| `CORE.html` | §4.40 | 修改 | 说明捕获阶段监听 |

### I02 窗口最小尺寸与滚动兜底机制

**问题描述**：最初按“不设置最小高度和宽度”实现，但导航、播放条等元素不能无限压缩；后续改为设置统一的最小布局阈值，低于阈值时启用整窗纵向/横向滚动。当前实现只完成了高度路径（移除 `minHeight`、`.app-shell` 最小高度、body 纵向滚动），宽度仍依赖 `BrowserWindow.minWidth=280`，缺少横向滚动兜底，宽高处理机制不一致。

**解决方法**：
- 宽度与高度统一使用“布局最小阈值 + 整窗滚动兜底”，不以 `BrowserWindow.minWidth`/`minHeight` 作为主要策略。
- `.app-shell` 同时声明 `min-width`/`min-height`，阈值由不可压缩的导航、播放条和内容最小宽度决定。
- 正常范围：响应式断点继续压缩；侧栏导航高度不足时内部纵向滚动，账号入口固定；内容区独立滚动，播放条贴底。
- 低于阈值：布局停止压缩，body/窗口出现纵向和横向滚动条；导航、账号入口、播放条仍可到达，不继续挤压。
- 代码现状：宽度与高度均已完成；`BrowserWindow` 不再设置 `minWidth`/`minHeight`，阈值由 `--layout-min-width`/`--layout-min-height` 与 `body` 双向滚动承担。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.1 | 修改 | 重写窗口/布局契约：宽度与高度统一为“布局最小阈值 + 整窗双向滚动”；删除“最小 280×440”“宽度最小 280”“高度不设下限”等旧表述 |
| `USER.html` | §5.2.2/5.2.3 | 修改 | 说明导航在高度不足时内部纵向滚动、账号入口固定；低于整窗阈值时随页滚动，播放条不被压缩 |
| `CORE.html` | §4.4 | 修改 | `createMainWindow` 不以 `minWidth`/`minHeight` 作为主要策略；同步窗口创建与布局阈值契约 |
| `CORE.html` | §4.49 | 修改 | `main.css` 增加统一 `min-width`/`min-height` 与双向 `overflow`；说明导航内部滚动、内容区滚动、整窗滚动的层级 |

### I03 矮窗口账号图标应常驻、播放条应贴底

**问题描述**：矮窗口下账号入口可能被导航挤走，播放条位置不稳定。

**解决方法**：
- 侧栏 flex 中 nav `flex:1; min-height:0; overflow-y:auto`，foot `flex:0 0 auto`。
- 播放条固定在 grid 第二行；极矮时按 I02 整页滚动。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.2/5.2.3 | 修改 | 补“账号入口固定、导航先滚动、播放条贴底” |

### I04 歌单横向填不满、操作列处行线断开

**问题描述**：内容区 max-width 1240 在大窗口留白；操作 td 设置 `display:flex` 破坏 table-cell，导致行线断、列宽异常。

**解决方法**：
- `.page` 全宽；操作单元格内部 `.song-action-inner` 使用 flex。
- 行边框改挂 `tr`；表格 width 100%。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.1/5.2.4 | 修改 | 内容区铺满可用宽度（如限制需明确例外）；操作单元格不得用 `td display:flex`；行线挂 `tr` |
| `CORE.html` | §4.49 | 修改 | 补禁止 `td display:flex` 的实现约束 |

### I05 操作列应在时长列左边，列标题左对齐

**问题描述**：原型和旧实现都是时长在操作前，且表头右对齐，视觉不统一。

**解决方法**：
- 列顺序改为 `# / 标题 / 专辑 / 操作 / 时长`。
- 所有 `th` 左对齐；操作与时长单元格左对齐。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.4 | 修改 | 同步原型、列顺序与 `th` 左对齐 |
| `CORE.html` | §4.39 | 修改 | 同步 `SongTable` 说明 |

### I06 下一首播放按钮需用加号

**问题描述**：文字“下一首”视觉过重；用户要求恢复加号图标。

**解决方法**：
- 操作列使用加号图标按钮，保留 tooltip/aria-label 与不可播禁用。
- 不再使用固定槽布局。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.4 | 修改 | 将“下一首按钮”标注为加号图标，并说明操作列顺序 |

### I07 播放约 1 分钟后报“音频加载失败”

**问题描述**：旧代理不处理 Range，浏览器 seek/重新缓冲时不断请求完整文件，最终链接过期或请求异常；只提示错误。

**解决方法**：
- Range 透传 + 完整响应缓存。
- 播放错误自动刷新一次链接（30 秒节流），保留原位置。
- 实测播放 81 秒无错误。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §3.3 | 修改 | 改自动重取策略 |
| `USER.html` | §5.3 | 修改 | 补提示与重试说明 |
| `CORE.html` | §4.29/5.5 | 修改 | 补 `onError` 错误驱动重载路径 |

### I08 歌曲 seek 崩溃、未缓存歌曲 seek 要等待

**问题描述**：seek 只在 duration 有限时生效；代理不转 Range，未缓存时只能顺序 stream。

**解决方法**：
- AudioEngine 在 duration 未知时也设置 `currentTime`。
- 代理始终转发 Range；缓存文件支持 206。
- 播放器加 seek 看门狗。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.27/4.58/4.59 | 修改 | 补 seek、Range 与缓存协议 |
| `USER.html` | §3.1 | 修改 | 说明未缓存 seek 由主进程分段取流 |

### I09 多次 seek 后续不生效

**问题描述**：首次 seek 后浏览器再次发起 Range 时，旧代理返回整段 200，导致后续定位等待或失败。

**解决方法**：
- 每次 Range 都转发并返回 206/Content-Range。
- 1.2 秒未到达目标的看门狗重发一次定位；缓存和未缓存路径均验证连续 seek。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.29 | 修改 | 记录 seek 看门狗 |
| `CORE.html` | §4.59 | 修改 | 记录多 Range 行为 |

### I10 播放队列为空（已由 I20 取代）

**问题描述**：队列只在歌单 complete 后构建；可用性过滤可能排除当前曲；部分加载/失败时一直为空。

**解决方法**：
- 早期方案：任意已加载页即构建、播放/翻页/轮询同步、移除构建期可用性过滤、当前不在列表时回退全列表减当前。
- 该方案已被 I20 的“歌单快照 → 队列”临时/最终快照机制取代；实现与文档以 I20 为准。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.9 | 修改 | 按 I20 重写队列快照机制 |
| `CORE.html` | §4.29/5.12 | 修改 | 按 I20 重写队列快照机制 |

### I11 收藏按钮实心/空心与切换

**问题描述**：最初只有空心 heart，且后端待探测导致点击回滚；用户要求状态与点按效果一致。

**解决方法**：
- 增加 `heart-filled` 图标；SongTable/PlayerBar 根据 `favoriteMids`/`favorites` 选择图标。
- 写操作乐观更新、失败回滚；成功后主动刷新“我喜欢”。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.3/5.2.4 | 修改 | 补实心/空心图标与点击文案 |
| `CORE.html` | §4.39/4.40 | 修改 | 补状态来源 |

### I12 收藏 invalid request 与网页会话 Cookie

**问题描述**：旧 `fcg_music_add2songdir.fcg` 使用最小 Cookie 返回 `403 invalid request/no permit`；改用签名写入后，除 musickey 外还依赖 `p_skey`/`skey` 等网页会话 Cookie。初版扫码登录清理 xlogin 分区后未保存这些 Cookie，Cookie 登录也只提取 uin/qm_keyst，导致普通请求可用但收藏签名写入仍可能 80105。

**解决方法**：
- 放弃旧 CGI，改用签名加密的 `u6.y.qq.com` 通道。
- `Credential` 增加可选 `webCookies`；扫码成功清理前抓取 qq.com Cookie；Cookie 登录保留完整 Cookie jar；密钥环加密保存。
- 请求头合并；`g_tk` 优先 `skey → qqmusic_key → qm_keyst`，`g_tk_new_20200303` 优先 `qqmusic_key → p_skey → skey → ...`。
- 凭证仅主进程持有，不跨 IPC。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §3.5 | 修改 | 记录旧 CGI 不可用 |
| `PROVIDER.html` | §4.1 | 修改 | 改为签名通道 |
| `PROVIDER.html` | §4.3 | 修改 | `Credential` 增加 `webCookies`（仅主进程，加密保存） |
| `CORE.html` | §4.1/4.7 | 修改 | 同步 `Credential` 与凭证生命周期 |
| `CORE.html` | §2 | 增加 | `g_tk` 计算规则 |
| `USER.html` | §2 | 修改 | 说明凭证仅主进程持有，不会跨 IPC |

### I13 收藏上游 80105 与隐藏记录

**问题描述**：明文通道返回 80105；详情 `type=0` 不能直接用于 201，错误 `songType` 可能返回 80105 或生成隐藏记录。旧实现曾以业务码 0、状态读回 true、总数 +1 判定成功，但 `CgiGetDiss` 和官方 App 看不到该歌曲；这是内部一致性 bug，最终状态不应让用户看到“假成功”。

**解决方法**：
- 使用真实 `songType`，不用 0 兜底。
- 不以业务码、状态接口或总数增加单独判定成功；写后用 `CgiGetDiss`/状态读回校验成员可见性。
- 收藏状态以读回结果为准，失败回滚，不显示假成功。
- 错误 80105 提示重新登录同步网页会话；1101 等按类型提示。
- 不再用类型 1 兜底；清理测试产生的隐藏记录并恢复歌单数量。
- 按 2001 短暂重试。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `PROVIDER.html` | §4.1 | 修改 | 增补 201 目录写入参数和限制 |
| `PROVIDER.html` | §4.2 | 修改 | 增补 80105/1101 说明 |
| `PROVIDER.html` | §4.3 | 修改 | 明确 `songType` 来源与 201 目录约束，不能用 0 兜底 |
| `CORE.html` | §4.54 | 修改 | 补实际签名通道与读回确认；注明“total/songlist 可能滞后或过滤；总数增加/状态读回 true 不等于成员可见，必须校验列表”；记录隐藏记录风险 |
| `USER.html` | §5.3 | 修改 | 增加 80105 错误文案（不描述假成功） |

### I14 未缓存歌曲首次 seek 立即生效，后续 seek 不生效

**问题描述**：实测问题来自 Range 处理不完整；后续 Range 被当成完整请求重新下载。

**解决方法**：
- 同 I09：每个 Range 独立转发，不缓存局部 206。
- 连续 seek 2:00→0:30→2:20 实测通过；缓存文件多段 seek 也通过。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.59 | 修改 | 明确“每个 Range 独立转发，不缓存局部 206” |
| `CORE.html` | §4.29 | 修改 | 补看门狗 |

### I15 VIP / 音质标记在窄窗口被裁掉

**问题描述**：标题使用 ellipsis，长歌名把 VIP/FLAC 徽标一起裁掉；窄窗口优先压缩的是徽标而不是歌名。

**解决方法**：
- 标题拆成可压缩的 `.song-title-text` 与固定 `flex:0 0 auto` 的 `.pay-badge/.quality-badge`。
- 500px 宽实测徽标全部可见。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.4 | 修改 | 补“徽标常驻、标题优先省略” |
| `CORE.html` | §4.39 | 修改 | 说明 DOM 结构 |

### I16 歌单 stale 5 秒 + 15 秒轮询

**问题描述**：30 秒 TTL 让收藏/外部修改长时间不同步；没有主动检查机制。

**解决方法**：
- `PLAYLIST_CACHE_TTL_MS=5_000`；`PLAYLIST_POLL_INTERVAL_MS=15_000`。
- 仅 `document.visibilityState === 'visible'` 时轮询；store 内 `polling` 防重入。
- 比较总数/meta/首页顺序；变化后重置列表并继续补页，队列同步在同一流程中完成。
- I20 已改为整份歌单缓存并删除该 TTL 常量。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.50/4.63 | 修改 | 同步轮询行为；缓存 TTL 相关描述以 I20 为准 |
| `USER.html` | §2/§5.2.8 | 修改 | 同步轮询与自动刷新行为 |

### I17 收藏/取消收藏后主动刷新歌单

**问题描述**：收藏成功后“我喜欢”歌单和“我的歌单”卡片仍显示旧数据，需要等轮询或重进页面。

**解决方法**：
- `favoriteVersion` 版本号；成功后 `playlist.invalidate('liked')`。
- 已打开的 liked feed 立即 `poll`；LibraryView 监听版本重新拉取歌单列表；失败不刷新。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `USER.html` | §2/§5.2.4 | 修改 | 补“收藏后立即刷新我喜欢与歌单卡片” |
| `CORE.html` | §4.65 | 修改 | 补 `favoriteVersion`、`invalidate` 调用关系 |
| `CORE.html` | §4.63 | 修改 | 补 `poll/invalidate` |

### I18 移除全局快捷键模块

**问题描述**：用户明确要求不做全局快捷键；代码仍有 `integration/global-shortcuts.ts`，启动时按 `Settings.shortcuts` 注册 `Ctrl+Alt+Space` 等全局快捷键，设置页也提供录制入口，文档同步描述了该模块。

**解决方法**：
- 删除主进程模块与启动/退出注册。
- 移除 `Settings.shortcuts`、默认值、sanitize 与设置 IPC 重注册。
- 删除设置页快捷键面板及样式。
- 同步清理文档并重排 `CORE §4` 后续编号。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §1/4.1/4.48/5.1/5.8.2 | 修改 | 移除全局快捷键模块、类型、签名与调用栈 |
| `USER.html` | §1/5.2.7 | 修改 | 移除快捷键术语、设置项与原型 |
| `README.html` | §1.1/2 | 修改 | 移除快捷键设置项 |

### I19 “我喜欢”歌单加载中断后重试无效、轮询不恢复

**问题描述**：预取/首屏只缓存 50 首；补全请求 `offset=50` 时主进程仍直接返回缓存切片，得到空页，store 以“歌单加载停滞”中断，重试重复同一路径；15 秒轮询在首页未变化时只清除 `error`，不重启补全；底部“已载入 50 / 667 首”左侧的 spinner 因缺少布局样式显示成异常元素。

**解决方法**：
- store 增加 `completingToken` 单实例补全；`retry` 支持无 `meta` 时从头加载；`poll` 在 `error`/`partial` 时恢复补全。
- `.feed-footer` 改为 flex；`.spinner` 增加 `inline-block`/`flex:none`。
- 缓存分页命中/回源的临时修复已由 I20 的整份歌单缓存取代；新增 store 恢复与整份缓存测试。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.63 | 修改 | 补 `completingToken` 与 `retry`/`poll` 恢复逻辑 |
| `CORE.html` | §4.49 | 修改 | 补 `.feed-footer`/`.spinner` 布局 |
| `USER.html` | §5.2.8 | 修改 | 补“加载中断可重试恢复、轮询自动续传、底部 spinner 正常显示” |

### I20 队列快照时机、缓存临时顶替与整份歌单缓存

**问题描述**：不可播歌曲先入队、播放时再逐个跳过；队列构建只按当时已知可用性过滤。歌单缓存按页读写，存在 partial/complete、页覆盖/合并、prefetch 第一页与 TTL 等状态；中断或缺页时缓存不落盘，无法区分完整与不完整快照。本条统一记录“歌单延迟加载与队列”的关系。

**解决方法**：
- 队列只在“歌单快照 → 队列”边界过滤。
- 最终快照要求分页全部加载完成、非 stale、所有歌曲的 VIP/最高音质/可用性探测完成。
- 未完成前只允许一次临时快照顶替（优先整份缓存；无缓存时用当前已载入快照）。
- 最新快照就绪后按签名比较，有变化则替换；当前曲、进度与历史不变。
- 播放器只负责追加/替换，不做检测/清理；播放时仍独立校验取流。
- 缓存改为整份歌单快照：`playlist.get` 仅分页加载，`playlist.getCached` 读整份，`playlist.saveCache` 写整份；每页成功即落盘，`complete` 标记完整/不完整。
- 网络中断、空页停滞、`hasMore=false` 但 `songs.length < total` 均置 error/`complete=false`；不完整缓存仅作临时快照并触发重载。
- 删除页级缓存、prefetch、TTL/并发常量。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §4.12/4.50/4.57/5.10/5.12 | 修改 | 更新为“分页加载、整份歌单缓存、`complete` 标记、逐页落盘” |
| `CORE.html` | §4.29/4.46/4.63 | 修改 | 更新队列快照时机、临时顶替与最终替换 |
| `USER.html` | §2/§5.2.8/§5.2.9 | 修改 | 说明缓存临时顶替、重试/自动刷新、不完整缓存提示 |
| `CORE.html` | §4.50 | 删除 | `PLAYLIST_CACHE_TTL_MS`、`PLAYLIST_PREFETCH_CONCURRENCY` 与 prefetch 描述 |

### I21 播放队列移除专辑名显示

**问题描述**：队列行同时显示序号、封面、歌名、歌手、专辑与移除按钮，列过密；专辑列挤压歌名/歌手，窄面板下文字重叠。

**解决方法**：
- 删除队列行的 `.queue-album` 元素及样式。
- 网格改为 `20px 38px minmax(0, 1fr) 40px`；队列内歌名改为单行省略号，歌曲文本容器隐藏溢出。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `USER.html` | §5.2.9 | 修改 | 队列原型与说明删除专辑列 |
| `CORE.html` | §4.23 | 修改 | 补队列行字段与布局约束 |

### I22 flags 文件与内置默认会覆盖显式命令行

**问题描述**：`CORE §5.2` 约定“显式命令行 > flags 文件 > 环境变量 > 内置默认”，但 `applyFlagsFromDisk()` 原先先追加内置默认、再追加文件 flags，且未检查同名 switch 是否已存在；`app.commandLine.appendSwitch()` 会覆盖已有值，导致文件 flags 覆盖显式命令行，`password-store`/`autoplay-policy` 默认值也会覆盖显式命令行。

**解决方法**：
- `applyFlagsFromDisk()` 改为先应用文件 flags、再应用内置默认。
- `applyStartupFlags()` 跳过 `process.argv` 中已有的同名 switch。
- `applyDefaultFlags()` 用 `app.commandLine.hasSwitch()` 跳过已设置的 switch。
- 最终优先级为显式命令行 > flags 文件 > 内置默认；`--ozone-platform` 的环境变量分支仍在 `configureLinuxDisplay()` 中保持命令行/文件优先。
- 新增 `test/startup-flags.test.ts` 覆盖三种优先级。

**文档操作**：

| 文档 | 小节号 | 操作 | 内容 |
|---|---|---|---|
| `CORE.html` | §5.2 | 修改 | 调用树改为文件 flags 先应用、默认后应用；注明 `appendSwitch` 会覆盖同名 switch、优先级必须显式检查 |
| `CORE.html` | §4.51 | 修改 | 补 `applyFlagsFromDisk`/`readFlagsFile`/`writeFlagsFile` 三个入口的职责与优先级 |
| `BUILD.html` | §10 | 修改 | 同步启动参数优先级 |
| `CORE.html` | §1 | 修改 | `test/` 补 `startup-flags.test.ts` |
