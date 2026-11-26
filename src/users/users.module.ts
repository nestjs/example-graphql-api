import { Module } from '@nestjs/common';
import { UsersRepository } from './users.repository.js';
import { UsersResolver } from './users.resolver.js';

@Module({
  providers: [UsersRepository, UsersResolver],
  exports: [UsersRepository],
})
export class UsersModule {}
