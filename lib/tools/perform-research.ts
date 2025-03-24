import { registerTool } from "../mock-ai-sdk"
import type { DataStream } from "../mock-ai-sdk"

// Mock research results for Go concurrency patterns
const mockResults = [
  {
    id: "1",
    title: "Concurrency Patterns in Go: Goroutines and Channels",
    snippet:
      "Go's approach to concurrency is based on CSP (Communicating Sequential Processes). Goroutines are lightweight threads managed by the Go runtime, while channels provide a way for goroutines to communicate with each other and synchronize their execution.",
    source: "web",
    sourceIcon: "Globe",
    url: "https://go.dev/blog/concurrency-patterns",
  },
  {
    id: "2",
    title: "Advanced Concurrency Patterns: Context and Cancellation",
    snippet:
      "The context package in Go provides a way to carry deadlines, cancellation signals, and other request-scoped values across API boundaries and between processes. This is particularly useful for controlling concurrent operations.",
    source: "academic",
    sourceIcon: "BookOpen",
    url: "https://pkg.go.dev/context",
  },
  {
    id: "3",
    title: "Concurrency Pattern Analysis: Worker Pools",
    snippet:
      "Worker pools are a common concurrency pattern in Go where a fixed number of worker goroutines process tasks from a shared channel. This pattern helps limit resource usage while maximizing throughput for concurrent operations.",
    source: "analysis",
    sourceIcon: "BarChart",
  },
  {
    id: "4",
    title: "Mutex vs. Channels: Choosing the Right Concurrency Primitive",
    snippet:
      "Go offers both traditional synchronization primitives (mutexes) and CSP-style concurrency (channels). Understanding when to use each approach is crucial for writing efficient concurrent programs. The general guideline is 'Share memory by communicating; don't communicate by sharing memory.'",
    source: "academic",
    sourceIcon: "BookOpen",
    url: "https://pkg.go.dev/context",
  },
  {
    id: "5",
    title: "Error Handling in Concurrent Go Programs",
    snippet:
      "Proper error handling in concurrent Go programs requires careful consideration. Common patterns include using error channels, the errgroup package, or context cancellation to propagate errors between goroutines.",
    source: "web",
    sourceIcon: "Globe",
  },
]

// Define the research steps
const initialSteps = (query: string) => [
  {
    id: "plan",
    title: "Research Plan",
    subtitle: "(4 queries, 3 analyses)",
    icon: "Search",
    status: "pending",
  },
  {
    id: "web",
    title: `Searched the web for "${query}"`,
    subtitle: "Found 0 results",
    icon: "Globe",
    status: "pending",
  },
  {
    id: "academic",
    title: `Searching academic papers for "${query}"`,
    subtitle: "Searching all sources...",
    icon: "BookOpen",
    status: "pending",
  },
  {
    id: "analysis",
    title: "Analyzing patterns and insights",
    subtitle: "Preparing analysis...",
    icon: "BarChart",
    status: "pending",
  },
]

// Define the research phases
const researchPhases = [
  {
    phase: "planning",
    activeStep: "plan",
    steps: [
      {
        id: "plan",
        status: "in-progress",
        expanded: true,
        subtitle: "(4 queries, 3 analyses)",
      },
    ],
    progress: 15,
    visibleSteps: ["plan"],
  },
  {
    phase: "searching",
    activeStep: "web",
    steps: [
      {
        id: "plan",
        status: "complete",
        expanded: false,
        subtitle: "Research plan created",
      },
      {
        id: "web",
        status: "in-progress",
        expanded: true,
      },
    ],
    progress: 35,
    visibleSteps: ["plan", "web"],
  },
  {
    phase: "analyzing",
    activeStep: "academic",
    steps: [
      {
        id: "web",
        status: "complete",
        expanded: false,
        subtitle: "Found 3 results",
      },
      {
        id: "academic",
        status: "in-progress",
        expanded: true,
      },
    ],
    progress: 65,
    visibleSteps: ["plan", "web", "academic"],
  },
  {
    phase: "analyzing",
    activeStep: "analysis",
    steps: [
      {
        id: "academic",
        status: "complete",
        expanded: false,
        subtitle: "Found 2 results",
      },
      {
        id: "analysis",
        status: "in-progress",
        expanded: true,
      },
    ],
    progress: 85,
    visibleSteps: ["plan", "web", "academic", "analysis"],
  },
  {
    phase: "complete",
    activeStep: null,
    steps: [
      {
        id: "analysis",
        status: "complete",
        expanded: false,
        subtitle: "Analysis complete",
      },
    ],
    progress: 100,
    visibleSteps: ["plan", "web", "academic", "analysis"],
    showResults: true,
  },
]

