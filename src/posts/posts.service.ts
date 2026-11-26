import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import { isUUID } from 'class-validator';
import { and, desc, eq, isNotNull, lt, or, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { GraphQLError } from 'graphql';
import { PubSub } from 'graphql-subscriptions';
import { comments, posts, type CommentRow, type PostRow } from '../database/schema.js';
import { notFound } from '../graphql/errors.js';
import type { AddCommentInput, CreatePostInput, PostsArgs, UpdatePostInput } from './posts.inputs.js';
import { visibleTo } from './visibility.js';

export const PUB_SUB = Symbol('PUB_SUB');
// One topic per post: a comment wakes the subscribers of its own post only.
export const commentAddedTopic = (postId: string) => `commentAdded.${postId}`;

@Injectable()
export class PostsService {
  constructor(
    @InjectDrizzle() private readonly db: NodePgDatabase,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  /** Published posts, newest first, one page at a time. */
  async list({ first, after }: PostsArgs) {
    const cursor = after ? decodeCursor(after) : undefined;
    const rows = await this.db
      .select()
      .from(posts)
      .where(
        and(
          isNotNull(posts.publishedAt),
          // After the cursor: published earlier, or in the same millisecond with a smaller id.
          cursor &&
            or(
              lt(posts.publishedAt, cursor.publishedAt),
              and(eq(posts.publishedAt, cursor.publishedAt), lt(posts.id, cursor.id)),
            ),
        ),
      )
      .orderBy(desc(posts.publishedAt), desc(posts.id))
      // One more than a page: if it comes back, there's a next page.
      .limit(first + 1);
    const edges = rows.slice(0, first).map((node) => ({ node, cursor: encodeCursor(node) }));
    return { edges, pageInfo: { hasNextPage: rows.length > first, endCursor: edges.at(-1)?.cursor ?? null } };
  }

  /** The post, if the viewer may see it: someone else's draft is as missing as an unknown id. */
  async findVisible(id: string, viewerId: string | null): Promise<PostRow | null> {
    const [post] = await this.db
      .select()
      .from(posts)
      .where(and(eq(posts.id, id), visibleTo(viewerId)));
    return post ?? null;
  }

  async create(authorId: string, input: CreatePostInput): Promise<PostRow> {
    const [post] = await this.db
      .insert(posts)
      .values({ ...input, authorId })
      .returning();
    return post;
  }

  async update(authorId: string, { id, ...changes }: UpdatePostInput): Promise<PostRow> {
    // The author is part of the statement: no window between a check and the write.
    const [post] = await this.db
      .update(posts)
      .set({ ...changes, updatedAt: new Date() })
      .where(and(eq(posts.id, id), eq(posts.authorId, authorId)))
      .returning();
    return post ?? this.refuse(id, authorId);
  }

  async publish(authorId: string, id: string): Promise<PostRow> {
    // coalesce(): publishing a published post again keeps its date.
    const [post] = await this.db
      .update(posts)
      .set({ publishedAt: sql`coalesce(${posts.publishedAt}, now())` })
      .where(and(eq(posts.id, id), eq(posts.authorId, authorId)))
      .returning();
    return post ?? this.refuse(id, authorId);
  }

  async addComment(authorId: string, { postId, body }: AddCommentInput): Promise<CommentRow> {
    // Published posts only: to anyone, the author included, a draft takes no comments.
    if (!(await this.findVisible(postId, null))) {
      notFound('Post');
    }
    const [comment] = await this.db.insert(comments).values({ postId, authorId, body }).returning();
    await this.pubSub.publish(commentAddedTopic(postId), { commentAdded: comment });
    return comment;
  }

  /** Why a write matched nothing: someone else's post is FORBIDDEN, if the user may see it. */
  private async refuse(id: string, userId: string): Promise<never> {
    if (await this.findVisible(id, userId)) {
      throw new ForbiddenException('Only the author can change this post');
    }
    notFound('Post');
  }
}

// The cursor is the last post's publication time and id: opaque to clients,
// but client input all the same, checked before it reaches a query.
function encodeCursor(post: PostRow): string {
  return Buffer.from(`${post.publishedAt!.getTime()}:${post.id}`).toString('base64url');
}

function decodeCursor(cursor: string): { publishedAt: Date; id: string } {
  const [, time, id] = /^(\d{1,15}):([0-9a-f-]{36})$/.exec(Buffer.from(cursor, 'base64url').toString()) ?? [];
  if (!time || !isUUID(id)) {
    throw new GraphQLError('Invalid cursor', { extensions: { code: 'BAD_USER_INPUT' } });
  }
  return { publishedAt: new Date(Number(time)), id };
}
