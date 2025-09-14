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



// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('Activating Flagpole extension...');

  const config = vscode.workspace.getConfiguration('flagpole-explorer');
  const flagpoleFileDocumentFilter: vscode.DocumentFilter = {
    language: 'yaml',
    scheme: 'file',
    pattern: config.get('flagpoleFilePattern'),
  };

  const outlineStore = new OutlineStore();
  const selectedElementsStore = new SelectedElementsStore(outlineStore, flagpoleFileDocumentFilter);
  context.subscriptions.push(
    outlineStore,
    ...selectedElementsStore.register(),
    ...new CommandProvider(context).register(),
    ...new WindowEventHandlerProvider(context, outlineStore, flagpoleFileDocumentFilter).register(),
    ...new WorkspaceEventHandlerProvider(outlineStore, flagpoleFileDocumentFilter).register(),
    ...new ConditionLanguageProvider(selectedElementsStore, flagpoleFileDocumentFilter).register(),
    ...new SegmentLanguageProvider(selectedElementsStore, flagpoleFileDocumentFilter).register(),
    ...new FeatureNameLanguageProvider(selectedElementsStore, flagpoleFileDocumentFilter).register(),
  );

  if (flagpoleFileDocumentFilter.pattern) {
    vscode.workspace.findFiles(flagpoleFileDocumentFilter.pattern, '**/node_modules/**').then(found => {
      found.forEach(uri => outlineStore.fire({uri}));
    });
  }
}

// This method is called when your extension is deactivated
export function deactivate() {
  console.log("Deactivated Flagpole extension.");
}
