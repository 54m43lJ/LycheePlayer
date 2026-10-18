# PENDING — 待拍板事项

> 约定：每项给出背景与默认方案。拍板后**直接删除对应条目**，并把结论落实到 ARCHITECTURE.html / CODE.html / README.html（单一事实源，本文件不记录决议历史）。

## 10. 凭证存储的最终方案与文档表述

- **实测（Hyprland + gnome-keyring 运行中）**：Electron 默认后端探测失败，`safeStorage.isEncryptionAvailable() === false`，凭证以 base64 明文落盘；显式 `--password-store=gnome-libsecret` 后返回 true 且加解密往返成功。`libsecret` 已内置于 Electron（safeStorage → Chromium OSCrypt → libsecret / D-Bus Secret Service），无需引入原生依赖。
- 待拍板：
  - **固定后端 + 拒绝明文**（推荐）：启动参数固定 `gnome-libsecret`（对 gnome-keyring 与 ksecretsservice 均有效）；无可用密钥环时拒绝保存并提示，旧明文凭证自动重加密
  - 维持现状：明文兜底，文档标注限制
- 默认：固定后端 + 拒绝明文；文档措辞回填「系统密钥环」（ARCHITECTURE TERMS/§2、README §2 恢复准确）。

## 12. AudioEngine 抽象的去留

- 设计侧（原 CODE 调用栈、原架构图、PENDING #3）假设存在独立 `AudioEngine` 模块；POC 实际把 HTML5 Audio 元素**内嵌在 `stores/player.ts`**，没有独立模块。文档已按现状改写。
- **默认**：维持现状（store 内嵌），引入 libmpv 时再抽出 AudioEngine 模块
- **备选**：现在就抽独立模块，为替换播放引擎预留干净边界
