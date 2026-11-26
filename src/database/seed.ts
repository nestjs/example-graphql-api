import { PasswordHasher } from '@nestjs/authentication';
import { drizzle } from 'drizzle-orm/node-postgres';
import { envSchema } from '../config.js';
import { comments, posts, users } from './schema.js';

// Development data: empties the tables, then adds two users, their posts and comments.
const { NODE_ENV, DATABASE_URL } = envSchema.parse(process.env);
if (NODE_ENV === 'production') {
  throw new Error('Refusing to seed a production database');
}
const db = drizzle(DATABASE_URL);
const passwordHash = await new PasswordHasher().hash('correct horse battery');
await db.execute('TRUNCATE users, posts, comments, refresh_tokens');

const [ada, bob] = await db
  .insert(users)
  .values([
    { email: 'ada@example.com', name: 'Ada', passwordHash },
    { email: 'bob@example.com', name: 'Bob', passwordHash },
  ])
  .returning();
// Twelve published posts, an hour apart, by Ada and Bob in turn, and a draft each.
const published = await db
  .insert(posts)
  .values(
    Array.from({ length: 12 }, (_, i) => ({
      authorId: [ada, bob][i % 2].id,
      title: `Post ${i + 1}`,
      body: `The body of post ${i + 1}.`,
      publishedAt: new Date(Date.now() - (12 - i) * 3_600_000),
    })),
  )
  .returning();
await db.insert(posts).values([
  { authorId: ada.id, title: "Ada's draft", body: 'Not ready yet.' },
  { authorId: bob.id, title: "Bob's draft", body: 'Not ready either.' },
]);
// A comment on each post, by the other user.
await db
  .insert(comments)
  .values(published.map((post) => ({ postId: post.id, authorId: post.authorId === ada.id ? bob.id : ada.id, body: `About ${post.title}` })));

console.log(`Seeded 2 users, ${published.length} published posts and 2 drafts`);
await db.$client.end();
