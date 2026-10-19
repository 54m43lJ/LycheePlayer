# 文档迁移：待拍板事项

新框架文档已生成：

- `README.html` — WHAT & WHY · 用户交互 · 原型 · Credits
- `USER.html` — 术语 · 约定 · 图 · MPRIS · UI
- `CORE.html` — 文件树 · 约定 · SBOM · 内部类型与签名 · 调用栈
- `PROVIDER.html` — 上游术语 · 约定 · 协议图 · 接口 / 错误 / 数据转换
- 旧的 `ARCHITECTURE.html` / `CODE.html` 已移除；`diagram/` 已按 USER / PROVIDER 重新拆分并导出。

下面 13 项是迁移时无法从旧文档或代码唯一确定的地方。当前文档先按“建议”落地；你拍板后我再改。

---

## 1. IPC API 放在 CORE 还是 USER？

- 现状：`window.lychee` 的 IPC 契约放在 `CORE §4.1 / §4.2`。理由：渲染进程属于本项目内部，不是外部依赖方。
- 备选：
  - A. 保持 CORE（建议）
  - B. 移到 USER §4，把渲染进程视为“依赖软件”
  - C. 类型放 CORE，API 面放 USER
- 影响：USER 目前只有 MPRIS 一个对外接口；选 B 会让 USER 的 INTERFACES 更充实，但会打破“CORE = 项目内部”的边界。

**拍板：** ☐ A ☐ B ☐ C

---

## 2. MPRIS 放在 USER 还是 PROVIDER？

- 现状：暴露给桌面环境的 MPRIS 接口放 `USER §4.1`；D-Bus 不可用时的静默降级放 `PROVIDER §2`；实现签名放 `CORE §4.17`。
- 备选：
  - A. 保持拆分（建议）
  - B. 全部放 USER
  - C. 全部放 PROVIDER
- 说明：D-Bus 同时是“应用暴露 MPRIS 的通道”和“应用依赖的系统服务”，两种归属都有道理。

**拍板：** ☐ A ☐ B ☐ C

---

## 3. UI 原型与视觉契约怎么分？

- 现状：`README §3` 只放整体布局示意；`USER §5.1` 放调色板，`USER §5.2` 放各组件视觉契约与示例。
- 备选：
  - A. 保持拆分（建议）
  - B. 全部放 README 的原型章节
  - C. 全部放 USER 的 UI 章节
- 影响：README 的“原型”要求与 USER 的“UI 视觉呈现”要求存在重叠，当前按“整体原型 vs 组件契约”切分。

**拍板：** ☐ A ☐ B ☐ C

---

## 4. 项目阶段写 POC 还是 MVP？

- 现状：旧 README 写“MVP（已交付）”；界面侧栏、设置页仍写 `POC`；`package.json` 版本为 `0.1.0-poc`。
- 备选：
  - A. 文档统一写 MVP，界面 / 版本号后续再改（建议）
  - B. 全部统一写 POC
  - C. 文档写 MVP，代码暂时保留 POC 文案
- 影响：`README §1`、`USER §5.2.2`、界面文案、`package.json`。

**拍板：** ☐ A ☐ B ☐ C

---

## 5. 未使用 / 实验路径怎么处理？

- 现状：
  - `createQrKey` / `startQrLogin` 已实现，但当前没有任何页面调用；默认登录是内嵌 xlogin。`qrImage` 未被使用，`qrStage` 仅用于登录页的跳转判断。
  - `getDetail` 已导出，但当前没有调用方。
  - `Song.songId` 会被填充，但渲染进程没有使用。
- 备选：
  - A. 全部保留，文档按“备选路径”记录（当前做法）
  - B. 删除 `getDetail` 与 `songId`，二维码路径保留为备选（建议）
  - C. 全部删除，只保留内嵌 xlogin 登录
- 影响：`CORE §4.11 / §4.15 / §4.27`、`PROVIDER §3.1 / §4.1`、登录页与 store 代码。
- 备注：如果选 C，`PROVIDER §3.1` 提到的 `ptqrshow` / `ptqrlogin` / `check_sig` 备选路径也可以彻底删除。

**拍板：** ☐ A ☐ B ☐ C

---

## 6. 登录流程在 USER 和 PROVIDER 各画一张，是否保留？

- 现状：`USER §3.2` 是业务语言时序图（用户 / 应用 / QQ 登录）；`PROVIDER §3.1` 是协议时序图（xlogin / OAuth / QQLogin）。
- 备选：
  - A. 两张都保留（建议）
  - B. 只保留 PROVIDER 的协议图，USER 用文字描述
  - C. 只保留 USER 的业务图，PROVIDER 用接口表描述
- 影响：单源真相的观感；两张图抽象层不同，但读者可能觉得重复。

**拍板：** ☐ A ☐ B ☐ C

---

## 7. 错误模型分三处，是否过于分散？

