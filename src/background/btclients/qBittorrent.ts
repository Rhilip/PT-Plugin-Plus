/**
 * @see https://github.com/qbittorrent/qBittorrent/wiki/Web-API-Documentation
 *
 * 注意，因为使用大驼峰命名的形式，所以qBittorrent在各变量命名中均写成 QBittorrent
 * TODO: 增加qBittorrent 3.x 使用的API支持
 */
import {
  AddTorrentOptions, CustomPathDescription,
  Torrent, TorrentClient,
  TorrentClientConfig, TorrentClientMetaData,
  TorrentFilterRules, TorrentState
} from '@/shared/interfaces/btclients'
import axios, { AxiosResponse, Method } from 'axios'
import urljoin from 'url-join'
import { random } from 'lodash-es'

export const clientConfig: TorrentClientConfig = {
  type: 'qBittorrent',
  name: 'qBittorrent',
  uuid: '4c0f3c06-0b41-4828-9770-e8ef56da6a5c',
  address: 'http://localhost:9091/',
  username: '',
  password: '',
  timeout: 60 * 1e3
}

// noinspection JSUnusedGlobalSymbols
export const clientMetaData: TorrentClientMetaData = {
  description: 'qBittorrent是一个跨平台的自由BitTorrent客户端，其图形用户界面是由Qt所写成的。',
  warning: [
    '当前仅支持 qBittorrent v4.1+',
    '由于浏览器限制，需要禁用 qBittorrent 的『启用跨站请求伪造(CSRF)保护』功能才能正常使用',
    '注意：由于 qBittorrent 验证机制限制，第一次测试连接成功后，后续测试无论密码正确与否都会提示成功。'
  ],
  feature: {
    CustomPath: {
      allowed: true,
      description: CustomPathDescription
    }
  }
}

type TrueFalseStr = 'true' | 'false';

enum QbittorrentTorrentState {
  /**
   * Some error occurred, applies to paused torrents
   */
  Error = 'error',
  /**
   * Torrent is paused and has finished downloading
   */
  PausedUP = 'pausedUP',
  /**
   * Torrent is paused and has NOT finished downloading
   */
  PausedDL = 'pausedDL',
  /**
   * Queuing is enabled and torrent is queued for upload
   */
  QueuedUP = 'queuedUP',
  /**
   * Queuing is enabled and torrent is queued for download
   */
  QueuedDL = 'queuedDL',
  /**
   * Torrent is being seeded and data is being transferred
   */
  Uploading = 'uploading',
  /**
   * Torrent is being seeded, but no connection were made
   */
  StalledUP = 'stalledUP',
  /**
   * Torrent has finished downloading and is being checked; this status also applies to preallocation (if enabled) and checking resume data on qBt startup
   */
  CheckingUP = 'checkingUP',
  /**
   * Same as checkingUP, but torrent has NOT finished downloading
   */
  CheckingDL = 'checkingDL',
  /**
   * Torrent is being downloaded and data is being transferred
   */
  Downloading = 'downloading',
  /**
   * Torrent is being downloaded, but no connection were made
   */
  StalledDL = 'stalledDL',
  /**
   * Torrent is forced to downloading to ignore queue limit
   */
  ForcedDL = 'forcedDL',
  /**
   * Torrent is forced to uploading and ignore queue limit
   */
  ForcedUP = 'forcedUP',
  /**
   * Torrent has just started downloading and is fetching metadata
   */
  MetaDL = 'metaDL',
  /**
   * Torrent is allocating disk space for download
   */
  Allocating = 'allocating',
  QueuedForChecking = 'queuedForChecking',
  /**
   * Checking resume data on qBt startup
   */
  CheckingResumeData = 'checkingResumeData',
  /**
   * Torrent is moving to another location
   */
  Moving = 'moving',
  /**
   * Unknown status
   */
  Unknown = 'unknown',
  /**
   * Torrent data files is missing
   */
  MissingFiles = 'missingFiles',
}

interface QbittorrentTorrent extends Torrent {
  id: string;
}

type QbittorrentTorrentFilters =
  | 'all'
  | 'downloading'
  | 'completed'
  | 'paused'
  | 'active'
  | 'inactive'
  | 'resumed'
  | 'stalled'
  | 'stalled_uploading'
  | 'stalled_downloading';

interface QbittorrentTorrentFilterRules extends TorrentFilterRules {
  hashes?: string|string[];
  filter?: QbittorrentTorrentFilters;
  category?: string;
  sort?: string;
  offset?: number;
  reverse?: boolean|TrueFalseStr;
}

