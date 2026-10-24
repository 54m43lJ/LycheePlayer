# IMPL — 实现复盘与文档回灌清单

> 来源：本轮文档合并、全量重构、`ISSUES.md` 验收修复，以及实际 Electron 运行验证。
>
> 勾选框表示“建议的文档操作”尚未执行；对应代码修复均已完成。`ISSUES.md` 未修改。

## 1. 开发中碰到的技术坑

- [ ] **T01 `docs/evol-1` 是纯文档分支，直接合并会删除全部源码**
  - **问题描述**：该分支从旧提交起只保留文档，合并进 `dev/evol-1` 时，所有源码、配置和资源都形成 modify/delete 冲突；按普通合并处理会直接清空项目。
  - **解决方法**：使用 `git merge --no-commit`，文档文件取 `docs/evol-1` 版本；`src/`、`scripts/`、`resources/`、`package.json`、`package-lock.json`、`tsconfig*`、`electron.vite.config.ts` 全部恢复为 HEAD；按文档分支删除 `TODO.md`。提交 `e49c608` 只包含文档变更。
  - **建议的文档操作**：在 `GUIDELINES.md` 增加“文档分支同步流程”，明确文档分支不得删除代码文件，或在同步时按目录白名单合并；`BUILD.html` 可补一段开发者同步说明。

- [ ] **T02 文档描述的模块远多于实际代码，重构等于补齐半个项目**
  - **问题描述**：`CORE.html` 文件树列出了缓存、下载、mpv、MV、推荐、收藏、歌单编辑、启动参数、全局快捷键、打包与测试等大量尚不存在的模块；`USER`/`README` 也描述了对应界面。
  - **解决方法**：按文件树补齐模块与签名，渲染层补齐路由、store、组件和页面；上游未验证功能（推荐、MV、歌单写入）保留明确占位和错误提示。提交 `58ba726`。
  - **建议的文档操作**：`CORE §1` 为每个条目增加状态标记（已实现/待探测）；`GUIDELINES.md` 增加“文档可以描述目标结构，但必须有状态标记”的规则，避免把目标结构误读为现状。

- [ ] **T03 Electron 模块加载阶段不能任意调用 `app.getPath()`，但 flags 和自定义协议必须提前执行**
  - **问题描述**：设置默认值在模块导入时调用 `app.getPath('music')`，在 `whenReady` 前可能抛错；启动参数文件是异步读取，无法在模块加载阶段应用；自定义协议又必须在 ready 前注册 scheme。
  - **解决方法**：`settings` 改为懒加载默认值；`startup-flags` 增加同步读取/应用入口 `applyFlagsFromDisk()`；`audio-protocol` 在模块导入时调用 `protocol.registerSchemesAsPrivileged()`，ready 后再 `protocol.handle()`。
  - **建议的文档操作**：`CORE §5.1/5.2` 明确“模块加载阶段做什么、bootstrap 做什么”；`CORE §4.6/4.51` 补懒加载与同步应用说明。

- [ ] **T04 主进程音频代理忽略 Range，导致 seek 等待、连续 seek 失败和播放中断**
  - **问题描述**：初版 `lychee-audio://` 对 Range 请求始终返回完整 200；浏览器 seek 后仍从头下载，未缓存歌曲要等 stream 到目标位置，连续 seek 容易卡住；用户还观察到播放约 1 分钟后报“音频加载失败”。
  - **解决方法**：始终转发 `Range`；上游 206 原样透传；完整 200 或完整 206 才边播边缓存；缓存文件实现 206/Content-Range/Content-Length/Accept-Ranges；播放器增加 1.2 秒 seek 看门狗，必要时重新定位。连续 seek 与 80 秒以上播放已实测通过。
  - **建议的文档操作**：`CORE §4.58/4.59` 补完整 Range/缓存协议；`USER §3.1` 明确 seek 分段加载；`PROVIDER §3.3` 补 `Accept-Ranges/Content-Range` 契约。

- [ ] **T05 文档写“不会自动重新获取链接”，但实际需要一次自动恢复**
  - **问题描述**：`PROVIDER §3.3` 声明 vkey 失效后不自动重新获取；实测网络抖动/链接过期会造成一次播放中断，仅提示错误体验很差。
  - **解决方法**：`player.onError` 对同一歌曲最多每 30 秒自动重新取一次链接，并保留原播放位置；再次失败才提示。该策略与文档现有描述冲突。
  - **建议的文档操作**：`PROVIDER §3.3` 把“不会自动重新获取链接”改为“错误后最多自动重取一次，仍失败则提示”；`CORE §4.29/5.5` 补 `onError` 路径。

- [ ] **T06 队列按“歌单完整加载后才补齐”实现，造成队列长时间为空**
  - **问题描述**：`USER §5.2.9`/`CORE §5.12` 要求完整加载后补队列；实际分页慢、失败或用户提前播放时队列一直为空。可用性过滤还可能把当前歌曲排除，进一步导致空队列。
  - **解决方法**：任意已载入页面都可构建/更新队列；每页加载、轮询和播放开始时同步；当前歌曲不在列表中时回退为“列表除当前曲外的全部”；移除队列构建时的可用性过滤，由播放失败自动跳过兜底。增加队列回归测试。
  - **建议的文档操作**：`USER §5.2.9` 和 `CORE §4.29/5.12` 改为“已加载页面即可增量补齐”；明确不可播过滤发生在播放尝试，不阻塞队列构建。

