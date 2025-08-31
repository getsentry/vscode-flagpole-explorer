import * as vscode from 'vscode';
import { LogicalFeature, LogicalValue } from '../transform/transformers';
import { getRolloutStateIconPath } from '../utils/getRolloutStateIconPath';

export class FileTreeItem extends vscode.TreeItem {
  constructor(
    uri: vscode.Uri,
    description: string,
  ) {
    super(uri, vscode.TreeItemCollapsibleState.Expanded);
    this.description = description;
    this.iconPath = new vscode.ThemeIcon('json');
  }
}

export class ValueTreeItem extends vscode.TreeItem {
  constructor(
    element: LogicalValue,
    getIconPath: (element: LogicalValue) => undefined | vscode.ThemeIcon,
  ) {
    super(element.value, vscode.TreeItemCollapsibleState.Collapsed);
    this.description = String(Object.keys(element.children).length);
    this.iconPath = getIconPath(element);
  }
}

export class FeatureTreeItem extends vscode.TreeItem {
  constructor(feature: LogicalFeature) {
    super(feature.name, vscode.TreeItemCollapsibleState.None);
    this.iconPath = getRolloutStateIconPath(feature.rolloutState);

    this.command = {
      title: 'view',
      command: 'editor.action.goToLocations',
      arguments: [
        feature.uri,
        feature.symbol.selectionRange.start,
        [feature.symbol.selectionRange],
        'goto',
        'Unabled to find flag'
      ],
    };
  }
}
