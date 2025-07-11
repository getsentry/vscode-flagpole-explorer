// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { FlagsByCreatedAtProvider, FlagsByEnabledProvider, FlagsByOwnerProvider, FlagsByRolloutProvider} from './flagpoleFlagsProvider';
import { Element } from './elements';
import FileMap from './fileMap';
import { Feature } from './types';
import FlagpoleFile from './flagpoleFile';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('Activating Flagpole extension...');
	
	const fileMap = new FileMap();
	const flagpoleYamlWatcher = vscode.workspace.createFileSystemWatcher('**/flagpole.yml');
	
	const byEnabledProvider = new FlagsByEnabledProvider(fileMap);
	const byEnabledTreeView = vscode.window.createTreeView('sentryFlagpoleFlagsByEnabled', {treeDataProvider: byEnabledProvider});
	const byCreatedAtProvider = new FlagsByCreatedAtProvider(fileMap);
	const byCreatedAtTreeView = vscode.window.createTreeView('sentryFlagpoleFlagsByCreatedAt', {treeDataProvider: byCreatedAtProvider});
	const byOwnerProvider = new FlagsByOwnerProvider(fileMap);
	const byOwnerTreeView = vscode.window.createTreeView('sentryFlagpoleFlagsByOwner', {treeDataProvider: byOwnerProvider});
	const byRolloutProvider = new FlagsByRolloutProvider(fileMap);
	const byRolloutTreeView = vscode.window.createTreeView('sentryFlagpoleFlagsByRollout', {treeDataProvider: byRolloutProvider});	
	
	const refreshProviders = () => {
		byEnabledProvider.refresh();
		byCreatedAtProvider.refresh();
		byOwnerProvider.refresh();
		byRolloutProvider.refresh();
	};

	const reveal = (view: vscode.TreeView<Element>, maybeElement: Element | undefined | null) => {
		if (maybeElement && view.visible) {
			view.reveal(maybeElement, {select: true});
		}
	};
	const revealFeature = async (flagpoleFile: FlagpoleFile, feature: Feature) => {
		reveal(byEnabledTreeView, await byEnabledProvider.featureToElement(flagpoleFile, feature));
		reveal(byCreatedAtTreeView, await byCreatedAtProvider.featureToElement(flagpoleFile, feature));
		reveal(byOwnerTreeView, await byOwnerProvider.featureToElement(flagpoleFile, feature));
		reveal(byRolloutTreeView, await byRolloutProvider.featureToElement(flagpoleFile, feature));
	};

	const statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
	const updateStatusBar = () => {
	};

	context.subscriptions.push(
		byEnabledTreeView,
		byCreatedAtTreeView,
		byOwnerTreeView,
		byRolloutTreeView,
		statusBar,
		flagpoleYamlWatcher.onDidCreate((uri) => {
			fileMap.add(uri).then(refreshProviders);
		}),
		flagpoleYamlWatcher.onDidChange((uri) => {
			fileMap.update(uri).then(refreshProviders);
		}),
		flagpoleYamlWatcher.onDidDelete((uri) => {
			fileMap.remove(uri);
			refreshProviders();
		}),

		vscode.window.onDidChangeTextEditorSelection(async (event) => {
			if (event.textEditor.document.uri.path.endsWith('/flagpole.yml')) {
				const position = event.selections.at(0)?.start;
				const document = event.textEditor.document;
				const flagpoleFile = fileMap.getFile(document.uri);
				if (!position || !flagpoleFile) {
					return;
				}
				const feature = flagpoleFile.nearestFeatureFrom(document.offsetAt(position));
				if (feature) {
		   		await revealFeature(flagpoleFile, feature);
				}
			}
		}),

		vscode.commands.registerCommand('sentryFlagpoleAddSegment', (uri) => {
			// console.log('add segment', uri);
			// vscode.window.showQuickPick([
			// 	'one',
			// 	'two',
			// 	'three'
			// ], {});
		}),

		vscode.window.onDidChangeActiveTextEditor(updateStatusBar),
		vscode.window.onDidChangeTextEditorSelection(updateStatusBar),
	);

	vscode.workspace.findFiles('**/flagpole.yml', '**/node_modules/**').then(found => {
		Promise.all(found.map(uri => fileMap.add(uri))).then(refreshProviders);
	});

	updateStatusBar();
}

// This method is called when your extension is deactivated
export function deactivate() {
	console.log("Deactivated Flagpole extension.");
}


