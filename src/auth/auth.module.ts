import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { AuthResolver } from './auth.resolver.js';
import { CredentialsService } from './credentials.service.js';
import { DrizzleRefreshTokenStore } from './drizzle-refresh-token.store.js';
import { JwtAuth } from './jwt-auth.provider.js';

@Module({
  imports: [UsersModule],
  providers: [AuthResolver, JwtAuth, CredentialsService, DrizzleRefreshTokenStore],
})
export class AuthModule {}
