import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: { componentStack?: string }) {
    this.setState({
      error,
      errorInfo: errorInfo.componentStack || '无组件堆栈信息',
    });
    console.error('页面渲染错误:', error, errorInfo);
  }

  handleReload = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
          <div className="max-w-lg w-full bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-2xl">⚠️</span>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">页面出错了</h2>
                <p className="text-sm text-gray-500">测试阶段，请截图反馈给开发者</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-red-700 mb-1">错误信息</p>
                <p className="text-sm text-red-900 font-mono break-all">
                  {this.state.error?.message || '未知错误'}
                </p>
              </div>

              {this.state.error?.name && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-gray-600 mb-1">错误类型</p>
                  <p className="text-sm text-gray-800 font-mono">{this.state.error.name}</p>
                </div>
              )}

              {this.state.errorInfo && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-gray-600 mb-1">组件堆栈</p>
                  <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap">
                    {this.state.errorInfo}
                  </pre>
                </div>
              )}

              {this.state.error?.stack && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-gray-600 mb-1">错误堆栈</p>
                  <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap">
                    {this.state.error.stack}
                  </pre>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={this.handleReload}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                返回首页
              </button>
              <button
                onClick={() => window.location.reload()}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold py-3 px-4 rounded-lg transition-colors"
              >
                刷新页面
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
