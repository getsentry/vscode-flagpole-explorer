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
    const wrappedListener = (e: vscode.TextEditor | undefined) => {
      return startActiveSpan(
        {
          name: 'event.onDidChangeActiveTextEditor',
          op: 'event',
        },
        () => {
          try {
            return listener.call(thisArgs, e);
          } catch (error) {
            // Don't show UI errors for events (too noisy)
            captureException(error as Error, {
              context: 'event-handler',
              eventName: 'onDidChangeActiveTextEditor',
              documentUri: e?.document?.uri?.toString(),
            });
            
            console.error('Error in onDidChangeActiveTextEditor:', error);
          }
        }
      );
    };

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
    const wrappedListener = (e: vscode.TextEditorSelectionChangeEvent) => {
      return startActiveSpan(
        {
          name: 'event.onDidChangeTextEditorSelection',
          op: 'event',
        },
        () => {
          try {
            return listener.call(thisArgs, e);
          } catch (error) {
            captureException(error as Error, {
              context: 'event-handler',
              eventName: 'onDidChangeTextEditorSelection',
              documentUri: e.textEditor.document.uri.toString(),
            });
            
            console.error('Error in onDidChangeTextEditorSelection:', error);
          }
        }
      );
    };

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
    const wrappedListener = (e: readonly vscode.TextEditor[]) => {
      return startActiveSpan(
        {
          name: 'event.onDidChangeVisibleTextEditors',
          op: 'event',
        },
        () => {
          try {
            return listener.call(thisArgs, e);
          } catch (error) {
            captureException(error as Error, {
              context: 'event-handler',
              eventName: 'onDidChangeVisibleTextEditors',
              editorsCount: e.length,
            });
            
            console.error('Error in onDidChangeVisibleTextEditors:', error);
          }
        }
      );
    };

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
    const wrappedListener = (e: vscode.WindowState) => {
      return startActiveSpan(
        {
          name: 'event.onDidChangeWindowState',
          op: 'event',
        },
        () => {
          try {
            return listener.call(thisArgs, e);
          } catch (error) {
            captureException(error as Error, {
              context: 'event-handler',
              eventName: 'onDidChangeWindowState',
              focused: e.focused,
            });
            
            console.error('Error in onDidChangeWindowState:', error);
          }
        }
      );
    };

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
    const wrappedListener = (e: vscode.TextDocumentChangeEvent) => {
      return startActiveSpan(
        {
          name: 'event.onDidChangeTextDocument',
          op: 'event',
        },
        () => {
          try {
            return listener.call(thisArgs, e);
          } catch (error) {
            captureException(error as Error, {
              context: 'event-handler',
              eventName: 'onDidChangeTextDocument',
              documentUri: e.document.uri.toString(),
              changesCount: e.contentChanges.length,
            });
            
            console.error('Error in onDidChangeTextDocument:', error);
          }
        }
      );
    };

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
    const wrappedListener = (e: vscode.TextDocument) => {
      return startActiveSpan(
        {
          name: 'event.onDidSaveTextDocument',
          op: 'event',
        },
        () => {
          try {
            return listener.call(thisArgs, e);
          } catch (error) {
            captureException(error as Error, {
              context: 'event-handler',
              eventName: 'onDidSaveTextDocument',
              documentUri: e.uri.toString(),
            });
            
            console.error('Error in onDidSaveTextDocument:', error);
          }
        }
      );
    };

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
    const wrappedListener = (e: vscode.TextDocument) => {
      return startActiveSpan(
        {
          name: 'event.onDidOpenTextDocument',
          op: 'event',
        },
        () => {
          try {
            return listener.call(thisArgs, e);
          } catch (error) {
            captureException(error as Error, {
              context: 'event-handler',
              eventName: 'onDidOpenTextDocument',
              documentUri: e.uri.toString(),
            });
            
            console.error('Error in onDidOpenTextDocument:', error);
          }
        }
      );
    };

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
    const wrappedListener = (e: vscode.TextDocument) => {
      return startActiveSpan(
        {
          name: 'event.onDidCloseTextDocument',
          op: 'event',
        },
        () => {
          try {
            return listener.call(thisArgs, e);
          } catch (error) {
            captureException(error as Error, {
              context: 'event-handler',
              eventName: 'onDidCloseTextDocument',
              documentUri: e.uri.toString(),
            });
            
            console.error('Error in onDidCloseTextDocument:', error);
          }
        }
      );
    };

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
    const wrappedListener = (e: vscode.ConfigurationChangeEvent) => {
      return startActiveSpan(
        {
          name: 'event.onDidChangeConfiguration',
          op: 'event',
        },
        () => {
          try {
            return listener.call(thisArgs, e);
          } catch (error) {
            captureException(error as Error, {
              context: 'event-handler',
              eventName: 'onDidChangeConfiguration',
            });
            
            console.error('Error in onDidChangeConfiguration:', error);
          }
        }
      );
    };

    return vscode.workspace.onDidChangeConfiguration(wrappedListener, thisArgs, disposables);
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

