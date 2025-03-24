"use client";

import "./landing.css";
import { useState, useEffect } from "react";
import { LowFpsPerformanceViz } from "@/components/landing-hero";
import { SimpleThemeToggle } from "@/components/simple-theme-toggle";
import { LandingBanner } from "@/components/landing-banner";
import { SignupNotification } from "@/components/signup-notification";

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? "bg-background/90 backdrop-blur-md shadow-md py-2"
            : "bg-transparent py-4"
        }`}
      >
        <div className="container mx-auto px-4 flex justify-between items-center">
          <span className="font-bold text-xl text-white">PerfAgent</span>
          <div className="flex items-center gap-4">
            <SimpleThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero section */}
      <section className="overflow-hidden">
        <LowFpsPerformanceViz />
      </section>

      {/* Features section */}
      <section
        id="features"
        className="py-20 bg-peppermint-50 dark:bg-background"
      >
        <LandingBanner />
      </section>

      {/* Signup notification section */}
      <section id="signup">
        <SignupNotification />
      </section>

      {/* Simple footer */}
      <footer className="bg-peppermint-50 dark:bg-background py-8 border-t border-border">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-sm text-foreground">
              © {new Date().getFullYear()} PerfAgent is part of PerfLab All
              rights reserved.
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
