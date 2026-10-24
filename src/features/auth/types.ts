/**
 * auth: types.
 * Sign-in flows: phone + password login/register, Google sign-in and completion, logout, password change. Server actions here set the session cookies through src/lib/auth/session.ts.
 *
 * Belongs here: aliases of the generated backend schemas (src/lib/api/schema.d.ts) and
 * UI-only types of this feature. Never hand-write a type the backend already describes.
 */
import type { Schema } from "@/lib/api/types";

export type TokenPair = Schema<"TokenPair">;
export type User = Schema<"UserOut">;
export type LoginRequest = Schema<"LoginRequest">;
export type RegisterRequest = Schema<"RegisterRequest">;
export type GoogleLoginResponse = Schema<"GoogleLoginResponse">;
