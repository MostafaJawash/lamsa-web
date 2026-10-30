/**
 * The 14 Syrian governorates, as the backend's `GET /governorates` lists them (the names
 * come from there). This file only adds what the backend does not know: the map centre
 * of each governorate, used to open the address map where the customer is likely to be.
 * Codes the backend adds later fall back to Damascus.
 */
export const governorateCodes = [
  "damascus",
  "rif_dimashq",
  "aleppo",
  "homs",
  "hama",
  "latakia",
  "tartus",
  "idlib",
  "deir_ez_zor",
  "raqqa",
  "hasakah",
  "daraa",
  "as_suwayda",
  "quneitra",
] as const;

export type GovernorateCode = (typeof governorateCodes)[number];

export type LatLng = { lat: number; lng: number };

/** Approximate centre of each governorate (its capital city). */
export const governorateCenters: Record<GovernorateCode, LatLng> = {
  damascus: { lat: 33.5138, lng: 36.2765 },
  rif_dimashq: { lat: 33.5731, lng: 36.4046 },
  aleppo: { lat: 36.2021, lng: 37.1343 },
  homs: { lat: 34.7324, lng: 36.7137 },
  hama: { lat: 35.1318, lng: 36.7578 },
  latakia: { lat: 35.5317, lng: 35.7915 },
  tartus: { lat: 34.889, lng: 35.8866 },
  idlib: { lat: 35.9306, lng: 36.6339 },
  deir_ez_zor: { lat: 35.3359, lng: 40.1408 },
  raqqa: { lat: 35.9528, lng: 39.0079 },
  hasakah: { lat: 36.5024, lng: 40.7477 },
  daraa: { lat: 32.6189, lng: 36.1021 },
  as_suwayda: { lat: 32.709, lng: 36.5663 },
  quneitra: { lat: 33.1257, lng: 35.824 },
};

export const DEFAULT_CENTER: LatLng = governorateCenters.damascus;

/** The same rough box the backend accepts for an address location (it checks it too). */
export const SYRIA_BOUNDS = {
  south: 32.3,
  north: 37.4,
  west: 35.6,
  east: 42.4,
} as const;

export function isGovernorateCode(value: string): value is GovernorateCode {
  return (governorateCodes as readonly string[]).includes(value);
}

/** Where to open the map for a governorate code (Damascus when none or unknown). */
export function governorateCenter(code: string | null | undefined): LatLng {
  return code && isGovernorateCode(code)
    ? governorateCenters[code]
    : DEFAULT_CENTER;
}

/** Whether a point lies inside the rough bounding box of Syria. */
export function isWithinSyria(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= SYRIA_BOUNDS.south &&
    lat <= SYRIA_BOUNDS.north &&
    lng >= SYRIA_BOUNDS.west &&
    lng <= SYRIA_BOUNDS.east
  );
}

/** A coordinate as the backend wants it: at most 6 decimal places. */
export function formatCoordinate(value: number): string {
  return value.toFixed(6);
}
