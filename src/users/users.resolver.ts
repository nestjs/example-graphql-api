import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { Args, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { Loaders } from '../graphql/loaders.js';
import { Post } from '../posts/post.model.js';
import { FirstArgs } from '../posts/posts.inputs.js';
import { User } from './user.model.js';

@Authenticate({ optional: true })
@Resolver(() => User)
export class UsersResolver {
  constructor(private readonly loaders: Loaders) {}

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

  @ResolveField(() => [Post])
  posts(
    @Parent() user: User,
    @Args() { first }: FirstArgs,
    @CurrentUser('id') viewerId: string | null,
  ) {
    return this.loaders.posts(user.id, first, viewerId ?? null);
  }
}
