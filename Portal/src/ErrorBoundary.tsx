import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', color: '#ffadad', backgroundColor: '#330000', minHeight: '100vh' }}>
                    <h1>Unable to Render Application</h1>
                    <p>An error occurred while loading. Please see details below:</p>
                    <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', background: 'rgba(0,0,0,0.5)', padding: '1rem' }}>
                        {this.state.error?.toString()}
                    </pre>
                    <p>Common causes:</p>
                    <ul>
                        <li>Missing Environment Variables (.env)</li>
                        <li>Firebase Configuration Errors</li>
                    </ul>
                </div>
            );
        }

        return this.props.children;
    }
}
