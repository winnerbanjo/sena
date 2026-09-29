/**
 * Merges Connected Apps translation overlays into locale message files.
 * Run: node scripts/apply-connected-apps-overlays.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const locales = ['fr', 'ar', 'sw', 'yo', 'ha', 'ig'];

for (const loc of locales) {
  const localePath = join(root, 'apps/dashboard/messages', `${loc}.json`);
  const overlayPath = join(root, 'apps/dashboard/messages/overlays', `connected-apps-${loc}.json`);
  const data = JSON.parse(readFileSync(localePath, 'utf8'));
  const overlay = JSON.parse(readFileSync(overlayPath, 'utf8'));
  if (!data.apps || typeof data.apps !== 'object') {
    throw new Error(`Missing apps namespace in ${loc}.json`);
  }
  for (const [key, value] of Object.entries(overlay)) {
    data.apps[key] = value;
  }
  writeFileSync(localePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`merged ${Object.keys(overlay).length} keys into ${loc}.json`);
}
