import { contextBridge, ipcRenderer } from 'electron'
import { createDecipheriv } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import type { LycheeApi } from '../shared/ipc'
import type {
  AuthStatus,
  CommentPage,
  DownloadStorageInfo,
  DownloadTask,
  FavoriteState,
  FlagsFile,
  IpcResult,
  Lyric,
  MprisCommand,
  MpvEvent,
  MpvState,
  MvDetail,
  MvStream,
  PlayerState,
  PlaylistMeta,
  PlaylistPageResult,
  Quality,
  RecommendFeed,
  SearchRequest,
  SearchResult,
  Settings,
  SongAvailability,
  UrlResult,
  UserProfile
} from '../shared/types'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> =>
  ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<T>>

const QRC_KEY = Buffer.from('!@#)(*$%123ZXC!@!@#)(NHL', 'ascii')

function decryptQrc(ciphertext: string): string {
  const encrypted = Buffer.from(ciphertext.trim(), 'hex')
  if (encrypted.length === 0) return ''
  const decipher = createDecipheriv('des-ede3', QRC_KEY, null)
  decipher.setAutoPadding(false)
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()])
  return inflateSync(decrypted).toString('utf8')
}

const api: LycheeApi = {
  flags: {
    get: () => invoke<FlagsFile>('flags.get'),
    save: (content: string) => invoke<null>('flags.save', content)
  },
  login: {
    getStatus: () => invoke<AuthStatus>('login.getStatus'),
    loginWithCookie: (cookie) => invoke<AuthStatus>('login.loginWithCookie', cookie),
    openWebLogin: () => invoke<AuthStatus>('login.openWebLogin'),
    refreshSession: () => invoke<AuthStatus>('login.refreshSession'),
    logout: () => invoke<null>('login.logout'),
    setEmbedBounds: (rect) => {
      ipcRenderer.send('login.setEmbedBounds', rect)
    }
  },
  search: {
    byType: (req: SearchRequest) => invoke<SearchResult>('search.byType', req)
  },
  song: {
    getUrls: (mids: string[], quality: Quality) =>
      invoke<UrlResult[]>('song.getUrls', mids, quality),
    probe: (mids: string[], options) =>
      invoke<SongAvailability[]>('song.probe', mids, options)
  },
  playlist: {
    get: (id: string, options) => invoke<PlaylistPageResult>('playlist.get', id, options),
    listMine: () => invoke<PlaylistMeta[]>('playlist.listMine'),
    prefetch: (ids: string[]) => {
      ipcRenderer.send('playlist.prefetch', ids)
    },
    create: (name: string) => invoke<PlaylistMeta>('playlist.create', name),
    rename: (id: string, name: string) => invoke<PlaylistMeta>('playlist.rename', id, name),
    remove: (id: string) => invoke<null>('playlist.remove', id),
    addSongs: (id: string, mids: string[]) =>
      invoke<PlaylistMeta>('playlist.addSongs', id, mids),
    removeSongs: (id: string, mids: string[]) =>
      invoke<PlaylistMeta>('playlist.removeSongs', id, mids)
  },
  favorite: {
    get: (mids: string[]) => invoke<FavoriteState[]>('favorite.get', mids),
    toggle: (songMid: string) => invoke<FavoriteState>('favorite.toggle', songMid)
  },
  recommend: {
    get: () => invoke<RecommendFeed>('recommend.get'),
    refresh: () => invoke<RecommendFeed>('recommend.refresh')
  },
  mv: {
    search: (keyword: string, pageNo: number) =>
      invoke<SearchResult>('mv.search', keyword, pageNo),
    getDetail: (mvId: string) => invoke<MvDetail>('mv.getDetail', mvId),
    getStream: (mvId: string, quality: MvStream['quality']) =>
      invoke<MvStream>('mv.getStream', mvId, quality)
  },
  download: {
    list: () => invoke<DownloadTask[]>('download.list'),
    start: (songMid: string, quality: Quality) =>
      invoke<DownloadTask>('download.start', songMid, quality),
    pause: (id: string) => invoke<DownloadTask>('download.pause', id),
    resume: (id: string) => invoke<DownloadTask>('download.resume', id),
    remove: (id: string) => invoke<null>('download.remove', id),
    clearCompleted: () => invoke<null>('download.clearCompleted'),
    storage: () => invoke<DownloadStorageInfo>('download.storage'),
    openFolder: () => invoke<null>('download.openFolder'),
    chooseFolder: () => invoke<string | null>('download.chooseFolder'),
    clearCache: () => invoke<null>('download.clearCache')
  },
  mpv: {
    getState: () => invoke<MpvState>('mpv.getState'),
    setEnabled: (enabled: boolean) => invoke<MpvState>('mpv.setEnabled', enabled),
    loadAndPlay: (url: string) => invoke<null>('mpv.loadAndPlay', url),
    play: () => invoke<null>('mpv.play'),
    pause: () => invoke<null>('mpv.pause'),
    stop: () => invoke<null>('mpv.stop'),
    seek: (positionMs: number) => invoke<null>('mpv.seek', positionMs),
    setVolume: (volume: number) => invoke<null>('mpv.setVolume', volume),
    onEvent: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, event: MpvEvent): void =>
        callback(event)
      ipcRenderer.on('mpv:event', listener)
      return () => ipcRenderer.removeListener('mpv:event', listener)
    }
  },
  user: {
    getProfile: () => invoke<UserProfile>('user.getProfile')
  },
  lyric: {
    get: (songMid: string) => invoke<Lyric>('lyric.get', songMid),
    decryptQrc
  },
  comment: {
    get: (songId: string) => invoke<CommentPage>('comment.get', songId)
  },
  settings: {
    get: () => invoke<Settings>('settings.get'),
    set: (patch: Partial<Settings>) => invoke<Settings>('settings.set', patch)
  },
  player: {
    sendState: (state: PlayerState) => ipcRenderer.send('player:state', state),
    onCommand: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, command: MprisCommand): void =>
        callback(command)
      ipcRenderer.on('player:command', listener)
      return () => ipcRenderer.removeListener('player:command', listener)
    }
  }
}

export function exposeApi(): void {
  contextBridge.exposeInMainWorld('lychee', api)
}

exposeApi()
