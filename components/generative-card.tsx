"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeedbackButtons } from "@/components/feedback-buttons";

interface GenerativeCardProps {
  title: string;
  data: {
    beginner: number;
    intermediate: number;
    advanced: number;
  };
  triggerAnimation: boolean;
  isStreaming?: boolean;
  onAbort?: () => void;
  toolCallId?: string | null;
  annotations?: any[];
  isCancelled?: boolean; // Add this new prop
}

export function GenerativeCard({
  title,
  data,
  triggerAnimation,
  isStreaming = false,
  onAbort,
  toolCallId,
  annotations = [],
  isCancelled = false, // Add this new prop with default value
}: GenerativeCardProps) {
  const [showChart, setShowChart] = useState(false);

  // Determine if the chart is complete based on annotations
  const isComplete = annotations.some(
    (a) => a.data?.status === "completed" && a.data?.isComplete,
  );

  // Derive loading state from annotations if available
  const isLoading = isStreaming && !isComplete && !isCancelled;

  // Show chart when data is available and not loading, or when complete, and not cancelled
  useEffect(() => {
    // Only change state when we have definitive information
    if (isComplete) {
      // If complete, always show chart (unless cancelled)
      setShowChart(!isCancelled);
    } else if (triggerAnimation && !isLoading && !isCancelled) {
      // If animation triggered and not loading and not cancelled, show chart
      setShowChart(true);
    } else if (isCancelled) {
      // If cancelled, always hide chart
      setShowChart(false);
    }
    // Don't include showChart in dependencies to prevent toggling back
  }, [triggerAnimation, isLoading, isComplete, isCancelled]);

  const total = data.beginner + data.intermediate + data.advanced;
  const calculatePercentage = (value: number) =>
    Math.round((value / total) * 100);

  const handleAbort = () => {
    if (onAbort) {
      onAbort();
    }
  };

  // Get progress from annotations if available
  const progress =
    annotations.find((a) => a.data?.progress !== undefined)?.data?.progress ||
    0;

  return (
    <Card
      className={cn(
        "group relative bg-background rounded-xl border-border transition-all duration-300 hover:translate-x-1 hover:-translate-y-1 hover:shadow-[-8px_8px_0_hsl(var(--border-color))] w-full max-w-sm mt-4",
        isLoading
          ? "translate-x-1 -translate-y-1 shadow-[-8px_8px_0_hsl(var(--border-color))]"
          : "",
      )}
    >
      <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-bold text-foreground">
          {isLoading && !isCancelled ? (
            <Skeleton className="h-6 w-3/4" />
          ) : (
            title
          )}
        </CardTitle>

        <div className="flex items-center gap-2">
          {/* Add cancel button when streaming and not cancelled */}
          {isStreaming && onAbort && !isCancelled && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full border-destructive hover:bg-destructive hover:text-destructive"
              onClick={handleAbort}
              title="Cancel breakdown"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Cancel breakdown</span>
            </Button>
          )}

          {/* Add feedback buttons when complete */}
          {!isLoading && !isCancelled && showChart && (
            <FeedbackButtons
              messageId={`breakdown-${title.replace(/\s+/g, "-").toLowerCase()}`}
              source="breakdown"
            />
          )}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {isLoading && !isCancelled ? (
          <div className="space-y-3">
            <Skeleton className="h-32 w-32 rounded-full mx-auto" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative h-32 w-32 mx-auto">
              <svg className="w-full h-full" viewBox="0 0 100 100">
                {/* Background circle */}
                <circle
                  className="text-muted stroke-current"
                  strokeWidth="12"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                />

                {/* Beginner segment - Peppermint */}
                <circle
                  className={cn(
                    "text-peppermint-400 stroke-current transition-all duration-1000",
                    showChart ? "opacity-100" : "opacity-0",
                  )}
                  strokeWidth="12"
                  strokeDasharray={`${calculatePercentage(data.beginner) * 2.51} 251`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  style={{
                    transformOrigin: "center",
                    transform: "rotate(-90deg)",
                    transition: "stroke-dasharray 1.5s ease",
                  }}
                />

                {/* Intermediate segment - Indigo */}
                <circle
                  className={cn(
                    "text-indigo-500 stroke-current transition-all duration-1000",
                    showChart ? "opacity-100" : "opacity-0",
                  )}
                  strokeWidth="12"
                  strokeDasharray={`${calculatePercentage(data.intermediate) * 2.51} 251`}
                  strokeDashoffset={`${-calculatePercentage(data.beginner) * 2.51}`}
                  strokeLinecap="round"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  style={{
                    transformOrigin: "center",
                    transform: "rotate(-90deg)",
                    transition:
                      "stroke-dasharray 1.5s ease, stroke-dashoffset 1.5s ease",
                  }}
                />

                {/* Advanced segment - Merino */}
                <circle
                  className={cn(
                    "text-merino-500 stroke-current transition-all duration-1000",
                    showChart ? "opacity-100" : "opacity-0",
                  )}
                  strokeWidth="12"
                  strokeDasharray={`${calculatePercentage(data.advanced) * 2.51} 251`}
                  strokeDashoffset={`${-(calculatePercentage(data.beginner) + calculatePercentage(data.intermediate)) * 2.51}`}
                  strokeLinecap="round"
                  cx="50"
                  cy="50"
                  r="40"
                  fill="transparent"
                  style={{
                    transformOrigin: "center",
                    transform: "rotate(-90deg)",
                    transition:
                      "stroke-dasharray 1.5s ease, stroke-dashoffset 1.5s ease",
                  }}
                />

                {/* Center text */}
                <text
                  x="50"
                  y="50"
                  dominantBaseline="middle"
                  textAnchor="middle"
                  className={cn(
                    "fill-foreground text-sm font-medium transition-all duration-500",
                    showChart ? "opacity-100" : "opacity-0",
                  )}
                >
                  {total}
                </text>
                <text
                  x="50"
                  y="60"
                  dominantBaseline="middle"
                  textAnchor="middle"
                  className={cn(
                    "fill-foreground text-xs opacity-70 transition-all duration-500",
                    showChart ? "opacity-70" : "opacity-0",
                  )}
                >
                  courses
                </text>
              </svg>
            </div>

            <div
              className={cn(
                "space-y-2 mt-4 transition-all duration-500",
                showChart ? "opacity-100" : "opacity-0",
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-peppermint-400 mr-2"></div>
                  <span className="text-sm">Beginner</span>
                </div>
                <span className="text-sm font-medium">
                  {data.beginner} courses ({calculatePercentage(data.beginner)}
                  %)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-indigo-500 mr-2"></div>
                  <span className="text-sm">Intermediate</span>
                </div>
                <span className="text-sm font-medium">
                  {data.intermediate} courses (
                  {calculatePercentage(data.intermediate)}%)
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-merino-500 mr-2"></div>
                  <span className="text-sm">Advanced</span>
                </div>
                <span className="text-sm font-medium">
                  {data.advanced} courses ({calculatePercentage(data.advanced)}
                  %)
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
