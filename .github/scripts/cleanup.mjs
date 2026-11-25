// Deletes every post older than 24 hours from posts.json + its image file.
// Run by the hourly GitHub Action. Safe to run locally too: node cleanup.mjs
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';

const DAY_MS = 24 * 60 * 60 * 1000;
const now = Date.now();

const posts = JSON.parse(readFileSync('posts.json', 'utf8'));
const keep = [];
let removed = 0;

for (const p of posts) {
  const age = now - new Date(p.uploadedAt).getTime();
  if (age >= DAY_MS) {
    if (p.file && existsSync(p.file)) {
      unlinkSync(p.file);
      console.log('deleted file:', p.file);
    }
    console.log('deleted post:', p.uploadedAt, '-', (p.caption || '').slice(0, 60));
    removed++;
  } else {
    keep.push(p);
  }
}

if (removed > 0) {
  writeFileSync('posts.json', JSON.stringify(keep, null, 2) + '\n');
}
console.log(`Done. Removed ${removed} expired post(s), ${keep.length} remain.`);
