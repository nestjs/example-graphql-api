import { Module } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { UsersModule } from '../users/users.module.js';
import { CommentAuthorResolver, CommentsResolver } from './comments.resolver.js';
import { CommentsLoader } from './comments.loader.js';
import { PostsLoader } from './posts.loader.js';
import { PostsResolver } from './posts.resolver.js';
import { PostsService, PUB_SUB } from './posts.service.js';
import { UserPostsResolver } from './user-posts.resolver.js';

@Module({
  // For UsersLoader. UsersModule imports nothing of the posts feature.
  imports: [UsersModule],
  providers: [
    PostsResolver,
    CommentsResolver,
    CommentAuthorResolver,
    UserPostsResolver,
    PostsService,
    PostsLoader,
    CommentsLoader,
    // In memory, in this process: see the production checklist.
    { provide: PUB_SUB, useValue: new PubSub() },
  ],
  exports: [PostsLoader, CommentsLoader],
})
export class PostsModule {}
