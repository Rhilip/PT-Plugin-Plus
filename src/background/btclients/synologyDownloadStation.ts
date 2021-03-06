/**
 * @see https://global.download.synology.com/download/Document/DeveloperGuide/Synology_Download_Station_Web_API.pdf
 * @see https://github.com/kwent/syno/tree/master/definitions
 * @see https://github.com/seansfkelley/synology-typescript-api
 */
import {
  AddTorrentOptions,
  Torrent,
  TorrentClient,
  TorrentClientConfig,
  TorrentClientMetaData,
  TorrentFilterRules,
  TorrentState
} from '@/shared/interfaces/btclients'
import urljoin from 'url-join'
import axios, { AxiosRequestConfig } from 'axios'

export const clientConfig: TorrentClientConfig = {
  type: 'synologyDownloadStation',
  name: 'Synology Download Station',
  address: 'http://mysd.com:5000/',
  uuid: '37b3c655-fe0a-4078-b38b-d742f0c049bf',
  username: '',
  password: '',
  timeout: 60 * 1e3
}

// noinspection JSUnusedGlobalSymbols
export const clientMetaData: TorrentClientMetaData = {
  description: 'Download Station是由Synology NAS提供的一款网页式下载应用程序',
  warning: [
    'DSM 4.2以及之后版本请勿开启二步验证选项'
  ],
  feature: {
    CustomPath: {
      allowed: true,
      description: "因 Synology Download Station API 接口限制，保存目录依赖于“暂存位置”，并且只允许使用相对路径；<br/>如暂存位置为 /volume1/，期望存储目的地位置为 /volume1/music/，那么请在“目录列表”中填写：<span style='color:red'>music</span>"
    }
  }
}

// 定义API

type SYNOApiCGIPath =
  'query.cgi' // FOR API 'SYNO.API.Info'
  | 'auth.cgi' // FOR API 'SYNO.API.Auth'
  | 'DownloadStation/task.cgi' // FOR API DSMApiEndPointDownload
  | 'entry.cgi' // FOR API DSMApiEndPointDownloadV2 and other

/**
 * Base API
 */
type SynoApiEndPointBase =
  'SYNO.API.Info' // Provides available API info
  | 'SYNO.API.Auth' // Performs session login and logout.

/**
 * Download Station API
 */
type SynoApiEndPointDownload =
  'SYNO.DownloadStation.Info' // Provides Download Station info and settings. Sets Download Station settings.
  | 'SYNO.DownloadStation.Schedule' // Provides advanced schedule settings. Sets advanced schedule settings.
  | 'SYNO.DownloadStation.Task' // Provides task listing and detailed task information. Performs task actions: create, delete, resume, pause.
  | 'SYNO.DownloadStation.Statistic' // Provides total download/upload statistics.
  | 'SYNO.DownloadStation.RSS.Site' // Provides RSS site listing. Refreshes RSS site.
  | 'SYNO.DownloadStation.RSS.Feed' // Provides RSS feed listing.

/**
 * Download Station API v2
 * @note: This API v2 is not documented, So don't use it for any reason
 */
type SynoApiEndPointDownloadV2 =
  'SYNO.DownloadStation2.BTSearch'
  | 'SYNO.DownloadStation2.Captcha'
  | 'SYNO.DownloadStation2.Package.Info'
  | 'SYNO.DownloadStation2.Package.Module'
  | 'SYNO.DownloadStation2.Package.Service'
  | 'SYNO.DownloadStation2.RSS.Feed'
  | 'SYNO.DownloadStation2.RSS.Filter'
  | 'SYNO.DownloadStation2.RSS.Item'
  | 'SYNO.DownloadStation2.Settings.BT'
  | 'SYNO.DownloadStation2.Settings.BTSearch'
  | 'SYNO.DownloadStation2.Settings.Emule'
  | 'SYNO.DownloadStation2.Settings.Emule.Location'
  | 'SYNO.DownloadStation2.Settings.FileHosting'
  | 'SYNO.DownloadStation2.Settings.FtpHttp'
  | 'SYNO.DownloadStation2.Settings.Global'
  | 'SYNO.DownloadStation2.Settings.Location'
  | 'SYNO.DownloadStation2.Settings.Nzb'
  | 'SYNO.DownloadStation2.Settings.Rss'
  | 'SYNO.DownloadStation2.Settings.Scheduler'
  | 'SYNO.DownloadStation2.Task'
  | 'SYNO.DownloadStation2.Task.BT'
  | 'SYNO.DownloadStation2.Task.BT.File'
  | 'SYNO.DownloadStation2.Task.BT.Peer'
  | 'SYNO.DownloadStation2.Task.BT.Tracker'
  | 'SYNO.DownloadStation2.Task.List'
  | 'SYNO.DownloadStation2.Task.List.Polling'
  | 'SYNO.DownloadStation2.Task.NZB.File'
  | 'SYNO.DownloadStation2.Task.NZB.Log'
  | 'SYNO.DownloadStation2.Task.Source'
  | 'SYNO.DownloadStation2.Task.Statistic'
  | 'SYNO.DownloadStation2.Task.eMule'
  | 'SYNO.DownloadStation2.Thumbnail'
  | 'SYNO.DownloadStation2.eMule.Search'
  | 'SYNO.DownloadStation2.eMule.Server'

