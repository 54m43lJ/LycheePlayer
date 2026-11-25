# 打包体积与一体化方案调研

> 分支：`research` · 测量日期：2026-11-25 · 对象：Lychee Player 0.1.0（Electron 44.9.0 / Vue 3）
>
> 目标排序：**① 精简安装包尺寸** > **② 二进制一体化可能性**。

## 0. 结论摘要

先说三个判断：

1. **当前 308 MiB 里约 92% 是 Electron/Chromium 运行时**，业务代码（`app.asar`）只占 7.6%，其中还有约 22 MiB 是误打包的构建期依赖。换前端框架（Vue → Svelte/Preact/Solid）对体积几乎没有意义，量级只有几十 KB。
2. **不换壳的前提下，最划算的是“清理 + 换压缩”**：不改一行业务代码，实测安装后 308 → **279 MiB**，发布包 123.4 → **90.5 MiB**（zstd，−26.7%），代价 1–2 天。这是必做项，不是备选。
3. **要同时满足“安装包显著变小”和“单可执行文件”，只有换掉 Chromium 内核**：Tauri 2 / Wails v3（保留 Vue，主进程重写）能把下载压到 5–15 MiB、产出单个 ELF；代价是系统 WebKitGTK 依赖（Arch 上约 143 MiB）和媒体编解码风险。Electron 本身**不可能**做成单个 ELF，最多做成单个 AppImage 文件。

一句话路线：**先做 Electron 清理（立刻见效）→ 用一周做 Tauri 2 媒体/登录 PoC → 通过则迁移，不通过则停在 Electron + AppImage/zstd。**

## 1. 口径与术语

| 术语 | 含义 | 本项目的对应物 |
| --- | --- | --- |
| 安装后体积 | 解压/安装到磁盘后的总字节数 | 发布 tar.gz 解压后的 `lychee-player/` 目录 |
| 下载体积 | 用户实际下载的发布包大小 | GitHub Release 的 `.tar.gz` |
| 单文件 | 一次下载只有一个文件，内部可以是自解压或挂载镜像 | AppImage、Electrobun 产物 |
| 单可执行 | 一个 ELF 文件，运行时仍链接系统库 | Tauri/Wails/原生 GUI 产物 |
| 自包含 | 不依赖系统 WebView/运行时 | Electron（但是多文件） |

> 文中的 MiB 均按 `1024²` 计算；标注“≈”的是估算，未标注的是实测。

## 2. 现状测量

测量对象：GitHub Release `preview` 的 `lychee-player-preview-x86_64.tar.gz`（129,362,430 B），解压后 `du -sh` 为 308 MiB。

### 2.1 安装后体积构成

| 组成 | MiB | 占比 | 说明 |
| --- | ---: | ---: | --- |
| `lychee-player` 主程序 | 218.9 | 71.0% | Chromium + Node 主程序 |
| `LICENSES.chromium.html` | 19.2 | 6.2% | Chromium 许可证，法定需分发 |
| `resources/app.asar` | 23.4 | 7.6% | 业务代码 + 误打包依赖 |
| `resources.pak` | 12.0 | 3.9% | Chromium 资源 |
| `icudtl.dat` | 10.4 | 3.4% | ICU 数据（Intl） |
| `locales/`（55 个） | 8.6 | 2.8% | 只用到 `zh-CN` / `en-US` |
| `libvk_swiftshader.so` | 4.4 | 1.4% | 软件 Vulkan 渲染回退 |
| `libffmpeg.so` | 2.7 | 0.9% | 音视频解码，不能删 |
| `libvulkan.so.1` | 2.4 | 0.8% | Vulkan loader |
| `chrome_crashpad_handler` | 1.8 | 0.6% | 崩溃上报 |
| `chrome_100/200_percent.pak` | 1.9 | 0.6% | 1x/2x 资源 |
| 快照（v8/snapshot） | 1.1 | 0.4% | V8 启动快照 |
| 图标、desktop、license 等 | ≈1.2 | 0.4% | — |
| **合计** | **308** | **100%** | |

**关键结论：运行时（主程序 + pak + ICU + 图形/解码库 + locales + 许可证）约 285 MiB，占 92.5%；业务代码不到 8%。**

### 2.2 `app.asar` 内部（23.4 MiB）

