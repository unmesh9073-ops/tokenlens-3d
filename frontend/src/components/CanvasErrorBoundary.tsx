import { AlertTriangle, RotateCcw } from 'lucide-react'
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  errorMessage: string
}

export class CanvasErrorBoundary extends Component<Props, State> {
  state: State = {
    hasError: false,
    errorMessage: '',
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'WebGL 3D stage encountered an unexpected error.',
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('3D Stage Error:', error, info)
  }

  handleReload = () => {
    this.setState({ hasError: false, errorMessage: '' })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-[#06070B] p-6">
          <div className="glass-panel-heavy max-w-md rounded-3xl p-6 text-center">
            <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-400/15 text-amber-300 ring-1 ring-amber-400/30">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <h2 className="text-[16px] font-semibold text-white">
              3D Stage Needs a Refresh
            </h2>
            <p className="mt-1.5 text-[12px] leading-relaxed text-white/65">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={this.handleReload}
              className="pressable mt-4 inline-flex items-center gap-1.5 rounded-full bg-sky-400/20 px-4 py-2 text-[12px] font-semibold text-sky-200 ring-1 ring-sky-400/40 hover:bg-sky-400/30"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reload 3D Stage
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
