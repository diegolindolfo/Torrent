# Torrent Player

Player de torrent completo: **frontend React** + **backend Node.js** com
WebTorrent. Aceita magnet links e arquivos `.torrent`, faz streaming de
vídeo/áudio via HTTP (Range) diretamente no navegador.

## Arquitetura

```
┌────────────┐   HTTP/SSE    ┌─────────────────────┐   BitTorrent
│  Frontend  │ ─────────────►│  Backend Node.js    │ ──────────────► peers
│ Vite + RC  │    magnets    │  Express + WT 2.x   │   TCP/UDP/WebRTC
└────────────┘ ◄───────────── │  chunk store in-mem │ ◄──────────────
       ▲          streaming   └─────────────────────┘
       │
       └─ Usuário
```

O backend carrega e torreia os arquivos (fala BitTorrent completo — TCP, uTP
**e** WebRTC), e expõe uma API HTTP com streaming de Range. O frontend só
consome a API e põe o `streamUrl` num `<video>`/`<audio>`.

## Stack

### Frontend (`/`)

- [Vite](https://vite.dev) + [React 19](https://react.dev) + TypeScript
- [Tailwind CSS 4](https://tailwindcss.com)
- `EventSource` (Server-Sent Events) para stats em tempo real

### Backend (`/server`)

- [Node.js](https://nodejs.org) + [Express 5](https://expressjs.com)
- [WebTorrent 2.x](https://webtorrent.io) (modo Node — suporta TCP, uTP,
  WebRTC e DHT nativamente)
- [multer](https://github.com/expressjs/multer) para upload de `.torrent`
- [cors](https://github.com/expressjs/cors) para permitir o frontend em
  outra origem

## Como rodar (dev)

```bash
# Instalar deps do frontend e do backend
npm install
npm --prefix server install

# Terminal 1 — backend
npm --prefix server run dev          # http://localhost:8787

# Terminal 2 — frontend
npm run dev                          # http://localhost:5173
```

O frontend detecta automaticamente o backend local quando rodando em
`localhost:5173`. Em produção ou outros hosts, defina
`VITE_API_BASE=https://seu-backend.example.com` no build do frontend.

## API

Todas as rotas estão sob `/api`.

| Método | Rota                                   | Descrição                                        |
| ------ | -------------------------------------- | ------------------------------------------------ |
| GET    | `/api/health`                          | Health check + nº de torrents ativos             |
| GET    | `/api/torrents`                        | Lista torrents ativos                            |
| POST   | `/api/torrents`                        | Adiciona por magnet (`{ "magnet": "..." }`)      |
| POST   | `/api/torrents/file`                   | Adiciona via upload (`multipart`, campo `torrent`) |
| GET    | `/api/torrents/:infoHash`              | Metadados + stats                                |
| GET    | `/api/torrents/:infoHash/events`       | SSE com stats a cada 1s                          |
| GET    | `/api/torrents/:infoHash/files/:path*` | Streaming HTTP Range do arquivo                  |
| DELETE | `/api/torrents/:infoHash`              | Remove o torrent (e limpa o chunk store)         |

Variáveis de ambiente do backend:

| Variável       | Default   | Descrição                                  |
| -------------- | --------- | ------------------------------------------ |
| `PORT`         | `8787`    | Porta HTTP                                 |
| `HOST`         | `0.0.0.0` | Host de bind                               |
| `CORS_ORIGINS` | `*`       | Lista separada por vírgula (ou `*` livre)  |

## Build de produção

```bash
# Frontend → gera ./dist
npm run build

# Backend → compila TypeScript para ./server/dist
npm --prefix server run build
npm --prefix server start
```

Pra servir o frontend pelo próprio backend (single-process deploy), basta
colocar um reverse proxy ou adicionar `express.static('dist')` no
`server/src/index.ts`. Como está, o backend só serve a API — ideal pra
hospedagens separadas (frontend na Vercel/Netlify, backend num Fly.io /
Railway / VPS).

## Limitações / Considerações

- **Servidor único compartilhado**: todas as sessões de usuário
  compartilham o mesmo processo/cliente WebTorrent. Isso é intencional
  pra o servidor continuar seedando arquivos já baixados, mas não escala
  pra multi-tenant sem cuidados adicionais (rate-limiting, quotas).
- **Storage em memória**: o chunk store padrão do WebTorrent mantém
  os pedaços baixados em RAM. Torrents muito grandes podem estourar
  memória. Pra produção séria, trocar pro chunk store em disco.
- **Legal**: torrents compartilhados pelo backend contam como atividade
  do próprio servidor. Avalie caso de uso antes de hospedar publicamente.

## Teste rápido

```bash
# 1. Sobe o backend e o frontend (dev)
npm --prefix server run dev &
npm run dev

# 2. Abra http://localhost:5173 e clique em "carregar Sintel (magnet)"
```
