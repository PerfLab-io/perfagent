/** @type {import('next').NextConfig} */
const nextConfig = {
	serverExternalPackages: ['@mastra/*'],
	eslint: {
		ignoreDuringBuilds: true,
	},
	typescript: {
		ignoreBuildErrors: true,
	},
	images: {
		unoptimized: true,
	},
	experimental: {
		webpackBuildWorker: true,
		parallelServerBuildTraces: true,
		parallelServerCompiles: true,
		reactCompiler: true,
	},
};

export default nextConfig;
