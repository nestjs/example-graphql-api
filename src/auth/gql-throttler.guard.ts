import { Injectable, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import { GraphQLError } from 'graphql';
import { normalize } from '../users/users.repository.js';

@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  // The request and response are on the GraphQL context, not in the handler's arguments.
  protected getRequestResponse(context: ExecutionContext) {
    const { req, res } = GqlExecutionContext.create(context).getContext();
    return { req, res };
  }

  // A 429 would reach a GraphQL client as INTERNAL_SERVER_ERROR: give it a code it can act on.
  protected async throwThrottlingException(_context: ExecutionContext, { timeToBlockExpire }: ThrottlerLimitDetail) {
    throw new GraphQLError('Too many requests', {
      extensions: { code: 'TOO_MANY_REQUESTS', retryAfter: timeToBlockExpire },
    });
  }
}

/** The address the mutation's `input` names, normalized as the users table stores it, or `''`. */
export function accountEmail(context: ExecutionContext): string {
  const email = GqlExecutionContext.create(context).getArgs<{ input?: { email?: unknown } }>().input?.email;
  return typeof email === 'string' ? normalize(email) : '';
}
