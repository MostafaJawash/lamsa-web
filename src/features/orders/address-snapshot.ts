/**
 * The address stored on an order (`shipping_address`, a free-form object the backend keeps
 * as it was when the order was placed). Orders placed after the Syria adaptation carry
 * `{label, governorate, area, details, latitude, longitude, notes}`; older ones carry
 * `{city, street, building, notes}`, and old pickup orders carry none. This reads
 * whichever shape is there without guessing and without failing on odd values.
 */
export type AddressSnapshotView = {
  /** Display lines, most important first (label, governorate and area, details). */
  lines: string[];
  notes: string | null;
  /** A map location, only when both coordinates are finite numbers. */
  location: { lat: string; lng: string } | null;
};

function str(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function coordinate(value: unknown): string | null {
  const text = str(value);
  if (text === "" || !Number.isFinite(Number(text))) return null;
  return text;
}

export function describeAddressSnapshot(
  snapshot: Record<string, unknown> | null | undefined,
  governorateName: (code: string) => string,
): AddressSnapshotView | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const lines: string[] = [];
  const notes = str(snapshot.notes) || null;

  if ("governorate" in snapshot || "details" in snapshot) {
    const label = str(snapshot.label);
    const code = str(snapshot.governorate);
    const place = [code ? governorateName(code) : "", str(snapshot.area)]
      .filter(Boolean)
      .join("، ");
    for (const line of [label, place, str(snapshot.details)])
      if (line) lines.push(line);
    const lat = coordinate(snapshot.latitude);
    const lng = coordinate(snapshot.longitude);
    return {
      lines,
      notes,
      location: lat !== null && lng !== null ? { lat, lng } : null,
    };
  }

  // The city / street / building snapshot of orders placed before the Syria adaptation.
  for (const key of ["city", "street", "building"]) {
    const line = str(snapshot[key]);
    if (line) lines.push(line);
  }
  return lines.length > 0 || notes ? { lines, notes, location: null } : null;
}

/** An OpenStreetMap link for a point (the website's own map provider, not Google). */
export function openStreetMapUrl(location: {
  lat: string;
  lng: string;
}): string {
  const lat = encodeURIComponent(location.lat);
  const lng = encodeURIComponent(location.lng);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
}
