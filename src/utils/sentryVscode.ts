import * as vscode from 'vscode';
import {
  startActiveSpan,
  addBreadcrumb,
  captureException,
} from './sentry';

/**
 * Wrapped VSCode API that automatically adds Sentry tracking to commands and events.
 * Use these instead of the native vscode.commands and vscode.window methods.
 * 
 * Example:
 * ```typescript
 * import * as sentryVscode from '../utils/sentryVscode';
 * 
 * // Instead of: vscode.commands.registerCommand(...)
 * sentryVscode.commands.registerCommand('my-command', handler);
 * 
 * // Instead of: vscode.window.onDidChangeActiveTextEditor(...)
 * sentryVscode.window.onDidChangeActiveTextEditor(handler);
 * ```
 */

/**
 * Helper to create a wrapped event listener with Sentry tracking.
 * Reduces boilerplate for event handler wrappers.
 */
function wrapEventListener<T>(
  eventName: string,
  listener: (e: T) => any,
  thisArgs: any,
  getContext?: (e: T) => Record<string, any>,
  onBeforeCall?: (e: T) => void
): (e: T) => any {
  return (e: T) => {
    return startActiveSpan(
      {
        name: `event.${eventName}`,
        op: 'event',
      },
      () => {
        try {
          onBeforeCall?.(e);
          return listener.call(thisArgs, e);
        } catch (error) {
          const context = getContext?.(e) || {};
          captureException(error as Error, {
            context: 'event-handler',
            eventName,
            ...context,
          });
          
          console.error(`Error in ${eventName}:`, error);
        }
      }
    );
  };
}

/**
 * Wrapped commands namespace with automatic Sentry tracking
 */
export const commands = {
  /**
   * Register a command with automatic Sentry error tracking and performance monitoring.
   * Automatically creates a span for each command execution and captures exceptions.
   */
  registerCommand<T extends any[]>(
    command: string,
    callback: (...args: T) => any,
    thisArg?: any
  ): vscode.Disposable {
    const wrappedCallback = (...args: T) => {
      return startActiveSpan(
        {
          name: `command.${command}`,
          op: 'command',
        },
        () => {
          addBreadcrumb(`Executing command: ${command}`, 'command', 'info');
          try {
            const result = callback.apply(thisArg, args);
            
            // Handle both sync and async results
            if (result instanceof Promise) {
              return result.catch((error: Error) => {
                captureException(error, {
                  context: 'command',
                  commandName: command,
                });
                
                vscode.window.showErrorMessage(
                  `Error executing ${command}: ${error.message}`
                );
                
                throw error;
              });
            }
            
            return result;
          } catch (error) {
            captureException(error as Error, {
              context: 'command',
              commandName: command,
            });
            
            vscode.window.showErrorMessage(
              `Error executing ${command}: ${error instanceof Error ? error.message : String(error)}`
            );
            
            throw error;
          }
        }
      );
    };

    return vscode.commands.registerCommand(command, wrappedCallback, thisArg);
  },

  /**
   * Register a text editor command with automatic Sentry tracking.
   */
  registerTextEditorCommand(
    command: string,
    callback: (
      textEditor: vscode.TextEditor,
      edit: vscode.TextEditorEdit,
      ...args: any[]
    ) => void,
    thisArg?: any
  ): vscode.Disposable {
    const wrappedCallback = (
      textEditor: vscode.TextEditor,
      edit: vscode.TextEditorEdit,
      ...args: any[]
    ) => {
      return startActiveSpan(
        {
          name: `textEditorCommand.${command}`,
          op: 'command',
        },
        () => {
          addBreadcrumb(`Executing text editor command: ${command}`, 'command', 'info', {
            'document.uri': textEditor.document.uri.toString(),
            'document.languageId': textEditor.document.languageId,
          });
          
          try {
            return callback.apply(thisArg, [textEditor, edit, ...args]);
          } catch (error) {
            captureException(error as Error, {
              context: 'text-editor-command',
              commandName: command,
              documentUri: textEditor.document.uri.toString(),
            });
            
            vscode.window.showErrorMessage(
              `Error executing ${command}: ${error instanceof Error ? error.message : String(error)}`
            );
            
            throw error;
          }
        }
      );
    };

    return vscode.commands.registerTextEditorCommand(command, wrappedCallback, thisArg);
  },
};

