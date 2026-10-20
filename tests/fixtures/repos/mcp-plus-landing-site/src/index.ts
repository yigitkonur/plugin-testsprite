import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new McpServer({ name: 'mcp-plus-landing-site', version: '0.1.0' });

server.tool('ping', {}, async () => ({ content: [{ type: 'text', text: 'pong' }] }));

await server.connect(new StdioServerTransport());
