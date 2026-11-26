import { PostsService } from '../src/posts/posts.service.js';
import { createPost, createTestApp, gql, signUp, type GqlResult, type TestApp } from './test-app.js';

describe.skipIf(!process.env.TEST_DATABASE_URL)('Errors, limits and tokens (e2e)', () => {
  let t: TestApp;
  let ada: string;
  let bob: string;

  beforeAll(async () => {
    t = await createTestApp();
    ada = (await signUp(t.app, 'Ada')).accessToken;
    bob = (await signUp(t.app, 'Bob')).accessToken;
  });
  afterAll(() => t.close());

  const post = (token: string, title: string, publish?: boolean) => createPost(t.app, token, title, publish);
  const code = (result: GqlResult) => result.errors?.[0].extensions.code;

  it('answers UNAUTHENTICATED without a token, and FORBIDDEN to anyone but the author', async () => {
    expect(code(await gql(t.app, 'mutation { createPost(input: { title: "Hi", body: "" }) { id } }'))).toBe('UNAUTHENTICATED');
    const id = await post(ada, 'Mine');
    const update = 'mutation ($id: ID!) { updatePost(input: { id: $id, title: "Not yours" }) { id } }';
    expect(code(await gql(t.app, update, { token: bob, variables: { id } }))).toBe('FORBIDDEN');
    const unchanged = await gql(t.app, 'query ($id: ID!) { post(id: $id) { title } }', { variables: { id } });
    expect(unchanged.data.post.title).toBe('Mine');
  });

  it("returns a user's email to that user only", async () => {
    const id = await post(ada, 'Hello');
    const query = 'query ($id: ID!) { post(id: $id) { author { email } } }';
    expect((await gql(t.app, query, { token: ada, variables: { id } })).data.post.author.email).toBe('ada@example.com');
    expect((await gql(t.app, query, { token: bob, variables: { id } })).data.post.author.email).toBeNull();
    expect((await gql(t.app, query, { variables: { id } })).data.post.author.email).toBeNull();
  });

  it('answers BAD_USER_INPUT, with readable messages, to invalid arguments', async () => {
    const id = await post(ada, 'Valid');
    const nullTitle = await gql(t.app, 'mutation ($id: ID!) { updatePost(input: { id: $id, title: null }) { id } }', {
      token: ada,
      variables: { id },
    });
    expect(nullTitle.errors![0]).toMatchObject({
      message: 'title must be longer than or equal to 1 characters; title must be a string',
      extensions: { code: 'BAD_USER_INPUT', fields: { title: expect.any(Array) } },
    });
    for (const [query, message] of [
      ['{ post(id: "42") { id } }', 'id must be a UUID'],
      ['{ posts(first: 0) { edges { cursor } } }', 'first must not be less than 1'],
      ['{ posts(after: "bm9wZQ") { edges { cursor } } }', 'Invalid cursor'],
    ]) {
      expect((await gql(t.app, query)).errors![0]).toMatchObject({ message, extensions: { code: 'BAD_USER_INPUT' } });
    }
  });

  it('refuses an over-limit query before any resolver runs', async () => {
    const list = vi.spyOn(t.app.get(PostsService), 'list');
    const queriesBefore = t.sqlCount();
    const result = await gql(t.app, '{ posts(first: 50) { edges { node { comments(first: 50) { author { posts(first: 50) { id } } } } } } }');
    expect(result).toEqual({ errors: [expect.objectContaining({ extensions: expect.objectContaining({ code: 'QUERY_TOO_EXPENSIVE' }) })] });
    expect(list).not.toHaveBeenCalled();
    expect(t.sqlCount()).toBe(queriesBefore);
  });

  it('rotates refresh tokens, and refuses a reused one', async () => {
    const { refreshToken } = await signUp(t.app, 'Carol');
    const refresh = (token: string) =>
      gql(t.app, 'mutation ($input: RefreshTokenInput!) { refreshToken(input: $input) { refreshToken } }', {
        variables: { input: { refreshToken: token } },
      });
    const successor = (await refresh(refreshToken)).data.refreshToken.refreshToken;
    // Reused: two parties hold it, so its whole family is revoked, the successor included.
    expect(code(await refresh(refreshToken))).toBe('UNAUTHENTICATED');
    expect(code(await refresh(successor))).toBe('UNAUTHENTICATED');
  });
});
