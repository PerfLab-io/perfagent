import type { TraceEvent, ProcessedTrace, FrameNode } from "./types"

// Function to generate a random color between merino and peppermint
function generateRandomColor(): string {
  // Merino colors (beige/tan range)
  const merinoColors = [
    "#e6d7c3", // Light merino
    "#d9c7ae", // Medium merino
    "#ccb799", // Darker merino
    "#e8d5b9", // Warm merino
    "#dac9b6", // Soft merino
  ]

  // Peppermint colors (mint green range)
  const peppermintColors = [
    "#b8e0d2", // Light mint
    "#a3d8c1", // Medium mint
    "#8fcfb0", // Darker mint
    "#c5e8dd", // Soft mint
    "#9ed9c3", // Cool mint
  ]

  // Combine both color palettes
  const combinedColors = [...merinoColors, ...peppermintColors]

  // Pick a random color from the combined palette
  return combinedColors[Math.floor(Math.random() * combinedColors.length)]
}

// Process trace data into a format suitable for rendering
export function processTraceData(events: TraceEvent[]): ProcessedTrace {
  // Filter for complete events (X) or begin/end pairs (B/E)
  const relevantEvents = events.filter((event) => event.ph === "X" || event.ph === "B" || event.ph === "E")

  // Build a map of begin/end pairs
  const beginEvents = new Map<string, TraceEvent>()
  const completeEvents: TraceEvent[] = []

  // Process events to match begin/end pairs and collect complete events
  relevantEvents.forEach((event) => {
    if (event.ph === "X") {
      // Complete event with duration
      completeEvents.push(event)
    } else if (event.ph === "B") {
      // Begin event, store for matching with end
      const key = `${event.pid}-${event.tid}-${event.name}-${event.id || ""}`
      beginEvents.set(key, event)
    } else if (event.ph === "E") {
      // End event, match with begin
      const key = `${event.pid}-${event.tid}-${event.name}-${event.id || ""}`
      const beginEvent = beginEvents.get(key)

      if (beginEvent) {
        // Create a synthetic complete event
        completeEvents.push({
          ...beginEvent,
          ph: "X",
          dur: event.ts - beginEvent.ts,
        })
        beginEvents.delete(key)
      }
    }
  })

  // Sort by timestamp
  completeEvents.sort((a, b) => a.ts - b.ts)

  // Find the min and max timestamp to normalize
  const minTs = Math.min(...completeEvents.map((e) => e.ts))
  const maxTs = Math.max(...completeEvents.map((e) => e.ts + (e.dur || 0)))
  const totalDuration = maxTs - minTs

  // Build the call tree
  const rootEvents: TraceEvent[] = []
  const eventStack: TraceEvent[] = []
  const eventMap = new Map<string, TraceEvent>()

  // First pass: identify parent-child relationships
  completeEvents.forEach((event) => {
    const eventId = `${event.pid}-${event.tid}-${event.name}-${event.ts}`
    eventMap.set(eventId, event)

    // Normalize timestamp
    const startTime = event.ts - minTs
    const endTime = startTime + (event.dur || 0)

    // Find potential parent
    let parent: TraceEvent | undefined

    // Look for the innermost event that contains this one
    for (let i = eventStack.length - 1; i >= 0; i--) {
      const potentialParent = eventStack[i]
      const parentStart = potentialParent.ts - minTs
      const parentEnd = parentStart + (potentialParent.dur || 0)

      if (startTime >= parentStart && endTime <= parentEnd) {
        parent = potentialParent
        break
      }
    }

    // Update stack - remove events that have ended
    while (eventStack.length > 0) {
      const lastEvent = eventStack[eventStack.length - 1]
      const lastEventEnd = lastEvent.ts - minTs + (lastEvent.dur || 0)

      if (lastEventEnd <= startTime) {
        eventStack.pop()
      } else {
        break
      }
    }

    // Set parent relationship
    if (parent) {
      event.parent = parent
      parent.children = parent.children || []
      parent.children.push(event)
    } else {
      rootEvents.push(event)
    }

    // Add to stack
    eventStack.push(event)
  })

  // Convert to frame nodes for rendering
  const frames: FrameNode[] = []
  const frameMap = new Map<string, FrameNode>()
  // Create a map to store colors for each source script
  const sourceScriptColors = new Map<string, string>()
  let maxDepth = 0

  // Calculate total time from root events
  const totalTime = totalDuration / 1000 // Convert to ms
  const startTime = 0
  const endTime = totalTime

  // Helper function to process an event into a frame node
  function processEvent(event: TraceEvent, depth: number): FrameNode {
    maxDepth = Math.max(maxDepth, depth)

    const duration = (event.dur || 0) / 1000 // Convert to ms
    const start = (event.ts - minTs) / 1000 // Convert to ms
    const end = start + duration

    // Generate a unique ID
    const id = `${event.pid}-${event.tid}-${event.name}-${start}`

    // Extract source information from args if available
    let source = ""
    if (event.args?.data?.url) {
      source = event.args.data.url
    } else if (event.args?.data?.functionName) {
      source = event.args.data.functionName
    } else if (event.stack && event.stack.length > 0) {
      source = event.stack[0]
    }

    // Determine if this is an event, function call, or timer frame
    const isEvent = event.cat === "input" || event.name.includes("Event")
    const isFunctionCall = event.name.includes("Function call")
    const isTimer = event.cat === "timer"

    // Use yellow for events, function calls, and timers
    let color = "#f5d76e" // Default yellow for special frames

    // For other frames, use source script-based coloring
    if (!isEvent && !isFunctionCall && !isTimer) {
      if (event.sourceScript) {
        // Check if we already have a color for this source script
        if (!sourceScriptColors.has(event.sourceScript)) {
          // Generate a new random color for this source script
          sourceScriptColors.set(event.sourceScript, generateRandomColor())
        }
        // Use the assigned color for this source script
        color = sourceScriptColors.get(event.sourceScript) || color
      } else if (event.name.includes("anonymous")) {
        color = "#d8b4fe" // Light purple for anonymous functions
      } else if (event.name.includes("DOM") || event.name.includes("uD")) {
        color = "#fecaca" // Light red for DOM operations
      }
    }

    const frame: FrameNode = {
      id,
      name: event.name,
      value: duration,
      start,
      end,
      depth,
      color,
      children: [],
      source,
      sourceScript: event.sourceScript,
      args: event.args,
      cat: event.cat,
    }

    frameMap.set(id, frame)
    frames.push(frame)

    // Process children
    if (event.children && event.children.length > 0) {
      // Sort children by start time
      const sortedChildren = [...event.children].sort((a, b) => a.ts - b.ts)

      sortedChildren.forEach((child) => {
        const childFrame = processEvent(child, depth + 1)
        frame.children.push(childFrame.id)
        childFrame.parent = frame.id
      })
    }

    return frame
  }

  // Process all root events
  rootEvents.forEach((event) => {
    processEvent(event, 0)
  })

  return {
    startTime,
    endTime,
    totalTime,
    maxDepth,
    frames,
    frameMap,
    rootIds: rootEvents.map((event) => {
      const start = (event.ts - minTs) / 1000
      return `${event.pid}-${event.tid}-${event.name}-${start}`
    }),
    sourceScriptColors,
  }
}
