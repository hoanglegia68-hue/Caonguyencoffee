import { Component, ReactNode, StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return <main className="error-screen"><div className="error-card"><strong>Không thể hiển thị dữ liệu</strong><span>Vui lòng tải lại trang. Nếu lỗi tiếp tục, hãy kiểm tra deployment Apps Script và thử lại.</span><button className="primary-button" onClick={() => window.location.reload()}>Tải lại trang</button></div></main>
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
