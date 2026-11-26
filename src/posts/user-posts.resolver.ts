import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { User } from '../users/user.model.js';
import { Post } from './post.model.js';
import { FirstArgs } from './posts.inputs.js';
import { PostsLoader } from './posts.loader.js';

// A field of User, resolved here, in the posts feature: PostsModule imports UsersModule, never the reverse.
@Authenticate({ optional: true })
@Resolver(() => User)
export class UserPostsResolver {
  constructor(private readonly postsLoader: PostsLoader) {}

  @ResolveField(() => [Post])
  posts(@Parent() user: User, @Args() { first }: FirstArgs, @CurrentUser('id') viewerId: string | null) {
    return this.postsLoader.load(user.id, first, viewerId ?? null);
  }
}
