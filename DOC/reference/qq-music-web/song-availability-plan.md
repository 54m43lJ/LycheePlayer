# 歌曲可播检测与批量详情封装方案

- 上游接口：`music.trackInfo.UniformRuleCtrl / CgiGetTrackInfo`
- 相关文档：[`playability.md`](./playability.md)（官方灰化公式与字段取证）
- 文档性质：项目侧方向与实施思路，不是官方公开契约；只描述目标设计，不代表已经落地。

## 目标

同时解决两件事：

1. **改正判灰的数据来源**：歌单 / 「我喜欢」列表里的 `action.switch` 可能是过期快照，不能直接作为最终判灰依据；改用详情侧的权益数据。
2. **收口批量详情请求**：把 `CgiGetTrackInfo` 的「100 首一批」封装成一个入口，调用方只传任意数量的 mid，不再各自实现分片。

## 问题与依据

官方灰化公式本身不变：

```text
play      = play_lq || play_hq || play_sq || play_5_1
tryPlay   = try && file.size_try > 0
payable   = pay.pay_play || pay.pay_down
disabled  = !(play || payable || tryPlay)
```

问题在于同一首歌不同接口给出的 `action` 不一致：

- 「我喜欢」列表 `CgiGetDiss` / `uniform_get_Dissinfo` 对 `OK (feat. Don Toliver|Explicit)` 返回 `switch = 134327679`，play 位是 1；
- 详情 `get_song_detail_yqq` / `CgiGetTrackInfo` 返回 `switch = 134283265`，play 位是 0；
- 取流 `CgiGetVkey` 的 `auth_switch` 也是 `134283265`，`result = 104003`，没有 `purl`。

也就是说列表侧保留了旧权益，详情侧和取流侧才是当前账号的真实状态。已下架歌曲（如 `Ambitionz Az A Ridah`、`Blow`）列表与详情一致，都是 `switch = 65537`，所以之前只修列表字段就能解决；「有专辑但不可播」的歌曲属于另一种情况。

专辑列表 `GetAlbumSongList` 与详情一致，官方详情页 / 专辑页因此能正确置灰。项目侧要做的不是重新发明公式，而是**把判灰输入从列表 `action` 换成详情 `action`**。

## 证据

### 复核方法

2026-11-24，当前登录账号，对「我喜欢」668 首同时请求：

- 列表：`CgiGetDiss`，以及官方网页端使用的 `uniform_get_Dissinfo`；
- 详情：`get_song_detail_yqq`（逐首）与 `CgiGetTrackInfo`（批量）；
- 取流：`CgiGetVkey` 返回的 `auth_switch`。

### 列表与详情不一致

668 首中有 10 首不一致，全部是「列表可播、详情不可播」。代表样本：

| 歌曲 | 列表 `switch` | 详情 `switch` | 列表 `msgid` | 详情 `msgid` | 列表 `icons` | 详情 `icons` |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| OK (feat. Don Toliver\|Explicit) | 134327679 | 134283265 | 0 | 3 | 131073 | 2621441 |
| ALL THE LOVE (feat. Andre Troutman) (Explicit) | 134331775 | 134283265 | 0 | 3 | 131073 | 2621441 |
| PUNCH DRUNK | 134331775 | 134283265 | 0 | 3 | 131073 | 2621441 |
| Ain't No Fun(If the Homies Cant Have None) | 134331775 | 134283265 | 0 | 3 | 131073 | 2621441 |

其余 6 首（`WHATEVER WORKS`、`BEAUTY AND THE BEAST`、`WHITE LINES`、`PREACHER MAN`、`LAST BREATH`、`PREACHER MAN (Explicit)`）同型。两个列表接口（`CgiGetDiss` 与 `uniform_get_Dissinfo`）对这 10 首返回的值相同；两个详情接口（`get_song_detail_yqq` 与 `CgiGetTrackInfo`）也返回相同的值。完整 10 首表见 [`playability.md`](./playability.md) 的「实测：歌单列表 action 与详情不一致」。

