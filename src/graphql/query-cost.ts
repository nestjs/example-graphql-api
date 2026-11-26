import type { ApolloServerPlugin, GraphQLRequestListener } from '@apollo/server';
import { Plugin } from '@nestjs/apollo';
import { GraphQLSchemaHost, type ComplexityEstimator } from '@nestjs/graphql';
import { GraphQLError, type DocumentNode, type GraphQLSchema } from 'graphql';
import { fieldExtensionsEstimator, getComplexity, simpleEstimator } from 'graphql-query-complexity';

export const MAX_QUERY_COST = 1_000;

/** A list costs its size times the cost of one item. */
export const perItem: ComplexityEstimator = ({ args, childComplexity }) => args.first * childComplexity;

/** The error that refuses an operation that would cost too much, or undefined. */
export function queryCostError(
  schema: GraphQLSchema,
  query: DocumentNode,
  variables?: Record<string, unknown>,
  operationName?: string | null,
): GraphQLError | undefined {
  const estimators = [fieldExtensionsEstimator(), simpleEstimator({ defaultComplexity: 1 })];
  const cost = getComplexity({ schema, query, variables, operationName: operationName ?? undefined, estimators });
  if (cost <= MAX_QUERY_COST) {
    return undefined;
  }
  return new GraphQLError(`Query is too expensive: its cost is ${cost}, the maximum is ${MAX_QUERY_COST}`, {
    // Apollo Server answers with this status, rather than a 500, and leaves `http` out of the body.
    extensions: { code: 'QUERY_TOO_EXPENSIVE', cost, maxCost: MAX_QUERY_COST, http: { status: 400 } },
  });
}

/** Checks every operation that arrives over HTTP, once it's parsed and validated. */
@Plugin()
export class QueryCostPlugin implements ApolloServerPlugin {
  constructor(private readonly schemaHost: GraphQLSchemaHost) {}

  async requestDidStart(): Promise<GraphQLRequestListener<object>> {
    const { schema } = this.schemaHost;
    return {
      async didResolveOperation({ request, document }) {
        const error = queryCostError(schema, document, request.variables, request.operationName);
        if (error) {
          throw error;
        }
      },
    };
  }
}
