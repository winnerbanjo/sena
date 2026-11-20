/**
 * Proves the k6 guard fails closed before any request is sent.
 *
 * load-tests/lib/env.js is written for the k6 runtime, so it is imported here
 * as a data-URL module with a synthetic __ENV. No k6 binary is required.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../load-tests/lib/env.js', import.meta.url), 'utf8');
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}#${Date.now()}`;

function withEnv(env: Record<string, string>, run: () => void) {
  (globalThis as { __ENV?: Record<string, string> }).__ENV = env;
  try {
    run();
  } finally {
    delete (globalThis as { __ENV?: Record<string, string> }).__ENV;
  }
}

function refuses(env: Record<string, string>, expected: RegExp, loadConfig: () => unknown) {
  withEnv(env, () => {
    assert.throws(loadConfig, expected);
  });
}

async function main() {
  const { loadConfig } = (await import(moduleUrl)) as { loadConfig: () => unknown };

  refuses({ LOAD_TEST_FORBIDDEN_HOST_PATTERN: 'prod|sena\\.ng' }, /BASE_URL is required/, loadConfig);
  refuses({ BASE_URL: 'http://localhost:3000' }, /LOAD_TEST_FORBIDDEN_HOST_PATTERN is required/, loadConfig);
  refuses({ BASE_URL: 'http://localhost:3000', LOAD_TEST_FORBIDDEN_HOST_PATTERN: '   ' }, /LOAD_TEST_FORBIDDEN_HOST_PATTERN is required/, loadConfig);
  refuses({ BASE_URL: 'https://app.sena.ng', LOAD_TEST_FORBIDDEN_HOST_PATTERN: 'sena\\.ng' }, /Refusing to run/, loadConfig);

  withEnv({ BASE_URL: 'http://localhost:3000', LOAD_TEST_FORBIDDEN_HOST_PATTERN: 'sena\\.ng' }, () => {
    const config = loadConfig() as { baseUrl: string };
    assert.equal(config.baseUrl, 'http://localhost:3000');
  });

  console.log('PASS load-test guard: missing BASE_URL, missing/empty deny pattern, and matching host all refuse to run');
}

main().catch((error) => {
  console.error('FAIL load-test guard:', error);
  process.exitCode = 1;
});