关键点：

- 列表 `switch = 134331775` / `134327679` 都带 `play_lq` / `play_hq` / `play_sq` 位；详情 `134283265` 只有哨兵位与 poster 位。
- `pay_play = 0`、`pay_down = 0`、`size_try = 0`、`status = 0` 在列表与详情完全相同，无法用这些字段区分。
- 列表 `switch2` 在 9 首为非零，`PUNCH DRUNK` 为 0；不能靠 `switch2` 特判。
- 列表 `msgid = 0`，详情 `msgid = 3`；`icons` 也不一致。它们可辅助解释原因，但不能替代详情 `switch`。

### 取流侧对照

- `OK`、`ALL THE LOVE`、`PUNCH DRUNK`、`LAST BREATH`、`WHATEVER WORKS`、`Ain't No Fun` 等样本：`auth_switch = 134283265`，`result = 104003`，`purl` 为空。
- 可播样本 `After Party`（`001wQLnw0g7jh4`）：`auth_switch = 16905999`，与详情 `switch` 相同；`result = 0`，`purl` 非空。

因此：

```text
详情 action.switch == vkey auth_switch == 实际是否有权取流
歌单列表 action.switch != 详情 action.switch（仅对部分歌曲）
```

### 对照样本

- 已下架 4 首（`Ambitionz Az A Ridah`、`6 Foot 7 Foot`、`Kangaroo Court`、`Blow`）：列表与详情一致，都是 `switch = 65537`、`msgid = 1`、`icons = 524288`，两边都 `disabled`。说明此前只修列表字段的做法对这类歌曲有效。
- `BULLY - DELUXE` 专辑列表 20 首与 `CgiGetTrackInfo` 全部一致（19 首为 `134283265`，`MISSION CONTROL` 为 `134217729`），`msgid` 均为 `3`。官方专辑页因此能正确置灰这 10 首中的 9 首。
- 同账号另一份 468 首歌单：列表与详情 0 差异。说明不是全局性错误，而是部分歌曲的列表快照过期。

### 批量边界

- 1–100 首：正常返回；
- 110–160 首：`code=0`，但只返回前 100 首，后面的静默丢弃；
- 180 首及以上：HTTP/2 会话被关闭。
- 668 首按 100 分片为 7 个请求；串行无延迟约 0.9 秒，并发约 0.15 秒；连续 3 轮 21 个请求未出现 `2001` / `104604` / `104009`。

## 检测方法的改正

### 当前链路

```text
歌单列表 / 我喜欢
  → CgiGetDiss / uniform_get_Dissinfo
  → Song.playSwitch（列表 action.switch）
  → songPlayState()
  → 行是否灰
```

### 目标链路

```text
歌单列表 / 我喜欢
  → 只取顺序、标题、专辑等基础元数据
  → fetchTrackInfoByMids(本批歌曲)
  → 用详情侧 action.switch / file.size_try / pay 覆盖 Song 的权益字段
  → songPlayState()
  → 行是否灰
```

原则：

- 列表接口只负责「有哪些歌、什么顺序、展示什么」，不负责最终可播判定。
- 详情侧是判灰权威；`songPlayState()` 的五态逻辑不变。
- 专辑页、单曲详情页本来就用详情数据，不需要改。
- 搜索接口仍按 `unknown` 处理，不为了判灰逐行补详情。
- 不用列表的 `msgid`、`icons`、`switch2` 做魔法值特判；这些只能辅助解释原因，不能替代详情 `switch`。
- `switch` 与账号 / 地区 / 登录态绑定；登录、换账号、换出口后应让歌单缓存失效或重新拉取。

判定结果保持现有语义：

| 状态 | 表现 |
| --- | --- |
| `playable` | 正常，可直接播放 |
| `paywall` | 不灰，点击提示开通 / 购买 |
| `trial` | 不灰，播放试听片段 |
| `disabled` | 灰色，点击提示当前不可播放 |
| `unknown` | 正常展示，尝试播放，失败走 `NO_STREAM` |

