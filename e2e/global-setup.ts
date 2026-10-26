import {
  backendUp,
  makeAdmin,
  PASSWORD,
  registerViaApi,
  uniquePhone,
} from "./support/backend";

/**
 * A test admin for the must_change_password test (POST /admin/users/{id}/reset-password):
 * registered through the API, promoted with the backend's scripts.make_admin, deleted
 * in global-teardown.ts. Workers read it from the environment.
 */
export default async function globalSetup() {
  if (!(await backendUp())) return;
  const phone = uniquePhone();
  await registerViaApi(`e2e-admin-${Date.now()}`, phone.e164, PASSWORD);
  makeAdmin(phone.e164);
  process.env.E2E_ADMIN_PHONE = phone.e164;
  process.env.E2E_ADMIN_PASSWORD = PASSWORD;
}
