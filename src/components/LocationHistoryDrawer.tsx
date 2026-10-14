import React, { useState } from 'react';
import { LocationHistoryItem } from '../types/gps';
import { History, Download, Trash2, MapPin, ExternalLink, X, Search, Clock, Compass } from 'lucide-react';
import { getGoogleMapsUrl } from '../utils/geoUtils';

interface LocationHistoryDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  history: LocationHistoryItem[];
  onClearHistory: () => void;
  onSelectCoordinate: (lat: number, lng: number) => void;
}

export const LocationHistoryDrawer: React.FC<LocationHistoryDrawerProps> = ({
  isOpen,
  onClose,
  history,
  onClearHistory,
  onSelectCoordinate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const filteredHistory = history.filter((item) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    const latLngStr = `${item.lat},${item.lng}`.toLowerCase();
    const place = (item.placeName || '').toLowerCase();
    const time = item.formattedTime.toLowerCase();
    return latLngStr.includes(term) || place.includes(term) || time.includes(term);
  });

  const exportAsCSV = () => {
    if (history.length === 0) return;
    const headers = 'ID,Latitude,Longitude,Identified_Place,Timestamp,Formatted_Time,Distance_From_Previous_Meters\n';
    const rows = history
      .map(
        (h) =>
          `"${h.id}",${h.lat.toFixed(6)},${h.lng.toFixed(6)},"${(h.placeName || '').replace(/"/g, '""')}",${h.timestamp},"${h.formattedTime}",${
            h.distanceFromPrevious ?? 0
          }`
      )
      .join('\n');
    const blob = new Blob([headers + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `gps_emergency_history_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAsJSON = () => {
    if (history.length === 0) return;
    const blob = new Blob([JSON.stringify(history, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `gps_emergency_history_${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
      />

      {/* Slide-over Drawer */}
      <div className="relative w-full max-w-md md:max-w-lg bg-slate-900 border-l border-slate-700/80 shadow-2xl flex flex-col h-full z-10 animate-in slide-in-from-right duration-300">
        {/* Drawer Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-800/80 flex items-center justify-center text-cyan-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">Location Telemetry History</h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-cyan-950 text-cyan-300 border border-cyan-800 font-semibold">
                  {history.length}
                </span>
              </div>
              <p className="text-xs text-slate-400">Sequential log of received emergency GPS packets</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close Sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar & Search */}
        <div className="p-3 sm:p-4 border-b border-slate-800 bg-slate-900/90 space-y-2.5">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by coordinates, place, or time..."
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-slate-400">
              Showing {filteredHistory.length} of {history.length} records
            </span>

            {history.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={exportAsCSV}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Export as CSV"
                >
                  <Download className="w-3 h-3 text-emerald-400" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={exportAsJSON}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                  title="Export as JSON"
                >
                  <Download className="w-3 h-3 text-cyan-400" />
                  <span>JSON</span>
                </button>
                <button
                  onClick={onClearHistory}
                  className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/80 hover:text-rose-400 text-slate-400 border border-slate-700 transition-colors cursor-pointer"
                  title="Clear all records"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Scrollable Records List */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
          {filteredHistory.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 text-slate-500">
              <Compass className="w-10 h-10 mb-2 text-slate-600 opacity-60" />
              <div className="text-xs font-semibold text-slate-400">No GPS telemetry records</div>
              <div className="text-[11px] text-slate-500 max-w-xs mt-1">
                {searchTerm ? 'No entries match your search query.' : 'Connect your ESP8266 NodeMCU to start recording live telemetry coordinates.'}
              </div>
            </div>
          ) : (
            filteredHistory.map((item, index) => {
              const isLatest = index === 0 && !searchTerm;
              return (
                <div
                  key={item.id}
                  className={`p-3.5 rounded-xl border transition-all ${
                    isLatest
                      ? 'bg-red-950/30 border-red-500/50 shadow-lg shadow-red-950/30'
                      : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      {isLatest ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-600/30 text-red-400 border border-red-500/30">
                          LATEST FIX
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-500">
                          #{history.length - history.indexOf(item)}
                        </span>
                      )}
                      <span className="text-xs text-slate-400 flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {item.formattedTime}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          onSelectCoordinate(item.lat, item.lng);
                          onClose();
                        }}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-blue-600 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-[11px] font-semibold cursor-pointer"
                        title="Focus this point on map"
                      >
                        <MapPin className="w-3 h-3 text-cyan-400" />
                        <span>Map</span>
                      </button>
                      <a
                        href={getGoogleMapsUrl(item.lat, item.lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1 rounded bg-slate-800 hover:bg-emerald-600 text-slate-400 hover:text-white transition-colors cursor-pointer"
                        title="Open in Google Maps"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>

                  {/* Coordinates readout */}
                  <div className="font-mono text-xs font-bold text-white flex items-center justify-between">
                    <span>
                      <span className="text-cyan-300">{item.lat.toFixed(6)}°</span>,{' '}
                      <span className="text-cyan-300">{item.lng.toFixed(6)}°</span>
                    </span>
                    {item.distanceFromPrevious !== undefined && (
                      <span className="text-[11px] font-sans font-medium text-amber-400">
                        {item.distanceFromPrevious > 0 ? `+${item.distanceFromPrevious}m shift` : 'Static (0m)'}
                      </span>
                    )}
                  </div>

                  {/* Identified Place */}
                  {item.placeName && (
                    <div className="mt-1.5 pt-1.5 border-t border-slate-800/80 text-[11px] text-emerald-400 flex items-start gap-1.5 leading-snug">
                      <span className="shrink-0 mt-0.5">📍</span>
                      <span className="font-medium text-emerald-300">{item.placeName}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/80 text-center text-[11px] text-slate-500">
          Telemetry history persists in browser session memory
        </div>
      </div>
    </div>
  );
};
