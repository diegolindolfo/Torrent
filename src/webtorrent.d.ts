declare module 'webtorrent/dist/webtorrent.min.js' {
  import type WebTorrent from 'webtorrent'
  const ctor: typeof WebTorrent
  export default ctor
}
