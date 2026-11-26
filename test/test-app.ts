import { fileURLToPath } from 'node:url';
import { PasswordHasher } from '@nestjs/authentication';
import { getDrizzleToken } from '@nestjs/drizzle';
import { NodeAdapter, type NestNodeApplication } from '@nestjs/platform-node';
import { Test } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

export interface TestApp {
  app: NestNodeApplication;
  /** How many SQL statements the application has sent so far. */
  sqlCount: () => number;
  close: () => Promise<void>;
}

/** The real AppModule on the database in TEST_DATABASE_URL, emptied first. */
export async function createTestApp(): Promise<TestApp> {
  // Imported here, so a test file can set NODE_ENV before the module reads it.
  const { AppModule } = await import('../src/app.module.js');
  const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  let count = 0;
  const db = drizzle({ client: pool, logger: { logQuery: () => void count++ } });
  await migrate(db, { migrationsFolder: fileURLToPath(new URL('../drizzle', import.meta.url)) });
  await db.execute(sql`TRUNCATE users, posts, comments, refresh_tokens CASCADE`);

  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(getDrizzleToken())
    .useValue(db)
    // scrypt at the default cost takes 128 MiB and a few hundred ms per hash.
    .overrideProvider(PasswordHasher)
    .useValue(new PasswordHasher({ logN: 10 }))
    .compile();
  const app = moduleRef.createNestApplication<NestNodeApplication>(new NodeAdapter());
  await app.init();
  return {
    app,
    sqlCount: () => count,
    close: async () => {
      await app.close();
      await pool.end();
    },
  };
}

export interface GqlResult {
  data?: any;
  errors?: { message: string; path?: string[]; extensions: { code: string; [key: string]: unknown } }[];
}

let clients = 0;

/** Sends an operation with app.inject(), from an address of its own. */
export async function gql(
  app: NestNodeApplication,
  query: string,
  { variables, token }: { variables?: Record<string, unknown>; token?: string } = {},
): Promise<GqlResult> {
  const res = await app.inject({
    method: 'POST',
    url: '/graphql',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: { query, variables },
    // Sign-up is limited per IP address: each test client gets an address of its own.
    remoteAddress: `10.0.0.${++clients}`,
  });
  return res.json();
}

export async function signUp(app: NestNodeApplication, name: string): Promise<{ accessToken: string; refreshToken: string }> {
  const { data } = await gql(app, 'mutation ($input: SignUpInput!) { signUp(input: $input) { accessToken refreshToken } }', {
    variables: { input: { email: `${name.toLowerCase()}@example.com`, name, password: 'correct horse battery' } },
  });
  return data.signUp;
}

/** Creates a post, and publishes it unless it's to stay a draft. */
export async function createPost(app: NestNodeApplication, token: string, title: string, publish = true): Promise<string> {
  const create = 'mutation ($input: CreatePostInput!) { createPost(input: $input) { id } }';
  const { id } = (await gql(app, create, { token, variables: { input: { title, body: '' } } })).data.createPost;
  if (publish) {
    await gql(app, 'mutation ($id: ID!) { publishPost(id: $id) { id } }', { token, variables: { id } });
  }
  return id;
}