interface QbittorrentAddTorrentOptions extends AddTorrentOptions {
  /**
   * Download folder
   */
  savepath: string;
  /**
   * Cookie sent to download the .torrent file
   */
  cookie: string;
  /**
   * Category for the torrent
   */
  category: string;
  /**
   * Skip hash checking. Possible values are true, false (default)
   */
  'skip_checking': TrueFalseStr;
  /**
   * Add torrents in the paused state. Possible values are true, false (default)
   */
  paused: TrueFalseStr;
  /**
   * Create the root folder. Possible values are true, false, unset (default)
   */
  'root_folder': TrueFalseStr | null;
  /**
   * Rename torrent
   */
  rename: string;
  /**
   * Set torrent upload speed limit. Unit in bytes/second
   */
  upLimit: number;
  /**
   * Set torrent download speed limit. Unit in bytes/second
   */
  dlLimit: number;
  /**
   * Whether Automatic Torrent Management should be used, disables use of savepath
   */
  useAutoTMM: TrueFalseStr;
  /**
   * Enable sequential download. Possible values are true, false (default)
   */
  sequentialDownload: TrueFalseStr;
  /**
   * Prioritize download first last piece. Possible values are true, false (default)
   */
  firstLastPiecePrio: TrueFalseStr;
}

interface rawTorrent {
  /**
   * Torrent name
   */
  name: string;
  hash: string;
  'magnet_uri': string;
  /**
   * datetime in seconds
   */
  'added_on': number;
  /**
   * Torrent size
   */
  size: number;
  /**
   * Torrent progress
   */
  progress: number;
  /**
   * Torrent download speed (bytes/s)
   */
  dlspeed: number;
  /**
   * Torrent upload speed (bytes/s)
   */
  upspeed: number;
  /**
   * Torrent priority (-1 if queuing is disabled)
   */
  priority: number;
  /**
   * Torrent seeds connected to
   */
  'num_seeds': number;
  /**
   * Torrent seeds in the swarm
   */
  'num_complete': number;
  /**
   * Torrent leechers connected to
   */
  'num_leechs': number;
  /**
   * Torrent leechers in the swarm
   */
  'num_incomplete': number;
  /**
   * Torrent share ratio
   */
  ratio: number;
  /**
   * Torrent ETA
   */
  eta: number;
  /**
   * Torrent state
   */
  state: QbittorrentTorrentState;
  /**
   * Torrent sequential download state
   */
  'seq_dl': boolean;
  /**
   * Torrent first last piece priority state
   */
  'f_l_piece_prio': boolean;
  /**
   * Torrent copletion datetime in seconds
   */
  'completion_on': number;
  /**
   * Torrent tracker
   */
  tracker: string;
  /**
   * Torrent download limit
   */
  'dl_limit': number;
  /**
   * Torrent upload limit
   */
  'up_limit': number;
  /**
   * Amount of data downloaded
   */
  downloaded: number;
  /**
   * Amount of data uploaded
   */
  uploaded: number;
  /**
   * Amount of data downloaded since program open
   */
  'downloaded_session': number;
  /**
   * Amount of data uploaded since program open
   */
  'uploaded_session': number;
  /**
   * Amount of data left to download
   */
  'amount_left': number;
  /**
   * Torrent save path
   */
  'save_path': string;
  /**
   * Amount of data completed
   */
  completed: number;
  /**
   * Upload max share ratio
   */
  'max_ratio': number;
  /**
   * Upload max seeding time
   */
  'max_seeding_time': number;
  /**
   * Upload share ratio limit
   */
  'ratio_limit': number;
  /**
   * Upload seeding time limit
   */
  'seeding_time_limit': number;
  /**
   * Indicates the time when the torrent was last seen complete/whole
   */
  'seen_complete': number;
  /**
   * Last time when a chunk was downloaded/uploaded
   */
  'last_activity': number;
  /**
   * Size including unwanted data
   */
  'total_size': number;

  'time_active': number;
  /**
   * Category name
   */
  category: string;
}

function normalizePieces (pieces: string | string[], joinBy:string = '|'): string {
  if (Array.isArray(pieces)) {
    return pieces.join(joinBy)
  }
  return pieces
}

// noinspection JSUnusedGlobalSymbols
export default class QBittorrent implements TorrentClient {
  readonly version = 'v0.1.0';
  readonly config: TorrentClientConfig;

  isLogin: boolean | null = null;

  constructor (options: Partial<TorrentClientConfig> = {}) {
    this.config = { ...clientConfig, ...options }
  }

  async ping (): Promise<boolean> {
    try {
      const pong = await this.login()
      this.isLogin = pong.data === 'Ok.'
      return this.isLogin
    } catch (e) {
      return false
    }
  }

  // qbt 默认Session时长 3600s，一次登录应该足够进行所有操作
  async login (): Promise<AxiosResponse> {
    const form = new FormData()
    form.append('username', this.config.username)
    form.append('password', this.config.password)

    return await axios.post(urljoin(this.config.address, '/api/v2', '/auth/login'), form, {
      timeout: this.config.timeout,
      withCredentials: true
    })
  }

  async request (method: Method, path: string,
    params?: any, data?: any,
    headers?: any): Promise<AxiosResponse> {
    if (this.isLogin === null) {
      await this.ping()
    }

    return await axios.request({
      method: method,
      url: urljoin(this.config.address, '/api/v2', path),
      params: params,
      data: data,
      headers: headers,
      timeout: this.config.timeout,
      withCredentials: true
    })
  }

