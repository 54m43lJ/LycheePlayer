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

## 字段关系

| 字段 | 是否决定灰色 | 说明 |
| --- | --- | --- |
| `action.switch` | **是（核心）** | 账号 + 地区 + 登录态的权益位图；play 位为 0 才可能灰 |
| `action.icons` | 辅助 | 最低位 `copyright`；第 18 位 `isVip`；用于区分灰的原因/徽标 |
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
| 歌单 / 专辑 / 歌手歌曲列表（`music.srfDissInfo.aiDissInfo`、`GetAlbumSongList` 等） | 有 | 有 | 有 | 能 |
| 单曲详情（`music.pf_song_detail_svr.get_song_detail_yqq`） | 有 | 有 | 有 | 能 |
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
- 不要为了判灰去批量申请 vkey。`switch` 已经包含当前上下文的可播权益；vkey 只在真正播放/下载时请求。
- `switch` 在某些响应里可能缺失或为 0；官方此时会回退到 `403`（`403` 解码后 `play_lq = 1`，即当作可播）。本项目建议按 `unknown` 保守处理，避免把未知误判成灰；若要和网页端完全一致，可在 `raw == null || raw === 0` 时改用 403。
- `switch` 是官方网页客户端的实现细节，不是公开契约；上游改位表时以实际页面行为为准。

<ul class="note">
<li>取证页面：<code>https://y.qq.com/n/ryqq/songDetail/000GoA8y4KpBFd</code>、<code>.../0012KYia1pEVNN</code>、<code>.../003BkwkH0iS8Ko</code>、<code>.../00271ray3rOgaB</code>。</li>
<li>服务端渲染数据位于 <code>window.__INITIAL_DATA__.songList[0]</code>，其中 <code>action</code> 已含解析后的 24 个命名位；列表接口的原始歌曲只给 <code>action.switch</code>，需要自行解析。</li>
<li><code>songlist__item--disable</code> 是官方列表的灰色行 class；点击被 <code>if (song.disabled) return ...</code> 分支拦下，弹出「无版权歌曲」。</li>
<li>本页只描述网页端的展示判定；实际能否取到音频仍由播放时的 vkey 决定，见 <code>DOC/IMPL.md</code> 4.24 与 <code>DOC/PROVIDER.html</code>。</li>
</ul>
