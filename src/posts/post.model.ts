import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Post {
  @Field(() => ID)
  id: string;

  @Field()
  title: string;

  @Field()
  body: string;

  @Field(() => Date, { nullable: true, description: 'Null while the post is a draft.' })
  publishedAt: Date | null;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  // Resolved by PostsResolver as `author`.
  authorId: string;
}

@ObjectType()
export class PostEdge {
  @Field()
  cursor: string;

  @Field(() => Post)
  node: Post;
}

@ObjectType()
export class PageInfo {
  @Field()
  hasNextPage: boolean;

  @Field(() => String, { nullable: true })
  endCursor: string | null;
}

@ObjectType()
export class PostConnection {
  @Field(() => [PostEdge])
  edges: PostEdge[];

  @Field(() => PageInfo)
  pageInfo: PageInfo;
}