type SynoApiEndPoint = SynoApiEndPointBase | SynoApiEndPointDownload | SynoApiEndPointDownloadV2

type SynologySessionName = 'DownloadStation' | 'FileStation'

interface FormFile {
  content: Blob;
  filename: string;
}

function isFormFile (f?: any): f is FormFile {
  return f && (f as FormFile).content != null && (f as FormFile).filename != null
}

// 定义API请求参数
interface DSRequestField {
  api: SynoApiEndPoint,
  version: 1 | 2,
  method: string,
  _sid?: string,

  _useForm?: boolean,
  [propName: string]: any
}

interface DSRequestFieldForApiAuth extends DSRequestField {
  api: 'SYNO.API.Auth',
  version: 2,
  method: 'login',
  account: string,
  passwd: string,
  session: SynologySessionName,
  format: 'cookie' | 'sid',
}

// 定义API响应
interface SynologySuccessResponse<S> {
  success: true;
  data: S;
}

enum SynologyErrorCode {
  /**
   * Common Error Code
   */
  UNKNOWN_ERROR = 100, // Unknown error
  INVALID_PARAMETER = 101, // Invalid parameter
  API_NOT_EXIST = 102, // The requested API does not exist
  METHOD_NOT_EXIST = 103, // The requested method does not exist
  VERSION_NOT_SUPPORT = 104, // The requested version does not support the functionality
  PERMISSION_DENY = 105, // The logged in session does not have permission
  SESSION_TIMEOUT = 105, // Session timeout
  SESSION_INTERRUPTED = 106, // Session interrupted by duplicate login

  /**
   * Auth Error Code
   */
  AUTH_INCORRECT_AUTHENTICATION = 400, // No such account or incorrect password
  AUTH_ACCOUNT_DISABLED = 401, // Account disabled
  AUTH_PERMISSION_DENIED = 402, // Permission denied
  AUTH_VERIFICATION_CODE_REQUIRED = 403, // 2-step verification code required
  AUTH_VERIFICATION_CODE_FAILED = 404, //  Failed to authenticate 2-step verification code

  /**
   * Torrent Upload Error Code
   */
  TORRENT_UPLOAD_FAILED = 400, // File upload failed
  TORRENT_UPLOAD_MAX_TASKS_REACHED = 401, // Max number of tasks reached
  TORRENT_UPLOAD_DESTINATION_DENIED = 402, // Destination denied
  TORRENT_UPLOAD_DESTINATION_NOT_EXIST = 403, // Destination does not exist
  TORRENT_UPLOAD_INVALID_TASK_ID = 404, // Invalid task id
  TORRENT_UPLOAD_INVALID_TASK_ACTION = 405, // Invalid task action
  TORRENT_UPLOAD_NO_DEFAULT_DESTINATION = 406, // No default destination
  TORRENT_UPLOAD_SET_DESTINATION_FAILED = 407, // Set destination failed
  TORRENT_UPLOAD_FILE_NOT_EXIST = 408 // File does not exist
}

interface SynologyFailureResponse {
  success: false;
  error: {
    code: number;
    errors?: any[];
  };
}

type SynologyResponse<S> = SynologySuccessResponse<S> | SynologyFailureResponse;

type rawTaskStatus = 'downloading' | 'error' | 'extracting' | 'filehosting_waiting' | 'finished' | 'finishing' | 'hash_checking' | 'paused' | 'seeding' | 'waiting'

