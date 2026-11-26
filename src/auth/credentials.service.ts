import { Injectable } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { GraphQLError } from 'graphql';
import type { User } from '../users/user.model.js';
import { UsersRepository } from '../users/users.repository.js';

@Injectable()
export class CredentialsService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async register(email: string, name: string, password: string): Promise<User> {
    const user = await this.usersRepository.create(email, name, await this.passwordHasher.hash(password));
    if (!user) {
      throw new GraphQLError('Email already registered', { extensions: { code: 'EMAIL_TAKEN' } });
    }
    return user;
  }

  /** The user, or `null` when the email or the password is wrong. */
  async verify(email: string, password: string): Promise<User | null> {
    const found = await this.usersRepository.findCredentials(email);
    // With no account, verify() checks a dummy hash, so the response
    // time doesn't reveal which emails are registered.
    const valid = await this.passwordHasher.verify(password, found?.passwordHash);
    return valid && found ? found.user : null;
  }
}
