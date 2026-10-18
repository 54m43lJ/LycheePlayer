# PENDING — 待拍板事项

> 约定：每项给出背景与默认方案。拍板后**直接删除对应条目**，并把结论落实到 ARCHITECTURE.html / CODE.html / README.html（单一事实源，本文件不记录决议历史）。

## 2. 开源许可证

- 已拍板的约束：#1 定为自研实现，无第三方 GPL 代码混入；全部依赖为 MIT / Apache-2.0。
- 作者诉求：项目主要**个人使用**，公开发布仅作展示与供他人参考；**不允许他人闭源商用本项目代码**。
- 对比结论：MIT 与 Apache-2.0 均为宽松协议，**明确允许闭源商用**（仅要求保留版权/许可声明），无法满足上述诉求；GPL-3.0 的 copyleft 要求衍生作品分发时整体以 GPL 开源，是三者中唯一禁止「闭源衍生」的方案（不禁止开源形式的商用）。
- 默认：**GPL-3.0**。确认后添加 LICENSE 文件并在 README 声明，同时删除本条。

## 3. 播放引擎首发形态

- **HTML5 Audio**（默认）：零原生依赖，m4a/mp3/flac 都能解，MVP 够用
- libmpv（napi 内嵌，EchoMusic 路线）：EQ、频谱、淡入淡出、gapless，但要引入 Rust/C++ 构建链
- 建议：HTML5 Audio 先行，libmpv 作为进阶里程碑，架构上 AudioEngine 已隔离，可替换

## 4. 首发登录方式

- 扫码登录（默认）：体验最好，但上游二维码接口变动风险最高
- Cookie 手动粘贴：作为兜底入口建议同时保留（扫码挂掉时的保命通道）
- 手机号 / 密码登录：不建议做，涉及验证码与风控

## 5. 音质默认值与降级提示

- 默认音质：**320k**（默认）还是 128k 省流量还是「按账号权限取最高」
- 降级行为已定（ARCHITECTURE §2：降一档重试），但**降级发生时是否给 toast 提示**需要拍板（涉及体验 vs 安静）

## 6. 关闭行为

- `closeToTray`（关闭即最小化到托盘）默认开还是关？
- 托盘常驻是否作为 MVP 内容？（README 路线图目前把托盘放在进阶；官方客户端 MPRIS 残废是核心卖点，托盘跟随 MPRIS 提前的话 MVP 范围要改）

## 7. 应用命名与 app-id

- 项目目录名 `qqy` 是否就是正式应用名？还是起个正式名字（影响 desktop 文件、`org.xxx.qqy` app-id、flatpak 提交、窗口标题）
- 默认暂用 `qqy`，正式发布前必须定

## 8. UI 原型

- README §2 目前只有交互文字清单。是否先出线框图 / 可点原型再动手写界面？
- 默认：MVP 页面直接实现，原型后补

## 9. 范围外功能确认

以下功能默认**全部延后**，如有想提前的请指出：

- MV / 视频播放
- 其他平台歌单导入（网易 / 酷狗等）
- Last.fm scrobble
- 全局快捷键
- 下载管理（注意：下载涉及 VIP 内容的边界，建议只允许下载当前账号可播内容）

## 10. 凭证存储的最终方案与文档表述

POC 实现与现有文档表述不一致，需要拍板口径：

- **文档现状**：ARCHITECTURE TERMS / §2 会话续期、README §2 均写「凭证存入系统密钥环」。
- **实现现状**：凭证落在 `~/.config/qqy/credential.bin`（`{ version, encrypted, payload }`）；`safeStorage` 可用时加密（Linux 下 safeStorage 后端就是 libsecret / kwallet 密钥环），**不可用时退化为 base64 明文**（权限 0600）。POC.md 已列为已知限制。
- **默认**：追认 POC 实现，文档措辞统一改为「safeStorage 加密落盘；无密钥环时明文兜底（已知限制）」
- **备选**：正式版引入 keytar / libsecret 硬依赖，无密钥环时拒绝保存并提示（打包发布前需定）
- 关联：`general-architecture.puml` / `seq-login.puml` 中的「系统密钥环」字样已临时改为中性表述，拍板后按结论回填

## 11. POC 已成事实的决策追认（确认后删除对应原条目）

以下事项 POC 已按各条目的**默认方案**落地，属于事后追认；确认后删除原条目并落实文档：

| 原条目 | 事实现状 | 待落实 |
| --- | --- | --- |
| #1 API 层来源 | 自研 TS 模块（`src/main/api/`），无 GPL 依赖 | 删除 #1 |
| #2 许可证 | `package.json` 已标 Apache-2.0，但**仓库尚无 LICENSE 文件** | 补 LICENSE 并在 README 声明，删除 #2 |
| #3 播放引擎 | HTML5 Audio 已实现并验证 | libmpv 保留在 README 进阶路线，删除 #3 |
| #4 登录方式 | 官方 xlogin 扫码（默认）+ Cookie 兜底 + 实验性应用内二维码；Cookie 成功路径尚未回归测试 | 删除 #4，回归项留在 IMPLEMENTATION §12 |
| #5 默认音质 | 320k 已是默认值并实现；**仅剩「降档是否 toast」子项未定**（当前实现：静默降档，实际音质看 `UrlResult.quality`） | 拍板 toast 子项后删除 #5 |
| #6 关闭行为 | `closeToTray` 默认 false 已实现；托盘与 MPRIS 已提前落地，**README 路线图仍把托盘/MPRIS/音质切换放在「进阶」** | 按现状改写 README 路线图 MVP 范围，删除 #6 |
| #8 UI 原型 | MVP 页面已直接实现（默认方案「原型后补」） | 删除 #8 |

## 12. AudioEngine 抽象的去留

- 设计侧（原 CODE 调用栈、原架构图、PENDING #3）假设存在独立 `AudioEngine` 模块；POC 实际把 HTML5 Audio 元素**内嵌在 `stores/player.ts`**，没有独立模块。文档已按现状改写。
- **默认**：维持现状（store 内嵌），引入 libmpv 时再抽出 AudioEngine 模块
- **备选**：现在就抽独立模块，为替换播放引擎预留干净边界
