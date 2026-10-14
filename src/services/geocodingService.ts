import { PlaceDetails } from '../types/gps';

export interface GeocodeResult {
  placeName: string;
  fullAddress: string;
  details: PlaceDetails;
}

const geocodeCache = new Map<string, GeocodeResult>();

/**
 * Format address elements into a clean, comma-separated string without duplicates
 */
function buildCleanAddress(parts: (string | undefined | null)[]): string {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const part of parts) {
    if (!part) continue;
    const trimmed = part.trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      cleaned.push(trimmed);
    }
  }

  return cleaned.join(', ');
}

export async function reverseGeocode(
  lat: number,
  lng: number
): Promise<GeocodeResult | null> {
  const cacheKey = `${lat.toFixed(5)}_${lng.toFixed(5)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey)!;
  }

  // Attempt 1: OpenStreetMap Nominatim (High-detail street address)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const addr = data.address || {};

      const landmark = addr.amenity || addr.building || addr.shop || addr.tourism || addr.historic || addr.leisure;
      const road = addr.road || addr.street || addr.footway || addr.path || addr.pedestrian;
      const neighbourhood = addr.neighbourhood || addr.suburb || addr.quarter || addr.residential;
      const suburb = addr.suburb || addr.hamlet;
      const city = addr.city || addr.town || addr.village || addr.municipality || addr.city_district;
      const county = addr.county || addr.district || addr.state_district;
      const state = addr.state || addr.province;
      const postcode = addr.postcode || addr.postal_code;
      const country = addr.country;

      // Construct verified full address
      const fullAddressParts = [
        landmark,
        addr.house_number ? `No. ${addr.house_number}` : undefined,
        road,
        neighbourhood,
        city,
        county ? `${county} Dist.` : undefined,
        state && postcode ? `${state} - ${postcode}` : state || postcode,
        country,
      ];

      const fullAddress = buildCleanAddress(fullAddressParts) || data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;

      // Construct short header place name
      const primaryTitle = landmark || road || neighbourhood || city || 'GPS Telemetry Location';
      const secondaryTitle = [city, state].filter(Boolean).join(', ');
      const placeName = secondaryTitle ? `${primaryTitle}, ${secondaryTitle}` : primaryTitle;

      const details: PlaceDetails = {
        display_name: data.display_name,
        fullAddress,
        landmark,
        road,
        suburb,
        neighbourhood,
        city,
        county,
        state,
        country,
        postcode,
      };

      const result: GeocodeResult = { placeName, fullAddress, details };
      geocodeCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    // Proceed to fallback
  }

  // Attempt 2: BigDataCloud Client Reverse Geocoding (Free, instant fallback)
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const bdcUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`;
    const response = await fetch(bdcUrl, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const locality = data.locality || data.city;
      const adminArea = data.principalSubdivision; // e.g. Kerala
      const country = data.countryName;
      const postcode = data.postcode;

      const fullAddressParts = [locality, adminArea && postcode ? `${adminArea} - ${postcode}` : adminArea, country];
      const fullAddress = buildCleanAddress(fullAddressParts) || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      const placeName = locality ? `${locality}, ${adminArea}` : fullAddress;

      const details: PlaceDetails = {
        display_name: fullAddress,
        fullAddress,
        city: locality,
        state: adminArea,
        country,
        postcode,
      };

      const result: GeocodeResult = { placeName, fullAddress, details };
      geocodeCache.set(cacheKey, result);
      return result;
    }
  } catch (err) {
    // Return coordinate fallback
  }

  return {
    placeName: `Location (${lat.toFixed(4)}°, ${lng.toFixed(4)}°)`,
    fullAddress: `GPS Fix: Latitude ${lat.toFixed(6)}°, Longitude ${lng.toFixed(6)}°`,
    details: {},
  };
}
