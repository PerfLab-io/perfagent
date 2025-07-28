import { Agent } from '@mastra/core/agent';
import { perflab } from '../../modelProvider';
import {
	largeModelSystemPrompt,
	createMcpAwareLargeModelPrompt,
} from '../../prompts';

export const largeAssistant = new Agent({
	name: 'PerfAgent assistant',
	instructions: largeModelSystemPrompt,
	model: perflab.languageModel('default_model'),
});

/**
 * Creates an MCP-aware version of the large assistant agent
 * @param toolsets - Available MCP toolsets for prompts
 * @param tools - Available MCP tools for AI SDK execution
 * @returns Agent instance with MCP-aware prompt and tools
 */
export function createMcpAwareLargeAssistant(
	toolsets?: Record<string, any>,
	tools?: Record<string, any>,
): Agent {
	return new Agent({
		name: 'PerfAgent assistant (MCP-enabled)',
		instructions: createMcpAwareLargeModelPrompt(toolsets),
		model: perflab.languageModel('default_model'),
		tools: tools || {},
	});
}