| 内容 | MiB | 是否运行期需要 |
| --- | ---: | --- |
| `node_modules/` | 25.6（含块对齐） | **绝大部分不需要** |
| `out/`（main/preload/renderer 产物） | 1.3 | 是 |
| 其中 `*.map` | 3.6 | 否 |
| `@vue/*` | 7.2 | 否（renderer 已由 Vite 打包） |
| `@babel/*` | 4.9 | 否（构建期） |
| `vue` | 2.6 | 否（已打包进 renderer） |
| `vue-router` | 1.4 | 否（已打包） |
| `@fontsource/*` | 0.6 | 否（woff/woff2 已在 `out/renderer`） |
| `mpris-service` 及其依赖 | ≈2.6 | **是**（主进程 externalize） |

原因：`electron.vite.config.ts` 对 main/preload 使用 `externalizeDepsPlugin()`，而 electron-builder 默认把 `package.json` 的**全部** `dependencies` 放进 asar，即使 renderer 依赖早已被 Vite 打进 `out/`。实际运行期只需要 `mpris-service`（及其 `dbus-next` 依赖链）。

实测清理后（`dependencies` 只留 `mpris-service`，排除 `*.map`）：`app.asar` 从 23.4 MiB 降到 **3.2 MiB**，其中 `node_modules` 约 3.0 MiB（`mpris-service` 依赖链）、`out` 1.3 MiB；asar 内已无 `@vue` / `@babel` / `vue` / `vue-router`。

### 2.3 发布包压缩对比（同一棵解压目录）

| 压缩方式 | 字节 | 相对现状 | 解压速度 |
| --- | ---: | ---: | --- |
| `tar.gz`（现状，gzip -6） | 123.4 MiB | 基线 | 快 |
| `tar.zst`（zstd -19） | 94.8 MiB | **−23.2%** | 很快 |
| `tar.xz`（xz -9） | 87.4 MiB | **−29.2%** | 慢 |
| **清理后** `tar.gz`（实测） | 116.0 MiB | −6.0% | 快 |
| **清理后** `tar.zst`（实测） | **90.5 MiB** | **−26.7%** | 很快 |

只换压缩算法就能少下 23–29 MiB，且 zstd 解压比 gzip 更快；xz 更小但解压慢、对增量更新不友好。**zstd 是性价比最高的默认选择。**

## 3. 方案分层

### L0：不换框架，只优化 Electron 打包

优先级最高、风险最低。逐项收益（安装后 / 下载）：

| 措施 | 安装后 | 下载（相对旧 zstd 94.8） | 风险 |
| --- | ---: | ---: | --- |
| 把 `vue`、`vue-router`、`pinia`、`@fontsource/*` 移到 `devDependencies`；`dependencies` 只留 `mpris-service` | −20.2 MiB | −2.4 MiB | 低，需回归主进程 |
| `electronLanguages: [zh-CN, en-US]` | −8.4 MiB | −1.9 MiB | 低 |
| 排除 `*.map`、`!**/node_modules/**`（配合上一条） | 已计入 | 已计入 | 低 |
| 发布改用 `tar.zst` / `tar.xz` | — | −28.6 / −36.0 MiB（相对 gzip） | 低，安装脚本需解压工具 |
| 可选：移除 `libvk_swiftshader.so`、`libvulkan.so.1` | −6.8 MiB | ≈−2.5 MiB | 中，无 GPU/虚拟机可能起不来 |
| 可选：`LICENSES.chromium.html` 换成 `.gz` | −15.5 MiB | 0 | 中，许可证可读性/合规需确认 |
| 可选：确认未启用崩溃上报后移除 `chrome_crashpad_handler` | −1.8 MiB | ≈−0.7 MiB | 中，需实测启动 |
| 可选：`chrome_200_percent.pak`（HiDPI） | −1.2 MiB | ≈−0.5 MiB | 高，不建议 |
| 可选：对字体做子集化、去掉重复 woff | −0.3 MiB | ≈−0.1 MiB | 低，收益小 |

**L0 合计（实测）：安装后 308 → 279 MiB，发布包 123.4 → 116.0 MiB（gzip）/ 90.5 MiB（zstd）。**

> 注意：locales 的 55 个 `.pak` 彼此高度相似，整体压缩后只占约 2.8 MiB（gzip）/ 2.0 MiB（zstd）；所以删掉 53 个 locale 在安装后省 8.4 MiB，但在发布包里只省约 1.9 MiB。**下载体积的大头来自 gzip → zstd（−28.6 MiB），清理本身贡献 −4.3 MiB（zstd 口径）。**

把可选高风险项也做掉可到 **≈255 MiB / ≈87 MiB（zstd，估算）**。

不做的事：