- [ ] **T07 Pinia store 循环依赖（auth → playlist → player → auth）**
  - **问题描述**：退出登录需要清空歌单/推荐 store，但直接静态导入形成循环；改用动态导入又触发 Vite 分包告警。
  - **解决方法**：`auth.logout()` 只派发 `lychee:logout` 事件；`App.vue` 监听并重置 playlist/recommend；收藏状态由 `App.vue` 监听登录态清理。
  - **建议的文档操作**：`CORE §4.23/4.28` 补“跨 store 重置通过应用层事件完成，不在 store 内互相导入”。

- [ ] **T08 收藏写入不是普通 musicu：旧 CGI 返回 invalid request，明文通道返回 80105**
  - **问题描述**：`fcg_music_add2songdir.fcg` 在最小 Cookie 下返回 `403 invalid request / no permit`；明文 `PlaylistDetailWrite/AddSonglist` 返回 `80105`。QQ 官网对 201 目录使用 zzc 签名 + `ag-1` AES-128-GCM 通道。
  - **解决方法**：实现 zzc 签名、AES-128-GCM 加密、`u6.y.qq.com/cgi-bin/musics.fcg?encoding=ag-1&sign=...`、响应 XOR 解码；收藏状态改用 `SongFavRead/IsSongFanByMid`；写入后读回状态；按 2001 短暂重试。
  - **建议的文档操作**：`PROVIDER §3.5/§4.1` 删除“收藏待探测”，新增“红心签名加密协议”小节；`CORE §4.54` 补实际通道与读回确认；`SBOM` 无需新增依赖（使用 Node crypto）。

- [ ] **T09 收藏 `songType` 用错会“成功”但写入隐藏记录**
  - **问题描述**：用详情 `type=0` 添加时常返回 80105；强行改成 1/5 后业务码为 0、状态读回为 true、歌单总数也加 1，但歌曲不出现在 `CgiGetDiss`，官方 App 也不可见。这是假成功，用户已在 ISSUES 中确认。
  - **解决方法**：恢复使用真实 `songType`；不再用业务码/状态接口单独判断成功；保留写后读回与歌单轮询；80105 明确提示重新登录同步网页会话。之前的隐藏测试记录均已删除并恢复数量。
  - **建议的文档操作**：`PROVIDER §4.3` 补 `songType` 来源与 201 目录约束；`CORE §4.54` 注明“总数增加不等于成员可见，必须校验列表/读回”；`USER §5.3` 增加对应错误文案。

- [ ] **T10 扫码登录只保存 musickey，丢失网页会话 Cookie**
  - **问题描述**：签名写入除音乐 key 外还依赖 `p_skey` / `skey` 等网页会话 Cookie；初版扫码登录清理 xlogin 分区后未保存这些 Cookie，Cookie 登录也只提取 uin/qm_keyst。
  - **解决方法**：`Credential` 增加可选 `webCookies`；扫码成功时在清理前抓取 qq.com Cookie；Cookie 登录保留完整 Cookie jar；请求头合并、`g_tk`/`g_tk_new_20200303` 按 Cookie 优先级计算；密钥环加密保存。旧凭证需重新登录一次补齐。
  - **建议的文档操作**：`PROVIDER §4.3` 的 `Credential` 增加 `webCookies`（仅主进程）；`CORE §4.1/4.7` 同步；`USER §2` 说明重新登录可刷新网页会话，但凭证仍不会跨 IPC。

- [ ] **T11 QRC 解密在渲染层缺少同步 crypto/zlib**
  - **问题描述**：`CORE §4.67` 要求渲染进程同步解密 QRC；QRC 实际是 hex → 3DES-ECB → zlib；浏览器既无同步 DES，也无同步 zlib，Node crypto 不在渲染上下文。
  - **解决方法**：preload（仍属渲染进程）通过 contextBridge 暴露同步 `lyric.decryptQrc`，使用 Node `createDecipheriv` + `inflateSync`；`qrc.ts` 再做 XML/逐字解析，无法解密时保留 LRC 回退。
  - **建议的文档操作**：`CORE §4.67` 明确“解密在 preload 桥接内完成”；`CORE §4.2` 补 `lyric.decryptQrc`；`PROVIDER §4.3` 补 QRC 格式说明。

- [ ] **T12 Electron 打包与原生依赖细节未在文档中体现**
  - **问题描述**：打包后图标/托盘路径需要 `process.resourcesPath`，而 `electron-builder` 的 `linux.desktop` 自定义字段在 26.x 会校验失败；`mpris-service` 的 `abstract-socket` 原生模块需要 rebuild。
  - **解决方法**：`extraResources` 复制 `icon.png`/`tray.png`；移除 `linux.desktop` 配置，改由 `scripts/package-arch.mjs` 写入桌面文件；依赖 `electron-builder` 自带 rebuild；实际执行 `electron-builder --linux dir` 和打包校验。
  - **建议的文档操作**：`BUILD §3/§4` 补 `electron-builder.yml` 的关键字段、图标路径和原生模块说明；`CORE §1` 的 `build/`、`packaging/` 用途可补一句。

