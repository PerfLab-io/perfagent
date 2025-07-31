/**
 * Custom KV library built on Upstash Redis
 * Optimized for MCP caching with compression and TTL support
 */
import { Redis } from '@upstash/redis';
import { serverEnv } from '@/lib/env/server';
import { gzip, gunzip } from 'node:zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

interface KVOptions {
	expirationTtl?: number;
	compress?: boolean;
}

interface KVData {
	data: string;
	compressed: boolean;
	timestamp: string;
}

class KVClient {
	private redis: Redis;

	constructor() {
		this.redis = new Redis({
			url: serverEnv.KV_REST_API_URL,
			token: serverEnv.KV_REST_API_TOKEN,
		});
	}

	async get<T = any>(key: string): Promise<T | null> {
		try {
			const result = await this.redis.get(key);
			if (!result) return null;

			// Handle structured KV data with compression
			if (this.isKVData(result)) {
				return await this.deserialize<T>(result);
			}

			// Legacy format or simple values
			return result as T;
		} catch (error) {
			console.warn(`[KV] Get failed for key ${key}:`, error);
			return null;
		}
	}

	async set(key: string, value: any, options?: KVOptions): Promise<void> {
		try {
			const serialized = await this.serialize(value, options?.compress);

			if (options?.expirationTtl) {
				await this.redis.setex(key, options.expirationTtl, serialized);
			} else {
				await this.redis.set(key, serialized);
			}
		} catch (error) {
			console.warn(`[KV] Set failed for key ${key}:`, error);
			// Don't throw - caching should be optional and not break application flow
		}
	}

	async delete(key: string): Promise<void> {
		try {
			await this.redis.del(key);
		} catch (error) {
			console.warn(`[KV] Delete failed for key ${key}:`, error);
		}
	}

	async keys(pattern: string): Promise<string[]> {
		try {
			return await this.redis.keys(pattern);
		} catch (error) {
			console.warn(`[KV] Keys search failed for pattern ${pattern}:`, error);
			return [];
		}
	}

	async exists(key: string): Promise<boolean> {
		try {
			const result = await this.redis.exists(key);
			return result === 1;
		} catch (error) {
			console.warn(`[KV] Exists check failed for key ${key}:`, error);
			return false;
		}
	}

	async expire(key: string, seconds: number): Promise<void> {
		try {
			await this.redis.expire(key, seconds);
		} catch (error) {
			console.warn(`[KV] Expire failed for key ${key}:`, error);
		}
	}

	private async serialize(
		value: any,
		shouldCompress?: boolean,
	): Promise<KVData> {
		const jsonString = JSON.stringify(value);

		// Auto-compress large data (>1KB) or when explicitly requested
		const autoCompress = shouldCompress ?? jsonString.length > 1000;

		if (autoCompress) {
			const compressed = await gzipAsync(Buffer.from(jsonString));
			return {
				data: compressed.toString('base64'),
				compressed: true,
				timestamp: new Date().toISOString(),
			};
		}

		return {
			data: jsonString,
			compressed: false,
			timestamp: new Date().toISOString(),
		};
	}

	private async deserialize<T>(kvData: KVData): Promise<T> {
		if (kvData.compressed) {
			const buffer = Buffer.from(kvData.data, 'base64');
			const decompressed = await gunzipAsync(buffer);
			return JSON.parse(decompressed.toString()) as T;
		}

		return JSON.parse(kvData.data) as T;
	}

	private isKVData(obj: any): obj is KVData {
		return (
			obj &&
			typeof obj === 'object' &&
			'data' in obj &&
			'compressed' in obj &&
			'timestamp' in obj
		);
	}

	/**
	 * Get connection health status
	 */
	async ping(): Promise<boolean> {
		try {
			const result = await this.redis.ping();
			return result === 'PONG';
		} catch (error) {
			console.warn('[KV] Ping failed:', error);
			return false;
		}
	}

	/**
	 * Get basic info about the Redis instance
	 */
	async info(): Promise<string | null> {
		try {
			// Simple connection test - try to get a non-existent key
			await this.redis.get('__connection_test__');
			return 'Redis connection: OK';
		} catch (error) {
			console.warn('[KV] Info failed:', error);
			return null;
		}
	}
}

// Export singleton instance
export const kv = new KVClient();

// Export types for external use
export type { KVOptions, KVData };
