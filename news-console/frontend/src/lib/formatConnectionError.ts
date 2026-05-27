/** User-facing MongoDB connection error (max ~2 sentences). */
const GENERIC =
  'Could not connect to MongoDB. Verify the connection URL and that the server is running.';

const STACK_TRACE_PATTERN =
  /MongoDB\.Driver|CompositeServerSelector|at \w+\.|StackTrace|SocketException/i;

/**
 * Returns a short connection error for the landing page.
 * Sanitizes raw driver stack traces if the API ever returns them.
 */
export function formatConnectionError(message: string | undefined | null): string {
  const trimmed = message?.trim();
  if (!trimmed) {
    return GENERIC;
  }
  if (trimmed.length > 200 || STACK_TRACE_PATTERN.test(trimmed)) {
    return GENERIC;
  }
  return trimmed;
}
