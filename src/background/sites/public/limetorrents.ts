import { searchFilter, SiteMetadata, Torrent } from '@/shared/interfaces/sites'
import { parseTimeToLive } from '@/shared/utils/filter'
import BittorrentSite from '@/background/sites/schema/AbstractBittorrentSite'
import { AxiosRequestConfig } from 'axios'

export const siteMetadata: SiteMetadata = {
  name: 'LimeTorrents',
  description: 'LimeTorrents is a Public general torrent index with mostly verified torrents',
  url: 'https://www.limetorrents.info/',
  legacyUrl: [
    'https://www.limetorrents.asia/',
    'https://www.limetorrents.co/',
    'https://limetor.com/',
    'https://www.limetor.pro/',
    'https://www.limetorrents.io/',
    'https://www.limetorrents.cc/',
    'https://www.limetorrents.me/'
  ],
  search: {
    /**  这个站的category在搜索时一点用都没有
    categories: [
      {
        name: 'Category',
        key: 'category',
        options: [
          { name: 'All', value: 'all' },
          { name: 'Anime', value: 'anime' },
          { name: 'Applications', value: 'applications' },
          { name: 'Games', value: 'games' },
          { name: 'Movies', value: 'movies' },
          { name: 'Music', value: 'music' },
          { name: 'TV shows', value: 'tv' },
          { name: 'Other', value: 'other' }
        ]
      }
    ]
     */
  },
  selector: {
    search: {
      rows: { selector: '.table2 > tbody > tr[bgcolor]' },
      id: { selector: 'div.tt-name > a[href^="/"]', attr: 'href', filters: [(q:string) => q.match(/(\d+)\.html/)![1]] },
      title: {
        selector: 'div.tt-name > a[href^="/"]',
        attr: 'href',
        filters: [
          (q:string) => q.match(/\/?(.+?)-torrent-\d+\.html/)![1].replace(/-/ig, ' ')
        ]
      },
      url: { selector: 'div.tt-name > a[href^="/"]', attr: 'href' },
      time: {
        selector: 'td:nth-child(2)',
        filters: [
          (q:string) => q.split('-')[0],
          (q:string) => q.replace('Last Month', '1 month ago').replace('+', 'ago'),
          parseTimeToLive
        ]
      },
      size: { selector: 'td:nth-child(3)' },
      seeders: { selector: '.tdseed' },
      leechers: { selector: '.tdleech' },
      category: { selector: 'td:nth-child(2)', filters: [(q:string) => q.split('-')[1].replace(' in ', '')] }
    },
    detail: {
      link: { selector: ['a.csprite_dltorrent[href^="magnet:"]', 'a.csprite_dltorrent[href^="http://itorrents.org/"]'], attr: 'href' }
    }
  }
}

// noinspection JSUnusedGlobalSymbols
export default class Limetorrents extends BittorrentSite {
  protected transformSearchFilter (filter: searchFilter): AxiosRequestConfig {
    const config = super.transformSearchFilter(filter)
    config.url = filter.keywords ? `search/all/${filter.keywords}/` : '/latest100'
    return config
  }
}
