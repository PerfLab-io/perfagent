import { type NextRequest, NextResponse } from "next/server";
import { getAnimationUrlForTopic } from "@/lib/utils/gif-generator";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const topic = searchParams.get("topic") || "go-overview";

  try {
    const gifUrl = await getAnimationUrlForTopic(topic);
    return NextResponse.json({ success: true, url: gifUrl });
  } catch (error) {
    console.error("Error generating GIF:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate GIF" },
      { status: 500 },
    );
  }
}
