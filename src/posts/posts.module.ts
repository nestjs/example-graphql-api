import { Module } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { LoadersModule } from '../graphql/loaders.module.js';
import { CommentAuthorResolver, CommentsResolver } from './comments.resolver.js';
import { PostsResolver } from './posts.resolver.js';
import { PostsService, PUB_SUB } from './posts.service.js';

@Module({
  imports: [LoadersModule],
  providers: [
    PostsResolver,
    CommentsResolver,
    CommentAuthorResolver,
    PostsService,
    // In memory, in this process: see the production checklist.
    { provide: PUB_SUB, useValue: new PubSub() },
  ],
})
export class PostsModule {}
