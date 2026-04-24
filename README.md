# Torrent Player

Player de torrent moderno e simples que roda 100% no navegador. Aceita magnet
links e arquivos `.torrent` e faz streaming direto via
[WebTorrent](https://webtorrent.io).

## Stack

- [Vite](https://vite.dev) + [React 19](https://react.dev) +
  [TypeScript](https://www.typescriptlang.org)
- [Tailwind CSS 4](https://tailwindcss.com)
- [WebTorrent](https://webtorrent.io) (build pré-empacotado para browser)

## Funcionalidades

- Cole um magnet link ou solte um arquivo `.torrent` (drag & drop).
- Seleção de arquivo: lista todos os arquivos do torrent e reproduz o
  escolhido.
- Player inline para vídeo (`<video>`) e áudio (`<audio>`).
- Download direto do arquivo (gera um blob URL quando o torrent termina).
- Status em tempo real: peers, velocidades de download/upload, progresso,
  tempo restante.

## Como rodar

```bash
npm install
npm run dev
```

Abra `http://localhost:5173` no navegador.

Para um build de produção:

```bash
npm run build
npm run preview
```

## Limitações

Este é um cliente **frontend-only**: WebTorrent no navegador só consegue
conectar a peers que falem WebRTC (outros clientes WebTorrent / navegadores
com a aplicação aberta). Torrents tradicionais que não tenham peers via
WebRTC não vão receber dados, mesmo que o magnet link esteja correto.

Para cobertura total da rede BitTorrent (peers TCP/UDP), seria necessário um
backend Node.js com
[`webtorrent-hybrid`](https://github.com/webtorrent/webtorrent-hybrid) ou
similar — o que foge do escopo deste projeto.

## Teste rápido

Use o botão **"carregar Sintel (magnet)"** na tela inicial — é o curta-metragem
oficial da Blender, distribuído pelo próprio site do WebTorrent como exemplo
e costuma ter seeds WebRTC ativos.

## Como funciona o streaming

O WebTorrent 2.x faz streaming registrando um service worker que intercepta
requests para `/<infoHash>/<path>`. O arquivo [`public/sw.js`](./public/sw.js)
é um wrapper que carrega o SW oficial (`sw.min.js`) e chama `clients.claim()`
pra controlar a página já na primeira visita — caso contrário o usuário
precisaria recarregar pro streaming funcionar.

## Scripts

| Script            | Descrição                                     |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Inicia o servidor de desenvolvimento Vite.    |
| `npm run build`   | Gera o bundle de produção (typecheck + vite). |
| `npm run preview` | Serve o build de produção localmente.         |
| `npm run lint`    | Roda o ESLint.                                |
