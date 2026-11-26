import { Injectable, Scope } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import DataLoader from 'dataloader';
import { and, getColumns, inArray, lte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { posts, type PostRow } from '../database/schema.js';
import { visibleTo } from './visibility.js';

/** The latest posts of each author that the viewer may see, for one request. */
@Injectable({ scope: Scope.REQUEST })
export class PostsLoader {
  // One DataLoader per `first`; a request has one viewer.
  private readonly byFirst = new Map<number, DataLoader<string, PostRow[]>>();

  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  load(authorId: string, first: number, viewerId: string | null): Promise<PostRow[]> {
    let loader = this.byFirst.get(first);
    if (!loader) {
      // No cache, as in UsersLoader.
      loader = new DataLoader((authorIds) => this.latestOfEach([...authorIds], first, viewerId), { cache: false });
      this.byFirst.set(first, loader);
    }
    return loader.load(authorId);
  }

  private async latestOfEach(authorIds: string[], first: number, viewerId: string | null): Promise<PostRow[][]> {
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
  }
}