/**
 * Wrapped window namespace with automatic Sentry tracking for event handlers
 */
export const window = {
  /**
   * Wrap window.onDidChangeActiveTextEditor with Sentry tracking.
   * Errors are logged but not shown to users (events fire frequently).
   */
  onDidChangeActiveTextEditor(
    listener: (e: vscode.TextEditor | undefined) => any,
    thisArgs?: any,
    disposables?: vscode.Disposable[]
  ): vscode.Disposable {
    const wrappedListener = wrapEventListener(
      'onDidChangeActiveTextEditor',
      listener,
      thisArgs,
      (e) => ({ documentUri: e?.document?.uri?.toString() })
    );
    return vscode.window.onDidChangeActiveTextEditor(wrappedListener, thisArgs, disposables);
  },

  /**
   * Wrap window.onDidChangeTextEditorSelection with Sentry tracking.
   */
  onDidChangeTextEditorSelection(
    listener: (e: vscode.TextEditorSelectionChangeEvent) => any,
    thisArgs?: any,
    disposables?: vscode.Disposable[]
  ): vscode.Disposable {
    const wrappedListener = wrapEventListener(
      'onDidChangeTextEditorSelection',
      listener,
      thisArgs,
      (e) => ({ documentUri: e.textEditor.document.uri.toString() })
    );
    return vscode.window.onDidChangeTextEditorSelection(wrappedListener, thisArgs, disposables);
  },

  /**
   * Wrap window.onDidChangeVisibleTextEditors with Sentry tracking.
   */
  onDidChangeVisibleTextEditors(
    listener: (e: readonly vscode.TextEditor[]) => any,
    thisArgs?: any,
    disposables?: vscode.Disposable[]
  ): vscode.Disposable {
    const wrappedListener = wrapEventListener(
      'onDidChangeVisibleTextEditors',
      listener,
      thisArgs,
      (e) => ({ editorsCount: e.length })
    );
    return vscode.window.onDidChangeVisibleTextEditors(wrappedListener, thisArgs, disposables);
  },

  /**
   * Wrap window.onDidChangeWindowState with Sentry tracking.
   */
  onDidChangeWindowState(
    listener: (e: vscode.WindowState) => any,
    thisArgs?: any,
    disposables?: vscode.Disposable[]
  ): vscode.Disposable {
    const wrappedListener = wrapEventListener(
      'onDidChangeWindowState',
      listener,
      thisArgs,
      (e) => ({ focused: e.focused })
    );
    return vscode.window.onDidChangeWindowState(wrappedListener, thisArgs, disposables);
  },
};

/**
 * Wrapped workspace namespace with automatic Sentry tracking for events
 */
