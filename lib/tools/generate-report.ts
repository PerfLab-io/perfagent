import { registerTool } from "../mock-ai-sdk";
import { getAnimationUrlForTopic } from "../utils/gif-generator";

// Mock report content based on topics
const reportContent = {
  "go-overview": {
    title: "Go Programming Language Overview",
    sections: [
      {
        title: "Introduction to Go",
        content: `# Go Programming Language

![Go Programming Language Visualization](${getAnimationUrlForTopic("go-overview")})

Go (or Golang) is an open-source programming language created at Google in 2007 by Robert Griesemer, Rob Pike, and Ken Thompson. It was designed to be efficient, readable, and suitable for modern computing environments.

## Key Features

- **Simplicity**: Go emphasizes simplicity and readability
- **Concurrency**: Built-in support for concurrent programming
- **Compilation**: Compiles to machine code for fast execution
- **Garbage Collection**: Automatic memory management
- **Static Typing**: Type safety with minimal type declaration syntax

Go combines the efficiency of a compiled language with the ease of programming of a dynamic language, making it an excellent choice for modern software development.`,
      },
      {
        title: "Getting Started with Go",
        content: `## Installation and Setup

![Getting Started with Go](${getAnimationUrlForTopic("go-overview")})

Getting started with Go is straightforward:

1. Download the installer from [golang.org/dl/](https://golang.org/dl/)
2. Follow the installation instructions for your platform
3. Verify installation by running \`go version\` in your terminal

## Your First Go Program

Create a file named \`hello.go\` with the following content:

\`\`\`go
package main

import "fmt"

func main() {
  fmt.Println("Hello, Go!")
}
\`\`\`

Run it with:

\`\`\`
go run hello.go
\`\`\`

This simple program demonstrates the basic structure of a Go application.`,
      },
      {
        title: "Go Core Concepts",
        content: `## Core Concepts

![Go Core Concepts](${getAnimationUrlForTopic("go-overview")})

### Packages

Go programs are organized into packages. Every Go program starts with the \`package main\` declaration.

### Variables and Types

Go has several basic types:

- \`bool\`: Boolean values
- \`string\`: UTF-8 encoded text
- Numeric types: \`int\`, \`int8\`, \`int16\`, \`int32\`, \`int64\`, \`uint\`, \`uint8\`, etc.
- \`float32\`, \`float64\`: Floating-point numbers
- \`complex64\`, \`complex128\`: Complex numbers

### Functions

Functions in Go are defined with the \`func\` keyword:

\`\`\`go
func add(x int, y int) int {
  return x + y
}
\`\`\`

### Control Structures

Go supports standard control structures like \`if\`, \`for\`, and \`switch\`.`,
      },
      {
        title: "Learning Resources",
        content: `## Learning Resources

![Go Learning Resources](${getAnimationUrlForTopic("go-overview")})

To continue your Go journey, check out these resources:

- [Go Tour](https://tour.golang.org/): An interactive introduction to Go
- [Go Documentation](https://golang.org/doc/): Official documentation
- [Effective Go](https://golang.org/doc/effective_go): Best practices for writing Go code
- [Go by Example](https://gobyexample.com/): Example-based learning


## Next Steps

Ready to dive deeper? Explore these topics:
- Structs and Interfaces
- Concurrency with Goroutines and Channels
- Error Handling
- Testing in Go`,
      },
    ],
  },
  concurrency: {
    title: "Concurrency in Go",
    sections: [
      {
        title: "Understanding Go's Concurrency Model",
        content: `# Concurrency in Go

![Concurrency Visualization](${getAnimationUrlForTopic("concurrency")})

Go's approach to concurrency is one of its most powerful features, based on the Communicating Sequential Processes (CSP) paradigm.

## Goroutines: Lightweight Concurrency

A goroutine is a lightweight thread managed by the Go runtime. Starting a goroutine is as simple as using the \`go\` keyword:

\`\`\`go
go function()
\`\`\`

### Goroutine Example

\`\`\`go
package main

import (
  "fmt"
  "time"
)

func say(s string) {
  for i := 0; i < 5; i++ {
    time.Sleep(100 * time.Millisecond)
    fmt.Println(s)
  }
}

func main() {
  go say("world")
  say("hello")
}
\`\`\`

This executes two functions concurrently: one in the background and one in the foreground.`,
      },
      {
        title: "Channels: Communication Between Goroutines",
        content: `## Channels

![Channels Visualization](${getAnimationUrlForTopic("concurrency")})

Channels are Go's mechanism for communicating between goroutines. They allow you to pass values between goroutines safely.

### Basic Channel Usage

\`\`\`go
package main

import "fmt"

func sum(s []int, c chan int) {
  sum := 0
  for _, v := range s {
    sum += v
  }
  c <- sum // send sum to c
}

func main() {
  s := []int{7, 2, 8, -9, 4, 0}

  c := make(chan int)
  go sum(s[:len(s)/2], c)
  go sum(s[len(s)/2:], c)
  x, y := <-c, <-c // receive from c

  fmt.Println(x, y, x+y)
}
\`\`\`

### Channel Buffering

Channels can be buffered, meaning they can hold a specified number of values:

\`\`\`go
ch := make(chan int, 100)
\`\`\`

### Channel Direction

Channels can be restricted to only sending or only receiving:

\`\`\`go
func send(ch chan<- int)  // can only send to ch
func recv(ch <-chan int)  // can only receive from ch
\`\`\``,
      },
      {
        title: "Concurrency Patterns",
        content: `## Common Concurrency Patterns

![Concurrency Patterns](${getAnimationUrlForTopic("concurrency")})

### Worker Pools

A worker pool is a common pattern for parallelizing work:

\`\`\`go
package main

import (
  "fmt"
  "time"
)

func worker(id int, jobs <-chan int, results chan<- int) {
  for j := range jobs {
    fmt.Println("worker", id, "started  job", j)
    time.Sleep(time.Second)
    fmt.Println("worker", id, "finished job", j)
    results <- j * 2
  }
}

func main() {
  const numJobs = 5
  jobs := make(chan int, numJobs)
  results := make(chan int, numJobs)

  // Start 3 workers
  for w := 1; w <= 3; w++ {
    go worker(w, jobs, results)
  }

  // Send jobs
  for j := 1; j <= numJobs; j++ {
    jobs <- j
  }
  close(jobs)

  // Collect results
  for a := 1; a <= numJobs; a++ {
    <-results
  }
}
\`\`\``,
      },
    ],
  },
  "error-handling": {
    title: "Error Handling in Go",
    sections: [
      {
        title: "Go's Approach to Error Handling",
        content: `# Error Handling in Go

![Error Handling Visualization](${getAnimationUrlForTopic("error-handling")})

Go takes a straightforward approach to error handling that differs from many other languages. Instead of using exceptions, Go functions return error values.

## Basic Error Handling

In Go, functions that can fail typically return an error as the last return value:

\`\`\`go
func OpenFile(name string) (*File, error) {
  // ...
}

f, err := OpenFile("filename.txt")
if err != nil {
  // handle the error
  return
}
// continue with f
\`\`\`

This explicit error checking encourages developers to handle errors deliberately at each step.`,
      },
      {
        title: "Creating and Working with Errors",
        content: `## Working with Errors

![Creating Errors Visualization](${getAnimationUrlForTopic("error-handling")})

### Creating Simple Errors

The \`errors\` package provides a simple way to create error values:

\`\`\`go
import "errors"

func validateAge(age int) error {
  if age < 0 {
    return errors.New("age cannot be negative")
  }
  return nil
}
\`\`\`

### Formatting Errors

For more detailed errors, use \`fmt.Errorf\`:

\`\`\`go
import "fmt"

func validateAge(age int) error {
  if age < 0 {
    return fmt.Errorf("invalid age %d: cannot be negative", age)
  }
  return nil
}
\`\`\``,
      },
    ],
  },
};

