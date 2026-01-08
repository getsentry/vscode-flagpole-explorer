"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.workspace = exports.window = exports.commands = void 0;
exports.wrapOperation = wrapOperation;
exports.wrapOperationSync = wrapOperationSync;
const vscode = __importStar(require("vscode"));
const sentry_1 = require("./sentry");
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
function wrapEventListener(eventName, listener, thisArgs, getContext, onBeforeCall) {
    return (e) => {
        return (0, sentry_1.startActiveSpan)({
            name: `event.${eventName}`,
            op: 'event',
        }, () => {
            try {
                onBeforeCall?.(e);
                return listener.call(thisArgs, e);
            }
            catch (error) {
                const context = getContext?.(e) || {};
                (0, sentry_1.captureException)(error, {
                    context: 'event-handler',
                    eventName,
                    ...context,
                });
                console.error(`Error in ${eventName}:`, error);
            }
        });
    };
}
/**
 * Wrapped commands namespace with automatic Sentry tracking
 */
exports.commands = {
    /**
     * Register a command with automatic Sentry error tracking and performance monitoring.
     * Automatically creates a span for each command execution and captures exceptions.
     */
    registerCommand(command, callback, thisArg) {
        const wrappedCallback = (...args) => {
            return (0, sentry_1.startActiveSpan)({
                name: `command.${command}`,
                op: 'command',
            }, () => {
                (0, sentry_1.addBreadcrumb)(`Executing command: ${command}`, 'command', 'info');
                try {
                    const result = callback.apply(thisArg, args);
                    // Handle both sync and async results
                    if (result instanceof Promise) {
                        return result.catch((error) => {
                            (0, sentry_1.captureException)(error, {
                                context: 'command',
                                commandName: command,
                            });
                            vscode.window.showErrorMessage(`Error executing ${command}: ${error.message}`);
                            throw error;
                        });
                    }
                    return result;
                }
                catch (error) {
                    (0, sentry_1.captureException)(error, {
                        context: 'command',
                        commandName: command,
                    });
                    vscode.window.showErrorMessage(`Error executing ${command}: ${error instanceof Error ? error.message : String(error)}`);
                    throw error;
                }
            });
        };
        return vscode.commands.registerCommand(command, wrappedCallback, thisArg);
    },
    /**
     * Register a text editor command with automatic Sentry tracking.
     */
    registerTextEditorCommand(command, callback, thisArg) {
        const wrappedCallback = (textEditor, edit, ...args) => {
            return (0, sentry_1.startActiveSpan)({
                name: `textEditorCommand.${command}`,
                op: 'command',
            }, () => {
                (0, sentry_1.addBreadcrumb)(`Executing text editor command: ${command}`, 'command', 'info', {
                    'document.uri': textEditor.document.uri.toString(),
                    'document.languageId': textEditor.document.languageId,
                });
                try {
                    return callback.apply(thisArg, [textEditor, edit, ...args]);
                }
                catch (error) {
                    (0, sentry_1.captureException)(error, {
                        context: 'text-editor-command',
                        commandName: command,
                        documentUri: textEditor.document.uri.toString(),
                    });
                    vscode.window.showErrorMessage(`Error executing ${command}: ${error instanceof Error ? error.message : String(error)}`);
                    throw error;
                }
            });
        };
        return vscode.commands.registerTextEditorCommand(command, wrappedCallback, thisArg);
    },
};
/**
 * Wrapped window namespace with automatic Sentry tracking for event handlers
 */
exports.window = {
    /**
     * Wrap window.onDidChangeActiveTextEditor with Sentry tracking.
     * Errors are logged but not shown to users (events fire frequently).
     */
    onDidChangeActiveTextEditor(listener, thisArgs, disposables) {
        const wrappedListener = wrapEventListener('onDidChangeActiveTextEditor', listener, thisArgs, (e) => ({ documentUri: e?.document?.uri?.toString() }));
        return vscode.window.onDidChangeActiveTextEditor(wrappedListener, thisArgs, disposables);
    },
    /**
     * Wrap window.onDidChangeTextEditorSelection with Sentry tracking.
     */
    onDidChangeTextEditorSelection(listener, thisArgs, disposables) {
        const wrappedListener = wrapEventListener('onDidChangeTextEditorSelection', listener, thisArgs, (e) => ({ documentUri: e.textEditor.document.uri.toString() }));
        return vscode.window.onDidChangeTextEditorSelection(wrappedListener, thisArgs, disposables);
    },
    /**
     * Wrap window.onDidChangeVisibleTextEditors with Sentry tracking.
     */
    onDidChangeVisibleTextEditors(listener, thisArgs, disposables) {
        const wrappedListener = wrapEventListener('onDidChangeVisibleTextEditors', listener, thisArgs, (e) => ({ editorsCount: e.length }));
        return vscode.window.onDidChangeVisibleTextEditors(wrappedListener, thisArgs, disposables);
    },
    /**
     * Wrap window.onDidChangeWindowState with Sentry tracking.
     */
    onDidChangeWindowState(listener, thisArgs, disposables) {
        const wrappedListener = wrapEventListener('onDidChangeWindowState', listener, thisArgs, (e) => ({ focused: e.focused }));
        return vscode.window.onDidChangeWindowState(wrappedListener, thisArgs, disposables);
    },
};
/**
 * Wrapped workspace namespace with automatic Sentry tracking for events
 */
