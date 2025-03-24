// Mock implementation of AI SDK functionality

// Update the ToolDefinition type to include an optional stream method
export type ToolDefinition = {
  name: string;
  description: string;
  execute: (params: any) => Promise<any>;
  stream?: (params: any, dataStream?: DataStream) => AsyncGenerator<any>;
};

// Update the ToolCall type to include toolCallId
export type ToolCall = {
  toolName: string;
  toolParameters: any;
  toolResults?: any;
  toolCallId?: string; // Add toolCallId to identify specific tool calls
};

// Update the StreamChunk type to include toolCallId
export type StreamChunk = {
  type:
    | "text-delta"
    | "tool-call"
    | "tool-result"
    | "message-annotation"
    | "start";
  text?: string;
  toolCall?: ToolCall;
  toolResult?: any;
  toolCallId?: string; // Add toolCallId to identify which stream this chunk belongs to
  annotation?: any; // Add annotation field for message annotations
};

export type StreamResult = {
  text: Promise<string>;
  chunks: AsyncIterable<StreamChunk>;
  mergeIntoDataStream: (
    dataStream: DataStream,
    options?: { experimental_sendStart?: boolean },
  ) => DataStream;
};

// Define DataStream type to match the AI SDK
export interface DataStream {
  append: (chunk: any) => void;
  close: () => void;
  writeMessageAnnotation?: (annotation: any) => void;
  isClosed?: boolean; // Add a flag to track if the stream is closed
}

// Registry of available tools
const toolRegistry = new Map<string, ToolDefinition>();

// Register a tool
export function registerTool(tool: ToolDefinition) {
  toolRegistry.set(tool.name, tool);
  return tool;
}

// Get a tool by name
export function getTool(name: string): ToolDefinition | undefined {
  return toolRegistry.get(name);
}

// Mock ModelProvider function
export function ModelProvider(modelName: string) {
  console.log(`Using model: ${modelName}`);
  return {
    name: modelName,
    provider: "mock-provider",
  };
}

