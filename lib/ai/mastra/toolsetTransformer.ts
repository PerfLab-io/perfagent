import { tool } from 'ai';
import { z } from 'zod';

/**
 * Normalizes date fields in data structures to prevent "toISOString is not a function" errors
 * This handles cases where database date fields are stored as strings but tools expect Date objects
 */
function normalizeDateFields(data: any): any {
	if (!data || typeof data !== 'object') {
		return data;
	}

	// Handle arrays
	if (Array.isArray(data)) {
		return data.map(item => normalizeDateFields(item));
	}

	// Handle objects
	const normalized = { ...data };
	const dateFieldNames = ['createdAt', 'updatedAt', 'expiresAt', 'tokenExpiresAt', 'timestamp', 'date'];

	for (const fieldName of dateFieldNames) {
		if (fieldName in normalized && normalized[fieldName]) {
			const value = normalized[fieldName];
			// If it's already a Date object, leave it as is
			if (value instanceof Date) {
				continue;
			}
			// If it's a string that looks like a date, convert it to Date
			if (typeof value === 'string') {
				try {
					const dateValue = new Date(value);
					// Only replace if it's a valid date
					if (!isNaN(dateValue.getTime())) {
						normalized[fieldName] = dateValue;
					}
				} catch (error) {
					// If conversion fails, leave the original value
					console.warn(`[Date Normalization] Failed to convert ${fieldName}:`, error);
				}
			}
		}
	}

	// Recursively handle nested objects
	for (const key in normalized) {
		if (normalized[key] && typeof normalized[key] === 'object' && !Array.isArray(normalized[key]) && !(normalized[key] instanceof Date)) {
			normalized[key] = normalizeDateFields(normalized[key]);
		}
	}

	return normalized;
}

/**
 * Normalizes tool names to be compatible with Gemini API requirements:
 * - Must start with a letter or underscore
 * - Must be alphanumeric (a-z, A-Z, 0-9), underscores (_), dots (.) or dashes (-)
 * - Maximum length of 64 characters
 * @param name - Original tool name
 * @returns Normalized tool name
 */
function normalizeToolName(name: string): string {
	// Replace invalid characters with underscores
	let validName = name.replace(/[^a-zA-Z0-9_.-]/g, '_');

	// Ensure it starts with a letter or underscore
	if (!/^[a-zA-Z_]/.test(validName)) {
		validName = '_' + validName;
	}

	// Limit to 63 characters (leaving room for potential server prefix)
	if (validName.length > 63) {
		// Truncate from middle with separator
		validName = validName.slice(0, 28) + '___' + validName.slice(-32);
	}

	return validName;
}

/**
 * Tool registry to maintain mapping between normalized names and original tools
 */
class ToolRegistry {
	private static instance: ToolRegistry;
	private normalizedToOriginal = new Map<
		string,
		{ serverName: string; originalName: string; toolConfig: any }
	>();
	private originalToNormalized = new Map<string, string>();

	static getInstance(): ToolRegistry {
		if (!ToolRegistry.instance) {
			ToolRegistry.instance = new ToolRegistry();
		}
		return ToolRegistry.instance;
	}

	register(serverName: string, originalName: string, toolConfig: any): string {
		const compositeKey = `${serverName}_${originalName}`;
		let normalizedName = normalizeToolName(compositeKey);

		// Handle potential collisions by adding suffix
		let counter = 1;
		let finalName = normalizedName;
		while (this.normalizedToOriginal.has(finalName)) {
			finalName = `${normalizedName}_${counter}`;
			counter++;
		}

		this.normalizedToOriginal.set(finalName, {
			serverName,
			originalName,
			toolConfig,
		});
		this.originalToNormalized.set(compositeKey, finalName);

		return finalName;
	}

	getOriginal(normalizedName: string) {
		return this.normalizedToOriginal.get(normalizedName);
	}

	getNormalized(serverName: string, originalName: string): string | undefined {
		return this.originalToNormalized.get(`${serverName}_${originalName}`);
	}

	clear() {
		this.normalizedToOriginal.clear();
		this.originalToNormalized.clear();
	}
}

/**
 * Transforms MCP toolsets to dual format with normalized tool names:
 * 1. Prompt-compatible format for agent instructions
 * 2. AI SDK tools format for actual execution with Gemini-compatible names
 * @param mcpToolsets - Raw toolsets from MCPClient.getToolsets()
 * @returns Object with toolsets for prompts and tools for AI SDK
 */
