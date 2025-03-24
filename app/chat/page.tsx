"use client";

import type React from "react";

import { useState, useRef, useEffect, useCallback } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Paperclip, Send, X } from "lucide-react";
import { ChatMessage } from "@/components/chat-message";
import { FilePreview } from "@/components/file-preview";
import { SuggestedMessages } from "@/components/suggested-messages";
import { FileDropzone } from "@/components/file-dropzone";
import { DataPanel } from "@/components/data-panel";
import { MarkdownReport } from "@/components/markdown-report";
import { cn } from "@/lib/utils";
import { ResearchProvider } from "@/components/research-card";
import { useChat } from "@/lib/hooks/use-chat";

export default function AiChatPage() {
  const {
    messages,
    input,
    setInput,
    handleSubmit: originalHandleSubmit,
    isLoading,
    stop,
    attachedFiles,
    setAttachedFiles,
    handleFileChange,
    handleFilesDrop,
    removeFile,
    suggestionsLoading,
    suggestions,
    setSuggestions,
  } = useChat();

  const [showFileSection, setShowFileSection] = useState(true);
  const [chatStarted, setChatStarted] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState<boolean | null>(null);
  const [panelAnimationComplete, setPanelAnimationComplete] = useState(false);
  const [panelExiting, setPanelExiting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [messagesVisible, setMessagesVisible] = useState(false);
  const [panelContentType, setPanelContentType] = useState<"data" | "report">(
    "data",
  );
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [reportTopic, setReportTopic] = useState("");
  const [reportData, setReportData] = useState(null);
  const [toolCallId, setToolCallId] = useState<string | undefined>(undefined);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [reportsMap, setReportsMap] = useState<Record<string, any>>({});

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > 0) {
      if (!chatStarted) {
        setChatStarted(true);
        // Delay showing messages until input animation completes
        setTimeout(() => {
          setMessagesVisible(true);
          setTimeout(scrollToBottom, 100);
        }, 500); // Increased from 300ms to 500ms to match animation duration
      } else {
        scrollToBottom();
      }
    }
  }, [messages, chatStarted]);

  // Update the useEffect for handling file section visibility
  useEffect(() => {
    if (attachedFiles.length > 0) {
      // Show the file section immediately when files are added
      setShowFileSection(true);
    } else {
      // Only hide if there are no files and not loading
      if (!isLoading) {
        setShowFileSection(false);
      }
    }
  }, [attachedFiles, isLoading]);

  // Add a new effect to handle height adjustment
  useEffect(() => {
    // Force a layout recalculation when showing/hiding file section
    // This helps prevent the content from shifting unexpectedly
    if (showFileSection) {
      document.body.style.overflowAnchor = "none";
      setTimeout(() => {
        document.body.style.overflowAnchor = "auto";
        scrollToBottom();
      }, 50);
    }
  }, [showFileSection]);

  // Focus textarea when chat starts
  useEffect(() => {
    if (chatStarted && textareaRef.current) {
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 500); // Wait for animation to complete
    }
  }, [chatStarted]);

  // Handle panel animation sequencing
  useEffect(() => {
    if (showSidePanel) {
      setPanelExiting(false);
      // Allow time for the left panel animation to complete first
      const timer = setTimeout(() => {
        setPanelAnimationComplete(true);
      }, 300); // Reduced from 500ms to 300ms
      return () => clearTimeout(timer);
    } else {
      if (panelAnimationComplete) {
        // Start exit animation for the right panel
        setPanelExiting(true);

        // After exit animation completes, hide the panel completely
        const timer = setTimeout(() => {
          setPanelAnimationComplete(false);
          setPanelExiting(false);
        }, 250); // Reduced from 350ms to 250ms
        return () => clearTimeout(timer);
      } else {
        setPanelAnimationComplete(false);
      }
    }
  }, [showSidePanel, panelAnimationComplete]);

  // Check for tool calls that should open the side panel
  useEffect(() => {
    // Check the latest message for tool calls that should open the side panel
    const latestMessage = messages[messages.length - 1];
    if (latestMessage?.toolCall) {
      if (latestMessage.toolCall.id) {
        setToolCallId(latestMessage.toolCall.id);
      }
      if (latestMessage.toolCall.type === "report") {
        // Store the report data in the reportsMap
        if (
          latestMessage.toolCall.data &&
          latestMessage.toolCall.data.reportData
        ) {
          // Generate a unique report ID instead of using the message ID
          const reportId = latestMessage.id;
          setReportsMap((prev) => ({
            ...prev,
            [reportId]: {
              data: latestMessage.toolCall.data.reportData,
              topic: latestMessage.toolCall.reportType || "go-overview",
              toolCallId: latestMessage.toolCall.id,
            },
          }));

          // Set as active report and open panel
          setActiveReportId(reportId);
          setShowSidePanel(true);
          setPanelContentType("report");
          setIsGeneratingReport(true);
          setReportTopic(latestMessage.toolCall.reportType || "go-overview");
          setReportData(latestMessage.toolCall.data.reportData);
        }
      } else if (latestMessage.toolCall.type === "sidePanel") {
        setShowSidePanel(true);
        setPanelContentType("data");
      }
    }
  }, [messages]);

  const toggleSidePanel = () => {
    setShowSidePanel(!showSidePanel);
  };

  const handleReportComplete = () => {
    setIsGeneratingReport(false);
  };

  // Reset file section visibility after message is sent
  useEffect(() => {
    if (!isLoading && messages.length > 0) {
      setShowFileSection(false);
    }
  }, [isLoading, messages.length]);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      originalHandleSubmit(event as any);
    }
  };

  // Add this useEffect after the existing effects in the component
  useEffect(() => {
    // Ensure proper scroll behavior when file section visibility changes
    if (messagesEndRef.current && messages.length > 0) {
      setTimeout(() => {
        scrollToBottom();
      }, 300); // Wait for transition
    }
  }, [showFileSection, attachedFiles.length]);

  // Add a new useEffect to handle smooth transitions when file section changes
  useEffect(() => {
    // When file section visibility changes, ensure smooth transition
    if (showFileSection && attachedFiles.length > 0) {
      // Add a small delay to allow the DOM to update
      setTimeout(() => {
        scrollToBottom();
      }, 50);
    }
  }, [showFileSection, attachedFiles.length]);

  // Update the handleAbortReport function to use the stop function from useChat
  const handleAbortReport = () => {
    // Stop the current message stream
    stop(toolCallId);

    // Update UI state
    setShowSidePanel(false);
    setPanelExiting(true);
    setReportData(null);
    setIsGeneratingReport(false);

    // Reset the report state after the exit animation completes
    setTimeout(() => {
      setPanelExiting(false);
    }, 300);
  };

  // Update the handleAbortResearch function to use the stop function from useChat
  const handleAbortResearch = (toolCallId?: string) => {
    // Stop the current message stream with the specific toolCallId
    stop(toolCallId);
  };

  const openReport = useCallback(
    (reportId: string) => {
      const report = reportsMap[reportId];
      if (report) {
        setActiveReportId(reportId);
        setShowSidePanel(true);
        setPanelContentType("report");
        setIsGeneratingReport(false);
        setReportTopic(report.topic);
        setReportData(report.data);
        setToolCallId(report.toolCallId);
      }
    },
    [reportsMap],
  );

  // Add a function to close the report panel
  const closeReport = useCallback(() => {
    setShowSidePanel(false);
    setActiveReportId(null);
  }, []);

  // Update the ResearchProvider to include the ResearchCard with the onAbort prop
  // Replace the existing ResearchProvider with this updated version
  return (
    <ResearchProvider onAbort={handleAbortResearch}>
      <div className="flex flex-col min-h-screen bg-background">
        <div className="relative bg-peppermint-200 dark:bg-background mb-20">
          <Header />
        </div>

        <main className="flex-1 container mx-auto px-4 py-6 flex flex-col relative min-h-[500px] md:min-h-[600px] lg:min-h-[700px]">
          {/* Dual panel container */}
          <div
            className={cn(
              "flex-1 dual-panel-container relative",
              showSidePanel
                ? "panel-active"
                : showSidePanel == null
                  ? ""
                  : "panel-inactive",
            )}
          >
            {/* Left panel with chat */}
            <div
              className={cn(
                "panel-left flex flex-col relative overflow-hidden",
                "min-h-[calc(70vh-200px)]", // Use viewport height minus header space
                "max-h-[calc(90vh-200px)]", // Limit maximum height to avoid overflowing
              )}
            >
              {/* Outter main container with dropzone */}
              <FileDropzone
                onFilesDrop={handleFilesDrop}
                className="flex-1 flex flex-col relative h-full" // Updated to h-full
                disabled={isLoading}
              >
                {/* Chat messages container */}
                <div
                  className={cn(
                    "flex-1 bg-card rounded-lg border border-border shadow-sm overflow-y-auto",
                    "transition-all duration-500 ease-in-out",
                    "h-[calc(100%-80px)] pb-20", // Fixed height calculation
                    messagesVisible
                      ? "messages-container-active"
                      : "messages-container-initial",
                    showFileSection && attachedFiles.length > 0
                      ? "messages-with-files"
                      : "", // Add extra padding when files are shown
                  )}
                >
                  <div className="p-4 space-y-4">
                    {messages.map((message) => (
                      <ChatMessage
                        key={message.id}
                        message={message}
                        onAbort={stop} // Pass the stop function directly
                        openReport={openReport}
                        closeReport={closeReport}
                        isActiveReport={activeReportId === message.id}
                        hasReport={Boolean(reportsMap[message.id])}
                        isGeneratingAnyReport={isGeneratingReport}
                      />
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </div>

                {/* Input area container - groups file previews, suggestions, and input together */}
                <div
                  className={cn(
                    "bg-card rounded-lg border border-border shadow-sm",
                    "transition-all duration-500 ease-in-out",
                    chatStarted
                      ? "input-container-active"
                      : "input-container-initial",
                  )}
                  style={{
                    transformOrigin: "center bottom",
                  }}
                >
                  {/* File previews */}
                  {attachedFiles.length > 0 && (
                    <div
                      className={cn(
                        "px-4 py-2 bg-peppermint-100 dark:bg-peppermint-900 rounded-t-lg border-b file-section", // Add the new file-section class
                        showFileSection
                          ? "opacity-100 max-h-[500px]"
                          : "opacity-0 max-h-0 py-0",
                      )}
                    >
                      <div className="flex flex-wrap gap-2">
                        {attachedFiles.map((file) => (
                          <FilePreview
                            key={file.id}
                            file={file}
                            onRemove={() => removeFile(file.id)}
                          />
                        ))}
                      </div>
                      <SuggestedMessages
                        files={attachedFiles}
                        onSelectSuggestion={(suggestion) =>
                          setInput(suggestion)
                        }
                        isLoading={suggestionsLoading}
                        suggestions={suggestions}
                      />
                    </div>
                  )}

                  {/* Textarea and buttons */}
                  <form
                    onSubmit={(e) => {
                      // Only proceed if there's input text or files attached
                      if (input.trim() || attachedFiles.length > 0) {
                        originalHandleSubmit(e);
                        // Hide file section after submission
                        setShowFileSection(false);
                      } else {
                        e.preventDefault();
                      }
                    }}
                    className="p-4"
                  >
                    <div className="relative">
                      <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask me anything about web vitals..."
                        className={cn(
                          "w-full p-4 rounded-xl resize-none",
                          "bg-background border border-border focus:border-peppermint-800 focus:ring-0",
                          "text-foreground placeholder:text-foreground outline-none transition-all",
                          chatStarted
                            ? "min-h-[60px] max-h-[200px]"
                            : "min-h-[100px]",
                          isLoading && "opacity-50 cursor-not-allowed",
                        )}
                        rows={chatStarted ? 2 : 3}
                        disabled={isLoading}
                      />

                      <div className="absolute right-4 bottom-4 flex gap-2 pointer-events-auto">
                        <input
                          type="file"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="hidden"
                          multiple
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => fileInputRef.current?.click()}
                          title="Attach file"
                          disabled={isLoading}
                        >
                          <Paperclip className="h-5 w-5" />
                        </Button>

                        {isLoading ? (
                          <Button
                            onClick={stop} // Use the stop function directly
                            variant="destructive"
                            title="Cancel"
                            size="icon"
                            disabled={false}
                          >
                            <X className="h-5 w-5" />
                          </Button>
                        ) : (
                          <Button
                            type="submit"
                            disabled={isLoading || !input.trim()}
                            variant="default"
                            title="Send message"
                            size="icon"
                          >
                            <Send className="h-5 w-5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </form>
                </div>
              </FileDropzone>
            </div>

            <div
              className={cn(
                "min-h-[calc(70vh-200px)]", // Use viewport height minus header space
                "max-h-[calc(90vh-200px)]", // Limit maximum height to avoid overflowing
              )}
            >
              {/* Right panel with data visualization or markdown report */}
              {panelContentType === "data" ? (
                <DataPanel
                  visible={showSidePanel && panelAnimationComplete}
                  onClose={() => setShowSidePanel(false)}
                  exiting={panelExiting}
                />
              ) : (
                <MarkdownReport
                  visible={showSidePanel && panelAnimationComplete}
                  onClose={() => {
                    setShowSidePanel(false);
                    setActiveReportId(null);
                  }}
                  exiting={panelExiting}
                  isGenerating={isGeneratingReport}
                  topic={reportTopic}
                  onComplete={handleReportComplete}
                  reportData={reportData}
                  onAbort={handleAbortReport} // Pass the updated abort handler
                  reportId={activeReportId}
                />
              )}
            </div>
          </div>
        </main>
      </div>
    </ResearchProvider>
  );
}
