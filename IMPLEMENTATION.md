# IMPLEMENTATION — Lychee Player 实现笔记

> 本文只记录落地时确定、但 ARCHITECTURE / CODE 没有展开的实现细节：上游端点、重试与错误映射、
> 文件格式、并发控制、Linux 集成与已知限制。数据模型与 IPC 契约仍以 ARCHITECTURE / CODE 为唯一事实源。
>
> 验证过程与结果见 POC.md；待拍板事项见 PENDING.md。

## 1. 运行环境与构建

| 项 | 当前实现 |
| --- | --- |
| 运行时 | Node.js ≥ 22.12（Electron 44 内置 Node 22） |
| 桌面壳 | Electron 44.9 |
| 构建 | electron-vite 6 + Vite 8 |
| 前端 | Vue 3.5 + TypeScript 5.9 + Pinia 4 + Vue Router 5 |
| 主进程类型检查 | `tsc --noEmit -p tsconfig.node.json` |
| 渲染进程类型检查 | `vue-tsc --noEmit -p tsconfig.web.json` |
| 输出 | `out/main`、`out/preload`、`out/renderer` |
| 系统集成 | `mpris-service` 2.1.2（dbus-next） |

- 所有 npm 脚本见 `package.json`；`npm run build` 先跑两套类型检查再构建。
- 没有 ESLint / Prettier / 单测框架；验证依赖类型检查、`scripts/probe.mjs` 和手工 CDP 检查。
- 没有 electron-builder 配置，暂不产出 deb / rpm / AppImage。
- 图标由 `resources/tray.svg` 用 `rsvg-convert` 生成 `tray.png` 与 `icon.png`。

## 2. 目录与进程边界

```text
src/
├── shared/        types.ts / ipc.ts（IPC 契约）/ xlogin.ts（登录组件地址）
├── main/          Electron 主进程
│   ├── api/       client / search / song / playlist / user / lyric / login / web-login / hash
│   ├── integration/ mpris / tray
│   ├── types/     mpris-service.d.ts（第三方模块类型声明）
│   └── index.ts / ipc.ts / settings.ts / credential.ts
├── preload/       contextBridge → window.lychee
└── renderer/      Vue SPA
    ├── api.ts / utils/ / composables/
    ├── stores/    player / auth / settings / ui
    └── views/     search / playlist / library / login / settings
```

