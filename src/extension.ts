// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import OutlineStore from './stores/outlineStore';
import CommandProvider from './providers/commandProvider';
import WindowEventHandlerProvider from './providers/windowEventHandlerProvider';
import WorkspaceEventHandlerProvider from './providers/workspaceEventHandlerProvider';
import FeatureNameLanguageProvider from './providers/featureNameLanguageProvider';
import SegmentLanguageProvider from './providers/segmentLanguageProvider';
import ConditionLanguageProvider from './providers/conditionLanguageProvider';
import SelectedElementsStore from './stores/selectedElementsStore';
import {
  initializeSentry,
  withSentrySync,
  addBreadcrumb,
  captureException,
  flushSentry,
  startActiveSpan,
  startActiveSpanAsync
} from './utils/sentry';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('Activating Flagpole extension...');

  // Initialize Sentry first (before we can use any spans)
  try {
    initializeSentry(context);
    addBreadcrumb('Extension activation started', 'lifecycle');
  } catch (error) {
    console.error('Failed to initialize Sentry:', error);
    // Continue without Sentry if initialization fails
  }

  // Wrap the entire activation in a Sentry span (after Sentry is initialized)
  return startActiveSpan(
    {
      name: 'extension.activate',
      op: 'activation',
    },
    () => {
      try {
        const config = vscode.workspace.getConfiguration('flagpole-explorer');
        const flagpoleFileDocumentFilter: vscode.DocumentFilter = {
          language: 'yaml',
          scheme: 'file',
          pattern: config.get('flagpoleFilePattern'),
        };

        addBreadcrumb('Creating extension stores', 'setup', 'info', {
          flagpolePattern: flagpoleFileDocumentFilter.pattern,
        });

        // Wrap store creation in spans
        const outlineStore = startActiveSpan(
          { name: 'create.outlineStore', op: 'setup' },
          () => new OutlineStore()
        );

        const selectedElementsStore = startActiveSpan(
          { name: 'create.selectedElementsStore', op: 'setup' },
          () => new SelectedElementsStore(outlineStore, flagpoleFileDocumentFilter)
        );

        addBreadcrumb('Registering providers', 'setup');

        // Register all providers with error handling
        startActiveSpan({ name: 'register.providers', op: 'setup' }, () => {
          context.subscriptions.push(
            outlineStore,
            ...safeRegister('selectedElementsStore', () => selectedElementsStore.register()),
            ...safeRegister('commandProvider', () => new CommandProvider(context).register()),
            ...safeRegister('windowEventHandler', () => 
              new WindowEventHandlerProvider(context, outlineStore, flagpoleFileDocumentFilter).register()
            ),
            ...safeRegister('workspaceEventHandler', () => 
              new WorkspaceEventHandlerProvider(outlineStore, flagpoleFileDocumentFilter).register()
            ),
            ...safeRegister('conditionLanguageProvider', () => 
              new ConditionLanguageProvider(selectedElementsStore, flagpoleFileDocumentFilter).register()
            ),
            ...safeRegister('segmentLanguageProvider', () => 
              new SegmentLanguageProvider(selectedElementsStore, flagpoleFileDocumentFilter).register()
            ),
            ...safeRegister('featureNameLanguageProvider', () => 
              new FeatureNameLanguageProvider(selectedElementsStore, flagpoleFileDocumentFilter).register()
            ),
          );
        });

        // Find and process flagpole files with error handling
        if (flagpoleFileDocumentFilter.pattern) {
          addBreadcrumb('Searching for flagpole files', 'initialization', 'info', {
            pattern: flagpoleFileDocumentFilter.pattern,
          });

          vscode.workspace
            .findFiles(flagpoleFileDocumentFilter.pattern, '**/node_modules/**')
            .then(
              withSentrySync('findFiles.success', (found: vscode.Uri[]) => {
                addBreadcrumb('Found flagpole files', 'initialization', 'info', {
                  count: found.length,
                });
                found.forEach(uri => {
                  try {
                    outlineStore.fire({uri});
                  } catch (error) {
                    captureException(error as Error, {
                      context: 'outlineStore.fire',
                      uri: uri.toString(),
                    });
                  }
                });
              }),
              (error: Error) => {
                captureException(error, {
                  context: 'findFiles',
                  pattern: flagpoleFileDocumentFilter.pattern,
                });
              }
            );
        }

        addBreadcrumb('Extension activation completed', 'lifecycle');
        console.log('Flagpole extension activated successfully');
      } catch (error) {
        addBreadcrumb('Extension activation failed', 'lifecycle', 'error');
        captureException(error as Error, {
          context: 'extension.activate',
        });

        // Show error to user
        vscode.window.showErrorMessage(
          `Failed to activate Flagpole Explorer: ${error instanceof Error ? error.message : String(error)}`
        );

        throw error;
      }
    }
  );
}

/**
 * Safely register a provider, capturing any errors to Sentry.
 */
function safeRegister(providerName: string, register: () => vscode.Disposable[]): vscode.Disposable[] {
  return startActiveSpan(
    { name: `register.${providerName}`, op: 'provider.register' },
    () => {
      try {
        const disposables = register();
        addBreadcrumb(`Registered ${providerName}`, 'provider', 'info');
        return disposables;
      } catch (error) {
        addBreadcrumb(`Failed to register ${providerName}`, 'provider', 'error');
        captureException(error as Error, {
          context: 'provider.register',
          provider: providerName,
        });

        // Show warning but don't prevent extension from loading
        vscode.window.showWarningMessage(
          `Failed to register ${providerName}: ${error instanceof Error ? error.message : String(error)}`
        );

        return [];
      }
    }
  );
}

// This method is called when your extension is deactivated
export function deactivate() {
  return startActiveSpanAsync(
    {
      name: 'extension.deactivate',
      op: 'deactivation',
    },
    async () => {
      console.log("Deactivating Flagpole extension...");

      try {
        addBreadcrumb('Extension deactivation started', 'lifecycle');

        // Flush any pending Sentry events before shutdown
        await flushSentry();

        addBreadcrumb('Extension deactivation completed', 'lifecycle');
        console.log("Deactivated Flagpole extension.");
      } catch (error) {
        console.error('Error during deactivation:', error);
        // Don't throw - we're shutting down anyway
      }
    }
  );
}

export default { activate, deactivate };
