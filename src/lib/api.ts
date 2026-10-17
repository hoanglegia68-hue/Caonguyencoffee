export type ApiPayload = Record<string, unknown>

const directUrl = import.meta.env.VITE_APPS_SCRIPT_URL as string | undefined
const endpoint = directUrl || '/api/apps-script'

export class ApiError extends Error {
  constructor(message: string, public readonly offline = false) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function apiRequest<T = unknown>(action: string, payload: ApiPayload = {}): Promise<T> {
  if (!directUrl && !import.meta.env.VITE_API_PROXY_ENABLED && window.location.hostname === 'localhost') {
    throw new ApiError('Chưa cấu hình Apps Script API. Vui lòng thiết lập VITE_APPS_SCRIPT_URL hoặc APPS_SCRIPT_URL.', true)
  }

  const url = directUrl ? `${endpoint}?action=${encodeURIComponent(action)}` : endpoint
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...payload }),
  })

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
