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
const selectedElementsStore_1 = __importDefault(require("../stores/selectedElementsStore"));
class ConditionLanguageProvider {
    selectedElementsStore;
    documentFilter;
    constructor(selectedElementsStore, documentFilter) {
        this.selectedElementsStore = selectedElementsStore;
        this.documentFilter = documentFilter;
    }
    register() {
        return [
            this.selectedElementsStore.onDidChangeSelected(() => {
                this.didChangeCodeLenses.fire();
            }),
            vscode.languages.registerCodeLensProvider(this.documentFilter, this),
        ];
    }
    didChangeCodeLenses = new vscode.EventEmitter();
    onDidChangeCodeLenses = this.didChangeCodeLenses.event;
    async provideCodeLenses(document, token) {
        const config = vscode.workspace.getConfiguration('flagpole-explorer.render');
        if (config.get('renderMutationLenses') === 'never') {
            return [];
        }
        const outline = await this.selectedElementsStore.outlineStore.getOutline(document.uri);
        if (!outline?.map) {
            return undefined;
        }
        const selections = selectedElementsStore_1.default.selections.get(document.uri);
        const selectedSegments = config.get('renderMutationLenses') === 'always'
            ? outline.map.allSegments
            : selectedElementsStore_1.default.filterSelectedElements(selections, outline.map.allSegments);
        const selectedConditions = config.get('renderMutationLenses') === 'always'
            ? outline.map.allConditions
            : selectedElementsStore_1.default.filterSelectedElements(selections, outline.map.allConditions);
        return [
            ...selectedSegments.filter(segment => segment.conditionsSymbol).map(segment => {
                return new vscode.CodeLens(segment.conditionsSymbol.range, {
                    title: `$(symbol-operator)\u2000Append Condition`,
                    tooltip: 'Add a new condition to the end of the list',
                    command: 'flagpole-explorer.addCondition',
                    arguments: [segment.conditionsSymbol.range.end],
                });
            }),
            ...selectedConditions.map(condition => {
                return new vscode.CodeLens(condition.symbol.range, {
                    title: `$(symbol-operator)\u2000Insert Condition`,
                    tooltip: 'Insert a condition here',
                    command: 'flagpole-explorer.addCondition',
                    arguments: [condition.symbol.range.start],
                });
            })
        ];
    }
    resolveCodeLens(codeLens, token) {
        return codeLens;
    }
}
exports.default = ConditionLanguageProvider;
//# sourceMappingURL=conditionLanguageProvider.js.map