import type { Route } from "next";
import Link from "next/link";

import { PinIcon } from "@/components/shared/icons";
import { t } from "@/i18n";

import { setDefaultAddress } from "../actions";
import type { Address } from "../types";

/**
 * One saved address in the prototype's `.addr` style: label (or governorate), governorate
 * and area, details, the default badge and a small pin when a map location is saved.
 * A server component: edit and delete are links, "تعيين كافتراضي" a one-field form, so
 * nothing here needs JavaScript (the delete confirmation is enhanced by one shared dialog).
 */
export function AddressCard({
  address,
  governorate,
  basePath,
}: {
  address: Address;
  governorate: string;
  basePath: string;
}) {
  const title = address.label?.trim() || governorate;
  const place = [governorate, address.area].filter(Boolean).join("، ");
  const hasLocation = address.latitude !== null && address.longitude !== null;
  return (
    <div className="lm-addr" data-address-id={address.id} role="listitem">
      <div className="lm-addr-head">
        <b>{title}</b>
        {address.is_default ? (
          <span className="lm-badge-default" data-testid="default-badge">
            {t("addresses.default")}
          </span>
        ) : null}
      </div>
      <span className="lm-addr-place">{place}</span>
      <p className="lm-addr-details">{address.details}</p>
      {address.notes ? <div className="lm-muted">{address.notes}</div> : null}
      {hasLocation ? (
        <span className="lm-addr-loc">
          <PinIcon />
          {t("addresses.hasLocation")}
        </span>
      ) : null}
      <div className="lm-addr-actions">
        <Link
          href={`${basePath}?edit=${address.id}` as Route}
          className="lm-link"
        >
          {t("addresses.edit")}
        </Link>
        {!address.is_default ? (
          <form action={setDefaultAddress}>
            <input type="hidden" name="id" value={address.id} />
            <button type="submit" className="lm-link">
              {t("addresses.setDefault")}
            </button>
          </form>
        ) : null}
        <Link
          href={`${basePath}?delete=${address.id}` as Route}
          className="lm-link danger"
          data-delete-address={address.id}
          data-label={title}
        >
          {t("addresses.delete")}
        </Link>
      </div>
    </div>
  );
}
