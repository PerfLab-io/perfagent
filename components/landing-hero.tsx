"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Types for the component
 */
type VitalScores = {
  inp: boolean;
  cls: boolean;
};

/**
 * Animation utility functions
 */
export const AnimationUtils = {
  /**
   * Types text character by character with a typewriter effect
   * @param element - The HTML element to type text into
   * @param text - The text to type
   * @param index - Current character index
   * @param callback - Optional callback after typing is complete
   */
  typeText: (
    element: HTMLElement,
    text: string,
    index: number,
    callback?: () => void
  ) => {
    if (index < text.length) {
      element.textContent += text.charAt(index);
      // Random delay between characters for authentic terminal feel
      setTimeout(
        () => {
          AnimationUtils.typeText(element, text, index + 1, callback);
        },
        30 + Math.random() * 70
      );
    } else {
      element.classList.add("typed");
      if (callback) callback();
    }
  },

  /**
   * Creates and displays a thinking animation (animated dots)
   * @param element - The container element
   * @param callback - Function to call when animation completes
   */
  showThinkingAnimation: (element: HTMLElement, callback: () => void) => {
    element.innerHTML = "";
    const dotsContainer = document.createElement("span");
    dotsContainer.className = "thinking-dots text-peppermint-300";

    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("span");
      dot.className = "dot";
      dot.textContent = ".";
      dotsContainer.appendChild(dot);
    }

    element.appendChild(dotsContainer);
    setTimeout(callback, 500); // Call callback after animation plays
  },

  /**
   * Creates grid lines programmatically for animation
   * @param gridEl - The grid container element
   * @param containerWidth - Width of the container
   */
  createGridLines: (gridEl: HTMLElement, containerWidth: number) => {
    // Clear any existing background
    gridEl.style.backgroundImage = "none";
    gridEl.style.opacity = "1";

    // Create horizontal grid lines
    for (let i = 0; i <= 27; i++) {
      const line = document.createElement("div");
      line.className = "absolute left-0 right-0 grid-line-h";
      line.style.height = "1px";
      line.style.top = `${i * 20}px`;
      line.style.backgroundColor = "rgba(60, 180, 108, 0.1)";
      line.style.transform = "scaleX(0)";
      line.style.transformOrigin = "left";
      gridEl.appendChild(line);

      // Animate each line with a delay based on position
      setTimeout(
        () => {
          line.style.transition = "transform 100ms steps(3)";
          line.style.transform = "scaleX(1)";
        },
        100 + i * 15
      );
    }

    // Create vertical grid lines with a slight delay
    setTimeout(() => {
      // Calculate how many lines we need (one every 20px)
      const numLines = Math.ceil(containerWidth / 20) + 5; // Add extra lines to ensure full coverage

      for (let i = 0; i <= numLines; i++) {
        const line = document.createElement("div");
        line.className = "absolute top-0 bottom-0 grid-line-v";
        line.style.width = "1px";
        line.style.left = `${i * 20}px`;
        line.style.backgroundColor = "rgba(60, 180, 108, 0.1)";
        line.style.transform = "scaleY(0)";
        line.style.transformOrigin = "top";
        gridEl.appendChild(line);

        // Animate each line with a delay based on position
        setTimeout(() => {
          line.style.transition = "transform 100ms steps(3)";
          line.style.transform = "scaleY(1)";
        }, i * 15);
      }
    }, 300);
  },
};

/**
 * LowFpsPerformanceViz Component
 * A visualization dashboard for web performance metrics focusing on core web vitals.
 * Includes animated terminal output, interactive SVG visualization, and dynamic color coding.
 */
