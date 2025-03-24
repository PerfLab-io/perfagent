"use client";

import { useState, useEffect } from "react";
import { X, FileText, FileCode, FileImage, File } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilePreviewProps {
  file: {
    id: string;
    name: string;
    size: number;
    type: string;
  };
  onRemove: () => void;
}

export function FilePreview({ file, onRemove }: FilePreviewProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Delay to allow for animation
    const timer = setTimeout(() => {
      setVisible(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else return (bytes / 1048576).toFixed(1) + " MB";
  };

  const getFileIcon = () => {
    if (file.type.startsWith("image/"))
      return <FileImage className="h-4 w-4" />;
    if (file.name.endsWith(".go")) return <FileCode className="h-4 w-4" />;
    if (file.type.includes("text") || file.name.endsWith(".md"))
      return <FileText className="h-4 w-4" />;
    return <File className="h-4 w-4" />;
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 text-sm",
        "transition-all duration-300 ease-out",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4",
      )}
    >
      {getFileIcon()}
      <div className="flex-1 truncate max-w-[200px]">
        <div className="font-medium truncate">{file.name}</div>
        <div className="text-xs text-foreground">
          {formatFileSize(file.size)}
        </div>
      </div>
      <button
        onClick={onRemove}
        className="text-foreground hover:text-foreground transition-colors"
        aria-label="Remove file"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