// Update the streamText function in the mock-ai-sdk.ts file
export function streamText(options: {
  prompt?: string;
  messages?: any[];
  system?: string;
  model?: any;
  temperature?: number;
  tools?: ToolDefinition[] | Record<string, any>;
  toolChoice?: string;
  onChunk?: (chunk: StreamChunk) => void;
  toolParams?: any;
  toolCallId?: string;
  onError?: (event: { error: Error }) => void;
}): StreamResult {
  // Ensure options is defined and has expected shape
  const safeOptions = options || {};

  // Destructure with default values to prevent undefined
  const {
    tools = [],
    onChunk = () => {},
    toolParams = {},
    toolCallId = null,
    onError = () => {},
    messages = [],
    system = "",
    model = {},
    temperature = 0.7,
    toolChoice = "auto",
  } = safeOptions;

  // Ensure prompt is a string
  const prompt =
    typeof safeOptions.prompt === "string" ? safeOptions.prompt : "";

  // Extract prompt from messages if available
  const lastUserMessage =
    messages.length > 0 ? messages[messages.length - 1]?.content || "" : prompt;

  // Create an async generator for the chunks
  async function* generateChunks(
    dataStream?: DataStream,
  ): AsyncGenerator<StreamChunk> {
    let fullText = "";

    // Check if the request has been aborted
    if (
      typeof window !== "undefined" &&
      (window as any).abortedToolCalls?.includes(toolCallId)
    ) {
      console.log("Request already aborted for toolCallId:", toolCallId);
      return;
    }

    // Check if the request has been cancelled
    if (
      typeof window !== "undefined" &&
      (window as any).cancelledToolCalls?.includes(toolCallId)
    ) {
      console.log("Request already cancelled for toolCallId:", toolCallId);
      return;
    }

    // Check for trigger words to determine which tool to call
    const triggerWords: Record<string, string> = {
      report: "generateReport",
      "side panel": "openSidePanel",
      breakdown: "generateBreakdown",
      course: "generateBreakdown",
      levels: "generateBreakdown",
      search: "performResearch",
      research: "performResearch",
      suggestions: "generateSuggestions",
    };

    // Find matching trigger word
    let matchedTool: ToolDefinition | undefined;
    let matchedTrigger = "";

    // Ensure prompt is a string and convert to lowercase safely
    const promptLower = lastUserMessage ? lastUserMessage.toLowerCase() : "";

    // Special case for suggestions
    if (promptLower === "suggestions") {
      matchedTool =
        (Array.isArray(tools)
          ? tools.find((t) => t.name === "generateSuggestionsTool")
          : tools["generateSuggestionsTool"]) ||
        toolRegistry.get("generateSuggestionsTool");
      matchedTrigger = "suggestions";
    } else {
      // Check for other trigger words
      for (const [trigger, toolName] of Object.entries(triggerWords)) {
        if (promptLower.includes(trigger)) {
          const tool = Array.isArray(tools)
            ? tools.find((t) => t.name === toolName)
            : tools[toolName] || toolRegistry.get(toolName);
          if (tool) {
            matchedTool = tool;
            matchedTrigger = trigger;
            break;
          }
        }
      }
    }

    // If no specific tool matched, use a default response
    if (!matchedTool) {
      const defaultResponse =
        "That's a great question about Go! The language was designed at Google to be efficient, readable, and easy to use. Is there a specific aspect of Go you'd like to explore further?";

      // Stream the text character by character
      for (let i = 0; i < defaultResponse.length; i++) {
        // Check if the request has been aborted
        if (
          typeof window !== "undefined" &&
          (window as any).abortedToolCalls?.includes(toolCallId)
        ) {
          console.log("Streaming aborted for toolCallId:", toolCallId);
          break;
        }

        // Check if the dataStream is closed
        if (dataStream?.isClosed) {
          console.log("DataStream is closed, stopping generation");
          break;
        }

        const chunk: StreamChunk = {
          type: "text-delta",
          text: defaultResponse[i],
        };

        onChunk?.(chunk);
        yield chunk;
        fullText += defaultResponse[i];

        // Add a small delay to simulate streaming
        await new Promise((resolve) =>
          setTimeout(resolve, 10 + Math.random() * 30),
        );
      }
    } else {
      // First stream some text acknowledging the request
      const introText = getIntroText(matchedTool.name, matchedTrigger);

      for (let i = 0; i < introText.length; i++) {
        // Check if the request has been aborted
        if (
          typeof window !== "undefined" &&
          (window as any).abortedToolCalls?.includes(toolCallId)
        ) {
          console.log(
            "Intro text streaming aborted for toolCallId:",
            toolCallId,
          );
          break;
        }

        // Check if the dataStream is closed
        if (dataStream?.isClosed) {
          console.log("DataStream is closed, stopping generation");
          break;
        }

        const chunk: StreamChunk = {
          type: "text-delta",
          text: introText[i],
        };

        onChunk?.(chunk);
        yield chunk;
        fullText += introText[i];

        // Add a small delay to simulate streaming
        await new Promise((resolve) =>
          setTimeout(resolve, 10 + Math.random() * 20),
        );
      }

      // Then send a tool call with the toolCallId if provided
      const toolCall: ToolCall = {
        toolName: matchedTool.name,
        toolParameters: toolParams || { query: lastUserMessage },
        toolCallId:
          toolCallId ||
          `tool-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // Generate a unique ID if not provided
      };

      const toolCallChunk: StreamChunk = {
        type: "tool-call",
        toolCall,
        toolCallId: toolCall.toolCallId,
      };

      onChunk?.(toolCallChunk);
      yield toolCallChunk;

      // Execute the tool
      try {
        // Ensure we have valid parameters for the tool
        const safeParams = toolParams || { query: lastUserMessage || "" };

        // Add toolCallId to the parameters if provided
        if (toolCallId) {
          safeParams.toolCallId = toolCallId;
        }

        // Check if the tool supports streaming
        if (matchedTool.stream) {
          // Use the stream method to get results in chunks
          // Pass the dataStream to the tool if it's available
          for await (const streamResult of matchedTool.stream(
            safeParams,
            dataStream,
          )) {
            // Check if the request has been aborted
            if (
              typeof window !== "undefined" &&
              (window as any).abortedToolCalls?.includes(toolCall.toolCallId)
            ) {
              console.log(
                "Tool streaming aborted for toolCallId:",
                toolCall.toolCallId,
              );
              break;
            }

            // Check if the request has been cancelled
            if (
              typeof window !== "undefined" &&
              (window as any).cancelledToolCalls?.includes(toolCall.toolCallId)
            ) {
              console.log(
                "Tool streaming cancelled for toolCallId:",
                toolCall.toolCallId,
              );
              break;
            }

            // Check if the dataStream is closed
            if (dataStream?.isClosed) {
              console.log("DataStream is closed, stopping tool streaming");
              break;
            }

            // Send each streamed result with the same toolCallId
            const toolResultChunk: StreamChunk = {
              type: "tool-result",
              toolResult: streamResult,
              toolCallId: toolCall.toolCallId,
            };

            onChunk?.(toolResultChunk);
            yield toolResultChunk;
          }
        } else {
          // For non-streaming tools, execute normally
          const result = await matchedTool.execute(safeParams);

          // Check if the dataStream is closed before yielding the result
          if (dataStream?.isClosed) {
            console.log("DataStream is closed, not sending tool result");
            return;
          }

          // Send the tool result with the same toolCallId
          const toolResultChunk: StreamChunk = {
            type: "tool-result",
            toolResult: result,
            toolCallId: toolCall.toolCallId, // Include the toolCallId in the result
          };

          onChunk?.(toolResultChunk);
          yield toolResultChunk;
        }
      } catch (error) {
        console.error("Tool execution error:", error);
        onError({
          error: error instanceof Error ? error : new Error(String(error)),
        });

        // Check if the dataStream is closed before yielding the error
        if (dataStream?.isClosed) {
          console.log("DataStream is closed, not sending error message");
          return;
        }

        // Send an error message if tool execution fails
        const errorChunk: StreamChunk = {
          type: "text-delta",
          text: `I'm sorry, I encountered an error while processing your request: ${error.message || "Unknown error"}`,
        };

        onChunk?.(errorChunk);
        yield errorChunk;
      }
    }
  }

  // Return the StreamResult with mergeIntoDataStream implementation
  return {
    text: new Promise<string>((resolve) => {
      // This would normally accumulate the full text
      // For now, we'll just resolve with a placeholder
      setTimeout(() => resolve("Full response text would be here"), 1000);
    }),
    chunks: generateChunks(),
    mergeIntoDataStream: (
      dataStream: DataStream,
      options?: { experimental_sendStart?: boolean },
    ) => {
      // Add isClosed flag to track stream state
      dataStream.isClosed = false;

      // Enhance the dataStream with writeMessageAnnotation method if it doesn't exist
      if (!dataStream.writeMessageAnnotation) {
        dataStream.writeMessageAnnotation = (annotation: any) => {
          if (dataStream.isClosed) {
            console.log("DataStream is closed, not writing annotation");
            return;
          }

          const annotationChunk: StreamChunk = {
            type: "message-annotation",
            annotation,
          };
          dataStream.append(annotationChunk);
        };
      }

      // Wrap the original close method to update our flag
      const originalClose = dataStream.close;
      dataStream.close = () => {
        dataStream.isClosed = true;
        originalClose.call(dataStream);
      };

      // Send start event if requested
      if (options?.experimental_sendStart) {
        dataStream.append({ type: "start" });
      }

      // Create a global array to track aborted tool calls if it doesn't exist
      if (typeof window !== "undefined" && !(window as any).abortedToolCalls) {
        (window as any).abortedToolCalls = [];
      }
      // Start processing chunks
      (async () => {
        try {
          for await (const chunk of generateChunks(dataStream)) {
            // Check if this specific tool call has been aborted
            if (
              chunk.toolCallId &&
              typeof window !== "undefined" &&
              (window as any).abortedToolCalls?.includes(chunk.toolCallId)
            ) {
              console.log(
                "Skipping chunk for aborted toolCallId:",
                chunk.toolCallId,
              );
              continue;
            }

            // Check if the stream is closed before appending
            if (dataStream.isClosed) {
              console.log("DataStream is closed, stopping chunk processing");
              break;
            }

            dataStream.append(chunk);
          }

          // Only close if not already closed
          if (!dataStream.isClosed) {
            dataStream.close();
          }
        } catch (error) {
          console.error("Error in mergeIntoDataStream:", error);
          onError({
            error: error instanceof Error ? error : new Error(String(error)),
          });

          // Only close if not already closed
          if (!dataStream.isClosed) {
            dataStream.close();
          }
        }
      })();

      return dataStream;
    },
  };
}

