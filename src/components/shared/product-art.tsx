/**
 * Inline drawings from the prototype `drawing()` (200×200 viewBox), used only where no
 * real image exists: product silhouettes and the fallback banners.
 */
const INK = "#3A2934";
const GOLD = "#C9A46A";

function Shadow() {
  return <ellipse cx="100" cy="179" rx="54" ry="7" fill="#000" opacity=".08" />;
}

/** Prototype "bottle" shape in neutral tones: products without (or with a broken) image. */
export function ProductSilhouette() {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <Shadow />
      <g style={{ fill: "var(--lamsa-muted)" }} opacity=".55">
        <rect x="90" y="26" width="20" height="18" rx="4" />
        <rect x="84" y="42" width="32" height="16" rx="5" />
      </g>
      <path
        d="M68 72q0-14 16-14h32q16 0 16 14v94q0 8-8 8H76q-8 0-8-8z"
        style={{ fill: "var(--lamsa-muted)" }}
        opacity=".3"
      />
      <rect
        x="80"
        y="98"
        width="40"
        height="44"
        rx="4"
        fill="#fff"
        opacity=".6"
      />
      <rect
        x="74"
        y="68"
        width="7"
        height="96"
        rx="3.5"
        fill="#fff"
        opacity=".25"
      />
    </svg>
  );
}

const PALETTE_SWATCHES = [
  "#E8C2A8",
  "#C98F78",
  "#8E5A4E",
  "#D9B98C",
  "#7A4E9C",
  "#5A3A48",
];

/** Prototype product 3 (eyeshadow palette), used on the fallback sale banner. */
export function PaletteArt() {
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <Shadow />
      <rect x="34" y="52" width="132" height="100" rx="14" fill={INK} />
      {PALETTE_SWATCHES.map((hex, i) => (
        <circle
          key={hex}
          cx={60 + (i % 3) * 40}
          cy={82 + Math.floor(i / 3) * 40}
          r="15"
          fill={hex}
        />
      ))}
    </svg>
  );
}

/** Prototype product 11 (perfume, #B98DB9), used on the fallback "new" banner. */
export function PerfumeArt() {
  const color = "#B98DB9";
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <Shadow />
      <rect x="86" y="30" width="28" height="22" rx="5" fill={GOLD} />
      <rect x="93" y="50" width="14" height="14" fill={GOLD} opacity=".75" />
      <rect
        x="56"
        y="62"
        width="88"
        height="112"
        rx="20"
        fill={color}
        opacity=".92"
      />
      <rect
        x="66"
        y="72"
        width="14"
        height="92"
        rx="7"
        fill="#fff"
        opacity=".28"
      />
      <rect
        x="80"
        y="110"
        width="40"
        height="22"
        rx="3"
        fill="#fff"
        opacity=".75"
      />
    </svg>
  );
}
