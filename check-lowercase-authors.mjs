import "dotenv/config";
import mysql from "mysql2/promise";

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Find entries that start with a lowercase letter (likely topics/skills)
const [lowercase] = await conn.execute(
  "SELECT id, authorName, bio FROM author_profiles WHERE authorName REGEXP '^[a-z]' ORDER BY authorName"
);
console.log(`\nStarts with lowercase: ${lowercase.length}`);
lowercase.forEach(r => console.log(`  [${r.id}] "${r.authorName}" | bio: ${r.bio ? r.bio.substring(0, 60) + '...' : 'none'}`));

// Find entries that look like book titles or topics (multi-word, all lowercase)
const [allLower] = await conn.execute(
  "SELECT id, authorName FROM author_profiles WHERE BINARY authorName = LOWER(authorName) ORDER BY authorName"
);
console.log(`\nAll-lowercase names: ${allLower.length}`);
allLower.forEach(r => console.log(`  [${r.id}] "${r.authorName}"`));

// Find entries with no books and no bio and no avatar
const [empty] = await conn.execute(`
  SELECT ap.id, ap.authorName, ap.bio, ap.avatarUrl, ap.s3AvatarUrl, COUNT(bp.id) as bookCount
  FROM author_profiles ap
  LEFT JOIN book_profiles bp ON bp.authorName = ap.authorName
  GROUP BY ap.id
  HAVING bookCount = 0 AND (ap.bio IS NULL OR ap.bio = '') AND (ap.avatarUrl IS NULL OR ap.avatarUrl = '') AND (ap.s3AvatarUrl IS NULL OR ap.s3AvatarUrl = '')
  ORDER BY ap.authorName
`);
console.log(`\nNo bio, no avatar, no books: ${empty.length}`);
empty.forEach(r => console.log(`  [${r.id}] "${r.authorName}"`));

// Find the "active listening" entry specifically
const [activeListening] = await conn.execute(
  "SELECT * FROM author_profiles WHERE LOWER(authorName) = 'active listening'"
);
console.log(`\n"active listening" entry: ${activeListening.length}`);
if (activeListening.length > 0) {
  const r = activeListening[0];
  console.log(`  ID: ${r.id}, Name: "${r.authorName}", Bio: ${r.bio ? 'yes' : 'no'}, Avatar: ${r.avatarUrl || r.s3AvatarUrl ? 'yes' : 'no'}`);
}

// Also check book_profiles for "active listening" as author
const [booksForAL] = await conn.execute(
  "SELECT id, bookTitle, authorName FROM book_profiles WHERE LOWER(authorName) = 'active listening'"
);
console.log(`\nBooks with "active listening" as author: ${booksForAL.length}`);
booksForAL.forEach(r => console.log(`  [${r.id}] "${r.bookTitle}" by "${r.authorName}"`));

await conn.end();
