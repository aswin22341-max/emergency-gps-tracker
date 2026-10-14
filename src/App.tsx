/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GPSCoordinate, LocationHistoryItem, ConnectionState, SerialLogMessage } from './types/gps';
import { WebSerialManager, SerialErrorDiagnostic } from './services/webSerial';
import { calculateDistanceMeters, formatTimeAgo } from './utils/geoUtils';
import { reverseGeocode } from './services/geocodingService';
import { LiveLeafletMap, MapHandle } from './components/LiveLeafletMap';
import { TelemetrySidePanel } from './components/TelemetrySidePanel';
import {
  ShieldAlert,
  Usb,
  AlertCircle,
  ExternalLink,
  PanelRight,
  PanelRightClose
} from 'lucide-react';

export default function App() {
  const [currentLocation, setCurrentLocation] = useState<GPSCoordinate | null>(null);
  const [history, setHistory] = useState<LocationHistoryItem[]>([]);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [logs, setLogs] = useState<SerialLogMessage[]>([]);
  const [isStale, setIsStale] = useState<boolean>(false);
  const [timeAgoText, setTimeAgoText] = useState<string>('Never');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [sidePanelOpen, setSidePanelOpen] = useState<boolean>(true);
  const [diagnostic, setDiagnostic] = useState<SerialErrorDiagnostic | null>(null);

  const serialManagerRef = useRef<WebSerialManager | null>(null);
  const mapRef = useRef<MapHandle | null>(null);
  const lastLocationRef = useRef<GPSCoordinate | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play loud, high-level emergency alert tone (dual-frequency warble siren) using Web Audio API
  const playAlertChime = useCallback(() => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioContextRef.current = new AudioCtx();
        }
      }
      const ctx = audioContextRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      // Sharp, piercing sawtooth and square harmonic waveforms for emergency acoustic profile
      osc1.type = 'sawtooth';
      osc2.type = 'square';

      // High-intensity alternating emergency warble (980 Hz / 1480 Hz + sub-octaves)
      [0, 0.08, 0.16, 0.24, 0.32, 0.40].forEach((t, i) => {
        const freq1 = i % 2 === 0 ? 980 : 1480;
        const freq2 = i % 2 === 0 ? 490 : 740;
        osc1.frequency.setValueAtTime(freq1, now + t);
        osc2.frequency.setValueAtTime(freq2, now + t);
      });

      // High-level volume envelope for urgency
      gain.gain.setValueAtTime(0.40, now);
      gain.gain.setValueAtTime(0.40, now + 0.44);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.54);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.55);
      osc2.stop(now + 0.55);
    } catch (e) {
      // Audio playback restriction or error
    }
  }, [soundEnabled]);

  // Handle logging
  const handleLog = useCallback((logMsg: SerialLogMessage) => {
    setLogs((prev) => [...prev.slice(-300), logMsg]);
  }, []);

  // Handle incoming GPS coordinates
  const handleGpsReceived = useCallback(
    (coord: GPSCoordinate) => {
      // Reset stale status upon fresh packet arrival
      setIsStale(false);
      lastLocationRef.current = coord;
      setCurrentLocation(coord);

      // Add to location history with distance calculation
      setHistory((prev) => {
        let distanceFromPrev: number | undefined = undefined;
        if (prev.length > 0) {
          const prevItem = prev[0];
          distanceFromPrev = calculateDistanceMeters(prevItem.lat, prevItem.lng, coord.lat, coord.lng);
        }

        const newItem: LocationHistoryItem = {
          id: `${coord.timestamp}-${Math.random().toString(36).substr(2, 5)}`,
          lat: coord.lat,
          lng: coord.lng,
          timestamp: coord.timestamp,
          formattedTime: coord.formattedTime,
          source: coord.source,
          distanceFromPrevious: distanceFromPrev,
          placeName: coord.placeName,
          fullAddress: coord.fullAddress,
          placeDetails: coord.placeDetails,
        };

        // Keep most recent first, limit to 200 items
        return [newItem, ...prev.slice(0, 199)];
      });

      // High-level emergency alert tone
      playAlertChime();

      // Resolve place identity and verified full address
      const packetTimestamp = coord.timestamp;
      reverseGeocode(coord.lat, coord.lng).then((res) => {
        if (res) {
          const { placeName, fullAddress, details } = res;
          setCurrentLocation((current) => {
            if (current && current.timestamp === packetTimestamp) {
              return { ...current, placeName, fullAddress, placeDetails: details };
            }
            return current;
          });

          setHistory((prev) =>
            prev.map((item) =>
              item.timestamp === packetTimestamp
                ? { ...item, placeName, fullAddress, placeDetails: details }
                : item
            )
          );

          handleLog({
            id: `geo-${packetTimestamp}`,
            timestamp: new Date().toLocaleTimeString(),
            type: 'info',
            message: `📍 Verified Address: ${fullAddress}`,
          });
        }
      });
    },
    [playAlertChime, handleLog]
  );

  // Handle connection state change
  const handleStateChange = useCallback((connected: boolean, error?: string, diag?: SerialErrorDiagnostic) => {
    setConnectionState(connected ? 'connected' : 'disconnected');
    setDiagnostic(diag || null);
    if (!connected) {
      if (lastLocationRef.current) {
        setIsStale(true);
      }
    } else {
      setIsStale(false);
      setDiagnostic(null);
    }
  }, []);

  // Initialize Web Serial Manager instance and auto-connect
  useEffect(() => {
    const isSupported = WebSerialManager.isSupported();
    if (!isSupported) {
      setConnectionState('unsupported');
      handleLog({
        id: 'init-err',
        timestamp: new Date().toLocaleTimeString(),
        type: 'error',
        message: 'Web Serial API is not supported in this browser. Please use Google Chrome, Edge, or Opera.',
      });
    }

    const manager = new WebSerialManager(handleGpsReceived, handleLog, handleStateChange);
    serialManagerRef.current = manager;

    // Automatically connect to previously authorized ESP8266 USB port without dialog prompt
    manager.autoConnect(115200);

    return () => {
      manager.disconnect();
    };
  }, [handleGpsReceived, handleLog, handleStateChange]);

  // Live timer interval: updates "time since last valid GPS update"
  useEffect(() => {
    const interval = setInterval(() => {
      if (currentLocation) {
        setTimeAgoText(formatTimeAgo(currentLocation.timestamp));
        const diffSeconds = (Date.now() - currentLocation.timestamp) / 1000;
        if (diffSeconds > 60 && connectionState === 'connected') {
          setIsStale(true);
        }
      } else {
        setTimeAgoText('Never');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [currentLocation, connectionState]);

  // Serial connect trigger
  const handleConnect = async () => {
    if (serialManagerRef.current) {
      setDiagnostic(null);
      setConnectionState('connecting');
      await serialManagerRef.current.connect(115200);
    }
  };

  // Serial disconnect trigger
  const handleDisconnect = async () => {
    if (serialManagerRef.current) {
      await serialManagerRef.current.disconnect();
      setIsStale(true);
      setDiagnostic(null);
    }
  };

  const handleCenterOnMap = () => {
    mapRef.current?.centerOnMarker();
  };

  const handleSelectHistoryCoordinate = (lat: number, lng: number) => {
    mapRef.current?.centerOnMarker();
  };

  const handleClearHistory = () => {
    if (window.confirm('Clear all recorded location telemetry records?')) {
      setHistory([]);
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden selection:bg-red-500/30 selection:text-red-200">
      {/* Top Application Header: Focused on Port Connection Button with Sharp, Bold Typography */}
      <header className="shrink-0 bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 flex items-center justify-between z-30 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-white shadow-lg shadow-red-900/40 border border-red-500/50 shrink-0">
            <ShieldAlert className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-2">
                <span>EMERGENCY GPS TRACKER</span>
                <span className="text-xs font-mono font-black uppercase px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-700 shadow-sm">
                  ESP8266
                </span>
              </h1>
            </div>
            <p className="text-xs font-semibold text-slate-300 hidden md:block mt-0.5">
              10-Meter Precision Satellite Telemetry &bull; USB 115200 Baud
            </p>
          </div>
        </div>

        {/* Top UI Dashboard Port Connection Button & Side Toggle */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Top Port Connection Button */}
          {connectionState === 'connected' ? (
            <div className="flex items-center gap-2.5 bg-emerald-950 border border-emerald-500 text-emerald-200 px-4 py-2 rounded-xl shadow-lg">
              <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="text-xs sm:text-sm font-black tracking-wide">PORT CONNECTED</span>
              <button
                onClick={handleDisconnect}
                className="ml-1 text-xs uppercase font-extrabold text-slate-300 hover:text-rose-300 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 hover:border-rose-600/50 transition-colors cursor-pointer"
                title="Disconnect USB Port"
              >
                Disconnect
              </button>
            </div>
          ) : connectionState === 'connecting' ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-950 border border-blue-500 text-blue-200 text-xs sm:text-sm font-black shadow animate-pulse">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping shrink-0" />
              <span>CONNECTING PORT...</span>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 border border-cyan-400/60 text-white font-black text-xs sm:text-sm uppercase tracking-wider shadow-xl shadow-cyan-950/60 transition-all cursor-pointer active:scale-95"
              title="Connect ESP8266 USB Port"
            >
              <Usb className="w-4 h-4 text-cyan-200" />
              <span>CONNECT PORT</span>
            </button>
          )}

          {/* Side Panel Toggle Button */}
          <button
            onClick={() => setSidePanelOpen(!sidePanelOpen)}
            className={`px-3.5 py-2.5 rounded-xl border text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
              sidePanelOpen
                ? 'bg-slate-850 text-cyan-300 border-slate-700 hover:bg-slate-800'
                : 'bg-slate-800 text-slate-200 border-slate-700 hover:text-white hover:bg-slate-750'
            }`}
            title={sidePanelOpen ? 'Hide Side Panel' : 'Show Telemetry in Side'}
          >
            {sidePanelOpen ? <PanelRightClose className="w-4 h-4" /> : <PanelRight className="w-4 h-4" />}
            <span className="hidden sm:inline">Side Panel</span>
            {currentLocation && (
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping ml-0.5" />
            )}
          </button>
        </div>
      </header>

      {/* Main Dual-Pane Dashboard: Full Satellite Map + Emergency Telemetry Side Panel */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Diagnostic Notice if port issue */}
        {diagnostic && connectionState !== 'connected' && (
          <div className="absolute top-3 left-4 right-4 z-30 bg-rose-950/90 border border-rose-500/70 rounded-xl p-3 text-xs text-rose-200 flex items-center justify-between shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>
                <strong className="text-white">Port Notice:</strong> {diagnostic.message} &mdash;{' '}
                <span className="text-slate-300">{diagnostic.suggestion}</span>
              </span>
            </div>
            {WebSerialManager.isInsideIframe() && (
              <button
                onClick={() => window.open(window.location.href, '_blank', 'noopener,noreferrer')}
                className="shrink-0 px-2.5 py-1 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg text-xs cursor-pointer flex items-center gap-1 ml-2"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Full Window</span>
              </button>
            )}
          </div>
        )}

        {/* Live Satellite GIS Map Area (Full Viewport Height & Width, completely clean) */}
        <main className="flex-1 h-full min-h-0 relative p-2 sm:p-3 flex flex-col">
          <LiveLeafletMap
            ref={mapRef}
            currentLocation={currentLocation}
            history={history}
            isStale={isStale}
          />
        </main>

        {/* Emergency Telemetry Displayed in the Side Panel */}
        <TelemetrySidePanel
          isOpen={sidePanelOpen}
          onToggleOpen={() => setSidePanelOpen(!sidePanelOpen)}
          currentLocation={currentLocation}
          history={history}
          isStale={isStale}
          timeAgoText={timeAgoText}
          soundEnabled={soundEnabled}
          onToggleSound={() => setSoundEnabled(!soundEnabled)}
          onTestSound={playAlertChime}
          onViewLocation={handleCenterOnMap}
          onSelectCoordinate={handleSelectHistoryCoordinate}
          onClearHistory={handleClearHistory}
        />
      </div>
    </div>
  );
}