export const performResearchTool = registerTool({
  name: "performResearch",
  description: "Performs research on Go programming topics",
  execute: async (params: { query: string; toolCallId?: string }) => {
    // Determine the research query
    const researchQuery = params.query.toLowerCase().includes("concurrency")
      ? "concurrency patterns in Go"
      : "Go programming concepts"

    // Create the initial research state
    const initialState = {
      type: "research",
      query: researchQuery,
      phase: "planning",
      progress: 0,
      steps: initialSteps(researchQuery),
      visibleSteps: [],
      activeStep: null,
      results: [],
      showResults: false,
      completed: false,
      toolCallId: params.toolCallId || null,
    }

    // Return the initial state immediately
    return {
      ...initialState,
      streamSteps: true, // Signal that this result will be streamed in steps
    }
  },
  // Update the stream method to handle dataStream for annotations
  stream: async function* (params: { query: string; toolCallId?: string }, dataStream?: DataStream) {
    const researchQuery = params.query.toLowerCase().includes("concurrency")
      ? "concurrency patterns in Go"
      : "Go programming concepts"

    // Initial state
    const steps = initialSteps(researchQuery)
    const toolCallId = params.toolCallId || `research-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`

    // Send initial research update annotation
    if (dataStream?.writeMessageAnnotation) {
      dataStream.writeMessageAnnotation({
        type: "research_update",
        data: {
          id: "trace-insights",
          type: "trace-insight",
          status: "running",
          title: "Research Analysis",
          message: "Starting research analysis...",
          timestamp: Date.now(),
        },
      })
    }

    // Yield each phase with a delay
    for (let i = 0; i < researchPhases.length; i++) {
      const phase = researchPhases[i]

      // Wait before sending the next phase (simulating research time)
      await new Promise((resolve) => setTimeout(resolve, i === 0 ? 1000 : 1500))

      // Update steps based on the current phase
      const updatedSteps = [...steps]
      phase.steps.forEach((stepUpdate) => {
        const index = updatedSteps.findIndex((s) => s.id === stepUpdate.id)
        if (index !== -1) {
          updatedSteps[index] = {
            ...updatedSteps[index],
            status: stepUpdate.status,
            expanded: stepUpdate.expanded,
            subtitle: stepUpdate.subtitle || updatedSteps[index].subtitle,
          }
        }
      })

      // Create the research state for this phase
      const researchState = {
        type: "research",
        query: researchQuery,
        phase: phase.phase,
        progress: phase.progress,
        steps: updatedSteps,
        visibleSteps: phase.visibleSteps,
        activeStep: phase.activeStep,
        results: phase.showResults ? mockResults : [],
        showResults: !!phase.showResults,
        completed: i === researchPhases.length - 1,
        toolCallId: toolCallId,
      }

      // Send research update annotation
      if (dataStream?.writeMessageAnnotation) {
        // Send a research update annotation for the current phase
        dataStream.writeMessageAnnotation({
          type: "research_update",
          data: {
            id: `research-${phase.activeStep || "progress"}`,
            type: phase.activeStep || "progress",
            status: i === researchPhases.length - 1 ? "completed" : "running",
            title: phase.activeStep
              ? `${phase.activeStep.charAt(0).toUpperCase() + phase.activeStep.slice(1)} Research`
              : "Research Progress",
            message: phase.activeStep
              ? `${phase.activeStep === "plan" ? "Creating" : phase.activeStep === "web" ? "Searching" : "Analyzing"} ${phase.activeStep}...`
              : "Research in progress...",
            timestamp: Date.now(),
            completedSteps: i,
            totalSteps: researchPhases.length,
            overwrite: true,
          },
        })

        // If this is the final phase, send a completed status
        if (i === researchPhases.length - 1) {
          dataStream.writeMessageAnnotation({
            type: "research_update",
            data: {
              id: "research-progress",
              type: "progress",
              status: "completed",
              message: "Research complete",
              completedSteps: researchPhases.length,
              totalSteps: researchPhases.length,
              isComplete: true,
              timestamp: Date.now(),
            },
            overwrite: true,
          })
        }
      }

      // Yield the updated research state
      yield researchState
    }
  },
})