export function LowFpsPerformanceViz() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Refs for nodes that need to change color
  const inpNodeRef = useRef<SVGCircleElement>(null);
  const inpConnectionRef = useRef<SVGLineElement>(null);
  const clsNodeRef = useRef<SVGCircleElement>(null);
  const clsConnectionRef = useRef<SVGLineElement>(null);

  // Track which vital scores have been revealed
  const [vitalScoresRevealed, setVitalScoresRevealed] = useState<VitalScores>({
    inp: false,
    cls: false,
  });

  // Create a ref for event listeners to properly clean them up later
  const eventListenersRef = useRef<
    { element: Element; eventType: string; handler: EventListener }[]
  >([]);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    // Initialize the animation sequence
    initializeAnimations();

    // Start terminal text typing effect
    startTerminalTyping();

    // Set up hover effect listeners
    setupHoverEffects();

    return () => {
      // Clean up hover effect listeners
      cleanupHoverEffects();
    };
  }, []);

  /**
   * Sets up event listeners for interactive element hover effects
   */
  const setupHoverEffects = () => {
    const interactiveElements = document.querySelectorAll("[data-interactive]");

    // Clear any existing listeners
    cleanupHoverEffects();

    interactiveElements.forEach((el) => {
      const dataId = el.getAttribute("data-id");

      if (dataId) {
        const handleElementHover = (e: Event) => {
          // Only highlight connected elements with the same data-connected attribute as this element's data-id
          const connectedElements = document.querySelectorAll(
            `[data-connected="${dataId}"]`
          );
          connectedElements.forEach((connectedEl) => {
            if (
              connectedEl instanceof HTMLElement ||
              connectedEl instanceof SVGElement
            ) {
              connectedEl.classList.add("highlight");

              // Remove highlight after animation
              setTimeout(() => {
                connectedEl.classList.remove("highlight");
              }, 1500);
            }
          });
        };

        el.addEventListener("mouseenter", handleElementHover);

        // Store the listener reference for cleanup
        eventListenersRef.current.push({
          element: el,
          eventType: "mouseenter",
          handler: handleElementHover,
        });
      }
    });
  };

  /**
   * Cleans up event listeners for hover effects
   */
  const cleanupHoverEffects = () => {
    // Remove all stored event listeners
    eventListenersRef.current.forEach(({ element, eventType, handler }) => {
      element.removeEventListener(eventType, handler);
    });

    // Clear the listeners array
    eventListenersRef.current = [];
  };

  /**
   * Initializes the animation sequence for the visualization
   */
  const initializeAnimations = () => {
    // Reset all animations
    const allElements = document.querySelectorAll("[data-anim]");
    allElements.forEach((el) => {
      if (el instanceof HTMLElement || el instanceof SVGElement) {
        el.style.opacity = "0";
      }
    });

    // Add the boot up sequence
    startBootupSequence();
  };

  /**
   * Starts the boot up animation sequence
   */
  const startBootupSequence = () => {
    // Create and append the boot up text element
    const bootupTextEl = document.createElement("div");
    bootupTextEl.className =
      "absolute inset-0 flex items-center justify-center z-10 font-mono text-xl text-peppermint-500 font-bold tracking-widest boot-up-text";
    bootupTextEl.textContent = "BOOTING UP...";

    // Add a grid wrapper to hold both the grid and the bootup text
    const gridWrapper = document.querySelector("[data-grid-wrapper]");
    if (gridWrapper) {
      gridWrapper.appendChild(bootupTextEl);
      gridWrapper.classList.add("opacity-100"); // Make grid wrapper visible immediately

      // Get the grid element and start animating grid lines
      const gridEl = document.querySelector('[data-anim="grid"]');
      if (gridEl instanceof HTMLElement) {
        const containerWidth = gridEl.clientWidth || 600;
        AnimationUtils.createGridLines(gridEl, containerWidth);

        // Remove boot up text after animation completes
        setTimeout(() => {
          bootupTextEl.classList.add("fade-out");

          setTimeout(() => {
            try {
              gridWrapper.removeChild(bootupTextEl);
            } catch (e) {
              // Handle case where element might already be removed
            }

            // Show the SVG visualization after a short delay
            setTimeout(() => {
              const svg = svgRef.current;
              if (svg) {
                svg.style.opacity = "1";
                svg.style.transition = "opacity 0.3s ease-in-out";
              }

              // Continue with the remaining animations
              startRemainingAnimations();
            }, 200);
          }, 200); // Fade out duration
        }, 600); // Boot up visible duration
      } else {
        // Fallback if grid element not found
        startRemainingAnimations();
      }
    } else {
      // Fallback if grid wrapper not found
      startRemainingAnimations();
    }
  };

  /**
   * Continues the animation sequence after boot up animation
   */
  const startRemainingAnimations = () => {
    // Start data points animation
    setTimeout(() => {
      const dataElements = document.querySelectorAll('[data-anim="data"]');
      dataElements.forEach((el, index) => {
        if (el instanceof HTMLElement || el instanceof SVGElement) {
          setTimeout(() => {
            el.style.opacity = "1";
            el.classList.add("animated");
          }, index * 150);
        }
      });
    }, 300);

    // Start connection lines animation
    setTimeout(() => {
      const lineElements = document.querySelectorAll('[data-anim="line"]');
      lineElements.forEach((el, index) => {
        if (el instanceof HTMLElement || el instanceof SVGElement) {
          setTimeout(() => {
            el.style.opacity = "1";
            el.classList.add("animated");
          }, index * 200);
        }
      });
    }, 1300);

    // Final elements and glow effects
    setTimeout(() => {
      const finalElements = document.querySelectorAll('[data-anim="final"]');
      finalElements.forEach((el) => {
        if (el instanceof HTMLElement || el instanceof SVGElement) {
          el.style.opacity = "1";
          el.classList.add("animated");
        }
      });
    }, 3800);

    // Add the optimization target as the very last element
    setTimeout(() => {
      const targetElement = document.querySelector(
        '[data-anim="final-target"]'
      );
      if (targetElement instanceof HTMLElement) {
        targetElement.style.opacity = "1";
        targetElement.classList.add("animated");
      }
    }, 5300);
  };

  /**
   * Starts the terminal text typing animation sequence
   */
  const startTerminalTyping = () => {
    // Get all metrics lines first
    const terminalLines = document.querySelectorAll(
      "[data-terminal-line]:not([data-command-line])"
    );
    const vitalMetrics = document.querySelectorAll("[data-vital-metric]");
    const vitalScores = document.querySelectorAll("[data-vital-score]");
    const sectionHeaders = document.querySelectorAll("[data-section-header]");
    const commandLine = document.querySelector("[data-command-line]");
    const optimizationTarget = document.querySelector(
      '[data-anim="final"][class*="bottom-4"]'
    );

    // Show the PERFORMANCE.METRICS header first
    const metricsHeader = document.querySelector(
      '[data-section-header="metrics"]'
    );
    if (metricsHeader instanceof HTMLElement) {
      metricsHeader.style.opacity = "1";
    }

    let currentLineIndex = 0;

    // Function to animate the next terminal line
    const animateNextLine = () => {
      if (currentLineIndex >= terminalLines.length) {
        // Once all terminal lines are done, show the CORE.WEB.VITALS header
        showVitalsHeader();
        return;
      }

      const line = terminalLines[currentLineIndex];
      if (line instanceof HTMLElement) {
        line.style.opacity = "1"; // Show the line before animating
        animateTerminalLine(line, () => {
          currentLineIndex++;
          setTimeout(animateNextLine, 300);
        });
      }
    };

    // Start the animation sequence after a small delay
    setTimeout(animateNextLine, 1000);
  };

  /**
   * Animates a single terminal line
   */
  const animateTerminalLine = (line: HTMLElement, callback: () => void) => {
    const text = line.getAttribute("data-text") || "";

    // Check if the line starts with ">>"
    if (text.startsWith(">>")) {
      // Split the text into prefix and rest
      const prefix = ">>";
      const rest = text.substring(2);

      // Show prefix immediately
      line.textContent = prefix;

      // Wait before typing the rest
      setTimeout(() => {
        // Check if this is a metric line with a colon
        if (rest.includes(":") && !rest.includes(">>")) {
          animateMetricLine(line, rest, callback);
        } else {
          // For lines without a colon or with ">>", proceed as before
          AnimationUtils.typeText(line, rest, 0, callback);
        }
      }, 400);
    } else {
      // For lines without ">>", proceed as before
      line.textContent = "";
      AnimationUtils.typeText(line, text, 0, callback);
    }
  };

  /**
   * Animates a metric line with a "thinking" effect for the value
   */
  const animateMetricLine = (
    line: HTMLElement,
    text: string,
    callback: () => void
  ) => {
    // Split at the colon to separate the metric name from the value
    const parts = text.split(":");
    const metricPart = parts[0] + ": "; // Add a space after the colon
    const valuePart = parts[1].trim(); // Trim any leading/trailing spaces from the value

    // Type out the metric part first
    AnimationUtils.typeText(line, metricPart, 0, () => {
      // After metric part is typed, show thinking animation for the value
      const thinkingSpan = document.createElement("span");
      thinkingSpan.className = "thinking-dots text-peppermint-300";

      for (let i = 0; i < 3; i++) {
        const dot = document.createElement("span");
        dot.className = "dot";
        dot.textContent = ".";
        thinkingSpan.appendChild(dot);
      }

      line.appendChild(thinkingSpan);

      // After a short delay, replace thinking animation with the actual value
      setTimeout(() => {
        // Remove the thinking animation
        line.removeChild(thinkingSpan);
        // Make the value appear instantly
        line.textContent += valuePart;
        callback();
      }, 500);
    });
  };

  /**
   * Shows the vitals header and starts animating vital metrics
   */
  const showVitalsHeader = () => {
    const vitalsHeader = document.querySelector(
      '[data-section-header="vitals"]'
    );
    if (vitalsHeader instanceof HTMLElement) {
      vitalsHeader.style.opacity = "1";
      // Start animating the vital metrics after a delay
      setTimeout(animateVitals, 500);
    }
  };

  /**
   * Animates vital metrics one by one
   */
  const animateVitals = () => {
    const vitalMetrics = document.querySelectorAll("[data-vital-metric]");
    const vitalScores = document.querySelectorAll("[data-vital-score]");
    let vitalIndex = 0;

    const animateNextVital = () => {
      if (vitalIndex >= vitalMetrics.length) {
        // After all vitals are done, show the CHAT.MODE header and command
        showChatModeSection();
        return;
      }

      // First show the metric name
      const metricEl = vitalMetrics[vitalIndex];
      if (metricEl instanceof HTMLElement) {
        requestAnimationFrame(() => {
          metricEl.style.opacity = "1";

          requestAnimationFrame(() => {
            setTimeout(() => {
              // Get the metric name to identify which vital we're animating
              const metricName = metricEl.textContent
                ?.replace(":", "")
                .toLowerCase()
                .trim();

              // Then show thinking animation in the score area
              const scoreEl = vitalScores[vitalIndex];
              if (scoreEl instanceof HTMLElement) {
                const scoreContainer = scoreEl.parentElement;
                if (scoreContainer instanceof HTMLElement) {
                  requestAnimationFrame(() => {
                    AnimationUtils.showThinkingAnimation(scoreContainer, () => {
                      // Clear the thinking animation and show the score
                      scoreContainer.textContent = "";
                      scoreContainer.appendChild(scoreEl);
                      scoreEl.style.opacity = "1";

                      // Update node colors based on which vital is being revealed
                      updateNodeColors(metricName);

                      // Move to next vital after a delay
                      vitalIndex++;
                      setTimeout(animateNextVital, 500);
                    });
                  });
                }
              }
            }, 250);
          });
        });
      }
    };

    animateNextVital();
  };

  /**
   * Updates node colors based on which vital metric is being revealed
   */
  const updateNodeColors = (metricName?: string) => {
    if (
      metricName === "inp" &&
      inpNodeRef.current &&
      inpConnectionRef.current
    ) {
      // Change INP node color to red
      inpNodeRef.current.setAttribute("stroke", "#e11d48"); // rose-500 color
      inpNodeRef.current.setAttribute("fill", "url(#dotPatternRed)");

      // Change connection line color to red
      inpConnectionRef.current.setAttribute("stroke", "#e11d48");
      inpConnectionRef.current.setAttribute("stroke-opacity", "0.7");

      // Add a pulsing animation to highlight it
      inpNodeRef.current.classList.add("highlight-target");

      // Update state to track that INP score has been revealed
      setVitalScoresRevealed((prev) => ({ ...prev, inp: true }));
    } else if (
      metricName === "cls" &&
      clsNodeRef.current &&
      clsConnectionRef.current
    ) {
      // Change CLS node color to merino (amber)
      clsNodeRef.current.setAttribute("stroke", "#c69c71"); // merino color
      clsNodeRef.current.setAttribute("fill", "url(#dotPatternMerino)");

      // Change connection line color to merino
      clsConnectionRef.current.setAttribute("stroke", "#c69c71");
      clsConnectionRef.current.setAttribute("stroke-opacity", "0.7");

      // Add a pulsing animation to highlight it
      clsNodeRef.current.classList.add("highlight-target-secondary");

      // Update state to track that CLS score has been revealed
      setVitalScoresRevealed((prev) => ({ ...prev, cls: true }));
    }
  };

  /**
   * Shows the chat mode section and animates command lines
   */
  const showChatModeSection = () => {
    const commandHeader = document.querySelector(
      '[data-section-header="chat"]'
    );
    if (commandHeader instanceof HTMLElement) {
      commandHeader.style.opacity = "1";

      // Show command lines after a delay
      setTimeout(() => {
        const commandLines = document.querySelectorAll("[data-command-line]");
        let lineIndex = 0;

        const animateCommandLine = () => {
          if (lineIndex >= commandLines.length) {
            // After command lines are typed, show the YES/NO line
            showYesNoLine();
            return;
          }

          const line = commandLines[lineIndex];
          if (line instanceof HTMLElement) {
            line.style.opacity = "1";
            const text = line.getAttribute("data-text") || "";
            line.textContent = "";

            AnimationUtils.typeText(line, text, 0, () => {
              lineIndex++;
              setTimeout(animateCommandLine, 300);
            });
          }
        };

        animateCommandLine();
      }, 500);
    }
  };

  /**
   * Shows the YES/NO line and optimization target
   */
  const showYesNoLine = () => {
    const yesNoLine = document.querySelector(
      ".terminal-line.flex.items-center"
    );
    const optimizationTarget = document.querySelector(
      '[data-anim="final"][class*="bottom-4"]'
    );

    if (yesNoLine instanceof HTMLElement) {
      yesNoLine.style.opacity = "1";

      // Show optimization target after all lines are shown
      setTimeout(() => {
        if (optimizationTarget instanceof HTMLElement) {
          optimizationTarget.style.opacity = "1";
        }
      }, 800);
    }
  };

  return (
    <div className="w-full min-h-[600px] flex items-center justify-center bg-peppermint-950 p-8 pt-20 relative overflow-hidden">
      {/* Scan lines effect */}
      <div className="absolute inset-0 scan-lines pointer-events-none"></div>

      {/* Main container */}
      <div
        ref={containerRef}
        className="w-full max-w-5xl bg-peppermint-950 rounded-lg shadow-2xl overflow-hidden border-2 border-dotted border-peppermint-700 relative transition-all duration-1000"
      >
        {/* Header bar */}
        <div className="h-8 w-full bg-peppermint-900 border-b border-dotted border-peppermint-400 flex items-center px-3 z-20 relative">
          <svg className="w-3 h-3 mr-2 glow-merino" viewBox="0 0 12 12">
            <circle cx="6" cy="6" r="6" fill="url(#dotPatternWindowControl)" />
          </svg>
          <div className="text-peppermint-300 text-xs font-mono tracking-wider">
            PERFAGENT - PERFORMANCE ANALYSIS
          </div>
        </div>

        <div className="relative w-full h-[550px] overflow-hidden flex">
          {/* Left sidebar - Terminal */}
          <div className="w-2/3 md:w-1/4 lg:w-1/4 h-full bg-peppermint-950 border-r border-dotted border-peppermint-700 p-3 font-mono text-xs overflow-hidden">
            <div
              className="text-peppermint-400 mb-2 font-bold"
              data-section-header="metrics"
              style={{ opacity: 0 }}
            >
              PERFORMANCE.METRICS
            </div>

            <div
              className="terminal-line text-peppermint-300"
              data-terminal-line
              data-text=">> Analyzing page load..."
              style={{ opacity: 0 }}
            ></div>
            <div
              className="terminal-line text-peppermint-300 mt-1"
              data-terminal-line
              data-text=">> Measuring LCP: 2.4s"
              style={{ opacity: 0 }}
            ></div>
            <div
              className="terminal-line text-peppermint-300 mt-1"
              data-terminal-line
              data-text=">> Measuring INP: 550ms"
              style={{ opacity: 0 }}
            ></div>
            <div
              className="terminal-line text-peppermint-300 mt-1"
              data-terminal-line
              data-text=">> Measuring CLS: 0.12"
              style={{ opacity: 0 }}
            ></div>
            <div
              className="terminal-line text-peppermint-300 mt-1"
              data-terminal-line
              data-text=">> Measuring TTFB: 0.7s"
              style={{ opacity: 0 }}
            ></div>
            <div
              className="terminal-line text-peppermint-300 mt-1"
              data-terminal-line
              data-text=">> Measuring FCP: 1.2s"
              style={{ opacity: 0 }}
            ></div>
            <div
              className="terminal-line text-peppermint-300 mt-1"
              data-terminal-line
              data-text=">> Analysis complete."
              style={{ opacity: 0 }}
            ></div>

            <div
              className="mt-4 text-peppermint-400 font-bold"
              data-section-header="vitals"
              style={{ opacity: 0 }}
            >
              CORE.WEB.VITALS
            </div>
            <div className="grid grid-cols-2 gap-1 mt-2">
              <div className="text-peppermint-300 vital-container">
                <span data-vital-metric style={{ opacity: 0 }}>
                  LCP:
                </span>
              </div>
              <div className="vital-container">
                <span
                  data-vital-score
                  className="text-peppermint-400 font-bold"
                  style={{ opacity: 0 }}
                >
                  Good
                </span>
              </div>
              <div className="text-peppermint-300 vital-container">
                <span data-vital-metric style={{ opacity: 0 }}>
                  INP:
                </span>
              </div>
              <div className="vital-container">
                <span
                  data-vital-score
                  className="text-rose-500 font-bold"
                  style={{ opacity: 0 }}
                >
                  Poor
                </span>
              </div>
              <div className="text-peppermint-300 vital-container">
                <span data-vital-metric style={{ opacity: 0 }}>
                  CLS:
                </span>
              </div>
              <div className="vital-container">
                <span
                  data-vital-score
                  className="text-merino-500 font-bold"
                  style={{ opacity: 0 }}
                >
                  Needs Improvement
                </span>
              </div>
            </div>

            <div
              className="mt-4 text-peppermint-400 font-bold"
              data-section-header="chat"
              style={{ opacity: 0 }}
            >
              CHAT.MODE
            </div>
            <div
              className="terminal-line text-peppermint-300 mt-2"
              data-terminal-line
              data-command-line
              data-text=">> Optimizations identified..."
              style={{ opacity: 0 }}
            ></div>
            <div
              className="terminal-line text-peppermint-300 mt-1"
              data-terminal-line
              data-command-line
              data-text=">> Proceed?"
              style={{ opacity: 0 }}
            ></div>
            <div
              className="terminal-line text-peppermint-300 mt-1 flex items-center"
              style={{ opacity: 0 }}
            >
              <span className="mr-1">&gt;&gt;</span>
              <span className="inline-block px-2 py-0.5 bg-peppermint-900 border border-peppermint-500 text-peppermint-300 cursor-blink">
                YES
              </span>
              <span className="mx-2">|</span>
              <span>NO</span>
            </div>
          </div>

          {/* Main visualization area */}
          <div className="w-3/4 h-full relative">
            {/* Grid background */}
            <div className="absolute inset-0" data-grid-wrapper>
              <div
                ref={gridRef}
                className="absolute inset-0"
                style={{
                  opacity: "0",
                }}
                data-anim="grid"
              ></div>
            </div>

            {/* SVG Visualization */}
            <svg
              ref={svgRef}
              className="absolute inset-0 w-full h-full"
              viewBox="0 0 600 550"
              xmlns="http://www.w3.org/2000/svg"
              style={{ opacity: 0 }}
            >
              <defs>
                {/* Dot patterns */}
                <pattern
                  id="dotPatternPeppermint"
                  patternUnits="userSpaceOnUse"
                  width="4"
                  height="4"
                >
                  <rect width="4" height="4" fill="#0a2824" />
                  <rect width="2" height="2" fill="#67cb87" opacity="0.55" />
                </pattern>

                <pattern
                  id="dotPatternMerino"
                  patternUnits="userSpaceOnUse"
                  width="4"
                  height="4"
                >
                  <rect width="4" height="4" fill="#0a2824" />
                  <rect width="2" height="2" fill="#c69c71" opacity="0.45" />
                </pattern>

                {/* Dense dot patterns */}
                <pattern
                  id="denseDotPatternPeppermint"
                  patternUnits="userSpaceOnUse"
                  width="4"
                  height="4"
                >
                  <rect width="4" height="4" fill="#071d1a" />
                  <rect width="3" height="3" fill="#2d9561" opacity="0.55" />
                </pattern>

                <pattern
                  id="denseDotPatternMerino"
                  patternUnits="userSpaceOnUse"
                  width="4"
                  height="4"
                >
                  <rect width="4" height="4" fill="#0a2824" />
                  <rect width="3" height="3" fill="#c69c71" opacity="0.45" />
                </pattern>

                {/* Diagonal Line Pattern - Window Control */}
                <pattern
                  id="dotPatternWindowControl"
                  patternUnits="userSpaceOnUse"
                  width="4"
                  height="4"
                  patternTransform="rotate(45)"
                >
                  <rect width="4" height="4" fill="#0d312d" />
                  <line
                    x1="0"
                    y1="1"
                    x2="4"
                    y2="1"
                    stroke="#c69c71"
                    strokeWidth="1"
                  />
                  <line
                    x1="0"
                    y1="3"
                    x2="4"
                    y2="3"
                    stroke="#c69c71"
                    strokeWidth="1"
                  />
                </pattern>

                {/* Red dot pattern for INP */}
                <pattern
                  id="dotPatternRed"
                  patternUnits="userSpaceOnUse"
                  width="4"
                  height="4"
                >
                  <rect width="4" height="4" fill="#0a1414" />
                  <rect width="2" height="2" fill="#e11d48" opacity="0.55" />
                </pattern>
              </defs>

              {/* Central data hub - Performance Score */}
              <circle
                cx="300"
                cy="275"
                r="40"
                fill="url(#dotPatternPeppermint)"
                stroke="#67cb87"
                strokeWidth="2"
                strokeDasharray="4,2"
                data-anim="data"
                data-interactive
                data-id="central"
              />
              <text
                x="300"
                y="275"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#f3ece1"
                fontFamily="monospace"
                fontSize="16"
                fontWeight="bold"
                data-anim="data"
                style={{
                  paintOrder: "stroke",
                  stroke: "#0a2824",
                  strokeWidth: "1px",
                }}
              >
                75
              </text>
              <text
                x="300"
                y="295"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#f3ece1"
                fontFamily="monospace"
                fontSize="8"
                fontWeight="bold"
                data-anim="data"
              >
                SCORE
              </text>

              {/* Data nodes - Core Web Vitals */}
              <circle
                cx="150"
                cy="150"
                r="25"
                fill="url(#dotPatternPeppermint)"
                stroke="#67cb87"
                strokeWidth="2"
                strokeDasharray="4,2"
                data-anim="data"
                data-interactive
                data-id="lcp"
              />
              <text
                x="150"
                y="150"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#f3ece1"
                fontFamily="monospace"
                fontSize="10"
                fontWeight="bold"
                data-anim="data"
                style={{
                  paintOrder: "stroke",
                  stroke: "#0a2824",
                  strokeWidth: "1px",
                }}
              >
                LCP
              </text>

              <circle
                cx="450"
                cy="150"
                r="25"
                fill="url(#dotPatternPeppermint)"
                stroke="#67cb87"
                strokeWidth="2"
                strokeDasharray="4,2"
                data-anim="data"
                data-interactive
                data-id="inp"
                ref={inpNodeRef}
              />
              <text
                x="450"
                y="150"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#f3ece1"
                fontFamily="monospace"
                fontSize="10"
                fontWeight="bold"
                data-anim="data"
                style={{
                  paintOrder: "stroke",
                  stroke: "#0a2824",
                  strokeWidth: "1px",
                }}
              >
                INP
              </text>

              <circle
                cx="150"
                cy="400"
                r="25"
                fill="url(#dotPatternPeppermint)"
                stroke="#67cb87"
                strokeWidth="2"
                strokeDasharray="4,2"
                data-anim="data"
                data-interactive
                data-id="fcp"
              />
              <text
                x="150"
                y="400"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#f3ece1"
                fontFamily="monospace"
                fontSize="10"
                fontWeight="bold"
                data-anim="data"
                style={{
                  paintOrder: "stroke",
                  stroke: "#0a2824",
                  strokeWidth: "1px",
                }}
              >
                FCP
              </text>

              <circle
                cx="450"
                cy="400"
                r="25"
                fill="url(#dotPatternPeppermint)"
                stroke="#67cb87"
                strokeWidth="2"
                strokeDasharray="4,2"
                data-anim="data"
                data-interactive
                data-id="cls"
                ref={clsNodeRef}
              />
              <text
                x="450"
                y="400"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#f3ece1"
                fontFamily="monospace"
                fontSize="10"
                fontWeight="bold"
                data-anim="data"
                style={{
                  paintOrder: "stroke",
                  stroke: "#0a2824",
                  strokeWidth: "1px",
                }}
              >
                CLS
              </text>

              {/* Data nodes - Secondary Metrics */}
              <circle
                cx="175"
                cy="275"
                r="15"
                fill="url(#dotPatternMerino)"
                stroke="#c69c71"
                strokeWidth="2"
                strokeDasharray="4,2"
                data-anim="data"
                data-interactive
                data-id="ttfb"
              />
              <text
                x="175"
                y="275"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#f3ece1"
                fontFamily="monospace"
                fontSize="8"
                fontWeight="bold"
                data-anim="data"
              >
                TTFB
              </text>

              <circle
                cx="400"
                cy="240"
                r="15"
                fill="url(#dotPatternMerino)"
                stroke="#c69c71"
                strokeWidth="2"
                strokeDasharray="4,2"
                data-anim="data"
                data-interactive
                data-id="loaf"
              />
              <text
                x="400"
                y="240"
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#f3ece1"
                fontFamily="monospace"
                fontSize="8"
                fontWeight="bold"
                data-anim="data"
              >
                LoAF
              </text>

              {/* Connection lines - Primary to Central */}
              <line
                x1="172"
                y1="165"
                x2="271"
                y2="242"
                stroke="#67cb87"
                strokeWidth="2"
                strokeDasharray="4,2"
                className="data-line-low-fps"
                data-anim="line"
                data-connected="lcp"
                opacity="0.45"
              />
              <line
                x1="428"
                y1="165"
                x2="329"
                y2="242"
                stroke="#67cb87"
                strokeWidth="2"
                strokeDasharray="4,2"
                className="data-line-low-fps"
                data-anim="line"
                data-connected="inp"
                opacity="0.45"
                ref={inpConnectionRef}
              />
              <line
                x1="172"
                y1="385"
                x2="271"
                y2="308"
                stroke="#67cb87"
                strokeWidth="2"
                strokeDasharray="4,2"
                className="data-line-low-fps"
                data-anim="line"
                data-connected="fcp"
                opacity="0.45"
              />
              <line
                x1="428"
                y1="385"
                x2="329"
                y2="308"
                stroke="#67cb87"
                strokeWidth="2"
                strokeDasharray="4,2"
                className="data-line-low-fps"
                data-anim="line"
                data-connected="cls"
                opacity="0.45"
                ref={clsConnectionRef}
              />

              {/* New connection lines for TTFB to LCP, FCP, and center score */}
              <line
                x1="190"
                y1="275"
                x2="258"
                y2="275"
                stroke="#c69c71"
                strokeWidth="1.5"
                strokeDasharray="4,2"
                className="data-line-low-fps"
                data-anim="line"
                data-connected="ttfb"
                opacity="0.45"
              />
              <line
                x1="175"
                y1="260"
                x2="172"
                y2="165"
                stroke="#c69c71"
                strokeWidth="1.5"
                strokeDasharray="4,2"
                className="data-line-low-fps"
                data-anim="line"
                data-connected="ttfb"
                opacity="0.45"
              />
              <line
                x1="175"
                y1="290"
                x2="172"
                y2="385"
                stroke="#c69c71"
                strokeWidth="1.5"
                strokeDasharray="4,2"
                className="data-line-low-fps"
                data-anim="line"
                data-connected="ttfb"
                opacity="0.45"
              />

              {/* Connection lines - Secondary to Primary */}
              <line
                x1="413"
                y1="227"
                x2="429"
                y2="168"
                stroke="#c69c71"
                strokeWidth="1.5"
                strokeDasharray="4,2"
                className="data-line-low-fps"
                data-anim="line"
                data-connected="loaf"
                opacity="0.45"
              />

              {/* Connection lines - Secondary to Central */}
              <line
                x1="386"
                y1="243"
                x2="333"
                y2="244"
                stroke="#c69c71"
                strokeWidth="1.5"
                strokeDasharray="4,2"
                className="data-line-low-fps"
                data-anim="line"
                data-connected="loaf"
                opacity="0.45"
              />

              {/* Binary/Hex data stream */}
              <text
                x="596"
                y="530"
                fill="#c69c71"
                fontSize="8"
                fontFamily="monospace"
                className="binary-stream-low-fps"
                textAnchor="end"
                data-anim="final"
              >
                DOM:1.8s LOAD:4.2s PAINT:1.5s RENDER:2.1s
              </text>
            </svg>

            {/* Overlay UI elements */}
            <div
              className="absolute top-4 right-4 font-mono text-xs text-peppermint-400 bg-peppermint-950/80 border border-dashed border-peppermint-500 p-2 opacity-0 transition-opacity duration-1000"
              style={{ borderSpacing: "2px" }}
              data-anim="final"
            >
              PERFORMANCE ANALYSIS
            </div>
          </div>
        </div>
      </div>

      {/* Add the CSS for animations */}
      <style jsx>{`
        /* Scan lines effect */
        .scan-lines {
          background: linear-gradient(
            to bottom,
            transparent 50%,
            rgba(60, 180, 108, 0.03) 50%
          );
          background-size: 100% 4px;
          z-index: 100;
        }

        /* Terminal cursor */
        .cursor {
          animation: blink 1s steps(1) infinite;
          color: #67cb87;
        }

        @keyframes blink {
          0%,
          49% {
            opacity: 1;
          }
          50%,
          100% {
            opacity: 0;
          }
        }

        /* Data line animation */
        .data-line-low-fps {
          stroke-dashoffset: 1000;
          stroke-dasharray: 1000;
          animation: drawLineLowFps 2s steps(10) forwards;
        }

        @keyframes drawLineLowFps {
          to {
            stroke-dashoffset: 0;
          }
        }

        /* Highlight effect */
        .highlight {
          filter: brightness(1.5) !important;
          stroke-width: 3px !important;
          transition: all 0.3s steps(3) ease-in-out;
        }

        /* Binary stream animation */
        .binary-stream-low-fps {
          opacity: 0.7;
          animation: fadeInOutLowFps 4s steps(8) infinite;
        }

        @keyframes fadeInOutLowFps {
          0%,
          100% {
            opacity: 0.3;
          }
          50% {
            opacity: 0.7;
          }
        }

        /* Animation states */
        [data-anim] {
          opacity: 0;
          transition: opacity 0.8s steps(4) ease-in-out;
        }

        [data-anim].animated {
          opacity: 1;
        }

        /* Ensure all text elements have high z-index */
        text {
          position: relative;
          z-index: 10;
        }

        /* Thinking animation */
        .thinking-dots {
          display: inline-block;
        }

        .dot {
          display: inline-block;
        }

        /* Animation for vital metrics */
        [data-vital-metric],
        [data-vital-score] {
          transition: opacity 0.1s steps(1);
        }

        .vital-container {
          min-height: 1.5em;
        }

        /* Target highlight animation for INP */
        .highlight-target {
          animation: pulseTarget 2s ease-in-out infinite !important;
          filter: none !important;
        }

        @keyframes pulseTarget {
          0%,
          100% {
            stroke-width: 2px;
            filter: drop-shadow(0 0 0px #e11d48);
          }
          50% {
            stroke-width: 3px;
            filter: drop-shadow(0 0 5px #e11d48);
          }
        }

        /* Target highlight animation for CLS */
        .highlight-target-secondary {
          animation: pulseTargetSecondary 2.5s ease-in-out infinite !important;
          filter: none !important;
        }

        @keyframes pulseTargetSecondary {
          0%,
          100% {
            stroke-width: 2px;
            filter: drop-shadow(0 0 0px #c69c71);
          }
          50% {
            stroke-width: 3px;
            filter: drop-shadow(0 0 4px #c69c71);
          }
        }

        /* YES button cursor blink */
        .cursor-blink {
          animation: buttonBlink 1.2s steps(2) infinite;
        }

        @keyframes buttonBlink {
          0%,
          49% {
            background-color: #0a2824;
            border-color: #67cb87;
            color: #67cb87;
          }
          50%,
          100% {
            background-color: #67cb87;
            border-color: #0a2824;
            color: #0a2824;
          }
        }

        /* Boot up animation */
        .boot-up-text {
          text-shadow: 0 0 10px rgba(103, 203, 135, 0.7);
          animation: textGlitch 0.8s steps(4) forwards;
        }

        /* Grid line animations */
        .grid-line-h,
        .grid-line-v {
          position: absolute;
          transition: transform 0ms linear;
        }

        .fade-out {
          animation: fadeOut 0.2s steps(2) forwards;
        }

        @keyframes textGlitch {
          0% {
            transform: translateX(-5px);
            opacity: 0.7;
          }
          20% {
            transform: translateX(5px);
            opacity: 0.8;
          }
          40% {
            transform: translateX(-2px);
            opacity: 0.9;
          }
          60% {
            transform: translateX(2px);
            opacity: 1;
          }
          80% {
            transform: translateX(-1px);
            opacity: 1;
          }
          100% {
            transform: translateX(0);
            opacity: 1;
          }
        }

        @keyframes fadeOut {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
