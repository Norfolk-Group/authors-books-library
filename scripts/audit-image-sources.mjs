import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
dotenv.config();

function classifyUrl(url) {
  if (!url) return 'missing';
  if (url.includes('cloudfront.net') || url.includes('amazonaws.com') || url.includes('manus.im') || url.includes('forge')) return 's3_cdn';
  if (url.includes('wikimedia.org') || url.includes('wikipedia.org')) return 'wikipedia';
  if (url.includes('drive.google') || url.includes('googleapis.com/drive')) return 'google_drive';
  if (url.includes('replicate.delivery') || url.includes('pbxt.replicate')) return 'replicate';
  if (url.includes('m.media-amazon.com') || url.includes('images-amazon.com')) return 'amazon';
  return 'other_web';
}

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Audit avatars
const [avatars] = await conn.execute('SELECT id, authorName, avatarUrl, s3AvatarUrl FROM author_profiles');
const avatarSources = {};
const nonS3Avatars = [];

for (const r of avatars) {
  const url = r.s3AvatarUrl || r.avatarUrl || '';
  const src = classifyUrl(url);
  avatarSources[src] = (avatarSources[src] || 0) + 1;
  if (src !== 's3_cdn') {
    nonS3Avatars.push({ id: r.id, name: r.authorName, src, s3Url: r.s3AvatarUrl, avatarUrl: r.avatarUrl });
  }
}

console.log('\n=== AVATAR SOURCES ===');
console.log(JSON.stringify(avatarSources, null, 2));
console.log(`\nNon-S3 avatars (${nonS3Avatars.length}):`);
for (const a of nonS3Avatars) {
  console.log(`  [${a.src}] ${a.name}`);
  if (a.s3Url) console.log(`    s3AvatarUrl: ${a.s3Url.substring(0, 100)}`);
  if (a.avatarUrl) console.log(`    avatarUrl: ${a.avatarUrl.substring(0, 100)}`);
}

// Audit book covers
const [covers] = await conn.execute('SELECT id, bookTitle, coverImageUrl, s3CoverUrl FROM book_profiles');
const coverSources = {};
const nonS3Covers = [];

for (const r of covers) {
  const url = r.s3CoverUrl || r.coverImageUrl || '';
  const src = classifyUrl(url);
  coverSources[src] = (coverSources[src] || 0) + 1;
  if (src !== 's3_cdn') {
    nonS3Covers.push({ id: r.id, title: r.bookTitle, src, s3Url: r.s3CoverUrl, coverUrl: r.coverImageUrl });
  }
}

console.log('\n=== BOOK COVER SOURCES ===');
console.log(JSON.stringify(coverSources, null, 2));
console.log(`\nNon-S3 covers (${nonS3Covers.length}):`);
for (const c of nonS3Covers) {
  console.log(`  [${c.src}] ${c.title}`);
  if (c.s3Url) console.log(`    s3CoverUrl: ${c.s3Url.substring(0, 100)}`);
  if (c.coverUrl) console.log(`    coverImageUrl: ${c.coverUrl.substring(0, 100)}`);
}

await conn.end();
