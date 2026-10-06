import express, { type NextFunction, type Request, type Response } from 'express'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { NotFoundError, ValidationError, db, dbPath } from './db'

const PORT = Number(process.env.PORT ?? 3002)
const app = express()
app.use(express.json({ limit: '1mb' }))

const wrap =
  (fn: (req: Request, res: Response) => Promise<unknown>) => (req: Request, res: Response, next: NextFunction) =>
    fn(req, res).catch(next)

const idOf = (req: Request) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) throw new ValidationError('ID inválido')
  return id
}

// Todas as rotas devolvem o estado completo ({ settings, editais }).
app.get('/api/state', wrap(async (_req, res) => res.json(await db.getState())))
app.put('/api/settings', wrap(async (req, res) => res.json(await db.saveSettings(req.body))))
app.post('/api/editais', wrap(async (req, res) => res.status(201).json(await db.createEdital(req.body))))
app.put('/api/editais/:id', wrap(async (req, res) => res.json(await db.updateEdital(idOf(req), req.body))))
app.post('/api/editais/:id/retifs', wrap(async (req, res) => res.status(201).json(await db.addRetif(idOf(req), req.body))))

// Em produção (npm run build && npm start) a própria API serve o front-end.
const dist = path.resolve(process.cwd(), 'dist')
if (existsSync(dist)) {
  app.use(express.static(dist))
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')))
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof ValidationError) return void res.status(400).json({ error: err.message })
  if (err instanceof NotFoundError) return void res.status(404).json({ error: err.message })
  console.error('[api]', err)
  res.status(500).json({ error: 'Erro interno no servidor' })
})

app.listen(PORT, () => {
  console.log(`[api] Editais Chevomais em http://localhost:${PORT}`)
  console.log(`[db]  dados em ${dbPath}`)
})
