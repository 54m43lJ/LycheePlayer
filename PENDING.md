# PENDING — 待拍板事项

> 约定：每项给出背景与默认方案。拍板后**直接删除对应条目**，并把结论落实到 ARCHITECTURE.html / CODE.html / README.html（单一事实源，本文件不记录决议历史）。

## 10. 凭证存储的最终方案与文档表述

POC 实现与现有文档表述不一致，需要拍板口径：

- **文档现状**：ARCHITECTURE TERMS / §2 会话续期、README §2 均写「凭证存入系统密钥环」。
- **实现现状**：凭证落在 `~/.config/lychee-player/credential.bin`（`{ version, encrypted, payload }`）；`safeStorage` 可用时加密（Linux 下 safeStorage 后端就是 libsecret / kwallet 密钥环），**不可用时退化为 base64 明文**（权限 0600）。POC.md 已列为已知限制。
- **默认**：追认 POC 实现，文档措辞统一改为「safeStorage 加密落盘；无密钥环时明文兜底（已知限制）」
- **备选**：正式版引入 keytar / libsecret 硬依赖，无密钥环时拒绝保存并提示（打包发布前需定）
- 关联：`general-architecture.puml` / `seq-login.puml` 中的「系统密钥环」字样已临时改为中性表述，拍板后按结论回填

## 12. AudioEngine 抽象的去留

- 设计侧（原 CODE 调用栈、原架构图、PENDING #3）假设存在独立 `AudioEngine` 模块；POC 实际把 HTML5 Audio 元素**内嵌在 `stores/player.ts`**，没有独立模块。文档已按现状改写。
- **默认**：维持现状（store 内嵌），引入 libmpv 时再抽出 AudioEngine 模块
- **备选**：现在就抽独立模块，为替换播放引擎预留干净边界