export function transformMcpToolsetsForMastra(
	mcpToolsets: Record<string, any>,
): { toolsets: Record<string, any>; tools: Record<string, any> } {
	console.log(
		'[MCP Transformer] Starting dual transformation with normalization...',
	);
	console.log('[MCP Transformer] Input toolsets:', Object.keys(mcpToolsets));

	const registry = ToolRegistry.getInstance();
	registry.clear(); // Clear previous registrations for fresh transformation

	const promptToolsets: Record<string, any> = {};
	const aiSDKTools: Record<string, any> = {};

	for (const [serverName, serverToolset] of Object.entries(mcpToolsets)) {
		console.log(`[MCP Transformer] Processing server "${serverName}"`);
		console.log(
			`[MCP Transformer] Server toolset keys:`,
			Object.keys(serverToolset as any),
		);

		// Convert for prompt system: { tools: [toolObject] }
		const toolsArray: any[] = [];

		for (const [toolName, toolConfig] of Object.entries(
			serverToolset as Record<string, any>,
		)) {
			const toolObj = toolConfig as any;

			// Register tool and get normalized name
			const normalizedName = registry.register(serverName, toolName, toolObj);

			// For prompt system - keep original name for readability
			const promptTool = {
				name: toolName, // Keep original name in prompts
				normalizedName, // Add normalized name for reference
				description:
					toolObj.description || `${toolName} tool from ${serverName}`,
				inputSchema: toolObj.inputSchema,
				execute: toolObj.execute,
				...toolObj,
			};
			toolsArray.push(promptTool);

			try {
				// Create AI SDK tool with normalized name and wrapped execute function
				const wrappedExecute = async (args: any) => {
					console.log(
						`[MCP Tool] Executing ${normalizedName} (original: ${toolName})`,
					);

					if (typeof toolObj.execute === 'function') {
						try {
							console.log(`[MCP Tool Execute] Starting execution of ${toolName} with args:`, JSON.stringify(args, null, 2));
							const result = await toolObj.execute(args);
							console.log(`[MCP Tool Execute] Raw result from ${toolName}:`, JSON.stringify(result, null, 2));
							// Add defensive handling for common date field issues
							const normalized = normalizeDateFields(result);
							console.log(`[MCP Tool Execute] Normalized result from ${toolName}:`, JSON.stringify(normalized, null, 2));
							return normalized;
						} catch (error) {
							console.error(`[MCP Tool Execute] Error in ${toolName}:`, error);
							console.error(`[MCP Tool Execute] Error stack:`, error instanceof Error ? error.stack : 'No stack');
							// Handle the specific "createdAt.toISOString is not a function" error
							if (error instanceof Error && error.message.includes('toISOString is not a function')) {
								console.warn(`[MCP Tool] Date field error in ${toolName}, attempting to normalize data:`, error.message);
								// This is a fallback - the error already occurred, so we can't fix the result
								// But we can provide a more helpful error message
								throw new Error(`Tool ${toolName} encountered date format issues. This may be due to database date field formatting. Original error: ${error.message}`);
							}
							throw error;
						}
					} else {
						console.error(`[MCP Tool] ${toolName} has no execute function`);
						throw new Error(`Tool ${toolName} is not executable`);
					}
				};

				// Use the original tool structure but with normalized name and wrapped execute
				if (typeof toolObj.execute === 'function') {
					aiSDKTools[normalizedName] = {
						...toolObj,
						execute: wrappedExecute,
					};
					console.log(
						`[MCP Transformer] Registered tool: ${normalizedName} (${toolName})`,
					);
				} else {
					// Create AI SDK tool using the 'tool' function with normalized name
					const aiTool = tool({
						description:
							toolObj.description || `${toolName} tool from ${serverName}`,
						parameters: toolObj.inputSchema || z.object({}),
						execute: async (args: any) => {
							try {
								const result = await wrappedExecute(args);
								return normalizeDateFields(result);
							} catch (error) {
								// Handle the specific "createdAt.toISOString is not a function" error
								if (error instanceof Error && error.message.includes('toISOString is not a function')) {
									console.warn(`[MCP Tool] Date field error in ${toolName}, attempting to normalize data:`, error.message);
									throw new Error(`Tool ${toolName} encountered date format issues. This may be due to database date field formatting. Original error: ${error.message}`);
								}
								throw error;
							}
						},
					});

					aiSDKTools[normalizedName] = aiTool;
					console.log(
						`[MCP Transformer] Created AI SDK tool: ${normalizedName} (${toolName})`,
					);
				}
			} catch (error) {
				console.error(
					`[MCP Transformer] Failed to create AI SDK tool ${normalizedName}:`,
					error,
				);
			}
		}

		// Store tools for prompt system
		promptToolsets[serverName] = { tools: toolsArray };
		console.log(
			`[MCP Transformer] Server "${serverName}" has ${toolsArray.length} tools`,
		);
	}

	console.log('[MCP Transformer] Dual transformation complete.');
	console.log(
		`[MCP Transformer] Prompt toolsets: ${Object.keys(promptToolsets).length} servers`,
	);
	console.log(
		`[MCP Transformer] AI SDK tools: ${Object.keys(aiSDKTools).length} tools`,
	);
	console.log(
		`[MCP Transformer] Normalized tool names:`,
		Object.keys(aiSDKTools),
	);

	return { toolsets: promptToolsets, tools: aiSDKTools };
}

/**
 * Export the tool registry for external access
 */
export { ToolRegistry };
