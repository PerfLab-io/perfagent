// Reusable JSON-RPC initialize payload builder
function buildInitializeBody() {
	return {
		jsonrpc: '2.0',
		id: 1,
		method: 'initialize',
		params: {
			protocolVersion: '2024-11-05',
			capabilities: {},
			clientInfo: {
				name: 'PerfAgent',
				version: '1.0.0',
			},
		},
	};
}
