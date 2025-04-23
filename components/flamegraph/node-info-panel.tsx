import type { FrameNode } from "./types"

interface NodeInfoPanelProps {
  node: FrameNode
}

export function NodeInfoPanel({ node }: NodeInfoPanelProps) {
  return (
    <div className="space-y-2">
      <h3 className="text-lg font-medium text-perfagent-text font-mono">{node.name}</h3>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
        <div className="text-sm text-perfagent-muted">Duration:</div>
        <div className="text-sm font-medium font-mono">{node.value.toFixed(2)} ms</div>

        {node.source && (
          <>
            <div className="text-sm text-perfagent-muted">Source:</div>
            <div className="text-sm font-medium break-all font-mono">{node.source}</div>
          </>
        )}

        {node.sourceScript && (
          <>
            <div className="text-sm text-perfagent-muted">Source Script:</div>
            <div className="text-sm font-medium break-all font-mono">{node.sourceScript}</div>
          </>
        )}

        {node.cat && (
          <>
            <div className="text-sm text-perfagent-muted">Category:</div>
            <div className="text-sm font-medium font-mono">{node.cat}</div>
          </>
        )}

        <div className="text-sm text-perfagent-muted">Start Time:</div>
        <div className="text-sm font-medium font-mono">{node.start.toFixed(2)} ms</div>

        <div className="text-sm text-perfagent-muted">End Time:</div>
        <div className="text-sm font-medium font-mono">{node.end.toFixed(2)} ms</div>

        <div className="text-sm text-perfagent-muted">Depth:</div>
        <div className="text-sm font-medium font-mono">{node.depth}</div>
      </div>

      {node.args && Object.keys(node.args).length > 0 && (
        <div className="mt-4">
          <h4 className="text-sm font-medium text-perfagent-text mb-2">Arguments:</h4>
          <pre className="text-xs bg-white p-2 overflow-x-auto font-mono border border-perfagent-border">
            {JSON.stringify(node.args, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