- [ ] **T13 测试环境导入链会拉起 Electron/原生协议**
  - **问题描述**：测试 `api/search` 时，导入链经过 `credential`、`audio-protocol`，Vitest 因缺少 `electron.protocol` 直接失败；player store 又依赖 `Audio`、localStorage 和 `window.lychee`。
  - **解决方法**：对 `electron` 的 `app/safeStorage/protocol/net` 做 mock；player store 测试 mock 音频引擎与 `window.lychee`，并加入队列回归测试。`vitest.config.ts` 的 CJS 警告暂不处理（项目不能设 `"type":"module"`）。
  - **建议的文档操作**：`CORE §1` 的 `test/` 增加 `player-store.test.ts`；`BUILD §2` 说明测试 mock 边界；或把 `vitest.config.ts` 改为 `.mts` 后同步文件树。

- [ ] **T14 单实例锁会吞掉调试启动**
  - **问题描述**：已有 Lychee 实例运行时，再启动带 `--remote-debugging-port` 的进程会直接退出并唤醒旧窗口，调试端口连不上，容易误判应用崩溃。
  - **解决方法**：按 PID 结束旧实例后再启动；调试脚本固定读取 `/json/list`；正式行为保持单实例。
  - **建议的文档操作**：`BUILD §9` 故障排查增加“第二个实例只会唤醒已有窗口；调试前先退出旧实例”。

- [ ] **T15 CSS 表格、弹层和窗口高度都踩过布局坑**
  - **问题描述**：`td { display:flex }` 会破坏 table-cell 的行分隔线和宽度分配；音量弹层用低 z-index 遮罩会被播放条覆盖且吞点击；固定窗口最小高度让矮窗口无法收缩。
  - **解决方法**：操作单元格改为内部 flex 容器、行线挂 `tr`；弹层改为捕获阶段 document click + 容器 ref，不再用遮罩；移除窗口 `minHeight`，导航内部滚动、账号固定、极矮时整页滚动。
  - **建议的文档操作**：`USER §5.2.1/5.2.3/5.2.4` 同步这些布局契约；`CORE §4.40/4.49` 补“表格单元格不得改为 flex”的实现约束。

## 2. 文档的错误指导

- [ ] **D01 `USER §5.2.1` 规定内容区最大宽度 1240px，实际验收要求全宽**
  - **问题描述**：按 1240px 居中时，宽屏下歌单表格明显填不满内容区，用户将其列为样式问题。
  - **解决方法**：`.page` 改为 `max-width: none`，保留左右内边距；实测 1920px 窗口下表宽 1618px，与内容区一致。
  - **建议的文档操作**：修改 `USER §5.2.1` 的“内容区最大宽度 1240px”为“内容区铺满侧栏与窗口之间的可用宽度”；如仍想限制，需明确例外页面。

- [ ] **D02 `USER §5.2.1` 规定最小窗口 280×440，实际不应限制高度**
  - **问题描述**：`BrowserWindow.minHeight=440` 阻止用户缩到更矮；验收要求不设置最小高度。
  - **解决方法**：移除 `minHeight`（保留最小宽度）；用 CSS `min-height: calc(var(--player-height) + 170px)` 作为整页滚动阈值，导航在矮窗口内部滚动，极矮时 body 纵向滚动。
  - **建议的文档操作**：`USER §5.2.1` 删除最小高度 440，改为“宽度最小 280；高度不设下限，按上述滚动策略适配”；`CORE §4.4` 的 `createMainWindow` 说明同步。

- [ ] **D03 `USER §5.2.4`/原型把操作列放在时长列之后，且列标题右对齐**
  - **问题描述**：验收要求操作列在时长列左边、所有列标题左对齐；原型与实现不一致，且旧样式让表格看起来不统一。
  - **解决方法**：列顺序改为 `# / 标题 / 专辑 / 操作 / 时长`；`th` 统一左对齐；操作内容内部左对齐；时长也左对齐。行线改挂在 `tr`。
  - **建议的文档操作**：更新 `USER §5.2.4` 的列顺序、对齐和原型；`CORE §4.39` 的 `SongTable` 说明同步。

- [ ] **D04 `USER §5.2.9`/`CORE §5.12` 要求“完整加载后再补队列”，与实际体验冲突**
  - **问题描述**：严格按文档实现会让长歌单在加载期间队列为空；一旦补页失败就永久为空。
  - **解决方法**：按已加载页增量补齐；播放开始即构建；轮询/刷新时更新；当前曲不在列表时回退到全列表减当前曲。
  - **建议的文档操作**：修改 `USER §5.2.9` 和 `CORE §4.29/5.12`，明确“渐进补齐”而不是“完整后补齐”。

- [ ] **D05 `PROVIDER §3.3` 的“不会自动重新获取链接”与实际恢复策略相反**
  - **问题描述**：文档禁止自动重取，但播放错误后自动重取一次能明显改善体验；用户也报告过播放约 1 分钟后中断。
  - **解决方法**：同曲 30 秒内最多自动重取一次，保留播放位置；再次失败提示。
  - **建议的文档操作**：改写 `PROVIDER §3.3` 最后一条；在 `USER §5.3` 的音频加载失败文案旁补“应用会先自动刷新一次链接”。

- [ ] **D06 `CORE §4.1` 的 `Settings` 缺少音频引擎和下载目录**
  - **问题描述**：`USER §5.2.7`、`BUILD §11` 要求选择音频引擎和下载目录，但 `Settings` 没有 `audioEngine`/`downloadDir`，无法持久化。
  - **解决方法**：在 `Settings` 增加可选 `audioEngine: 'auto'|'html5'|'mpv'` 与 `downloadDir?: string`；主进程 sanitize 并提供默认值；设置页即时写盘。
  - **建议的文档操作**：更新 `CORE §4.1` 的 `Settings` 定义和 `§4.6` 的默认值说明；`USER §5.2.7` 标明确切字段。

