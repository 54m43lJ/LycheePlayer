import { contextBridge, ipcRenderer } from 'electron'
import { createDecipheriv } from 'node:crypto'
import { inflateSync } from 'node:zlib'
import type { LycheeApi } from '../shared/ipc'
import type {
  AlbumDetail,
  ArtistDetail,
  ArtistSongSort,
  AudioCacheProgress,
  AuthStatus,
  CommentLikeResult,
  CommentPage,
  CommentSort,
  DownloadBatch,
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
  PlaylistPage,
  PlaylistSnapshot,
  Quality,
  RecommendFeed,
  SearchRequest,
  SearchResult,
  Settings,
  SongAssetState,
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
  system: {
    quit: () => ipcRenderer.send('app.quit')
  },
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
  artist: {
    get: (mid: string, offset?: number, sort?: ArtistSongSort) =>
      invoke<ArtistDetail>('artist.get', mid, offset, sort)
  },
  album: {
    get: (mid: string, offset?: number) => invoke<AlbumDetail>('album.get', mid, offset)
  },
  song: {
    getUrls: (mids: string[], quality: Quality) =>
      invoke<UrlResult[]>('song.getUrls', mids, quality),
    probe: (mids: string[], options) =>
      invoke<SongAvailability[]>('song.probe', mids, options)
  },
  playlist: {
    get: (id: string, options) => invoke<PlaylistPage>('playlist.get', id, options),
    getCached: (id: string) => invoke<PlaylistCacheEntry | null>('playlist.getCached', id),
    saveCache: (id: string, snapshot: PlaylistSnapshot, complete: boolean) =>
      invoke<null>('playlist.saveCache', id, snapshot, complete),
    listMine: () => invoke<PlaylistMeta[]>('playlist.listMine'),
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
    refresh: (sectionId?: string) =>
      invoke<RecommendFeed>('recommend.refresh', sectionId)
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
    batches: () => invoke<DownloadBatch[]>('download.batches'),
    assetStates: (songMids: string[]) =>
      invoke<SongAssetState[]>('download.assetStates', songMids),
    start: (songMid: string, quality: Quality) =>
      invoke<DownloadTask>('download.start', songMid, quality),
    startBatch: (request) => invoke<DownloadBatch>('download.startBatch', request),
    pause: (id: string) => invoke<DownloadTask>('download.pause', id),
    resume: (id: string) => invoke<DownloadTask>('download.resume', id),
    remove: (id: string) => invoke<null>('download.remove', id),
    pauseBatch: (batchId: string) => invoke<DownloadBatch>('download.pauseBatch', batchId),
    resumeBatch: (batchId: string) => invoke<DownloadBatch>('download.resumeBatch', batchId),
    removeBatch: (batchId: string) => invoke<null>('download.removeBatch', batchId),
    retryFailed: (batchId: string) => invoke<DownloadBatch>('download.retryFailed', batchId),
    clearCompleted: () => invoke<null>('download.clearCompleted'),
    storage: () => invoke<DownloadStorageInfo>('download.storage'),
    openFolder: () => invoke<null>('download.openFolder'),
    chooseFolder: () => invoke<string | null>('download.chooseFolder'),
    clearCache: () => invoke<null>('download.clearCache')
  },
  user: {
    getProfile: () => invoke<UserProfile>('user.getProfile')
  },
  lyric: {
    get: (songMid: string) => invoke<Lyric>('lyric.get', songMid),
    decryptQrc
  },
  comment: {
    get: (songId: string, sort?: CommentSort, pageNo?: number) =>
      invoke<CommentPage>('comment.get', songId, sort, pageNo),
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
