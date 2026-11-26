import type { IncomingMessage } from 'node:http';
import type { ApolloDriverConfig } from '@nestjs/apollo';
import { Injectable } from '@nestjs/common';
import { WsAuthenticator } from '@nestjs/authentication';
import type { GqlOptionsFactory } from '@nestjs/graphql';
import { GraphQLError, getOperationAST, parse } from 'graphql';
import type { Context, SubscribePayload } from 'graphql-ws';
import type { Extra } from 'graphql-ws/use/ws';

type SocketContext = Context<Record<string, unknown> | undefined, Extra>;

@Injectable()
export class GraphqlConfig implements GqlOptionsFactory<ApolloDriverConfig> {
  constructor(private readonly wsAuthenticator: WsAuthenticator) {}

  createGqlOptions(): ApolloDriverConfig {
    const production = process.env.NODE_ENV === 'production';
    return {
      autoSchemaFile: true,
      sortSchema: true,
      subscriptions: {
        'graphql-ws': {
          onConnect: (context) => this.authenticateSocket(context as SocketContext),
          onSubscribe: (_context, _id, payload) => this.checkSocketOperation(payload),
        },
      },
      // Called for every operation. Over graphql-ws, the socket's upgrade request stands in for `req`.
      context: ({ req, res, extra }: { req?: IncomingMessage; res?: unknown; extra?: Extra }) => ({
        req: req ?? extra?.request,
        res,
      }),
      fieldResolverEnhancers: ['guards', 'interceptors', 'filters'],
      formatError: (error) =>
        // In production, an error nobody threw on purpose tells the client nothing.
        production && error.extensions?.code === 'INTERNAL_SERVER_ERROR'
          ? { message: 'Internal server error', path: error.path, extensions: { code: 'INTERNAL_SERVER_ERROR' } }
          : error,
    };
  }

  /** Runs once per socket: `false` closes it with 4403 Forbidden. */
  private async authenticateSocket({ connectionParams, extra }: SocketContext) {
    // Browsers can't set headers on a WebSocket: the token comes in connectionParams,
    // and goes on the upgrade request, where the guard reads it for every operation.
    if (typeof connectionParams?.authorization === 'string') {
      extra.request.headers.authorization = connectionParams.authorization;
    }
    const result = await this.wsAuthenticator.authenticateConnection(extra.socket, extra.request, { required: false });
    return result !== null;
  }

  /**
   * graphql-ws runs operations outside Apollo Server, whose plugins don't apply to them.
   * The socket serves subscriptions only; queries and mutations go over HTTP.
   */
  private checkSocketOperation({ query, operationName }: SubscribePayload) {
    let document;
    try {
      document = parse(query);
    } catch (error) {
      return [error as GraphQLError];
    }
    if (getOperationAST(document, operationName)?.operation !== 'subscription') {
      return [new GraphQLError('Only subscriptions are served over WebSocket: send queries and mutations over HTTP')];
    }
    return undefined;
  }
}
