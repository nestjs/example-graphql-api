import { Injectable, Scope } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import DataLoader from 'dataloader';
import { and, getColumns, inArray, lte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { comments, posts, users, type CommentRow, type PostRow } from '../database/schema.js';
import { visibleTo } from '../posts/visibility.js';
import type { User } from '../users/user.model.js';

const { passwordHash: _, ...userColumns } = getColumns(users);

/**
 * Batches the nested fields of one request: `author` for 50 posts is one query, not 50.
 * Request-scoped: a new instance for every request, so no batch mixes two requests or two users.
 */
@Injectable({ scope: Scope.REQUEST })
export class Loaders {
  private readonly loaders = new Map<string, DataLoader<string, unknown>>();

  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  user(id: string): Promise<User | undefined> {
    return this.load('users', id, async (ids) => {
      const rows = await this.db.select(userColumns).from(users).where(inArray(users.id, ids));
      return ids.map((id) => rows.find((row) => row.id === id));
    });
  }

  /** The first comments of each post, oldest first. */
  comments(postId: string, first: number): Promise<CommentRow[]> {
    return this.load(`comments:${first}`, postId, async (postIds) => {
      // row_number() starts again at 1 for each post: one query, `first` comments per post.
      const ranked = this.db
        .select({
          ...getColumns(comments),
          rank: sql<number>`row_number() over (partition by ${comments.postId} order by ${comments.createdAt}, ${comments.id})`.as('rank'),
        })
        .from(comments)
        .where(inArray(comments.postId, postIds))
        .as('ranked');
      const rows = await this.db.select().from(ranked).where(lte(ranked.rank, first)).orderBy(ranked.rank);
      return postIds.map((id) => rows.filter((row) => row.postId === id));
    });
  }

  /** The latest posts of each author that the viewer may see: drafts first, for the author. */
  posts(authorId: string, first: number, viewerId: string | null): Promise<PostRow[]> {
    return this.load(`posts:${first}:${viewerId}`, authorId, async (authorIds) => {
      const ranked = this.db
        .select({
          ...getColumns(posts),
          rank: sql<number>`row_number() over (partition by ${posts.authorId} order by ${posts.publishedAt} desc nulls first, ${posts.id} desc)`.as('rank'),
        })
        .from(posts)
        .where(and(inArray(posts.authorId, authorIds), visibleTo(viewerId)))
        .as('ranked');
      const rows = await this.db.select().from(ranked).where(lte(ranked.rank, first)).orderBy(ranked.rank);
      return authorIds.map((id) => rows.filter((row) => row.authorId === id));
    });
  }

  /** One DataLoader per kind of batch, created on first use: `first` and the viewer are part of the kind. */
  private load<V>(kind: string, key: string, batch: (keys: string[]) => Promise<V[]>): Promise<V> {
    let loader = this.loaders.get(kind) as DataLoader<string, V> | undefined;
    if (!loader) {
      // Batching without a cache: a subscription is one request, which keeps these loaders
      // for as long as it runs, and every event must see the rows as they are now.
      loader = new DataLoader<string, V>((keys) => batch([...keys]), { cache: false });
      this.loaders.set(kind, loader);
    }
    return loader.load(key);
  }
}
