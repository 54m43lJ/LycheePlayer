# Lychee Player — 第三方 QQ 音乐 Linux 客户端

[USER](USER.html) [CORE](CORE.html) [PROVIDER](PROVIDER.html)

## 1. WHAT & WHY

[↑](#top)

### 1.1 IDEAL：要解决的问题

腾讯官方的 QQ 音乐 Linux 版基于 Electron，资源占用偏高，MPRIS 媒体控制残缺， 不支持音质选择，无法融入 Linux 桌面生态（托盘、桌面歌词等）。 本项目希望提供一个由社区驱动、原生融入 Linux 桌面的 QQ 音乐客户端。

### 1.2 GOAL：什么算成功

- 用户能用自己的 QQ 音乐账号登录，浏览、搜索并播放自己有权收听的内容（含 VIP 曲库按账号权限）。
- 系统托盘与 Linux 桌面集成。
- 用户可自由选择音质；日常听歌可以完全替代官方 Linux 客户端。
- 当前仅支持 Arch Linux x86\_64；提供 tar.gz 与 curl 一行安装（当前为 Preview 预发布）。
- 资源占用与启动速度显著优于官方 Electron 客户端。

### 1.3 非目标

- 不实现任何绕过授权、付费墙或数字专辑限制的能力。
- 不内置、分发或镜像音乐内容；所有内容均通过用户本人的登录凭证从上游获取。
- 音频缓存与下载仅限本机个人使用；不提供分享、批量分发或绕过权限的导出能力。

## 2. 用户交互

[↑](#top)

| 场景 | 行为 | 详细契约 |
| --- | --- | --- |
| 登录 | 登录页内嵌官方 xlogin 组件扫码（默认），或粘贴浏览器 Cookie（兜底）；凭证边界与密钥环策略见 [USER §2](USER.html#u2)。 | [USER §5.2.6](USER.html#u5-2-6) |
| 搜索 | 按单曲、歌手、专辑、歌单四类搜索；结果分页展示；双击歌曲播放，点击歌单卡片进入详情。 | [USER §5.2.8](USER.html#u5-2-8) |
| 播放 | 双击歌曲或“播放全部”开始播放；“下一首播放”把对应歌曲插入播放队列头。 | [USER §5.2.3](USER.html#u5-2-3) · [§5.2.9](USER.html#u5-2-9) |
| 歌词 / 评论 | 点击播放条封面打开；左侧歌词、右侧评论，各占主区域一半。歌词当前行高亮、点击跳转播放进度；评论可刷新。 | [USER §5.2.5](USER.html#u5-2-5) |
| 歌单 | 浏览当前账号的歌单列表与公开歌单详情；歌单会标记不可播与最高可用音质。 | [USER §5.2.8](USER.html#u5-2-8) |
| 启动参数 | 设置页可查看 / 编辑启动参数文件；修改后下次启动生效。 | [USER §5.2.7](USER.html#u5-2-7) · [USER §2](USER.html#u2) |
| 安装 / 运行 | 下载 tar.gz 手动运行，或用 curl 一行安装到用户目录 / 系统目录（默认 Preview）。 | [BUILD](BUILD.html) |
| 发现（待探测） | “发现”页预留每日推荐、专属雷达与猜你喜欢；上游接口验证前显示空状态。 | [USER §5.2.8](USER.html#u5-2-8) |
| 收藏 / 歌单管理 | 收藏歌曲已可用；歌单创建、改名、删除与增删歌曲仍在探测，当前提示暂不可用。 | [USER §5.2.8](USER.html#u5-2-8) |
| MV（待探测） | MV 搜索 / 详情 / 取流接口尚未验证；当前搜索为空，播放提示待探测。 | [USER §5.2.8](USER.html#u5-2-8) |
| 下载 | 下载当前账号可播歌曲到本机；下载中心管理进度、暂停 / 继续与删除。 | [USER §5.2.7](USER.html#u5-2-7) |
| 系统集成 | 通过 MPRIS 暴露媒体控制；托盘菜单随播放状态更新；播放引擎切换为预留 / 未上线能力，当前以 HTML5 Audio 为准。 | [PROVIDER §4.4](PROVIDER.html#p4-4) · [USER §5.4](USER.html#u5-4) |
| 外观 | 深色 / 浅色主题；窄屏下自动切换为紧凑布局（断点见 [USER §5.2.1](USER.html#u5-2-1)）。 | [USER §5.1](USER.html#u5-1) |
| 设置 | 默认音质、主题、关闭到托盘、启动参数、缓存与下载、账号状态、立即续期与退出登录；音频引擎仅保留预留字段。修改即写盘，无保存按钮。 | [USER §5.2.7](USER.html#u5-2-7) |

## 3. Credits

[↑](#top)

### 3.1 参考项目

| 项目 | 技术栈 |
| --- | --- |
| amtoaer/lyrune | Rust + GPUI |
| jsososo/QQMusicApi | Node.js |
| L-1124/QQMusicApi | Python |
| jixunmoe-go/qrc | Go |
| lyswhut/lx-music-desktop | Electron + Vue（Apache-2.0） |
| imsyy/SPlayer | Electron + Vue3 |
| MoeKoeMusic | Electron + Vue3 |
| Team-Quaver/quaver-music | Electron + Vite |

### 3.2 许可与例外声明

- 许可证正文见 `LICENSE`（GPL-3.0-only）；衍生作品分发时须整体以同协议开源。
- 以下为非官方项目的例外声明：本项目与腾讯及 QQ 音乐无隶属关系，仅调用官方可访问接口（无公开文档）。
- VIP / 数字专辑内容仅通过用户本人的登录凭证获取，不实现任何绕过授权的能力。
- 上游接口随时可能变更导致功能失效，属预期风险。