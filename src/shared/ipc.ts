import type {
  AuthStatus,
  IpcResult,
  Lyric,
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
  UserProfile,
  MprisCommand
} from './types'

export interface LycheeApi {
  login: {
    createQrKey(): Promise<IpcResult<QrSession>>
    getStatus(): Promise<IpcResult<AuthStatus>>
    loginWithCookie(cookie: string): Promise<IpcResult<AuthStatus>>
    openWebLogin(): Promise<IpcResult<AuthStatus>>
    refreshSession(): Promise<IpcResult<AuthStatus>>
    logout(): Promise<IpcResult<null>>
    onStatus(callback: (status: QrStatus) => void): () => void
  }
  search: {
    byType(req: SearchRequest): Promise<IpcResult<SearchResult>>
  }
  song: {
    getUrls(mids: string[], quality: Quality): Promise<IpcResult<UrlResult[]>>
  }
  playlist: {
    get(id: string): Promise<IpcResult<PlaylistDetail>>
    listMine(): Promise<IpcResult<PlaylistMeta[]>>
  }
  user: {
    getProfile(): Promise<IpcResult<UserProfile>>
  }
  lyric: {
    get(songMid: string): Promise<IpcResult<Lyric>>
  }
  settings: {
    get(): Promise<IpcResult<Settings>>
    set(patch: Partial<Settings>): Promise<IpcResult<Settings>>
  }
  player: {
    sendState(state: PlayerState): void
    onCommand(callback: (command: MprisCommand) => void): () => void
  }
}
