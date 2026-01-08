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
const transformers_1 = require("../transform/transformers");
class OutlineStore extends vscode.EventEmitter {
    _uris = new Map();
    _outlineCache = new WeakMap();
    static documentSymbolsToMap(uri, symbols) {
        const optionSymbol = symbols.find(symbol => symbol.name === 'options');
        if (!optionSymbol) {
            return undefined;
        }
        const allFeatures = [];
        const allSegments = [];
        const allConditions = [];
        const allOwners = {};
        const allRollouts = {};
        const allEnabled = {};
        const allCreatedAt = {};
        const optionParent = { ...optionSymbol, uri, parent: undefined };
        for (const symbol of optionParent.children) {
            const feature = (0, transformers_1.symbolToLogicalFeature)(uri, symbol);
            allFeatures.push(feature);
            allOwners[feature.owner] = (allOwners[feature.owner] ?? new transformers_1.LogicalValue(uri, feature.owner)).addFeature(feature);
            allRollouts[feature.rolloutState] = (allRollouts[feature.rolloutState] ?? new transformers_1.LogicalValue(uri, feature.rolloutState)).addFeature(feature);
            allEnabled[String(feature.enabled)] = (allEnabled[String(feature.enabled)] ?? new transformers_1.LogicalValue(uri, String(feature.enabled))).addFeature(feature);
            allCreatedAt[feature.created_at] = (allCreatedAt[feature.created_at] ?? new transformers_1.LogicalValue(uri, feature.created_at)).addFeature(feature);
            for (const segment of feature.segments) {
                allSegments.push(segment);
                for (const condition of segment.conditions) {
                    allConditions.push(condition);
                }
            }
        }
        return {
            range: optionSymbol.range,
            selectionRange: optionSymbol.selectionRange,
            allFeatures,
            allSegments,
            allConditions,
            allOwners,
            allRollouts,
            allEnabled,
            allCreatedAt,
        };
    }
    /**
     * Fire off an update to this Uri
     *
     * Replaces what's in the cache with a new Outline instance
     */
    async fire({ uri }) {
        this.forgetOutline(uri);
        const outline = await this.getOutline(uri);
        if (outline) {
            super.fire(outline);
        }
    }
    knownUris() {
        return Array.from(this._uris.values());
    }
    /**
     * Gets an existing cached Outline
     */
    async getOutline(uri) {
        if (this._outlineCache.has(uri)) {
            return this._outlineCache.get(uri);
        }
        const symbols = await getSymbols(uri);
        if (!symbols) {
            return undefined;
        }
        const map = OutlineStore.documentSymbolsToMap(uri, symbols);
        const outline = { uri, symbols, map };
        this._uris.set(uri.fsPath, uri);
        this._outlineCache.set(uri, outline);
        return outline;
    }
    /**
     * Drops an Outline from the cache
     */
    forgetOutline(uri) {
        if (this._outlineCache.has(uri)) {
            this._uris.delete(uri.fsPath);
            this._outlineCache.delete(uri);
        }
    }
}
exports.default = OutlineStore;
function getSymbols(uri, timeout = 0) {
    if (timeout > 5_000) {
        return Promise.resolve(undefined);
    }
    return new Promise(resolve => {
        setTimeout(() => {
            vscode.commands.executeCommand('vscode.executeDocumentSymbolProvider', uri).then((symbols) => resolve(symbols ? symbols : getSymbols(uri, timeout + 1_000)));
        }, timeout);
    });
}
//# sourceMappingURL=outlineStore.js.map