## 批量详情封装

### 方向

新增一个模块，例如 `src/main/api/track-info.ts`，对外只暴露一个入口：

```ts
fetchTrackInfoByMids(mids: string[]): Promise<Map<string, RawTrack>>
```

调用方传入任意数量的 mid，例如整份「我喜欢」668 首；内部负责去重、过滤空值、按固定上限分片、循环请求 `CgiGetTrackInfo`，最后按 mid 返回。

调用签名不提供 `batchSize`、`max` 之类的参数。分片是接口实现细节，不需要也不应该由调用方决定。

### 固定上限

上游实测：

- 1–100 首：正常返回；
- 110–160 首：`code=0`，但只返回前 100 首，后面的静默丢弃；
- 180 首及以上：HTTP/2 会话被关闭。

因此内部固定 **100 首 / 请求**，并把常量从 `SONG_DETAIL_BATCH = 50` 改名为 `TRACK_INFO_BATCH_MAX = 100`。不要提供调大分片的入口；超过 100 会触发静默截断，缺失歌曲随后走逐首兜底，反而放大请求。

`SONG_DETAIL_CONCURRENCY = 2` 保留，它只用于批量缺口时的逐首 `get_song_detail_yqq` 兜底，和批量分片不是同一个概念。

### 速度与限速

- `CgiGetTrackInfo` 没有客户端限速；封装内部只是顺序 `await`，不需要加 `sleep`。
- 668 首按 100 分片是 7 个请求，串行约 0.9 秒，并发约 0.15 秒；连续多轮未出现 `2001` / `104604` / `104009`。
- 真正需要严格限速的是 `CgiGetVkey`：单首请求 + 300ms 间隔，只服务实际播放 / 下载，不用于判灰。
- 对 668 首这种规模，不需要限制成「只看当前可见页」；超大歌单再按页或分批。

### 调用点

- `src/main/api/song.ts`：`fetchTracksById()` 使用封装入口；删除本地 `fetchTrackBatch()` 的分片循环。`getDetail` / `getMvId` / `resolveStreams` 的调用方式不变。
- `src/main/api/playlist-write.ts`：`fetchTrackIdentities()` 使用同一个封装入口，删除自己的分片循环；缺失歌曲仍保留逐首兜底和 `id` / `type` 校验。
- 歌单 / 「我喜欢」的加载路径：在列表歌曲映射之后、写入缓存之前，用封装入口批量取详情权益并合并到 `Song`；列表字段继续用于顺序和元数据。

## 落地顺序

1. 新增 `track-info` 封装，改名常量，替换 `song.ts` / `playlist-write.ts` 的重复分片。
2. 在歌单 / 「我喜欢」加载路径接入详情权益覆盖，完成判灰数据源改正。
3. 补测试：任意总数按 100 分片、空输入、去重、响应顺序、缺失兜底、`OK` 这类列表与详情不一致的样本。
4. 更新 `DOC/CORE.html`、`playability.md`、`DOC/IMPL.md` 与 `DOC/TODO.md`。
5. 验证：`OK` 变灰；已下架的 4 首仍然灰；正常歌曲不受影响；列表顺序和总数不变。

## 非目标

- 不为判灰逐首申请 vkey。
- 不为搜索页逐行补详情。
- 不修改官方灰化公式本身。
- 不修改 `CgiGetVkey` 的限速策略。
- 不修改专辑页、单曲详情页的既有判灰路径。
- 不新增可配置的批量大小。

## 风险与约束

- 100 是硬上限；实现里应把分片大小固定在封装内部，避免调用方或后续维护者把它当成可调参数。
- 批次失败语义保持现状：某一批失败会让整次批量取详情失败；若要提高健壮性，应另做批次级重试 / 部分结果，而不是缩小分片。
- 详情覆盖只改变权益字段，不改变歌曲顺序、标题、专辑等展示元数据。
- 详情 `switch` 仍受账号 / 地区影响；缓存失效时机要与登录态变化保持一致。

## 状态

方向已确认，方案待实施。
