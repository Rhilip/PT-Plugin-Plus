import { SiteMetadata, Torrent } from '@/shared/interfaces/sites'
import BittorrentSite from '@/background/sites/schema/AbstractBittorrentSite'
import dayjs from '@/shared/utils/dayjs'

export const siteMetadata: SiteMetadata = {
  name: 'E-Hentai',
  description: 'E-Hentai is a Public site for Hentai doujinshi, manga.',
  url: 'https://e-hentai.org/',
  search: {
    path: '/torrents.php',
    keywordsParams: 'search',
    categories: [
      {
        name: 'Domain',
        key: '#changeDomain',
        options: [
          { name: 'E-Hentai', value: 'https://e-hentai.org/' },
          { name: 'ExHentai', value: 'https://exhentai.org/' }
        ]
      }
    ]
  },
  selector: {
    search: {
      rows: { selector: 'table.itg > tbody > tr:has(td)' },
      id: { selector: 'td:nth-child(3)' }, // 我个人认为应该使用 Gallery Id作为 EH 的id
      title: { selector: 'a[href*="/gallerytorrents.php?gid="]' },
      url: { selector: 'td:nth-child(3) a', attr: 'href' }, // 而详情页链接应该使用 Gallery 的
      link: { selector: 'a[href*="/gallerytorrents.php?gid="]', attr: 'href' },
      time: { selector: 'td:first-child', filters: [(q:string) => dayjs(`${q} +00:00`).unix()] },
      size: { selector: 'td:nth-child(4)' },
      seeders: { selector: 'td:nth-child(5)' },
      leechers: { selector: 'td:nth-child(6)' },
      completed: { selector: 'td:nth-child(7)' },
      author: { selector: 'td:nth-child(8)' }
    }
  }
}

// noinspection JSUnusedGlobalSymbols
export default class EHentai extends BittorrentSite {
  async getTorrentDownloadLink (torrent: Torrent): Promise<string> {
    const { link } = torrent
    if (/gallerytorrents.php/.test(link)) {
      const gtPage = await this.request({ url: link, responseType: 'document' })
      // 优先考虑使用 私有种子，如果没有 再使用 可再分发种子
      return this.getFieldData(gtPage.data as Document, { selector: 'a[href*=".torrent"]:first-of-type', attr: 'href' })
    }

    return super.getTorrentDownloadLink(torrent)
  }
}