export const workspace = {
  /**
   * Wrap workspace.onDidChangeTextDocument with Sentry tracking.
   */
  onDidChangeTextDocument(
    listener: (e: vscode.TextDocumentChangeEvent) => any,
    thisArgs?: any,
    disposables?: vscode.Disposable[]
  ): vscode.Disposable {
    const wrappedListener = wrapEventListener(
      'onDidChangeTextDocument',
      listener,
      thisArgs,
      (e) => ({
        documentUri: e.document.uri.toString(),
        changesCount: e.contentChanges.length,
      })
    );
    return vscode.workspace.onDidChangeTextDocument(wrappedListener, thisArgs, disposables);
  },

  /**
   * Wrap workspace.onDidSaveTextDocument with Sentry tracking.
   */
  onDidSaveTextDocument(
    listener: (e: vscode.TextDocument) => any,
    thisArgs?: any,
    disposables?: vscode.Disposable[]
  ): vscode.Disposable {
    const wrappedListener = wrapEventListener(
      'onDidSaveTextDocument',
      listener,
      thisArgs,
      (e) => ({ documentUri: e.uri.toString() })
    );
    return vscode.workspace.onDidSaveTextDocument(wrappedListener, thisArgs, disposables);
  },

  /**
   * Wrap workspace.onDidOpenTextDocument with Sentry tracking.
   */
  onDidOpenTextDocument(
    listener: (e: vscode.TextDocument) => any,
    thisArgs?: any,
    disposables?: vscode.Disposable[]
  ): vscode.Disposable {
    const wrappedListener = wrapEventListener(
      'onDidOpenTextDocument',
      listener,
      thisArgs,
      (e) => ({ documentUri: e.uri.toString() })
    );
    return vscode.workspace.onDidOpenTextDocument(wrappedListener, thisArgs, disposables);
  },

  /**
   * Wrap workspace.onDidCloseTextDocument with Sentry tracking.
   */
  onDidCloseTextDocument(
    listener: (e: vscode.TextDocument) => any,
    thisArgs?: any,
    disposables?: vscode.Disposable[]
  ): vscode.Disposable {
    const wrappedListener = wrapEventListener(
      'onDidCloseTextDocument',
      listener,
      thisArgs,
      (e) => ({ documentUri: e.uri.toString() })
    );
    return vscode.workspace.onDidCloseTextDocument(wrappedListener, thisArgs, disposables);
  },

  /**
   * Wrap workspace.onDidChangeConfiguration with Sentry tracking.
   */
  onDidChangeConfiguration(
    listener: (e: vscode.ConfigurationChangeEvent) => any,
    thisArgs?: any,
    disposables?: vscode.Disposable[]
  ): vscode.Disposable {
    const wrappedListener = wrapEventListener(
      'onDidChangeConfiguration',
      listener,
      thisArgs
    );
    return vscode.workspace.onDidChangeConfiguration(wrappedListener, thisArgs, disposables);
  },

  /**
   * Wrap workspace.onDidRenameFiles with Sentry tracking.
   */
  onDidRenameFiles(
    listener: (e: vscode.FileRenameEvent) => any,
    thisArgs?: any,
    disposables?: vscode.Disposable[]
  ): vscode.Disposable {
    const wrappedListener = wrapEventListener(
      'onDidRenameFiles',
      listener,
      thisArgs,
      (e) => ({ filesCount: e.files.length }),
      (e) => {
        addBreadcrumb('Files renamed', 'workspace', 'info', {
          filesCount: e.files.length,
          files: e.files.map(f => ({ old: f.oldUri.path, new: f.newUri.path })),
        });
      }
    );
    return vscode.workspace.onDidRenameFiles(wrappedListener, thisArgs, disposables);
  },

  /**
   * Wrap workspace.onDidChangeWorkspaceFolders with Sentry tracking.
   */
  onDidChangeWorkspaceFolders(
    listener: (e: vscode.WorkspaceFoldersChangeEvent) => any,
    thisArgs?: any,
    disposables?: vscode.Disposable[]
  ): vscode.Disposable {
    const wrappedListener = wrapEventListener(
      'onDidChangeWorkspaceFolders',
      listener,
      thisArgs,
      (e) => ({
        addedCount: e.added.length,
        removedCount: e.removed.length,
      }),
      (e) => {
        addBreadcrumb('Workspace folders changed', 'workspace', 'info', {
          addedCount: e.added.length,
          removedCount: e.removed.length,
          added: e.added.map(f => f.uri.path),
          removed: e.removed.map(f => f.uri.path),
        });
      }
    );
    return vscode.workspace.onDidChangeWorkspaceFolders(wrappedListener, thisArgs, disposables);
  },
};

/**
 * Helper function to wrap any custom async operation with Sentry tracking.
 * Use this for operations that don't fit the command/event patterns above.
 */
export function wrapOperation<T>(
  operationName: string,
  operation: () => Promise<T>
): Promise<T> {
  return startActiveSpan(
    {
      name: operationName,
      op: 'operation',
    },
    async () => {
      addBreadcrumb(`Starting operation: ${operationName}`, 'operation', 'info');
      try {
        const result = await operation();
        addBreadcrumb(`Completed operation: ${operationName}`, 'operation', 'info');
        return result;
      } catch (error) {
        captureException(error as Error, {
          context: 'operation',
          operationName,
        });
        throw error;
      }
    }
  );
}

/**
 * Helper function to wrap any custom sync operation with Sentry tracking.
 */
export function wrapOperationSync<T>(
  operationName: string,
  operation: () => T
): T {
  return startActiveSpan(
    {
      name: operationName,
      op: 'operation',
    },
    () => {
      addBreadcrumb(`Starting operation: ${operationName}`, 'operation', 'info');
      try {
        const result = operation();
        addBreadcrumb(`Completed operation: ${operationName}`, 'operation', 'info');
        return result;
      } catch (error) {
        captureException(error as Error, {
          context: 'operation',
          operationName,
        });
        throw error;
      }
    }
  );
}

