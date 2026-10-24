import { isBackendReachable } from "@/features/system/queries";
import { t } from "@/i18n";

import { DismissibleNotice } from "./dismissible-notice";

/**
 * Development only: a small bar when the FastAPI backend doesn't answer. Render inside
 * <Suspense> (it reads at request time).
 */
export async function BackendNotice() {
  if (await isBackendReachable()) return null;
  return (
    <DismissibleNotice
      text={t("layout.backendDown")}
      dismissLabel={t("layout.dismiss")}
    />
  );
}
