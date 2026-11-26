import { Catch, type ValidationError } from '@nestjs/common';
import type { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';

export function notFound(what: string): never {
  throw new GraphQLError(`${what} not found`, { extensions: { code: 'NOT_FOUND' } });
}

/** The validation pipe's errors: BAD_USER_INPUT, with every message, by field. */
export function badUserInput(errors: ValidationError[]): GraphQLError {
  const fields = Object.fromEntries(errors.map((error) => [error.property, Object.values(error.constraints ?? {})]));
  return new GraphQLError(Object.values(fields).flat().join('; '), {
    extensions: { code: 'BAD_USER_INPUT', fields },
  });
}

/** A GraphQLError is an answer the code chose: pass it on. Nest would log it as an unexpected error. */
@Catch(GraphQLError)
export class GraphQLErrorFilter implements GqlExceptionFilter {
  catch(error: GraphQLError) {
    return error;
  }
}
