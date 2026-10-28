"use client";

import { useState } from "react";

import { createCheckoutAddress } from "../actions";

type Governorate = { code: string; name: string };

/** Browser-only location controls; submitting remains a normal server action. */
export function CheckoutAddressForm({ governorates }: { governorates: Governorate[] }) {
  const [position, setPosition] = useState<{ latitude: string; longitude: string } | null>(null);
  const [locationError, setLocationError] = useState("");
  const useCurrentLocation = () => {
    if (!navigator.geolocation) { setLocationError("المتصفح لا يدعم تحديد الموقع."); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setPosition({ latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) });
        setLocationError("");
      },
      () => setLocationError("تعذر الحصول على موقعك. اختره يدوياً أو أكمل العنوان."),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };
  return (
    <form action={createCheckoutAddress} className="lm-summary">
      <h2>إضافة عنوان توصيل</h2>
      <label>المحافظة<select className="lm-inp" name="governorate" required>{governorates.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select></label>
      <label>المنطقة<input className="lm-inp" name="area" maxLength={100} /></label>
      <label>التفاصيل<input className="lm-inp" name="details" minLength={10} maxLength={500} required /></label>
      <input type="hidden" name="latitude" value={position?.latitude ?? ""} />
      <input type="hidden" name="longitude" value={position?.longitude ?? ""} />
      <div className="lm-location-map" aria-label="خريطة الموقع">
        <span>📍 {position ? `${position.latitude}, ${position.longitude}` : "ضع دبوس الموقع أو استخدم موقعك الحالي"}</span>
      </div>
      <button className="lm-btn ghost" type="button" onClick={useCurrentLocation}>استخدم موقعي الحالي</button>
      {locationError ? <p className="lm-err">{locationError}</p> : null}
      <button className="lm-btn primary" type="submit">حفظ العنوان</button>
    </form>
  );
}
