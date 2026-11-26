import { Field, InputType, Int, ObjectType } from '@nestjs/graphql';
import { IsEmail, IsNotEmpty, Length, MaxLength } from 'class-validator';

@InputType()
export class SignUpInput {
  @Field()
  @IsEmail()
  email: string;

  @Field()
  @Length(1, 100)
  name: string;

  @Field()
  @Length(12, 128)
  password: string;
}

@InputType()
export class SignInInput {
  @Field()
  @IsEmail()
  email: string;

  // No minimum here: a password set under an older rule still signs in.
  @Field()
  @MaxLength(128)
  password: string;
}

@InputType()
export class RefreshTokenInput {
  @Field()
  @IsNotEmpty()
  refreshToken: string;
}

@ObjectType()
export class AuthPayload {
  @Field()
  accessToken: string;

  @Field()
  refreshToken: string;

  @Field(() => Int, { description: "The access token's lifetime, in seconds." })
  expiresIn: number;
}