- 主窗口：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: false`（POC 选择；preload 由 electron-vite 打成 CJS）。
- 登录组件：登录页内嵌 webview 加载官方 xlogin（URL 见 `src/shared/xlogin.ts`），独立内存 session `lychee-xlogin`，只允许 QQ 域名导航/弹窗。
- 主窗口的 `window.open` 一律拒绝；http(s) 链接交给系统浏览器。
- 单实例锁：第二个实例只唤醒已有窗口。
- 退出顺序：`before-quit` 清理续期定时器、MPRIS 状态、托盘，并触发设置落盘。

## 3. IPC 与状态

### 3.1 通道

| 方向 | 通道 | 说明 |
| --- | --- | --- |
| renderer → main | `login.createQrKey` / `login.getStatus` / `login.loginWithCookie` / `login.openWebLogin` / `login.refreshSession` / `login.logout` | 请求型，统一 `IpcResult` |
| renderer → main | `search.byType` / `song.getUrls` / `playlist.get` / `playlist.listMine` / `lyric.get` / `user.getProfile` / `settings.get` / `settings.set` | 请求型 |
| main → renderer | `login:status` | `QrStatus`，含 `failed` + `message` |
| main → renderer | `player:command` | MPRIS / 托盘控制 |
| renderer → main | `player:state` | `send`，不等待返回 |

- 所有 `ipcMain.handle` 由 `envelope()` 包裹；异常只以 `IpcResult.error` 返回，不向渲染进程抛。
- `song.getUrls` 校验 `mids` 非空且 ≤ 100，音质只能是三档枚举；其余参数只做最小字符串化。
- `player:state` 不做运行时校验（POC 信任渲染进程）。
- `login.loginWithCookie` / `login.openWebLogin` 成功后主进程广播 `login:status { stage: 'ok' }`；`login.refreshSession` 只返回 `AuthStatus`，不广播。

### 3.2 渲染进程状态

- `auth`：登录态、musicid、资料、`qr*`（仅实验性应用内二维码）、`expiresAtMs`、`canRefresh`。
- `player`：队列、当前曲、状态、进度、时长、音量、播放模式、实际音质。
- `settings`：默认音质（`auto` 跟随登录态：登录 `flac` / 未登录 `320k`）、关闭到托盘；启动时加载。
- `ui`：歌词面板开关、当前主题（由 settings 驱动）。
- `volume` 存 `localStorage['lychee.volume']`；队列、播放模式、搜索历史、歌词缓存不做持久化。
- `theme` 由 `settings.theme` 持久化；`data-theme` 写到 `<html>`，同时在 `localStorage['lychee.theme']` 缓存一份用于首屏避免闪烁。

## 4. 凭证与数据文件

数据目录：`app.getPath('userData')`，Linux 下为 `~/.config/lychee-player/`。

| 文件 | 格式 |
| --- | --- |
| `settings.json` | `{ defaultQuality: 'auto' \| '128k' \| '320k' \| 'flac', closeToTray: boolean, theme: 'dark' \| 'light' }`，默认 `auto`（已登录 `flac`、未登录 `320k`）/ `true` / `dark` |
| `credential.bin` | `{ version: 1, encrypted: boolean, payload: base64 }` |

- 能用 `safeStorage` 时 `payload` 是加密后的 JSON；Linux 无可用密钥环时 `encrypted: false`，保存为本机可读的 base64。这是 POC 限制，正式版应改用 keytar/libsecret 或明确提示。
- `credential.bin` 与 `settings.json` 均以 `0600` 落盘；凭证只存在于主进程，不进入任何 IPC 返回。
- 凭证字段：必填 `musicid` / `musickey` / `expiredAtMs`；可选 `refreshKey` / `refreshToken` / `accessToken` / `openid` / `unionid` / `loginType`。
- `loadCredential()` 有进程内缓存；`saveCredential()` / `clearCredential()` 同步更新缓存与文件。
- `settings.set` 以浅合并方式更新，`loadSettings` 会纠正非法音质/布尔值。
- 设置修改即写盘；`before-quit` 的 `saveSettings` 只是兜底，不等待完成。

## 5. 上游接口清单

所有 `musicu.fcg` 请求默认带：

```text
User-Agent: Linux Chrome 120
Referer: https://y.qq.com/
Cookie（已登录）: uin / qqmusic_uin / qm_keyst / qqmusic_key
comm（按接口需要）: uin / format=json / ct=24 / cv=0
```

| 能力 | 端点 | 参数/响应要点 |
| --- | --- | --- |
| 搜索 | `u.y.qq.com/cgi-bin/musicu.fcg` · `music.search.SearchCgiService/DoSearchForQQMusicDesktop` | **不带 `comm`**；`query/page_num/num_per_page/search_type/searchid`；类型 0 单曲 1 歌手 2 专辑 3 歌单；读 `body.*.list` 与 `body.meta.sum/estimate_sum` |
| 歌曲详情 | `music.pf_song_detail_svr/get_song_detail_yqq` | `song_mid`；取 `track_info.file.media_mid` |
| 播放链接 | `vkey.GetVkeyServer/CgiGetVkey` | `guid/songmid[]/songtype[]/filename[]/uin/loginflag=1/platform=20`；`filename` 由音质前缀与 `mediaMid` 拼成；读 `midurlinfo[].purl` |
| 歌单详情 | `music.srfDissInfo.DissInfo/CgiGetDiss` | `disstid/dirid=0/tag/song_begin/song_num=100/userinfo/orderlist/onlysonglist=false`；读 `dirinfo` 与 `songlist` |
| 我的歌单 | `music.musicasset.PlaylistBaseRead/GetPlaylistByUin` | `uin`；需要登录；读 `v_playlist` |
| 歌词 | `c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg` | 明文 LRC；`nobase64=1&trans=1`；读 `lyric/trans` |
| 用户资料 | `c6.y.qq.com/rsc/fcgi-bin/fcg_get_profile_homepage.fcg` | `g_tk=hash33(musickey,5381)` 与 uin；读 `data.creator.nick/headpic` |
| 二维码（实验） | `ssl.ptlogin2.qq.com/ptqrshow` + `ptqrlogin` | `appid=716027609&daid=383&pt_3rd_aid=100497308`；状态 66/67/0/65/68；解析最后一个 `ptuiCB` |
| 原生换证（实验） | `ssl.ptlogin2.graph.qq.com/check_sig` → `graph.qq.com/oauth2.0/authorize` → `QQConnectLogin.LoginServer/QQLogin` | 当前网络 `check_sig` 返回 `p_skey_forbid`，仅保留代码 |
| 官方扫码组件 | `xui.ptlogin2.qq.com/cgi-bin/xlogin` | 见 §6；`s_url=graph.qq.com/oauth2.0/login_jump` |
| 会话续期 | `music.login.LoginServer/Login` | `loginMode=2` + `refresh_token`；读新 `musickey`、`keyExpiresIn` |
| MPRIS | D-Bus `org.mpris.MediaPlayer2.lychee` | 见 §10 |

补充：

- `guid` 是进程级 10 位随机数，不是每请求随机。
- 搜索参数 pageNo 限制 1–100，pageSize 限制 1–50；空结果延迟 350ms 重试一次。
- 歌单按 100 首/页循环，最多 20 页（2000 首）；以 `dirinfo.songnum` 判断结束。
- 歌曲详情并发 4；`mediaMid` 进程内 Map 缓存，无上限。
- 播放链接批量上限 100；同一请求内按 `flac → 320k → 128k` 逐档解析，每个 `songMid` 记录实际音质。
- 播放 URL 只拼 `https://ws.stream.qqmusic.qq.com/` + 上游 `purl`；**不得重建查询参数**。
- 封面统一 `https://y.gtimg.cn/music/photo_new/T002R300x300M000{mid}.jpg`；100×100 返回空文件。
- 上游 `pay.pay_play===1` 且非数字专辑 → VIP；`price_album>0` → 数字专辑；`pay_play===0` 且非数字专辑 → free；其余显示“付费”。
- 上游 `track_info.pay` 和搜索 `pay` 字段同名但字段子集可能不同，映射函数做了缺省处理。
- 搜索结果偶尔返回空列表；带 `comm` 会显著增加空结果概率。

