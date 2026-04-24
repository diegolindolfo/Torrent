// Wrapper around the WebTorrent service worker that also claims uncontrolled
// clients, so the current page is controlled on first load (without the user
// needing to reload).
importScripts('/sw.min.js')

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})