- [ ] **D07 `CORE §4.2` 的 `LycheeApi` 缺少实际使用的接口**
  - **问题描述**：实现需要 `flags.get/save`、`download.storage/openFolder/chooseFolder/clearCache`、`mpv.loadAndPlay/play/pause/stop/seek/setVolume/onEvent`、`lyric.decryptQrc`，文档接口没有。
  - **解决方法**：在 preload 与 `LycheeApi` 扩展这些方法；主进程注册对应 IPC。
  - **建议的文档操作**：更新 `CORE §4.2`；`CORE §4.62/4.63` 补 mpv 控制面；`CORE §4.67` 补 QRC 桥接。

- [ ] **D08 `PROVIDER` 把收藏/歌单写入标为“待探测”，`USER` 却承诺可收藏/可编辑**
  - **问题描述**：文档一边说接口未验证，一边在 README/USER 描述完整功能；实现时只能先做 UI 或做未验证协议。
  - **解决方法**：收藏已按签名通道实现；歌单创建/改名/删除仍为占位；推荐/MV 为空实现并显示提示。收藏按钮实心/空心、写后刷新已完成。
  - **建议的文档操作**：`PROVIDER §3.5/4.1` 将收藏移出待探测；`USER` 对仍待探测的歌单编辑/MV/推荐增加“暂不可用/待探测”标记，或从 README 用户交互表移除。

- [ ] **D09 `PROVIDER` 未说明 201 收藏的 `songType`、Cookie 和读回要求**
  - **问题描述**：只写“复用 AddSonglist/DelSonglist”和 `dirId:201`，不足以实现；`songType` 错会产生隐藏记录，缺网页 Cookie 会 80105。
  - **解决方法**：实现状态读取、签名写入、真实 `songType`、webCookies、写后读回；错误 80105/1101 给出明确文案。
  - **建议的文档操作**：`PROVIDER §4.1` 增补 201 目录写给请求参数和限制；`PROVIDER §4.2` 增补 80105/1101 说明；`PROVIDER §4.3` 增补 `songType` 规则。

- [ ] **D10 `BUILD §11` 的音频缓存路径与实际目录层级不一致**
  - **问题描述**：文档写 `userData/cache/audio/<musicid>/`，实现按 `<musicid>/<quality>/` 分目录，便于同曲多档缓存。
  - **解决方法**：保留 `<musicid>/<quality>/` 结构；缓存统计递归扫描；按账号隔离并做容量 LRU。
  - **建议的文档操作**：更新 `BUILD §11` 的音频缓存路径；`CORE §4.58` 说明 quality 子目录。

- [ ] **D11 `USER §5.4` 声称托盘图标随播放状态更新，实际只更新菜单/tooltip**
  - **问题描述**：没有播放/暂停两套托盘图标资源，代码只重建菜单和 tooltip；文档描述超出实现。
  - **解决方法**：保持菜单、启用状态、tooltip 更新；图标暂不变化。
  - **建议的文档操作**：`USER §5.4` 删除“图标随播放状态更新”，或补充两套图标资源并实现切换。

- [ ] **D12 `CORE §5.5` 使用 `tray::updateState`，签名和实现是 `updateTray`**
  - **问题描述**：调用栈名称与 `CORE §4.19` 签名不一致，增加检索成本。
  - **解决方法**：代码统一使用 `updateTray(state)`。
  - **建议的文档操作**：修正 `CORE §5.5` 的调用栈名称；检查其他 `updateState` 引用。

- [ ] **D13 `USER §5.2.7` 展示默认快捷键 Ctrl+Alt+Space，但 `Settings.shortcuts` 默认是空对象**
  - **问题描述**：界面原型有默认播放快捷键，类型和主进程默认值没有；用户无法判断默认是否注册。
  - **解决方法**：默认 `shortcuts: { playPause: 'Ctrl+Alt+Space' }`；主进程启动注册；设置页恢复默认写回该值；冲突仅检测应用内绑定。
  - **建议的文档操作**：`CORE §4.1` 的 `Settings` 注释默认值；`USER §5.2.7` 说明“默认仅播放/暂停占用 Ctrl+Alt+Space，其余为空；系统级冲突会静默跳过”。

- [ ] **D14 文档写歌单缓存 TTL 30 秒，验收要求 5 秒并增加 15 秒轮询**
  - **问题描述**：30 秒 stale 会让“我喜欢”收藏后在应用内长时间不更新；文档没有主动轮询机制。
  - **解决方法**：`PLAYLIST_CACHE_TTL_MS=5000`；新增 `PLAYLIST_POLL_INTERVAL_MS=15000`；PlaylistView 可见时轮询首页，store 比较总数/首页顺序，变化则重建列表与队列。
  - **建议的文档操作**：更新 `CORE §4.50` 常量推荐值和 `§4.64` store 方法（`poll`/`invalidate`）；`USER §2/§5.2.8` 补 15 秒轮询与自动刷新行为。

- [ ] **D15 `CORE §1` 的测试树只写 `test/api`，实际还有 `test/player-store.test.ts`**
  - **问题描述**：文件树不完整，新测试没有归属说明；`vitest.config.ts` 也存在 CJS 告警。
  - **解决方法**：保留 `test/api` 和 `test/replay.ts`，新增播放器队列回归测试；暂不调整 vitest 配置文件名。
  - **建议的文档操作**：`CORE §1` 补测试文件；如需消除告警，将 `vitest.config.ts` 改为 `vitest.config.mts` 并同步更新文件树和 `BUILD §2`。

