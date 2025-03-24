"use client";

import { useState, useEffect, useRef } from "react";
import {
  XCircle,
  FileText,
  Clipboard,
  ClipboardCheck,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { MarkdownRenderer } from "./markdown-renderer";
import { FeedbackButtons } from "@/components/feedback-buttons";

interface MarkdownReportProps {
  visible: boolean;
  onClose: () => void;
  exiting?: boolean;
  isGenerating: boolean;
  topic: string;
  onComplete: () => void;
  onAbort?: () => void;
  reportData?: any;
  reportId?: string | null;
}

export function MarkdownReport({
  visible,
  onClose,
  exiting = false,
  isGenerating,
  topic,
  onComplete,
  onAbort,
  reportData,
  reportId,
}: MarkdownReportProps) {
  const [animate, setAnimate] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  // Use the report data from props or fallback to a loading state
  const report = reportData || {
    title: "Loading Report...",
    sections: [{ title: "Preparing Content", content: "Loading content..." }],
  };

  // Animation effect
  useEffect(() => {
    if (visible) {
      const timer = setTimeout(() => {
        setAnimate(true);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setAnimate(false);
    }
  }, [visible]);

  // Call onComplete when reportData is available and not empty
  useEffect(() => {
    if (reportData && reportData.sections && reportData.sections.length > 0) {
      onComplete();
    }
  }, [reportData, onComplete]);

  const scrollToBottom = () => {
    if (reportRef.current) {
      reportRef.current.scrollTo({
        top: reportRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  };

  // Scroll to bottom when new sections are added
  useEffect(() => {
    if (reportData && reportData.sections) {
      scrollToBottom();
    }
  }, [reportData]);

  const copyToClipboard = () => {
    // Create a string of all the report content
    const fullContent = report.sections
      .map((section) => `${section.title}\n\n${section.content}`)
      .join("\n\n");

    // Copy to clipboard
    navigator.clipboard.writeText(fullContent).catch((err) => {
      console.error("Failed to copy: ", err);
    });

    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const downloadReport = () => {
    // Create a string of all the report content with proper markdown formatting
    const fullContent =
      `# ${report.title}\n\n` +
      report.sections
        .map((section) => `## ${section.title}\n\n${section.content}`)
        .join("\n\n");

    // Create a blob with the content
    const blob = new Blob([fullContent], { type: "text/markdown" });

    // Create a URL for the blob
    const url = URL.createObjectURL(blob);

    // Create a filename with reportId to make it unique
    const filename = `${report.title.toLowerCase().replace(/\s+/g, "-")}${reportId ? `-${reportId.substring(0, 8)}` : ""}.md`;

    // Create a temporary anchor element to trigger the download
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();

    // Clean up
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!visible) return null;

  const isStreamComplete =
    !isGenerating &&
    reportData &&
    reportData.sections &&
    reportData.sections.length > 0;

  return (
    <div
      className={cn(
        "bg-background p-6 transition-all duration-300 panel-right overflow-hidden flex flex-col",
        animate ? "opacity-100" : "opacity-0",
        exiting && "panel-right-exit",
      )}
      style={{
        animationName: animate && !exiting ? "slideRight" : "none",
        animationDuration: "250ms",
        animationTimingFunction: "cubic-bezier(0.25, 0.1, 0.25, 1)",
        animationFillMode: "forwards",
      }}
    >
      <div className="flex justify-between items-center mb-4 sticky top-0 bg-background pb-2 border-b border-border z-10">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          <h2 className="text-xl font-bold text-foreground">
            {report.title}
            {reportId && (
              <span className="text-sm font-normal text-foreground/60 ml-2">
                #{reportId}
              </span>
            )}
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {/* Only show feedback buttons when complete */}
          {!isGenerating &&
            reportData &&
            reportData.sections &&
            reportData.sections.length > 0 && (
              <FeedbackButtons
                messageId={`report-${reportId || report.title.replace(/\s+/g, "-").toLowerCase()}`}
                source="report"
              />
            )}

          <Button
            variant="ghost"
            size="sm"
            onClick={copyToClipboard}
            disabled={
              !reportData ||
              !reportData.sections ||
              reportData.sections.length === 0
            }
            className="flex items-center gap-1"
          >
            {isCopied ? (
              <>
                <ClipboardCheck className="h-4 w-4 text-peppermint-600 dark:text-peppermint-400" />
                <span className="text-peppermint-600 dark:text-peppermint-400">
                  Copied!
                </span>
              </>
            ) : (
              <>
                <Clipboard className="h-4 w-4" />
                <span>Copy</span>
              </>
            )}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={downloadReport}
            disabled={
              !reportData ||
              !reportData.sections ||
              reportData.sections.length === 0
            }
            className="flex items-center gap-1"
          >
            <Download className="h-4 w-4" />
            <span>Download</span>
          </Button>

          {/* Always show abort button while generating */}
          {isGenerating && onAbort && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onAbort}
              className="flex items-center gap-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            >
              <XCircle className="h-4 w-4" />
              <span>Stop</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full h-8 w-8"
          >
            <XCircle className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <div
        ref={reportRef}
        className="flex-grow overflow-y-auto pr-1 max-h-full"
      >
        {isGenerating && !reportData ? (
          <div className="flex justify-center items-center h-32">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        ) : (
          report.sections.map((section, index) => (
            <div key={index} className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <Badge
                  variant="outline"
                  className="bg-peppermint-100 text-peppermint-800 dark:bg-peppermint-900 dark:text-peppermint-300"
                >
                  Section {index + 1}
                </Badge>
                <h3 className="text-lg font-medium text-foreground">
                  {section.title}
                </h3>
              </div>

              <div className="relative">
                <MarkdownRenderer content={section.content || ""} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
