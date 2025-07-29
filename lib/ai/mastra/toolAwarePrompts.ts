/**
 * Tool-Aware Prompt Generation System
 * Generates dynamic prompts based on available MCP tools
 */

import { toolCatalog, type ToolMetadata } from './toolCatalog';

export interface ToolAwarePromptConfig {
	includeUsageInstructions?: boolean;
	includeSafetyGuidelines?: boolean;
	includeExamples?: boolean;
	filterByCategory?: string[];
	filterBySafetyLevel?: Array<'safe' | 'caution' | 'restricted'>;
	maxToolsPerCategory?: number;
}

/**
 * Generates a tool-aware prompt section for system prompts
 */
export function generateToolAwarePrompt(config: ToolAwarePromptConfig = {}): string {
	const {
		includeUsageInstructions = true,
		includeSafetyGuidelines = true,
		includeExamples = false,
		filterByCategory,
		filterBySafetyLevel = ['safe', 'caution'],
		maxToolsPerCategory = 5,
	} = config;

	const allTools = toolCatalog.getAllTools();
	
	if (allTools.length === 0) {
		return '';
	}

	// Filter tools based on configuration
	let filteredTools = allTools.filter(tool => {
		// Filter by safety level
		if (filterBySafetyLevel && tool.safetyLevel && !filterBySafetyLevel.includes(tool.safetyLevel)) {
			return false;
		}
		
		// Filter by category
		if (filterByCategory && tool.category && !filterByCategory.includes(tool.category)) {
			return false;
		}
		
		return true;
	});

	// Group tools by server
	const toolsByServer = filteredTools.reduce((acc, tool) => {
		if (!acc[tool.serverName]) {
			acc[tool.serverName] = [];
		}
		acc[tool.serverName].push(tool);
		return acc;
	}, {} as Record<string, ToolMetadata[]>);

	// Generate the prompt sections
	const promptSections: string[] = [];

	promptSections.push('## Available External Tools');
	promptSections.push('');
	promptSections.push('You have access to the following external tools from MCP (Model Context Protocol) servers:');
	promptSections.push('');

	// Generate server sections
	Object.entries(toolsByServer).forEach(([serverName, tools]) => {
		promptSections.push(`### ${serverName} Tools`);
		
		// Limit tools per server to avoid overwhelming the prompt
		const displayTools = tools.slice(0, maxToolsPerCategory);
		
		displayTools.forEach(tool => {
			promptSections.push(`- **${tool.name}**: ${tool.description}`);
			
			// Add parameter information
			if (tool.parameters.length > 0) {
				const requiredParams = tool.parameters.filter(p => p.required);
				const optionalParams = tool.parameters.filter(p => !p.required);
				
				if (requiredParams.length > 0) {
					promptSections.push(`  - Required: ${requiredParams.map(p => `${p.name} (${p.type})`).join(', ')}`);
				}
				
				if (optionalParams.length > 0) {
					promptSections.push(`  - Optional: ${optionalParams.map(p => `${p.name} (${p.type})`).join(', ')}`);
				}
			}
			
			// Add usage instructions if available
			if (includeUsageInstructions && tool.usage) {
				promptSections.push(`  - Usage: ${tool.usage}`);
			}
			
			// Add examples if requested and available
			if (includeExamples && tool.examples && tool.examples.length > 0) {
				promptSections.push(`  - Examples: ${tool.examples.join('; ')}`);
			}
			
			// Add safety indicators
			if (tool.safetyLevel === 'caution') {
				promptSections.push(`  - ⚠️ Use with caution`);
			} else if (tool.safetyLevel === 'restricted') {
				promptSections.push(`  - 🚫 Restricted use - requires explicit user consent`);
			}
			
			promptSections.push('');
		});
		
		if (tools.length > maxToolsPerCategory) {
			promptSections.push(`  ... and ${tools.length - maxToolsPerCategory} more tools available`);
			promptSections.push('');
		}
	});

	// Add usage guidelines
	if (includeUsageInstructions) {
		promptSections.push('## Tool Usage Guidelines');
		promptSections.push('');
		promptSections.push('When using external tools:');
		promptSections.push('1. **Explain your reasoning**: Always explain why you\'re selecting a specific tool for the task');
		promptSections.push('2. **Provide clear parameters**: Ensure all required parameters are properly formatted');
		promptSections.push('3. **Handle errors gracefully**: If a tool fails, explain the error and suggest alternatives');
		promptSections.push('4. **Respect safety levels**: Be cautious with tools marked as ⚠️ and ask for permission for 🚫 restricted tools');
		promptSections.push('5. **Chain tools effectively**: Use multiple tools in sequence when needed to complete complex tasks');
		promptSections.push('');
	}

	// Add safety guidelines
	if (includeSafetyGuidelines) {
		promptSections.push('## Tool Safety Guidelines');
		promptSections.push('');
		promptSections.push('- **Safe tools** (✅): Can be used freely for appropriate tasks');
		promptSections.push('- **Caution tools** (⚠️): Use carefully, explain potential risks, validate parameters thoroughly');
		promptSections.push('- **Restricted tools** (🚫): Only use with explicit user permission and clear understanding of consequences');
		promptSections.push('');
		promptSections.push('Always prioritize user safety and data security when selecting and using tools.');
		promptSections.push('');
	}

	return promptSections.join('\n');
}