- [ ] **D16 `PROVIDER` 写歌单单页上限 100，`CORE` 常量写 `PLAYLIST_PAGE_SIZE=50`**
  - **问题描述**：两处 page size 语义不同：上游能力上限 100，应用固定 50/页；实现按 50 分页。
  - **解决方法**：主进程请求固定 `PLAYLIST_PAGE_SIZE=50`；vkey 批量使用 `PROBE_VKEY_BATCH=20`；`hasMore` 按实际批次与 total 判断，不把 total 当唯一依据。
  - **建议的文档操作**：`PROVIDER §4.1/4.3` 明确“上游单次最多 100，应用固定 50”；`CORE §4.50` 注释补充。

- [ ] **D17 `BUILD §5` 的安装脚本仓库占位符与实际默认值不一致**
  - **问题描述**：文档写 `<owner>/lychee-player`，脚本默认 `lychee-player/lychee-player`；`--dry-run` 仍会请求 GitHub API 探测最新版本，不是纯离线打印。
  - **解决方法**：支持 `LYCHEE_REPO` 覆盖；sha256 校验强制；dry-run 保留网络探测。当前脚本可用，但默认仓库需按实际仓库替换。
  - **建议的文档操作**：`BUILD §5` 写明 `LYCHEE_REPO` 环境变量和实际仓库地址；注明 dry-run 仍可能访问 GitHub API。

- [ ] **D18 `CORE §4.67` 把 QRC 解密放在 qrc.ts，但实际必须经 preload**
  - **问题描述**：渲染层无法同步调用 Node crypto/zlib，文档给出的函数边界不可直接实现。
  - **解决方法**：`qrc.ts` 保留 `decryptQrc`/`parseQrcLyric` 入口，解密原语经 preload 同步桥接；无法解密时回退 LRC。
  - **建议的文档操作**：`CORE §4.67` 改为“qrc.ts 解析，preload 解密”；`CORE §4.2` 增加 `lyric.decryptQrc`。

## 3. 文档没有提及、只能自行探索的细节

- [ ] **E01 zzc 签名与 `ag-1` 加密协议**
  - **问题描述**：文档未给出算法、密钥、端点、请求体编码、响应解码。没有这些无法实现收藏写入。
  - **解决方法**：按 MIT 的 qmweb-sign 固定源码实现：SHA1 十六进制、指定索引、SCRAMBLE XOR + Base64 去 `+/=`、zzc 前缀；AES-128-GCM 随机 12 字节 IV，body 为 base64；响应逐字节 XOR 后 UTF-8/JSON；端点 `u6.y.qq.com/cgi-bin/musics.fcg?encoding=ag-1&sign=...`。
  - **建议的文档操作**：在 `PROVIDER` 新增“QQ Web 签名/加密协议”小节，记录算法来源、固定密钥、编码与响应解码；`CORE §4.54` 引用该节。

- [ ] **E02 收藏状态与写入的真实接口**
  - **问题描述**：文档只写“收藏/歌单写入待探测”，没有 `SongFavRead/IsSongFanByMid`、`m_fan` 结构、201 目录参数字段。
  - **解决方法**：读取用 `SongFavRead/IsSongFanByMid` 的 `v_songMid` 批量；写入用 `PlaylistDetailWrite/AddSonglist|DelSonglist` 的 `dirId:201` + `v_songInfo:[{songId,songType}]`；写后读回确认。
  - **建议的文档操作**：`PROVIDER §4.1` 补两个接口和参数；`§4.3` 补 `m_fan`/`v_songInfo` 数据模型。

- [ ] **E03 201 目录的 `songType` 不是详情 `type`**
  - **问题描述**：详情返回 `type=0`，Add 传 0 返回 80105；传 1/5 返回成功但生成不可见记录。文档没有解释。
  - **解决方法**：以真实歌曲类型写入；不把业务码 0 当作最终成功；通过 `CgiGetDiss`/状态读回校验；错误提示区分 80105/1101。
  - **建议的文档操作**：`PROVIDER §4.3` 明确“201 写入的 `songType` 必须来自歌曲身份，不能用 0 兜底”；`CORE §4.54` 记录隐藏记录风险。

- [ ] **E04 网页会话 Cookie 与 `g_tk` 优先级**
  - **问题描述**：只有 `musickey` 时普通请求可用，但收藏签名写入可能返回 80105；`p_skey`/`skey` 等 Cookie 未进入 Credential。
  - **解决方法**：保存 xlogin 分区与 Cookie 登录的完整 Cookie jar；请求头合并；`g_tk` 优先 `skey → qqmusic_key → qm_keyst`，`g_tk_new_20200303` 优先 `qqmusic_key → p_skey → skey → ...`。
  - **建议的文档操作**：`PROVIDER §4.3` 的 Credential 增加 `webCookies`，说明仅主进程持有、加密保存；`CORE §2` 补 g_tk 计算规则。

- [ ] **E05 音频协议需要哪些响应头**
  - **问题描述**：文档只说“主进程代理、缓存命中走本地协议”，未定义 Range、Content-Range、Content-Length、Accept-Ranges 和回退策略。
  - **解决方法**：206 必须带 `Content-Range` 与 `Content-Length`；200/完整 206 才缓存；局部 Range 直接透传；缓存文件手工切片响应；`Cache-Control: no-store`。
  - **建议的文档操作**：`CORE §4.59` 做成完整协议表；`PROVIDER §3.3` 说明上游 Range 行为；`USER §3.1` 说明 seek 不再等待整段 stream。