// Update the generateReportTool to support streaming
export const generateReportTool = registerTool({
  name: "generateReport",
  description: "Generates a comprehensive report on a Go programming topic",
  execute: async (params: { query: string }) => {
    // Ensure params is an object and query is a string
    const safeParams = params || {};
    const query =
      typeof safeParams.query === "string"
        ? safeParams.query.toLowerCase()
        : "";

    console.log("Generate report query:", query);

    // Determine which report to generate based on the query
    let reportType = "go-overview";

    if (query.includes("concurrency")) {
      reportType = "concurrency";
    } else if (query.includes("error handling")) {
      reportType = "error-handling";
    }

    // Return the complete report data
    return {
      type: "report",
      reportType,
      reportData: reportContent[reportType as keyof typeof reportContent],
    };
  },
  // Add streaming support
  stream: async function* (
    params: { query: string; toolCallId?: string },
    dataStream?: any,
  ) {
    // Ensure params is an object and query is a string
    const safeParams = params || {};
    const query =
      typeof safeParams.query === "string"
        ? safeParams.query.toLowerCase()
        : "";

    // Generate a unique toolCallId if not provided
    const toolCallId =
      params.toolCallId ||
      `report-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Determine which report to generate based on the query
    let reportType = "go-overview";

    if (query.includes("concurrency")) {
      reportType = "concurrency";
    } else if (query.includes("error handling")) {
      reportType = "error-handling";
    }

    // Get the report content
    const report = reportContent[reportType as keyof typeof reportContent];

    // First yield just the title to show something immediately
    yield {
      type: "report",
      reportType,
      reportData: {
        title: report.title,
        sections: [],
      },
      toolCallId,
    };

    // Then stream each section with a delay
    let currentSections = [];
    for (let i = 0; i < report.sections.length; i++) {
      // Add a delay to simulate streaming
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 + Math.random() * 1000),
      );

      // Add this section to our current sections
      currentSections = [...currentSections, report.sections[i]];

      // Yield the report with sections up to this point
      yield {
        type: "report",
        reportType,
        reportData: {
          title: report.title,
          sections: currentSections,
        },
        toolCallId,
      };
    }
  },
});