  async addTorrent (urls: string, options: Partial<QbittorrentAddTorrentOptions> = {}): Promise<boolean> {
    const formData = new FormData()

    // 处理链接
    if (urls.startsWith('magnet:') || !options.localDownload) {
      formData.append('urls', urls)
    } else if (options.localDownload) {
      const req = await axios.get(urls, {
        responseType: 'blob'
      })
      // FIXME 使用
      formData.append('torrents', req.data, String(random(0, 4096, true)) + '.torrent')
    }
    delete options.localDownload

    // 将通用字段转成qbt字段
    if (options.savePath) {
      options.savepath = options.savePath
      delete options.savePath
    }

    if (options.label) {
      options.category = options.label
      delete options.label
    }

    if ('addAtPaused' in options) {
      options.paused = options.addAtPaused ? 'true' : 'false'
      delete options.addAtPaused
    }

    options.useAutoTMM = 'false' // 关闭自动管理

    for (const [key, value] of Object.entries(options)) {
      // @ts-ignore
      formData.append(key, value)
    }

    const res = await this.request('POST', '/torrents/add', undefined, formData)
    return res.data === 'Ok.'
  }

  async getTorrentsBy (filter: QbittorrentTorrentFilterRules): Promise<QbittorrentTorrent[]> {
    if (filter.hashes) {
      filter.hashes = normalizePieces(filter.hashes)
    }

    // 将通用项处理成qbt对应的项目
    if (filter.complete) {
      filter.filter = 'completed'
      delete filter.complete
    }

    const res = await this.request('GET', '/torrents/info', filter)
    return res.data.map((torrent: rawTorrent) => {
      let state = TorrentState.unknown

      switch (torrent.state) {
        case QbittorrentTorrentState.ForcedDL:
        case QbittorrentTorrentState.MetaDL:
          state = TorrentState.downloading
          break
        case QbittorrentTorrentState.Allocating:
          // state = 'stalledDL';
          state = TorrentState.queued
          break
        case QbittorrentTorrentState.ForcedUP:
          state = TorrentState.seeding
          break
        case QbittorrentTorrentState.PausedDL:
          state = TorrentState.paused
          break
        case QbittorrentTorrentState.PausedUP:
          // state = 'completed';
          state = TorrentState.paused
          break
        case QbittorrentTorrentState.QueuedDL:
        case QbittorrentTorrentState.QueuedUP:
          state = TorrentState.queued
          break
        case QbittorrentTorrentState.CheckingDL:
        case QbittorrentTorrentState.CheckingUP:
        case QbittorrentTorrentState.QueuedForChecking:
        case QbittorrentTorrentState.CheckingResumeData:
        case QbittorrentTorrentState.Moving:
          state = TorrentState.checking
          break
        case QbittorrentTorrentState.Unknown:
        case QbittorrentTorrentState.MissingFiles:
          state = TorrentState.error
          break
        default:
          break
      }

      const isCompleted = torrent.progress === 1

      return {
        id: torrent.hash,
        infoHash: torrent.hash,
        name: torrent.name,
        state,
        dateAdded: new Date(torrent.added_on * 1000).toISOString(),
        isCompleted,
        progress: torrent.progress,
        label: torrent.category,
        savePath: torrent.save_path,
        totalSize: torrent.total_size,
        ratio: torrent.ratio,
        uploadSpeed: torrent.upspeed,
        downloadSpeed: torrent.dlspeed,
        totalUploaded: torrent.uploaded,
        totalDownloaded: torrent.downloaded
      } as Torrent
    })
  }

  async getAllTorrents (): Promise<QbittorrentTorrent[]> {
    return await this.getTorrentsBy({})
  }

  async getTorrent (id: any): Promise<QbittorrentTorrent> {
    return (await this.getTorrentsBy({ hashes: id }))[0]
  }

  // 注意方法虽然支持一次对多个种子进行操作，但仍建议每次均只操作一个种子
  async pauseTorrent (hashes: string | string[] | 'all'): Promise<boolean> {
    const params = {
      hashes: hashes === 'all' ? 'all' : normalizePieces(hashes)
    }

    await this.request('GET', '/torrents/pause', params)
    return true
  }

  // 注意方法虽然支持一次对多个种子进行操作，但仍建议每次均只操作一个种子
  async removeTorrent (hashes: string | string[] | 'all', removeData: boolean = false): Promise<boolean> {
    const params = {
      hashes: hashes === 'all' ? 'all' : normalizePieces(hashes),
      removeData
    }
    await this.request('GET', '/torrents/delete', params)
    return true
  }

  // 注意方法虽然支持一次对多个种子进行操作，但仍建议每次均只操作一个种子
  async resumeTorrent (hashes: string | string[] | 'all'): Promise<any> {
    const params = {
      hashes: hashes === 'all' ? 'all' : normalizePieces(hashes)
    }
    await this.request('GET', '/torrents/resume', params)
    return true
  }
}
