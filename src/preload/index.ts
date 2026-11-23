import { contextBridge, ipcRenderer } from 'electron'
import { createDecipheriv } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import type { LycheeApi } from '../shared/ipc'
import type {
  AlbumDetail,
  ArtistAlbumPage,
  ArtistAlbumSort,
  ArtistDetail,
  ArtistSongPage,
  ArtistSongSort,
  AudioCacheProgress,
  AuthStatus,
  CommentLikeResult,
  CommentPage,
  CommentPostResult,
  DownloadRequest,
  DownloadStorageInfo,
  DownloadTask,
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
  Quality,
  RecommendFeed,
  SearchRequest,
  SearchResult,
  Settings,
  Song,
  SongAssetState,
  UpstreamBlockedEvent,
  UrlResult,
  UserCacheInfo,
  UserProfile,
  VipStatus
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
  system: {
    quit: () => ipcRenderer.send('app.quit')
  },
  flags: {
    get: () => invoke<FlagsFile>('flags.get'),
    save: (content: string) => invoke<null>('flags.save', content)
  },
  login: {
    getStatus: () => invoke<AuthStatus>('login.getStatus'),
    openWebLogin: (method) => invoke<AuthStatus>('login.openWebLogin', method),
    refreshSession: () => invoke<AuthStatus>('login.refreshSession'),
    logout: () => invoke<null>('login.logout'),
    onStatus: (callback) => {
      const listener = (_event: Electron.IpcRendererEvent, status: AuthStatus): void =>
        callback(status)
      ipcRenderer.on('login:status', listener)
      return () => ipcRenderer.removeListener('login:status', listener)
    },
    setEmbedBounds: (rect) => {
      ipcRenderer.send('login.setEmbedBounds', rect)
    }
  },
  search: {
    byType: (req: SearchRequest) => invoke<SearchResult>('search.byType', req)
  },
  artist: {
    get: (mid: string, offset?: number, sort?: ArtistSongSort) =>
      invoke<ArtistDetail>('artist.get', mid, offset, sort),
    getSongs: (mid: string, offset?: number, sort?: ArtistSongSort) =>
      invoke<ArtistSongPage>('artist.getSongs', mid, offset, sort),
    getAlbums: (mid: string, offset?: number, sort?: ArtistAlbumSort) =>
      invoke<ArtistAlbumPage>('artist.getAlbums', mid, offset, sort)
  },
  album: {
    get: (mid: string, offset?: number) => invoke<AlbumDetail>('album.get', mid, offset)
  },
  song: {
    getUrls: (mids: string[], quality: Quality) =>
      invoke<UrlResult[]>('song.getUrls', mids, quality),
    getMvId: (mid: string) => invoke<string>('song.getMvId', mid)
  },
  playlist: {
    get: (id: string, options) => invoke<PlaylistPage>('playlist.get', id, options),
    getCached: (id: string) => invoke<PlaylistCacheEntry | null>('playlist.getCached', id),
    getSnapshot: (id: string, token: number) =>
      invoke<PlaylistSnapshot>('playlist.getSnapshot', id, token),
    cancelSnapshot: (id: string, token: number) =>
      invoke<null>('playlist.cancelSnapshot', id, token),
    saveCache: (id: string, snapshot: PlaylistSnapshot, complete: boolean) =>
      invoke<null>('playlist.saveCache', id, snapshot, complete),
    listMine: () => invoke<PlaylistMeta[]>('playlist.listMine'),
    create: (name: string) => invoke<PlaylistMeta>('playlist.create', name),
    rename: (id: string, name: string) => invoke<PlaylistMeta>('playlist.rename', id, name),
    remove: (id: string) => invoke<null>('playlist.remove', id),
    addSongs: (id: string, mids: string[]) =>
      invoke<PlaylistMutationResult>('playlist.addSongs', id, mids),
    removeSongs: (id: string, mids: string[]) =>
      invoke<PlaylistMutationResult>('playlist.removeSongs', id, mids)
  },
  favorite: {
    get: (mids: string[]) => invoke<FavoriteState[]>('favorite.get', mids),
    toggle: (songMid: string) => invoke<FavoriteState>('favorite.toggle', songMid)
  },
  recommend: {
    get: (sectionId: string | null, token: number) =>
      invoke<RecommendFeed>('recommend.get', sectionId, token),
    refresh: (sectionId: string | null, token: number) =>
      invoke<RecommendFeed>('recommend.refresh', sectionId, token),
    guess: (page: number) => invoke<Song[]>('recommend.guess', page),
    cancel: (token: number) => invoke<null>('recommend.cancel', token)
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
    assetStates: (songMids: string[]) =>
      invoke<SongAssetState[]>('download.assetStates', songMids),
    start: (request: DownloadRequest, quality: Quality) =>
      invoke<DownloadTask>('download.start', request, quality),
    startMany: (requests: DownloadRequest[], quality: Quality) =>
      invoke<DownloadTask[]>('download.startMany', requests, quality),
    pause: (id: string) => invoke<DownloadTask>('download.pause', id),
    resume: (id: string) => invoke<DownloadTask>('download.resume', id),
    resumeAll: () => invoke<DownloadTask[]>('download.resumeAll'),
    remove: (id: string) => invoke<null>('download.remove', id),
    removeSong: (songMid: string) => invoke<null>('download.removeSong', songMid),
    clearCompleted: () => invoke<null>('download.clearCompleted'),
    clearTasks: (ids: string[]) => invoke<null>('download.clearTasks', ids),
    clearDirectory: () => invoke<null>('download.clearDirectory'),
    storage: () => invoke<DownloadStorageInfo>('download.storage'),
    openFolder: () => invoke<null>('download.openFolder'),
    chooseFolder: () => invoke<string | null>('download.chooseFolder'),
    clearCache: () => invoke<null>('download.clearCache')
  },
  user: {
    getProfile: () => invoke<UserProfile>('user.getProfile'),
    vipStatus: () => invoke<VipStatus>('user.vipStatus')
  },
  lyric: {
    get: (songId: string) => invoke<Lyric>('lyric.get', songId),
    decryptQrc
  },
  comment: {
    get: (songId: string, cursor?: string) =>
      invoke<CommentPage>('comment.get', songId, cursor),
    getMv: (mvId: string, cursor?: string) =>
      invoke<CommentPage>('comment.getMv', mvId, cursor),
    post: (songId: string, content: string) =>
      invoke<CommentPostResult>('comment.post', songId, content),
    postMv: (mvId: string, content: string) =>
      invoke<CommentPostResult>('comment.postMv', mvId, content),
    like: (commentId: string) => invoke<CommentLikeResult>('comment.like', commentId),
    unlike: (commentId: string) => invoke<CommentLikeResult>('comment.unlike', commentId)
  },
  audioCache: {
    onProgress: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        progress: AudioCacheProgress
      ): void => callback(progress)
      ipcRenderer.on('audioCache:progress', listener)
      return () => ipcRenderer.removeListener('audioCache:progress', listener)
    }
  },
  cache: {
    listUsers: () => invoke<UserCacheInfo[]>('cache.listUsers'),
    clearUser: (musicid: string) => invoke<null>('cache.clearUser', musicid)
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
  },
  navigation: {
    onBack: (callback) => {
      const listener = (): void => callback()
      ipcRenderer.on('navigation:back', listener)
      return () => ipcRenderer.removeListener('navigation:back', listener)
    },
    onForward: (callback) => {
      const listener = (): void => callback()
      ipcRenderer.on('navigation:forward', listener)
      return () => ipcRenderer.removeListener('navigation:forward', listener)
    }
  },
  upstream: {
    onBlocked: (callback) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        blocked: UpstreamBlockedEvent
      ): void => callback(blocked)
      ipcRenderer.on('upstream:blocked', listener)
      return () => ipcRenderer.removeListener('upstream:blocked', listener)
    }
  }
}

export function exposeApi(): void {
  contextBridge.exposeInMainWorld('lychee', api)
}

exposeApi()
