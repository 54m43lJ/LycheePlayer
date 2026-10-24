import type {
  AuthStatus,
  CommentPage,
  DownloadStorageInfo,
  DownloadTask,
  EmbedRect,
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
  PlaylistCacheEntry,
  PlaylistMeta,
  PlaylistPage,
  PlaylistSnapshot,
  ProbeOptions,
  Quality,
  RecommendFeed,
  SearchRequest,
  SearchResult,
  Settings,
  SongAvailability,
  UrlResult,
  UserProfile
} from './types'

export interface LycheeApi {
  flags: {
    get(): Promise<IpcResult<FlagsFile>>
    save(content: string): Promise<IpcResult<null>>
  }
  login: {
    getStatus(): Promise<IpcResult<AuthStatus>>
    loginWithCookie(cookie: string): Promise<IpcResult<AuthStatus>>
    openWebLogin(): Promise<IpcResult<AuthStatus>>
    refreshSession(): Promise<IpcResult<AuthStatus>>
    logout(): Promise<IpcResult<null>>
    /** 上报登录组件占位区域（页面坐标）；null 摘除。主进程据此定位 WebContentsView。 */
    setEmbedBounds(rect: EmbedRect | null): void
  }
  search: {
    byType(req: SearchRequest): Promise<IpcResult<SearchResult>>
  }
  song: {
    getUrls(mids: string[], quality: Quality): Promise<IpcResult<UrlResult[]>>
    probe(mids: string[], options?: ProbeOptions): Promise<IpcResult<SongAvailability[]>>
  }
  playlist: {
    get(id: string, options?: { offset?: number }): Promise<IpcResult<PlaylistPage>>
    getCached(id: string): Promise<IpcResult<PlaylistCacheEntry | null>>
    saveCache(
      id: string,
      snapshot: PlaylistSnapshot,
      complete: boolean
    ): Promise<IpcResult<null>>
    listMine(): Promise<IpcResult<PlaylistMeta[]>>
    create(name: string): Promise<IpcResult<PlaylistMeta>>
    rename(id: string, name: string): Promise<IpcResult<PlaylistMeta>>
    remove(id: string): Promise<IpcResult<null>>
    addSongs(id: string, mids: string[]): Promise<IpcResult<PlaylistMeta>>
    removeSongs(id: string, mids: string[]): Promise<IpcResult<PlaylistMeta>>
  }
  favorite: {
    get(mids: string[]): Promise<IpcResult<FavoriteState[]>>
    toggle(songMid: string): Promise<IpcResult<FavoriteState>>
  }
  recommend: {
    get(): Promise<IpcResult<RecommendFeed>>
    refresh(): Promise<IpcResult<RecommendFeed>>
  }
  mv: {
    search(keyword: string, pageNo: number): Promise<IpcResult<SearchResult>>
    getDetail(mvId: string): Promise<IpcResult<MvDetail>>
    getStream(mvId: string, quality: MvStream['quality']): Promise<IpcResult<MvStream>>
  }
  download: {
    list(): Promise<IpcResult<DownloadTask[]>>
    start(songMid: string, quality: Quality): Promise<IpcResult<DownloadTask>>
    pause(id: string): Promise<IpcResult<DownloadTask>>
    resume(id: string): Promise<IpcResult<DownloadTask>>
    remove(id: string): Promise<IpcResult<null>>
    clearCompleted(): Promise<IpcResult<null>>
    storage(): Promise<IpcResult<DownloadStorageInfo>>
    openFolder(): Promise<IpcResult<null>>
    chooseFolder(): Promise<IpcResult<string | null>>
    clearCache(): Promise<IpcResult<null>>
  }
  mpv: {
    getState(): Promise<IpcResult<MpvState>>
    setEnabled(enabled: boolean): Promise<IpcResult<MpvState>>
    loadAndPlay(url: string): Promise<IpcResult<null>>
    play(): Promise<IpcResult<null>>
    pause(): Promise<IpcResult<null>>
    stop(): Promise<IpcResult<null>>
    seek(positionMs: number): Promise<IpcResult<null>>
    setVolume(volume: number): Promise<IpcResult<null>>
    onEvent(callback: (event: MpvEvent) => void): () => void
  }
  user: {
    getProfile(): Promise<IpcResult<UserProfile>>
  }
  lyric: {
    get(songMid: string): Promise<IpcResult<Lyric>>
    /** 在 preload（渲染进程）内完成 QRC 3DES + zlib 解密；原始密文仍由主进程透传。 */
    decryptQrc(ciphertext: string): string
  }
  comment: {
    get(songId: string): Promise<IpcResult<CommentPage>>
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
