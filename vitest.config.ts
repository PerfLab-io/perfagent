import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		testTimeout: 30000, // 30 seconds for MCP operations
		hookTimeout: 10000, // 10 seconds for setup/teardown
		env: {
			// Mock environment variables for testing
			RESEND_API_KEY: 'test-resend-key',
			TAVILY_API_KEY: 'test-tavily-key',
			GEMINI_API_KEY: 'test-gemini-key',
			LANGFUSE_SECRET_KEY: 'test-langfuse-secret',
			LANGFUSE_PUBLIC_KEY: 'test-langfuse-public',
			LANGFUSE_BASEURL: 'https://test-langfuse.com',
			DB_URL: 'postgresql://test:test@localhost:5432/test',
			KV_REST_API_URL: 'https://test-kv.upstash.io',
			KV_REST_API_TOKEN: 'test-kv-token',
		},
	},
	resolve: {
		alias: {
			'@': path.resolve(__dirname, '.'),
		},
	},
});