"use client";
import { cn } from "@/lib/utils";
import { SimpleThemeToggle } from "./simple-theme-toggle";
import { useState } from "react";
import { useEffect } from "react";

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-all duration-300",
        scrolled
          ? "bg-black/25 backdrop-blur-md shadow-md py-2"
          : "bg-transparent py-4"
      )}
    >
      <div className="container mx-auto px-4 flex justify-between items-center">
        <span className="font-bold text-xl text-white">PerfAgent</span>
        <div className="flex items-center gap-4">
          <SimpleThemeToggle />
        </div>
      </div>
    </header>
  );
}