exports.workspace = {
    /**
     * Wrap workspace.onDidChangeTextDocument with Sentry tracking.
     */
    onDidChangeTextDocument(listener, thisArgs, disposables) {
        const wrappedListener = wrapEventListener('onDidChangeTextDocument', listener, thisArgs, (e) => ({
            documentUri: e.document.uri.toString(),
            changesCount: e.contentChanges.length,
        }));
        return vscode.workspace.onDidChangeTextDocument(wrappedListener, thisArgs, disposables);
    },
    /**
     * Wrap workspace.onDidSaveTextDocument with Sentry tracking.
     */
    onDidSaveTextDocument(listener, thisArgs, disposables) {
        const wrappedListener = wrapEventListener('onDidSaveTextDocument', listener, thisArgs, (e) => ({ documentUri: e.uri.toString() }));
        return vscode.workspace.onDidSaveTextDocument(wrappedListener, thisArgs, disposables);
    },
    /**
     * Wrap workspace.onDidOpenTextDocument with Sentry tracking.
     */
    onDidOpenTextDocument(listener, thisArgs, disposables) {
        const wrappedListener = wrapEventListener('onDidOpenTextDocument', listener, thisArgs, (e) => ({ documentUri: e.uri.toString() }));
        return vscode.workspace.onDidOpenTextDocument(wrappedListener, thisArgs, disposables);
    },
    /**
     * Wrap workspace.onDidCloseTextDocument with Sentry tracking.
     */
    onDidCloseTextDocument(listener, thisArgs, disposables) {
        const wrappedListener = wrapEventListener('onDidCloseTextDocument', listener, thisArgs, (e) => ({ documentUri: e.uri.toString() }));
        return vscode.workspace.onDidCloseTextDocument(wrappedListener, thisArgs, disposables);
    },
    /**
     * Wrap workspace.onDidChangeConfiguration with Sentry tracking.
     */
    onDidChangeConfiguration(listener, thisArgs, disposables) {
        const wrappedListener = wrapEventListener('onDidChangeConfiguration', listener, thisArgs);
        return vscode.workspace.onDidChangeConfiguration(wrappedListener, thisArgs, disposables);
    },
    /**
     * Wrap workspace.onDidRenameFiles with Sentry tracking.
     */
    onDidRenameFiles(listener, thisArgs, disposables) {
        const wrappedListener = wrapEventListener('onDidRenameFiles', listener, thisArgs, (e) => ({ filesCount: e.files.length }), (e) => {
            (0, sentry_1.addBreadcrumb)('Files renamed', 'workspace', 'info', {
                filesCount: e.files.length,
                files: e.files.map(f => ({ old: f.oldUri.path, new: f.newUri.path })),
            });
        });
        return vscode.workspace.onDidRenameFiles(wrappedListener, thisArgs, disposables);
    },
    /**
     * Wrap workspace.onDidChangeWorkspaceFolders with Sentry tracking.
     */
    onDidChangeWorkspaceFolders(listener, thisArgs, disposables) {
        const wrappedListener = wrapEventListener('onDidChangeWorkspaceFolders', listener, thisArgs, (e) => ({
            addedCount: e.added.length,
            removedCount: e.removed.length,
        }), (e) => {
            (0, sentry_1.addBreadcrumb)('Workspace folders changed', 'workspace', 'info', {
                addedCount: e.added.length,
                removedCount: e.removed.length,
                added: e.added.map(f => f.uri.path),
                removed: e.removed.map(f => f.uri.path),
            });
        });
        return vscode.workspace.onDidChangeWorkspaceFolders(wrappedListener, thisArgs, disposables);
    },
};
/**
 * Helper function to wrap any custom async operation with Sentry tracking.
 * Use this for operations that don't fit the command/event patterns above.
 */
function wrapOperation(operationName, operation) {
    return (0, sentry_1.startActiveSpan)({
        name: operationName,
        op: 'operation',
    }, async () => {
        (0, sentry_1.addBreadcrumb)(`Starting operation: ${operationName}`, 'operation', 'info');
        try {
            const result = await operation();
            (0, sentry_1.addBreadcrumb)(`Completed operation: ${operationName}`, 'operation', 'info');
            return result;
        }
        catch (error) {
            (0, sentry_1.captureException)(error, {
                context: 'operation',
                operationName,
            });
            throw error;
        }
    });
}
/**
 * Helper function to wrap any custom sync operation with Sentry tracking.
 */
function wrapOperationSync(operationName, operation) {
    return (0, sentry_1.startActiveSpan)({
        name: operationName,
        op: 'operation',
    }, () => {
        (0, sentry_1.addBreadcrumb)(`Starting operation: ${operationName}`, 'operation', 'info');
        try {
            const result = operation();
            (0, sentry_1.addBreadcrumb)(`Completed operation: ${operationName}`, 'operation', 'info');
            return result;
        }
        catch (error) {
            (0, sentry_1.captureException)(error, {
                context: 'operation',
                operationName,
            });
            throw error;
        }
    });
}
//# sourceMappingURL=sentryVscode.js.map