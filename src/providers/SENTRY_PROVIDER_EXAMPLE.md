# Adding Sentry Tracking to Providers

This guide shows how to add Sentry error tracking and performance monitoring to provider methods.

**Note**: This extension follows [Sentry's best practices for shared environments](https://docs.sentry.io/platforms/javascript/best-practices/shared-environments/). We use manual client/scope setup instead of global `Sentry.init()` to avoid polluting the global state and interfering with other Sentry instances.

## ⚡ Quick Start: Use Wrapped VSCode APIs

**NEW**: We now provide pre-wrapped VSCode APIs that automatically add Sentry tracking! See [`../utils/SENTRY_VSCODE_USAGE.md`](../utils/SENTRY_VSCODE_USAGE.md) for the easiest way to add Sentry to your providers.

```typescript
// Instead of manual wrapping (shown below)
import * as sentryVscode from '../utils/sentryVscode';

// Just use sentryVscode.commands instead of vscode.commands
sentryVscode.commands.registerCommand('my-command', handler);
sentryVscode.window.onDidChangeActiveTextEditor(handler);
```

The examples below show the manual approach if you need more control.

## Example: Enhanced Command Provider

Here's how you can enhance the `CommandProvider` with Sentry tracking:

```typescript
import * as vscode from 'vscode';
import { 
  withSentrySync, 
  withSentry, 
  addBreadcrumb, 
  captureException, 
  startActiveSpan
} from '../utils/sentry';

export default class CommandProvider {
  constructor(private context: vscode.ExtensionContext) {}

  public register(): vscode.Disposable[] {
    return [
      vscode.commands.registerTextEditorCommand(
        'flagpole-explorer.addFeature',
        this.wrapCommand('addFeature', this.addFeature)
      ),
      vscode.commands.registerTextEditorCommand(
        'flagpole-explorer.addSegment',
        this.wrapCommand('addSegment', this.addSegment)
      ),
      vscode.commands.registerCommand(
        'flagpole-explorer.evaluate-flag',
        this.wrapAsyncCommand('evaluateFlag', this.evaluateFlag)
      ),
    ];
  }

  /**
   * Wrap a synchronous command with Sentry tracking
   */
  private wrapCommand<T extends any[]>(
    commandName: string,
    handler: (...args: T) => void
  ): (...args: T) => void {
    return (...args: T) => {
      return startActiveSpan(
        {
          name: `command.${commandName}`,
          op: 'command',
        },
        () => {
          addBreadcrumb(`Executing command: ${commandName}`, 'command', 'info');
          try {
            return handler(...args);
          } catch (error) {
            captureException(error as Error, {
              context: 'command',
              commandName,
            });
            
            vscode.window.showErrorMessage(
              `Error executing ${commandName}: ${error instanceof Error ? error.message : String(error)}`
            );
            
            throw error;
          }
        }
      );
    };
  }

  /**
   * Wrap an async command with Sentry tracking
   */
  private wrapAsyncCommand<T extends any[]>(
    commandName: string,
    handler: (...args: T) => Promise<void>
  ): (...args: T) => Promise<void> {
    return async (...args: T) => {
      return startActiveSpan(
        {
          name: `command.${commandName}`,
          op: 'command',
        },
        async () => {
          addBreadcrumb(`Executing async command: ${commandName}`, 'command', 'info');
          try {
            return await handler(...args);
          } catch (error) {
            captureException(error as Error, {
              context: 'command',
              commandName,
            });
            
            vscode.window.showErrorMessage(
              `Error executing ${commandName}: ${error instanceof Error ? error.message : String(error)}`
            );
            
            throw error;
          }
        }
      );
    };
  }

  public addFeature = (/* ... parameters ... */) => {
    // Your existing implementation
  };

  public evaluateFlag = async (/* ... parameters ... */) => {
    // Your existing implementation
  };
}
```

## Example: Enhanced Event Handler Provider

For providers that handle events:

```typescript
import * as vscode from 'vscode';
import { addBreadcrumb, captureException, startActiveSpan } from '../utils/sentry';

export default class WindowEventHandlerProvider {
  constructor(
    private context: vscode.ExtensionContext,
    private outlineStore: OutlineStore,
    private documentFilter: vscode.DocumentFilter
  ) {}

  public register(): vscode.Disposable[] {
    return [
      vscode.window.onDidChangeActiveTextEditor(
        this.wrapEventHandler('onDidChangeActiveTextEditor', this.onDidChangeActiveTextEditor)
      ),
      vscode.window.onDidChangeTextEditorSelection(
        this.wrapEventHandler('onDidChangeTextEditorSelection', this.onDidChangeTextEditorSelection)
      ),
    ];
  }

  /**
   * Wrap an event handler with Sentry tracking
   */
  private wrapEventHandler<T>(
    eventName: string,
    handler: (event: T) => void
  ): (event: T) => void {
    return (event: T) => {
      return startActiveSpan(
        {
          name: `event.${eventName}`,
          op: 'event',
        },
        () => {
          try {
            return handler.call(this, event);
          } catch (error) {
            // Log but don't show error UI for events (too noisy)
            captureException(error as Error, {
              context: 'event-handler',
              eventName,
            });
            
            console.error(`Error in ${eventName}:`, error);
          }
        }
      );
    };
  }

  private onDidChangeActiveTextEditor = (editor: vscode.TextEditor | undefined) => {
    // Your existing implementation
  };

  private onDidChangeTextEditorSelection = (event: vscode.TextEditorSelectionChangeEvent) => {
    // Your existing implementation
  };
}
```

## Best Practices

### 1. Wrap All Command Handlers

Commands are user-facing actions, so it's important to:
- Track their execution with spans
- Capture and report errors
- Show user-friendly error messages

### 2. Wrap Event Handlers Selectively

Event handlers fire frequently, so:
- Only wrap critical event handlers
- Don't show error UI (too noisy)
- Log errors silently to Sentry

### 3. Add Context to Errors

Always include relevant context when capturing exceptions:

```typescript
captureException(error, {
  context: 'command.addFeature',
  documentUri: textEditor.document.uri.toString(),
  position: position.toString(),
  lineText: textEditor.document.lineAt(position.line).text,
});
```

### 4. Use Breadcrumbs for Debugging

Add breadcrumbs at key points:

```typescript
addBreadcrumb('Starting file search', 'operation', 'info', {
  pattern: '**/*.yaml',
});

// ... operation ...

addBreadcrumb('File search completed', 'operation', 'info', {
  filesFound: files.length,
});
```

### 5. Create Spans for Long Operations

For operations that take time:

```typescript
import { startActiveSpan, addBreadcrumb } from '../utils/sentry';

public async processLargeFile(uri: vscode.Uri): Promise<void> {
  const stat = await vscode.workspace.fs.stat(uri);
  
  addBreadcrumb('Processing large file', 'processing', 'info', {
    'file.uri': uri.toString(),
    'file.size': stat.size,
  });
  
  return startActiveSpan(
    {
      name: 'processLargeFile',
      op: 'processing',
    },
    async () => {
      // Your processing logic
    }
  );
}
```

## When NOT to Add Sentry Tracking

Don't wrap every function - focus on:
- ❌ Simple getters/setters
- ❌ Pure utility functions
- ❌ Functions called in tight loops
- ❌ Internal helper methods

Do wrap:
- ✅ User-facing commands
- ✅ Critical event handlers
- ✅ File I/O operations
- ✅ API calls
- ✅ Long-running operations

## Testing Your Sentry Integration

1. Set a breakpoint in your wrapped function
2. Trigger the command/event
3. Check the Sentry dashboard for:
   - Transaction (span) appears
   - Error is captured (if you throw one)
   - Breadcrumbs show up in error details

## Performance Considerations

Sentry tracking adds minimal overhead:
- Span creation: ~0.1ms
- Breadcrumb: ~0.05ms
- Error capture: ~1-5ms

For high-frequency events (e.g., cursor movement), consider:
- Debouncing the handler
- Only tracking errors, not spans
- Sampling (track 1 in N events)

