import * as vscode from 'vscode';
import { CategorySpecificFileElement, FeatureElement, FileWithCategoriesElement, ValueElement, type Element } from './elements';
import FileMap from './fileMap';
import { Feature } from './types';
import FlagpoleFile from './flagpoleFile';

abstract class BaseFileMapProvider implements vscode.TreeDataProvider<Element> {
  private _didChangeEventEmitter = new vscode.EventEmitter<Element | undefined | null | void>();
  readonly onDidChangeTreeData = this._didChangeEventEmitter.event;
  public refresh(): void {
    this._didChangeEventEmitter.fire();
  }

  constructor(
    protected fileMap: FileMap,
  ) {}

  getTreeItem(element: Element): vscode.TreeItem | Thenable<vscode.TreeItem> {
    return element.asTreeItem();
  }

  getParent?(element: Element): vscode.ProviderResult<Element> {
    return element.parent;
  }
  
  abstract getChildren(element?: Element): Element[];
  abstract featureToElement(flagpoleFile: FlagpoleFile, feature: Feature): Thenable<FeatureElement | undefined>;
}

class CategorySpecificProvider extends BaseFileMapProvider {
  constructor(
    fileMap: FileMap,
    private getMap: (flagpoleFile: FlagpoleFile) => Map<unknown, Set<Feature>>,
    private filterValuePredicate: (valueElement: ValueElement, feature: Feature) => boolean,
  ) {
    super(fileMap);
  }
  getChildren(element?: Element): Element[] {
    return element
      ? element.getChildren()
      : this.fileMap.files.map(flagpoleFile => 
        new CategorySpecificFileElement(flagpoleFile, this.getMap)
      );
  }

  async featureToElement(flagpoleFile: FlagpoleFile, feature: Feature): Promise<FeatureElement | undefined> {
    const root = (await this.getChildren())?.find<CategorySpecificFileElement>(
      (child): child is CategorySpecificFileElement => child.root.flagpoleFile === flagpoleFile
    );
    const value = root?.getChildren().find(valueElement => this.filterValuePredicate(valueElement, feature));
    return value?.getChildren().find(elem => elem.label === feature.name);
  }
}

export class FlagsByEnabledProvider extends CategorySpecificProvider {
  constructor(fileMap: FileMap) {
    super(
      fileMap,
      (flagpoleFile: FlagpoleFile) => flagpoleFile.featuresByEnabled,
      (valueElement: ValueElement, feature: Feature) => valueElement.label === String(feature.definition.enabled)
    );
  }
}

export class FlagsByCreatedAtProvider extends CategorySpecificProvider {
  constructor(fileMap: FileMap) {
    super(
      fileMap,
      (flagpoleFile: FlagpoleFile) => flagpoleFile.featuresByCreatedAt,
      (valueElement: ValueElement, feature: Feature) => valueElement.label === feature.definition.created_at
    );
  }
}

export class FlagsByOwnerProvider extends CategorySpecificProvider {
  constructor(fileMap: FileMap) {
    super(
      fileMap,
      (flagpoleFile: FlagpoleFile) => flagpoleFile.featuresByOwner,
      (valueElement: ValueElement, feature: Feature) => valueElement.label === feature.definition.owner
    );
  }
}

export class FlagsByRolloutProvider extends CategorySpecificProvider {
  constructor(fileMap: FileMap) {
    super(
      fileMap,
      (flagpoleFile: FlagpoleFile) => flagpoleFile.featuresByRollout,
      (valueElement: ValueElement, feature: Feature) => valueElement.label === String(feature.rollout)
    );
  }
}
