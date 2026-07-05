/**
 * Extracts a human-readable message from a FastEndpoints error response.
 *
 * FastEndpoints returns:
 *   { statusCode, message: "One or more errors occurred!", errors: { "field": ["msg1"] } }
 *
 * We want the first actual error string, not the generic wrapper message.
 */
// Common ethers.js error codes (see https://docs.ethers.org/v6/api/utils/#ErrorCode)
const ETHERS_ERROR_MESSAGES: Record<string, string> = {
  ACTION_REJECTED: 'You rejected the request in your wallet.',
  INSUFFICIENT_FUNDS: 'Insufficient funds to complete this transaction.',
  NETWORK_ERROR: 'A network error occurred. Please check your connection and try again.',
  TIMEOUT: 'The request timed out. Please try again.',
  UNSUPPORTED_OPERATION: 'This operation is not supported by your wallet.',
  UNCONFIGURED_NAME: 'Unable to resolve the wallet address.',
  CALL_EXCEPTION: 'The transaction was rejected by the smart contract.',
};

export function extractApiError(err: any, fallback: string): string {
  // ethers.js errors carry a stable `code` (e.g. "ACTION_REJECTED") instead of
  // a parseable `error`/`message`; map those before falling back to raw text.
  if (typeof err?.code === 'string' && ETHERS_ERROR_MESSAGES[err.code]) {
    return ETHERS_ERROR_MESSAGES[err.code];
  }

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
