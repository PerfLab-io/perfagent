# PerfAgent - AI-Powered Web Performance Analysis

PerfAgent is an advanced web performance analysis tool that leverages AI to help
developers analyze and optimize their web applications. It provides detailed
insights into Core Web Vitals and other performance metrics through interactive
visualizations and AI-assisted recommendations.

## Features

- **AI-Powered Analysis**: Utilizes large language models to analyze performance
  traces and provide actionable insights.
- **Performance Visualization**:
  - Flame graph visualization for CPU profile analysis
  - Network waterfall charts for request timing analysis
  - Interactive timeline views for user interactions
- **Core Web Vitals Analysis**: Comprehensive analysis of LCP, INP, CLS, and
  other performance metrics.
- **Chat Interface**: Engage with the AI assistant through a familiar chat
  interface to get targeted performance advice.
- **Trace Processing**: Upload and process Chrome DevTools performance traces
  for detailed analysis.
- **Report Generation**: Generate markdown reports with actionable optimization
  recommendations.

## Project Structure

### Main Directories

- `/app`: Next.js app router pages and API routes
  - `/api`: Backend API routes for AI integration, suggestions, and more
  - `/chat`: The main chat interface for interacting with the AI
  - `/actions`: Server actions for subscription management
  - `/workers`: Web workers for handling CPU-intensive tasks
- `/components`: React components
  - `/flamegraph`: Flame graph visualization components
  - `/network-activity`: Network request visualization
  - `/trace-details`: Components for displaying trace insights
  - `/app-sidebar`: Navigation and sidebar components
  - `/ui`: shadcn base components built with Radix UI
- `/lib`: Utilities and shared code
  - `/ai`: AI-related code and prompts
    - `/mastra`: Mastra AI agents and workflows
  - `/stores`: Zustand state management stores

### Core Components

- **Flame Graph Visualization**: Interactive visualization of call stacks and
  performance bottlenecks
- **Network Activity Visualization**: Waterfall charts showing network requests
  and timing
- **Trace Analysis UI**: Components for displaying metrics, insights, and
  histograms
- **Chat Interface**: Conversational UI for interacting with the AI assistant

## State Management

This project utilizes Zustand for state management to replace React's useState
hooks, providing several benefits:

1. **Reduced re-renders**: Zustand only triggers re-renders on components that
   subscribe to specific pieces of state.
2. **Centralized state**: Global application state is managed in a single place,
   making it easier to reason about.
3. **Isolated concerns**: State is organized by domain/feature into separate
   stores.
4. **Middleware support**: Uses middleware like `persist` and `immer` for
   additional functionality.

### Store Organization

Stores are organized by domain:

1. **UI Store** (`lib/stores/ui-store.ts`):

   - Manages UI-related state (mobile detection, sidebar state, page title)
   - Uses persist middleware to save some UI state across sessions

2. **Toast Store** (`lib/stores/toast-store.ts`):

   - Manages toast notifications
   - Replaces the previous useToast hook implementation

3. **Chat Store** (`lib/stores/chat-store.ts`):

   - Manages chat UI, side panels, and file handling state
   - Centralizes all the previously scattered state in chat/page.tsx

4. **FlameGraph Store** (`lib/stores/flamegraph-store.ts`):

   - Manages the visualization state for flame graphs
   - Uses immer middleware for easier state updates

5. **Artifact Store** (`lib/stores/artifact-store.ts`):
   - Manages UI artifacts and metadata
   - Replaces the previous useArtifact hook

## AI Capabilities

The project includes several AI components:

- **Trace Assistant**: Analyzes performance traces and provides optimization
  suggestions
- **Network Assistant**: Specializes in analyzing network requests for critical
  rendering path optimization
- **Research Capability**: Can research web performance topics and generate
  reports
- **Suggestions Generator**: Creates context-aware follow-up questions based on
  performance data

## Technologies Used

- **Framework**: [Next.js](https://nextjs.org/) (v15)
- **UI**:
  - [React](https://react.dev/) (v19)
  - [Radix UI](https://www.radix-ui.com/) (unstyled, accessible components)
  - [Tailwind CSS](https://tailwindcss.com/) (utility-first CSS)
  - [shadcn/ui](https://ui.shadcn.com/) (component collection)
  - [Recharts](https://recharts.org/) (for data visualization)
  - [Three.js](https://threejs.org/) with React Three Fiber (for 3D
    visualizations)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand) (v5)
- **AI & Language Models**:
  - [Vercel AI SDK](https://sdk.vercel.ai/docs) for AI integration
  - [Mastra](https://mastra.ai/) for AI agent orchestration
  - [Langfuse](https://langfuse.com/) for LLM observability
- **Performance Analysis**: `@perflab/trace_engine` for trace processing
- **Database**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team/)
- **API**: Next.js API routes and [Hono](https://hono.dev/)
- **Email**: [React Email](https://react.email/) and
  [Resend](https://resend.com/)
- **Form Handling**: [React Hook Form](https://react-hook-form.com/)
- **Validation**: [Zod](https://zod.dev/)
- **Observability**: OpenTelemetry for tracing and logging

## Getting Started

```bash
# Install dependencies
pnpm install

# Run the development server
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the
application.

## Background Jobs (Upstash QStash)

- Receiver endpoint: `POST /api/qstash` (signature verified)
- Verify endpoint: `POST /api/qstash/verify` (use to set up verification in QStash UI)
- Enqueue helper: `lib/jobs/enqueue.ts`
- Job registry: `lib/jobs/registry.ts`

Environment variables required:

- `QSTASH_TOKEN`
- `QSTASH_CURRENT_SIGNING_KEY`
- `QSTASH_NEXT_SIGNING_KEY`
- `NEXT_PUBLIC_APP_URL` (or `VERCEL_URL`)

Example enqueue:

```ts
import { enqueue } from '@/lib/jobs/enqueue';

await enqueue({ name: 'kv.cleanup.mcp' });
```
