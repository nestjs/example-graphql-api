import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AuthenticationModule } from '@nestjs/authentication';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { DrizzleModule } from '@nestjs/drizzle';
import { GraphQLModule } from '@nestjs/graphql';
import { createObserveModule } from '@nestjs/observe';
import { ThrottlerModule, minutes, normalizeIp } from '@nestjs/throttler';
import { drizzle } from 'drizzle-orm/node-postgres';
import { AuthModule } from './auth/auth.module.js';
import { accountEmail } from './auth/gql-throttler.guard.js';
import { envSchema, type Env } from './config.js';
import { badUserInput, GraphQLErrorFilter } from './graphql/errors.js';
import { GraphqlConfig } from './graphql/graphql.config.js';
import { QueryCostPlugin } from './graphql/query-cost.js';
import { PostsModule } from './posts/posts.module.js';
import { UsersModule } from './users/users.module.js';

export const { ObserveModule, ObserveInstrument } = createObserveModule();

@Module({
  imports: [
    // First, so it shuts down last and still sends what the other modules did.
    ObserveModule.forRoot({
      // Empty until `npx @nestjs/observe link` writes the key pair into .env: the SDK then sends nothing.
      appKey: process.env.OBSERVE_APP_KEY ?? '',
      appSecret: process.env.OBSERVE_APP_SECRET ?? '',
      serviceId: 'blog-api',
    }),
    ConfigModule.forRoot({ isGlobal: true, validationSchema: envSchema }),
    DrizzleModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        drizzle,
        connection: config.get('DATABASE_URL', { infer: true }),
      }),
    }),
    AuthenticationModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        accessToken: {
          key: config.get('JWT_SECRET', { infer: true }),
          issuer: 'blog-api',
          audience: 'blog-api',
          ttl: '15m',
        },
        refreshToken: { ttl: '30d', absoluteTtl: '90d' },
      }),
    }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useClass: GraphqlConfig,
    }),
    ThrottlerModule.forRoot([
      // Per IP address, on the mutations that sign users in.
      { name: 'default', ttl: minutes(1), limit: 100 },
      // Per email and IP address, wherever the mutation's input names an account.
      {
        name: 'account',
        ttl: minutes(15),
        limit: 5,
        skipIf: (context) => !accountEmail(context),
        getTracker: (req, context) => `${accountEmail(context)}|${normalizeIp(req.ip)}`,
      },
    ]),
    UsersModule,
    AuthModule,
    PostsModule,
  ],
  providers: [
    { provide: APP_PIPE, useValue: new ValidationPipe({ transform: true, exceptionFactory: badUserInput }) },
    { provide: APP_FILTER, useClass: GraphQLErrorFilter },
    QueryCostPlugin,
  ],
})
export class AppModule {}
