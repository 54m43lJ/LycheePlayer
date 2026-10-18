# PENDING — 待拍板事项

> 约定：每项给出背景与默认方案。拍板后**直接删除对应条目**，并把结论落实到 ARCHITECTURE.html / CODE.html / README.html（单一事实源，本文件不记录决议历史）。

## 12. AudioEngine 抽象的去留

- 设计侧（原 CODE 调用栈、原架构图、PENDING #3）假设存在独立 `AudioEngine` 模块；POC 实际把 HTML5 Audio 元素**内嵌在 `stores/player.ts`**，没有独立模块。文档已按现状改写。
- **默认**：维持现状（store 内嵌），引入 libmpv 时再抽出 AudioEngine 模块
- **备选**：现在就抽独立模块，为替换播放引擎预留干净边界
