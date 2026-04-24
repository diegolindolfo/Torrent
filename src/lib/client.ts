// Use the pre-bundled browser build of WebTorrent. The source tree under
// `webtorrent/` relies on Node built-ins and package-level `browser` field
// replacements (e.g. `./lib/conn-pool.js` → `false`) that Vite handles
// inconsistently. The pre-bundled build ships as an ESM module that works out
// of the box.
import WebTorrent from 'webtorrent/dist/webtorrent.min.js'
import type WebTorrentType from 'webtorrent'

let instance: WebTorrentType.Instance | null = null
let serverPromise: Promise<void> | null = null

function waitForActive(
  registration: ServiceWorkerRegistration,
): Promise<ServiceWorkerRegistration> {
  return new Promise((resolve, reject) => {
    const done = () => {
      if (registration.active?.state === 'activated') {
        resolve(registration)
        return true
      }
      return false
    }
    if (done()) return

    const candidate =
      registration.active ?? registration.waiting ?? registration.installing
    if (!candidate) {
      reject(new Error('Service worker registration has no worker'))
      return
    }

    const onStateChange = () => {
      if (done()) {
        candidate.removeEventListener('statechange', onStateChange)
      } else if (candidate.state === 'redundant') {
        candidate.removeEventListener('statechange', onStateChange)
        reject(new Error('Service worker became redundant'))
      }
    }
    candidate.addEventListener('statechange', onStateChange)
  })
}

async function ensureServer(client: WebTorrentType.Instance): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    throw new Error(
      'Service workers não são suportados neste navegador — necessário para streaming.',
    )
  }
  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
  })
  await waitForActive(registration)
  // Ensure the current page is controlled by the worker before we try to
  // stream URLs through it. On first-visit the page is uncontrolled until the
  // SW claims it.
  if (!navigator.serviceWorker.controller) {
    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener(
        'controllerchange',
        () => resolve(),
        { once: true },
      )
    })
  }
  // WebTorrent 2.x requires a service-worker-based server for streaming.
  // See https://github.com/webtorrent/webtorrent/blob/master/docs/api.md
  ;(client as unknown as {
    createServer: (opts: { controller: ServiceWorkerRegistration }) => unknown
  }).createServer({ controller: registration })
}

export function getClient(): WebTorrentType.Instance {
  if (!instance) {
    instance = new WebTorrent()
    instance.on('error', (err) => {
      console.error('WebTorrent client error:', err)
    })
  }
  return instance
}

export function ensureStreamingServer(): Promise<void> {
  if (!serverPromise) {
    serverPromise = ensureServer(getClient()).catch((err) => {
      serverPromise = null
      throw err
    })
  }
  return serverPromise
}
