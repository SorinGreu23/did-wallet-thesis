/**
 * Extracts a human-readable message from a FastEndpoints error response.
 *
 * FastEndpoints returns:
 *   { statusCode, message: "One or more errors occurred!", errors: { "field": ["msg1"] } }
 *
 * We want the first actual error string, not the generic wrapper message.
 */
export function extractApiError(err: any, fallback: string): string {
  // FastEndpoints errors object: Record<string, string[]>
  const errorsObj = err?.error?.errors;
  if (errorsObj && typeof errorsObj === 'object') {
    const firstMessages = Object.values(errorsObj as Record<string, string[]>);
    const first = firstMessages.find(arr => Array.isArray(arr) && arr.length > 0);
    if (first) return (first as string[])[0];
  }

  // Plain string message fallback
  return err?.error?.message ?? err?.message ?? fallback;
}
