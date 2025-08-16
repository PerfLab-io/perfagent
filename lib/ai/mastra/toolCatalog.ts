/**
 * Tool Catalog System for MCP Tools
 * Provides comprehensive tool metadata and discovery capabilities
 */

export interface ToolParameter {
	name: string;
	type: string;
	description?: string;
	required?: boolean;
	properties?: Record<string, any>;
}

export interface ToolMetadata {
	id: string;
	name: string;
	normalizedName: string;
	description: string;
	serverName: string;
	serverId: string;
	parameters: ToolParameter[];
	examples?: string[];
	category?: string;
	tags?: string[];
	usage?: string;
	safetyLevel?: 'safe' | 'caution' | 'restricted';
}

export interface ToolCatalog {
	serverId: string;
	serverName: string;
	serverUrl: string;
	tools: ToolMetadata[];
	lastUpdated: Date;
}

export interface CatalogRegistry {
	catalogs: Map<string, ToolCatalog>;
	toolIndex: Map<string, ToolMetadata>; // normalizedName -> tool
	serverIndex: Map<string, string[]>; // serverId -> normalizedNames
	categoryIndex: Map<string, string[]>; // category -> normalizedNames
}

class ToolCatalogManager {
	private static instance: ToolCatalogManager;
	private registry: CatalogRegistry;

	private constructor() {
		this.registry = {
			catalogs: new Map(),
			toolIndex: new Map(),
			serverIndex: new Map(),
			categoryIndex: new Map(),
		};
	}

	static getInstance(): ToolCatalogManager {
		if (!ToolCatalogManager.instance) {
			ToolCatalogManager.instance = new ToolCatalogManager();
		}
		return ToolCatalogManager.instance;
	}

	/**
	 * Register a tool catalog from MCP server toolsets
	 */
	registerCatalog(
		serverId: string,
		serverName: string,
		serverUrl: string,
		rawToolsets: Record<string, any>,
	): ToolCatalog {
		console.log(`[Tool Catalog] Registering catalog for server: ${serverName}`);

		const tools: ToolMetadata[] = [];

		// Process each server's toolset
		Object.entries(rawToolsets).forEach(
			([toolsetServerName, serverToolset]) => {
				if (serverToolset && typeof serverToolset === 'object') {
					Object.entries(serverToolset).forEach(
						([toolName, toolConfig]: [string, any]) => {
							const toolMetadata = this.createToolMetadata(
								serverId,
								serverName,
								toolsetServerName,
								toolName,
								toolConfig,
							);
							tools.push(toolMetadata);

							// Index the tool
							this.registry.toolIndex.set(
								toolMetadata.normalizedName,
								toolMetadata,
							);
						},
					);
				}
			},
		);

		const catalog: ToolCatalog = {
			serverId,
			serverName,
			serverUrl,
			tools,
			lastUpdated: new Date(),
		};

		// Register in catalogs
		this.registry.catalogs.set(serverId, catalog);

		// Update server index
		const toolNames = tools.map((t) => t.normalizedName);
		this.registry.serverIndex.set(serverId, toolNames);

		// Update category index
		tools.forEach((tool) => {
			if (tool.category) {
				const existing = this.registry.categoryIndex.get(tool.category) || [];
				existing.push(tool.normalizedName);
				this.registry.categoryIndex.set(tool.category, existing);
			}
		});

		console.log(
			`[Tool Catalog] Registered ${tools.length} tools for ${serverName}`,
		);
		return catalog;
	}

	/**
	 * Create detailed tool metadata from raw tool config
	 */
	private createToolMetadata(
		serverId: string,
		serverName: string,
		toolsetServerName: string,
		toolName: string,
		toolConfig: any,
	): ToolMetadata {
		// Generate normalized name (consistent with toolsetTransformer)
		const compositeKey = `${toolsetServerName}_${toolName}`;
		const normalizedName = this.normalizeToolName(compositeKey);

		// Extract parameters from schema
		const parameters = this.extractParameters(toolConfig.inputSchema || {});

		// Categorize the tool
		const category = this.categorizeTool(
			toolName,
			toolConfig.description || '',
		);

		// Generate usage instructions
		const usage = this.generateUsageInstructions(
			toolName,
			toolConfig.description,
			parameters,
		);

		return {
			id: `${serverId}-${toolName}`,
			name: toolName,
			normalizedName,
			description:
				toolConfig.description || `${toolName} tool from ${toolsetServerName}`,
			serverName: toolsetServerName,
			serverId,
			parameters,
			category,
			usage,
			safetyLevel: this.assessSafetyLevel(
				toolName,
				toolConfig.description || '',
			),
			tags: this.generateTags(toolName, toolConfig.description || ''),
		};
	}

	/**
	 * Normalize tool names (consistent with existing transformer)
	 */
	private normalizeToolName(name: string): string {
		let validName = name.replace(/[^a-zA-Z0-9_.-]/g, '_');

		if (!/^[a-zA-Z_]/.test(validName)) {
			validName = '_' + validName;
		}

		if (validName.length > 63) {
			validName = validName.slice(0, 28) + '___' + validName.slice(-32);
		}

		return validName;
	}

	/**
	 * Extract parameters from JSON schema
	 */
	private extractParameters(schema: any): ToolParameter[] {
		if (!schema || !schema.properties) return [];

		const required = schema.required || [];
		const parameters: ToolParameter[] = [];

		Object.entries(schema.properties).forEach(([name, prop]: [string, any]) => {
			parameters.push({
				name,
				type: prop.type || 'unknown',
				description: prop.description,
				required: required.includes(name),
				properties: prop,
			});
		});

		return parameters;
	}

