import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  errorDetail: string;
}

/**
 * Error boundary for rocketry physics simulations and thrust curve canvas visualizers.
 */
export class PhysicsErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    errorDetail: ''
  };

  public static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorDetail: error.message || 'Numerical physics calculation error.'
    };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('PhysicsErrorBoundary captured exception:', error, errorInfo);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, errorDetail: '' });
  };

  public override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="w-full p-4 border border-blue-500/30 bg-black/80 rounded-xl text-white font-mono text-xs">
          <div className="flex items-center space-x-2 text-blue-400 font-bold mb-1">
            <span>[SIM_ERROR]</span>
            <span>{this.props.fallbackMessage || 'Flight Dynamics Solver Stalled'}</span>
          </div>
          <p className="text-gray-400 mb-3">{this.state.errorDetail}</p>
          <button
            onClick={this.handleRetry}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs uppercase tracking-wider"
          >
            Reinitialize Integrator
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
