import type { InteractionEvent } from "./types"

// Convert milliseconds to nanoseconds
const msToNs = (ms: number) => ms * 1000000

// Helper to create interaction events with realistic timestamps
// Base time is 1000000 microseconds (1s) from the trace start
const createInteraction = (
  startOffsetMs: number,
  inputDelayMs: number,
  processingDurationMs: number,
  presentationDelayMs: number,
  totalDurationMs: number,
  name?: string,
): InteractionEvent => {
  // Convert to nanoseconds for timestamps
  const baseTs = msToNs(1000 + startOffsetMs) // 1000ms offset + start offset
  const processingStart = baseTs + msToNs(inputDelayMs)
  const processingEnd = processingStart + msToNs(processingDurationMs)

  return {
    id: `interaction-${startOffsetMs}`,
    name: name || `Interaction at ${startOffsetMs}ms`,
    ts: baseTs,
    inputDelay: inputDelayMs,
    processingStart,
    processingEnd,
    presentationDelay: presentationDelayMs,
    dur: totalDurationMs,
  }
}

// Sample interaction events with varying characteristics
export const mockInteractions: InteractionEvent[] = [
  // Short interaction (under threshold)
  createInteraction(500, 5, 80, 10, 95, "Click Button"),

  // Long interaction (over threshold)
  createInteraction(2000, 10, 250, 30, 290, "Form Submit"),

  // Very long interaction with significant input delay
  createInteraction(4500, 50, 300, 40, 390, "Image Gallery"),

  // Interaction with minimal delays but long processing
  createInteraction(7000, 2, 220, 5, 227, "Search Query"),

  // Short interaction with high presentation delay
  createInteraction(8500, 5, 50, 100, 155, "Animation"),

  // Interaction that spans a significant portion of the trace
  createInteraction(3000, 15, 1500, 25, 1540, "Page Navigation"),

  // Interaction with extreme input delay
  createInteraction(6000, 100, 150, 20, 270, "Heavy Click"),

  // Very short interaction
  createInteraction(9000, 1, 20, 2, 23, "Hover"),
]