- **UPX 压缩主程序**：Chromium 对内存布局/沙箱敏感，常见启动变慢、崩溃、杀软误报，收益还不稳定。
- **删 `resources.pak` / `icudtl.dat` / `libffmpeg.so`**：直接影响界面、Intl 和音频解码。
- **自己编译精简版 Electron**：构建链、安全更新、ABI 全部自己维护，维护成本远超收益。
- **换 Vue → Svelte/Preact/Solid**：renderer 产物只有 1.1 MiB，换框架最多省几十 KB，属于噪音。

可直接落地的配置示意：

```jsonc
// package.json
"dependencies": {
  "mpris-service": "^2.1.2"
},
"devDependencies": {
  "vue": "^3.5.44",
  "vue-router": "^5.4.0",
  "pinia": "^4.1.0",
  "@fontsource/noto-sans-avestan": "^5.3.0",
  "@fontsource/noto-sans-linear-b": "^5.3.0",
  "@fontsource/noto-sans-yi": "^5.3.0"
}
```

```yaml
# electron-builder.yml
electronLanguages:
  - zh-CN
  - en-US
files:
  - out/**/*
  - package.json
  - LICENSE
  - "!**/*.map"
```

```sh
# scripts/package-arch.mjs
tar --zstd -cf "dist/lychee-player-${version}-x86_64.tar.zst" -C dist lychee-player
```

> 注意：`externalizeDepsPlugin` 只把 main/preload 真正 import 的包保留为外部依赖，所以把 renderer 依赖移到 `devDependencies` 不会影响构建。

### L1：仍是 Electron，只换分发形态

| 方案 | 安装后 | 下载 | 单文件 | 单可执行 | 评价 |
| --- | ---: | ---: | :---: | :---: | --- |
| **AppImage** | ≈279 MiB（挂载后） | ≈90–100 MiB | ✅ | ❌ | 最接近“一个文件”的 Electron 方案；依赖 FUSE，可用 `--appimage-extract-and-run` 兜底 |
| **系统 Electron**（Arch `electron44`） | 应用 ≈3 MiB + `electron44` 319 MiB（共享） | ≈2–3 MiB | ❌ | ❌ | 包尺寸无敌；依赖系统包与主版本，升级需重打包 |
| **Flatpak**（Electron BaseApp） | 应用 + 共享 runtime | 首装 ≈60–120 MiB，之后共享 | ❌ | ❌ | 运行时共享、沙箱隔离；MPRIS/托盘/文件访问要走 portal，工作量大 |
| **Snap** | 类似 Flatpak | 类似 | ❌ | ❌ | 对 Arch 用户不友好 |
| **增量更新**（blockmap / zstd patch） | 不变 | 更新可到几 MiB | — | — | 只解决“每次更新都要重下”，不解决首装 |

**AppImage 的本质**：把整棵 Electron 目录放进 squashfs 再套一个启动器，仍是“一个文件、多个内部文件”，不是单个 ELF。它解决“分发一个文件”，不解决“一体二进制”。

**系统 Electron 的本质**：把 Chromium 当共享库用。Arch 上 `electron44` 已安装 319 MiB；若用户已有，应用只增加 2–3 MiB，是**总磁盘占用**最优解；若没有，则要额外装 319 MiB，且主版本耦合（`electron45` 升级后需重测）。

### L2：保留 Vue，换掉 Chromium 外壳

这一层是“体积质变 + 单可执行”的主战场。renderer（12.1k 行 Vue/TS）基本不动，重写 main（8.7k 行 TS）。

#### 候选对比

| 方案 | 应用安装后 | 下载 | 单可执行 | 前端复用 | 主进程语言 | 成熟度 | 粗估工作量 |
| --- | ---: | ---: | :---: | :---: | --- | --- | --- |
| **Tauri 2**（WebKitGTK 4.1） | ≈8–15 MiB + 系统 WebKitGTK 143 MiB | ≈5–10 MiB | ✅ | Vue 原样 | Rust | 高 | 3–6 周 |
| **Wails v3**（WebKitGTK 6.0 / GTK4） | ≈12–20 MiB + 系统 WebKitGTK 141 MiB | ≈8–15 MiB | ✅ | Vue 原样 | Go | 中高（2026-10 发布 v3.0） | 3–6 周 |
| **Electrobun**（Bun + 系统 WebKitGTK） | ≈15–65 MiB + WebKitGTK | ≈10–50 MiB | 单文件（自解压） | Vue 原样 | TypeScript/Bun | 低（Linux 年轻） | 3–5 周，风险更高 |
| **wry + tao**（Tauri 底层库直接用） | ≈2–5 MiB + WebKitGTK | ≈2–4 MiB | ✅ | Vue 原样 | Rust | 中 | 4–8 周 |
| **GTK4 + WebKitGTK 直写**（C/Vala/gtk-rs） | ≈1–3 MiB + WebKitGTK | ≈1–2 MiB | ✅ | Vue 原样 | C/Vala/Rust | 中 | 6–10 周 |
| **Neutralinojs** | ≈3–5 MiB + WebKitGTK | ≈2–4 MiB | 可选 | Vue 原样 | 无（JS API） | 中低 | 4–6 周 |