- 现状：
  - `CORE §4.1` 定义 `ErrorCode` 与含义注释；
  - `USER §5.3` 定义界面文案与用户行为；
  - `PROVIDER §4.2` 定义上游错误码到内部 `ErrorCode` 的映射。
- 备选：
  - A. 保持三处（建议）
  - B. 合并到 USER
  - C. 合并到 CORE
- 说明：三处分别回答“内部是什么”“用户看到什么”“上游怎么映射”，但维护时要同步改三处。

**拍板：** ☐ A ☐ B ☐ C

---

## 8. 旧文档怎么处理？

- 现状：`ARCHITECTURE.html` / `CODE.html` 已删除；`README.html` 已重写。
- 备选：
  - A. 直接删除（建议）
  - B. 保留两个跳转页，指向新文档
  - C. 保留为历史存档（会违反 single source of truth）
- 影响：外部链接、书签、旧提交说明。

**拍板：** ☐ A ☐ B ☐ C

---

## 9. TODO / BUILD / reference 与 README 路线图

- 现状：`TODO.md` 保留并从 README 链接；`BUILD.html` 未创建；`reference/` 未创建；README 不再有“技术栈 / 功能路线图 / 相关文档”章节，技术栈进 CORE SBOM，路线图进 TODO。
- 备选：
  - A. 保持现状（建议）
  - B. 把 TODO 并入 README，删除 TODO.md
  - C. 现在就创建 BUILD.html
  - D. 建立 `reference/` 并镜像 QQ 音乐相关资料
- 说明：GUIDELINES 规定 BUILD 在开发完成后写；`reference/` 是可选的官方文档镜像，QQ 音乐没有公开官方接口文档。

**拍板：** ☐ A ☐ B ☐ C ☐ D

---

## 10. 许可与非官方声明放哪里？

- 现状：放在 `README §4 Credits`：参考项目表、GPL-3.0-only、非官方声明、上游变更风险。
- 备选：
  - A. 保持 Credits（建议）
  - B. README 新增独立“法律与合规”章节
  - C. 移到 `LICENSE` 或单独 `LEGAL.html`
- 说明：新 README 模板没有法律章节；Credits 是唯一“总是存在且最后”的章节。

**拍板：** ☐ A ☐ B ☐ C

---

## 11. 原型用什么形式？

- 现状：沿用旧文档的 HTML/CSS 示意图（`.ui-proto`），可交互、无外部图片资源。
- 备选：
  - A. 保持 HTML 示意图（建议）
  - B. 换成真实截图
  - C. 截图 + HTML 示意图并存
- 说明：HTML 示意图便于跟 CSS token 同步；截图更直观但需要维护图片资源。

**拍板：** ☐ A ☐ B ☐ C

---

## 12. IPC 校验上限要不要写进 CORE？

- 现状：旧文档写了 `song.getUrls` 的 `mids` 非空且 ≤100、`search.byType` 的 `pageNo` 1–100 / `pageSize` 1–50（缺省 20）。新 GUIDELINES 规定 CORE 不写工程常量，所以这些数字没有进文档，只在代码里。
- 备选：
  - A. 按新规省略（建议）
  - B. 作为接口契约写进 CORE（把容量限制视为例外）
  - C. 写进 USER（但它们不是用户可见限制）
- 影响：实现者是否需要读代码才能知道上限。

**拍板：** ☐ A ☐ B ☐ C

---

## 13. `AUTH_EXPIRED` 的行为与登录错误文案

- 现状：
  - 旧文档写“凭证过期 → 清除本地凭证，引导重新扫码登录”。
  - 实际实现只弹 Toast “登录已失效，请重新登录”，不会自动清除凭证。
  - `describeError` 对已知错误码使用固定文案，会丢弃上游返回的具体登录原因（验证码、设备超限、账号受限等）。
- 备选：
  - A. 文档按当前行为写（已按此落地），代码行为另开任务（建议）
  - B. 改代码：`AUTH_EXPIRED` 时自动清除凭证并跳转登录页
  - C. 改代码：登录类错误优先展示上游 `message`，其余仍用固定文案
  - D. B + C
- 影响：`USER §5.3`、登录页 Toast、`stores/auth.ts`、`renderer/api.ts`。

**拍板：** ☐ A ☐ B ☐ C ☐ D

---

## 附：当前已直接修正的不一致

- `diagram/general-architecture.puml` 里的 `window.qqy` 已改为 `window.lychee`，与代码和文档一致。
- 侧栏宽度按实际 CSS 从旧文档的 200px 改为 224px。
- 播放条窄屏高度补上 84px（≤900px），并保留 116px（≤560px）。
- 歌曲列表隐藏专辑列的断点按实际 CSS 从 ≤560px 改为 ≤900px。
- “POC 验证版本”已从 UI 原型中移除，是否保留在真实界面由第 4 项决定。
