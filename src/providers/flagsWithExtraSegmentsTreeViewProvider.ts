import * as vscode from 'vscode';
import OutlineStore from '../stores/outlineStore';
import { FeatureTreeItem, FileTreeItem } from '../treeview/treeViewItems';
import { LogicalFeature } from '../transform/transformers';

type TreeViewElement = vscode.Uri | LogicalFeature;

export default class FlagsWithExtraSegmentsTreeViewProvider implements vscode.TreeDataProvider<TreeViewElement> {
  private didChangeTreeData = new vscode.EventEmitter<TreeViewElement | undefined | null | void>();
  public onDidChangeTreeData = this.didChangeTreeData.event;

  constructor(private outlineStore: OutlineStore) {
    this.outlineStore.event(() => {
      this.didChangeTreeData.fire(undefined);
    });
  }

  public async getTreeItem(element: TreeViewElement): Promise<vscode.TreeItem> {
    if (element instanceof vscode.Uri) {
      const outline = await this.outlineStore.getOutline(element);
      return new FileTreeItem(element, String(outline?.map?.allFeatures.filter(feature => feature.hasExtraSegments).length ?? ''));
    } else {
      return new FeatureTreeItem(element);
    }
  }

  public async getChildren(element?: TreeViewElement): Promise<TreeViewElement[]> {
    if (!element) {
      return this.outlineStore.knownUris();
    } else if (element instanceof vscode.Uri) {
      const outline = await this.outlineStore.getOutline(element);
      return (outline?.map?.allFeatures ?? []).filter(feature => feature.hasExtraSegments).toSorted((a, b) => a.name.localeCompare(b.name));;
    } else {
      return [];
    }
  }

  getParent(element: TreeViewElement): undefined | TreeViewElement {
    if (element instanceof vscode.Uri) {
      return undefined;
    } else {
      return element.uri;
    }
  }
}
