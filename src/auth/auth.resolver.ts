import { Logger, UnauthorizedException, UseGuards } from '@nestjs/common';
import { Public, TokenService } from '@nestjs/authentication';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { SkipThrottle, Throttle, hours, minutes } from '@nestjs/throttler';
import { AuthPayload, RefreshTokenInput, SignInInput, SignUpInput } from './auth.inputs.js';
import { CredentialsService } from './credentials.service.js';
import { GqlThrottlerGuard } from './gql-throttler.guard.js';

@Public()
@UseGuards(GqlThrottlerGuard)
@Resolver()
export class AuthResolver {
  private readonly logger = new Logger(AuthResolver.name);

  constructor(
    private readonly credentialsService: CredentialsService,
    private readonly tokenService: TokenService,
  ) {}

  @SkipThrottle({ account: true })
  @Throttle({ default: { limit: 10, ttl: hours(1) } })
  @Mutation(() => AuthPayload)
  async signUp(@Args('input') { email, name, password }: SignUpInput) {
    const user = await this.credentialsService.register(email, name, password);
    return this.tokenService.issue(user.id, { method: 'password', claims: { amr: ['pwd'] } });
  }

  @Throttle({
    default: { limit: 30, ttl: minutes(15) },
    account: { limit: 5, ttl: minutes(15) },
  })
  @Mutation(() => AuthPayload)
  async signIn(@Args('input') { email, password }: SignInInput) {
    const user = await this.credentialsService.verify(email, password);
    if (!user) {
      this.logger.warn('Sign-in failed', { email });
      throw new UnauthorizedException('Invalid email or password');
    }
    return this.tokenService.issue(user.id, { method: 'password', claims: { amr: ['pwd'] } });
  }

  // An unknown, expired or reused refresh token is UNAUTHENTICATED; reuse revokes the family.
  @Mutation(() => AuthPayload)
  refreshToken(@Args('input') { refreshToken }: RefreshTokenInput) {
    return this.tokenService.refresh(refreshToken);
  }
}
