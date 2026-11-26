// Prints the comments added to a post as they arrive: node scripts/watch-comments.ts <postId> <accessToken>
import { createClient } from 'graphql-ws';

const [postId, accessToken] = process.argv.slice(2);
const client = createClient({
  url: process.env.WS_URL ?? 'ws://localhost:3000/graphql',
  // Sent once, when the socket opens. Node.js 22 has a WebSocket client built in, as browsers do.
  connectionParams: { authorization: `Bearer ${accessToken}` },
  retryAttempts: 0,
});

try {
  const comments = client.iterate({
    query: 'subscription ($postId: ID!) { commentAdded(postId: $postId) { body author { name } } }',
    variables: { postId },
  });
  for await (const result of comments) {
    console.log(JSON.stringify(result));
  }
} catch (error) {
  // The server closed the socket: 4403 when it refused the token.
  const { code, reason } = error as CloseEvent;
  console.error(`Closed: ${code} ${reason}`);
}
