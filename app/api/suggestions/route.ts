import { type NextRequest, NextResponse } from "next/server";
import {
  streamText,
  createDataStreamResponse,
  ModelProvider,
} from "@/lib/mock-ai-sdk";
import { generateSuggestionsTool } from "@/lib/tools/generate-suggestions";

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

    // Ensure body is an object and extract files with defaults
    body = body || {};
    const files = body.files || [];
    const model = body.model || "default_model";

    // Create an abort controller that will be triggered if the client aborts
    const controller = new AbortController();
    const { signal } = controller;

    // Forward the client's abort signal to our controller
    req.signal.addEventListener("abort", () => {
      controller.abort();
    });

    // Set up the tools array with just the suggestions tool
    const tools = { generateSuggestions: generateSuggestionsTool };

    // System template for suggestions
    const systemTemplate =
      "You are a helpful assistant that generates relevant suggestions based on uploaded files.";

    // Use createDataStreamResponse to handle the streaming response
    return createDataStreamResponse({
      execute: async (dataStream) => {
        // Get the model from ModelProvider
        const selectedModel = ModelProvider(model);

        // Create the stream with just the suggestion tool
        const suggestionsStream = streamText({
          model: selectedModel,
          temperature: 0,
          prompt: "suggestions", // Fixed prompt for suggestions endpoint
          system: systemTemplate,
          toolChoice: "required",
          tools,
          toolParams: { files },
          onError(event) {
            console.log("Error: ", event.error);
          },
        });

        // Merge the stream into the dataStream
        return suggestionsStream.mergeIntoDataStream(dataStream, {
          experimental_sendStart: true,
        });
      },
    });
  } catch (error) {
    console.error("Error in suggestions API:", error);
    if (error.name === "AbortError") {
      // Return a specific status code for aborted requests
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
