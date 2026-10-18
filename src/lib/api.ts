export type ApiPayload = Record<string, unknown>

export type SessionUser = {
  user_id: string
  username?: string
  full_name: string
  email?: string
  role: string
  phone?: string
  active?: boolean | string
}

export type AuthSession = {
  token: string
  user: SessionUser
}

const directUrl = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined
const endpoint = directUrl || '/api/apps-script'
const SESSION_KEY = 'cao_nguyen_vina_coffee_session'

export class ApiError extends Error {
  constructor(message: string, public readonly offline = false) {
    super(message)
    this.name = 'ApiError'
  }
}

export function getStoredSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY)
    return raw ? JSON.parse(raw) as AuthSession : null
  } catch (_) {
    return null
  }
}

export function storeSession(session: AuthSession) {
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearStoredSession() {
  window.localStorage.removeItem(SESSION_KEY)
}

export async function loginWithPassword(username: string, password: string) {
  const session = await apiRequest<AuthSession>('login', { username, password })
  storeSession(session)
  return session
}

export async function apiRequest<T = unknown>(action: string, payload: ApiPayload = {}): Promise<T> {
  if (!directUrl && !import.meta.env.VITE_API_PROXY_ENABLED && window.location.hostname === 'localhost') {
    throw new ApiError('Chưa cấu hình Apps Script API. Vui lòng thiết lập VITE_APPS_SCRIPT_URL hoặc APPS_SCRIPT_URL.', true)
  }

  const url = directUrl ? `${endpoint}?action=${encodeURIComponent(action)}` : endpoint
  const session = getStoredSession()
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), 20000)
  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...payload, ...(session?.token ? { session_token: session.token } : {}) }),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Kết nối API quá thời gian. Vui lòng kiểm tra mạng và thử lại.', true)
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }

  if (!response.ok) {
    throw new ApiError(`API trả về lỗi HTTP ${response.status}`)
  }

  const result = await response.json() as { success?: boolean; data?: T; error?: string }
  if (result.success === false) throw new ApiError(result.error || 'Không thể hoàn thành yêu cầu API')
  return (result.data ?? result) as T
}

export async function fileToCompressedDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const maxSize = 1600
  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Không thể xử lý hình ảnh')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return canvas.toDataURL('image/jpeg', 0.78)
}
