import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import L from 'leaflet';
import { GPSCoordinate, LocationHistoryItem } from '../types/gps';
import { calculateDistanceMeters } from '../utils/geoUtils';
import { Layers, Maximize2, Minimize2, Navigation, Compass, MapPin } from 'lucide-react';

export interface MapHandle {
  centerOnMarker: () => void;
  openPopup: () => void;
}

interface LiveLeafletMapProps {
  currentLocation: GPSCoordinate | null;
  history: LocationHistoryItem[];
  isStale: boolean;
  onCenterRequested?: () => void;
}

export const LiveLeafletMap = forwardRef<MapHandle, LiveLeafletMapProps>(({
  currentLocation,
  history,
  isStale,
}, ref) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const lastPannedCoords = useRef<[number, number] | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const labelsLayerRef = useRef<L.TileLayer | null>(null);

  const [activeLayer, setActiveLayer] = useState<'hybrid' | 'satellite' | 'osm' | 'dark'>('hybrid');
  const [showTrail, setShowTrail] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoFollow, setAutoFollow] = useState(true);

  // Expose imperative methods to parent (e.g. for "View Location" button)
  useImperativeHandle(ref, () => ({
    centerOnMarker: () => {
      if (currentLocation && mapInstanceRef.current) {
        lastPannedCoords.current = [currentLocation.lat, currentLocation.lng];
        mapInstanceRef.current.setView([currentLocation.lat, currentLocation.lng], 18, {
          animate: true,
          duration: 0.8,
        });
        if (markerRef.current) {
          markerRef.current.openPopup();
        }
      }
    },
    openPopup: () => {
      if (markerRef.current) {
        markerRef.current.openPopup();
      }
    },
  }));

  // Create custom DivIcon for emergency pulsing marker
  const createEmergencyIcon = (isStaleState: boolean) => {
    const pulseBg = isStaleState ? 'bg-amber-500' : 'bg-red-600';
    const borderCol = isStaleState ? 'border-amber-400' : 'border-red-500';
    const ringPulse = isStaleState ? 'bg-amber-400/40' : 'bg-red-500/50 emergency-pulse-ring';

    return L.divIcon({
      className: 'custom-emergency-marker',
      html: `
        <div style="position: relative; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center;">
          <div class="${ringPulse}" style="position: absolute; width: 44px; height: 44px; border-radius: 9999px;"></div>
          <div class="${pulseBg} ${borderCol}" style="position: relative; width: 22px; height: 22px; border-radius: 9999px; border-width: 3px; box-shadow: 0 4px 14px rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; color: white;">
            <div style="width: 6px; height: 6px; background-color: white; border-radius: 9999px;"></div>
          </div>
          <div style="position: absolute; bottom: -2px; width: 0; height: 0; border-left: 6px solid transparent; border-right: 6px solid transparent; border-top: 8px solid ${isStaleState ? '#f59e0b' : '#dc2626'};"></div>
        </div>
      `,
      iconSize: [44, 44],
      iconAnchor: [22, 44],
      popupAnchor: [0, -42],
    });
  };

  // Build Popup Content HTML
  const getPopupContent = (coord: GPSCoordinate, stale: boolean) => {
    const addressToDisplay = coord.fullAddress || coord.placeName || '';
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif; min-width: 260px; max-width: 340px; padding: 6px;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; border-bottom: 2px solid ${stale ? '#f59e0b' : '#dc2626'}; padding-bottom: 6px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${stale ? '#f59e0b' : '#dc2626'};"></span>
            <strong style="color: ${stale ? '#b45309' : '#dc2626'}; font-size: 15px; font-weight: 800; letter-spacing: 0.03em;">
              ${stale ? 'STALE POSITION' : '🚨 EMERGENCY FIX'}
            </strong>
          </div>
          <span style="font-size: 12px; font-weight: 700; color: #475569;">${coord.formattedTime}</span>
        </div>

        ${addressToDisplay ? `
          <div style="margin-bottom: 10px; padding: 8px 10px; background: #ecfdf5; border-radius: 8px; border: 1.5px solid #a7f3d0;">
            <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #047857; letter-spacing: 0.05em; display: flex; align-items: center; gap: 4px;">
              <span>📍 VERIFIED ADDRESS</span>
            </div>
            <div style="font-size: 14px; font-weight: 700; color: #064e3b; line-height: 1.4; margin-top: 3px;">
              ${addressToDisplay}
            </div>
          </div>
        ` : ''}

        <div style="font-size: 13px; line-height: 1.6; color: #0f172a; background: #f8fafc; padding: 9px; border-radius: 8px; border: 1.5px solid #cbd5e1; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between;"><span style="font-weight: 700; color: #475569;">Latitude:</span> <span style="font-family: monospace; font-weight: 800; color: #0284c7; font-size: 14px;">${coord.lat.toFixed(6)}°</span></div>
          <div style="display: flex; justify-content: space-between;"><span style="font-weight: 700; color: #475569;">Longitude:</span> <span style="font-family: monospace; font-weight: 800; color: #0284c7; font-size: 14px;">${coord.lng.toFixed(6)}°</span></div>
          ${coord.altitude !== undefined ? `<div style="display: flex; justify-content: space-between;"><span style="font-weight: 700; color: #475569;">Altitude:</span> <span style="font-family: monospace; font-weight: 700;">${coord.altitude.toFixed(1)}m</span></div>` : ''}
        </div>
        ${stale ? '<div style="font-size: 11px; color: #b45309; font-weight: 700; background: #fffbeb; padding: 4px 6px; border-radius: 4px;">⚠️ Preserving last known coordinate.</div>' : ''}
      </div>
    `;
  };

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center (Palakkad / Kerala as specified in example coordinates lat 10.7769, lng 76.6548)
    const initialLat = currentLocation ? currentLocation.lat : 10.7769;
    const initialLng = currentLocation ? currentLocation.lng : 76.6548;
    const initialZoom = currentLocation ? 18 : 17;

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: initialZoom,
      maxZoom: 21,
      zoomControl: false,
    });

    // Custom top-right zoom control
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Metric scale bar showing exact 10m / 20m distance scale
    L.control.scale({ imperial: false, metric: true, position: 'bottomright', maxWidth: 100 }).addTo(map);

    // Initial tile layer: Google Hybrid Satellite (satellite imagery + roads + place labels, no grey tiles worldwide)
    const tileLayer = L.tileLayer(
      'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
      {
        subdomains: ['0', '1', '2', '3'],
        maxNativeZoom: 20,
        maxZoom: 21,
        attribution: '&copy; Google Maps &bull; Satellite Telemetry',
      }
    ).addTo(map);

    tileLayerRef.current = tileLayer;
    mapInstanceRef.current = map;

    // Breadcrumb polyline
    const polyline = L.polyline([], {
      color: '#ef4444',
      weight: 4,
      opacity: 0.9,
      dashArray: '6, 8',
    }).addTo(map);
    polylineRef.current = polyline;

    // Handle user manual pan: if user pans, turn off aggressive autoFollow until re-triggered
    map.on('dragstart', () => {
      setAutoFollow(false);
    });

    // Auto-invalidate map size on container resize (e.g. side panel toggle)
    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
      markerRef.current = null;
      polylineRef.current = null;
      labelsLayerRef.current = null;
    };
  }, []);

  // Handle Layer switching
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    if (tileLayerRef.current) {
      mapInstanceRef.current.removeLayer(tileLayerRef.current);
    }
    if (labelsLayerRef.current) {
      mapInstanceRef.current.removeLayer(labelsLayerRef.current);
      labelsLayerRef.current = null;
    }

    let mainUrl = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
    let attribution = '&copy; Google Maps';
    let subdomains: string[] | string = ['0', '1', '2', '3'];
    let maxNativeZoom = 20;
    let maxZoom = 21;

    if (activeLayer === 'hybrid') {
      mainUrl = 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}';
      attribution = '&copy; Google Maps &bull; Satellite with Place Labels';
      maxNativeZoom = 20;
      maxZoom = 21;
    } else if (activeLayer === 'satellite') {
      mainUrl = 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}';
      attribution = '&copy; Google Maps &bull; Pure Satellite Imagery';
      maxNativeZoom = 20;
      maxZoom = 21;
    } else if (activeLayer === 'osm') {
      mainUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      attribution = '&copy; OpenStreetMap contributors';
      subdomains = 'abc';
      maxNativeZoom = 19;
      maxZoom = 21;
    } else if (activeLayer === 'dark') {
      mainUrl = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
      attribution = '&copy; OpenStreetMap &copy; CARTO';
      subdomains = 'abcd';
      maxNativeZoom = 19;
      maxZoom = 21;
    }

    const newLayer = L.tileLayer(mainUrl, {
      subdomains,
      maxNativeZoom,
      maxZoom,
      attribution,
    }).addTo(mapInstanceRef.current);

    tileLayerRef.current = newLayer;
  }, [activeLayer]);

  // Handle GPS coordinate updates (Move existing marker, avoid duplicates, center to level 16)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !currentLocation) return;

    const latLng: [number, number] = [currentLocation.lat, currentLocation.lng];

    if (!markerRef.current) {
      // First time marker creation
      const icon = createEmergencyIcon(isStale);
      const marker = L.marker(latLng, { icon, zIndexOffset: 1000 }).addTo(map);
      marker.bindPopup(getPopupContent(currentLocation, isStale), {
        offset: [0, -20],
        closeButton: true,
        autoClose: false,
      });
      markerRef.current = marker;

      // Center and zoom to level 18 (10m scale) immediately on first arrival
      lastPannedCoords.current = latLng;
      map.setView(latLng, 18, { animate: true });
      marker.openPopup();
    } else {
      // Avoid duplicate markers: update existing marker position and popup content
      markerRef.current.setLatLng(latLng);
      markerRef.current.setIcon(createEmergencyIcon(isStale));
      markerRef.current.setPopupContent(getPopupContent(currentLocation, isStale));

      if (autoFollow) {
        // Fix GPS jumping issue:
        // Stationary GPS modules drift by 1-3 meters constantly.
        // If distance moved is under 4 meters and marker is comfortably inside view,
        // do not jerk the map camera.
        let distanceMoved = 0;
        if (lastPannedCoords.current) {
          distanceMoved = calculateDistanceMeters(
            lastPannedCoords.current[0],
            lastPannedCoords.current[1],
            latLng[0],
            latLng[1]
          );
        }

        const mapBounds = map.getBounds();
        const isNearEdge = !mapBounds.pad(-0.12).contains(latLng);

        // Smoothly glide camera with panTo only when real movement occurs or nearing map edge
        if (distanceMoved >= 4 || isNearEdge) {
          lastPannedCoords.current = latLng;
          map.panTo(latLng, { animate: true, duration: 0.8 });
        }
      }
    }
  }, [currentLocation, isStale, autoFollow]);

  // Update Breadcrumb Polyline Trail
  useEffect(() => {
    if (!polylineRef.current) return;
    if (!showTrail || history.length === 0) {
      polylineRef.current.setLatLngs([]);
      return;
    }

    const latLngs: [number, number][] = history.map((h) => [h.lat, h.lng]);
    polylineRef.current.setLatLngs(latLngs);
  }, [history, showTrail]);

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 150);
  };

  const handleCenter = () => {
    if (currentLocation && mapInstanceRef.current) {
      setAutoFollow(true);
      mapInstanceRef.current.setView([currentLocation.lat, currentLocation.lng], 19, {
        animate: true,
        duration: 0.6,
      });
      markerRef.current?.openPopup();
    }
  };

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-slate-700/60 shadow-2xl transition-all duration-300 bg-slate-900 ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen' : 'h-full min-h-[460px] lg:min-h-0'
      }`}
    >
      {/* Map Element Container */}
      <div ref={mapContainerRef} className="w-full h-full min-h-[460px] lg:min-h-0" />

      {/* Top Left Status Overlay with Crisp, Large, High-Contrast Typography */}
      {currentLocation && (
        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2.5 pointer-events-none max-w-[92%] sm:max-w-lg">
          <div className="flex flex-wrap items-center gap-2.5 bg-slate-900/95 backdrop-blur-md px-4 py-2 rounded-xl border border-slate-700 shadow-2xl pointer-events-auto">
            <span
              className={`w-3 h-3 rounded-full shrink-0 ${
                isStale ? 'bg-amber-400' : 'bg-emerald-400 animate-ping'
              }`}
            />
            <span className="text-xs sm:text-sm font-extrabold tracking-wide uppercase text-white">
              {isStale ? 'Stale GPS Position' : '10-Meter Satellite Zoom'}
            </span>
            <span className="text-xs sm:text-sm font-mono text-cyan-300 font-bold pl-2 border-l border-slate-700">
              {currentLocation.lat.toFixed(5)}°, {currentLocation.lng.toFixed(5)}°
            </span>
          </div>

          {(currentLocation.fullAddress || currentLocation.placeName) && (
            <div className="flex items-start gap-2 bg-emerald-950/95 backdrop-blur-md px-4 py-2.5 rounded-xl border border-emerald-500/70 shadow-2xl pointer-events-auto text-emerald-100">
              <span className="text-base shrink-0 mt-0.5">📍</span>
              <div className="leading-snug">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-400 block">
                  Verified Address
                </span>
                <span className="text-xs sm:text-sm font-bold text-white block">
                  {currentLocation.fullAddress || currentLocation.placeName}
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

LiveLeafletMap.displayName = 'LiveLeafletMap';
