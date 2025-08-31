// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

import OutlineStore from './stores/outlineStore';
import TextEditorCommandProvider from './providers/textEditorCommandProvider';
import WindowEventHandlerProvider from './providers/windowEventHandlerProvider';
import WorkspaceEventHandlerProvider from './providers/workspaceEventHandlerProvider';
import FeatureNameLanguageProvider from './providers/featureNameLanguageProvider';
import SegmentLanguageProvider from './providers/segmentLanguageProvider';
import ConditionLanguageProvider from './providers/conditionLanguageProvider';

const flagpoleFileDocumentFilter: vscode.DocumentFilter = {
  language: 'yaml',
  scheme: 'file',
  pattern: '**/flagpole.yaml',
};

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('Activating Flagpole extension...');

  const outlineStore = new OutlineStore();
  context.subscriptions.push(
    outlineStore,
    ...new TextEditorCommandProvider(outlineStore, flagpoleFileDocumentFilter).register(),
    ...new WindowEventHandlerProvider(outlineStore, flagpoleFileDocumentFilter).register(),
    ...new WorkspaceEventHandlerProvider(outlineStore, flagpoleFileDocumentFilter).register(),
    ...new FeatureNameLanguageProvider(outlineStore, flagpoleFileDocumentFilter).register(),
    ...new SegmentLanguageProvider(outlineStore, flagpoleFileDocumentFilter).register(),
    ...new ConditionLanguageProvider(outlineStore, flagpoleFileDocumentFilter).register(),
  );

  vscode.workspace.findFiles('**/flagpole.yaml', '**/node_modules/**').then(found => {
    found.forEach(uri => outlineStore.fire({uri}));
  });
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log("Deactivated Flagpole extension.");
}