> 系统 WebKitGTK 的 143 MiB 是 Arch `webkit2gtk-4.1` 2.54.3 的安装大小；它是**共享依赖**，GNOME/Epiphany 等应用已在用的机器上等于零增量。

#### 为什么这一层能“质变”

- Electron 每个应用都带一份约 285 MiB 的 Chromium；Tauri/Wails 只带自己的 5–20 MiB，渲染交给系统 WebKitGTK。
- 产物是**单个 ELF**（动态链接 glibc/GTK/WebKit），直接满足“一体化”的直觉。
- Vue renderer 原样保留，`out/renderer` 的产物可以直接塞进 Tauri/Wails 的资源系统。

#### 这一层的真实代价

1. **媒体编解码是头号风险。** 现在音频是 `<audio>` + 自定义协议，MV 是 `<video>` + mp4；Electron 自带 ffmpeg，MP3/FLAC/AAC/H.264 都稳。WebKitGTK 走 GStreamer，需要系统安装 `gst-plugins-good/bad/ugly/libav`（Arch 上 MP3 解码在 `ugly`），否则会出现“能播 flac 不能播 mp3”这类问题。必须在目标 Arch 环境做真机 PoC。
2. **自定义协议要重写 Range/流式语义。** 现有 `audio-protocol.ts` 自己实现了 206、`Content-Range`、`net.fetch` 中止；Tauri/Wails 的协议 handler 都要重新实现同样的行为，否则拖动进度条会失效。
3. **登录页是第二风险。** 现在用 `WebContentsView` + 独立 session partition 承载腾讯 xlogin/微信扫码，还要处理设备锁/滑块弹窗。Tauri 可用独立 `data_directory` 的子 WebviewWindow 近似实现，但 cookie 分区、弹窗、User-Agent 需要逐项验证；Wails 的分区能力更弱。退路是“系统浏览器登录 + 回调拉起”，但会改变现有交互。
4. **系统集成要重接。** `safeStorage` → Secret Service（`keyring` crate / `go-keyring`）；`mpris-service` → `souvlaki`/`mpris`（Rust）或 `godbus`（Go）；tray/menu/dialog/single-instance 都有对应库，但都是新代码。
5. **WebKitGTK 的坑。** NVIDIA + DMABUF 需要 `WEBKIT_DISABLE_DMABUF_RENDERER=1`；不同发行版 WebKitGTK 版本差异会带来渲染/媒体行为差异；Electron 的 `--ozone-platform` 那套启动参数不再适用。
6. **AppImage 里打包 GStreamer 会把体积打回 ≈100 MiB。** 如果目标是 Arch 原生包（依赖系统 gstreamer），则没有这个问题；如果要“下载即用、不装依赖”，Tauri 的 `bundleMediaFramework` 会让体积优势消失。

#### Electron API → 替代映射（按现有代码面）

| 现有 Electron API | Tauri 2 | Wails v3 |
| --- | --- | --- |
| `app.requestSingleInstanceLock` | `tauri-plugin-single-instance` | 单实例插件/自实现 |
| `safeStorage` | `keyring` crate（Secret Service） | `go-keyring` |
| `protocol.handle` + Range/206 | `register_asynchronous_uri_scheme_protocol` | `AssetServer` / 自定义 handler |
| `net.fetch`、Cookie、UA | `reqwest` + cookie store | `net/http` + cookiejar |
| `WebContentsView` 登录 | 子 `WebviewWindow` + `data_directory` | 多窗口（分区能力待验证） |
| `Tray` / `Menu` | `tray-icon` / `muda` | `systray` / `menu` |
| `dialog` / `shell` | `tauri-plugin-dialog` / `opener` | `application.Dialog` / `Browser.OpenURL` |
| `ipcMain/ipcRenderer` | `invoke` / `emit` | Services / Events |
| `app.getPath` | `tauri::path` | `application.Paths` |
| MPRIS | `souvlaki` / `mpris` | `godbus` 自实现 |

