

## Problem

The map is showing **"Zoom Level Not Supported"** errors on RainViewer tile layers. While the OWM layers already have `maxNativeZoom: 9` set, all four RainViewer tile layers (radar, satellite IR, nowcast, and satellite cloud mode) are missing this constraint.

RainViewer tiles support up to approximately zoom level 12. When the user zooms beyond that, the tiles fail.

## Plan

Add `maxNativeZoom: 12, maxZoom: 18` to all RainViewer `L.tileLayer()` calls in `src/components/LiveEventsMapView.tsx`:

1. **Line ~338** — Radar frame layer (`showRadarFrame`)
2. **Line ~384** — Satellite IR layer (`setupRadarLayer`)
3. **Line ~407** — Nowcast layer (`setupRadarLayer`)
4. **Line ~662** — Satellite cloud mode layer (Nubes toggle)

This will make Leaflet scale the zoom-12 tiles visually instead of requesting unsupported zoom levels, eliminating the error overlays.

