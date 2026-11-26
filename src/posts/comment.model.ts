import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Comment {
  @Field(() => ID)
  id: string;

  @Field()
  body: string;

  @Field()
  createdAt: Date;

  postId: string;
  // Resolved by CommentsResolver as `author`.
  authorId: string;
}
