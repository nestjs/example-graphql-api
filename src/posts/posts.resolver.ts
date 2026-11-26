import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import { User } from '../users/user.model.js';
import { UsersLoader } from '../users/users.loader.js';
import { CommentsLoader } from './comments.loader.js';
import { Comment } from './comment.model.js';
import { Post, PostConnection } from './post.model.js';
import { CreatePostInput, FirstArgs, PostArgs, PostsArgs, UpdatePostInput } from './posts.inputs.js';
import { PostsService } from './posts.service.js';

// Anyone may read; a signed-in viewer also sees their own drafts.
@Authenticate({ optional: true })
@Resolver(() => Post)
export class PostsResolver {
  constructor(
    private readonly postsService: PostsService,
    private readonly usersLoader: UsersLoader,
    private readonly commentsLoader: CommentsLoader,
  ) {}

  @Query(() => PostConnection)
  posts(@Args() args: PostsArgs) {
    return this.postsService.list(args);
  }

  @Query(() => Post, { nullable: true })
  post(@Args() { id }: PostArgs, @CurrentUser('id') viewerId: string | null) {
    return this.postsService.findVisible(id, viewerId ?? null);
  }

  @ResolveField(() => User)
  author(@Parent() post: Post) {
    return this.usersLoader.load(post.authorId);
  }

  @ResolveField(() => [Comment])
  comments(@Parent() post: Post, @Args() { first }: FirstArgs) {
    return this.commentsLoader.load(post.id, first);
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
