import { Module } from '@nestjs/common';
import { UsersLoader } from './users.loader.js';
import { UsersRepository } from './users.repository.js';
import { UsersResolver } from './users.resolver.js';

@Module({
  providers: [UsersRepository, UsersLoader, UsersResolver],
  exports: [UsersRepository, UsersLoader],
})
export class UsersModule {}
