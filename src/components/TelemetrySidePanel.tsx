import React, { useState } from 'react';
import { GPSCoordinate, LocationHistoryItem } from '../types/gps';
import { getGoogleMapsUrl } from '../utils/geoUtils';
import {
  ShieldAlert,
  Clock,
  LocateFixed,
  ExternalLink,
  Copy,
  Check,
  History,
  Volume2,
  VolumeX,
  Play,
  Download,
  Trash2,
  ChevronRight,
  ChevronLeft,
  Search,
  AlertCircle,
  MapPin,
  WifiOff,
  Building,
  Navigation
} from 'lucide-react';

interface TelemetrySidePanelProps {
  currentLocation: GPSCoordinate | null;
  history: LocationHistoryItem[];
  isStale: boolean;
  timeAgoText: string;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onTestSound: () => void;
  onViewLocation: () => void;
  onSelectCoordinate: (lat: number, lng: number) => void;
  onClearHistory: () => void;
  isOpen: boolean;
  onToggleOpen: () => void;
}

export const TelemetrySidePanel: React.FC<TelemetrySidePanelProps> = ({
  currentLocation,
  history,
  isStale,
  timeAgoText,
  soundEnabled,
  onToggleSound,
  onTestSound,
  onViewLocation,
  onSelectCoordinate,
  onClearHistory,
  isOpen,
  onToggleOpen,
}) => {
  const [activeTab, setActiveTab] = useState<'alert' | 'history'>('alert');
  const [copiedCoords, setCopiedCoords] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [historySearch, setHistorySearch] = useState('');

  const handleCopyCoords = () => {
    if (!currentLocation) return;
    const text = `${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopiedCoords(true);
    setTimeout(() => setCopiedCoords(false), 2000);
  };

  const handleCopyAddress = () => {
    if (!currentLocation) return;
    const addr = currentLocation.fullAddress || currentLocation.placeName || '';
    if (!addr) return;
    navigator.clipboard.writeText(addr);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  const exportAsCSV = () => {
    if (history.length === 0) return;
    const headers = 'ID,Latitude,Longitude,Verified_Address,Timestamp,Formatted_Time,Distance_Meters\n';
    const rows = history
      .map(
        (h) =>
          `"${h.id}",${h.lat.toFixed(6)},${h.lng.toFixed(6)},"${(h.fullAddress || h.placeName || '').replace(/"/g, '""')}",${h.timestamp},"${h.formattedTime}",${
            h.distanceFromPrevious ?? 0
          }`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `gps_telemetry_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredHistory = history.filter((item) => {
    if (!historySearch.trim()) return true;
    const term = historySearch.toLowerCase();
    const coords = `${item.lat},${item.lng}`.toLowerCase();
    const address = `${item.fullAddress || ''} ${item.placeName || ''}`.toLowerCase();
    const time = item.formattedTime.toLowerCase();
    return coords.includes(term) || address.includes(term) || time.includes(term);
  });

  const googleMapsUrl = currentLocation
    ? getGoogleMapsUrl(currentLocation.lat, currentLocation.lng)
    : '';

  if (!isOpen) {
    // Collapsed slim rail
    return (
      <div className="hidden lg:flex flex-col items-center py-4 bg-slate-950 border-l border-slate-800 w-14 shrink-0 select-none">
        <button
          onClick={onToggleOpen}
          className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-cyan-300 hover:text-white border border-slate-700 transition-colors cursor-pointer mb-4 shadow"
          title="Expand Emergency Telemetry Side Panel"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 flex flex-col items-center gap-6 justify-center">
          <div
            onClick={onToggleOpen}
            className="cursor-pointer text-xs font-black tracking-widest text-slate-300 hover:text-white uppercase flex items-center gap-2"
            style={{ writingMode: 'vertical-rl' }}
          >
            {currentLocation ? (
              <span className="flex items-center gap-2 text-red-400 font-extrabold">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
                🚨 EMERGENCY TELEMETRY
              </span>
            ) : (
              <span>EMERGENCY SIDEBAR</span>
            )}
          </div>
        </div>

        {history.length > 0 && (
          <div className="w-8 h-8 rounded-full bg-cyan-950 border border-cyan-700 text-xs font-black text-cyan-200 flex items-center justify-center shadow">
            {history.length > 99 ? '99+' : history.length}
          </div>
        )}
      </div>
    );
  }

  return (
    <aside className="w-full lg:w-[440px] xl:w-[480px] bg-slate-950 border-t lg:border-t-0 lg:border-l border-slate-800/90 flex flex-col h-[520px] lg:h-full shrink-0 shadow-2xl z-20 overflow-hidden font-sans">
      {/* Tabs Bar with Clear, Readable Labels and Compact Controls */}
      <div className="flex items-center bg-slate-900 border-b border-slate-800 px-3 pt-2.5 gap-2 shrink-0">
        <button
          onClick={() => setActiveTab('alert')}
          className={`flex-1 max-w-[140px] py-2 text-xs sm:text-sm font-extrabold uppercase tracking-wide rounded-t-xl transition-colors border-t border-x cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'alert'
              ? 'bg-slate-950 text-white border-slate-700 shadow-md'
              : 'text-slate-300 hover:text-white border-transparent hover:bg-slate-800/80'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <span>Location</span>
          {currentLocation && <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 max-w-[140px] py-2 text-xs sm:text-sm font-extrabold uppercase tracking-wide rounded-t-xl transition-colors border-t border-x cursor-pointer flex items-center justify-center gap-2 ${
            activeTab === 'history'
              ? 'bg-slate-950 text-white border-slate-700 shadow-md'
              : 'text-slate-300 hover:text-white border-transparent hover:bg-slate-800/80'
          }`}
        >
          <History className="w-4 h-4 text-cyan-400" />
          <span>History</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-cyan-200 font-bold border border-slate-700">
            {history.length}
          </span>
        </button>

        {/* Audio Siren Toggle, Tone Test & Collapse Button */}
        <div className="flex items-center gap-1.5 ml-auto pb-1.5">
          <button
            onClick={onToggleSound}
            className={`p-1.5 rounded-lg border text-xs font-bold transition-colors cursor-pointer ${
              soundEnabled
                ? 'bg-slate-800 text-cyan-300 border-slate-700 hover:bg-slate-700'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
            }`}
            title={soundEnabled ? 'Emergency Siren Alert Enabled' : 'Siren Alert Muted'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={onTestSound}
            className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg border border-slate-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shadow-sm"
            title="Test High-Level Emergency Alarm Siren"
          >
            <Play className="w-3 h-3 text-red-400 fill-current" />
            <span>Tone</span>
          </button>

          <button
            onClick={onToggleOpen}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            title="Collapse Sidebar"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tab Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: LOCATION, VERIFIED ADDRESS & EMERGENCY ALERT */}
        {activeTab === 'alert' && (
          <div className="space-y-4">
            {currentLocation ? (
              <div
                className={`rounded-2xl border-2 p-4 space-y-4 shadow-2xl transition-all ${
                  isStale
                    ? 'bg-amber-950/40 border-amber-500/80'
                    : 'bg-red-950/40 border-red-500'
                }`}
              >
                {/* Emergency Status Banner */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🚨</span>
                    <span
                      className={`text-sm font-black uppercase tracking-wider ${
                        isStale ? 'text-amber-300' : 'text-red-400 drop-shadow'
                      }`}
                    >
                      {isStale ? 'STALE LOCATION FIX' : 'EMERGENCY BEACON ACTIVE'}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-mono font-bold text-white bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700 shadow">
                    <Clock className="w-3.5 h-3.5 text-slate-300" />
                    {timeAgoText}
                  </span>
                </div>

                {/* VERIFIED POSTAL ADDRESS CARD (Prominent & Clear) */}
                <div className="bg-slate-900 rounded-2xl p-4 border border-emerald-500/60 shadow-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <MapPin className="w-4 h-4 text-emerald-400" />
                      <span>Verified Place Address</span>
                    </div>

                    <button
                      onClick={handleCopyAddress}
                      className="px-2.5 py-1 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-600/70 text-emerald-200 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      title="Copy Complete Verified Address"
                    >
                      {copiedAddress ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-300" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>Copy Address</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Main Full Address String */}
                  <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                    <div className="text-sm sm:text-base font-extrabold text-white leading-relaxed">
                      {currentLocation.fullAddress || currentLocation.placeName || 'Resolving verified address...'}
                    </div>
                  </div>

                  {/* Detailed Address Component Tags with Large Legible Fonts */}
                  {currentLocation.placeDetails && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                      {currentLocation.placeDetails.road && (
                        <div className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
                          <span className="text-[11px] font-bold uppercase text-slate-400 block">Road / Street</span>
                          <span className="text-xs sm:text-sm font-extrabold text-white">
                            {currentLocation.placeDetails.road}
                          </span>
                        </div>
                      )}

                      {currentLocation.placeDetails.neighbourhood && (
                        <div className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
                          <span className="text-[11px] font-bold uppercase text-slate-400 block">Area / Locality</span>
                          <span className="text-xs sm:text-sm font-extrabold text-white">
                            {currentLocation.placeDetails.neighbourhood}
                          </span>
                        </div>
                      )}

                      {currentLocation.placeDetails.city && (
                        <div className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
                          <span className="text-[11px] font-bold uppercase text-slate-400 block">City / Town</span>
                          <span className="text-xs sm:text-sm font-extrabold text-white">
                            {currentLocation.placeDetails.city}
                          </span>
                        </div>
                      )}

                      {currentLocation.placeDetails.state && (
                        <div className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800">
                          <span className="text-[11px] font-bold uppercase text-slate-400 block">State & Postal PIN</span>
                          <span className="text-xs sm:text-sm font-extrabold text-amber-200">
                            {currentLocation.placeDetails.state}
                            {currentLocation.placeDetails.postcode ? ` - ${currentLocation.placeDetails.postcode}` : ''}
                          </span>
                        </div>
                      )}

                      {currentLocation.placeDetails.country && (
                        <div className="bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 sm:col-span-2">
                          <span className="text-[11px] font-bold uppercase text-slate-400 block">Country</span>
                          <span className="text-xs sm:text-sm font-extrabold text-white">
                            {currentLocation.placeDetails.country}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* GPS Coordinates Grid with Large, High-Contrast Readouts */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 shadow-md">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                      Latitude
                    </span>
                    <div className="font-mono text-xl sm:text-2xl font-black text-white mt-1">
                      {currentLocation.lat.toFixed(6)}°
                    </div>
                    <span className="text-xs font-bold text-cyan-300 mt-0.5 block">
                      {currentLocation.lat >= 0 ? 'North (+)' : 'South (-)'}
                    </span>
                  </div>

                  <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-800 shadow-md">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300 block">
                      Longitude
                    </span>
                    <div className="font-mono text-xl sm:text-2xl font-black text-white mt-1">
                      {currentLocation.lng.toFixed(6)}°
                    </div>
                    <span className="text-xs font-bold text-cyan-300 mt-0.5 block">
                      {currentLocation.lng >= 0 ? 'East (+)' : 'West (-)'}
                    </span>
                  </div>
                </div>

                {/* Received Time Info */}
                <div className="flex items-center justify-between text-xs font-bold text-slate-300 px-1 bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                  <span>Packet Fix Timestamp:</span>
                  <span className="font-mono text-sm font-black text-white">{currentLocation.formattedTime}</span>
                </div>

                {/* Action Buttons */}
                <div className="space-y-2.5 pt-1">
                  <button
                    onClick={onViewLocation}
                    className="w-full py-3 px-4 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white shadow-xl shadow-blue-950/50 border border-blue-400/40 transition-all cursor-pointer"
                  >
                    <LocateFixed className="w-5 h-5 text-blue-100" />
                    <span>Center Map on Location</span>
                  </button>

                  <div className="grid grid-cols-2 gap-2.5">
                    <a
                      href={googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg border border-emerald-400/40 transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-4 h-4" />
                      <span>Google Maps</span>
                    </a>

                    <button
                      onClick={handleCopyCoords}
                      className="py-2.5 px-3 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 transition-all cursor-pointer"
                    >
                      {copiedCoords ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-400" />
                          <span className="text-emerald-300">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4 text-slate-300" />
                          <span>Copy Coords</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Telemetry Notice */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-start gap-2 text-xs text-slate-300 leading-relaxed">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-white">Telemetry Notice:</strong> Coordinates verified directly from ESP8266 serial packet.
                  </span>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {/* TAB 2: TELEMETRY HISTORY (Legible, Large Fonts) */}
        {activeTab === 'history' && (
          <div className="space-y-3 font-sans">
            <div className="flex items-center justify-between gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search address, road, coordinates..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-cyan-400 shadow-inner font-medium"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={exportAsCSV}
                  disabled={history.length === 0}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-700 text-slate-200 hover:text-white transition-colors cursor-pointer"
                  title="Export History as CSV"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={onClearHistory}
                  disabled={history.length === 0}
                  className="p-2.5 rounded-xl bg-slate-900 hover:bg-rose-950/70 disabled:opacity-40 border border-slate-700 text-slate-300 hover:text-rose-300 transition-colors cursor-pointer"
                  title="Clear Telemetry History"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div className="text-center py-12 text-sm font-semibold text-slate-400">
                {history.length === 0
                  ? 'No GPS telemetry records received yet.'
                  : 'No records matching search query.'}
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectCoordinate(item.lat, item.lng)}
                    className="p-3.5 rounded-xl bg-slate-900 hover:bg-slate-850 border border-slate-700/80 transition-all cursor-pointer group shadow"
                  >
                    <div className="flex items-center justify-between text-xs sm:text-sm">
                      <span className="font-mono font-black text-white group-hover:text-cyan-300">
                        {item.lat.toFixed(6)}°, {item.lng.toFixed(6)}°
                      </span>
                      <span className="text-xs text-slate-300 font-mono font-bold">
                        {item.formattedTime}
                      </span>
                    </div>

                    {(item.fullAddress || item.placeName) && (
                      <div className="text-xs sm:text-sm font-bold text-emerald-200 mt-1.5 flex items-start gap-1.5 leading-snug">
                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{item.fullAddress || item.placeName}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between mt-2 text-xs font-bold text-slate-300 border-t border-slate-800 pt-1.5">
                      <span>
                        {item.distanceFromPrevious !== undefined ? (
                          <span className="text-cyan-300">+{Math.round(item.distanceFromPrevious)}m delta</span>
                        ) : (
                          <span className="text-cyan-400">First Fix</span>
                        )}
                      </span>
                      <span className="text-blue-400 font-bold group-hover:underline flex items-center gap-1">
                        View on Map &rarr;
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
