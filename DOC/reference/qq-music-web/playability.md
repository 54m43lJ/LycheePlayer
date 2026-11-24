# QQ 音乐网页端「变灰 / 不可播」判定

- 取证对象：`y.qq.com` 网页版生产构建（官方）
- 取证日期：2026-11-24
- 关键文件：`https://y.qq.com/ryqq/js/common.chunk.52cd4bbc34345f6dc1fe.js`
  - SHA-256 `c8567d470f377258a637298b226bb2846d0fe29a6bc922017ed781aecb09e8f1`
  - 大小 492,285 字节
- 本文只依据官方网页端代码与实际响应，不引用第三方站点内容。

## 结论

网页端是否把一首歌显示为灰色，不由单一字段决定，也不是 `status` 或 `pay_play` 单独能判定的。官方在**拿到歌曲响应后**用下面四个来源合成 `disabled`：

```text
play      = bit(switch, 1) || bit(switch, 2) || bit(switch, 3) || bit(switch, 17)
tryPlay   = bit(switch, 14) && file.size_try > 0
payable   = pay.pay_play == 1 || pay.pay_down == 1
disabled  = !(play || payable || tryPlay)
```

- `disabled == true` 才是网页端列表里的灰色行（`songlist__item--disable`），点击提示「无版权歌曲 / 已下架」。
- **付费墙不是灰色**：`play == 0` 但 `pay_play == 1`（或 `pay_down == 1`）时，`disabled == false`，页面正常显示并弹登录/购买。
- **试听不是灰色**：`try` 位为 1 且 `file.size_try > 0` 时，`disabled == false`，显示试听入口。
- `file.size_*`、`status`、`pay_month`、`pay_status` 都不参与官方这个灰色公式；它们分别表示「曲库有哪些档位」「上游状态」「会员档位细化」。`status` 可作为项目侧的显式兜底（1/2 直接灰），但不能替代 `switch`。
- `disabled` 是**按请求上下文（账号 + 地区 + 登录态）算出来的**。同一首歌换账号或换出口地区，`switch` 的 play 位会变，灰色状态也随之变。
- **歌单 / “我喜欢”列表里的 `action.switch` 可能是过期快照**：同一首歌在列表接口里仍带 play 位，在详情、专辑列表和取流 `auth_switch` 里却没有 play 位。官方详情页 / 专辑页因此能正确置灰；只读歌单列表的客户端会把它显示成可播。判定时必须以详情侧（`get_song_detail_yqq`、`CgiGetTrackInfo`、`GetAlbumSongList`）的 `action.switch` 为准，详见下文「实测：歌单列表 action 与详情不一致」。

## 官方解析代码（原文片段）

以下是生产包里的原始压缩代码，未改动：

```js
c.action?l=c.action.switch||c.action.switches:c.switch&&(l=c.switch),
1!==u.type||"undefined"!==typeof l&&0!==l||(l=403),l||(l=403);
var s=null===(n=l)||void 0===n||null===(o=n.toString(2))||void 0===o?void 0:o.split("");
s.pop(),s.reverse();
for(var m=["play_lq","play_hq","play_sq","down_lq","down_hq","down_sq","soso","fav",
"share","bgm","ring","sing","radio","try","give","poster","play_5_1","down_5_1",
"bullet","cache_lq","cache_hq","cache_sq","cache_dts","track_pay"],d=c.action||{},p=0;p<m.length;p++)
  d[m[p]]=parseInt(s[p],10)||0;
if(null!==d&&void 0!==d&&d.icons){
  var f=d.icons.toString(2).split("");
  f.reverse(),
  u.copyright=parseInt(f[0],10),
  u.isVip=Boolean(parseInt(f[18],10))
}
return d.play=0,
(d.play_lq||d.play_hq||d.play_sq||d.play_5_1)&&(d.play=1),
d.try&&(null===(i=u.file)||void 0===i?void 0:i.size_try)>0&&(u.tryPlay=!0),
d.play||u.pay.payplay||u.pay.paydownload||(u.tryPlay?u.tryIcon=!0:u.disabled=!0),
u.action=d,...
```

关键点：`switch.toString(2)` 的**最低位按哨兵位处理**（实测样本全部为奇数），所以官方先 `pop()` 丢掉它再 `reverse()`。因此下面的位号都要从 `switch` 的原值里按「哨兵之后的第 n 位」来读，等价于 `(switch >>> (n + 1)) & 1`。