## 6. 登录与官方扫码组件

### 6.1 默认：官方 xlogin 内嵌组件

- 登录页直接内嵌官方 xlogin 组件（webview，`webviewTag: true`），不再弹独立窗口。
- 组件地址与官方 Linux 客户端一致，见 `src/shared/xlogin.ts`：

```text
https://xui.ptlogin2.qq.com/cgi-bin/xlogin
  ?appid=716027609&daid=383&style=33
  &login_text=登录&hide_title_bar=1&hide_border=1&target=self
  &s_url=https://graph.qq.com/oauth2.0/login_jump
  &pt_3rd_aid=100497308&theme=2
```

- webview 使用内存 session `lychee-xlogin`；登录发起前清理 cookie，结束/超时后再次清理。
- 主进程经 `web-contents-created` 按 session 匹配拦截导航并捕获 OAuth code；放行 QQ 域名弹窗，子窗口同样拦截，其余域名拒绝。
- 扫码成功后 `graph.qq.com/oauth2.0/login_jump` 会设置 `p_skey`、`p_uin`、`pt4_token` 等 cookie，并 postMessage；主进程每秒轮询 session cookie。
- 只有同时看到 `p_skey` 与 `p_uin`/`pt4_token`/`uin` 才进入换证，避免把未完成登录误判为成功。
- 换证：用 cookie 调 `graph.qq.com/oauth2.0/authorize`（`g_tk=hash33(p_skey,5381)`）取 `code`，再 POST `QQLogin`。
- 也监听 `will-redirect` / `will-navigate` / `did-navigate`，如果 URL 直接带 `code`（`y.qq.com` 或 `graph.qq.com`）则跳过 cookie 轮询。
- 登录 5 分钟超时；失败可在登录页重新加载组件重试；已有进行中的登录时再次调用复用同一流程。

