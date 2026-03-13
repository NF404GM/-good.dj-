
import React from 'react';

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends React.Component<
    { children: React.ReactNode },
    ErrorBoundaryState
> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('good.DJ Error Boundary:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="w-screen h-screen bg-canvas flex items-center justify-center font-mono">
                    <div className="max-w-md text-center flex flex-col items-center gap-4">
                        <div className="w-2 h-2 rounded-full bg-signal-clipping animate-pulse" />
                        <h2 className="text-sm font-bold text-text-primary tracking-widest">
                            SYSTEM FAULT
                        </h2>
                        <p className="text-[10px] text-text-secondary leading-relaxed">
                            An unexpected error occurred. Reload to restore.
                        </p>
                        <code className="text-[9px] text-text-data bg-surface-idle border border-white/10 px-3 py-2 rounded-sm max-w-full overflow-auto text-left block">
                            {this.state.error?.message || 'Unknown Error'}
                        </code>
                        <button
                            onClick={() => window.location.reload()}
                            className="px-4 py-1.5 bg-text-primary text-canvas text-[10px] font-bold tracking-wider rounded-sm hover:bg-white transition-colors"
                        >
                            RELOAD
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