## `switch` 位表

| 位（哨兵后序号） | `switch` 实际位 | 官方变量名 | 用途 |
| ---: | ---: | --- | --- |
| — | 0 | （哨兵） | 实测恒为 1，解析时丢弃 |
| 0 | 1 | `play_lq` | 可播标准音质 |
| 1 | 2 | `play_hq` | 可播 HQ |
| 2 | 3 | `play_sq` | 可播 SQ |
| 3 | 4 | `down_lq` | 可下载标准音质 |
| 4 | 5 | `down_hq` | 可下载 HQ |
| 5 | 6 | `down_sq` | 可下载 SQ |
| 6 | 7 | `soso` | 站内「SoSo」入口（未文档化） |
| 7 | 8 | `fav` | 可收藏 |
| 8 | 9 | `share` | 可分享 |
| 9 | 10 | `bgm` | 可作背景音乐 |
| 10 | 11 | `ring` | 可设铃声 |
| 11 | 12 | `sing` | 可 K 歌 |
| 12 | 13 | `radio` | 电台 |
| 13 | 14 | `try` | 可试听 |
| 14 | 15 | `give` | 可赠送 |
| 15 | 16 | `poster` | 可生成海报 |
| 16 | 17 | `play_5_1` | 可播 5.1 声道 |
| 17 | 18 | `down_5_1` | 可下载 5.1 |
| 18 | 19 | `bullet` | 弹幕/字幕（未文档化） |
| 19 | 20 | `cache_lq` | 可缓存标准音质 |
| 20 | 21 | `cache_hq` | 可缓存 HQ |
| 21 | 22 | `cache_sq` | 可缓存 SQ |
| 22 | 23 | `cache_dts` | 可缓存 DTS |
| 23 | 24 | `track_pay` | 单曲付费标记 |

`action.play` 就是 `play_lq || play_hq || play_sq || play_5_1`。注意它**不含** `down_*`，也不含 `pay_*`。

## 实测：四种状态

以下 `switch`、`pay`、`disabled` 都来自 `y.qq.com` 服务端渲染数据 `window.__INITIAL_DATA__`，抓取于 2026-11-24，未登录、非中国大陆出口。

| 歌曲 | `switch` | 命中 play 位 | `pay_play` / `pay_down` | `try` / `size_try` | 页面 `disabled` | 页面提示 |
| --- | ---: | --- | --- | --- | --- | --- |
| `00271ray3rOgaB` Remember the Name | 81683 | `play_lq` | 0 / 0 | 0 / 960,887 | `false` | 正常详情页（免费可播） |
| `000GoA8y4KpBFd` Ambitionz Az A Ridah | 65537 | 无 | 0 / 0 | 0 / 960,887 | `true` | 很抱歉，您查看的歌曲已下架 |
| `0012KYia1pEVNN` ALL THE LOVE | 134283265 | 无 | 0 / 0 | 0 / — | `true` | 很抱歉，您查看的歌曲已下架 |
| `003BkwkH0iS8Ko` 双刀 | 16897793 | 无 | 1 / 1 | 1 / 960,887 | `false` | 正常详情页（VIP/付费路径） |

逐位验证 `003BkwkH0iS8Ko`（`switch = 16897793`，二进制 `1000000011101011100000001`）：

- 哨兵位丢弃后，`fav/share/bgm/sing/try/give/poster/track_pay` 均为 1，与页面 `action` 对象完全一致。
- `play_lq`、`play_hq`、`play_sq`、`play_5_1` 全为 0，但 `payplay == 1`，所以**不灰**。
- 该曲是 VIP/付费曲，网页端显示的是「VIP/购买」路径，而不是灰色。

`00271ray3rOgaB`（`switch = 81683`）是纯免费可播样本：`play_lq = 1`，`play_hq` / `play_sq` / `play_5_1 = 0`，`payplay = paydownload = 0`，`try = 0`，结果 `disabled = false`。说明只要最低档 play 位为 1 就不灰，即使 HQ/SQ 都不存在。

`0012KYia1pEVNN` 的 `icons = 2621441`，按官方算法解出 `copyright = 1`（最低位）和 `isVip = 0`；`000GoA8y4KpBFd` 的 `icons = 524288`，解出 `copyright = 0`。两者都被置灰，但 `copyright` 位不同，说明「地区/版权不可用」与「下架/无授权」共用 `disabled` 表现，需要额外用 `copyright` 或详情接口的 `disableInfo` 区分原因。