### 6.2 QQLogin 换凭证

```json
{
  "comm": { "tmeLoginType": 2 },
  "req": {
    "module": "QQConnectLogin.LoginServer",
    "method": "QQLogin",
    "param": { "code": "..." }
  }
}
```

- POST `u.y.qq.com/cgi-bin/musicu.fcg`，`Content-Type: application/json`，iPhone UA，Referer `y.qq.com`。
- 响应读 `req.data`（兼容 `req_0.data`），包含 `musicid/str_musicid/musickey/refresh_token/access_token/openid/unionid/loginType/expires*`。
- `str_musicid` 优先于数字 `musicid`；`musickey` 可能长达 150+ 字符，不在日志里输出。

### 6.3 实验性应用内二维码

- 仍保留 `login.createQrKey()`；主进程内每 800ms 起轮询，等待 1.8s、已扫码 1s、错误 2.5s。
- QR TTL 2 分钟；轮询错误最多 6 次；授权失败立即 `failed`。
- 当前网络实测 `check_sig` 返回 `p_skey_forbid`，UI 已不再使用该路径。

### 6.4 Cookie 兜底

- 解析 `uin` / `qqmusic_uin` / `wxuin` / `p_uin` 与 `qm_keyst` / `qqmusic_key` / `musickey` / `music_key`。
- 去掉 `uin` 的前导 `o` 与多余 0，再调 `c6.y.qq.com` 资料接口验证；失败返回 `AUTH_EXPIRED`，不写盘。
- 手动 Cookie 没有 `refresh_token`，`canRefresh=false`，不能自动续期；设置页会禁用「立即续期」。

### 6.5 登录请求参数（易变）

```text
ptqrshow:
  GET ssl.ptlogin2.qq.com/ptqrshow
      ?appid=716027609&e=2&l=M&s=3&d=72&v=4&t=<rand>
      &daid=383&pt_3rd_aid=100497308
  → Set-Cookie: qrsig

ptqrlogin:
  GET ssl.ptlogin2.qq.com/ptqrlogin
      ?u1=https%3A%2F%2Fgraph.qq.com%2Foauth2.0%2Flogin_jump
      &ptqrtoken=<hash33(qrsig)>
      &ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052
      &action=0-0-<ms>&js_ver=20102616&js_type=1&pt_uistyle=40
      &aid=716027609&daid=383&pt_3rd_aid=100497308&has_onekey=1
  Cookie: qrsig=<qrsig>

check_sig（实验路径）:
  GET ssl.ptlogin2.graph.qq.com/check_sig
      ?uin=<uin>&pttype=1&service=ptqrlogin&nodirect=0
      &ptsigx=<ptsigx>&s_url=https://graph.qq.com/oauth2.0/login_jump
      &ptlang=2052&ptredirect=100&aid=716027609&daid=383
      &j_later=0&low_login_hour=0&regmaster=0&pt_login_type=3
      &pt_aid=0&pt_aaid=16&pt_light=0&pt_3rd_aid=100497308

oauth authorize:
  POST graph.qq.com/oauth2.0/authorize
      response_type=code&client_id=100497308
      &redirect_uri=https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https://y.qq.com/
      &scope=get_user_info,get_app_friends&state=state&switch=
      &from_ptlogin=1&src=1&update_auth=1&openapi=1010_1030
      &g_tk=<hash33(p_skey,5381)>&auth_time=<ms>&ui=<uuid>
```

- 所有参数都是上游网页行为的复刻，缺少任意关键项都可能返回 302 到错误页。
- QQLogin 和 refresh 的 payload 分别见 §6.2、§7。

## 7. 会话续期

- 单次 `musickey` 的上游字段为 `keyExpiresIn = 259200` 秒（72 小时）；`expired_at` 约 6 小时，是 access token，不是播放 key。
- 续期接口：`music.login.LoginServer/Login`，`loginMode=2`，POST `musicu.fcg`，comm：

```json
{ "tmeLoginType": 2, "ct": 11, "cv": 20090008, "tmeAppID": "qqmusic" }
```

