# PENDING — 待拍板事项

> 约定：每项给出背景与默认方案。拍板后**直接删除对应条目**，并把结论落实到 ARCHITECTURE.html / CODE.html / README.html（单一事实源，本文件不记录决议历史）。

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
- **实现现状**：凭证落在 `~/.config/lychee-player/credential.bin`（`{ version, encrypted, payload }`）；`safeStorage` 可用时加密（Linux 下 safeStorage 后端就是 libsecret / kwallet 密钥环），**不可用时退化为 base64 明文**（权限 0600）。POC.md 已列为已知限制。
- **默认**：追认 POC 实现，文档措辞统一改为「safeStorage 加密落盘；无密钥环时明文兜底（已知限制）」
- **备选**：正式版引入 keytar / libsecret 硬依赖，无密钥环时拒绝保存并提示（打包发布前需定）
- 关联：`general-architecture.puml` / `seq-login.puml` 中的「系统密钥环」字样已临时改为中性表述，拍板后按结论回填

## 11. POC 已成事实的决策追认（确认后删除对应原条目）

以下事项 POC 已按各条目的**默认方案**落地，属于事后追认；确认后删除原条目并落实文档：

| 原条目 | 事实现状 | 待落实 |
| --- | --- | --- |
| #8 UI 原型 | MVP 页面已直接实现（默认方案「原型后补」） | 删除 #8 |

## 12. AudioEngine 抽象的去留

- 设计侧（原 CODE 调用栈、原架构图、PENDING #3）假设存在独立 `AudioEngine` 模块；POC 实际把 HTML5 Audio 元素**内嵌在 `stores/player.ts`**，没有独立模块。文档已按现状改写。
- **默认**：维持现状（store 内嵌），引入 libmpv 时再抽出 AudioEngine 模块
- **备选**：现在就抽独立模块，为替换播放引擎预留干净边界
