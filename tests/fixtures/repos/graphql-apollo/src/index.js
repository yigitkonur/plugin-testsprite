import { readFileSync } from 'node:fs';
import express from 'express';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@apollo/server/express4';

const typeDefs = readFileSync(new URL('../schema.graphql', import.meta.url), 'utf8');
const resolvers = { Query: { viewer: () => ({ id: '1', email: 'user@example.com' }) } };

const server = new ApolloServer({ typeDefs, resolvers });
await server.start();

const app = express();
app.use('/graphql', express.json(), expressMiddleware(server));
app.listen(4000);
