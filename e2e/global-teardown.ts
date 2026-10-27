import { deletePhoneAccount, deleteStaleE2eAccounts } from "./support/backend";

export default async function globalTeardown() {
  const phone = process.env.E2E_ADMIN_PHONE;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!phone || !password) return;
  await deleteStaleE2eAccounts(
    phone,
    password,
    new Date(Date.now() - 60 * 60 * 1000),
  );
  await deletePhoneAccount(phone, [password]);
}