## 实测：歌单列表 action 与详情不一致

2026-11-24 用当前登录账号复核「我喜欢」全量 668 首，同时请求：

- 列表侧：`music.srfDissInfo.DissInfo` / `CgiGetDiss`，以及官方网页端实际使用的 `music.srfDissInfo.aiDissInfo` / `uniform_get_Dissinfo`。
- 详情侧：`music.pf_song_detail_svr` / `get_song_detail_yqq`（逐首）与 `music.trackInfo.UniformRuleCtrl` / `CgiGetTrackInfo`（批量）。
- 取流侧：`vkey.GetVkeyServer` / `CgiGetVkey` 返回的 `auth_switch`。

结果：**668 首中有 10 首的列表 `action.switch` 与详情不一致，全部是「列表说可播、详情说不可播」**。两个列表接口（`CgiGetDiss` 与 `uniform_get_Dissinfo`）对这 10 首返回的值相同；两个详情接口（`get_song_detail_yqq` 与 `CgiGetTrackInfo`）对这 10 首也返回相同的值。其中 `OK (feat. Don Toliver|Explicit)` 的 mid 为 `002uJC3o1pQozM`，是本次问题的直接样本。

| 歌曲 | 专辑 | 列表 `switch` | 详情 `switch` | 列表 `msgid` | 详情 `msgid` | 列表 `icons` | 详情 `icons` |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| PUNCH DRUNK | BULLY - DELUXE (Explicit) | 134331775 | 134283265 | 0 | 3 | 131073 | 2621441 |
| OK (feat. Don Toliver\|Explicit) | BULLY - DELUXE (Explicit) | 134327679 | 134283265 | 0 | 3 | 131073 | 2621441 |
| WHATEVER WORKS | BULLY (Explicit) | 134331775 | 134283265 | 0 | 3 | 131073 | 2621441 |
| ALL THE LOVE (feat. Andre Troutman) (Explicit) | BULLY (Explicit) | 134331775 | 134283265 | 0 | 3 | 131073 | 2621441 |
| BEAUTY AND THE BEAST | BULLY (Explicit) | 134331775 | 134283265 | 0 | 3 | 131073 | 2621441 |
| WHITE LINES (feat. Andre Troutman) | BULLY (Explicit) | 134331775 | 134283265 | 0 | 3 | 131073 | 2621441 |
| PREACHER MAN | BULLY (Explicit) | 134331775 | 134283265 | 0 | 3 | 131073 | 2621441 |
| LAST BREATH | BULLY | 134331775 | 134283265 | 0 | 3 | 131073 | 2621441 |
| PREACHER MAN (Explicit) | BULLY (Explicit) | 134331775 | 134283265 | 0 | 3 | 131073 | 2621441 |
| Ain't No Fun(If the Homies Cant Have None) | Doggystyle | 134331775 | 134283265 | 0 | 3 | 131073 | 2621441 |

字段差异不止 `switch`：

- 列表 `switch2` 在 9 首里是 `21541888` / `21536768`，详情 `switch2` 全部为 `0`；`PUNCH DRUNK` 的列表 `switch2` 本身也是 `0`，所以 `switch2` 不能单独当判别条件。
- 列表 `msgid = 0`，详情 `msgid = 3`。`msgid = 1` 的四首已下架歌曲（`Ambitionz Az A Ridah`、`6 Foot 7 Foot`、`Kangaroo Court`、`Blow`）列表与详情一致，都是 `switch = 65537`、`icons = 524288`。
- `pay`、`file.size_try`、`status` 在这 10 首的列表与详情之间完全相同：`pay_play = 0`、`pay_down = 0`、`size_try = 0`、`status = 0`。因此无法用 `pay` 或 `status` 区分。

按官方公式解码：

```text
详情 switch 134283265 = 0b1000000000010000000000000001
  只有哨兵位 0 与 poster 位 16 为 1，play_lq / play_hq / play_sq / play_5_1 全为 0
  pay_play = pay_down = 0，try 位为 0
  → disabled = true

列表 switch 134331775 = 0b1000000000011010110101111111
  play_lq / play_hq / play_sq 均为 1
  → disabled = false
```

