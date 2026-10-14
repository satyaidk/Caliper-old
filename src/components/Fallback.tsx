import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Failure states are directions, not apologies. Both of these tell the person
 * what happened, what it means, and the one thing worth trying next — and the
 * boundary keeps the real error on screen rather than only in a console they
 * are not looking at.
 */

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Caliper stopped:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="fallback" role="alert">
        <div className="fallback-card">
          <p className="eyebrow">Something stopped</p>
          <h1>Caliper hit an error it could not recover from.</h1>
          <p>
            Reloading clears it. If the same file causes it every time, that file is the thing to
            report.
          </p>
          <pre className="fallback-detail">{error.message}</pre>
          <button className="btn" data-variant="primary" onClick={() => window.location.reload()}>
            Reload the page
          </button>
        </div>
      </div>
    );
  }
}

/** Shown instead of the app when the browser cannot give us a GPU context. */
export function NoWebGL() {
  return (
    <div className="fallback" role="alert">
      <div className="fallback-card">
        <p className="eyebrow">WebGL unavailable</p>
        <h1>This browser will not open a 3D context.</h1>
        <p>
          Caliper renders on the GPU and has no software fallback. Hardware acceleration is usually
          the setting that turns this back on; on older machines a different browser may be the
          faster route.
        </p>
      </div>
    </div>
  );
}

export { hasWebGL } from '@/lib/webgl';
