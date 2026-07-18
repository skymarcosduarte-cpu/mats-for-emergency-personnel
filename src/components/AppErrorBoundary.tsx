import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  info: string | null;
}

/**
 * Global error boundary — replaces post-splash blank screens with a
 * visible fallback that shows the actual error and offers recovery actions.
 * Also logs the raw Error (with stack) so it shows up in the diagnostic logs.
 */
export class AppErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Preserve full stack in Server/console logs.
    console.error("[AppErrorBoundary] Render crashed:", error);
    console.error("[AppErrorBoundary] Component stack:", info.componentStack);
    this.setState({ error, info: info.componentStack ?? null });

    // Hide native splash if it is still visible (would otherwise cover the fallback).
    try {
      (window as unknown as { hideNativeSplash?: () => void }).hideNativeSplash?.();
    } catch {
      /* noop */
    }
  }

  handleReload = () => {
    window.location.href = window.location.origin + "?v=" + Date.now();
  };

  handleHardReset = async () => {
    try {
      if ("caches" in window) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch {
        /* noop */
      }
    } catch (e) {
      console.warn("[AppErrorBoundary] Hard reset error:", e);
    } finally {
      window.location.href = window.location.origin + "?v=" + Date.now();
    }
  };

  render() {
    if (!this.state.error) return this.props.children;

    const message = this.state.error.message || String(this.state.error);

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 2147483647,
          background: "#0a0a0a",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          fontFamily:
            'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          overflow: "auto",
        }}
        role="alert"
      >
        <div style={{ maxWidth: 520, width: "100%" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, marginBottom: 8 }}>
            La app no pudo iniciar
          </h1>
          <p style={{ color: "#c9c9c9", margin: 0, marginBottom: 16, lineHeight: 1.4 }}>
            Detectamos un error al cargar. Intenta recargar; si continúa, usa
            "Limpiar y recargar" para forzar la actualización.
          </p>
          <div
            style={{
              background: "#1a1a1a",
              border: "1px solid #2a2a2a",
              borderRadius: 8,
              padding: 12,
              fontFamily: '"JetBrains Mono", ui-monospace, monospace',
              fontSize: 12,
              color: "#ff9a9a",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 180,
              overflow: "auto",
              marginBottom: 16,
            }}
          >
            {message}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={this.handleReload}
              style={{
                background: "#22c55e",
                color: "#0a0a0a",
                border: "none",
                borderRadius: 8,
                padding: "12px 18px",
                fontWeight: 700,
                fontSize: 15,
                cursor: "pointer",
                flex: 1,
                minWidth: 140,
              }}
            >
              Recargar
            </button>
            <button
              onClick={this.handleHardReset}
              style={{
                background: "transparent",
                color: "#fff",
                border: "1px solid #444",
                borderRadius: 8,
                padding: "12px 18px",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
                flex: 1,
                minWidth: 140,
              }}
            >
              Limpiar y recargar
            </button>
          </div>
        </div>
      </div>
    );
  }
}