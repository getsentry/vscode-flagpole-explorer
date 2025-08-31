import * as vscode from 'vscode';
import OutlineStore from '../stores/outlineStore';
import { FeatureTreeItem, FileTreeItem, ValueTreeItem } from '../treeview/treeViewItems';
import { getRolloutStateIconPath } from '../utils/getRolloutStateIconPath';
import { LogicalFeature, LogicalValue } from '../transform/transformers';
import { RolloutState } from '../types';

export type CategoryTreeViewElement = vscode.Uri | LogicalValue | LogicalFeature;

abstract class FlagsByCategoryTreeProvider implements vscode.TreeDataProvider<CategoryTreeViewElement> {
  private didChangeTreeData = new vscode.EventEmitter<CategoryTreeViewElement | undefined | null | void>();
  public onDidChangeTreeData = this.didChangeTreeData.event;

  constructor(
    private outlineStore: OutlineStore,
    private valueMapName: 'allOwners' | 'allRollouts' | 'allEnabled' | 'allCreatedAt',
    private elementFieldName: 'owner' | 'rolloutState' | 'enabled' | 'created_at',
  ) {
    this.outlineStore.event(() => {
      this.didChangeTreeData.fire(undefined);
    });
  }

  public async getTreeItem(element: CategoryTreeViewElement): Promise<vscode.TreeItem> {
    if (element instanceof vscode.Uri) {
      const outline = await this.outlineStore.getOutline(element);
      return new FileTreeItem(element, String(Object.keys(outline?.map?.[this.valueMapName] ?? {}).length));
    } else if (element instanceof LogicalValue) {
      return this.getValueTreeItem(element);
    } else {
      return new FeatureTreeItem(element);
    }
  }

  protected abstract getValueTreeItem(element: LogicalValue): vscode.TreeItem;

  public async getChildren(element?: CategoryTreeViewElement): Promise<CategoryTreeViewElement[]> {
    if (!element) {
      return this.outlineStore.knownUris();
    } else if (element instanceof vscode.Uri) {
      const outline = await this.outlineStore.getOutline(element);
      return Object.values(outline?.map?.[this.valueMapName] ?? {}).toSorted((a, b) => a.value.localeCompare(b.value));
    } else if (element instanceof LogicalValue) {
      const outline = await this.outlineStore.getOutline(element.uri);
      return outline?.map?.allFeatures.filter(feature => {
        return String(feature[this.elementFieldName]) === element.value;
      }) ?? [];
    } else {
      return [];
    }
  }

  async getParent(element: CategoryTreeViewElement): Promise<undefined | CategoryTreeViewElement> {
    if (element instanceof vscode.Uri) {
      return undefined;
    } else if (element instanceof LogicalValue) {
      return element.uri;
    } else {
      const outline = await this.outlineStore.getOutline(element.uri);
      return outline?.map?.[this.valueMapName][String(element[this.elementFieldName])];
    }
  }
}

export class FlagsByCreatedAtTreeViewProvider extends FlagsByCategoryTreeProvider {
  constructor(outlineStore: OutlineStore) {
    super(outlineStore, 'allCreatedAt', 'created_at');
  }

  protected getValueTreeItem(element: LogicalValue) {
    const treeItem = new vscode.TreeItem(element.value, vscode.TreeItemCollapsibleState.Collapsed);
    treeItem.description = String(Object.keys(element.children).length);
    treeItem.iconPath = new vscode.ThemeIcon('calendar', new vscode.ThemeColor('icon.foreground')); 
    return treeItem;
  } 
}

export class FlagsByEnabledTreeViewProvider extends FlagsByCategoryTreeProvider {
  constructor(outlineStore: OutlineStore) {
    super(outlineStore, 'allEnabled', 'enabled');
  }

  protected getValueTreeItem(element: LogicalValue) {
    const treeItem = new vscode.TreeItem(element.value, vscode.TreeItemCollapsibleState.Collapsed);
    treeItem.description = String(Object.keys(element.children).length);
    if (element.value === 'true') {
      treeItem.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('terminal.ansiBrightGreen'));
    } else {
      treeItem.iconPath = new vscode.ThemeIcon('close', new vscode.ThemeColor('terminal.ansiRed'));
    }
    return treeItem;
  } 
}

export class FlagsByOwnerTreeViewProvider extends FlagsByCategoryTreeProvider {
  constructor(outlineStore: OutlineStore) {
    super(outlineStore, 'allOwners', 'owner');
  }

  protected getValueTreeItem(element: LogicalValue) {
    const treeItem = new vscode.TreeItem(element.value, vscode.TreeItemCollapsibleState.Collapsed);
    treeItem.description = String(Object.keys(element.children).length);
    if (element.value === 'unknown') {
      treeItem.iconPath = new vscode.ThemeIcon('question', new vscode.ThemeColor('terminal.ansiYellow'));
    } else if (element.value.match(/\w+@\w+.\w+/)) {
      // TODO: check if user is active in the org -> if not then use `disabledForeground`
      treeItem.iconPath = new vscode.ThemeIcon('person', new vscode.ThemeColor('icon.foreground'));
    } else {
      treeItem.iconPath = new vscode.ThemeIcon('organization', new vscode.ThemeColor('icon.foreground'));
    }
    return treeItem;
  } 
}

export class FlagsByRolloutTreeViewProvider extends FlagsByCategoryTreeProvider {
  constructor(outlineStore: OutlineStore) {
    super(outlineStore, 'allRollouts', 'rolloutState');
  }

  protected getValueTreeItem(element: LogicalValue) {
    return new ValueTreeItem(element, element => getRolloutStateIconPath(element.value as RolloutState));
  } 
}
