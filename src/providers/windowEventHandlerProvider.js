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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vscode = __importStar(require("vscode"));
const sentryVscode = __importStar(require("../utils/sentryVscode"));
const flagsByNameTreeViewProvider_1 = __importDefault(require("./flagsByNameTreeViewProvider"));
const flagsByCategoryTreeProvider_1 = require("./flagsByCategoryTreeProvider");
const flagsWithExtraSegmentsTreeViewProvider_1 = __importDefault(require("./flagsWithExtraSegmentsTreeViewProvider"));
const evaluateView_1 = __importDefault(require("../view/evaluateView"));
class WindowEventHandlerProvider {
    context;
    outlineStore;
    documentFilter;
    views = [];
    constructor(context, outlineStore, documentFilter) {
        this.context = context;
        this.outlineStore = outlineStore;
        this.documentFilter = documentFilter;
    }
    register() {
        const extensionUri = this.context.extensionUri;
        this.views = [
            vscode.window.createTreeView('sentryFlagpoleFlagsByName', { treeDataProvider: new flagsByNameTreeViewProvider_1.default(this.outlineStore), showCollapseAll: true }),
            vscode.window.createTreeView('sentryFlagpoleFlagsByEnabled', { treeDataProvider: new flagsByCategoryTreeProvider_1.FlagsByEnabledTreeViewProvider(this.outlineStore), showCollapseAll: true }),
            vscode.window.createTreeView('sentryFlagpoleFlagsByCreatedAt', { treeDataProvider: new flagsByCategoryTreeProvider_1.FlagsByCreatedAtTreeViewProvider(this.outlineStore), showCollapseAll: true }),
            vscode.window.createTreeView('sentryFlagpoleFlagsByOwner', { treeDataProvider: new flagsByCategoryTreeProvider_1.FlagsByOwnerTreeViewProvider(this.outlineStore), showCollapseAll: true }),
            vscode.window.createTreeView('sentryFlagpoleFlagsByRollout', { treeDataProvider: new flagsByCategoryTreeProvider_1.FlagsByRolloutTreeViewProvider(this.outlineStore), showCollapseAll: true }),
            vscode.window.createTreeView('sentryFlagpoleFlagsWithExtraSegments', { treeDataProvider: new flagsWithExtraSegmentsTreeViewProvider_1.default(this.outlineStore), showCollapseAll: true }),
        ];
        const serializers = [];
        if (vscode.window.registerWebviewPanelSerializer) {
            serializers.push(vscode.window.registerWebviewPanelSerializer(evaluateView_1.default.viewType, {
                async deserializeWebviewPanel(webviewPanel, state) {
                    // Reset the webview options so we use latest uri for `localResourceRoots`.
                    webviewPanel.webview.options = evaluateView_1.default.viewOptions(extensionUri);
                    evaluateView_1.default.revive(webviewPanel, extensionUri);
                }
            }));
        }
        return [
            // sentryVscode.window.onDidChangeActiveTextEditor(this.handleDidChangeActiveTextEditor),
            sentryVscode.window.onDidChangeTextEditorSelection(this.handleDidChangeTextEditorSelection),
            ...serializers,
            ...this.views,
        ];
    }
    /**
     * An {@link Event} which fires when the {@link window.activeTextEditor active editor}
     * has changed. *Note* that the event also fires when the active editor changes
     * to `undefined`.
     */
    handleDidChangeActiveTextEditor = (editor) => {
        // TODO: Do we need this?
    };
    /**
     * An {@link Event} which fires when the selection in an editor has changed.
     */
    handleDidChangeTextEditorSelection = async (event) => {
        if (vscode.languages.match(this.documentFilter, event.textEditor.document)) {
            const outline = await this.outlineStore.getOutline(event.textEditor.document.uri);
            const features = outline?.map?.allFeatures;
            if (!features) {
                return;
            }
            event.selections.forEach(selection => {
                features
                    .filter(feature => selection.intersection(feature.symbol.range))
                    .forEach(feature => {
                    this.views?.forEach(view => {
                        if (view.visible) {
                            view.reveal(feature).then(() => { }, () => { });
                        }
                    });
                });
            });
        }
    };
}
exports.default = WindowEventHandlerProvider;
//# sourceMappingURL=windowEventHandlerProvider.js.map