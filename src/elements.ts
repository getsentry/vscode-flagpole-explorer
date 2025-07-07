import * as vscode from 'vscode';
import FlagpoleFile from './flagpoleFile';
import type { Feature } from './types';

export abstract class Element {
  constructor(
    private _parent: Element | null
  ) {}
  
  abstract get label(): string;
  abstract get description(): undefined | string;
  abstract get defaultCollapseState(): vscode.TreeItemCollapsibleState;
  abstract getChildren(): Element[];

  get uri(): vscode.Uri | undefined {
    return undefined;
  }

  get parent(): Element | null {
    return this._parent;
  }

  get root(): BaseFileElement {
    let root: Element = this;
    while (root.parent) {
      root = root.parent;
    }
    return root as BaseFileElement;
  }

  public async asTreeItem(): Promise<vscode.TreeItem> {
    const treeItem = this.uri
      ? new vscode.TreeItem(this.uri, this.defaultCollapseState)
      : new vscode.TreeItem(this.label, this.defaultCollapseState);
    treeItem.description = this.description;
    treeItem.contextValue = this.constructor.name;
    return treeItem;
  }

  executeCommand(): void {
    this.asTreeItem().then(({command}) => {
      if (command) {
        vscode.commands.executeCommand(command.command, ...command.arguments ?? []);
      }
    });
  }
};

abstract class BaseFileElement extends Element {
  constructor(
    public flagpoleFile: FlagpoleFile,
  ) {
    super(null);
  }

  get label() {
    return this.flagpoleFile.uri.path;
  }

  get description() {
    return String(this.getChildren().length);
  }

  get defaultCollapseState() {
    return vscode.TreeItemCollapsibleState.Expanded;
  }

  get uri() {
    return this.flagpoleFile.uri;
  }

  public async asTreeItem() {
    const treeItem = await super.asTreeItem();
    treeItem.resourceUri = this.flagpoleFile.uri;
    treeItem.command = {
      title: 'Open in editor',
      command: 'vscode.open',
      arguments: [this.flagpoleFile.uri],
    };
    return treeItem;
  }
}

export class FileWithCategoriesElement extends BaseFileElement {
  getChildren(): CategoryElement[] {
    return [
      new CategoryElement(this, 'By Enabled', () => this.flagpoleFile.featuresByEnabled),
      new CategoryElement(this, 'By Date', () => this.flagpoleFile.featuresByCreatedAt),
      new CategoryElement(this, 'By Owner', () => this.flagpoleFile.featuresByOwner),
    ];
  }
}

export class CategorySpecificFileElement extends BaseFileElement {
  constructor(
    flagpoleFile: FlagpoleFile,
    private _getMap: (flagpoleFile: FlagpoleFile) => Map<unknown, Set<Feature>>
  ) {
    super(flagpoleFile);
  }

  getChildren(): ValueElement[] {
    const map = this._getMap(this.flagpoleFile);

    const valueElements = [];
    for (const [key, features] of map.entries()) {
      valueElements.push(new ValueElement(this, key, features));
    }
    return valueElements.toSorted();
  }
}

export class CategoryElement extends Element {
  constructor(
    parent: Element,
    private _categoryName: string,
    private _getMap: () => Map<unknown, Set<Feature>>,
  ) {
    super(parent);
  }

  get label() {
    return this._categoryName;
  }

  get description() {
    return String(this.getChildren().length);
  }
  
  get defaultCollapseState() {
    return vscode.TreeItemCollapsibleState.Collapsed;
  }

  getChildren(): ValueElement[] {
    const map = this._getMap();

    const valueElements = [];
    for (const [key, features] of map.entries()) {
      valueElements.push(new ValueElement(this, key, features));
    }
    return valueElements.toSorted();
  }
}

export class ValueElement extends Element {
  constructor(
    parent: Element,
    private _value: unknown,
    private _features: Set<Feature>,
  ) {
    super(parent);
  }

  get label() {
    return String(this._value);
  }

  get description() {
    return String(this.getChildren().length);
  }

  get defaultCollapseState() {
    return vscode.TreeItemCollapsibleState.Collapsed;
  }

  getChildren(): FeatureElement[] {
    const featureElements = [];
    for (const feature of this._features) {
      featureElements.push(new FeatureElement(this, feature));
    }
    return featureElements.toSorted((a, b) => {
      return a.label.localeCompare(b.label);
    });
  }
}

export class FeatureElement extends Element {
  constructor(
    parent: Element,
    private _feature: Feature
  ) {
    super(parent);
  }

  get label() {
    return this._feature.name;
  }

  get description() {
    return undefined;
  }

  get defaultCollapseState() {
    return vscode.TreeItemCollapsibleState.None;
  }

  getChildren(): never[] {
    return [];
  }

  public async asTreeItem() {
    const treeItem = await super.asTreeItem();

    const rootFile = this.root.flagpoleFile;
    const position = await rootFile.findPosition(this._feature);
    treeItem.command = {
      title: 'Open in editor',
      command: 'vscode.open',
      arguments: [rootFile.uri, position ? {selection: new vscode.Range(position, position)}: {}],
    };
    return treeItem;
  }
}