### 与取流结果对照

对这 10 首中的多首请求 `CgiGetVkey`（128k），`midurlinfo[0].auth_switch` 都等于详情侧的 `134283265`，`result = 104003`，`purl` 为空；而可播样本 `001wQLnw0g7jh4`（After Party）的 `auth_switch = 16905999`，与详情 `switch` 相同，`result = 0`，`purl` 非空。也就是说：

```text
详情 action.switch == vkey auth_switch == 实际是否有权取流
歌单列表 action.switch != 详情 action.switch（仅对部分歌曲）
```

### 对照样本

- 同账号另一份 468 首歌单：列表与详情 0 差异，说明不是所有歌单、所有歌曲都会过期。
- `BULLY - DELUXE` 专辑页 `GetAlbumSongList` 的 20 首 `action.switch` 与 `CgiGetTrackInfo` 全部一致（其中 19 首为 `134283265`，`MISSION CONTROL` 为 `134217729`），`msgid` 均为 `3`。所以官方专辑页能正确置灰这 10 首中的 9 首。
- 「我喜欢」中已下架的 4 首，列表与详情一致，所以此前只修列表字段就能解决；本次 10 首属于另一种情况：**歌曲还在专辑里，但列表接口保留了旧的权益位**。

### 为什么官方客户端能正确标灰

官方网页端详情页调用的是 `get_song_detail_yqq`，专辑页调用的是 `GetAlbumSongList`，两者都返回详情侧的正确 `switch`，再走同一套 `disabled` 公式，所以 `OK` 这类歌曲在详情 / 专辑上下文里是灰色。歌单列表接口返回的是另一份（过期的）`action`；如果只读列表，官方网页端的通用歌单列表也会把它当成可播。官方客户端最终的标灰结果与「详情 `switch`」和「vkey `auth_switch`」一致，说明它读的是详情侧（或其等价的按歌曲权益）数据，而不是歌单列表里的 `action`。

对上表 10 首，列表与详情的 `pay`、`size_try`、`status` 完全一致，只有 `action` 不同；上游为什么没有刷新这部分 `action` 无法仅从响应判断（可能是按歌曲缓存的权益快照），但能确定的是详情侧与取流侧一致，列表侧不可信。

对本项目而言，`CgiGetDiss` / `uniform_get_Dissinfo` 只能用来获取顺序和基础元数据，**不能直接把它的 `action.switch` 当作判灰依据**。可靠且成本可控的做法是用 `CgiGetTrackInfo` 批量复核 `action.switch`、`file.size_try` 与 `pay` 字段；详情侧与列表侧一致时无需变更，不一致时以详情侧为准。不要为了判灰逐首申请 vkey：`switch` 已经够用，vkey 只在实际播放 / 下载时请求。

### 批量接口与客户端分片

这里要区分两件事：

- **上游批量**：`CgiGetTrackInfo` 本身就是批量接口。一次 `musicu` 请求的 `req_0.param.mids` 可以带多首，响应 `req_0.data.tracks` 一次返回多首；不是「客户端循环 N 次、每次一首」。
- **客户端分片**：上游对单次 `mids` 有上限，所以客户端仍然要拆成多次 HTTP 请求。拆的是「100 首 / 请求」，不是「1 首 / 请求」。

2026-11-24 实测该接口的单次上限与速度：

| 单次 `mids` 数 | 结果 | 耗时（单请求） |
| ---: | --- | ---: |
| 1–100 | `code=0`，返回全部请求的歌曲 | 约 0.1–0.2 s |
| 110–160 | `code=0`，但只返回前 100 首，后面的静默丢弃 | 约 0.1–0.2 s |
| 180 及以上 | HTTP/2 会话被关闭（`ERR_HTTP2_SESSION_ERROR`） | — |

668 首「我喜欢」按 100 首分片：

- 7 个请求；串行、请求之间不加延迟，总耗时约 0.9 s；
- 7 个请求并发，总耗时约 0.15 s；
- 连续 3 轮（共 21 个请求）全部 `code=0`、无缺曲、未出现 `2001` / `104604` / `104009`。

因此：

