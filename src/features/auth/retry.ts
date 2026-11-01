import { ApiError } from "@/lib/errors";

/** SERVICE_BUSY: wait Retry-After (capped) and retry once, as the backend asks. */
const BUSY_RETRY_MAX_SECONDS = 5;

export async function retryOnceIfBusy<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    if (!(error instanceof ApiError) || !error.is("SERVICE_BUSY")) throw error;
    const seconds = Math.min(error.retryAfter ?? 1, BUSY_RETRY_MAX_SECONDS);
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
    return call();
  }
}
