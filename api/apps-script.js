export default async function handler(request, response) {
  const appsScriptUrl = process.env.APPS_SCRIPT_URL
  if (!appsScriptUrl) {
    response.status(500).json({ success: false, error: 'Thiếu biến môi trường APPS_SCRIPT_URL trên Vercel.' })
    return
  }

  try {
    const method = request.method === 'GET' ? 'GET' : 'POST'
    const target = new URL(appsScriptUrl)
    let body
    if (method === 'GET') {
      const query = request.query || {}
      Object.entries(query).forEach(([key, value]) => target.searchParams.set(key, String(value)))
      body = undefined
    } else {
      body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {})
    }
    const upstream = await fetch(target, { method, headers: { 'Content-Type': 'application/json' }, body })
    const text = await upstream.text()
    response.status(upstream.status).setHeader('Content-Type', 'application/json').send(text)
  } catch (error) {
    response.status(502).json({ success: false, error: error instanceof Error ? error.message : 'Không thể kết nối Apps Script.' })
  }
}
