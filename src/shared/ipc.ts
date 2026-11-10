import type {
  AlbumDetail,
  ArtistDetail,
  ArtistSongPage,
  ArtistSongSort,
  AudioCacheProgress,
  AuthStatus,
  CommentLikeResult,
  CommentPage,
  CommentSort,
  DownloadStorageInfo,
  DownloadTask,
  EmbedRect,
  FavoriteState,
  FlagsFile,
  IpcResult,
  Lyric,
  MprisCommand,
  MvDetail,
  MvStream,
  PlayerState,
  PlaylistCacheEntry,
  PlaylistMeta,
  PlaylistMutationResult,
  PlaylistPage,
  PlaylistSnapshot,
  ProbeOptions,
  Quality,
  RecommendFeed,
  SearchRequest,
  SearchResult,
  Settings,
  SongAssetState,
  SongAvailability,
  UpstreamBlockedEvent,
  UrlResult,
  UserProfile
} from './types'

export interface LycheeApi {
  system: {
    /** 请求主进程退出应用；不受“关闭到托盘”影响。 */
    quit(): void
  }
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
  artist: {
    get(
      mid: string,
      offset?: number,
      sort?: ArtistSongSort
    ): Promise<IpcResult<ArtistDetail>>
    getSongs(
      mid: string,
      offset?: number,
      sort?: ArtistSongSort
    ): Promise<IpcResult<ArtistSongPage>>
  }
  album: {
    get(mid: string, offset?: number): Promise<IpcResult<AlbumDetail>>
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
    addSongs(id: string, mids: string[]): Promise<IpcResult<PlaylistMutationResult>>
    removeSongs(id: string, mids: string[]): Promise<IpcResult<PlaylistMutationResult>>
  }
  favorite: {
    get(mids: string[]): Promise<IpcResult<FavoriteState[]>>
    toggle(songMid: string): Promise<IpcResult<FavoriteState>>
  }
  recommend: {
    get(): Promise<IpcResult<RecommendFeed>>
    refresh(sectionId?: string): Promise<IpcResult<RecommendFeed>>
  }
  mv: {
    search(keyword: string, pageNo: number): Promise<IpcResult<SearchResult>>
    getDetail(mvId: string): Promise<IpcResult<MvDetail>>
    getStream(mvId: string, quality: MvStream['quality']): Promise<IpcResult<MvStream>>
  }
  download: {
    list(): Promise<IpcResult<DownloadTask[]>>
    assetStates(songMids: string[]): Promise<IpcResult<SongAssetState[]>>
    start(songMid: string, quality: Quality): Promise<IpcResult<DownloadTask>>
    startMany(songMids: string[], quality: Quality): Promise<IpcResult<DownloadTask[]>>
    pause(id: string): Promise<IpcResult<DownloadTask>>
    resume(id: string): Promise<IpcResult<DownloadTask>>
    remove(id: string): Promise<IpcResult<null>>
    clearCompleted(): Promise<IpcResult<null>>
    clearDirectory(): Promise<IpcResult<null>>
    storage(): Promise<IpcResult<DownloadStorageInfo>>
    openFolder(): Promise<IpcResult<null>>
    chooseFolder(): Promise<IpcResult<string | null>>
    clearCache(): Promise<IpcResult<null>>
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
    get(songId: string, sort?: CommentSort, cursor?: string): Promise<IpcResult<CommentPage>>
    like(commentId: string): Promise<IpcResult<CommentLikeResult>>
    unlike(commentId: string): Promise<IpcResult<CommentLikeResult>>
  }
  audioCache: {
    onProgress(callback: (progress: AudioCacheProgress) => void): () => void
  }
  settings: {
    get(): Promise<IpcResult<Settings>>
    set(patch: Partial<Settings>): Promise<IpcResult<Settings>>
  }
  player: {
    sendState(state: PlayerState): void
    onCommand(callback: (command: MprisCommand) => void): () => void
  }
  upstream: {
    /** 收到 104009 进入全局截断窗口时通知渲染层展示提示。 */
    onBlocked(callback: (event: UpstreamBlockedEvent) => void): () => void
  }
}
