"use client";

import dynamic from "next/dynamic";
import { useId, useState } from "react";

import {
  formatCoordinate,
  governorateCenter,
  isWithinSyria,
  type LatLng,
} from "@/config/governorates";
import { t } from "@/i18n";

import { parseLocation } from "../address-validation";

// Leaflet and the map code are fetched only when an address form is on the page.
const LocationMap = dynamic(
  () => import("./location-map").then((module) => module.LocationMap),
  {
    ssr: false,
    loading: () => (
      <div className="lm-map lm-map-loading" role="status">
        {t("map.loading")}
      </div>
    ),
  },
);

type Status = { tone: "info" | "ok" | "error"; text: string } | null;

type Props = {
  governorate: string;
  latitude: string;
  longitude: string;
  /** The new pin, or null to clear the location. */
  onChange: (point: LatLng | null) => void;
  /** A server-side message about the location (the backend's INVALID_LOCATION text). */
  error?: string;
};

/**
 * The optional map location of an address: the map, "استخدم موقعي الحالي", "إزالة الموقع"
 * and a live region that announces what happened. The form's own fields still submit
 * when JavaScript, the tiles or the geolocation permission are missing.
 */
export function LocationPicker({
  governorate,
  latitude,
  longitude,
  onChange,
  error,
}: Props) {
  const helpId = useId();
  const [status, setStatus] = useState<Status>(null);
  const [locating, setLocating] = useState(false);
  const position = parseLocation({ latitude, longitude });

  const pick = (point: LatLng, how: "placed" | "moved" | "located") => {
    onChange({
      lat: Number(formatCoordinate(point.lat)),
      lng: Number(formatCoordinate(point.lng)),
    });
    setStatus({
      tone: "ok",
      text: t(
        how === "located"
          ? "map.located"
          : how === "moved"
            ? "map.moved"
            : "map.placed",
      ),
    });
  };

  const rejectOutside = () =>
    setStatus({ tone: "error", text: t("map.outside") });

  const useMyLocation = () => {
    if (!("geolocation" in navigator)) {
      setStatus({ tone: "error", text: t("map.unsupported") });
      return;
    }
    setLocating(true);
    setStatus({ tone: "info", text: t("map.locating") });
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        const point = { lat: coords.latitude, lng: coords.longitude };
        if (isWithinSyria(point.lat, point.lng)) pick(point, "located");
        else rejectOutside();
      },
      (failure) => {
        setLocating(false);
        setStatus({
          tone: "error",
          text: t(
            failure.code === failure.PERMISSION_DENIED
              ? "map.denied"
              : "map.unavailable",
          ),
        });
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const remove = () => {
    onChange(null);
    setStatus({ tone: "info", text: t("map.removed") });
  };

  return (
    <div className="lm-picker">
      <div className="lm-picker-head">
        <span className="lm-picker-title">{t("map.title")}</span>
        <span className="lm-hint">{t("map.optional")}</span>
      </div>
      <p className="lm-hint" id={helpId}>
        {t("map.help")}
      </p>
      <noscript>
        <p className="lm-hint">{t("map.needsScript")}</p>
      </noscript>
      <LocationMap
        position={position}
        center={governorateCenter(governorate)}
        onPick={(point, how) => pick(point, how)}
        onReject={rejectOutside}
        onTilesFailed={() =>
          setStatus({ tone: "error", text: t("map.tilesFailed") })
        }
        helpId={helpId}
      />
      <div className="lm-picker-actions">
        <button
          type="button"
          className="lm-btn ghost sm"
          onClick={useMyLocation}
          disabled={locating}
        >
          {t("map.useMyLocation")}
        </button>
        <button
          type="button"
          className="lm-btn ghost sm"
          onClick={remove}
          disabled={!position}
        >
          {t("map.removeLocation")}
        </button>
        {position ? (
          <span className="lm-hint lm-num" dir="ltr" data-testid="coords">
            {formatCoordinate(position.lat)}, {formatCoordinate(position.lng)}
          </span>
        ) : null}
      </div>
      <p
        className={status?.tone === "error" ? "lm-err" : "lm-hint"}
        role="status"
        aria-live="polite"
        data-testid="map-status"
      >
        {status?.text ?? ""}
      </p>
      {error ? (
        <p className="lm-err" role="alert" data-field-error="location">
          {error}
        </p>
      ) : null}
      <input type="hidden" name="latitude" value={latitude} />
      <input type="hidden" name="longitude" value={longitude} />
    </div>
  );
}
