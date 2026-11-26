# Build a GraphQL API in Node.js with NestJS

This is the finished application of the tutorial [Build a GraphQL API in Node.js](https://docs.nestjs.com/tutorials/graphql-api) in the NestJS documentation. The tutorial builds it step by step and explains every decision; this repository is the result, ready to clone.

## What it does

A GraphQL API for a blog: users write posts, keep them as drafts until they publish them, and comment on each other's posts.

- The schema is generated from TypeScript classes (code first) and served by Apollo Server on the Node adapter, at `/graphql`.
- Users, posts and comments live in PostgreSQL through Drizzle. `posts` pages through published posts with a cursor.
- Nested fields (`Post.author`, `Post.comments`, `User.posts`) load in batches with DataLoader, so the number of SQL queries doesn't grow with a list.
- `signUp`, `signIn` and `refreshToken` mutations with `@nestjs/authentication`: access tokens that live 15 minutes, and refresh tokens that rotate on every use. Sign-up and sign-in are rate-limited.
- A draft is visible to its author only, through every query, field and subscription; an email address to its owner only.
- Errors carry a code a client can act on: `UNAUTHENTICATED`, `FORBIDDEN`, `BAD_USER_INPUT`, `NOT_FOUND`, `QUERY_TOO_EXPENSIVE`, `TOO_MANY_REQUESTS`. In production, unexpected errors are masked.
- A query whose cost is over the limit is refused before any resolver runs.
- `commentAdded` pushes new comments to signed-in subscribers over `graphql-ws`.
- NestJS Observe is wired in, and sends nothing until it has a key pair.

## Run it

You need Node.js 22.18 or later (the subscription script runs TypeScript directly and uses the built-in WebSocket client), and Docker for PostgreSQL.

```bash
git clone https://github.com/nestjs/example-graphql-api.git
cd example-graphql-api
npm install
cp .env.example .env    # then set JWT_SECRET: openssl rand -base64 32
docker compose up -d
npm run db:migrate
npm run build
npm run db:seed         # two users, twelve published posts, a draft each; it empties the tables first
npm run start
```

The API listens on http://localhost:3000/graphql. Outside production, the same URL serves GraphiQL in a browser. The seed's users are `ada@example.com` and `bob@example.com`, both with the password `correct horse battery`. Sign in as Ada, and read the first page of posts:

```bash
curl localhost:3000/graphql --json '{"query":"mutation ($input: SignInInput!) { signIn(input: $input) { accessToken refreshToken expiresIn } }","variables":{"input":{"email":"ada@example.com","password":"correct horse battery"}}}'
curl localhost:3000/graphql --json '{"query":"{ posts(first: 2) { edges { node { title author { name } } } pageInfo { hasNextPage endCursor } } }"}'
```

Send the access token as `Authorization: Bearer <token>` to run operations as Ada. To watch a post's comments over WebSocket:

```bash
node scripts/watch-comments.ts <postId> <accessToken>
```

The tutorial's [Try it](https://docs.nestjs.com/tutorials/graphql-api#try-it) section goes further: drafts, errors, a refused query, and the subscription.

## Operations

All operations go to `POST /graphql`; `commentAdded` goes over `graphql-ws` on `ws://localhost:3000/graphql`, with the token in `connectionParams.authorization`.

| Operation | Section |
| --- | --- |
| `posts`, `post`, `createPost`, `updatePost`, `publishPost`, `addComment` | [Read and write posts](https://docs.nestjs.com/tutorials/graphql-api#read-and-write-posts) |
| `Post.author`, `Post.comments`, `User.posts`, `User.email`, `me` | [Batch nested fields with DataLoader](https://docs.nestjs.com/tutorials/graphql-api#batch-nested-fields-with-dataloader) |
| `signUp`, `signIn`, `refreshToken` | [Sign users in with mutations](https://docs.nestjs.com/tutorials/graphql-api#sign-users-in-with-mutations) |
| `commentAdded` | [Push new comments with subscriptions](https://docs.nestjs.com/tutorials/graphql-api#push-new-comments-with-subscriptions) |

## Layout

| Path | What it holds |
| --- | --- |
| `src/main.ts` | bootstrap on the Node adapter: JSON logs in production, security headers, CORS, shutdown hooks |
| `src/app.module.ts` | NestJS Observe, config, database, authentication, GraphQL, rate limits, the validation pipe, error filter and query cost plugin |
| `src/config.ts` | the environment, as a Zod schema checked at startup |
| `src/database/` | the Drizzle tables (`schema.ts`) and the development seed (`seed.ts`) |
| `src/graphql/` | the GraphQL module's options and the WebSocket checks (`graphql.config.ts`), the DataLoaders, the query cost limit, and the error helpers |
| `src/posts/` | the post and comment models, inputs, resolvers, `PostsService`, and `visibleTo()`, the rule for who sees a draft |
| `src/users/` | the user model, its resolver (`me`, `email`, `posts`), and the users repository |
| `src/auth/` | the sign-in mutations, the JWT provider, the refresh-token store, and the GraphQL throttler guard |
| `scripts/watch-comments.ts` | a `graphql-ws` client that prints a post's new comments |
| `test/` | e2e tests on PostgreSQL, over HTTP and a real WebSocket |
| `drizzle/` | migrations |
| `.agents/`, `.claude/` | NestJS skills for coding agents |

## Tests

```bash
TEST_DATABASE_URL=postgres://postgres:blog@localhost:5432/blog_test TEST_PORT=3001 npm run test:e2e
```

`docker compose` creates the `blog_test` database. The tests truncate its tables, so never point them at your development database; without `TEST_DATABASE_URL` they are skipped. The WebSocket tests listen on 127.0.0.1 at `TEST_PORT`. The tutorial's [Test it](https://docs.nestjs.com/tutorials/graphql-api#test-it) section explains what each file proves.

## Stack

[NestJS](https://nestjs.com) 12 on the Node adapter, [`@nestjs/graphql`](https://docs.nestjs.com/graphql/quick-start) with Apollo Server, `graphql-ws` and `graphql-query-complexity`, DataLoader, class-validator, [`@nestjs/authentication`](https://docs.nestjs.com/security/authentication), [`@nestjs/throttler`](https://docs.nestjs.com/security/rate-limiting), [`@nestjs/config`](https://docs.nestjs.com/application/configuration) with Zod, [Drizzle](https://docs.nestjs.com/data/drizzle) and PostgreSQL, [NestJS Observe](https://docs.nestjs.com/observability/overview), and Vitest.

## Production

Read the tutorial's production checklist first: https://docs.nestjs.com/tutorials/graphql-api#production-checklist. It covers what `NODE_ENV=production` turns on for GraphQL (introspection and GraphiQL off, masked errors, Apollo Server's CSRF prevention), and what to change before a second instance, such as the in-memory `PubSub`.

NestJS Observe is wired in `src/app.module.ts` and sends nothing until it has a key pair. `npx @nestjs/observe link` writes the key pair (`OBSERVE_APP_KEY`, `OBSERVE_APP_SECRET`) into `.env`; in production, set them in the platform's environment, since `start:prod` doesn't load `.env`. Observe then shows GraphQL requests by operation and records each resolver: https://docs.nestjs.com/observability/overview.

## License

MIT
