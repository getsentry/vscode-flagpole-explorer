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
const vscode = __importStar(require("vscode"));
const treeViewItems_1 = require("../treeview/treeViewItems");
class FlagsByNameTreeViewProvider {
    outlineStore;
    didChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this.didChangeTreeData.event;
    constructor(outlineStore) {
        this.outlineStore = outlineStore;
        this.outlineStore.event(() => {
            this.didChangeTreeData.fire(undefined);
        });
    }
    async getTreeItem(element) {
        if (element instanceof vscode.Uri) {
            const outline = await this.outlineStore.getOutline(element);
            return new treeViewItems_1.FileTreeItem(element, String(outline?.map?.allFeatures.length ?? ''));
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
            return (outline?.map?.allFeatures ?? []).toSorted((a, b) => a.name.localeCompare(b.name));
            ;
        }
        else {
            return [];
        }
    }
    getParent(element) {
        if (element instanceof vscode.Uri) {
            return undefined;
        }
        else {
            return element.uri;
        }
    }
}
exports.default = FlagsByNameTreeViewProvider;
//# sourceMappingURL=flagsByNameTreeViewProvider.js.map