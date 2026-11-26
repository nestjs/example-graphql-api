import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { Args, Context, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import type { Loaders } from '../graphql/loaders.js';
import { perItem } from '../graphql/query-cost.js';
import { Post } from '../posts/post.model.js';
import { FirstArgs } from '../posts/posts.inputs.js';
import { User } from './user.model.js';

@Authenticate({ optional: true })
@Resolver(() => User)
export class UsersResolver {
  @Authenticate({ optional: false })
  @Query(() => User)
  me(@CurrentUser() user: User) {
    return user;
  }

  // Only the user themselves sees their address; anyone else gets null.
  @ResolveField(() => String, { nullable: true })
  email(@Parent() user: User, @CurrentUser('id') viewerId: string | null) {
    return user.id === viewerId ? user.email : null;
  }

  @ResolveField(() => [Post], { complexity: perItem })
  posts(
    @Parent() user: User,
    @Args() { first }: FirstArgs,
    @CurrentUser('id') viewerId: string | null,
    @Context('loaders') loaders: Loaders,
  ) {
    return loaders.posts(user.id, first, viewerId ?? null);
  }
}
