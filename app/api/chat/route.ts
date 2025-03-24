import { type NextRequest, NextResponse } from "next/server";

// Import the tool functions
import { generateReportTool } from "@/lib/tools/generate-report";
import { openSidePanelTool } from "@/lib/tools/open-side-panel";
import { generateBreakdownTool } from "@/lib/tools/generate-breakdown";
import { performResearchTool } from "@/lib/tools/perform-research";
import { generateSuggestionsTool } from "@/lib/tools/generate-suggestions";
import { streamText, createDataStreamResponse } from "@/lib/mock-ai-sdk";
import { ModelProvider } from "@/lib/mock-ai-sdk";

// Update the POST function in the chat API route
export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    let body;
    try {
      body = await req.json();
    } catch (error) {
      console.error("Error parsing request body:", error);
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 },
      );
    }

    // Ensure body is an object
    body = body || {};

    // Extract messages, files, and toolCallId with defaults
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const files = body.files || [];
    const toolCallId = body.toolCallId || null;
    const model = body.model || "default_model";

    if (messages.length === 0) {
      return NextResponse.json(
        { error: "No messages provided" },
        { status: 400 },
      );
    }

    // Get the last user message
    const userMessages = messages.filter(
      (msg) => msg && typeof msg === "object" && msg.role === "user",
    );
    const lastUserMessage =
      userMessages.length > 0 ? userMessages[userMessages.length - 1] : null;

    if (!lastUserMessage) {
      return NextResponse.json(
        { error: "No user message found" },
        { status: 400 },
      );
    }

    // Ensure content is a string
    const content =
      typeof lastUserMessage.content === "string"
        ? lastUserMessage.content
        : "";

    // Add artificial latency to simulate AI thinking time (reduced to 500-1500ms)
    const thinkingTime = 500 + Math.random() * 1000;

    // Create an abort controller that will be triggered if the client aborts
    const controller = new AbortController();
    const { signal } = controller;

    // Store the toolCallId in the signal if provided
    if (toolCallId) {
      (signal as any).toolCallId = toolCallId;
    }

    // Forward the client's abort signal to our controller
    req.signal.addEventListener("abort", () => {
      console.log(
        "Client aborted request, toolCallId:",
        (req.signal as any).toolCallId,
      );

      // Check if the abort was for a specific toolCallId
      const abortToolCallId = (req.signal as any).toolCallId;

      // Only abort if no specific toolCallId was requested or if it matches
      if (!abortToolCallId || abortToolCallId === toolCallId) {
        controller.abort();
      }
    });

    try {
      // Use the signal for the thinking time promise
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, thinkingTime);
        signal.addEventListener("abort", () => {
          clearTimeout(timeout);
          reject(new DOMException("Aborted", "AbortError"));
        });
      });
    } catch (error) {
      if (error.name === "AbortError") {
        console.log("Thinking time aborted");
        return new Response(null, { status: 499 }); // Client Closed Request
      }
      throw error;
    }

    // Set up the tools
    const tools = {
      generateReport: generateReportTool,
      openSidePanel: openSidePanelTool,
      generateBreakdown: generateBreakdownTool,
      performResearch: performResearchTool,
      generateSuggestions: generateSuggestionsTool,
    };

    // Filter out the generateSuggestionsTool from the tools object
    const { generateSuggestions, ...chatTools } = tools;

    // Prepare tool parameters
    const toolParams =
      files && files.length > 0
        ? { files, query: content }
        : { query: content };

    // System template
    const systemTemplate =
      "You are a helpful assistant specialized in Go programming. Provide clear, concise, and accurate information about Go concepts, patterns, and best practices.";

    // Use createDataStreamResponse to handle the streaming response
    return createDataStreamResponse({
      execute: async (dataStream) => {
        // Get the model from ModelProvider
        const selectedModel = ModelProvider(model);

        // Create the stream
        const chatStream = streamText({
          model: selectedModel,
          temperature: 0,
          messages,
          system: systemTemplate,
          toolChoice: "auto",
          tools: chatTools,
          toolParams,
          onError(event) {
            console.log("Error: ", event.error);
          },
        });

        // Set up an abort handler for the dataStream
        signal.addEventListener("abort", () => {
          console.log("Aborting dataStream");
          dataStream.close();
        });

        // Merge the stream into the dataStream
        return chatStream.mergeIntoDataStream(dataStream, {
          experimental_sendStart: true,
        });
      },
    });
  } catch (error) {
    console.error("Error in chat API:", error);
    if (error.name === "AbortError") {
      // Return a specific status code for aborted requests
      console.log("Returning aborted response");
      return new Response(JSON.stringify({ error: "Request aborted" }), {
        status: 499,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error.message || "Unknown error",
      },
      { status: 500 },
    );
  }
}
