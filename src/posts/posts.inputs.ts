import { ArgsType, Field, ID, InputType, Int } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID, Length, Max, MaxLength, Min, ValidateIf } from 'class-validator';

// Optional, but never null: @IsOptional() would let a null through to a NOT NULL column.
const ifSent = ValidateIf((_object, value) => value !== undefined);

@ArgsType()
export class PostArgs {
  @Field(() => ID)
  @IsUUID()
  id: string;
}

/** The size of a list, such as a post's comments. */
@ArgsType()
export class FirstArgs {
  @Field(() => Int, { defaultValue: 10 })
  @Min(1)
  @Max(50)
  first: number;
}

@ArgsType()
export class PostsArgs extends FirstArgs {
  @Field(() => String, { nullable: true, description: 'The endCursor of the previous page.' })
  @IsOptional()
  @MaxLength(100)
  after?: string | null;
}

@InputType()
export class CreatePostInput {
  @Field()
  @Length(1, 200)
  title: string;

  @Field()
  @MaxLength(50_000)
  body: string;
}

@InputType()
export class UpdatePostInput {
  @Field(() => ID)
  @IsUUID()
  id: string;

  @Field(() => String, { nullable: true })
  @ifSent
  @IsString()
  @Length(1, 200)
  title?: string;

  @Field(() => String, { nullable: true })
  @ifSent
  @IsString()
  @MaxLength(50_000)
  body?: string;
}

@InputType()
export class AddCommentInput {
  @Field(() => ID)
  @IsUUID()
  postId: string;

  @Field()
  @Length(1, 5_000)
  body: string;
}

@ArgsType()
export class CommentAddedArgs {
  @Field(() => ID)
  @IsUUID()
  postId: string;
}
