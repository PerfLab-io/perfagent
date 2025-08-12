# State Management Guide

This document outlines the state management patterns and best practices used in PerfAgent, built with [Zustand](https://docs.pmnd.rs/zustand/getting-started/introduction).

## Core Principles

### 1. Derived State Without Side Effects
**Never store computed values.** Always compute derived state through selectors:

```typescript
// ❌ Bad - storing computed state
const store = create((set, get) => ({
  items: [],
  filteredItems: [], // Don't store this
  setFilter: (filter) => {
    const filtered = get().items.filter(/* ... */);
    set({ filteredItems: filtered }); // Unnecessary
  }
}));

// ✅ Good - computing via selectors
const store = create((set) => ({
  items: [],
  filter: ''
}));

const useFilteredItems = () => 
  useStore((state) => 
    state.items.filter(item => item.includes(state.filter))
  );
```

### 2. UI State vs Non-UI Data
**State should reflect UI changes.** Use refs for data that doesn't trigger renders:

```typescript
// ❌ Bad - storing non-UI data in state
const store = create((set) => ({
  analyticsTracker: new AnalyticsService(), // Don't trigger renders
  websocket: null // Connection state, not UI
}));

// ✅ Good - refs for non-UI data
const analyticsRef = useRef(new AnalyticsService());
const store = create((set) => ({
  isConnected: false, // UI state
  messages: []        // UI state
}));
```

### 3. Selector Pattern for Performance
**Always use selectors** to prevent unnecessary re-renders:

```typescript
// ❌ Bad - subscribing to entire store
const Component = () => {
  const store = useStore(); // Re-renders on ANY change
  return <div>{store.user.name}</div>;
};

// ✅ Good - selective subscriptions
const Component = () => {
  const userName = useStore(state => state.user.name);
  return <div>{userName}</div>;
};

// ✅ Better - multiple selectors
const Component = () => {
  const userName = useStore(state => state.user.name);
  const isLoading = useStore(state => state.isLoading);
  // Only re-renders when these specific values change
};
```

## Store Organization

### Domain-Based Slicing
Organize stores by domain to minimize re-render scope:

```typescript
// /lib/stores/ui-store.ts
export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  isMobile: false,
  toggleSidebar: () => set(state => ({ sidebarOpen: !state.sidebarOpen }))
}));

// /lib/stores/chat-store.ts
export const useChatStore = create<ChatStore>((set) => ({
  messages: [],
  isTyping: false,
  addMessage: (message) => set(state => ({ 
    messages: [...state.messages, message] 
  }))
}));
```

### Store Patterns

#### Async Actions
```typescript
const useStore = create<Store>((set, get) => ({
  data: null,
  isLoading: false,
  error: null,
  
  fetchData: async () => {
    set({ isLoading: true, error: null });
    try {
      const data = await api.getData();
      set({ data, isLoading: false });
    } catch (error) {
      set({ error: error.message, isLoading: false });
    }
  }
}));
```

#### Computed Selectors
```typescript
// Define reusable selectors
export const selectVisibleTodos = (state: TodoStore) =>
  state.todos.filter(todo => {
    if (state.filter === 'completed') return todo.completed;
    if (state.filter === 'active') return !todo.completed;
    return true;
  });

// Use in components
const visibleTodos = useTodoStore(selectVisibleTodos);
```

#### Shallow Equality for Objects
```typescript
import { shallow } from 'zustand/shallow';

// Prevent re-renders when object reference changes but values don't
const { width, height } = useStore(
  state => ({ width: state.width, height: state.height }),
  shallow
);
```

## Best Practices

### 1. TypeScript Integration
Always type your stores:

```typescript
interface StoreState {
  count: number;
  increment: () => void;
  decrement: () => void;
}

const useStore = create<StoreState>((set) => ({
  count: 0,
  increment: () => set(state => ({ count: state.count + 1 })),
  decrement: () => set(state => ({ count: state.count - 1 }))
}));
```

### 2. Immer for Complex Updates
For nested state updates, use Immer:

```typescript
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

const useStore = create(
  immer<State>((set) => ({
    users: {},
    updateUser: (id, updates) =>
      set((state) => {
        state.users[id] = { ...state.users[id], ...updates };
      })
  }))
);
```

### 3. DevTools Integration
Enable Redux DevTools in development:

```typescript
import { devtools } from 'zustand/middleware';

const useStore = create(
  devtools(
    (set) => ({
      // your store
    }),
    { name: 'MyStore' }
  )
);
```

### 4. Persist Middleware
For persistent state across sessions:

```typescript
import { persist } from 'zustand/middleware';

const useStore = create(
  persist(
    (set) => ({
      preferences: {},
      setPreference: (key, value) =>
        set(state => ({
          preferences: { ...state.preferences, [key]: value }
        }))
    }),
    {
      name: 'user-preferences',
      partialize: (state) => ({ preferences: state.preferences })
    }
  )
);
```

## Common Patterns in PerfAgent

### UI Store Pattern
```typescript
// /lib/stores/ui-store.ts
interface UIStore {
  // State
  sidebarOpen: boolean;
  activeModal: string | null;
  
  // Actions
  toggleSidebar: () => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
}
```

### Chat Store Pattern
```typescript
// /lib/stores/chat-store.ts
interface ChatStore {
  // State
  messages: Message[];
  isStreaming: boolean;
  
  // Computed via selectors
  // Don't store: lastMessage, unreadCount, etc.
  
  // Actions
  addMessage: (message: Message) => void;
  clearMessages: () => void;
  setStreaming: (isStreaming: boolean) => void;
}
```

### Performance Visualization Store
```typescript
// /lib/stores/flamegraph-store.ts
interface FlamegraphStore {
  // UI State only
  selectedNode: string | null;
  zoomLevel: number;
  
  // Data should be in refs or props
  // Not: traceData, computedMetrics
  
  // Actions
  selectNode: (nodeId: string | null) => void;
  setZoom: (level: number) => void;
}
```

## Testing Stores

```typescript
import { renderHook, act } from '@testing-library/react';
import { useStore } from './store';

describe('Store', () => {
  it('should update state correctly', () => {
    const { result } = renderHook(() => useStore());
    
    act(() => {
      result.current.increment();
    });
    
    expect(result.current.count).toBe(1);
  });
});
```

## Migration Guide

When refactoring existing state management:

1. **Identify UI state** vs non-UI data
2. **Extract derived state** into selectors
3. **Split large stores** by domain
4. **Add TypeScript types** for safety
5. **Implement selectors** to prevent re-renders
6. **Test store updates** in isolation

## References

- [Zustand Documentation](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [Zustand Recipes](https://docs.pmnd.rs/zustand/recipes/recipes)
- [TypeScript Guide](https://docs.pmnd.rs/zustand/guides/typescript)
- [Testing Stores](https://docs.pmnd.rs/zustand/guides/testing)

## Examples in Codebase

- `/lib/stores/ui-store.ts` - UI state management
- `/lib/stores/chat-store.ts` - Chat interface state
- `/lib/stores/flamegraph-store.ts` - Visualization state
- `/lib/stores/artifact-store.ts` - Artifact management
- `/lib/stores/toast-store.ts` - Notification system