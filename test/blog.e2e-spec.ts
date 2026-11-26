import type { AddressInfo } from 'node:net';
import { createClient } from 'graphql-ws';
import { createPost, createTestApp, gql, signUp, type GqlResult, type TestApp } from './test-app.js';

describe.skipIf(!process.env.TEST_DATABASE_URL)('Blog API (e2e)', () => {
  let t: TestApp;
  let wsUrl: string;
  let ada: string;
  let bob: string;

  beforeAll(async () => {
    t = await createTestApp();
    // Port 0: the OS picks a free one.
    await t.app.listen(Number(process.env.TEST_PORT ?? 0), '127.0.0.1');
    wsUrl = `ws://127.0.0.1:${(t.app.getHttpServer().address() as AddressInfo).port}/graphql`;
    ada = (await signUp(t.app, 'Ada')).accessToken;
    bob = (await signUp(t.app, 'Bob')).accessToken;
  });
  afterAll(() => t.close());

  const post = (token: string, title: string, publish?: boolean) => createPost(t.app, token, title, publish);
  const code = (result: GqlResult) => result.errors?.[0].extensions.code;
  const ids = (list: { id: string }[]) => list.map((item) => item.id);

  it('hides a draft from everyone but its author, through every path', async () => {
    const draft = await post(ada, 'Draft', false);
    const published = await post(ada, 'Published');
    const byId = 'query ($id: ID!) { post(id: $id) { id author { posts(first: 50) { id } } } }';
    expect((await gql(t.app, byId, { token: ada, variables: { id: draft } })).data.post.id).toBe(draft);

    for (const token of [bob, undefined]) {
      expect((await gql(t.app, byId, { token, variables: { id: draft } })).data.post).toBeNull();
      const list = await gql(t.app, '{ posts(first: 50) { edges { node { id } } } }', { token });
      expect(list.data.posts.edges.map((edge: any) => edge.node.id)).not.toContain(draft);
      const viaAuthor = await gql(t.app, byId, { token, variables: { id: published } });
      expect(ids(viaAuthor.data.post.author.posts)).toContain(published);
      expect(ids(viaAuthor.data.post.author.posts)).not.toContain(draft);
    }
    // Writes answer NOT_FOUND, as for an unknown id: nobody learns the draft exists.
    for (const mutation of [
      'mutation ($id: ID!) { updatePost(input: { id: $id, title: "Mine now" }) { id } }',
      'mutation ($id: ID!) { publishPost(id: $id) { id } }',
      'mutation ($id: ID!) { addComment(input: { postId: $id, body: "First!" }) { id } }',
    ]) {
      expect(code(await gql(t.app, mutation, { token: bob, variables: { id: draft } }))).toBe('NOT_FOUND');
    }
    expect(ids((await gql(t.app, '{ me { posts(first: 50) { id } } }', { token: ada })).data.me.posts)).toContain(draft);
  });

  it('batches nested fields: the number of SQL queries stays flat as the posts grow', async () => {
    const queriesFor = async () => {
      const before = t.sqlCount();
      const { data } = await gql(t.app, '{ posts(first: 50) { edges { node { author { name } comments(first: 5) { author { name } } } } } }');
      return { posts: data.posts.edges.length, queries: t.sqlCount() - before };
    };
    const addPosts = async (count: number) => {
      for (let i = 0; i < count; i++) {
        const postId = await post(i % 2 ? ada : bob, `Post ${i}`);
        await gql(t.app, 'mutation ($postId: ID!) { addComment(input: { postId: $postId, body: "Nice" }) { id } }', {
          token: i % 2 ? bob : ada,
          variables: { postId },
        });
      }
    };
    await addPosts(3);
    const few = await queriesFor();
    await addPosts(20);
    const many = await queriesFor();

    expect(many.posts).toBe(few.posts + 20);
    expect(many.queries).toBe(few.queries);
    // At most the posts, their authors, their comments and the comments' authors.
    expect(many.queries).toBeLessThanOrEqual(4);
  });

  it('refuses a WebSocket without a valid token, before any operation', async () => {
    const postId = await post(ada, 'Guarded');
    for (const token of [undefined, 'not-a-jwt', `${ada}x`]) {
      const client = createClient({ url: wsUrl, connectionParams: { authorization: `Bearer ${token}` }, retryAttempts: 0 });
      const comments = client.iterate({ query: 'subscription ($postId: ID!) { commentAdded(postId: $postId) { body } }', variables: { postId } });
      // The client rejects with the CloseEvent: 4403 Forbidden.
      await expect(comments.next()).rejects.toMatchObject({ code: 4403 });
    }
  });
});