### L3：彻底原生重写

不推荐仅为了体积走这条路，但列出备查。**renderer 的 12.1k 行 Vue 全部作废**，等于重做整个 UI。

| 技术栈 | 安装后 | 单可执行 | 媒体方案 | 评价 |
| --- | ---: | :---: | --- | --- |
| **Rust GPUI**（`lyrune` 同栈） | ≈15–40 MiB | ✅ | rodio / GStreamer / libmpv | 最贴近“原生 + 小”；GPUI 学习曲线和生态风险高 |
| **Rust Slint / Iced / egui / Dioxus** | ≈8–30 MiB | ✅ | 各自生态，视频弱 | 简单 UI 很好，复杂列表/评论/歌词工作量大 |
| **Flutter Linux** | ≈20–40 MiB | 目录（可 AppImage） | `media_kit`（libmpv）或 GStreamer | UI 能力强，但要重写；libmpv 再 +20 MiB |
| **Qt/QML（C++）** | 动态 ≈5–10 MiB + 系统 Qt；静态 ≈30–50 MiB | ✅（静态） | QtMultimedia/GStreamer | 成熟、原生；C++/QML 重写成本高；LGPL 动态链接没问题 |
| **Compose Multiplatform** | ≈80–120 MiB（含 JRE） | ❌（app-image 目录） | 需自接 | 体积不降反升，排除 |
| **Avalonia / .NET self-contained** | ≈60–90 MiB；AOT ≈15–30 MiB | 可选单文件 | 弱 | 对 Linux 桌面不是最优 |
| **Go + Fyne/Gio** | ≈15–25 MiB | ✅ | 弱 | 自绘 UI，复杂界面成本高 |

其他“看起来小”的选项：

- **Sciter / Ultralight**：≈10–20 MiB，嵌入式 HTML 引擎，但商业授权、生态小、媒体能力有限，不适合作为长期基础。
- **NW.js / CEF**：比 Electron 只大不小，直接排除。
- **Servo/Verso 嵌入**：实验阶段，不能作为产品基础。

## 4. 对比总表

| 方案 | 安装后 | 下载 | 单文件 | 单 ELF | renderer 复用 | main 改造 | 媒体风险 | 综合建议 |
| --- | ---: | ---: | :---: | :---: | :---: | --- | --- | --- |
| 现状 Electron | 308 MiB | 123 MiB | ❌ | ❌ | — | — | 低 | 基线 |
| **L0 Electron 清理 + zstd** | **279 MiB** | **90.5 MiB** | ❌ | ❌ | ✅ | 无 | 低 | **必做** |
| L0 + 可选激进项 | ≈255 MiB | ≈87 MiB | ❌ | ❌ | ✅ | 无 | 中 | 视合规/兼容性 |
| Electron + AppImage | ≈279 MiB | ≈90–100 MiB | ✅ | ❌ | ✅ | 无 | 低 | 想要“一个文件”时的低成本解 |
| Electron + 系统 electron | ≈3 MiB + 319 MiB 共享 | ≈2–3 MiB | ❌ | ❌ | ✅ | 小 | 低 | Arch 专属的总磁盘最优解 |
| **Tauri 2** | ≈8–15 MiB + 143 MiB 共享 | **≈5–10 MiB** | ✅ | ✅ | ✅ | Rust 重写 | **高** | **体积/一体化首选，需 PoC** |
| Wails v3 | ≈12–20 MiB + 141 MiB 共享 | ≈8–15 MiB | ✅ | ✅ | ✅ | Go 重写 | 高 | Go 团队备选 |
| Electrobun | ≈15–65 MiB + 共享 | ≈10–50 MiB | ✅ | 近似 | ✅ | TS 重写 | 高 | 观察，不作为首选 |
| Flutter | ≈20–40 MiB | ≈15–30 MiB | 可打包 | 近似 | ❌ 重写 | Dart 重写 | 中 | 不划算 |
| GPUI/原生 Rust | ≈15–40 MiB | ≈8–30 MiB | ✅ | ✅ | ❌ 重写 | 全重写 | 中高 | 不只为体积 |
| Qt 静态 | ≈30–50 MiB | ≈20–35 MiB | ✅ | ✅ | ❌ 重写 | 全重写 | 低 | 不只为体积 |
| Compose/Avalonia | ≈60–120 MiB | ≈50–100 MiB | 部分 | 部分 | ❌ 重写 | 全重写 | 中 | 排除 |

