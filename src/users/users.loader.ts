import { Injectable, Scope } from '@nestjs/common';
import { InjectDrizzle } from '@nestjs/drizzle';
import DataLoader from 'dataloader';
import { getColumns, inArray } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { users } from '../database/schema.js';
import type { User } from './user.model.js';

const { passwordHash: _, ...columns } = getColumns(users);

/** Users by id, for one request. */
@Injectable({ scope: Scope.REQUEST })
export class UsersLoader {
  // Batching without a cache: a subscription is one request for as long as it runs,
  // and each of its events must see the rows as they are now.
  private readonly byId = new DataLoader<string, User | undefined>(
    async (ids) => {
      const rows = await this.db.select(columns).from(users).where(inArray(users.id, [...ids]));
      return ids.map((id) => rows.find((row) => row.id === id));
    },
    { cache: false },
  );

  constructor(@InjectDrizzle() private readonly db: NodePgDatabase) {}

  load(id: string): Promise<User | undefined> {
    return this.byId.load(id);
  }
}
