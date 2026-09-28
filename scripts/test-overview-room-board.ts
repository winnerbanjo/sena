import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  overviewBoardStatus,
  overviewRoomCategory,
  overviewRoomNumber,
  sortRoomsByNumber,
} from '../apps/dashboard/src/lib/overview-room-board';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function source(rel: string) {
  return readFileSync(join(root, rel), 'utf8');
}

assert.equal(
  overviewBoardStatus({ operational: 'occupied', housekeeping: 'dirty' }),
  'occupied',
  'occupied still wins over dirty'
);
assert.equal(
  overviewBoardStatus({ operationalStatus: 'available', housekeepingStatus: 'dirty' }),
  'needs_cleaning'
);
assert.equal(
  overviewBoardStatus({ operational: 'available', housekeeping: 'cleaning' }),
  'cleaning'
);
assert.equal(
  overviewBoardStatus({ operationalStatus: 'maintenance', housekeepingStatus: 'clean' }),
  'out_of_service'
);
assert.equal(
  overviewBoardStatus({ operational: 'available', housekeeping: 'clean' }),
  'available'
);
assert.equal(overviewRoomNumber({ roomNumber: '3014' }), '3014');
assert.equal(overviewRoomCategory({ roomType: { name: 'Stay Connect Deluxe' } }), 'Stay Connect Deluxe');

const ordered = sortRoomsByNumber([
  { id: 'b', roomNumber: '3010' },
  { id: 'a', roomNumber: '3008' },
  { id: 'c', roomNumber: '4017' },
]);
assert.deepEqual(ordered.map((r) => r.roomNumber), ['3008', '3010', '4017']);

const page = source('apps/dashboard/src/app/page.tsx');
assert.match(page, /OverviewRoomBoard/);
assert.match(page, /viewAllRooms|OverviewRoomBoard/);
assert.doesNotMatch(page, /All rooms/);
assert.doesNotMatch(page, /fetch\(`\/api\/rooms\/\$\{/);
assert.match(page, /fetch\('\/api\/rooms'\)/);

const board = source('apps/dashboard/src/components/overview-room-board.tsx');
assert.match(board, /href="\/rooms"/);
assert.match(board, /useTranslations\('overview'\)/);
assert.match(board, /aria-label/);
assert.match(board, /ltr-isolate/);
assert.match(board, /xl:grid-cols-6/);
assert.doesNotMatch(board, /fetch\(/);

console.log('overview room board: PASS');
