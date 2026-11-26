import { Module } from '@nestjs/common';
import { LoadersModule } from '../graphql/loaders.module.js';
import { UsersRepository } from './users.repository.js';
import { UsersResolver } from './users.resolver.js';

@Module({
  imports: [LoadersModule],
  providers: [UsersRepository, UsersResolver],
  exports: [UsersRepository],
})
export class UsersModule {}
