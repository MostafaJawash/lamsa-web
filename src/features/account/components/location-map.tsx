"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";

import {
  formatCoordinate,
  isWithinSyria,
  type LatLng,
} from "@/config/governorates";
import { t } from "@/i18n";
import { publicEnv } from "@/lib/env.public";

/** Arrow keys move the pin by this much (about 55 m); Shift moves it ten times as far. */
const NUDGE = 0.0005;
const PIN_ZOOM = 15;
const REGION_ZOOM = 9;

const PIN_SVG =
  '<svg viewBox="0 0 32 42" width="32" height="42" aria-hidden="true">' +
  '<path d="M16 1C8 1 2 7 2 15c0 10 14 25 14 25s14-15 14-25C30 7 24 1 16 1z" ' +
  'style="fill:var(--lamsa-accent)" stroke="#fff" stroke-width="2"/>' +
  '<circle cx="16" cy="15" r="5" fill="#fff"/></svg>';

const pinIcon = L.divIcon({
  className: "lm-map-pin",
  html: PIN_SVG,
  iconSize: [32, 42],
  iconAnchor: [16, 40],
});

type Props = {
  /** The pin, or null when no location is set. */
  position: LatLng | null;
  /** Where to look when there is no pin (the chosen governorate, else Damascus). */
  center: LatLng;
  /** A valid pin was placed, dragged or nudged (always inside Syria). */
  onPick: (point: LatLng, how: "placed" | "moved") => void;
  /** The customer tried a point outside Syria; the pin stays where it was. */
  onReject: () => void;
  /** The tile server could not be reached (the form still works). */
  onTilesFailed: () => void;
  /** Id of the element that explains the keys (aria-describedby). */
  helpId: string;
};

/**
 * Leaflet map over the configured tile layer (OpenStreetMap by default; the attribution
 * stays visible). Click or tap places a draggable pin; the focused map is keyboard
 * operable: arrow keys nudge the pin (or pan before there is one), Enter or Space drops
 * a pin at the centre, + and - zoom. Its direction is always LTR, as Leaflet requires,
 * without affecting the RTL page around it. Client-only (Leaflet needs the DOM), so the
 * form loads it with a dynamic import.
 */
export function LocationMap({
  position,
  center,
  onPick,
  onReject,
  onTilesFailed,
  helpId,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const latest = useRef({ position, onPick, onReject, onTilesFailed });

  useEffect(() => {
    latest.current = { position, onPick, onReject, onTilesFailed };
  });

  // Create the map once.
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const initial = latest.current.position;
    const map = L.map(element, {
      center: initial ?? center,
      zoom: initial ? PIN_ZOOM : REGION_ZOOM,
      keyboard: false,
      worldCopyJump: false,
    });
    mapRef.current = map;
    const tiles = L.tileLayer(publicEnv.NEXT_PUBLIC_MAP_TILE_URL, {
      attribution: publicEnv.NEXT_PUBLIC_MAP_ATTRIBUTION,
      maxZoom: 19,
    });
    let failedOnce = false;
    tiles.on("tileerror", () => {
      if (failedOnce) return;
      failedOnce = true;
      latest.current.onTilesFailed();
    });
    tiles.addTo(map);

    const pick = (point: LatLng, how: "placed" | "moved") => {
      if (!isWithinSyria(point.lat, point.lng)) {
        latest.current.onReject();
        return false;
      }
      latest.current.onPick(point, how);
      return true;
    };

    map.on("click", (event: L.LeafletMouseEvent) => {
      pick(
        { lat: event.latlng.lat, lng: event.latlng.lng },
        latest.current.position ? "moved" : "placed",
      );
    });

    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current.position;
      const step = NUDGE * (event.shiftKey ? 10 : 1);
      const delta: Record<string, [number, number]> = {
        ArrowUp: [step, 0],
        ArrowDown: [-step, 0],
        ArrowLeft: [0, -step],
        ArrowRight: [0, step],
      };
      const move = delta[event.key];
      if (move) {
        event.preventDefault();
        if (current)
          pick(
            { lat: current.lat + move[0], lng: current.lng + move[1] },
            "moved",
          );
        else map.panBy([move[1] * 20000, -move[0] * 20000]);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        const middle = map.getCenter();
        pick(
          { lat: middle.lat, lng: middle.lng },
          current ? "moved" : "placed",
        );
      } else if (event.key === "+" || event.key === "=") {
        map.zoomIn();
      } else if (event.key === "-" || event.key === "_") {
        map.zoomOut();
      }
    };
    element.addEventListener("keydown", onKeyDown);

    return () => {
      element.removeEventListener("keydown", onKeyDown);
      markerRef.current = null;
      mapRef.current = null;
      map.remove();
    };
    // The map is created once; later props are applied by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the pin in step with `position`.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!position) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const point = L.latLng(position.lat, position.lng);
    if (!markerRef.current) {
      const marker = L.marker(point, {
        icon: pinIcon,
        draggable: true,
        keyboard: false,
        title: t("map.pin"),
      });
      marker.on("dragend", () => {
        const dropped = marker.getLatLng();
        if (isWithinSyria(dropped.lat, dropped.lng)) {
          latest.current.onPick(
            { lat: dropped.lat, lng: dropped.lng },
            "moved",
          );
        } else {
          // Outside Syria: put the pin back where it was.
          const before = latest.current.position;
          if (before) marker.setLatLng([before.lat, before.lng]);
          latest.current.onReject();
        }
      });
      marker.addTo(map);
      markerRef.current = marker;
    } else {
      markerRef.current.setLatLng(point);
    }
    if (!map.getBounds().contains(point)) map.panTo(point);
    else if (map.getZoom() < 12) map.setView(point, PIN_ZOOM);
  }, [position]);

  // With no pin, follow the governorate the customer picks.
  const centerLat = center.lat;
  const centerLng = center.lng;
  useEffect(() => {
    const map = mapRef.current;
    if (!map || latest.current.position) return;
    map.setView([centerLat, centerLng], REGION_ZOOM);
  }, [centerLat, centerLng]);

  return (
    <>
      {/* Leaflet's stylesheet, a static file loaded with the map only (not in the global CSS). */}
      {/* A React 19 stylesheet resource (precedence), not a page-level css tag. */}
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link
        rel="stylesheet"
        href="/vendor/leaflet/leaflet.css"
        precedence="lm-leaflet"
      />
      <div
        ref={container}
        className="lm-map"
        dir="ltr"
        tabIndex={0}
        role="group"
        aria-label={t("map.label")}
        aria-describedby={helpId}
        data-has-pin={position ? "true" : "false"}
        data-pin={
          position
            ? `${formatCoordinate(position.lat)},${formatCoordinate(position.lng)}`
            : undefined
        }
      />
    </>
  );
}