- 参数：`openid/access_token/refresh_token/expired_in/musicid/musickey/refresh_key/loginMode=2`；带当前 Cookie。
- 响应字段 `musickeyCreateTime + keyExpiresIn` 计算新到期时间；缺省回退 `now + 6h`。
- 旧的 `QQConnectLogin.LoginServer/QQLogin` + `musics.fcg`（MD5 / zzc）续期实测不可用（2000 / 10006），已废弃。
- 调度：启动后检查一次，之后每 30 分钟检查；到期前 10 分钟或（无到期时间时）距上次成功续期 6 小时触发。
- `refreshSession` 并发保护为一个共享 Promise；失败保留旧凭证，30 分钟后重试。
- 续期成功后只更新主进程内存/`credential.bin`；渲染进程下次调用 `getStatus`/`refreshSession` 才能看到新时间。

## 8. 播放、队列与音质

- 使用一个未挂载到 DOM 的 `new Audio()`，`preload='auto'`，`autoplay-policy=no-user-gesture-required`。
- 每次加载用自增 token 防竞态；过期的 `getUrls` 结果直接丢弃。
- 队列不持久化；播放模式默认 `sequence`，可切换 `repeat-all`/`repeat-one`/`shuffle`。
- `ended`：单曲循环 seek(0)+resume；否则 `next(auto)`；顺序播放在队尾停止，手动下一首回到队首。
- 切歌时先 `status='stopped'`，避免 `audio.pause` 事件污染状态。
- `timeupdate` 更新进度，MPRIS/`player:state` 节流约 900ms。
- `player:state` 发送前用 `toRaw` 去 Vue Proxy，否则 Electron structured clone 会失败并让播放卡住。
- 默认音质来自 settings：`auto` 时按登录态取档（已登录 `flac`，未登录 `320k`），登录态变化后下一次播放即按新档生效；设置页可固定具体档位。降档静默，不弹提示。
- 播放条的音质菜单调用 `setQuality(q)` 强制本次加载使用 q，菜单显示本次请求档位；左侧标题尾部标注实际音质（`PlayerState.quality`），降档时左实际/右请求形成对照。实际音质一律看 `UrlResult.quality`。
- 标题与歌手/专辑行超宽时以无缝跑马灯滚动显示（悬停暂停，`MarqueeText.vue` 按溢出宽度自适应时长），音质标记固定在标题行最右。
- 请求音质无权限时 API 内部降档；当前所有档位都无链接才报 `NO_STREAM`，批量中单曲无链接返回 `url: null`。
- 音频加载/播放异常会 toast，状态置为 stopped/paused；不会自动跳下一首。
- 音量存 `localStorage`；静音按钮恢复上一次音量。
- 宽屏（>900px）显示水平音量条，宽度 `clamp(56px, 6vw, 84px)`；窄屏（≤900px）不渲染水平条，点击音量图标弹出竖直滑块（约 104px 高，弹层带百分比与静音按钮），点击外部关闭。
- 进度条填充用 `--gold`，音量填充用 `--accent-strong`；未填充轨道统一 `--track`。
- 进度条 `formatDuration(0)` 显示 `0:00`，未知时长显示 `--:--`。

## 9. 搜索、歌单与歌词

- 搜索请求带自增 requestId，过期响应不覆盖新结果；切换 tab 会重新搜索当前关键词。
- 歌手/专辑卡片点击转为单曲搜索；歌单卡片进入详情。
- 搜索页 hot keywords 是写死的静态列表；没有历史记录。
- 歌单详情按页抓取，页面显示实际载入数；公开歌单匿名可读，我的歌单需要登录。
- 歌词使用旧版明文 LRC 接口；不实现 QRC 逐字/解密。
- `code/retcode == -1901` 视为“该曲无歌词”（纯音乐/未匹配），返回空 `lrc`，UI 显示“这首歌还没有歌词”；其他错误码（如 1101）仍抛 `UPSTREAM_CHANGED`。
- 纯音乐标记行 `[00:00:00]此歌曲为没有填词的纯音乐…` 不是合法 LRC 时间戳，解析结果为空，行为与无歌词一致。
- LRC 解析：同一行多个时间戳展开；时间小数按毫秒补零（`5` → 500ms）；相同时间戳去重；翻译按完全相同的时间戳合并。
- 当前行用二分查找，允许 80ms 提前量；面板打开时自动滚到活动行。
- 歌词缓存是渲染进程内存 Map，切歌不重复请求；无上限。
- 歌词行是块级元素（`display:block; width:100%`），统一 `14px / 1.7` 字号与行高；活动行只改变字重、颜色、左侧强调线和背景，不改变字号，避免行高变化导致重叠。
- 歌词面板在路由切换时自动关闭。

