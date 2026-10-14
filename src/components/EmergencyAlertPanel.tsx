import React, { useState } from 'react';
import { GPSCoordinate } from '../types/gps';
import { getGoogleMapsUrl } from '../utils/geoUtils';
import {
  ExternalLink,
  Copy,
  Check,
  LocateFixed,
  Clock,
  ShieldAlert,
  AlertCircle,
  WifiOff
} from 'lucide-react';

interface EmergencyAlertPanelProps {
  currentLocation: GPSCoordinate | null;
  isStale: boolean;
  timeAgoText: string;
  onViewLocation: () => void;
}

export const EmergencyAlertPanel: React.FC<EmergencyAlertPanelProps> = ({
  currentLocation,
  isStale,
  timeAgoText,
  onViewLocation,
}) => {
  const [copied, setCopied] = useState(false);

  if (!currentLocation) {
    return null;
  }

  const handleCopy = () => {
    const text = `${currentLocation.lat.toFixed(6)}, ${currentLocation.lng.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const googleMapsUrl = getGoogleMapsUrl(currentLocation.lat, currentLocation.lng);

  return (
    <div
      className={`w-full h-full flex flex-col justify-between rounded-2xl overflow-hidden border transition-all duration-300 shadow-2xl ${
        isStale
          ? 'bg-gradient-to-b from-amber-950/90 via-slate-900 to-amber-950/90 border-amber-600/70 shadow-amber-950/40'
          : 'bg-gradient-to-b from-red-950/90 via-slate-950 to-red-950/90 border-red-500 shadow-red-950/50'
      }`}
    >
      {/* Alert Header Banner */}
      <div
        className={`p-4 sm:p-5 flex items-center justify-between gap-3 border-b ${
          isStale ? 'bg-amber-600/20 border-amber-600/30' : 'bg-red-600/25 border-red-500/40'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-lg ${
              isStale ? 'bg-amber-600 text-white' : 'bg-red-600 text-white animate-pulse'
            }`}
          >
            {isStale ? <WifiOff className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-base sm:text-lg">🚨</span>
              <h2
                className={`text-base sm:text-lg font-black tracking-wide uppercase leading-tight ${
                  isStale ? 'text-amber-300' : 'text-red-400 drop-shadow'
                }`}
              >
                EMERGENCY LOCATION
              </h2>
            </div>
            <p className="text-[11px] text-slate-400 leading-tight">
              {isStale ? 'USB interrupted (stale position)' : 'ESP8266 Live Telemetry @ 115200'}
            </p>
          </div>
        </div>

        {/* Live / Stale status badge */}
        <div className="flex flex-col items-end gap-1 shrink-0">
          {isStale ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/50">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Stale
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/50">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
              Live
            </span>
          )}

          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-300 bg-slate-900 border border-slate-700">
            <Clock className="w-3 h-3 text-slate-400" />
            {timeAgoText}
          </span>
        </div>
      </div>

      {/* Alert Content Body */}
      <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
        {/* Coordinates Display Card */}
        <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 shadow-inner space-y-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span>Coordinates Payload</span>
            <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
              WGS84 GPS FIX
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Latitude */}
            <div className="bg-slate-950/80 rounded-lg p-2.5 border border-slate-800">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Latitude</div>
              <div className="text-lg sm:text-xl font-mono font-bold text-white tracking-tight mt-0.5">
                {currentLocation.lat.toFixed(6)}°
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {currentLocation.lat >= 0 ? 'North (+)' : 'South (-)'}
              </div>
            </div>

            {/* Longitude */}
            <div className="bg-slate-950/80 rounded-lg p-2.5 border border-slate-800">
              <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Longitude</div>
              <div className="text-lg sm:text-xl font-mono font-bold text-white tracking-tight mt-0.5">
                {currentLocation.lng.toFixed(6)}°
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {currentLocation.lng >= 0 ? 'East (+)' : 'West (-)'}
              </div>
            </div>
          </div>

          {/* Identified Place Section */}
          <div className="pt-2 border-t border-slate-800/80">
            <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-1 flex items-center gap-1">
              <span>📍 Identified Location</span>
            </div>

            {currentLocation.placeName ? (
              <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-lg p-2.5 space-y-1.5">
                <div className="text-xs sm:text-sm font-bold text-emerald-200 leading-snug">
                  {currentLocation.placeName}
                </div>

                {currentLocation.placeDetails && (
                  <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] text-slate-300">
                    {currentLocation.placeDetails.road && (
                      <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                        <strong className="text-slate-400">Road:</strong> {currentLocation.placeDetails.road}
                      </span>
                    )}
                    {currentLocation.placeDetails.neighbourhood && (
                      <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                        <strong className="text-slate-400">Area:</strong> {currentLocation.placeDetails.neighbourhood}
                      </span>
                    )}
                    {currentLocation.placeDetails.city && (
                      <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                        <strong className="text-slate-400">City:</strong> {currentLocation.placeDetails.city}
                      </span>
                    )}
                    {currentLocation.placeDetails.state && (
                      <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                        <strong className="text-slate-400">State:</strong> {currentLocation.placeDetails.state}
                      </span>
                    )}
                    {currentLocation.placeDetails.postcode && (
                      <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                        <strong className="text-slate-400">Postal:</strong> {currentLocation.placeDetails.postcode}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 italic bg-slate-950/60 p-2 rounded-lg border border-slate-800 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
                <span>Resolving place identity from satellite map labels...</span>
              </div>
            )}
          </div>

          {/* Timestamp Info */}
          <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-300">
            <span className="text-slate-400">Received at:</span>
            <span className="font-mono font-medium text-white">{currentLocation.formattedTime}</span>
          </div>
        </div>

        {/* Action Buttons Column */}
        <div className="flex flex-col gap-2.5 pt-1">
          {/* View Location button */}
          <button
            onClick={onViewLocation}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white shadow-lg shadow-blue-900/30 transition-all border border-blue-400/30 cursor-pointer"
          >
            <LocateFixed className="w-4 h-4 text-blue-200" />
            <span>View Location (Center Map)</span>
          </button>

          {/* Open in Google Maps button */}
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white shadow-lg shadow-emerald-950/40 transition-all border border-emerald-400/30 cursor-pointer"
          >
            <ExternalLink className="w-4 h-4 text-emerald-200" />
            <span>Open in Google Maps</span>
          </a>

          {/* Copy Coordinates button */}
          <button
            onClick={handleCopy}
            className="w-full py-2 px-4 rounded-xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 active:scale-[0.98] text-slate-200 shadow-md transition-all border border-slate-700 cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-300">Coordinates Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4 text-slate-400" />
                <span>Copy Coordinates</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Emergency State Accuracy Disclaimer Banner */}
      <div className="px-4 py-2.5 bg-slate-950/90 border-t border-slate-800/80 flex items-start gap-2 text-[10px] text-slate-400 leading-normal">
        <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <span>
          <strong className="text-slate-300 font-semibold">Telemetry Notice:</strong> GPS coordinates received from ESP8266. Does not confirm automated dispatch of emergency services.
        </span>
      </div>
    </div>
  );
};
