import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'Đã xảy ra lỗi không mong muốn.' };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F2EA] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#FFFDF9] border border-[#E6DED3] rounded-xl p-8 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-[#A65F3B]/15 text-[#A65F3B] flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-serif-display font-semibold text-[#171512] mb-2">
              Đã xảy ra sự cố hiển thị
            </h1>
            <p className="text-sm text-[#777067] mb-6 leading-relaxed">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#4A2E24] text-[#FFFDF9] text-sm font-medium hover:bg-[#3A231B] transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Quay về Trang chủ
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
