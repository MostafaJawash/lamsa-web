"use client";

import { useEffect } from "react";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";

type Position = { latitude: string; longitude: string } | null;
type MapPosition = { lat: number; lng: number };

const DAMASCUS: MapPosition = { lat: 33.5138, lng: 36.2765 };
const pin = L.divIcon({
  className: "lm-map-pin",
  html: "📍",
  iconSize: [28, 36],
  iconAnchor: [14, 34],
});

function parsePosition(position: Position): MapPosition | null {
  if (!position) return null;
  const lat = Number(position.latitude);
  const lng = Number(position.longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function Recenter({ point }: { point: MapPosition }) {
  const map = useMap();
  useEffect(() => { map.setView(point, Math.max(map.getZoom(), 13)); }, [map, point.lat, point.lng]);
  return null;
}

function PickPin({ onChange }: { onChange: (position: Position) => void }) {
  useMapEvents({
    click(event) {
      onChange({ latitude: event.latlng.lat.toFixed(6), longitude: event.latlng.lng.toFixed(6) });
    },
  });
  return null;
}

/** OpenStreetMap picker. Coordinates are still validated by the backend as Syrian bounds. */
export function LocationMap({ position, onChange }: { position: Position; onChange: (position: Position) => void }) {
  const point = parsePosition(position);
  return (
    <div className="lm-location-map" aria-label="خريطة اختيار الموقع">
      <MapContainer center={point ?? DAMASCUS} zoom={point ? 13 : 7} scrollWheelZoom className="lm-leaflet-map">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <PickPin onChange={onChange} />
        {point ? <><Recenter point={point} /><Marker position={point} icon={pin} /></> : null}
      </MapContainer>
      <span className="lm-map-caption">{point ? `${position?.latitude}, ${position?.longitude}` : "اضغط على الخريطة لوضع الدبوس"}</span>
    </div>
  );
}
