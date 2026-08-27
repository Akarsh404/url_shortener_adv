import crypto from 'crypto';

/**
 * Base62 character set: a-z, A-Z, 0-9
 * 62^6 = 56,800,235,584 (~56.8 billion) possible combinations for 6-char codes
 * 62^7 = 3,521,614,606,208 (~3.5 trillion) for 7-char codes
 *
 * We use cryptographically random bytes to generate unpredictable short codes.
 * This prevents enumeration attacks and avoids exposing sequential database IDs.
 *
 * Collision handling:
 * - Even with billions of URLs, collision probability for random 7-char Base62 codes is low
 * - However, we NEVER rely on statistical uniqueness alone
 * - The database has a UNIQUE constraint on shortCode
 * - On collision, we generate a new candidate and retry (up to MAX_RETRIES)
 * - This guarantees correctness even under concurrent requests
 */

const BASE62_CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const DEFAULT_CODE_LENGTH = 7;
const MAX_RETRIES = 5;

/**
 * Generate a cryptographically random Base62 short code.
 */
export function generateShortCode(length: number = DEFAULT_CODE_LENGTH): string {
  const bytes = crypto.randomBytes(length);
  let code = '';

  for (let i = 0; i < length; i++) {
    // Use modulo to map each byte to a Base62 character
    // Slight bias (256 % 62 = 8) is acceptable for URL shortening
    code += BASE62_CHARS[bytes[i] % BASE62_CHARS.length];
  }

  return code;
}

export { MAX_RETRIES, DEFAULT_CODE_LENGTH, BASE62_CHARS };
