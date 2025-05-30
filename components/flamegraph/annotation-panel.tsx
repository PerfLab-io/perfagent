"use client"

import type { Annotation, FrameNode, ViewState } from "./types"
import { ArrowRight } from "lucide-react"

// Update the AnnotationPanelProps interface to include isEnabled prop
interface AnnotationPanelProps {
  annotations: Annotation[]
  selectedAnnotationId?: string
  onAnnotationClick: (annotation: Annotation) => void
  frameMap: Map<string, FrameNode>
  viewState: ViewState
  isEnabled: boolean // Add this prop to control enabled/disabled state
}

// Update the component to handle the disabled state
export function AnnotationPanel({
  annotations,
  selectedAnnotationId,
  onAnnotationClick,
  frameMap,
  viewState,
  isEnabled,
}: AnnotationPanelProps) {
  if (!annotations.length) return null

  // Helper function to check if an annotation is visible in the current view
  const isAnnotationVisible = (annotation: Annotation): boolean => {
    const { startTime, endTime } = viewState

    if (annotation.type === "highlight") {
      // Check if the highlight time range overlaps with the current view
      return annotation.endTime >= startTime && annotation.startTime <= endTime
    } else if (annotation.type === "link") {
      // Check if either of the linked frames are visible
      const fromFrame = frameMap.get(annotation.fromFrameId)
      const toFrame = frameMap.get(annotation.toFrameId)

      if (!fromFrame && !toFrame) return false

      // If we have at least one frame, check if it's in the visible range
      const fromVisible = fromFrame ? fromFrame.end >= startTime && fromFrame.start <= endTime : false
      const toVisible = toFrame ? toFrame.end >= startTime && toFrame.start <= endTime : false

      return fromVisible || toVisible
    } else if (annotation.type === "label") {
      // Check if the labeled frame is visible
      const frame = frameMap.get(annotation.frameId)
      if (!frame) return false

      return frame.end >= startTime && frame.start <= endTime
    }

    return false
  }

  // Apply disabled styling to the entire panel when not enabled
  const panelClassName = `w-full bg-white border ${
    isEnabled ? "border-perfagent-border" : "border-gray-200"
  } rounded-md mb-2 overflow-x-auto ${!isEnabled ? "opacity-60" : ""}`

  return (
    <div className={panelClassName}>
      <div className="flex items-start space-x-6 p-3 min-w-max">
        {annotations.map((annotation) => {
          const isSelected = selectedAnnotationId === annotation.id
          const isVisible = isAnnotationVisible(annotation)

          // Determine opacity based on visibility, selection, and enabled state
          let opacity = "opacity-25 hover:opacity-70"

          if (isEnabled) {
            opacity = isSelected
              ? "opacity-100"
              : isVisible
                ? "opacity-90 hover:opacity-100"
                : "opacity-25 hover:opacity-70"
          }

          // Determine cursor style based on enabled state
          const cursorStyle = isEnabled ? "cursor-pointer" : "cursor-not-allowed"

          // Handle click only if enabled
          const handleClick = isEnabled ? () => onAnnotationClick(annotation) : undefined

          // Render different annotation types
          if (annotation.type === "highlight") {
            return (
              <div
                key={annotation.id}
                className={`flex flex-col items-center ${cursorStyle} transition-opacity ${opacity}`}
                onClick={handleClick}
              >
                <div
                  className="text-white text-xs font-medium px-3 py-1 rounded-full whitespace-nowrap"
                  style={{
                    backgroundColor: "#f43f5e",
                  }}
                >
                  {Math.round(annotation.startTime)} - {Math.round(annotation.endTime)} ms
                </div>
                <span className="text-xs mt-1 font-medium text-perfagent-text">{annotation.label}</span>
              </div>
            )
          }

          if (annotation.type === "link") {
            // Extract frame names from IDs for display
            const fromName = annotation.fromFrameId.split("-")[2]
            const toName = annotation.toFrameId.split("-")[2]

            return (
              <div
                key={annotation.id}
                className={`flex flex-col items-center ${cursorStyle} transition-opacity ${opacity}`}
                onClick={handleClick}
              >
                <div className="flex items-center space-x-1">
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-gray-200 text-gray-800 whitespace-nowrap">
                    {fromName}
                  </span>
                  <ArrowRight className="h-3 w-3 text-gray-600" />
                  <span className="text-xs font-medium px-3 py-1 rounded-full bg-gray-200 text-gray-800 whitespace-nowrap">
                    {toName}
                  </span>
                </div>
              </div>
            )
          }

          if (annotation.type === "label") {
            // Extract frame name from ID for display
            const frameName = annotation.frameId.split("-")[2]

            return (
              <div
                key={annotation.id}
                className={`flex flex-col items-center ${cursorStyle} transition-opacity ${opacity}`}
                onClick={handleClick}
              >
                <div className="text-xs font-medium px-3 py-1 rounded-full bg-gray-200 text-gray-800 whitespace-nowrap">
                  {frameName}
                </div>
                <span className="text-xs mt-1 font-medium text-perfagent-text">{annotation.label}</span>
              </div>
            )
          }

          return null
        })}
      </div>
    </div>
  )
}