- 项目侧不再把分片大小暴露给调用方：`CgiGetTrackInfo` 封装为 `fetchTrackInfoByMids(mids)`，内部固定 100 首 / 请求；668 首从 14 个请求降到 7 个。完整方案见 [`song-availability-plan.md`](./song-availability-plan.md)。
- `CgiGetTrackInfo` 不需要像 vkey 那样加 300 ms 间隔；封装内部只是顺序 `await`，没有人为延迟。
- 需要严格限速的是 `CgiGetVkey`：它只接受单首、项目侧 `VKEY_MIN_INTERVAL_MS = 300`；那条规则只服务实际播放 / 下载，不要拿来限制判灰用的 `CgiGetTrackInfo`。
- 「只复核当前可见页」是请求量取舍，不是上游限制。对 668 首这种规模，整份复核只有 7 个请求，完全可以直接做；对几万首的超大歌单再按页或分批。

## 字段关系

| 字段 | 是否决定灰色 | 说明 |
| --- | --- | --- |
| `action.switch` | **是（核心）** | 账号 + 地区 + 登录态的权益位图；play 位为 0 才可能灰。**必须取详情侧的值**；歌单列表的值可能是过期快照 |
| `action.msgid` | 辅助 | 详情侧的 `3` 对应「豪华付费音乐包」提示；本轮 10 首「列表可播 / 详情不可播」样本均为详情 `3`、列表 `0`。它不能单独判灰，只用于区分原因 |
| `action.icons` | 辅助 | 最低位 `copyright`；第 18 位 `isVip`；用于区分灰的原因/徽标。本轮样本中列表与详情的 `icons` 也不一致 |
| `pay.pay_play` | **是（反向）** | `1` 表示有付费路径，**不会灰**；不是「不可播」 |
| `pay.pay_down` | **是（反向）** | 官方把「可下载」也算作不灰的条件 |
| `file.size_try` | **是（配合 `try` 位）** | `try` 位为 1 且 `size_try > 0` → 试听，不灰 |
| `status` | 辅助兜底 | 官方灰色公式不读；本项目建议 `status ∈ {1,2}` 直接判灰 |
| `file.size_*` | 否 | 只表示曲库是否存在该档文件，不代表当前账号有权取流 |
| `pay.pay_month` / `pay.pay_status` | 否 | 会员档位细化；官方灰色判定不读 |
| `interval` | 否 | 时长；`0` 不能可靠表示下架 |

## 字段可得性（按接口）

| 接口 | `action.switch` | `file.size_try` | `pay.*` | 能否直接判灰 |
| --- | --- | --- | --- | --- |
| 歌单 / 「我喜欢」列表（`CgiGetDiss`、`uniform_get_Dissinfo`） | 有，但可能是过期快照 | 有 | 有 | **不能**；需用详情 / `CgiGetTrackInfo` 复核 |
| 专辑列表（`GetAlbumSongList`） | 有（本轮 20 首与详情全部一致） | 有 | 有 | 能 |
| 歌手歌曲列表 | 视接口而定；本轮未复核 | 视接口而定 | 视接口而定 | 建议按详情复核 |
| 单曲详情 / 批量详情（`get_song_detail_yqq`、`CgiGetTrackInfo`） | 有（权威） | 有 | 有 | 能 |
| 搜索（`DoSearchForQQMusicDesktop`） | 无（本项目 fixture 只有 `pay.pay_play`） | 无 | 部分 | 不能；先按 `unknown` 展示，播放失败再兜底 |
| 推荐 / 首页货架 | 视模块而定 | 视模块而定 | 视模块而定 | 缺字段时按 `unknown` |

搜索页不要为了判灰给每一行补一次详情请求；这会放大请求量。官方搜索页本身也不在结果列表里判灰，只在用户点击时处理。

## 落地到本项目

当前 `shared/permission.ts` 已按官方语义从阻断判定栈改为五种展示状态：付费墙不再显示为灰色，点击时提示开通 / 购买。实现与下面的参考代码一致：

