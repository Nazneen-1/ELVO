/**
 * Fail-Closed Test Database Guard
 *
 * Ensures database-backed test suites can ONLY connect to a dedicated,
 * local isolated test database and can NEVER connect to production,
 * shared Atlas clusters, or arbitrary databases.
 */

export const ISOLATED_TEST_DB_NAME = 'elvo_test_isolated';
export const ISOLATED_TEST_URI = `mongodb://127.0.0.1:27017/${ISOLATED_TEST_DB_NAME}`;

const ALLOWED_LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]']);

/**
 * Validates that a database URI is strictly safe for testing.
 * Throws a descriptive Error without echoing credentials or sensitive URI details if invalid.
 *
 * @param {string} uri - The MongoDB connection URI to validate.
 * @returns {string} The validated URI string.
 */
export function assertSafeTestDatabase(uri) {
  if (!uri || typeof uri !== 'string' || !uri.trim()) {
    throw new Error('FAIL-CLOSED: Test database URI is missing or empty.');
  }

  let parsed;
  try {
    parsed = new URL(uri.trim());
  } catch {
    throw new Error('FAIL-CLOSED: Test database URI is malformed and cannot be parsed.');
  }

  // 1. Enforce standard mongodb: protocol (reject remote mongodb+srv:, http:, etc.)
  if (parsed.protocol !== 'mongodb:') {
    throw new Error(
      `FAIL-CLOSED: Invalid protocol "${parsed.protocol}". Tests only permit local "mongodb:". Remote protocols (such as mongodb+srv:) are strictly rejected.`
    );
  }

  // 2. Reject any Atlas or cloud hostnames
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || hostname.includes('mongodb.net') || hostname.includes('render.com')) {
    throw new Error('FAIL-CLOSED: Atlas or cloud MongoDB hostnames are strictly prohibited for test execution.');
  }

  // 3. Allow only loopback hosts (127.0.0.1, localhost, or [::1])
  if (!ALLOWED_LOOPBACK_HOSTS.has(hostname)) {
    throw new Error(
      `FAIL-CLOSED: Non-loopback host "${hostname}" is prohibited. Tests must run exclusively against local loopback (127.0.0.1 or localhost).`
    );
  }

  // 4. Validate port if present (must be valid integer between 1 and 65535, reject 0 or invalid)
  if (parsed.port) {
    const portNum = Number(parsed.port);
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      throw new Error('FAIL-CLOSED: Test database port number is invalid.');
    }
  }

  // 5. Strictly validate pathname structure (reject empty, multi-segment, or trailing slashes)
  const pathname = parsed.pathname;
  if (!pathname || pathname === '/' || !pathname.startsWith('/')) {
    throw new Error('FAIL-CLOSED: Database name is missing from connection URI.');
  }

  if (pathname.startsWith('//')) {
    throw new Error('FAIL-CLOSED: Duplicate or empty leading slash in database path is rejected.');
  }

  if (pathname.length > 1 && pathname.endsWith('/')) {
    throw new Error('FAIL-CLOSED: Trailing slashes in database path are rejected.');
  }

  const segments = pathname.slice(1).split('/');
  if (segments.length !== 1) {
    throw new Error('FAIL-CLOSED: Path must contain exactly one database name segment.');
  }

  const rawSegment = segments[0];
  if (!rawSegment || rawSegment.trim() === '') {
    throw new Error('FAIL-CLOSED: Database name is missing from connection URI.');
  }

  // 6. Validate percent-encoding integrity
  let decodedName;
  try {
    decodedName = decodeURIComponent(rawSegment);
  } catch {
    throw new Error('FAIL-CLOSED: Malformed percent-encoding in database name.');
  }

  // 7. Reject encoded or altered database names; only allow exact un-encoded ISOLATED_TEST_DB_NAME
  if (rawSegment !== ISOLATED_TEST_DB_NAME || decodedName !== ISOLATED_TEST_DB_NAME) {
    throw new Error(
      `FAIL-CLOSED: Database name rejected. Tests are strictly restricted to the isolated test database "${ISOLATED_TEST_DB_NAME}". Connecting to production ("elvo") or any other database is blocked.`
    );
  }

  return uri.trim();
}

/**
 * Returns a guarded test URI.
 * If candidateUri is provided, validates it; otherwise returns the default ISOLATED_TEST_URI.
 *
 * @param {string} [candidateUri]
 * @returns {string}
 */
export function getSafeTestUri(candidateUri) {
  const target = candidateUri || process.env.TEST_MONGODB_URI || ISOLATED_TEST_URI;
  return assertSafeTestDatabase(target);
}
