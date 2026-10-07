/**
 * API do Editais Chevomais em Node puro (node:http) — sem dependências.
 * Em produção (npm run build && npm start) também serve o front-end da pasta dist/.
 *
 * Variáveis de ambiente:
 *   PORT=3001            porta
 *   HOST=0.0.0.0         0.0.0.0 = acessível por outros computadores da rede; 127.0.0.1 = só este computador
 *   COOKIE_SECURE=1      marca o cookie de sessão como Secure (use se publicar atrás de HTTPS)
 *   DATA_DIR=./data      pasta do db.json
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import path from 'node:path'
import { AuthError, ConflictError, ForbiddenError, NotFoundError, ValidationError, db, dbPath, type UserRecord } from './db'

const PORT = Number(process.env.PORT ?? 3001)
const HOST = process.env.HOST ?? '0.0.0.0'
const SECURE = process.env.COOKIE_SECURE === '1'
const COOKIE = 'es_session'
const SESSION_SECONDS = 30 * 24 * 3600
const MAX_BODY = 1_000_000
const DIST = path.resolve(process.cwd(), 'dist')

class TooManyRequests extends Error {}

// ---------- cookies ----------
function getCookie(req: IncomingMessage, name: string): string | null {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim())
      } catch {
        return null
      }
    }
  }
  return null
}

const sessionCookie = (token: string, maxAge = SESSION_SECONDS) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${SECURE ? '; Secure' : ''}`

// ---------- proteção contra tentativas de senha ----------
const WINDOW_MS = 15 * 60_000
const attempts = new Map<string, { n: number; t: number }>()
function blocked(key: string, max: number): boolean {
  const a = attempts.get(key)
  if (!a) return false
  if (Date.now() - a.t > WINDOW_MS) {
    attempts.delete(key)
    return false
  }
  return a.n >= max
}
function registerFail(key: string): void {
  const a = attempts.get(key)
  if (!a || Date.now() - a.t > WINDOW_MS) attempts.set(key, { n: 1, t: Date.now() })
  else a.n++
  if (attempts.size > 5000) attempts.clear()
}

// ---------- rotas ----------
interface Ctx {
  req: IncomingMessage
  url: URL
  body: any
  user: UserRecord | null
  token: string | null
}
interface Reply {
  status?: number
  body: unknown
  cookie?: string
}
const routes: Array<{ method: string; re: RegExp; auth: boolean; run: (c: Ctx, m: RegExpMatchArray) => Promise<Reply> }> = []
const route = (method: string, re: RegExp, auth: boolean, run: (c: Ctx, m: RegExpMatchArray) => Promise<Reply>) =>
  routes.push({ method, re, auth, run })

// autenticação
route('GET', /^\/api\/auth\/status$/, false, async (c) => ({ body: await db.authStatus(c.user) }))

route('POST', /^\/api\/auth\/setup$/, false, async (c) => {
  const { token, user } = await db.setup(c.body)
  return { status: 201, cookie: sessionCookie(token), body: { needsSetup: false, user } }
})

route('POST', /^\/api\/auth\/login$/, false, async (c) => {
  const ip = c.req.socket.remoteAddress ?? '?'
  const login = typeof c.body?.usuario === 'string' ? c.body.usuario.trim().toLowerCase() : ''
  const kIp = `ip:${ip}`
  const kUser = `u:${ip}|${login}`
  if (blocked(kIp, 30) || blocked(kUser, 8)) throw new TooManyRequests('Muitas tentativas de login. Aguarde alguns minutos e tente de novo.')
  try {
    const { token, user } = await db.login(c.body)
    attempts.delete(kUser)
    return { cookie: sessionCookie(token), body: { needsSetup: false, user } }
  } catch (e) {
    if (e instanceof AuthError) {
      registerFail(kIp)
      registerFail(kUser)
    }
    throw e
  }
})

route('POST', /^\/api\/auth\/logout$/, false, async (c) => {
  if (c.token) await db.logout(c.token)
  return { cookie: sessionCookie('', 0), body: { ok: true } }
})

// estado (tudo que a tela precisa) — `?since=<rev>` devolve só { unchanged: true } se nada mudou
route('GET', /^\/api\/state$/, true, async (c) => {
  const s = c.url.searchParams.get('since')
  const since = s !== null && /^\d+$/.test(s) ? Number(s) : undefined
  return { body: await db.getState(c.user!, since) }
})

// perfil
route('PUT', /^\/api\/me$/, true, async (c) => ({ body: await db.updateMe(c.user!, c.body) }))
route('POST', /^\/api\/me\/password$/, true, async (c) => {
  await db.changePassword(c.user!, c.body, c.token!)
  return { body: { ok: true } }
})

// usuários (somente administradores — conferido no db.ts)
route('POST', /^\/api\/users$/, true, async (c) => ({ status: 201, body: await db.createUser(c.user!, c.body) }))
route('PUT', /^\/api\/users\/(\d+)$/, true, async (c, m) => ({ body: await db.updateUser(c.user!, Number(m[1]), c.body) }))
route('DELETE', /^\/api\/users\/(\d+)$/, true, async (c, m) => ({ body: await db.deleteUser(c.user!, Number(m[1])) }))

// editais
route('POST', /^\/api\/editais$/, true, async (c) => ({ status: 201, body: await db.createEdital(c.user!, c.body) }))
route('POST', /^\/api\/editais\/delete$/, true, async (c) => ({
  body: await db.deleteEditais(c.user!, Array.isArray(c.body?.ids) ? c.body.ids : []),
}))
route('PUT', /^\/api\/editais\/(\d+)$/, true, async (c, m) => ({ body: await db.updateEdital(c.user!, Number(m[1]), c.body) }))
route('POST', /^\/api\/editais\/(\d+)\/retifs$/, true, async (c, m) => ({
  status: 201,
  body: await db.addRetif(c.user!, Number(m[1]), c.body),
}))
route('DELETE', /^\/api\/editais$/, true, async (c) => ({ body: await db.clearAll(c.user!) }))

// ---------- HTTP ----------
function send(res: ServerResponse, status: number, body: unknown, cookie?: string): void {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    ...(cookie ? { 'Set-Cookie': cookie } : {}),
  })
  res.end(data)
}

function sendError(res: ServerResponse, e: unknown): void {
  if (e instanceof ValidationError) return send(res, 400, { error: e.message })
  if (e instanceof AuthError) return send(res, 401, { error: e.message })
  if (e instanceof ForbiddenError) return send(res, 403, { error: e.message })
  if (e instanceof NotFoundError) return send(res, 404, { error: e.message })
  if (e instanceof ConflictError) return send(res, 409, { error: e.message })
  if (e instanceof TooManyRequests) return send(res, 429, { error: e.message })
  console.error('[api]', e)
  send(res, 500, { error: 'Erro interno no servidor' })
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (ch: Buffer) => {
      size += ch.length
      if (size > MAX_BODY) {
        reject(new ValidationError('Requisição muito grande'))
        req.destroy()
      } else chunks.push(ch)
    })
    req.on('end', () => {
      if (!size) return resolve({})
      // exigir JSON barra formulários de outros sites (CSRF) além do SameSite=Lax do cookie
      if (!String(req.headers['content-type'] ?? '').includes('application/json')) {
        return reject(new ValidationError('Content-Type deve ser application/json'))
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new ValidationError('JSON inválido'))
      }
    })
    req.on('error', reject)
  })
}

async function handleApi(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  try {
    const found = routes.find((r) => r.method === req.method && r.re.test(url.pathname))
    if (!found) {
      const pathExists = routes.some((r) => r.re.test(url.pathname))
      return send(res, pathExists ? 405 : 404, { error: pathExists ? 'Método não permitido' : 'Rota não encontrada' })
    }
    const body = req.method === 'GET' ? {} : await readBody(req)
    const token = getCookie(req, COOKIE)
    const user = await db.userFromToken(token)
    if (found.auth && !user) throw new AuthError('Faça login para continuar')
    const reply = await found.run({ req, url, body, user, token }, url.pathname.match(found.re)!)
    send(res, reply.status ?? 200, reply.body, reply.cookie)
  } catch (e) {
    sendError(res, e)
  }
}

// ---------- front-end compilado (produção) ----------
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

async function serveStatic(req: IncomingMessage, res: ServerResponse, pathname: string): Promise<void> {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405)
    return void res.end()
  }
  let rel: string
  try {
    rel = decodeURIComponent(pathname)
  } catch {
    res.writeHead(400)
    return void res.end()
  }
  let file = path.normalize(path.join(DIST, rel))
  if (file !== DIST && !file.startsWith(DIST + path.sep)) {
    res.writeHead(403)
    return void res.end()
  }
  let st = await stat(file).catch(() => null)
  if (!st || st.isDirectory()) {
    file = path.join(DIST, 'index.html') // rotas do front-end caem no index.html
    st = await stat(file).catch(() => null)
  }
  if (!st) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    return void res.end('Front-end não compilado. Rode "npm run build" e depois "npm start" (ou use "npm run dev").')
  }
  const isIndex = path.basename(file) === 'index.html'
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream',
    'Content-Length': st.size,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Cache-Control': isIndex ? 'no-cache' : 'public, max-age=31536000, immutable',
  })
  if (req.method === 'HEAD') return void res.end()
  createReadStream(file).pipe(res)
}

const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const run = url.pathname.startsWith('/api/') ? handleApi(req, res, url) : serveStatic(req, res, url.pathname)
  run.catch((e) => {
    console.error('[http]', e)
    if (!res.headersSent) res.writeHead(500)
    res.end()
  })
})

server.on('error', (e: NodeJS.ErrnoException) => {
  if (e.code === 'EADDRINUSE') console.error(`[api] A porta ${PORT} já está em uso. Feche o outro programa ou use PORT=<outra porta>.`)
  else console.error('[api]', e)
  process.exit(1)
})

server.listen(PORT, HOST, () => {
  console.log(`[api] Editais Chevomais rodando na porta ${PORT}`)
  console.log(`      Neste computador: http://localhost:${PORT}`)
  if (HOST === '0.0.0.0') {
    for (const n of Object.values(networkInterfaces()).flat()) {
      if (n && n.family === 'IPv4' && !n.internal) console.log(`      Na rede:          http://${n.address}:${PORT}`)
    }
  }
  console.log(`[db]  dados em ${dbPath}`)
})