### 9.1 主题与调色板

- 调色板 token、HEX 与推荐语义见 [ARCHITECTURE §5](ARCHITECTURE.html#s5)；`src/renderer/styles/main.css` 顶部的 `--palette-*` 与语义变量一一映射。
- 语义变量（`--panel` / `--text` / `--accent` / `--gold` / `--danger` / `--track` 等）由 palette token 派生，组件不直接写死颜色。
- `data-theme="dark|light"` 切换；`settings.theme` 持久化；`localStorage['lychee.theme']` 只作为首屏缓存，`settings.json` 是事实源。
- 深色下强调文字用 `purple-light`；浅色下强调文字用 `purple`，避免粉彩填充上的低对比。
- 进度条用 `gold`，音量条用 `purple` 系；错误/警告用 `red`。

## 10. Linux 集成

### 10.1 MPRIS

- `mpris-service`，D-Bus 名 `org.mpris.MediaPlayer2.lychee`，identity 固定 `Lychee Player`。
- Metadata：`mpris:trackid`、`mpris:length`（微秒）、`mpris:artUrl`、`xesam:title`、`xesam:artist[]`、`xesam:album`；仅在切歌时更新。
- `playbackStatus` 由 `player:state` 驱动；`getPosition()` 返回最新 `positionMs * 1000`。
- 事件映射：`play/pause/playpause/next/previous`；`seek` 相对偏移转绝对位置；`position` 直接 seek。
- `quit` 调用 `app.quit()`；`raise` 显示主窗口。
- D-Bus 不可用时静默降级，不影响播放。

### 10.2 托盘与窗口

- 托盘图标 `resources/tray.png`；菜单：显示主窗口、播放/暂停、上一首、下一首、退出。
- 托盘动作走 `player:command` 推送，不直接操作渲染进程状态。
- `closeToTray` 默认 true；开启后窗口关闭只隐藏，退出只能从托盘或 `app.quit()`。
- 主窗口 1280×820，最小 280×440；`autoHideMenuBar: true`。
- 响应式断点：`≤900px` 为统一窄屏模式（侧栏 64px 图标化、单列面板、音量改为点击弹层）；`≤560px` 为超窄模式（侧栏 56px、播放器双行、音质/主题选项单列）。
- 播放器在 `≤560px` 使用两行 grid：第一行歌曲信息 + 音质/音量，第二行控制 + 进度；所有列使用 `minmax(0, …)`，不设置把窗口撑开的固定最小列宽。
- 宽屏音量条 `clamp(56px, 6vw, 84px)`；窄屏使用 `.volume-popover` 竖直滑块，弹层宽度约 58px，右侧对齐且不超出视口。
- 已验证 280×440 / 320×480 / 360×540 / 480×540 / 560×540 / 680×540 / 900×650 / 1000×700 / 1280×820 无横向溢出。
- 开发/打包图标路径分别取 `app.getAppPath()/resources` 与 `process.resourcesPath`；打包尚未配置复制规则。

### 10.3 Wayland

- 启动前检测 `WAYLAND_DISPLAY`；存在则追加 `--ozone-platform=wayland` 与 `--enable-wayland-ime`。
- 无 `WAYLAND_DISPLAY` 时不追加，保持 Electron 默认（通常 X11）。
- `npm run dev` / `npm start` 额外设置 `ELECTRON_OZONE_PLATFORM_HINT=auto`。
- 覆盖：`LYCHEE_OZONE_PLATFORM=x11|wayland`，或命令行 `--ozone-platform=...`（显式命令行优先，代码不再追加）。
- 从缺少 Wayland 环境变量的 systemd 服务启动时会回退 X11；需要显式设置 `LYCHEE_OZONE_PLATFORM=wayland` 或补齐环境。
- 输入法使用 `--enable-wayland-ime`；未额外指定 text-input 版本。

## 11. 请求重试与错误映射

- `upstreamRequest`：超时 15s；网络错误最多 3 次（400/800ms 退避），HTTP 429 按 600/1200ms 退避；HTTP 非 2xx → `UPSTREAM_NETWORK`。
- `musicu`：额外对 `code=2001` / `104604` 做 3 次退避（500/1000ms）后仍失败才抛 `QUOTA_LIMITED`。
- 搜索空结果：延迟 350ms 重试一次。
- 原生二维码轮询：最多 6 次错误，QR TTL 120s；授权阶段失败不再重试轮询。

| 上游 code | 映射 |
| --- | --- |
| 1000 / 104401 / 104400 | `AUTH_EXPIRED` |
| 104604 / 100001 / 2001 | `QUOTA_LIMITED` |
| 104003 | `NO_STREAM` |
| 20261 / 20271 / 20272 / 20274 / 20277 / 20278 / 20279 / 20450 | `AUTH_EXPIRED` + 中文原因 |
| 其他 | `UPSTREAM_CHANGED`，message 带 module.method |
| 非 JSON / 缺 req / 缺 data | `UPSTREAM_CHANGED` |
| 超时 / Abort | `UPSTREAM_NETWORK` |
| 其他异常 | `INTERNAL` |

- 日志不输出凭证、Cookie、完整播放链接；登录诊断只输出 cookie 名称与长度、阶段状态。
- `check_sig` 失败时 message 里可能包含 `p_skey_forbid` 与 cookie 名列表；不含值。

## 12. 已知限制与未验证项

- 官方 xlogin 组件的 `p_skey` → authorize → QQLogin 链路已手动实测成功；自动 cookie 轮询尚未在完整扫码流程中复测。
- 原生应用内二维码在当前网络/账号返回 `p_skey_forbid`；UI 默认已切换为官方组件。
- 手动粘贴 Cookie 只能验证登录，不能自动续期（没有 refresh_token）。
- 续期已成功一次，并验证新 key 与 72h 到期时间；尚未做 72h+ 长跑，refresh_token 的最终有效期由上游决定。
- 搜索/播放依赖上游匿名额度；频繁请求可能触发限流或空结果。
- 没有 CSP；Electron 开发模式会提示 Insecure CSP。正式发布前应补 meta/CSP。
- 主窗口 `sandbox: false` 并开启 `webviewTag`（登录页内嵌远程组件所需）；登录组件是登录页内的远程 webview，使用独立 session。
- `mpris-service` 旧、依赖 dbus-next；若维护中断可替换。
- 托盘在无 StatusNotifier 的极简 Wayland 环境可能不可见。
- 数字专辑/无版权歌曲的不可播 UI 未专门回归；VIP 320k/FLAC 已验证。
- 未做打包、自动更新、CI、崩溃上报。

## 13. 验证命令

```bash
npm run typecheck
npm run build
npm run probe        # 搜索 / 详情 / vkey / 歌词 / 歌单 / 二维码
npm start            # 生产预览
npm run dev          # 开发模式
```

- `scripts/probe.mjs` 不依赖 Electron，适合作为上游回归哨兵。
- UI 回归：`.song-row` 双击播放、歌词面板、`/playlist/:id`、设置页续期、280×440 / 560×540 / 900×650 窄屏。
- MPRIS 回归：

```bash
playerctl -p lychee status
playerctl -p lychee metadata
playerctl -p lychee pause
playerctl -p lychee play
```

- Wayland 回归：不传 `--ozone-platform` 启动，检查进程参数包含 `--ozone-platform=wayland`；必要时用 `LYCHEE_OZONE_PLATFORM=x11` 对比。

## 14. 相关文档

- [ARCHITECTURE.html](ARCHITECTURE.html) — 对外契约、术语、时序与数据模型
- [CODE.html](CODE.html) — 文件树、方法签名、调用栈
- [POC.md](POC.md) — 验证结果、差异记录、POC 限制
- [PENDING.md](PENDING.md) — 待拍板事项
- `BUILD.html` — 开发完成后编写
