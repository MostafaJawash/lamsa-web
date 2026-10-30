import { PageFlash } from "@/features/cart/components/page-flash";
import type { Metadata } from "next";
import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AccountShell } from "@/components/layout/account-shell";
import { PageChrome } from "@/components/layout/page-chrome";
import { EmptyState } from "@/components/shared/empty-state";
import { PinIcon } from "@/components/shared/icons";
import {
  deleteAddress,
  saveAddress,
  type AddressFormState,
} from "@/features/account/actions";
import { AddressCard } from "@/features/account/components/address-card";
import { AddressForm } from "@/features/account/components/address-form";
import { DeleteAddressDialog } from "@/features/account/components/delete-address-dialog";
import {
  getAddresses,
  getGovernorates,
  governorateName,
} from "@/features/account/queries";
import type { Address } from "@/features/account/types";
import { t } from "@/i18n";
import { requireUser } from "@/lib/auth/user";
import { readFailure } from "@/lib/form-failure";

const PATH = "/account/addresses";

/** Personal, always fresh: rendered in full per request, like /cart (works without JavaScript). */
export const instant = false;

export const metadata: Metadata = {
  title: t("pages.addresses"),
  robots: { index: false, follow: false },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function idParam(value: string | string[] | undefined): number | null {
  const first = Array.isArray(value) ? value[0] : value;
  return first && /^\d{1,9}$/.test(first) ? Number(first) : null;
}

function initialValues(address: Address) {
  return {
    label: address.label ?? "",
    governorate: address.governorate,
    area: address.area ?? "",
    details: address.details,
    notes: address.notes ?? "",
    latitude: address.latitude === null ? "" : String(address.latitude),
    longitude: address.longitude === null ? "" : String(address.longitude),
  };
}

/** Addresses (prototype `pAccount()` addresses section): cards, add, edit, delete, default. */
export default async function AddressesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const user = await requireUser(PATH);
  const params = await searchParams;
  const unavailable = (
    <PageChrome path={PATH}>
      <AccountShell>
        <div className="lm-list-head">
          <h1>{t("pages.addresses")}</h1>
        </div>
        <EmptyState icon={<PinIcon />} title={t("addresses.unavailable")} />
      </AccountShell>
    </PageChrome>
  );
  if (!user) return unavailable;
  const [result, governorates] = await Promise.all([
    getAddresses(),
    getGovernorates(),
  ]);
  if (result.status === "unavailable") return unavailable;
  const names = governorates.status === "ok" ? governorates.data : [];
  const { addresses } = result;

  const editing = addresses.find((a) => a.id === idParam(params.edit)) ?? null;
  const deleting =
    addresses.find((a) => a.id === idParam(params.delete)) ?? null;
  // An address that is not the customer's own (or no longer exists) is simply not found.
  if (
    (params.edit !== undefined && !editing) ||
    (params.delete !== undefined && !deleting)
  )
    notFound();
  const adding = !editing && params.new !== undefined;

  return (
    <PageChrome path={PATH}>
      <AccountShell>
        <div className="lm-list-head">
          <h1>{t("pages.addresses")}</h1>
          {!adding && !editing ? (
            <Link href={`${PATH}?new=1` as Route} className="lm-more lm-link">
              {t("addresses.add")}
            </Link>
          ) : null}
        </div>
        <p className="lm-muted">{t("addresses.sub")}</p>

        {adding || editing ? (
          <section
            className="lm-box"
            aria-label={t(
              editing ? "addresses.editTitle" : "addresses.newTitle",
            )}
          >
            <h2 className="lm-box-title">
              {t(editing ? "addresses.editTitle" : "addresses.newTitle")}
            </h2>
            {governorates.status === "ok" ? (
              <AddressForm
                key={editing?.id ?? "new"}
                action={saveAddress}
                governorates={names}
                initial={editing ? initialValues(editing) : undefined}
                initialState={readFailure<AddressFormState>(params.fs)}
                addressId={editing?.id}
                returnTo="addresses"
                offerDefault={
                  editing ? !editing.is_default : addresses.length > 0
                }
                cancelHref={PATH as Route}
              />
            ) : (
              <p className="lm-err">{t("addresses.governoratesUnavailable")}</p>
            )}
          </section>
        ) : null}

        {deleting ? (
          <div
            className="lm-confirm"
            role="alertdialog"
            aria-label={t("addresses.deleteTitle")}
          >
            <p>
              {t("addresses.deleteTextNamed", {
                label:
                  deleting.label?.trim() ||
                  governorateName(names, deleting.governorate),
              })}
            </p>
            <form action={deleteAddress} className="lm-addr-actions">
              <input type="hidden" name="id" value={deleting.id} />
              <button type="submit" className="lm-btn primary sm">
                {t("addresses.deleteConfirm")}
              </button>
              <Link href={PATH as Route} className="lm-btn ghost sm">
                {t("addresses.cancel")}
              </Link>
            </form>
          </div>
        ) : null}

        {addresses.length === 0 ? (
          !adding ? (
            <EmptyState
              icon={<PinIcon />}
              title={t("addresses.emptyTitle")}
              text={t("addresses.emptyText")}
              action={
                <Link
                  href={`${PATH}?new=1` as Route}
                  className="lm-btn primary"
                >
                  {t("addresses.addFirst")}
                </Link>
              }
            />
          ) : null
        ) : (
          <div role="list" aria-label={t("pages.addresses")}>
            {addresses.map((address) => (
              <AddressCard
                key={address.id}
                address={address}
                governorate={governorateName(names, address.governorate)}
                basePath={PATH}
              />
            ))}
          </div>
        )}
        <PageFlash />
        <DeleteAddressDialog />
      </AccountShell>
    </PageChrome>
  );
}