- [ ] **E06 HTMLAudio 在 duration 未知时也必须允许 seek**
  - **问题描述**：初版只在 `audio.duration` 有限且大于 0 时设置 `currentTime`；流式响应 duration 为 `Infinity/NaN` 时 seek 静默失败。
  - **解决方法**：直接设置 `currentTime`，duration 已知时才 clamp，异常捕获忽略；`onDurationChange` 只接受有限值。
  - **建议的文档操作**：`CORE §4.27` 的 `AudioEngine.seek` 增加“duration 未知时仍应尝试定位”的契约。

- [ ] **E07 自定义协议注册时机与 token 设计**
  - **问题描述**：文档的 `audioProtocolUrl(filePath)` 只覆盖缓存文件，未说明未缓存流如何通过本地协议代理。
  - **解决方法**：使用 `lychee-audio://stream/<token>` 与 `lychee-audio://file/<base64>`；stream token 映射上游 URL；scheme 在模块加载时注册 privileges，ready 后 handle；mpv 通过 `resolveProtocolSource` 解析 token。
  - **建议的文档操作**：`CORE §4.59` 增加 URL 形式、token 生命周期、缓存/流分支；`§4.63` 说明 mpv 如何复用。

- [ ] **E08 启动参数文件必须在 ready 前同步读取**
  - **问题描述**：文档要求模块加载阶段读取并应用，但 `readFlagsFile()` 是异步签名；同步等待不可行。
  - **解决方法**：`applyFlagsFromDisk()` 用 `readFileSync` 在导入时执行默认 flags + 文件 flags；设置页仍用异步 `readFlagsFile/writeFlagsFile`；限制 8 KiB、64 行并过滤非法 switch。
  - **建议的文档操作**：`CORE §4.51/5.2` 明确同步/异步两个入口；`BUILD §10` 补限制与优先级。

- [ ] **E09 electron-builder 的资源路径与桌面文件**
  - **问题描述**：文档只列产物，没有说明 `process.resourcesPath`、`extraResources`、`build/` 图标和桌面文件由谁生成。
  - **解决方法**：`extraResources` 复制 icon/tray；`build/icon.png` 供 builder 使用；`packaging/arch/lychee-player.desktop` 由打包脚本写入 tar 顶层。
  - **建议的文档操作**：`BUILD §4` 增加配置映射和小节；`CORE §1` 标注 `build/`、`packaging/` 的用途。

- [ ] **E10 测试/调试时 `safeStorage` 需要正确的 password-store**
  - **问题描述**：独立 Electron 脚本读取 `credential.bin` 时，未设置 `password-store=gnome-libsecret` 会报“Decryption is not available”；单实例与调试端口也互相干扰。
  - **解决方法**：测试脚本显式 `app.setName`、`app.setPath('userData')`、`app.commandLine.appendSwitch('password-store','gnome-libsecret')`；调试前结束旧 PID。
  - **建议的文档操作**：`BUILD §9` 故障排查补充密钥环和单实例调试说明；测试相关说明归入 `CORE §1` 的 `test/` 注释。

- [ ] **E11 “我喜欢”总数与成员可见性可能不一致**
  - **问题描述**：写入后总数增加，但 `CgiGetDiss` 的 `songlist` 可能少一条；用错误 `songType` 时生成隐藏记录。文档未提醒 total 不等于可见成员。
  - **解决方法**：写后读回状态并核对列表；轮询检测 total 变化；不以总数增加作为唯一成功条件；错误类型不留假记录。
  - **建议的文档操作**：`PROVIDER §4.3` 的 `QqPlaylistData` 说明 total/songlist 可能滞后或过滤；`CORE §4.54` 增加“读回校验”要求。

- [ ] **E12 轮询必须考虑页面可见性和并发**
  - **问题描述**：文档没有 15 秒轮询；直接实现会产生后台请求、重入和与分页补全冲突。
  - **解决方法**：`document.visibilityState === 'visible'` 才轮询；store 内 `polling` 防重入；比较 total/meta/首页顺序；变化才重置列表并继续补页；队列同步在同一流程中完成。
  - **建议的文档操作**：`CORE §4.64` 补 `poll` 状态机；`USER §2` 补可见性与 15 秒行为。

- [ ] **E13 QRC 文件格式**
  - **问题描述**：文档只说 QRC 密文，没有说明 hex、3DES-ECB、无填充和 zlib 压缩。
  - **解决方法**：按 hex → 3DES-ECB（`!@#)(*$%123ZXC!@!@#)(NHL`，无自动填充）→ inflate → `LyricContent` XML 解析；无有效数据回退 LRC。
  - **建议的文档操作**：`PROVIDER §4.3` 增补 QRC 编码链；`CORE §4.67` 引用。

- [ ] **E14 下载暂停/继续与封面细节**
  - **问题描述**：文档只给 `writePart(url, filePath)`，未说明 Range 续传、`.part`、临时文件、封面本地化、下载目录和失败重试。
  - **解决方法**：任务内保存 AbortController；暂停保留 `.part`；继续使用 Range；完成后重命名；封面下载为同名 `.jpg`；只对失败任务手动继续；任务当前仅内存保存。
  - **建议的文档操作**：`CORE §4.60` 补下载状态机；`BUILD §11` 注明任务不跨重启、目录默认值；若需要持久化则在文档中列为缺口。

