import { Inject } from '@nestjs/common';
import { Authenticate, CurrentUser } from '@nestjs/authentication';
import { Args, Context, Mutation, Parent, ResolveField, Resolver, Subscription } from '@nestjs/graphql';
import { PubSub } from 'graphql-subscriptions';
import { notFound } from '../graphql/errors.js';
import type { Loaders } from '../graphql/loaders.js';
import { User } from '../users/user.model.js';
import { Comment } from './comment.model.js';
import { AddCommentInput, CommentAddedArgs } from './posts.inputs.js';
import { PostsService, PUB_SUB, commentAddedTopic } from './posts.service.js';

@Authenticate({ optional: true })
@Resolver(() => Comment)
export class CommentsResolver {
  constructor(
    private readonly postsService: PostsService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {}

  @ResolveField(() => User)
  author(@Parent() comment: Comment, @Context('loaders') loaders: Loaders) {
    return loaders.user(comment.authorId);
  }

  @Authenticate({ optional: false })
  @Mutation(() => Comment)
  addComment(@CurrentUser('id') userId: string, @Args('input') input: AddCommentInput) {
    return this.postsService.addComment(userId, input);
  }

  @Authenticate({ optional: false })
  @Subscription(() => Comment)
  async commentAdded(@Args() { postId }: CommentAddedArgs, @CurrentUser('id') userId: string) {
    // Subscribing to someone else's draft is the same as to a post that doesn't exist.
    if (!(await this.postsService.findVisible(postId, userId))) {
      notFound('Post');
    }
    // One topic per post: a comment wakes only the subscribers of its own post.
    return this.pubSub.asyncIterableIterator(commentAddedTopic(postId));
  }
}
