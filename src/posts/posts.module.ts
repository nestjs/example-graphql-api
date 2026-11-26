import { Module } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { CommentsResolver } from './comments.resolver.js';
import { PostsResolver } from './posts.resolver.js';
import { PostsService, PUB_SUB } from './posts.service.js';

@Module({
  providers: [
    PostsResolver,
    CommentsResolver,
    PostsService,
    // In memory, in this process: see the production checklist.
    { provide: PUB_SUB, useValue: new PubSub() },
  ],
})
export class PostsModule {}
