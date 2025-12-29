import React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MapErrorBoundaryProps = {
  children: React.ReactNode;
  context?: Record<string, unknown>;
  className?: string;
  onClose?: () => void;
};

type MapErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

export default class MapErrorBoundary extends React.Component<
  MapErrorBoundaryProps,
  MapErrorBoundaryState
> {
  state: MapErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): MapErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[MapErrorBoundary] Map render error", {
      context: this.props.context,
      error,
      componentStack: info.componentStack,
    });
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={cn(
            "rounded-lg border border-border bg-muted/40 p-4",
            this.props.className
          )}
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 rounded-full bg-destructive/10 p-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">
                No se pudo cargar el mapa
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Se detectó un error al renderizar el mapa. Puedes reintentar o cerrar.
              </p>

              {this.state.error?.message && (
                <pre className="mt-3 max-h-24 overflow-auto rounded bg-background/60 p-2 text-[10px] text-muted-foreground">
                  {this.state.error.message}
                </pre>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={this.handleRetry}>
                  Reintentar
                </Button>
                {this.props.onClose && (
                  <Button variant="secondary" size="sm" onClick={this.props.onClose}>
                    Cerrar
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