interface rawTask {
  id: string, // Task ID
  type: 'bt' | 'nzb' | 'http' | 'https' | 'ftp' | 'emule',
  username: string | number, // Task owner
  title: string, // Task title
  size: number, // Task size in bytes

  /**
   * 如果通过 SYNO.DownloadStation.Task 接口，返回的是字符串
   * 但通过  SYNO.DownloadStation2.Task 接口，返回的是int，但映射关系目前不明确
   */
  status: rawTaskStatus | number,
  'status_extra'?: {
    /**
     * Available when status=error, providing error info.
     * Possible error_detail values are listed in Appendix
     * B: Values for Details of Erroneous Task.
     */
    'error_detail'?: string,
    /**
     * Available when status=extracting, ranging from 0
     * to 100.
     */
    'unzip_progress'?: number
  },
  additional?: {
    detail?: {
      'completed_time': number,
      destination: string,
      uri: string,
      'created_time': number,
      priority: 'auto' | 'low' | 'normal' | 'high',
      'total_peers': number,
      'connected_seeders': number,
      'connected_leechers': number,
    },
    transfer?: {
      'size_downloaded': number,
      'size_uploaded': number,
      'speed_download': number,
      'speed_upload': number
    },
    file?: {
      filename: string;
      index: number;
      priority: 'skip' | 'low' | 'normal' | 'high';
      size: number;
      'size_downloaded': number;
      wanted: boolean;
    }[],
    peer?: {
      address: string;
      agent: string;
      progress: number;
      'speed_download': number;
      'speed_upload': number;
    }[],
    tracker?: {
      'downloaded_pieces': number;
      'size_downloaded': number;
      'size_uploaded': number;
      'speed_download': number;
      'speed_upload': number;
    }[]
  }
}

// noinspection JSUnusedGlobalSymbols
export default class SynologyDownloadStation implements TorrentClient {
  readonly version = 'v0.2.1';
  readonly config: TorrentClientConfig;

  private _sessionId: string | null = null;

  constructor (options: Partial<TorrentClientConfig> = {}) {
    this.config = { ...clientConfig, ...options }
  }

  private async getSessionId (): Promise<string> {
    if (this._sessionId === null) {
      await this.login()
    }
    return this._sessionId as string
  }

  // 核心请求方法
  private async request (
    cgi: SYNOApiCGIPath,
    config: AxiosRequestConfig
  ): Promise<SynologyResponse<any>> {
    return (await axios.request({
      ...{
        url: urljoin(this.config.address, 'webapi', cgi),
        timeout: this.config.timeout,
        withCredentials: false
      },
      ...config
    })).data
  }

  // entry.cgi 请求方法
  private async requestEntryCGI (field: DSRequestField): Promise<SynologyResponse<any>> {
    // 覆写 _sid 参数
    field._sid = await this.getSessionId()

    let postData: URLSearchParams | FormData
    if (field._useForm) {
      delete field._useForm
      postData = new FormData()
    } else {
      postData = new URLSearchParams()
    }

    Object.keys(field).forEach((k) => {
      let v = field[k]
      if (v !== undefined) {
        if (isFormFile(v)) {
          (postData as FormData).append(k, v.content, v.filename)
        } else {
          if (Array.isArray(v)) {
            v = JSON.stringify(v)
          }
          postData.append(k, v)
        }
      }
    })

    return await this.request('entry.cgi', {
      method: 'post',
      data: postData
    } as Partial<AxiosRequestConfig>)
  }

  // 请求登录并获得sid信息
  private async login () : Promise<boolean> {
    try {
      const req = await this.request('auth.cgi', {
        params: {
          api: 'SYNO.API.Auth',
          version: 2,
          method: 'login',
          account: this.config.username,
          passwd: this.config.password,
          session: 'DownloadStation',
          format: 'sid'
        } as DSRequestFieldForApiAuth
      }) as SynologyResponse<{ sid: string }>
      if (req.success) {
        this._sessionId = req.data.sid
      }

      return req.success
    } catch (e) {
      return false
    }
  }

  async ping (): Promise<boolean> {
    return this.login()
  }

