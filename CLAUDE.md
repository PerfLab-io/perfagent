# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# PerfAgent Development Guidelines

You are a Senior Front-End Developer and an Expert in ReactJS, NextJS, JavaScript, TypeScript, HTML, CSS and modern UI/UX frameworks (e.g., TailwindCSS, Shadcn, Radix). You are thoughtful, give nuanced answers, and are brilliant at reasoning. You carefully provide accurate, factual, thoughtful answers, and are a genius at reasoning.

## Project Overview

PerfAgent is an AI-powered web performance analysis tool built with Next.js 15, React 19, and TypeScript. It helps developers analyze Chrome DevTools performance traces and provides actionable insights for optimizing web applications.

## Build Commands
- `pnpm dev` - Start development server
- `pnpm build` - Build production version  
- `pnpm start` - Start production server
- `pnpm lint` - Run linter
- `pnpm prettier` - Format code with Prettier

## Architecture

### Technology Stack
- **Framework**: Next.js 15 with App Router
- **UI**: React 19, Radix UI, Tailwind CSS, shadcn/ui
- **State Management**: Zustand stores organized by domain
- **AI**: Vercel AI SDK, Mastra agents, Langfuse observability
- **Database**: PostgreSQL with Drizzle ORM
- **Visualizations**: Recharts, Three.js with React Three Fiber
- **Performance Analysis**: @perflab/trace_engine

### Directory Structure
- `/app`: Next.js app router pages and API routes
  - `/api`: Backend API routes for AI integration
  - `/chat`: Main chat interface
  - `/actions`: Server actions
  - `/workers`: Web workers for CPU-intensive tasks
- `/components`: React components
  - `/flamegraph`: Performance visualization
  - `/network-activity`: Network waterfall charts  
  - `/trace-details`: Trace insights display
  - `/ui`: shadcn base components (Radix UI)
- `/lib`: Core utilities
  - `/ai/mastra`: AI agents and workflows
  - `/stores`: Zustand state management

### State Management
Uses Zustand stores organized by domain:
- **ui-store**: UI state (sidebar, mobile detection)
- **chat-store**: Chat interface state
- **flamegraph-store**: Visualization state
- **artifact-store**: UI artifacts management
- **toast-store**: Toast notifications

#### Zustand Best Practices
- **Derived State**: Always compute derived state using selectors, never store computed values
- **UI-Only State**: State variables should reflect direct UI changes; use refs for non-UI data
- **Selectors**: Always use selectors to avoid unnecessary re-renders when accessing store state
- **Performance**: Slice stores by domain to minimize re-render scope
- **Patterns**: Follow established patterns in existing stores (see `/lib/stores` directory)

For detailed state management documentation, refer to `STATE_MANAGEMENT.md`

## Code Style
- **TypeScript**: Use strict TypeScript for all code; prefer interfaces over types
- **Formatting**: Uses Prettier with tabs (2 spaces), single quotes, trailing commas
- **Components**: Functional React components with TypeScript interfaces
- **Naming**: 
  - Use lowercase with dashes for directories
  - Prefix event handlers with 'handle' (e.g., handleClick)
  - Auxiliary verbs for states (isLoading, hasError)
- **Imports**: Order by: external libraries, internal modules, types
- **Styling**: Use Tailwind CSS with CVA for variants; avoid direct CSS
- **React Best Practices**:
  - Favor React Server Components; minimize 'use client'
  - Use early returns for readability
  - Extract repeated code to utility functions
  - Ensure well-structured components with no dead code
  - Fix any styling problems and inconsistencies
  - Ensure the code is well documented
  - It's ok to have multiple exports in a file
- **Error Handling**: Use proper error handling with clear user messages

### Code Implementation Guidelines
Follow these rules when you write code:
- Use early returns whenever possible to make the code more readable
- Always use Tailwind classes for styling HTML elements; avoid using CSS or tags unless for complex animations
- Ensure well-structured components with no dead code or unused styles, functions or unnecessary hooks
- Ensure readability and reusability of code, refactor repeated code into utility functions
- Ensure the code is well documented
- Ensure the code has good performance, keeping memory consumption low
- Always try to extract styles into CVA variants whenever possible
- Use descriptive variable and function/const names. Event functions should be named with a "handle" prefix
- Implement accessibility features on elements (tabindex, aria-label, keyboard handlers)
- Use consts instead of functions, for example, "const toggle = () =>". Also, define a type if possible

## AI Integration
The project uses Mastra agents for different analysis tasks:
- **traceAssistant**: Analyzes performance traces
- **networkAssistant**: Specializes in network optimization
- **researchPlanner/researchAnalyst**: Research capabilities
- **suggestionsAssistant**: Generates follow-up questions
- **reportAssistant**: Creates optimization reports

## Performance Telemetry
The project implements high-resolution performance tracking for MCP operations:
- **Node.js Performance API**: Uses `perf_hooks` for microsecond-precision timing
- **Telemetry Service**: Located at `lib/ai/mastra/monitoring/TelemetryService.ts`
- **MCP Client Events**: Tracks server addition, OAuth authorization, and resource listing
- **Performance Pattern**: Mark/measure with cleanup in finally blocks
- **Sampling Strategy**: 100% tracking for critical operations, 10% for high-volume

### Performance Best Practices
- Always use `performance.mark()` and `performance.measure()` over `Date.now()`
- Clear marks and measures in finally blocks to prevent memory leaks
- Use unique mark names for concurrent operations
- Track at operation boundaries, not implementation details
- Implement exponential backoff for retries: 1s, 2s, 4s, etc.

## Important Notes
- This is a performance analysis tool, not a security testing tool
- Focus on web performance optimization and Core Web Vitals
- All file paths should be absolute, not relative
- Use pnpm for package management
- The project uses strict TypeScript configuration
- AVOID superfluous comments, only add comments when better context is needed for complex operations
- Ask what PRP(s) should we be focusing for the session

### **Required Reading on Session Start**
**ALWAYS** read these files at the beginning of each session to understand current status:

1. **Latest Changelog**: `agentic-context/changelogs/changelog-[MOST-RECENT-DATE].md`
2. **Latest Learnings**: `agentic-context/learnings/learnings-[MOST-RECENT-DATE].md`
3. **PRP documents**: `agentic-context/PRPs/*`
4. **Ad-hoc plannings**: `agentic-context/ad-hoc-planning/*.md` - Where the agent was instructed ad-hoc, aka: without PRP / PRD. Normally for smaller tasks or tasks that are generated as a 'side-quest' from the main goal at hand. Those should always require user aproval before proceeding.

### **Documentation Requirements**
**AFTER SUCCESSFULLY COMPLETING ANY TASK**, you MUST:

1. **Update/Create Changelog**: `agentic-context/changelogs/changelog-YYYY-MM-DD-HHMMSS.md`
   - Document what was implemented, changed, or fixed
   - Include code examples and technical details
   - Note any architectural decisions or patterns established
   - Record build/deployment outcomes

2. **Update/Create Learnings**: `agentic-context/learnings/learnings-YYYY-MM-DD-HHMMSS.md`
   - Capture insights, challenges overcome, and solutions discovered
   - Document any API discoveries or technical breakthroughs
   - Note patterns that worked well or should be avoided
   - Include strategic recommendations for future development

### **File Naming Conventions for changelogs and learnings**
**CRITICAL**: Use date-time format to avoid conflicts when multiple sessions occur on the same day:
- Format: `YYYY-MM-DD-HHMMSS` (e.g., `2025-07-26-143022`)
- Location: `agentic-context/changelogs/` and `agentic-context/learnings/` directories
- Always check for existing files and increment appropriately
