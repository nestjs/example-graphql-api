import { eq, isNotNull, or, type SQL } from 'drizzle-orm';
import { posts } from '../database/schema.js';

/** The posts a viewer may see: every published post, and their own drafts. Every query that reads posts uses it. */
export function visibleTo(viewerId: string | null): SQL {
  const published = isNotNull(posts.publishedAt);
  return viewerId ? or(published, eq(posts.authorId, viewerId))! : published;
}
