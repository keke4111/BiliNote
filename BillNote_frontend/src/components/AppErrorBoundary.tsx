import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  resetKey?: string
}

interface State {
  error: Error | null
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null,
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('App render error:', error, errorInfo)
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (!this.state.error) {
      return this.props.children
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-white px-6 text-neutral-900">
        <div className="max-w-xl rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm">
          <h1 className="text-lg font-semibold text-red-700">前端页面渲染失败</h1>
          <p className="mt-2 text-sm text-red-600">
            {this.state.error.message || '未知错误，请查看浏览器控制台。'}
          </p>
          <button
            className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
            onClick={() => window.location.reload()}
            type="button"
          >
            刷新页面
          </button>
        </div>
      </div>
    )
  }
}
