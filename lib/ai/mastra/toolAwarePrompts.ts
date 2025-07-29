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
 * Generates a tool-aware prompt section for system prompts using Gemini CLI patterns
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

	// Group tools by category for better organization (Gemini CLI pattern)
	const toolsByCategory = filteredTools.reduce((acc, tool) => {
		const category = tool.category || 'general';
		if (!acc[category]) {
			acc[category] = [];
		}
		acc[category].push(tool);
		return acc;
	}, {} as Record<string, ToolMetadata[]>);

	// Generate the prompt sections using Gemini CLI patterns
	const promptSections: string[] = [];

	// Header with explicit tool count (Gemini CLI pattern)
	promptSections.push('## Available External Tools');
	promptSections.push('');
	promptSections.push(`You have access to ${filteredTools.length} external tools from MCP servers. These tools can enhance your web performance analysis capabilities.`);
	promptSections.push('');

	// Explicit tool enumeration by category (Gemini CLI pattern)
	promptSections.push('### Tool Categories and Capabilities');
	promptSections.push('');

	Object.entries(toolsByCategory).forEach(([category, tools]) => {
		const displayTools = tools.slice(0, maxToolsPerCategory);
		
		promptSections.push(`**${category.toUpperCase()} TOOLS (${tools.length}):**`);
		
		displayTools.forEach((tool, index) => {
			// Explicit numbering (Gemini CLI pattern)
			promptSections.push(`${index + 1}. **${tool.name}** (${tool.serverName})`);
			promptSections.push(`   Purpose: ${tool.description}`);
			
			// Parameter specification (Gemini CLI pattern)
			if (tool.parameters.length > 0) {
				const requiredParams = tool.parameters.filter(p => p.required);
				const optionalParams = tool.parameters.filter(p => !p.required);
				
				if (requiredParams.length > 0) {
					promptSections.push(`   Required inputs: ${requiredParams.map(p => `${p.name}:${p.type}`).join(', ')}`);
				}
				
				if (optionalParams.length > 0) {
					promptSections.push(`   Optional inputs: ${optionalParams.map(p => `${p.name}:${p.type}`).join(', ')}`);
				}
			}
			
			// When to use guidance (Gemini CLI pattern)
			if (includeUsageInstructions && tool.usage) {
				promptSections.push(`   When to use: ${tool.usage}`);
			}
			
			// Safety indicators (enhanced)
			if (tool.safetyLevel === 'caution') {
				promptSections.push(`   ⚠️ CAUTION: Validate inputs carefully`);
			} else if (tool.safetyLevel === 'restricted') {
				promptSections.push(`   🚫 RESTRICTED: Requires explicit user consent`);
			}
			
			promptSections.push('');
		});
		
		if (tools.length > maxToolsPerCategory) {
			promptSections.push(`   ... and ${tools.length - maxToolsPerCategory} more ${category} tools available`);
			promptSections.push('');
		}
	});

	// Enhanced usage guidelines with Gemini CLI patterns
	if (includeUsageInstructions) {
		promptSections.push('### Tool Selection and Usage Protocol');
		promptSections.push('');
		promptSections.push('**TOOL SELECTION CRITERIA:**');
		promptSections.push('1. Match tool capabilities to user request specifics');
		promptSections.push('2. Prefer specialized tools over general ones for specific analysis');
		promptSections.push('3. Consider tool categories: web-api for live sites, file-system for local analysis');
		promptSections.push('4. Chain complementary tools when one tool\'s output enhances another');
		promptSections.push('');
		
		promptSections.push('**EXECUTION GUIDELINES:**');
		promptSections.push('- Always announce which tool you\'re using and why it\'s appropriate');
		promptSections.push('- Validate all required parameters before tool execution');
		promptSections.push('- If a tool fails, explain the failure and provide alternative approaches');
		promptSections.push('- Integrate tool results into your web performance analysis context');
		promptSections.push('- Use tool outputs to validate or enhance your performance recommendations');
		promptSections.push('');
	}

	// Enhanced safety guidelines
	if (includeSafetyGuidelines) {
		promptSections.push('### Tool Safety and Security Protocol');
		promptSections.push('');
		promptSections.push('**SAFETY CLASSIFICATION:**');
		promptSections.push('- ✅ **SAFE**: Use freely for analysis and data gathering');
		promptSections.push('- ⚠️ **CAUTION**: Validate parameters, explain potential impacts');
		promptSections.push('- 🚫 **RESTRICTED**: Obtain explicit user permission before use');
		promptSections.push('');
		promptSections.push('**SECURITY REQUIREMENTS:**');
		promptSections.push('- Never expose sensitive data through tool parameters');
		promptSections.push('- Validate URLs and file paths for legitimacy');
		promptSections.push('- For web analysis tools, confirm user owns or has permission to analyze the target');
		promptSections.push('- Handle tool errors gracefully without exposing system details');
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
 * Generates tool-specific usage instructions based on Gemini CLI patterns
 */
export function generateToolSpecificInstructions(toolName: string): string {
	const tool = toolCatalog.getAllTools().find(t => t.normalizedName === toolName || t.name === toolName);
	
	if (!tool) {
		return '';
	}

	const instructions: string[] = [];
	
	// Tool-specific header
	instructions.push(`### Using ${tool.name} Tool`);
	instructions.push('');
	instructions.push(`**Purpose**: ${tool.description}`);
	instructions.push(`**Category**: ${tool.category || 'general'}`);
	instructions.push(`**Server**: ${tool.serverName}`);
	instructions.push('');

	// Parameter guidance (Gemini CLI pattern)
	if (tool.parameters.length > 0) {
		instructions.push('**Parameters:**');
		tool.parameters.forEach(param => {
			const required = param.required ? '(REQUIRED)' : '(optional)';
			instructions.push(`- \`${param.name}\` ${required}: ${param.description || 'No description'}`);
			instructions.push(`  Type: ${param.type}`);
			
			// Add parameter-specific guidance based on type
			if (param.type === 'string' && param.name.toLowerCase().includes('url')) {
				instructions.push(`  Note: Ensure URL is accessible and user has permission to analyze`);
			} else if (param.type === 'string' && param.name.toLowerCase().includes('path')) {
				instructions.push(`  Note: Validate file path exists and is readable`);
			}
		});
		instructions.push('');
	}

	// Category-specific usage patterns
	switch (tool.category) {
		case 'web-api':
			instructions.push('**Web Analysis Usage Pattern:**');
			instructions.push('1. Validate the target URL is accessible');
			instructions.push('2. Confirm user permission to analyze the site');
			instructions.push('3. Execute analysis and capture performance metrics');
			instructions.push('4. Integrate results with Core Web Vitals analysis');
			instructions.push('5. Provide actionable optimization recommendations');
			break;
			
		case 'file-system':
			instructions.push('**File Analysis Usage Pattern:**');
			instructions.push('1. Verify file exists and is readable');
			instructions.push('2. Check file type matches expected format');
			instructions.push('3. Process file content for performance insights');
			instructions.push('4. Extract relevant metrics and patterns');
			instructions.push('5. Generate findings in context of web performance goals');
			break;
			
		case 'data-processing':
			instructions.push('**Data Processing Usage Pattern:**');
			instructions.push('1. Validate input data format and structure');
			instructions.push('2. Apply appropriate processing algorithms');
			instructions.push('3. Extract performance-relevant insights');
			instructions.push('4. Format results for analysis integration');
			instructions.push('5. Highlight optimization opportunities');
			break;
			
		case 'search':
			instructions.push('**Search Tool Usage Pattern:**');
			instructions.push('1. Formulate precise search queries based on user needs');
			instructions.push('2. Filter results for web performance relevance');
			instructions.push('3. Extract actionable information from search results');
			instructions.push('4. Synthesize findings with current analysis context');
			instructions.push('5. Provide evidence-based recommendations');
			break;
			
		default:
			instructions.push('**General Usage Pattern:**');
			instructions.push('1. Validate all required parameters');
			instructions.push('2. Execute tool with appropriate context');
			instructions.push('3. Process results for web performance insights');
			instructions.push('4. Integrate findings with overall analysis');
			instructions.push('5. Provide clear, actionable recommendations');
	}
	
	instructions.push('');

	// Safety and error handling (Gemini CLI pattern)
	instructions.push('**Safety Considerations:**');
	if (tool.safetyLevel === 'restricted') {
		instructions.push('🚫 **RESTRICTED TOOL** - Obtain explicit user consent before use');
		instructions.push('- Explain exactly what the tool will do');
		instructions.push('- Clarify any data access or system changes');
		instructions.push('- Wait for clear user approval before proceeding');
	} else if (tool.safetyLevel === 'caution') {
		instructions.push('⚠️ **CAUTION REQUIRED** - Use with care');
		instructions.push('- Validate all parameters thoroughly');
		instructions.push('- Explain potential impacts to user');
		instructions.push('- Monitor execution for unexpected behavior');
	} else {
		instructions.push('✅ **SAFE FOR USE** - Can be used freely for appropriate tasks');
	}
	instructions.push('');

	instructions.push('**Error Handling:**');
	instructions.push('- If tool fails, explain the specific error to the user');
	instructions.push('- Suggest alternative approaches or tools');
	instructions.push('- Never expose sensitive system information in error messages');
	instructions.push('- Provide clear next steps for resolution');
	instructions.push('');

	return instructions.join('\n');
}

/**
 * Generates category-specific tool recommendations for web performance analysis
 */
export function generateCategoryBasedRecommendations(userQuery: string): string {
	const queryLower = userQuery.toLowerCase();
	const recommendations: string[] = [];
	
	// Analyze query for performance context
	const isLcpRelated = queryLower.includes('lcp') || queryLower.includes('largest contentful paint') || queryLower.includes('loading');
	const isInpRelated = queryLower.includes('inp') || queryLower.includes('interaction') || queryLower.includes('responsiveness');
	const isClsRelated = queryLower.includes('cls') || queryLower.includes('layout shift') || queryLower.includes('stability');
	const isNetworkRelated = queryLower.includes('network') || queryLower.includes('request') || queryLower.includes('cdn');
	const isCodeRelated = queryLower.includes('javascript') || queryLower.includes('css') || queryLower.includes('code');

	if (isLcpRelated) {
		recommendations.push('**LCP Analysis Tools Recommended:**');
		recommendations.push('- Use web-api tools to analyze loading performance');
		recommendations.push('- Apply file-system tools for local asset analysis');
		recommendations.push('- Consider search tools for optimization techniques');
	}
	
	if (isInpRelated) {
		recommendations.push('**INP Analysis Tools Recommended:**');
		recommendations.push('- Use code-execution tools to analyze JavaScript performance');
		recommendations.push('- Apply data-processing tools for interaction trace analysis');
		recommendations.push('- Consider web-api tools for live responsiveness testing');
	}
	
	if (isClsRelated) {
		recommendations.push('**CLS Analysis Tools Recommended:**');
		recommendations.push('- Use web-api tools to detect layout shift sources');
		recommendations.push('- Apply file-system tools for CSS and font analysis');
		recommendations.push('- Consider data-processing tools for shift measurement');
	}
	
	if (isNetworkRelated) {
		recommendations.push('**Network Analysis Tools Recommended:**');
		recommendations.push('- Use web-api tools for request waterfall analysis');
		recommendations.push('- Apply data-processing tools for performance timing analysis');
		recommendations.push('- Consider search tools for CDN and caching strategies');
	}
	
	if (isCodeRelated) {
		recommendations.push('**Code Analysis Tools Recommended:**');
		recommendations.push('- Use file-system tools for static code analysis');
		recommendations.push('- Apply code-execution tools for runtime performance');
		recommendations.push('- Consider data-processing tools for bundle analysis');
	}

	if (recommendations.length === 0) {
		return '';
	}

	return recommendations.join('\n') + '\n';
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

/**
 * Generates a dynamic, context-aware prompt based on user query and available tools
 * This implements Phase 3.3 of the Gemini CLI prompt engineering patterns
 */
export function generateDynamicContextualPrompt(userQuery: string, includeAllTools: boolean = false): string {
	const allTools = toolCatalog.getAllTools();
	
	if (allTools.length === 0) {
		return '';
	}

	const promptSections: string[] = [];
	const queryLower = userQuery.toLowerCase();

	// Analyze query intent and context
	const queryContext = analyzeQueryContext(userQuery);
	
	// Header with context awareness
	promptSections.push('## Context-Aware Tool Recommendations');
	promptSections.push('');
	promptSections.push(`Based on your query: "${userQuery}"`);
	promptSections.push('');

	// Context-specific tool recommendations
	if (queryContext.categories.length > 0) {
		promptSections.push('### Recommended Tools for Your Request');
		promptSections.push('');
		
		queryContext.categories.forEach(category => {
			const categoryTools = allTools.filter(tool => tool.category === category);
			if (categoryTools.length > 0) {
				promptSections.push(`**${category.toUpperCase()} TOOLS:**`);
				categoryTools.slice(0, 3).forEach((tool, index) => {
					promptSections.push(`${index + 1}. **${tool.name}** - ${tool.description}`);
					if (tool.safetyLevel === 'caution' || tool.safetyLevel === 'restricted') {
						const icon = tool.safetyLevel === 'restricted' ? '🚫' : '⚠️';
						promptSections.push(`   ${icon} ${tool.safetyLevel.toUpperCase()}: Requires careful consideration`);
					}
				});
				promptSections.push('');
			}
		});
	}

	// Contextual usage guidance
	if (queryContext.performanceMetrics.length > 0) {
		promptSections.push('### Performance Metric Analysis Approach');
		promptSections.push('');
		queryContext.performanceMetrics.forEach(metric => {
			switch (metric) {
				case 'lcp':
					promptSections.push('**LCP (Largest Contentful Paint) Analysis:**');
					promptSections.push('- Use web-api tools to analyze loading performance');
					promptSections.push('- Check for render-blocking resources');
					promptSections.push('- Examine server response times and CDN usage');
					break;
				case 'inp':
					promptSections.push('**INP (Interaction to Next Paint) Analysis:**');
					promptSections.push('- Use code-execution tools for JavaScript performance');
					promptSections.push('- Analyze event handler efficiency');
					promptSections.push('- Check for long tasks blocking the main thread');
					break;
				case 'cls':
					promptSections.push('**CLS (Cumulative Layout Shift) Analysis:**');
					promptSections.push('- Use web-api tools to detect layout shift sources');
					promptSections.push('- Examine CSS and font loading strategies');
					promptSections.push('- Check for dynamically inserted content');
					break;
			}
			promptSections.push('');
		});
	}

	// Dynamic execution strategy
	promptSections.push('### Recommended Execution Strategy');
	promptSections.push('');
	
	if (queryContext.requiresLiveAnalysis) {
		promptSections.push('**Live Analysis Workflow:**');
		promptSections.push('1. Use web-api tools to gather real-time performance data');
		promptSections.push('2. Validate findings with multiple measurement tools');
		promptSections.push('3. Cross-reference with known performance best practices');
		promptSections.push('4. Provide specific, actionable optimization recommendations');
	} else if (queryContext.requiresFileAnalysis) {
		promptSections.push('**File Analysis Workflow:**');
		promptSections.push('1. Use file-system tools to examine code and assets');
		promptSections.push('2. Analyze for common performance anti-patterns');
		promptSections.push('3. Identify opportunities for optimization');
		promptSections.push('4. Suggest specific code improvements');
	} else {
		promptSections.push('**General Analysis Workflow:**');
		promptSections.push('1. Select the most appropriate tools based on query context');
		promptSections.push('2. Execute tools in logical sequence');
		promptSections.push('3. Synthesize results for comprehensive insights');
		promptSections.push('4. Provide evidence-based recommendations');
	}
	
	promptSections.push('');

	// Include broader tool context if requested
	if (includeAllTools) {
		promptSections.push('### All Available Tools');
		promptSections.push('');
		promptSections.push('For comprehensive analysis, you also have access to:');
		const toolsByCategory = getToolsByCategory();
		Object.entries(toolsByCategory).forEach(([category, tools]) => {
			promptSections.push(`- **${category}**: ${tools.length} tools available`);
		});
		promptSections.push('');
	}

	return promptSections.join('\n');
}

/**
 * Analyzes user query to determine context and appropriate tool categories
 */
function analyzeQueryContext(userQuery: string): {
	categories: string[];
	performanceMetrics: string[];
	requiresLiveAnalysis: boolean;
	requiresFileAnalysis: boolean;
	urgency: 'low' | 'medium' | 'high';
} {
	const queryLower = userQuery.toLowerCase();
	const categories: string[] = [];
	const performanceMetrics: string[] = [];
	
	// Detect performance metrics
	if (queryLower.includes('lcp') || queryLower.includes('largest contentful paint') || queryLower.includes('loading')) {
		performanceMetrics.push('lcp');
		categories.push('web-api', 'file-system');
	}
	
	if (queryLower.includes('inp') || queryLower.includes('interaction') || queryLower.includes('responsiveness')) {
		performanceMetrics.push('inp');
		categories.push('code-execution', 'data-processing');
	}
	
	if (queryLower.includes('cls') || queryLower.includes('layout shift') || queryLower.includes('stability')) {
		performanceMetrics.push('cls');
		categories.push('web-api', 'file-system');
	}
	
	// Detect analysis type requirements
	const requiresLiveAnalysis = queryLower.includes('website') || queryLower.includes('url') || 
		queryLower.includes('live') || queryLower.includes('production');
	
	const requiresFileAnalysis = queryLower.includes('code') || queryLower.includes('file') || 
		queryLower.includes('bundle') || queryLower.includes('asset');
	
	// Add general categories based on keywords
	if (queryLower.includes('network') || queryLower.includes('request')) {
		categories.push('web-api', 'data-processing');
	}
	
	if (queryLower.includes('search') || queryLower.includes('research') || queryLower.includes('find')) {
		categories.push('search');
	}
	
	// Determine urgency
	let urgency: 'low' | 'medium' | 'high' = 'medium';
	if (queryLower.includes('urgent') || queryLower.includes('critical') || queryLower.includes('immediate')) {
		urgency = 'high';
	} else if (queryLower.includes('when time') || queryLower.includes('eventually') || queryLower.includes('later')) {
		urgency = 'low';
	}
	
	// Remove duplicates
	const uniqueCategories = [...new Set(categories)];
	
	return {
		categories: uniqueCategories,
		performanceMetrics,
		requiresLiveAnalysis,
		requiresFileAnalysis,
		urgency,
	};
}

/**
 * Generates a tool execution plan based on user query and available tools
 */
export function generateToolExecutionPlan(userQuery: string): {
	plan: Array<{
		step: number;
		toolCategory: string;
		action: string;
		rationale: string;
		tools: string[];
	}>;
	estimatedDuration: string;
	riskLevel: 'low' | 'medium' | 'high';
} {
	const queryContext = analyzeQueryContext(userQuery);
	const allTools = toolCatalog.getAllTools();
	const plan: Array<{
		step: number;
		toolCategory: string;
		action: string;
		rationale: string;
		tools: string[];
	}> = [];
	
	let stepNumber = 1;
	
	// Build execution plan based on context
	if (queryContext.requiresLiveAnalysis) {
		plan.push({
			step: stepNumber++,
			toolCategory: 'web-api',
			action: 'Perform live website analysis',
			rationale: 'Gather real-time performance metrics from the live environment',
			tools: allTools.filter(t => t.category === 'web-api').map(t => t.name).slice(0, 2),
		});
	}
	
	if (queryContext.requiresFileAnalysis) {
		plan.push({
			step: stepNumber++,
			toolCategory: 'file-system',
			action: 'Analyze code and asset files',
			rationale: 'Examine static assets and code for performance opportunities',
			tools: allTools.filter(t => t.category === 'file-system').map(t => t.name).slice(0, 2),
		});
	}
	
	if (queryContext.performanceMetrics.length > 0) {
		plan.push({
			step: stepNumber++,
			toolCategory: 'data-processing',
			action: 'Process performance metrics',
			rationale: 'Analyze collected data for specific Core Web Vitals insights',
			tools: allTools.filter(t => t.category === 'data-processing').map(t => t.name).slice(0, 2),
		});
	}
	
	// Add search step if no specific tools are planned
	if (plan.length === 0 && queryContext.categories.includes('search')) {
		plan.push({
			step: stepNumber++,
			toolCategory: 'search',
			action: 'Research performance optimization techniques',
			rationale: 'Gather current best practices and solutions for the query',
			tools: allTools.filter(t => t.category === 'search').map(t => t.name).slice(0, 2),
		});
	}
	
	// Determine estimated duration and risk level
	const estimatedDuration = plan.length <= 2 ? '2-5 minutes' : 
		plan.length <= 4 ? '5-15 minutes' : '15-30 minutes';
	
	const hasRestrictedTools = plan.some(step => 
		step.tools.some(toolName => {
			const tool = allTools.find(t => t.name === toolName);
			return tool?.safetyLevel === 'restricted';
		})
	);
	
	const riskLevel: 'low' | 'medium' | 'high' = hasRestrictedTools ? 'high' : 
		queryContext.requiresLiveAnalysis ? 'medium' : 'low';
	
	return {
		plan,
		estimatedDuration,
		riskLevel,
	};
}