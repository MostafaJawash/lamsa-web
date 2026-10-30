/**
 * account: types.
 * Profile, phone change, account deletion, addresses and notification preferences.
 *
 * Belongs here: aliases of the generated backend schemas (src/lib/api/schema.d.ts) and
 * UI-only types of this feature. Never hand-write a type the backend already describes.
 */
import type { Schema } from "@/lib/api/types";

export type Address = Schema<"AddressOut">;
export type AddressCreate = Schema<"AddressCreate">;
export type AddressUpdate = Schema<"AddressUpdate">;
export type Governorate = Schema<"GovernorateOut">;
export type NotificationPreferences = Schema<"PreferencesOut">;
