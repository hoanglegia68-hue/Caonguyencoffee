export default async function handler(request, response) {
  const appsScriptUrl = process.env.APPS_SCRIPT_URL
  if (!appsScriptUrl) {
    response.status(500).json({ success: false, error: 'Thiếu biến môi trường APPS_SCRIPT_URL trên Vercel.' })
    return
  }

  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
    response.status(405).json({ success: false, error: 'Chỉ hỗ trợ POST.' })
    return
  }

  try {
    const target = new URL(appsScriptUrl)
    if (target.hostname !== 'script.google.com' || !/^\/macros\/s\/[^/]+\/exec$/.test(target.pathname)) {
      response.status(500).json({ success: false, error: 'APPS_SCRIPT_URL không hợp lệ.' })
      return
    }

    const headers = request.headers || {}
    const contentLength = Number(headers['content-length'] || headers['Content-Length'] || 0)
    if (contentLength > 8 * 1024 * 1024) {
      response.status(413).json({ success: false, error: 'Request quá lớn.' })
      return
    }

    const body = typeof request.body === 'string' ? request.body : JSON.stringify(request.body || {})
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 25000)
    let upstream
    try {
      upstream = await fetch(target, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, signal: controller.signal })
    } finally {
      clearTimeout(timeoutId)
    }
    const text = await upstream.text()
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.status(upstream.status).setHeader('Content-Type', 'application/json').send(text)
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError' ? 'Apps Script phản hồi quá thời gian.' : 'Không thể kết nối Apps Script.'
    response.status(502).json({ success: false, error: message })
  }
}
