import { deletePhoneAccount } from "./support/backend";

export default async function globalTeardown() {
  const phone = process.env.E2E_ADMIN_PHONE;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (phone && password) await deletePhoneAccount(phone, [password]);
}
