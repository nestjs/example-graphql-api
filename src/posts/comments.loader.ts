import { Injectable, Scope } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import DataLoader from 'dataloader';
import { getColumns, inArray, lte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { comments, type CommentRow } from '../database/schema.js';

/** The first comments of each post, oldest first, for one request. */
@Injectable({ scope: Scope.REQUEST })
export class CommentsLoader {
  // One DataLoader per `first`.
  private readonly byFirst = new Map<number, DataLoader<string, CommentRow[]>>();

  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  load(postId: string, first: number): Promise<CommentRow[]> {
    let loader = this.byFirst.get(first);
    if (!loader) {
      // No cache, as in UsersLoader.
      loader = new DataLoader((postIds) => this.firstOfEach([...postIds], first), { cache: false });
      this.byFirst.set(first, loader);
    }
    return loader.load(postId);
  }

  private async firstOfEach(postIds: string[], first: number): Promise<CommentRow[][]> {
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
  }
}