// Update the createDataStreamResponse function to handle aborts better
export function createDataStreamResponse(options: {
  execute: (dataStream: DataStream) => Promise<DataStream>;
}) {
  // Create a DataStream implementation with writeMessageAnnotation
  const dataStream: DataStream = {
    append: (chunk: any) => {
      // In a real implementation, this would append to the response
      // For our mock, we'll just log it
      console.log("DataStream append:", chunk);
    },
    close: () => {
      // In a real implementation, this would close the response
      console.log("DataStream closed");
    },
    writeMessageAnnotation: (annotation: any) => {
      // In a real implementation, this would write an annotation to the response
      console.log("DataStream writeMessageAnnotation:", annotation);
    },
    isClosed: false,
  };

  // Create a ReadableStream that will be returned to the client
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Execute the callback with our DataStream
        await options.execute({
          append: (chunk) => {
            // Skip if the stream is closed
            if (dataStream.isClosed) {
              console.log("DataStream is closed, not appending chunk");
              return;
            }

            try {
              // When data is appended, encode it and enqueue it to the stream
              const encodedChunk = encoder.encode(JSON.stringify(chunk) + "\n");
              controller.enqueue(encodedChunk);
            } catch (error) {
              console.error("Error encoding chunk:", error);
            }
          },
          close: () => {
            // Mark as closed and close the controller
            dataStream.isClosed = true;
            controller.close();
          },
          writeMessageAnnotation: (annotation) => {
            // Skip if the stream is closed
            if (dataStream.isClosed) {
              console.log("DataStream is closed, not writing annotation");
              return;
            }

            try {
              // When an annotation is written, encode it and enqueue it to the stream
              const annotationChunk = {
                type: "message-annotation",
                annotation,
              };
              const encodedChunk = encoder.encode(
                JSON.stringify(annotationChunk) + "\n",
              );
              controller.enqueue(encodedChunk);
            } catch (error) {
              console.error("Error encoding annotation:", error);
            }
          },
          isClosed: false,
        });
      } catch (error) {
        console.error("Error in createDataStreamResponse:", error);
        if (error.name === "AbortError") {
          // Handle abort specifically
          console.log("Stream aborted");
          dataStream.isClosed = true;
          controller.close();
        } else {
          dataStream.isClosed = true;
          controller.error(error);
        }
      }
    },
    cancel() {
      // Mark the stream as closed when cancelled
      console.log("Stream cancelled by client");
      dataStream.isClosed = true;
    },
  });

  // Return a Response with the stream
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

// Helper to get intro text based on the tool
function getIntroText(toolName: string, trigger: string): string {
  switch (toolName) {
    case "generateReport":
      return "I'm generating a comprehensive report on Go programming for you. You can view it in the panel on the right.";
    case "openSidePanel":
      return "I've opened the side panel with your Go learning analytics. You can view various metrics about your progress in learning Go, including topic performance, learning trends, and more.";
    case "generateBreakdown":
      return "Here's the breakdown of our Go programming courses by difficulty level. As you can see, we offer several beginner-friendly courses to help you get started, along with intermediate and advanced courses as you progress.";
    case "performResearch":
      return "I've conducted in-depth research on concurrency patterns in Go. Here are the key findings from academic and web sources that explain how Go's concurrency model works and best practices for implementation.";
    case "generateSuggestions":
      return "Based on the files you've uploaded, here are some suggested questions you might want to ask.";
    default:
      return "I'm processing your request about Go programming...";
  }
}
