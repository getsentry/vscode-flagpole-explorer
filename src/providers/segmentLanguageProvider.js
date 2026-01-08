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
const getRolloutEmoji_1 = __importDefault(require("../utils/getRolloutEmoji"));
const selectedElementsStore_1 = __importDefault(require("../stores/selectedElementsStore"));
class SegmentLanguageProvider {
    selectedElementsStore;
    documentFilter;
    constructor(selectedElementsStore, documentFilter) {
        this.selectedElementsStore = selectedElementsStore;
        this.documentFilter = documentFilter;
    }
    register() {
        return [
            this.selectedElementsStore.onDidChangeSelected(() => {
                const config = vscode.workspace.getConfiguration('flagpole-explorer.render');
                if (config.get('renderMutationLenses') === 'for selection') {
                    this.didChangeCodeLenses.fire();
                }
            }),
            this.selectedElementsStore.outlineStore.event(() => {
                this.didChangeCodeLenses.fire();
                this.didChangeInlayHints.fire();
            }),
            vscode.languages.registerCodeLensProvider(this.documentFilter, this),
            vscode.languages.registerInlayHintsProvider(this.documentFilter, this),
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
        const selectedFeatures = config.get('renderMutationLenses') === 'always'
            ? outline.map.allFeatures
            : selectedElementsStore_1.default.filterSelectedElements(selections, outline.map.allFeatures);
        const selectedSegments = config.get('renderMutationLenses') === 'always'
            ? outline.map.allSegments
            : selectedElementsStore_1.default.filterSelectedElements(selections, outline.map.allSegments);
        return [
            ...selectedFeatures.filter(feature => feature.segmentsSymbol).map(feature => {
                return new vscode.CodeLens(feature.segmentsSymbol.range, {
                    title: `$(symbol-array)\u2000Append Segment`,
                    tooltip: 'Add a new segment to the end of the list',
                    command: 'flagpole-explorer.addSegment',
                    arguments: [feature.segmentsSymbol.range.end],
                });
            }),
            ...selectedSegments.map(segment => {
                return new vscode.CodeLens(segment.symbol.range, {
                    title: `$(symbol-array)\u2000Insert Segment`,
                    tooltip: 'Insert a segment here',
                    command: 'flagpole-explorer.addSegment',
                    arguments: [segment.symbol.range.start]
                });
            }),
        ];
    }
    resolveCodeLens(codeLens, token) {
        return codeLens;
    }
    didChangeInlayHints = new vscode.EventEmitter();
    onDidChangeInlayHints = this.didChangeInlayHints.event;
    async provideInlayHints(document, range, token) {
        const config = vscode.workspace.getConfiguration('flagpole-explorer.render');
        if (!config.get('renderRolloutHints')) {
            return [];
        }
        const outline = await this.selectedElementsStore.outlineStore.getOutline(document.uri);
        const segmentsInRange = outline?.map?.allSegments
            .filter(segment => range.intersection(segment.symbol.selectionRange)) ?? [];
        return segmentsInRange
            .map(segment => {
            const hint = new vscode.InlayHint(segment.symbol.selectionRange.start.with({ character: Number.MAX_SAFE_INTEGER }), `${(0, getRolloutEmoji_1.default)(segment.rolloutState)} ${segment.rolloutState} rollout`);
            hint.paddingLeft = true;
            return hint;
        });
    }
    resolveInlayHint(hint, token) {
        return hint;
    }
}
exports.default = SegmentLanguageProvider;
//# sourceMappingURL=segmentLanguageProvider.js.map