- [ ] **E15 Vitest 与 Electron 类型导入的 mock 边界**
  - **问题描述**：文档只给测试目标，没有说明如何避免 Electron/原生模块和浏览器全局。
  - **解决方法**：`vi.mock('electron')` 提供最小 app/safeStorage/protocol/net；player 测试 mock `AudioEngine`、localStorage、`window.lychee`；fixture 用 `Response` 替换 fetch。
  - **建议的文档操作**：`CORE §1` 的 `test/` 与 `test/replay.ts` 注释补 mock 约定；`BUILD §2` 说明测试默认不触网。

## 4. 刚刚修复的 ISSUES

- [ ] **I01 音量弹出点击别处不关闭**
  - **问题描述**：旧实现用 z-index 低于播放条的遮罩，点击播放条按钮不关闭，且遮罩会吞掉页面点击。
  - **解决方法**：删除遮罩；document 捕获阶段监听点击，用 qualityWrap/volumeWrap ref 判断内外；外部点击关闭且不阻断目标点击；音质菜单共用逻辑。
  - **建议的文档操作**：`USER §5.2.3` 补“音质/音量弹层点击外部关闭且点击穿透”；`CORE §4.40` 说明捕获阶段监听。

- [ ] **I02 窗口高度不能自由缩小**
  - **问题描述**：`BrowserWindow.minHeight=440` 阻止矮窗口；导航无滚动，账号入口可能被挤出。
  - **解决方法**：移除最小高度；`.nav` 内部滚动，`.sidebar-foot` 固定；`.app-shell` 高度 100dvh + 最小阈值，极矮时 body 纵向滚动；播放条保持底部行。
  - **建议的文档操作**：更新 `USER §5.2.1` 的窗口与布局契约；`CORE §4.4` 同步。

- [ ] **I03 矮窗口账号图标应常驻、播放条应贴底**
  - **问题描述**：矮窗口下账号入口可能被导航挤走，播放条位置不稳定。
  - **解决方法**：侧栏 flex 中 nav `flex:1; min-height:0; overflow-y:auto`，foot `flex:0 0 auto`；播放条固定在 grid 第二行；极矮时按 I02 整页滚动。
  - **建议的文档操作**：`USER §5.2.2/5.2.3` 补“账号入口固定、导航先滚动、播放条贴底”。

- [ ] **I04 歌单横向填不满、操作列处行线断开**
  - **问题描述**：内容区 max-width 1240 在大窗口留白；操作 td 设置 `display:flex` 破坏 table-cell，导致行线断、列宽异常。
  - **解决方法**：`.page` 全宽；操作单元格内部 `.song-action-inner` 使用 flex；行边框改挂 `tr`；表格 width 100%。
  - **建议的文档操作**：`USER §5.2.1/5.2.4` 修正宽度与表格实现约束；`CORE §4.49` 补禁止 `td display:flex`。

- [ ] **I05 操作列应在时长列左边，列标题左对齐**
  - **问题描述**：原型和旧实现都是时长在操作前，且表头右对齐，视觉不统一。
  - **解决方法**：列顺序改为 `# / 标题 / 专辑 / 操作 / 时长`；所有 `th` 左对齐；操作与时长单元格左对齐。
  - **建议的文档操作**：同步 `USER §5.2.4` 原型和 `CORE §4.39`。

- [ ] **I06 下一首播放按钮需用加号**
  - **问题描述**：文字“下一首”视觉过重；用户要求恢复加号图标。
  - **解决方法**：操作列使用加号图标按钮，保留 tooltip/aria-label 与不可播禁用；不再使用固定槽布局。
  - **建议的文档操作**：`USER §5.2.4` 将“下一首按钮”标注为加号图标，并说明操作列顺序。

- [ ] **I07 播放约 1 分钟后报“音频加载失败”**
  - **问题描述**：旧代理不处理 Range，浏览器 seek/重新缓冲时不断请求完整文件，最终链接过期或请求异常；只提示错误。
  - **解决方法**：Range 透传 + 完整响应缓存 + 播放错误自动刷新一次链接（30 秒节流），保留原位置；实测播放 81 秒无错误。
  - **建议的文档操作**：`PROVIDER §3.3` 改自动重取策略；`USER §5.3` 补提示与重试说明。

- [ ] **I08 歌曲 seek 崩溃、未缓存歌曲 seek 要等待**
  - **问题描述**：seek 只在 duration 有限时生效；代理不转 Range，未缓存时只能顺序 stream。
  - **解决方法**：AudioEngine 在 duration 未知时也设置 currentTime；代理始终转发 Range；缓存文件支持 206；播放器加 seek 看门狗。
  - **建议的文档操作**：`CORE §4.27/4.59` 补 seek 与 Range 契约；`USER §3.1` 说明未缓存 seek 由主进程分段取流。

- [ ] **I09 多次 seek 后续不生效**
  - **问题描述**：首次 seek 后浏览器再次发起 Range 时，旧代理返回整段 200，导致后续定位等待或失败。
  - **解决方法**：每次 Range 都转发并返回 206/Content-Range；1.2 秒未到达目标的看门狗重发一次定位；缓存和未缓存路径均验证连续 seek。
  - **建议的文档操作**：`CORE §4.29` 记录 seek 看门狗；`CORE §4.59` 记录多 Range 行为。

