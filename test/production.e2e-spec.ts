import { PostsService } from '../src/posts/posts.service.js';
import { createTestApp, gql, type TestApp } from './test-app.js';

// Read when the application starts, by Apollo Server and by GraphqlConfig.
vi.stubEnv('NODE_ENV', 'production');

describe.skipIf(!process.env.TEST_DATABASE_URL)('Errors in production (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  it('masks an unexpected error: no stack trace, no internal message', async () => {
    vi.spyOn(t.app.get(PostsService), 'list').mockRejectedValueOnce(new Error('connect ECONNREFUSED 10.0.4.2:5432'));
    const result = await gql(t.app, '{ posts { edges { cursor } } }');
    expect(result.errors).toEqual([
      { message: 'Internal server error', path: ['posts'], extensions: { code: 'INTERNAL_SERVER_ERROR' } },
    ]);
  });

  it('keeps the errors the code throws on purpose, without their stack traces', async () => {
    const result = await gql(t.app, '{ post(id: "42") { id } }');
    expect(result.errors![0]).toMatchObject({ message: 'id must be a UUID', extensions: { code: 'BAD_USER_INPUT' } });
    expect(result.errors![0].extensions).not.toHaveProperty('stacktrace');
  });
});
