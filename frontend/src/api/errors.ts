/** A failed API call, with the status and the server's own message. */
export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }

  get isUnauthenticated(): boolean {
    return this.status === 401;
  }
}

/** The server answers errors with a JSON string; a fiig fault is `{fault}`. */
export function messageOf(body: unknown, fallback: string): string {
  if (typeof body === "string" && body.length > 0) return body;
  if (typeof body === "object" && body !== null && "fault" in body) {
    return "The server had a problem. Try again in a moment.";
  }
  return fallback;
}

/** Unwraps an openapi-fetch result: the data, or a thrown ApiError. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.error !== undefined || !result.response.ok) {
    throw new ApiError(
      result.response.status,
      messageOf(result.error, `Request failed (${result.response.status})`),
    );
  }
  return result.data as T;
}
