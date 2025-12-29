import React from "react";
import { AlertTriangle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TripLocationData = {
  originLat?: number | null;
  originLng?: number | null;
  destinationLat?: number | null;
  destinationLng?: number | null;
  currentLat?: number | null;
  currentLng?: number | null;
};

type MapErrorBoundaryProps = {
  children: React.ReactNode;
  context?: Record<string, unknown>;
  className?: string;
  onClose?: () => void;
  tripData?: TripLocationData;
};

type MapErrorBoundaryState = {
  hasError: boolean;
  error?: Error;
};

/**
 * Builds a Google Maps directions URL from trip location data.
 */
function buildGoogleMapsUrl(data: TripLocationData): string | null {
  const { originLat, originLng, destinationLat, destinationLng, currentLat, currentLng } = data;

  // Priority: Use current position as origin if available, otherwise use trip origin
  const startLat = currentLat ?? originLat;
  const startLng = currentLng ?? originLng;

  // Must have at least a destination to be useful
  const hasDestination = destinationLat != null && destinationLng != null;
  const hasStart = startLat != null && startLng != null;

  if (!hasDestination) {
    // If only start is available, open a simple location view
    if (hasStart) {
      return `https://www.google.com/maps?q=${startLat},${startLng}`;
    }
    return null;
  }

  if (hasStart) {
    // Full directions: start → destination
    return `https://www.google.com/maps/dir/${startLat},${startLng}/${destinationLat},${destinationLng}`;
  }

  // Only destination available
  return `https://www.google.com/maps?q=${destinationLat},${destinationLng}`;
}

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

  private handleOpenGoogleMaps = () => {
    const { tripData } = this.props;
    if (!tripData) return;

    const url = buildGoogleMapsUrl(tripData);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  render() {
    if (this.state.hasError) {
      const { tripData } = this.props;
      const googleMapsUrl = tripData ? buildGoogleMapsUrl(tripData) : null;

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
                Se detectó un error al renderizar el mapa. Puedes reintentar o ver la ruta en Google Maps.
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
                {googleMapsUrl && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={this.handleOpenGoogleMaps}
                    className="gap-1.5"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir en Google Maps
                  </Button>
                )}
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
