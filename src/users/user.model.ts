import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class User {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  // Not a @Field: UsersResolver adds it to the schema, for the user themselves only.
  email: string;

  @Field()
  createdAt: Date;
}