## 5. 关键风险与待验证清单

按“能否一票否决”排序：

1. **媒体**：在 Arch 干净环境（只装基础桌面）验证 MP3 / FLAC / AAC / H.264 MP4；确认 `gst-plugins-*` 依赖是否要写进包元数据。
2. **登录**：xlogin 扫码、微信扫码、设备锁/滑块子窗口、cookie 分区、UA、登录态跨重启保持。
3. **音频协议**：Range/206、拖动 seek、缓存进度、上游中断、`net.fetch` 的 Abort 语义。
4. **密钥**：`safeStorage` → Secret Service 后，gnome-keyring / KWallet 两种环境都能加解密；无密钥环时的降级行为。
5. **MPRIS**：播放/暂停/上一首/下一首、元数据、进度、Seek；与托盘状态同步。
6. **托盘**：Wayland 下 StatusNotifier/AppIndicator 是否可见；单击播放/暂停。
7. **窗口行为**：关闭到托盘、单实例、窗口标题、全屏 MV、HiDPI。
8. **WebKitGTK 兼容**：NVIDIA DMABUF、Wayland/X11、输入法（IME）。
9. **字体**：三套 `@fontsource` 特殊文字（Avestan/Linear B/Yi）在 WebKitGTK 的渲染与体积。
10. **合规**：GPL-3.0 下分发系统 WebKit/GStreamer 的许可证声明；Electron 的 `LICENSES.chromium.html` 是否可压缩。

## 6. 推荐路线

### 第 0 步（1–2 天，立即做）

- 把 renderer 依赖移到 `devDependencies`，`dependencies` 只留 `mpris-service`。
- `electronLanguages` 只留 `zh-CN` / `en-US`，排除 `*.map`。
- 发布包改用 `tar.zst`（安装脚本用 `tar --zstd`）。
- 预期：**308 → 279 MiB，123.4 → 90.5 MiB**（zstd；gzip 为 116.0 MiB），行为不变。

### 第 1 步（0.5–1 天，按需）

- 如果“一个文件”比“体积”更重要：加 AppImage 目标，保留 tar.zst 作为备选。
- 如果只服务 Arch 且能接受系统依赖：评估 `electron44` 依赖方案，应用包可降到 2–3 MiB。

### 第 2 步（1 周，决策性 PoC）

用 Tauri 2 做一个**只覆盖风险点**的 spike，不追求完整功能：

- 加载现有 `out/renderer`；
- 用自定义协议播一首 MP3/FLAC，验证 Range/seek；
- 播一个 MV mp4（H.264/AAC）；
- 子窗口打开 xlogin 页面，验证 cookie 隔离与登录态；
- 发一条 MPRIS 状态；
- 托盘 + 关闭到托盘；
- Secret Service 存取一次凭证。

**通过标准**：以上全部在 Arch + Wayland 真机通过，且安装包 < 15 MiB。通过则进入正式迁移；任何一项硬阻塞且无低成本替代，则停在 L0 + AppImage。

### 第 3 步（可选）

- 团队更熟 Go：用 Wails v3 重做第 2 步。
- 想保留 TypeScript 全栈：观察 Electrobun，但不要把产品押在它的 Linux 成熟度上。
- 原生重写只在“体积 + 一体化 + 性能”三者都要极致、且愿意投入 2–4 个月时考虑。

## 7. 附：测量方法

```sh
# 下载发布包并解压
curl -L -o lychee.tar.gz <release-url>
tar -xzf lychee.tar.gz

# 总体与明细
du -sh lychee-player
ls -lS lychee-player | head -25
du -sh lychee-player/* | sort -hr

# asar 内部
npx @electron/asar extract lychee-player/resources/app.asar app-extracted
du -sh app-extracted/node_modules/* | sort -hr | head -20
find app-extracted -name '*.map' -printf '%s\n' | awk '{s+=$1} END {print s/1048576" MiB"}'

# 压缩对比
tar -cf lychee.tar lychee-player
zstd -19 -T0 lychee.tar -o lychee.tar.zst
xz -9 -T0 -c lychee.tar > lychee.tar.xz
```

环境数据：Electron 44.9.0（官方 linux-x64 zip 123,314,280 B）；Arch `webkit2gtk-4.1` 2.54.3 安装大小 143,747,013 B；`webkitgtk-6.0` 2.54.3 为 141,043,882 B；`electron44` 44.11.2 为 319,327,528 B。
