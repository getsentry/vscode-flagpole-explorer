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
class FeatureNameLanguageProvider {
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
        const optionsLens = new vscode.CodeLens(outline.map.range, {
            title: '$(plus)\u2000Create Feature',
            tooltip: 'Add a new feature to the end of the list',
            command: 'flagpole-explorer.addFeature',
            arguments: [outline.map.range.end.translate()]
        });
        const selections = selectedElementsStore_1.default.selections.get(document.uri);
        const selectedFeatures = config.get('renderMutationLenses') === 'always'
            ? outline.map.allFeatures
            : selectedElementsStore_1.default.filterSelectedElements(selections, outline.map.allFeatures);
        const featureLenses = selectedFeatures.flatMap(feature => {
            return [
                new vscode.CodeLens(feature.symbol.range, {
                    title: '$(plus)\u2000Insert Feature',
                    tooltip: 'Insert a feature here',
                    command: 'flagpole-explorer.addFeature',
                    arguments: [feature.symbol.range.start]
                }),
                config.get('renderEvalLens')
                    ? new vscode.CodeLens(feature.symbol.range, {
                        title: '$(beaker)\u2000Evaluate',
                        command: 'flagpole-explorer.show-evaluate-view',
                        arguments: [feature]
                    })
                    : undefined,
            ];
        });
        return [
            optionsLens,
            ...featureLenses.filter(_ => !!_),
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
        const featuresInRange = outline?.map?.allFeatures
            .filter(feature => range.intersection(feature.symbol.selectionRange)) ?? [];
        return featuresInRange
            .map(feature => {
            const label = [
                feature.enabled
                    ? `${(0, getRolloutEmoji_1.default)(feature.rolloutState)} ${feature.rolloutState} rollout`
                    : '❌ disabled',
                feature.hasExtraSegments
                    ? '⚠️ unused segments'
                    : undefined,
            ].filter(Boolean).join(' | ');
            const hint = new vscode.InlayHint(feature.symbol.selectionRange.end.translate(0, 1), label);
            hint.paddingLeft = true;
            return hint;
        });
    }
    resolveInlayHint(hint, token) {
        return hint;
    }
}
exports.default = FeatureNameLanguageProvider;
//# sourceMappingURL=featureNameLanguageProvider.js.map