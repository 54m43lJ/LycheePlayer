import { contextBridge, ipcRenderer } from 'electron'
import type { LycheeApi } from '../shared/ipc'
import type {
  AuthStatus,
  CommentPage,
  IpcResult,
  Lyric,
  MprisCommand,
  PlayerState,
  PlaylistDetail,
  PlaylistMeta,
  Quality,
  SearchRequest,
  SearchResult,
  Settings,
  UrlResult,
  UserProfile
} from '../shared/types'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> =>
  ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<T>>

const api: LycheeApi = {
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
      invoke<UrlResult[]>('song.getUrls', mids, quality)
  },
  playlist: {
    get: (id: string) => invoke<PlaylistDetail>('playlist.get', id),
    listMine: () => invoke<PlaylistMeta[]>('playlist.listMine')
  },
  user: {
    getProfile: () => invoke<UserProfile>('user.getProfile')
  },
  lyric: {
    get: (songMid: string) => invoke<Lyric>('lyric.get', songMid)
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
