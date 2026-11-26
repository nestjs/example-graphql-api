import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
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
}