	/**
	 * Categorize tools based on name and description
	 */
	private categorizeTool(toolName: string, description: string): string {
		const name = toolName.toLowerCase();
		const desc = description.toLowerCase();

		if (
			name.includes('file') ||
			name.includes('read') ||
			name.includes('write') ||
			desc.includes('file')
		) {
			return 'file-system';
		}
		if (
			name.includes('web') ||
			name.includes('http') ||
			name.includes('fetch') ||
			desc.includes('web')
		) {
			return 'web-api';
		}
		if (
			name.includes('data') ||
			name.includes('json') ||
			name.includes('parse') ||
			desc.includes('data')
		) {
			return 'data-processing';
		}
		if (
			name.includes('search') ||
			name.includes('find') ||
			desc.includes('search')
		) {
			return 'search';
		}
		if (
			name.includes('code') ||
			name.includes('execute') ||
			desc.includes('code')
		) {
			return 'code-execution';
		}

		return 'general';
	}

	/**
	 * Assess safety level of tools
	 */
	private assessSafetyLevel(
		toolName: string,
		description: string,
	): 'safe' | 'caution' | 'restricted' {
		const name = toolName.toLowerCase();
		const desc = description.toLowerCase();

		// Restricted tools
		if (
			name.includes('delete') ||
			name.includes('remove') ||
			desc.includes('delete')
		) {
			return 'restricted';
		}
		if (
			name.includes('execute') ||
			name.includes('run') ||
			desc.includes('execute')
		) {
			return 'restricted';
		}

		// Caution tools
		if (
			name.includes('write') ||
			name.includes('modify') ||
			desc.includes('write')
		) {
			return 'caution';
		}

		return 'safe';
	}

	/**
	 * Generate relevant tags for tools
	 */
	private generateTags(toolName: string, description: string): string[] {
		const tags: string[] = [];
		const text = `${toolName} ${description}`.toLowerCase();

		if (text.includes('file')) tags.push('files');
		if (text.includes('web') || text.includes('http')) tags.push('web');
		if (text.includes('data')) tags.push('data');
		if (text.includes('search')) tags.push('search');
		if (text.includes('code')) tags.push('code');
		if (text.includes('read')) tags.push('read');
		if (text.includes('write')) tags.push('write');

		return tags;
	}

	/**
	 * Generate usage instructions for tools
	 */
	private generateUsageInstructions(
		toolName: string,
		description: string,
		parameters: ToolParameter[],
	): string {
		let usage = `Use ${toolName} when you need to ${description.toLowerCase()}.`;

		if (parameters.length > 0) {
			const requiredParams = parameters.filter((p) => p.required);
			if (requiredParams.length > 0) {
				usage += `\n\nRequired parameters: ${requiredParams.map((p) => `${p.name} (${p.type})`).join(', ')}`;
			}

			const optionalParams = parameters.filter((p) => !p.required);
			if (optionalParams.length > 0) {
				usage += `\nOptional parameters: ${optionalParams.map((p) => `${p.name} (${p.type})`).join(', ')}`;
			}
		}

		return usage;
	}

	/**
	 * Get all tools from the catalog
	 */
	getAllTools(): ToolMetadata[] {
		return Array.from(this.registry.toolIndex.values());
	}

	/**
	 * Get tools by server
	 */
	getToolsByServer(serverId: string): ToolMetadata[] {
		const toolNames = this.registry.serverIndex.get(serverId) || [];
		return toolNames
			.map((name) => this.registry.toolIndex.get(name)!)
			.filter(Boolean);
	}

	/**
	 * Get tools by category
	 */
	getToolsByCategory(category: string): ToolMetadata[] {
		const toolNames = this.registry.categoryIndex.get(category) || [];
		return toolNames
			.map((name) => this.registry.toolIndex.get(name)!)
			.filter(Boolean);
	}

	/**
	 * Get tool by normalized name
	 */
	getTool(normalizedName: string): ToolMetadata | undefined {
		return this.registry.toolIndex.get(normalizedName);
	}

	/**
	 * Search tools by query
	 */
	searchTools(query: string): ToolMetadata[] {
		const lowerQuery = query.toLowerCase();
		return this.getAllTools().filter(
			(tool) =>
				tool.name.toLowerCase().includes(lowerQuery) ||
				tool.description.toLowerCase().includes(lowerQuery) ||
				tool.tags?.some((tag) => tag.includes(lowerQuery)),
		);
	}

	/**
	 * Get summary statistics
	 */
	getStats() {
		return {
			totalTools: this.registry.toolIndex.size,
			totalServers: this.registry.catalogs.size,
			categories: Array.from(this.registry.categoryIndex.keys()),
			safetyLevels: this.getSafetyLevelCounts(),
		};
	}

	private getSafetyLevelCounts() {
		const counts = { safe: 0, caution: 0, restricted: 0 };
		this.getAllTools().forEach((tool) => {
			if (tool.safetyLevel) {
				counts[tool.safetyLevel]++;
			}
		});
		return counts;
	}

	/**
	 * Clear all catalogs (useful for testing)
	 */
	clear() {
		this.registry.catalogs.clear();
		this.registry.toolIndex.clear();
		this.registry.serverIndex.clear();
		this.registry.categoryIndex.clear();
	}
}

// Export singleton instance
export const toolCatalog = ToolCatalogManager.getInstance();