  async addTorrent (urls: string, options: Partial<AddTorrentOptions> = {}): Promise<boolean> {
    const params = {
      api: 'SYNO.DownloadStation2.Task',
      method: 'create',
      version: 2,
      create_list: false
    } as DSRequestField

    if (urls.startsWith('magnet:') || !options.localDownload) {
      params.type = 'file'
      params.url = [urls]
    } else {
      params._useForm = true
      params.type = 'file'
      params.file = ['torrent']

      // 获得本地请求的种子内容
      const torrentReq = await axios.get(urls, {
        responseType: 'blob'
      })
      params.torrent = {
        content: torrentReq.data,
        filename: 'file.torrent' // FIXME 根据请求头确定种子名
      } as FormFile
    }
    if (options.savePath) {
      params.destination = options.savePath
    }

    // 这个地方很奇怪，不这么写的话，会报 对应项 缺失。。。。。
    params.type = '"' + params.type + '"'
    params.destination = '"' + params.destination + '"'

    const req = await this.requestEntryCGI(params) as SynologyResponse<{
      'list_id': any[], // 不知道具体返回情况
      'task_id': string[]
    }>

    // DS不支持在添加的时候设置暂停状态，所以我们要在添加后暂停对应任务
    if (req.success) {
      if (options.addAtPaused && req.data.task_id.length > 0) {
        await this.pauseTorrent(req.data.task_id[0])
      }
    }

    // TODO 添加异常处理方法

    return req.success
  }

  async getAllTorrents (): Promise<Torrent[]> {
    return await this.getTorrentsBy({})
  }

  async getTorrent (id: any): Promise<Torrent> {
    return (await this.getTorrentsBy({ ids: id }))[0]
  }

  async getTorrentsBy (filter: TorrentFilterRules): Promise<Torrent[]> {
    const params: DSRequestField = {
      api: 'SYNO.DownloadStation2.Task',
      method: 'list',
      version: 2,
      // limit: -1,
      // offset: 0,
      additional: ['detail', 'transfer']
    }

    if (filter.ids) {
      params.method = 'get'
      params.id = filter.ids
    }

    const req = await this.requestEntryCGI(params) as SynologySuccessResponse<{
      offset: number,
      task: rawTask[],
      total: number
    }>

    return req.data.task.filter(s => s.type === 'bt' /** 只选择bt种子返回 */).map(task => {
      let state = TorrentState.unknown
      if (typeof task.status === 'string') {
        switch (task.status) {
          case 'downloading':
          case 'extracting':
            state = TorrentState.downloading
            break

          case 'seeding':
          case 'finished':
          case 'finishing':
            state = TorrentState.seeding
            break

          case 'paused':
            state = TorrentState.paused
            break

          case 'filehosting_waiting':
          case 'waiting':
            state = TorrentState.queued
            break

          case 'hash_checking':
            state = TorrentState.checking
            break

          case 'error':
            state = TorrentState.error
            break
        }
      } // TODO else if (typeof task.status === 'number') {}

      const isCompleted = task.additional!.detail!.completed_time > 0
      const upload = task.additional!.transfer!.size_uploaded
      const download = task.additional!.transfer!.size_downloaded

      return {
        id: task.id,
        infoHash: task.id, // 注意DS的返回信息中没有info_hash，故使用id替代
        name: task.title,
        state,
        dateAdded: new Date(task.additional!.detail!.created_time * 1000).toISOString(),
        isCompleted,
        progress: download / task.size,
        savePath: task.additional!.detail!.destination,
        totalSize: task.size,
        ratio: upload / download,
        uploadSpeed: task.additional!.transfer!.speed_upload,
        downloadSpeed: task.additional!.transfer!.speed_download,
        totalUploaded: upload,
        totalDownloaded: download

      } as Torrent
    })
  }

  async pauseTorrent (id: string): Promise<boolean> {
    return (await this.requestEntryCGI({
      id: id,
      api: 'SYNO.DownloadStation2.Task',
      method: 'pause',
      version: 2
    })).success
  }

  async resumeTorrent (id: string): Promise<boolean> {
    return (await this.requestEntryCGI({
      id: id,
      api: 'SYNO.DownloadStation2.Task',
      method: 'resume',
      version: 2
    })).success
  }

  /**
   * 注意，因为DSM的原因（不支持 只删除种子不删除文件），removeData配置项不会起作用，
   *
   * @param id
   * @param removeData
   */
  async removeTorrent (id: any, removeData: boolean | undefined): Promise<boolean> {
    return (await this.requestEntryCGI({
      id: id,
      api: 'SYNO.DownloadStation2.Task',
      method: 'delete',
      version: 2,
      // Delete tasks and force to move uncompleted download files to the destination.
      force_complete: false
    })).success
  }
}
