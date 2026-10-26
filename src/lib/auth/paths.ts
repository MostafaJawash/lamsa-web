/** Auth routes and the route rules shared by src/proxy.ts and the pages. */
export const LOGIN_PATH = "/login";
export const REGISTER_PATH = "/register";
export const COMPLETE_PROFILE_PATH = "/complete-profile";
export const ACCOUNT_PATH = "/account";
export const CHANGE_PASSWORD_PATH = "/account/change-password";

function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** Guests are sent to /login?next=… (the account area and checkout). */
export function isProtectedPath(pathname: string): boolean {
  return isUnder(pathname, "/account") || isUnder(pathname, "/checkout");
}

/** Signed-in visitors are sent on to `next` (or "/"). */
export function isGuestOnlyPath(pathname: string): boolean {
  return pathname === LOGIN_PATH || pathname === REGISTER_PATH;
}

/** While a temporary password must be changed, every other page redirects here. */
export function isPasswordChangePath(pathname: string): boolean {
  return pathname === CHANGE_PASSWORD_PATH;
}
