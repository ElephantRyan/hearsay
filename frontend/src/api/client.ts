import createClient from "openapi-fetch";
import type { paths } from "./schema";

/** The only place the network is configured. Every call goes through `api`. */
const origin = globalThis.location?.origin ?? "http://localhost";

export const API_BASE = `${origin}/api`;

export const api = createClient<paths>({
  baseUrl: API_BASE,
  credentials: "include",
  // Looked up per call, not captured at import: tests (and any fetch wrapper)
  // that replace globalThis.fetch after this module loads still take effect.
  fetch: (request) => globalThis.fetch(request),
});
