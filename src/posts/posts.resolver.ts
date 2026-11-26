import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { Args, Context, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import type { Loaders } from '../graphql/loaders.js';
import { perItem } from '../graphql/query-cost.js';
import { User } from '../users/user.model.js';
import { Comment } from './comment.model.js';
import { Post, PostConnection } from './post.model.js';
import { CreatePostInput, FirstArgs, PostArgs, PostsArgs, UpdatePostInput } from './posts.inputs.js';
import { PostsService } from './posts.service.js';

// Anyone may read; a signed-in viewer also sees their own drafts.
@Authenticate({ optional: true })
@Resolver(() => Post)
export class PostsResolver {
  constructor(private readonly postsService: PostsService) {}

  @Query(() => PostConnection, { complexity: perItem })
  posts(@Args() args: PostsArgs) {
    return this.postsService.list(args);
  }

  @Query(() => Post, { nullable: true })
  post(@Args() { id }: PostArgs, @CurrentUser('id') viewerId: string | null) {
    return this.postsService.findVisible(id, viewerId ?? null);
  }

  @ResolveField(() => User)
  author(@Parent() post: Post, @Context('loaders') loaders: Loaders) {
    return loaders.user(post.authorId);
  }

  @ResolveField(() => [Comment], { complexity: perItem })
  comments(@Parent() post: Post, @Args() { first }: FirstArgs, @Context('loaders') loaders: Loaders) {
    return loaders.comments(post.id, first);
  }

  @Authenticate({ optional: false })
  @Mutation(() => Post)
  createPost(@CurrentUser('id') userId: string, @Args('input') input: CreatePostInput) {
    return this.postsService.create(userId, input);
  }

  @Authenticate({ optional: false })
  @Mutation(() => Post)
  updatePost(@CurrentUser('id') userId: string, @Args('input') input: UpdatePostInput) {
    return this.postsService.update(userId, input);
  }

  @Authenticate({ optional: false })
  @Mutation(() => Post)
  publishPost(@CurrentUser('id') userId: string, @Args() { id }: PostArgs) {
    return this.postsService.publish(userId, id);
  }
}