- [ ] **I10 播放队列为空**
  - **问题描述**：队列只在歌单 complete 后构建；可用性过滤可能排除当前曲；部分加载/失败时一直为空。
  - **解决方法**：任意已加载页即构建；播放开始、翻页、轮询都同步；移除构建期可用性过滤；当前不在列表时回退全列表减当前；加入队列测试。
  - **建议的文档操作**：`USER §5.2.9` 与 `CORE §4.29/5.12` 改为渐进补齐；说明不可播由播放尝试兜底。

- [ ] **I11 收藏按钮实心/空心与切换**
  - **问题描述**：最初只有空心 heart，且后端待探测导致点击回滚；用户要求状态与点按效果一致。
  - **解决方法**：增加 `heart-filled` 图标；SongTable/PlayerBar 根据 `favoriteMids`/`favorites` 选择图标；写操作乐观更新、失败回滚；成功后主动刷新“我喜欢”。
  - **建议的文档操作**：`USER §5.2.3/5.2.4` 补实心/空心图标与点击文案；`CORE §4.39/4.40` 补状态来源。

- [ ] **I12 收藏 invalid request**
  - **问题描述**：旧 `fcg_music_add2songdir.fcg` 使用最小 Cookie 返回 `403 invalid request/no permit`。
  - **解决方法**：放弃旧 CGI，改用签名加密的 `u6.y.qq.com` 通道；保留 Cookie 登录完整 jar；请求头带 `p_skey/skey`（如存在）。
  - **建议的文档操作**：`PROVIDER §3.5` 记录旧 CGI 不可用；`§4.1` 改为签名通道。

- [ ] **I13 收藏上游 80105 与“假成功”**
  - **问题描述**：明文通道返回 80105；错误 `songType` 会成功但生成隐藏记录，UI/总数显示已添加，官方歌单和手机看不到。
  - **解决方法**：使用真实 `songType` 和签名通道；写后读回状态与列表；错误 80105 提示重新登录同步网页会话；不再用类型 1 兜底；测试产生的隐藏记录已取消，歌单数量恢复原状。
  - **建议的文档操作**：`PROVIDER §4.1/4.3` 增补 201/songType/Cookie/读回；`USER §5.3` 增加 80105 文案；`CORE §4.54` 增补隐藏记录风险。

- [ ] **I14 未缓存歌曲首次 seek 立即生效，后续 seek 不生效**
  - **问题描述**：实测问题来自 Range 处理不完整；后续 Range 被当成完整请求重新下载。
  - **解决方法**：同 I09；连续 seek 2:00→0:30→2:20 实测通过；缓存文件多段 seek 也通过。
  - **建议的文档操作**：`CORE §4.59` 明确“每个 Range 独立转发，不缓存局部 206”；`CORE §4.29` 补看门狗。

- [ ] **I15 VIP / 音质标记在窄窗口被裁掉**
  - **问题描述**：标题使用 ellipsis，长歌名把 VIP/FLAC 徽标一起裁掉；窄窗口优先压缩的是徽标而不是歌名。
  - **解决方法**：标题拆成可压缩的 `.song-title-text` 与固定 `flex:0 0 auto` 的 `.pay-badge/.quality-badge`；500px 宽实测徽标全部可见。
  - **建议的文档操作**：`USER §5.2.4` 补“徽标常驻、标题优先省略”；`CORE §4.39` 说明 DOM 结构。

- [ ] **I16 歌单 stale 5 秒 + 15 秒轮询**
  - **问题描述**：30 秒 TTL 让收藏/外部修改长时间不同步；没有主动检查机制。
  - **解决方法**：`PLAYLIST_CACHE_TTL_MS=5_000`；`PLAYLIST_POLL_INTERVAL_MS=15_000`；PlaylistView 可见时轮询；store 比较总数/meta/首页顺序；变化后重建列表与队列。
  - **建议的文档操作**：`CORE §4.50/4.64`、`USER §2/§5.2.8` 同步常量和轮询行为。

- [ ] **I17 收藏/取消收藏后主动刷新歌单**
  - **问题描述**：收藏成功后“我喜欢”歌单和“我的歌单”卡片仍显示旧数据，需要等轮询或重进页面。
  - **解决方法**：`favoriteVersion` 版本号；成功后 `playlist.invalidate('liked')`；已打开的 liked feed 立即 `poll`；LibraryView 监听版本重新拉取歌单列表；失败不刷新。
  - **建议的文档操作**：`USER §2/§5.2.4` 补“收藏后立即刷新我喜欢与歌单卡片”；`CORE §4.66` 补 `favoriteVersion`、`invalidate` 调用关系；`CORE §4.64` 补 `poll/invalidate`。

## 5. 建议回灌优先级

| 优先级 | 文档 | 需要先处理的条目 |
|---|---|---|
| P0 | `PROVIDER.html` | E01–E04、I12/I13（收藏签名、webCookies、songType、80105/1101） |
| P0 | `CORE.html` | D06/D07/D14/D18、E05/E07、I09/I16/I17（Settings、LycheeApi、Range、轮询、收藏刷新） |
| P1 | `USER.html` | D01–D05、D11、D13、I02–I06、I11、I15（布局、队列、seek、徽标、收藏图标） |
| P1 | `BUILD.html` | D10/D17、E08–E10（缓存路径、安装脚本、packaging、调试） |
| P2 | `GUIDELINES.md` | T01/T02（文档分支同步、状态标记） |

> 建议先把 P0 的 `PROVIDER`/`CORE` 回灌完成，再调整 `USER` 原型；`README.html` 的发现/MV 条目在对应上游接口验证前应标注“待探测”。
