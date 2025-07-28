import type { FrameNode } from './types';

interface NodeInfoPanelProps {
	node: FrameNode;
}

export function NodeInfoPanel({ node }: NodeInfoPanelProps) {
	return (
		<div className="space-y-2">
			<h3 className="text-perfagent-text font-mono text-lg font-medium">
				{node.name}
			</h3>

			<div className="grid grid-cols-2 gap-x-4 gap-y-2">
				<div className="text-perfagent-muted text-sm">Duration:</div>
				<div className="font-mono text-sm font-medium">
					{node.value.toFixed(2)} ms
				</div>

				{node.source && (
					<>
						<div className="text-perfagent-muted text-sm">Source:</div>
						<div className="font-mono text-sm font-medium break-all">
							{node.source}
						</div>
					</>
				)}

				{node.sourceScript && (
					<>
						<div className="text-perfagent-muted text-sm">Source Script:</div>
						<div className="font-mono text-sm font-medium break-all">
							{node.sourceScript}
						</div>
					</>
				)}

				{node.cat && (
					<>
						<div className="text-perfagent-muted text-sm">Category:</div>
						<div className="font-mono text-sm font-medium">{node.cat}</div>
					</>
				)}

				<div className="text-perfagent-muted text-sm">Start Time:</div>
				<div className="font-mono text-sm font-medium">
					{node.start.toFixed(2)} ms
				</div>

				<div className="text-perfagent-muted text-sm">End Time:</div>
				<div className="font-mono text-sm font-medium">
					{node.end.toFixed(2)} ms
				</div>

				<div className="text-perfagent-muted text-sm">Depth:</div>
				<div className="font-mono text-sm font-medium">{node.depth}</div>
			</div>

			{node.args && Object.keys(node.args).length > 0 && (
				<div className="mt-4">
					<h4 className="text-perfagent-text mb-2 text-sm font-medium">
						Arguments:
					</h4>
					<pre className="border-perfagent-border overflow-x-auto border bg-white p-2 font-mono text-xs">
						{JSON.stringify(node.args, null, 2)}
					</pre>
				</div>
			)}
		</div>
	);
}
