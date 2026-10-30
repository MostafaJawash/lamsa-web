import { cookies } from "next/headers";

import { FLASH_COOKIE } from "../flash";
import { FlashPing } from "./flash-ping";

/**
 * For personal pages whose forms redirect back to the same URL (save an address, set the
 * default, cancel an order): the page reads the flash cookie the action left and hands it
 * to a tiny client component, so the toast shows after a client-side redirect too (the
 * layout's controller only looks again when the path changes).
 */
export async function PageFlash() {
  const raw = (await cookies()).get(FLASH_COOKIE)?.value ?? null;
  return <FlashPing raw={raw} />;
}
