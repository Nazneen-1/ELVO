import {
  assertSafeTestDatabase,
  getSafeTestUri,
  ISOLATED_TEST_URI,
  ISOLATED_TEST_DB_NAME,
} from './server/src/config/testDbGuard.js';

const testResults = {
  passed: 0,
  failed: 0,
  tests: [],
};

function record(name, passed, detail = '') {
  testResults.tests.push({ name, passed, detail });
  if (passed) {
    testResults.passed++;
    console.log(`  \x1b[32m✔\x1b[0m ${name}`);
  } else {
    testResults.failed++;
    console.log(`  \x1b[31m✖\x1b[0m ${name}: ${detail}`);
  }
}

function expectThrows(name, fn, expectedSubstring = '') {
  try {
    fn();
    record(name, false, 'Expected function to throw, but it succeeded.');
  } catch (err) {
    const message = err.message || '';
    const matches = expectedSubstring ? message.includes(expectedSubstring) : true;
    record(name, matches, matches ? '' : `Expected message to contain "${expectedSubstring}", got "${message}"`);
  }
}

function expectNotThrows(name, fn) {
  try {
    const result = fn();
    record(name, true, '');
    return result;
  } catch (err) {
    record(name, false, `Unexpected error thrown: ${err.message}`);
  }
}

console.log('\n\x1b[1m\x1b[36m=== ELVO: FAIL-CLOSED TEST DATABASE GUARD UNIT TESTS ===\x1b[0m\n');

// 1. Valid local test URIs are accepted
expectNotThrows('1.1. Exact 127.0.0.1 test URI is accepted', () => {
  return assertSafeTestDatabase('mongodb://127.0.0.1:27017/elvo_test_isolated');
});

expectNotThrows('1.2. Exact localhost test URI is accepted', () => {
  return assertSafeTestDatabase('mongodb://localhost:27017/elvo_test_isolated');
});

expectNotThrows('1.3. getSafeTestUri() returns ISOLATED_TEST_URI by default', () => {
  const uri = getSafeTestUri();
  return uri === ISOLATED_TEST_URI;
});

expectNotThrows('1.4. IPv6 loopback [::1] is accepted', () => {
  return assertSafeTestDatabase('mongodb://[::1]:27017/elvo_test_isolated');
});

expectNotThrows('1.5. Valid query parameters are accepted on loopback', () => {
  return assertSafeTestDatabase('mongodb://127.0.0.1:27017/elvo_test_isolated?authSource=admin&directConnection=true');
});

expectNotThrows('1.6. Valid non-default loopback port is accepted', () => {
  return assertSafeTestDatabase('mongodb://127.0.0.1:27018/elvo_test_isolated');
});

// 2. Production/shared database names and path variations are rejected
expectThrows(
  '2.1. Shared database name "elvo" on 127.0.0.1 is rejected',
  () => assertSafeTestDatabase('mongodb://127.0.0.1:27017/elvo'),
  'FAIL-CLOSED: Database name rejected'
);

expectThrows(
  '2.2. Shared database name "elvo" on localhost is rejected',
  () => assertSafeTestDatabase('mongodb://localhost:27017/elvo'),
  'FAIL-CLOSED: Database name rejected'
);

expectThrows(
  '2.3. Arbitrary database name "test" is rejected',
  () => assertSafeTestDatabase('mongodb://127.0.0.1:27017/test'),
  'FAIL-CLOSED: Database name rejected'
);

expectThrows(
  '2.4. Extra path segments are rejected',
  () => assertSafeTestDatabase('mongodb://127.0.0.1:27017/elvo_test_isolated/extra'),
  'FAIL-CLOSED: Path must contain exactly one database name segment'
);

expectThrows(
  '2.5. Trailing slash in path is rejected',
  () => assertSafeTestDatabase('mongodb://127.0.0.1:27017/elvo_test_isolated/'),
  'FAIL-CLOSED: Trailing slashes in database path are rejected'
);

expectThrows(
  '2.6. Duplicate leading slash is rejected',
  () => assertSafeTestDatabase('mongodb://127.0.0.1:27017//elvo_test_isolated'),
  'FAIL-CLOSED: Duplicate or empty leading slash'
);

expectThrows(
  '2.7. Encoded database name (elvo%5Ftest%5Fisolated) is rejected',
  () => assertSafeTestDatabase('mongodb://127.0.0.1:27017/elvo%5Ftest%5Fisolated'),
  'FAIL-CLOSED: Database name rejected'
);

expectThrows(
  '2.8. Encoded slash (%2F) in database name is rejected',
  () => assertSafeTestDatabase('mongodb://127.0.0.1:27017/elvo%2Ftest'),
  'FAIL-CLOSED: Database name rejected'
);

expectThrows(
  '2.9. Malformed percent-encoding (%ZZ) is rejected',
  () => assertSafeTestDatabase('mongodb://127.0.0.1:27017/elvo%ZZ'),
  'FAIL-CLOSED: Malformed percent-encoding'
);

