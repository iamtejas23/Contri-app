import process from 'node:process'

const DEFAULT_ORIGINS = new Set([
  'https://contri-app.vercel.app',
  'capacitor://localhost',
  'https://localhost',
  'http://localhost',
  'http://localhost:5173',
])

const allowedOrigins = () => new Set([
  ...DEFAULT_ORIGINS,
  ...(process.env.APP_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean),
])

export const setCors = (req, res) => {
  const origin = req.headers?.origin
  if (origin && allowedOrigins().has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
    res.setHeader('Access-Control-Max-Age', '600')
  }
  res.setHeader('Cache-Control', 'no-store, private')
}

export const respond = (res, status, body) => {
  res.status(status).json(body)
}

export const readJsonBody = (req) => {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') return JSON.parse(req.body)
  return {}
}

export const methodNotAllowed = (res) => respond(res, 405, { error: 'Method not allowed.' })

export const handleOptions = (req, res) => {
  setCors(req, res)
  res.status(204).end()
}