```ts
export type SongPlayState = "playable" | "paywall" | "trial" | "disabled" | "unknown";

const PLAY_BITS = [1, 2, 3, 17] as const; // play_lq / play_hq / play_sq / play_5_1
const TRY_BIT = 14;

export function songPlayState(song: {
  status?: number | null;
  action?: { switch?: number | string | null; icons?: number | null } | null;
  switch?: number | string | null;
  pay?: {
    pay_play?: number | null;
    pay_down?: number | null;
    payplay?: number | null;
    paydownload?: number | null;
  } | null;
  file?: { size_try?: number | null } | null;
}): SongPlayState {
  if (song.status === 1 || song.status === 2) return "disabled"; // 上游显式下架/审核
  const raw = song.action?.switch ?? song.switch;
  if (raw === null || raw === undefined || raw === "") return "unknown";
  const sw = Number(raw);
  if (!Number.isFinite(sw) || sw === 0) return "unknown";

  const play = PLAY_BITS.some((bit) => ((sw >>> bit) & 1) === 1);
  const payable =
    song.pay?.pay_play === 1 ||
    song.pay?.pay_down === 1 ||
    song.pay?.payplay === 1 ||
    song.pay?.paydownload === 1;
  const tryPlay = ((sw >>> TRY_BIT) & 1) === 1 && (song.file?.size_try ?? 0) > 0;

  if (play) return "playable";
  if (payable) return "paywall";
  if (tryPlay) return "trial";
  return "disabled";
}

export function songFlags(song: { action?: { icons?: number | null } | null }) {
  const icons = song.action?.icons ?? 0;
  return {
    copyright: (icons & 1) === 1,
    isVip: ((icons >>> 18) & 1) === 1,
  };
}
```

展示层规则：

| 状态 | 行样式 | 点击行为 | 徽标 |
| --- | --- | --- | --- |
| `playable` | 正常 | 直接播放 | 音质角标 |
| `paywall` | 正常（不灰） | 未登录先登录；已登录提示开通/购买 | VIP / 数字专辑 |
| `trial` | 正常（不灰） | 播放 `try_begin`–`try_end` 片段 | 试听 |
| `disabled` | 灰色 | 提示「该歌曲当前不可播放」 | 无 |
| `unknown` | 正常但保守 | 尝试播放，失败走 `NO_STREAM` | 无 |

补充约束：

- `switch` 与账号/地区强相关。登录、退出、切换账号、切换网络出口后，已缓存的 `switch` 会过期；这些时点应让歌单/详情缓存失效或至少重新拉取当前列表。
- 歌单 / 「我喜欢」列表的 `action.switch` 不能直接写进 `Song.playSwitch`。即使列表与详情大多一致，也可能出现本轮的 10 首「列表可播、详情不可播」；应按当前可见页用 `CgiGetTrackInfo` 批量复核（50 首 / 请求），只把详情侧的 `action.switch`、`file.size_try`、`pay` 字段写入 `Song`，列表字段继续用于顺序和基础元数据。
- 不要为了判灰去批量申请 vkey。`switch` 已经包含当前上下文的可播权益；vkey 只在真正播放/下载时请求。详情侧的 `switch` 与 vkey 的 `auth_switch` 在本轮样本中完全一致，可作为对照证据。
- `switch` 在某些响应里可能缺失或为 0；官方此时会回退到 `403`（`403` 解码后 `play_lq = 1`，即当作可播）。本项目建议按 `unknown` 保守处理，避免把未知误判成灰；若要和网页端完全一致，可在 `raw == null || raw === 0` 时改用 403。
- `switch` 是官方网页客户端的实现细节，不是公开契约；上游改位表时以实际页面行为为准。

<ul class="note">
<li>取证页面：<code>https://y.qq.com/n/ryqq/songDetail/000GoA8y4KpBFd</code>、<code>.../0012KYia1pEVNN</code>、<code>.../003BkwkH0iS8Ko</code>、<code>.../00271ray3rOgaB</code>。</li>
<li>服务端渲染数据位于 <code>window.__INITIAL_DATA__.songList[0]</code>，其中 <code>action</code> 已含解析后的 24 个命名位；列表接口的原始歌曲只给 <code>action.switch</code>，需要自行解析。</li>
<li>2026-11-24 用登录账号复核「我喜欢」668 首，发现 10 首歌单列表 <code>action.switch</code> 仍带 play 位、详情与 vkey <code>auth_switch</code> 已无 play 位；详情见「实测：歌单列表 action 与详情不一致」。</li>
<li><code>songlist__item--disable</code> 是官方列表的灰色行 class；点击被 <code>if (song.disabled) return ...</code> 分支拦下，弹出「无版权歌曲」。</li>
<li>本页只描述网页端的展示判定；实际能否取到音频仍由播放时的 vkey 决定，见 <code>DOC/IMPL.md</code> 4.24 与 <code>DOC/PROVIDER.html</code>。</li>
</ul>
