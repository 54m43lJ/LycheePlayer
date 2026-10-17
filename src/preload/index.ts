import { contextBridge, ipcRenderer } from 'electron'
import type { QqyApi } from '../shared/ipc'
import type {
  AuthStatus,
  IpcResult,
  Lyric,
  MprisCommand,
  PlayerState,
  PlaylistDetail,
  PlaylistMeta,
  Quality,
  QrSession,
  QrStatus,
  SearchRequest,
  SearchResult,
  Settings,
  UrlResult,
  UserProfile
} from '../shared/types'

const invoke = <T>(channel: string, ...args: unknown[]): Promise<IpcResult<T>> =>
  ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<T>>

const api: QqyApi = {
  login: {
    createQrKey: () => invoke<QrSession>('login.createQrKey'),
    getStatus: () => invoke<AuthStatus>('login.getStatus'),
    loginWithCookie: (cookie) => invoke<AuthStatus>('login.loginWithCookie', cookie),
    openWebLogin: () => invoke<AuthStatus>('login.openWebLogin'),
    refreshSession: () => invoke<AuthStatus>('login.refreshSession'),
    logout: () => invoke<null>('login.logout'),
    onStatus: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, status: QrStatus): void =>
        callback(status)
      ipcRenderer.on('login:status', listener)
      return () => ipcRenderer.removeListener('login:status', listener)
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
  contextBridge.exposeInMainWorld('qqy', api)
}

exposeApi()