// 3. Any Atlas hostname or cloud domain is rejected
expectThrows(
  '3.1. Atlas hostname with test database is rejected',
  () => assertSafeTestDatabase('mongodb+srv://user:pass@cluster0.yuglpzd.mongodb.net/elvo_test_isolated'),
  'FAIL-CLOSED:'
);

expectThrows(
  '3.2. Plain mongodb:// with Atlas domain is rejected',
  () => assertSafeTestDatabase('mongodb://cluster0.example.mongodb.net:27017/elvo_test_isolated'),
  'FAIL-CLOSED: Atlas or cloud MongoDB hostnames are strictly prohibited'
);

expectThrows(
  '3.3. Remote SRV protocol is rejected even if pointed to loopback',
  () => assertSafeTestDatabase('mongodb+srv://127.0.0.1/elvo_test_isolated'),
  'FAIL-CLOSED: Invalid protocol'
);

// 4. Any non-loopback host is rejected
expectThrows(
  '4.1. LAN IP 192.168.1.50 is rejected',
  () => assertSafeTestDatabase('mongodb://192.168.1.50:27017/elvo_test_isolated'),
  'FAIL-CLOSED: Non-loopback host'
);

expectThrows(
  '4.2. Public IP 8.8.8.8 is rejected',
  () => assertSafeTestDatabase('mongodb://8.8.8.8:27017/elvo_test_isolated'),
  'FAIL-CLOSED: Non-loopback host'
);

expectThrows(
  '4.3. External domain remote-mongo.com is rejected',
  () => assertSafeTestDatabase('mongodb://remote-mongo.com:27017/elvo_test_isolated'),
  'FAIL-CLOSED: Non-loopback host'
);

// 5. Missing or invalid URI types are rejected
expectThrows(
  '5.1. null URI is rejected',
  () => assertSafeTestDatabase(null),
  'FAIL-CLOSED: Test database URI is missing or empty'
);

expectThrows(
  '5.2. undefined URI is rejected',
  () => assertSafeTestDatabase(undefined),
  'FAIL-CLOSED: Test database URI is missing or empty'
);

expectThrows(
  '5.3. Empty string URI is rejected',
  () => assertSafeTestDatabase('   '),
  'FAIL-CLOSED: Test database URI is missing or empty'
);

expectThrows(
  '5.4. Non-string URI is rejected',
  () => assertSafeTestDatabase(12345),
  'FAIL-CLOSED: Test database URI is missing or empty'
);

// 6. Malformed URIs and invalid ports are rejected
expectThrows(
  '6.1. Random text is rejected',
  () => assertSafeTestDatabase('not_a_valid_uri'),
  'FAIL-CLOSED:'
);

expectThrows(
  '6.2. Missing database pathname is rejected',
  () => assertSafeTestDatabase('mongodb://127.0.0.1:27017/'),
  'FAIL-CLOSED: Database name is missing'
);

expectThrows(
  '6.3. Missing database without slash is rejected',
  () => assertSafeTestDatabase('mongodb://127.0.0.1:27017'),
  'FAIL-CLOSED: Database name is missing'
);

expectThrows(
  '6.4. Out of range port (>65535) is rejected',
  () => assertSafeTestDatabase('mongodb://127.0.0.1:999999/elvo_test_isolated'),
  'FAIL-CLOSED:'
);

expectThrows(
  '6.5. Port 0 is rejected',
  () => assertSafeTestDatabase('mongodb://127.0.0.1:0/elvo_test_isolated'),
  'FAIL-CLOSED: Test database port number is invalid'
);

expectThrows(
  '6.6. Port 65536 is rejected',
  () => assertSafeTestDatabase('mongodb://127.0.0.1:65536/elvo_test_isolated'),
  'FAIL-CLOSED:'
);

// 7. Security: Verify error messages never echo credentials
const testSecret = 'SuperSecretPasswordXYZ!';
let leakFound = false;
try {
  assertSafeTestDatabase(`mongodb+srv://admin:${testSecret}@cluster0.mongodb.net/elvo`);
} catch (err) {
  if (err.message.includes(testSecret)) {
    leakFound = true;
  }
}
record('7.1. Error message never leaks passwords or credentials', !leakFound, 'Password was leaked in error message');

console.log('\n\x1b[1m\x1b[36m=== TEST RESULTS SUMMARY ===\x1b[0m');
console.log(`  \x1b[32m✔ Passed: ${testResults.passed}\x1b[0m`);
console.log(`  \x1b[31m✖ Failed: ${testResults.failed}\x1b[0m`);
console.log(`  Total:   ${testResults.tests.length}\n`);

if (testResults.failed > 0) {
  process.exit(1);
} else {
  console.log('\x1b[32m\x1b[1m✨ ALL TEST DATABASE GUARD TESTS PASSED! ✨\x1b[0m\n');
  process.exit(0);
}
