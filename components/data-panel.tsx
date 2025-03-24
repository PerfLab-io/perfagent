"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  PieChart,
  LineChart,
  Activity,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataPanelProps {
  visible: boolean;
  onClose: () => void;
  exiting?: boolean;
}

export function DataPanel({
  visible,
  onClose,
  exiting = false,
}: DataPanelProps) {
  const [animate, setAnimate] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "performance" | "trends"
  >("overview");

  useEffect(() => {
    if (visible) {
      // Delay animation start to allow left panel animation to complete first
      const timer = setTimeout(() => {
        setAnimate(true);
      }, 300); // Reduced from 500ms to 300ms to make it snappier
      return () => clearTimeout(timer);
    } else {
      setAnimate(false);
    }
  }, [visible]);

  // Mock data for different visualizations
  const overviewData = [65, 40, 80, 30, 55, 70, 45];
  const performanceData = [
    { name: "Variables", score: 85 },
    { name: "Functions", score: 70 },
    { name: "Structs", score: 60 },
    { name: "Interfaces", score: 45 },
    { name: "Goroutines", score: 30 },
    { name: "Channels", score: 25 },
  ];
  const learningTrendData = [20, 35, 45, 30, 50, 65, 75];

  if (!visible) return null;

  return (
    <div
      className={cn(
        "bg-background p-6 transition-all duration-300 panel-right",
        "max-h-[500px] sm:max-h-[600px] md:max-h-[700px] lg:max-h-[800px] overflow-y-auto",
        animate ? "opacity-100" : "opacity-0",
        exiting && "panel-right-exit",
      )}
      style={{
        animationName: animate && !exiting ? "slideRight" : "none",
        animationDuration: "250ms", // Reduced from 350ms to 250ms
        animationTimingFunction: "cubic-bezier(0.25, 0.1, 0.25, 1)", // More responsive timing function
        animationFillMode: "forwards",
      }}
    >
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-foreground">
          Go Learning Analytics
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="rounded-full h-8 w-8"
        >
          <XCircle className="h-5 w-5" />
        </Button>
      </div>

      {/* Tab navigation */}
      <div className="flex mb-6 gap-2 border-b border-border pb-2">
        <Button
          variant={activeTab === "overview" ? "default" : "ghost"}
          onClick={() => setActiveTab("overview")}
          className="gap-2"
        >
          <PieChart className="h-4 w-4" />
          Learning Overview
        </Button>
        <Button
          variant={activeTab === "performance" ? "default" : "ghost"}
          onClick={() => setActiveTab("performance")}
          className="gap-2"
        >
          <BarChart3 className="h-4 w-4" />
          Topic Performance
        </Button>
        <Button
          variant={activeTab === "trends" ? "default" : "ghost"}
          onClick={() => setActiveTab("trends")}
          className="gap-2"
        >
          <LineChart className="h-4 w-4" />
          Learning Trends
        </Button>
      </div>

      {/* Tab content */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {activeTab === "overview" && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  Weekly Learning Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-end">
                  {overviewData.map((value, index) => (
                    <div
                      key={index}
                      className="flex-1 flex flex-col items-center"
                    >
                      <div
                        className="bg-indigo-600 dark:bg-indigo-500 w-5/6 rounded-t-sm transition-all duration-500 ease-out"
                        style={{
                          height: `${value}%`,
                          animationDelay: `${index * 100}ms`,
                          animationName: animate ? "growUp" : "none",
                          animationDuration: "1s",
                          animationTimingFunction: "ease-out",
                          animationFillMode: "forwards",
                        }}
                      ></div>
                      <div className="text-xs mt-2">
                        {["M", "T", "W", "T", "F", "S", "S"][index]}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Go Topics Mastery</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3 justify-center">
                  {[
                    {
                      name: "Variables",
                      mastery: 90,
                      color: "var(--peppermint-400)",
                    },
                    {
                      name: "Control Flow",
                      mastery: 85,
                      color: "var(--peppermint-500)",
                    },
                    {
                      name: "Functions",
                      mastery: 75,
                      color: "var(--peppermint-600)",
                    },
                    {
                      name: "Pointers",
                      mastery: 60,
                      color: "var(--indigo-400)",
                    },
                    {
                      name: "Structs",
                      mastery: 70,
                      color: "var(--indigo-500)",
                    },
                    {
                      name: "Interfaces",
                      mastery: 55,
                      color: "var(--indigo-600)",
                    },
                    {
                      name: "Concurrency",
                      mastery: 40,
                      color: "var(--merino-400)",
                    },
                    {
                      name: "Channels",
                      mastery: 35,
                      color: "var(--merino-500)",
                    },
                    {
                      name: "Error Handling",
                      mastery: 65,
                      color: "var(--merino-600)",
                    },
                  ].map((topic, i) => (
                    <div
                      key={i}
                      className="flex flex-col items-center bg-background border border-border rounded-lg p-3 w-[100px]"
                    >
                      <div className="relative w-16 h-16 mb-2">
                        <svg viewBox="0 0 36 36" className="w-full h-full">
                          <circle
                            cx="18"
                            cy="18"
                            r="15"
                            fill="none"
                            className="stroke-muted"
                            strokeWidth="3"
                          />
                          <circle
                            cx="18"
                            cy="18"
                            r="15"
                            fill="none"
                            stroke={topic.color}
                            strokeWidth="3"
                            strokeDasharray={`${topic.mastery} 100`}
                            strokeLinecap="round"
                            style={{
                              transformOrigin: "center",
                              transform: "rotate(-90deg)",
                              transition: "stroke-dasharray 1.5s ease",
                              animationName: animate ? "fillProgress" : "none",
                              animationDuration: "1.5s",
                              animationTimingFunction: "ease-out",
                              animationFillMode: "forwards",
                              animationDelay: `${i * 100}ms`,
                            }}
                          />
                          <text
                            x="18"
                            y="21"
                            textAnchor="middle"
                            fontSize="8"
                            fill="var(--text-color)"
                            fontWeight="bold"
                          >
                            {topic.mastery}%
                          </text>
                        </svg>
                      </div>
                      <div className="text-xs text-center font-medium">
                        {topic.name}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "performance" && (
          <>
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Go Topic Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <div className="flex h-full items-end">
                    {performanceData.map((item, index) => (
                      <div
                        key={index}
                        className="flex-1 flex flex-col items-center"
                      >
                        <div className="flex-grow flex items-end w-full justify-center">
                          <div
                            className="w-4/5 bg-gradient-to-t from-indigo-600 to-peppermint-400 rounded-t-sm transition-all duration-500 ease-out"
                            style={{
                              height: `${item.score}%`,
                              animationName: animate ? "growUp" : "none",
                              animationDuration: "1.5s",
                              animationTimingFunction: "ease-out",
                              animationFillMode: "forwards",
                              animationDelay: `${index * 100}ms`,
                            }}
                          ></div>
                        </div>
                        <div
                          className="mt-2 text-xs text-center px-1 w-full truncate"
                          title={item.name}
                        >
                          {item.name}
                        </div>
                        <div className="text-xs font-medium">{item.score}%</div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">
                  Strengths and Areas for Improvement
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-peppermint-600 dark:text-peppermint-400">
                      <div className="p-1.5 rounded-full bg-peppermint-100 dark:bg-peppermint-900">
                        <Activity className="h-4 w-4" />
                      </div>
                      Strengths
                    </h3>

                    <ul className="space-y-3">
                      {[
                        { topic: "Basic Syntax", score: 92 },
                        { topic: "Variables & Types", score: 88 },
                        { topic: "Control Structures", score: 85 },
                        { topic: "Functions", score: 80 },
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3">
                          <div className="h-2 bg-peppermint-200 dark:bg-peppermint-800 rounded-full flex-grow">
                            <div
                              className="h-full bg-peppermint-500 rounded-full"
                              style={{
                                width: `${item.score}%`,
                                animationName: animate ? "growRight" : "none",
                                animationDuration: "1s",
                                animationTimingFunction: "ease-out",
                                animationFillMode: "forwards",
                                animationDelay: `${i * 150}ms`,
                              }}
                            ></div>
                          </div>
                          <div className="flex items-center justify-between gap-3 min-w-[140px]">
                            <span className="text-xs">{item.topic}</span>
                            <span className="text-xs font-bold">
                              {item.score}%
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium mb-3 flex items-center gap-2 text-merino-600 dark:text-merino-400">
                      <div className="p-1.5 rounded-full bg-merino-100 dark:bg-merino-900">
                        <Activity className="h-4 w-4" />
                      </div>
                      Areas for Improvement
                    </h3>

                    <ul className="space-y-3">
                      {[
                        { topic: "Goroutines", score: 45 },
                        { topic: "Channels", score: 40 },
                        { topic: "Context", score: 35 },
                        { topic: "Testing", score: 50 },
                      ].map((item, i) => (
                        <li key={i} className="flex items-center gap-3">
                          <div className="h-2 bg-merino-200 dark:bg-merino-900 rounded-full flex-grow">
                            <div
                              className="h-full bg-merino-500 rounded-full"
                              style={{
                                width: `${item.score}%`,
                                animationName: animate ? "growRight" : "none",
                                animationDuration: "1s",
                                animationTimingFunction: "ease-out",
                                animationFillMode: "forwards",
                                animationDelay: `${i * 150}ms`,
                              }}
                            ></div>
                          </div>
                          <div className="flex items-center justify-between gap-3 min-w-[140px]">
                            <span className="text-xs">{item.topic}</span>
                            <span className="text-xs font-bold">
                              {item.score}%
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {activeTab === "trends" && (
          <>
            <Card className="xl:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">
                  Monthly Learning Trend
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 relative">
                  {/* Grid lines */}
                  <div className="absolute inset-0 grid grid-rows-4 grid-cols-6 border-l border-t border-border">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="col-span-6 border-b border-border"
                      ></div>
                    ))}
                    {[...Array(6)].map((_, i) => (
                      <div
                        key={i}
                        className="row-span-4 border-r border-border"
                      ></div>
                    ))}
                  </div>

                  {/* Line chart */}
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    {/* Trend line */}
                    <polyline
                      points="0,80 16.6,65 33.3,55 50,70 66.6,50 83.3,35 100,25"
                      fill="none"
                      stroke="var(--indigo-500)"
                      strokeWidth="2"
                      style={{
                        strokeDasharray: "200",
                        strokeDashoffset: "200",
                        animationName: animate ? "drawLine" : "none",
                        animationDuration: "2s",
                        animationTimingFunction: "ease-out",
                        animationFillMode: "forwards",
                      }}
                    />

                    {/* Data points */}
                    {[
                      { x: 0, y: 80 },
                      { x: 16.6, y: 65 },
                      { x: 33.3, y: 55 },
                      { x: 50, y: 70 },
                      { x: 66.6, y: 50 },
                      { x: 83.3, y: 35 },
                      { x: 100, y: 25 },
                    ].map((point, i) => (
                      <circle
                        key={i}
                        cx={point.x}
                        cy={point.y}
                        r="2"
                        fill="var(--card-bg)"
                        stroke="var(--indigo-500)"
                        strokeWidth="2"
                        style={{
                          opacity: 0,
                          animationName: animate ? "fadeIn" : "none",
                          animationDuration: "0.3s",
                          animationTimingFunction: "ease-out",
                          animationFillMode: "forwards",
                          animationDelay: `${i * 0.25 + 1}s`,
                        }}
                      />
                    ))}
                  </svg>

                  {/* X and Y axis labels */}
                  <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 text-xs text-foreground">
                    <span>Jan</span>
                    <span>Feb</span>
                    <span>Mar</span>
                    <span>Apr</span>
                    <span>May</span>
                    <span>Jun</span>
                    <span>Jul</span>
                  </div>

                  <div className="absolute top-0 bottom-0 left-0 flex flex-col justify-between py-2 text-xs text-foreground">
                    <span>100%</span>
                    <span>75%</span>
                    <span>50%</span>
                    <span>25%</span>
                    <span>0%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Daily Practice Streak</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center">
                  <div className="relative w-40 h-40 mb-4">
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                      {/* Background circle */}
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="var(--border-color)"
                        strokeWidth="10"
                        strokeOpacity="0.2"
                      />

                      {/* Progress circle */}
                      <circle
                        cx="50"
                        cy="50"
                        r="45"
                        fill="none"
                        stroke="var(--peppermint-500)"
                        strokeWidth="10"
                        strokeDasharray="283"
                        strokeDashoffset="70"
                        strokeLinecap="round"
                        style={{
                          transformOrigin: "center",
                          transform: "rotate(-90deg)",
                          animationName: animate ? "fillCircle" : "none",
                          animationDuration: "1.5s",
                          animationTimingFunction: "ease-out",
                          animationFillMode: "forwards",
                        }}
                      />

                      {/* Center text */}
                      <text
                        x="50"
                        y="45"
                        textAnchor="middle"
                        fontSize="24"
                        fontWeight="bold"
                        fill="var(--text-color)"
                      >
                        21
                      </text>
                      <text
                        x="50"
                        y="65"
                        textAnchor="middle"
                        fontSize="12"
                        fill="var(--text-color)"
                      >
                        days
                      </text>
                    </svg>
                  </div>

                  <h3 className="text-lg font-medium mb-1">Current Streak</h3>
                  <p className="text-sm text-foreground text-center">
                    Keep practicing Go daily to maintain your streak!
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Learning Pace</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Current pace</span>
                      <span className="text-sm font-medium">7.5 hrs/week</span>
                    </div>
                    <div className="h-2 bg-background border border-border rounded-full">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{
                          width: "75%",
                          animationName: animate ? "growRight" : "none",
                          animationDuration: "1s",
                          animationTimingFunction: "ease-out",
                          animationFillMode: "forwards",
                        }}
                      ></div>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm">Target pace</span>
                      <span className="text-sm font-medium">10 hrs/week</span>
                    </div>
                    <div className="h-2 bg-background border border-border rounded-full">
                      <div
                        className="h-full bg-peppermint-500 rounded-full"
                        style={{
                          width: "100%",
                          animationName: animate ? "growRight" : "none",
                          animationDuration: "1s",
                          animationTimingFunction: "ease-out",
                          animationFillMode: "forwards",
                          animationDelay: "0.2s",
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="flex gap-3 text-sm justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                      <span>Your pace</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 bg-peppermint-500 rounded-full"></div>
                      <span>Target pace</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
