import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  public state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    let readable = error.message || 'একটি অপ্রত্যাশিত ত্রুটি ঘটেছে।';
    try {
      const parsed = JSON.parse(error.message) as {
        error?: string;
        operationType?: string;
        path?: string;
      };
      if (parsed && parsed.error) {
        if (parsed.error.includes('Quota exceeded')) {
          readable =
            'দৈনিক ফ্রি ডাটাবেজ কোটা পূর্ণ হয়েছে (Quota exceeded)। আগামীকাল কোটা পুনরায় রিসেট হবে।';
        } else if (parsed.error.includes('Missing or insufficient permissions')) {
          readable = `অনুমোদনের সীমাবদ্ধতা (${parsed.operationType || 'access'} on ${parsed.path || 'record'})। অনুগ্রহ করে ভেরিফাইড একাউন্টে লগইন করা আছে কিনা নিশ্চিত করুন।`;
        } else {
          readable = parsed.error;
        }
      }
    } catch {
      // Standard error string
    }
    return { hasError: true, errorMessage: readable };
  }

  public componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info);
  }

  public render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#f4f8f6] flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white border border-slate-200 rounded-xl p-6 shadow-sm text-center">
            <h1 className="text-xl font-bold text-slate-900 mb-2">পৃষ্ঠাটি লোড করতে সমস্যা হয়েছে</h1>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">{this.state.errorMessage}</p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.href = '/';
              }}
              className="px-5 py-2.5 bg-[#146c43] hover:bg-[#0f5435] text-white text-sm font-semibold rounded-lg transition-colors cursor-pointer"
            >
              হোমপেজে ফিরে যান
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
