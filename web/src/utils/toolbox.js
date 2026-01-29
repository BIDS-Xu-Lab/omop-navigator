/**
 * Truncate a string to the first n characters and append "..." if truncated.
 * @param str - input string
 * @param n - max characters to keep (default 10)
 */
export function truncate(str, n = 10) {
  // Coerce non-string inputs safely
  if (typeof str !== 'string') {
    str = String(str ?? '');
  }

  if (n <= 0) {
    return str;
  }

  // Normalize n
  n = Math.max(0, Math.floor(n));

  if (str.length <= n) {
    return str;
  }

  return str.slice(0, n) + '...';
}