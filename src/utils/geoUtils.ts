/**
 * Calculate distance between two coordinates in meters using the Haversine formula
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * Validate latitude and longitude according to standard WGS84 bounds
 * and rejects ungrounded coordinates (such as 0.0, 0.0 which indicates GPS module search/no-fix)
 */
export function validateGPS(lat: unknown, lng: unknown): { valid: boolean; error?: string; lat?: number; lng?: number } {
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    // Attempt parse if string
    const numLat = typeof lat === 'string' ? parseFloat(lat) : Number(lat);
    const numLng = typeof lng === 'string' ? parseFloat(lng) : Number(lng);

    if (isNaN(numLat) || isNaN(numLng)) {
      return { valid: false, error: 'Coordinates are not valid numbers' };
    }
    return validateGPS(numLat, numLng);
  }

  if (isNaN(lat) || isNaN(lng)) {
    return { valid: false, error: 'Latitude or Longitude is NaN' };
  }

  if (lat < -90 || lat > 90) {
    return { valid: false, error: `Latitude ${lat} out of range [-90, 90]` };
  }

  if (lng < -180 || lng > 180) {
    return { valid: false, error: `Longitude ${lng} out of range [-180, 180]` };
  }

  // Reject (0, 0) null island which GPS modules like NEO-6M report before acquiring satellite lock
  if (Math.abs(lat) < 0.000001 && Math.abs(lng) < 0.000001) {
    return { valid: false, error: 'Latitude and Longitude are (0,0) - No GPS satellite fix yet' };
  }

  return { valid: true, lat, lng };
}

/**
 * Formats time elapsed into human-friendly string
 */
export function formatTimeAgo(timestamp: number, now: number = Date.now()): string {
  const diffSec = Math.floor((now - timestamp) / 1000);
  if (diffSec < 2) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  const remSec = diffSec % 60;
  if (diffMin < 60) return `${diffMin}m ${remSec}s ago`;
  const diffHours = Math.floor(diffMin / 60);
  return `${diffHours}h ${diffMin % 60}m ago`;
}

/**
 * Format timestamp to readable date-time string
 */
export function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
    hour12: true,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestamp));
}

/**
 * Generate Google Maps URL
 */
export function getGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
