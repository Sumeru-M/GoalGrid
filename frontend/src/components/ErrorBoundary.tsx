import { Component, type ReactNode } from "react";

/**
 * Last-resort guard. A render-time exception anywhere in the tree would
 * otherwise blank the whole screen; here we catch it and offer a reload so the
 * user is never left staring at a white void.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.error("[ui] render error", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="app-frame">
          <div className="screen">
            <div className="empty" style={{ paddingTop: 80 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
              <div style={{ color: "var(--text)", fontWeight: 600, marginBottom: 6 }}>Something broke</div>
              <div style={{ marginBottom: 20 }}>{this.state.error.message}</div>
              <button className="btn" onClick={() => window.location.reload()}>Reload</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
