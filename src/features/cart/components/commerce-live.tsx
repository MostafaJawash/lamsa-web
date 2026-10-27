import { headers } from "next/headers";

import { decodeFlash, FLASH_HEADER, flashToast } from "../flash";
import { CommerceController } from "./commerce-controller";

/**
 * The client controller, inside a small <Suspense fallback={null}> hole of the layout
 * because it receives the flash the proxy handed over for this document request (see
 * src/proxy.ts). Without JavaScript that flash is shown as a CSS-only toast.
 */
export async function CommerceLive() {
  const raw = (await headers()).get(FLASH_HEADER);
  const decoded = decodeFlash(raw);
  const view = decoded ? flashToast(decoded.flash) : null;
  return (
    <>
      <CommerceController flash={decoded ? raw : null} />
      {view ? (
        <noscript>
          <div className="lm-toast lm-static" role="status">
            <span>
              {view.text}
              {view.sub ? <span className="t-sub">{view.sub}</span> : null}
            </span>
            {view.action ? (
              <a href={view.action.href}>{view.action.label}</a>
            ) : null}
          </div>
        </noscript>
      ) : null}
    </>
  );
}
