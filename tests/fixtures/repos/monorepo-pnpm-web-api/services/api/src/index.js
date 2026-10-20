const fastify = require('fastify')();

fastify.get('/ping', async () => ({ pong: true }));

fastify.listen({ port: 8081 });
