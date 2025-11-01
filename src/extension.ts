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
import { initializeSentry } from './instrumentation';
import type { ExtensionContextWithSentry } from './types';

const DSN = {
  'sentry/vscode-flagpole-explorer': 'https://de6384136e8cd20d0224bfc245100b12@o1.ingest.us.sentry.io/4509634000519168'
};

const scope = initializeSentry({
  dsn: DSN['sentry/vscode-flagpole-explorer'],
});

function withSentry(fn: () => void) {
  try {
    fn();
  } catch (error) {
    scope.captureException(error);
    throw error;
  }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  withSentry(() => {
    const contextWithSentry: ExtensionContextWithSentry = {
      ...context,
      scope,
    };
    console.log('Activating Flagpole extension...');

    const config = vscode.workspace.getConfiguration('flagpole-explorer');
    const flagpoleFileDocumentFilter: vscode.DocumentFilter = {
      language: 'yaml',
      scheme: 'file',
      pattern: config.get('flagpoleFilePattern'),
    };

    const outlineStore = new OutlineStore();
    const selectedElementsStore = new SelectedElementsStore(contextWithSentry, outlineStore, flagpoleFileDocumentFilter);
    contextWithSentry.subscriptions.push(
      outlineStore,
      ...selectedElementsStore.register(),
      ...new CommandProvider(contextWithSentry).register(),
      ...new WindowEventHandlerProvider(contextWithSentry, outlineStore, flagpoleFileDocumentFilter).register(),
      ...new WorkspaceEventHandlerProvider(contextWithSentry, outlineStore, flagpoleFileDocumentFilter).register(),
      ...new ConditionLanguageProvider(contextWithSentry, selectedElementsStore, flagpoleFileDocumentFilter).register(),
      ...new SegmentLanguageProvider(contextWithSentry, selectedElementsStore, flagpoleFileDocumentFilter).register(),
      ...new FeatureNameLanguageProvider(contextWithSentry, selectedElementsStore, flagpoleFileDocumentFilter).register(),
    );

    if (flagpoleFileDocumentFilter.pattern) {
      vscode.workspace.findFiles(flagpoleFileDocumentFilter.pattern, '**/node_modules/**').then(found => {
        found.forEach(uri => outlineStore.fire({uri}));
      });
    }
  });
}

// This method is called when your extension is deactivated
export function deactivate() {
  withSentry(() => {
    console.log("Deactivated Flagpole extension.");
  });
}