/**
 * Generates a contextual tool suggestion based on user query
 */
export function generateContextualToolSuggestions(userQuery: string, maxSuggestions: number = 3): string {
	const allTools = toolCatalog.getAllTools();
	
	if (allTools.length === 0) {
		return '';
	}

	// Simple keyword matching for tool suggestions
	const queryLower = userQuery.toLowerCase();
	const relevantTools = allTools
		.filter(tool => {
			const toolText = `${tool.name} ${tool.description} ${tool.tags?.join(' ') || ''}`.toLowerCase();
			const keywords = queryLower.split(/\s+/).filter(word => word.length > 2);
			return keywords.some(keyword => toolText.includes(keyword));
		})
		.slice(0, maxSuggestions);

	if (relevantTools.length === 0) {
		return '';
	}

	const suggestions = [
		'## Suggested Tools for Your Request',
		'',
		'Based on your query, these external tools might be helpful:',
		'',
	];

	relevantTools.forEach(tool => {
		suggestions.push(`- **${tool.name}** (${tool.serverName}): ${tool.description}`);
		if (tool.usage) {
			suggestions.push(`  ${tool.usage}`);
		}
	});

	suggestions.push('');
	suggestions.push('Would you like me to use any of these tools to help with your request?');
	suggestions.push('');

	return suggestions.join('\n');
}

/**
 * Generates a tool summary for system awareness
 */
export function generateToolSummary(): string {
	const stats = toolCatalog.getStats();
	
	if (stats.totalTools === 0) {
		return 'No external tools are currently available.';
	}

	const summary = [
		`📊 **Tool Summary**: ${stats.totalTools} tools available across ${stats.totalServers} servers`,
		`🏷️ **Categories**: ${stats.categories.join(', ')}`,
		`🔒 **Safety**: ${stats.safetyLevels.safe} safe, ${stats.safetyLevels.caution} caution, ${stats.safetyLevels.restricted} restricted`,
	];

	return summary.join('\n');
}

/**
 * Gets tools grouped by category for display
 */
export function getToolsByCategory(): Record<string, ToolMetadata[]> {
	const allTools = toolCatalog.getAllTools();
	
	return allTools.reduce((acc, tool) => {
		const category = tool.category || 'general';
		if (!acc[category]) {
			acc[category] = [];
		}
		acc[category].push(tool);
		return acc;
	}, {} as Record<string, ToolMetadata[]>);
}

/**
 * Validates if a tool should be accessible based on safety level and user context
 */
export function validateToolAccess(toolName: string, userContext?: { allowRestricted?: boolean }): {
	allowed: boolean;
	reason?: string;
} {
	const tool = toolCatalog.getAllTools().find(t => t.normalizedName === toolName || t.name === toolName);
	
	if (!tool) {
		return { allowed: false, reason: 'Tool not found' };
	}

	if (tool.safetyLevel === 'restricted' && !userContext?.allowRestricted) {
		return { 
			allowed: false, 
			reason: 'Restricted tool requires explicit user permission' 
		};
	}

	return { allowed: true };
}