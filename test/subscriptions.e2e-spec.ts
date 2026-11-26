import type { AddressInfo } from 'node:net';
import { createClient } from 'graphql-ws';
import { createPost, createTestApp, signUp, type TestApp } from './test-app.js';

describe.skipIf(!process.env.TEST_DATABASE_URL)('Subscriptions over a real WebSocket (e2e)', () => {
  let t: TestApp;
  let port: number;
  let ada: string;
  let bob: string;

  beforeAll(async () => {
    t = await createTestApp();
    // Port 0: the OS picks a free one.
    await t.app.listen(Number(process.env.TEST_PORT ?? 0), '127.0.0.1');
    port = (t.app.getHttpServer().address() as AddressInfo).port;
    ada = (await signUp(t.app, 'Ada')).accessToken;
    bob = (await signUp(t.app, 'Bob')).accessToken;
  });
  afterAll(() => t.close());

  const post = (title: string, publish?: boolean) => createPost(t.app, ada, title, publish);

  /** Adds a comment as Ada, over real HTTP. */
  async function addComment(postId: string, body: string) {
    await fetch(`http://127.0.0.1:${port}/graphql`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${ada}` },
      body: JSON.stringify({
        query: 'mutation ($input: AddCommentInput!) { addComment(input: $input) { id } }',
        variables: { input: { postId, body } },
      }),
    });
  }

  /** Opens a socket with the token in connectionParams, as a browser would, and runs one operation. */
  function subscribe(token: string | undefined, query: string, variables: Record<string, unknown>) {
    const client = createClient({
      url: `ws://127.0.0.1:${port}/graphql`,
      connectionParams: { authorization: `Bearer ${token}` },
      retryAttempts: 0,
    });
    const results = client.iterate({ query, variables })[Symbol.asyncIterator]();
    return { next: () => results.next(), close: () => client.dispose() };
  }

  const commentAdded = 'subscription ($postId: ID!) { commentAdded(postId: $postId) { body author { name } } }';

  it("delivers the comments of the subscribed post, and no other post's", async () => {
    const [watched, other] = [await post('Watched'), await post('Other')];
    const subscription = subscribe(bob, commentAdded, { postId: watched });
    // The protocol doesn't acknowledge a subscription: give the server a moment to register it.
    await new Promise((resolve) => setTimeout(resolve, 300));

    await addComment(other, 'On the other post');
    await addComment(watched, 'On the watched post');
    const { value } = await subscription.next();
    expect(value).toEqual({ data: { commentAdded: { body: 'On the watched post', author: { name: 'Ada' } } } });
    await subscription.close();
  });

  it("refuses a subscription to someone else's draft as if it didn't exist", async () => {
    const subscription = subscribe(bob, commentAdded, { postId: await post('Draft', false) });
    const { value } = await subscription.next();
    expect(value).toMatchObject({ errors: [{ message: 'Post not found', extensions: { code: 'NOT_FOUND' } }] });
    await subscription.close();
  });

  it('serves subscriptions only, at the cost limit HTTP has', async () => {
    const postId = await post('Costly');
    for (const [query, code] of [
      ['{ __schema { types { name } } }', 'GRAPHQL_VALIDATION_FAILED'],
      ['mutation { createPost(input: { title: "Via the socket", body: "" }) { id } }', 'GRAPHQL_VALIDATION_FAILED'],
      ['subscription ($postId: ID!) { commentAdded(postId: $postId) { author { posts(first: 50) { comments(first: 50) { body } } } } }', 'QUERY_TOO_EXPENSIVE'],
    ]) {
      const subscription = subscribe(bob, query, { postId });
      // An operation refused before it runs: the client rejects with its errors.
      await expect(subscription.next()).rejects.toMatchObject([{ extensions: { code } }]);
      await subscription.close();
    }
  });
});
