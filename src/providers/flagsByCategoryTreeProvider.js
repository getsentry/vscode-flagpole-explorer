"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.FlagsByRolloutTreeViewProvider = exports.FlagsByOwnerTreeViewProvider = exports.FlagsByEnabledTreeViewProvider = exports.FlagsByCreatedAtTreeViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const treeViewItems_1 = require("../treeview/treeViewItems");
const getRolloutStateIconPath_1 = require("../utils/getRolloutStateIconPath");
const transformers_1 = require("../transform/transformers");
class FlagsByCategoryTreeProvider {
    outlineStore;
    valueMapName;
    elementFieldName;
    didChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this.didChangeTreeData.event;
    constructor(outlineStore, valueMapName, elementFieldName) {
        this.outlineStore = outlineStore;
        this.valueMapName = valueMapName;
        this.elementFieldName = elementFieldName;
        this.outlineStore.event(() => {
            this.didChangeTreeData.fire(undefined);
        });
    }
    async getTreeItem(element) {
        if (element instanceof vscode.Uri) {
            const outline = await this.outlineStore.getOutline(element);
            return new treeViewItems_1.FileTreeItem(element, String(Object.keys(outline?.map?.[this.valueMapName] ?? {}).length));
        }
        else if (element instanceof transformers_1.LogicalValue) {
            return this.getValueTreeItem(element);
        }
        else {
            return new treeViewItems_1.FeatureTreeItem(element);
        }
    }
    async getChildren(element) {
        if (!element) {
            return this.outlineStore.knownUris();
        }
        else if (element instanceof vscode.Uri) {
            const outline = await this.outlineStore.getOutline(element);
            return Object.values(outline?.map?.[this.valueMapName] ?? {}).toSorted((a, b) => a.value.localeCompare(b.value));
        }
        else if (element instanceof transformers_1.LogicalValue) {
            const outline = await this.outlineStore.getOutline(element.uri);
            return outline?.map?.allFeatures.filter(feature => {
                return String(feature[this.elementFieldName]) === element.value;
            }) ?? [];
        }
        else {
            return [];
        }
    }
    async getParent(element) {
        if (element instanceof vscode.Uri) {
            return undefined;
        }
        else if (element instanceof transformers_1.LogicalValue) {
            return element.uri;
        }
        else {
            const outline = await this.outlineStore.getOutline(element.uri);
            return outline?.map?.[this.valueMapName][String(element[this.elementFieldName])];
        }
    }
}
class FlagsByCreatedAtTreeViewProvider extends FlagsByCategoryTreeProvider {
    constructor(outlineStore) {
        super(outlineStore, 'allCreatedAt', 'created_at');
    }
    getValueTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.value, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.description = String(Object.keys(element.children).length);
        treeItem.iconPath = new vscode.ThemeIcon('calendar', new vscode.ThemeColor('icon.foreground'));
        return treeItem;
    }
}
exports.FlagsByCreatedAtTreeViewProvider = FlagsByCreatedAtTreeViewProvider;
class FlagsByEnabledTreeViewProvider extends FlagsByCategoryTreeProvider {
    constructor(outlineStore) {
        super(outlineStore, 'allEnabled', 'enabled');
    }
    getValueTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.value, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.description = String(Object.keys(element.children).length);
        if (element.value === 'true') {
            treeItem.iconPath = new vscode.ThemeIcon('check', new vscode.ThemeColor('terminal.ansiBrightGreen'));
        }
        else {
            treeItem.iconPath = new vscode.ThemeIcon('close', new vscode.ThemeColor('terminal.ansiRed'));
        }
        return treeItem;
    }
}
exports.FlagsByEnabledTreeViewProvider = FlagsByEnabledTreeViewProvider;
class FlagsByOwnerTreeViewProvider extends FlagsByCategoryTreeProvider {
    constructor(outlineStore) {
        super(outlineStore, 'allOwners', 'owner');
    }
    getValueTreeItem(element) {
        const treeItem = new vscode.TreeItem(element.value, vscode.TreeItemCollapsibleState.Collapsed);
        treeItem.description = String(Object.keys(element.children).length);
        if (element.value === 'unknown') {
            treeItem.iconPath = new vscode.ThemeIcon('question', new vscode.ThemeColor('terminal.ansiYellow'));
        }
        else if (element.value.match(/\w+@\w+.\w+/)) {
            // TODO: check if user is active in the org -> if not then use `disabledForeground`
            treeItem.iconPath = new vscode.ThemeIcon('person', new vscode.ThemeColor('icon.foreground'));
        }
        else {
            treeItem.iconPath = new vscode.ThemeIcon('organization', new vscode.ThemeColor('icon.foreground'));
        }
        return treeItem;
    }
}
exports.FlagsByOwnerTreeViewProvider = FlagsByOwnerTreeViewProvider;
class FlagsByRolloutTreeViewProvider extends FlagsByCategoryTreeProvider {
    constructor(outlineStore) {
        super(outlineStore, 'allRollouts', 'rolloutState');
    }
    getValueTreeItem(element) {
        return new treeViewItems_1.ValueTreeItem(element, element => (0, getRolloutStateIconPath_1.getRolloutStateIconPath)(element.value));
    }
}
exports.FlagsByRolloutTreeViewProvider = FlagsByRolloutTreeViewProvider;
//# sourceMappingURL=flagsByCategoryTreeProvider.js.map