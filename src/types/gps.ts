export interface PlaceDetails {
  display_name?: string;
  fullAddress?: string;
  landmark?: string;
  road?: string;
  suburb?: string;
  neighbourhood?: string;
  city?: string;
  county?: string;
  state?: string;
  country?: string;
  postcode?: string;
}

export interface GPSCoordinate {
  lat: number;
  lng: number;
  timestamp: number;
  formattedTime: string;
  source: 'hardware' | 'test';
  rawJson?: string;
  altitude?: number;
  satellites?: number;
  placeName?: string;
  fullAddress?: string;
  placeDetails?: PlaceDetails;
}

export interface LocationHistoryItem {
  id: string;
  lat: number;
  lng: number;
  timestamp: number;
  formattedTime: string;
  source: 'hardware' | 'test';
  distanceFromPrevious?: number; // in meters
  placeName?: string;
  fullAddress?: string;
  placeDetails?: PlaceDetails;
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'unsupported';

export interface SerialLogMessage {
  id: string;
  timestamp: string;
  type: 'rx' | 'info' | 'warn' | 'error' | 'gps_valid' | 'gps_invalid';
  message: string;
}
