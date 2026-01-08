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
exports.activate = activate;
exports.deactivate = deactivate;
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = __importStar(require("vscode"));
const outlineStore_1 = __importDefault(require("./stores/outlineStore"));
const commandProvider_1 = __importDefault(require("./providers/commandProvider"));
const windowEventHandlerProvider_1 = __importDefault(require("./providers/windowEventHandlerProvider"));
const workspaceEventHandlerProvider_1 = __importDefault(require("./providers/workspaceEventHandlerProvider"));
const featureNameLanguageProvider_1 = __importDefault(require("./providers/featureNameLanguageProvider"));
const segmentLanguageProvider_1 = __importDefault(require("./providers/segmentLanguageProvider"));
const conditionLanguageProvider_1 = __importDefault(require("./providers/conditionLanguageProvider"));
const selectedElementsStore_1 = __importDefault(require("./stores/selectedElementsStore"));
const sentry_1 = require("./utils/sentry");
// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
function activate(context) {
    console.log('Activating Flagpole extension...');
    // Initialize Sentry first (before we can use any spans)
    try {
        (0, sentry_1.initializeSentry)(context);
        (0, sentry_1.addBreadcrumb)('Extension activation started', 'lifecycle');
    }
    catch (error) {
        console.error('Failed to initialize Sentry:', error);
        // Continue without Sentry if initialization fails
    }
    // Wrap the entire activation in a Sentry span (after Sentry is initialized)
    return (0, sentry_1.startActiveSpan)({
        name: 'extension.activate',
        op: 'activation',
    }, () => {
        try {
            const config = vscode.workspace.getConfiguration('flagpole-explorer');
            const flagpoleFileDocumentFilter = {
                language: 'yaml',
                scheme: 'file',
                pattern: config.get('flagpoleFilePattern'),
            };
            (0, sentry_1.addBreadcrumb)('Creating extension stores', 'setup', 'info', {
                flagpolePattern: flagpoleFileDocumentFilter.pattern,
            });
            // Wrap store creation in spans
            const outlineStore = (0, sentry_1.startActiveSpan)({ name: 'create.outlineStore', op: 'setup' }, () => new outlineStore_1.default());
            const selectedElementsStore = (0, sentry_1.startActiveSpan)({ name: 'create.selectedElementsStore', op: 'setup' }, () => new selectedElementsStore_1.default(outlineStore, flagpoleFileDocumentFilter));
            (0, sentry_1.addBreadcrumb)('Registering providers', 'setup');
            // Register all providers with error handling
            (0, sentry_1.startActiveSpan)({ name: 'register.providers', op: 'setup' }, () => {
                context.subscriptions.push(outlineStore, ...safeRegister('selectedElementsStore', () => selectedElementsStore.register()), ...safeRegister('commandProvider', () => new commandProvider_1.default(context).register()), ...safeRegister('windowEventHandler', () => new windowEventHandlerProvider_1.default(context, outlineStore, flagpoleFileDocumentFilter).register()), ...safeRegister('workspaceEventHandler', () => new workspaceEventHandlerProvider_1.default(outlineStore, flagpoleFileDocumentFilter).register()), ...safeRegister('conditionLanguageProvider', () => new conditionLanguageProvider_1.default(selectedElementsStore, flagpoleFileDocumentFilter).register()), ...safeRegister('segmentLanguageProvider', () => new segmentLanguageProvider_1.default(selectedElementsStore, flagpoleFileDocumentFilter).register()), ...safeRegister('featureNameLanguageProvider', () => new featureNameLanguageProvider_1.default(selectedElementsStore, flagpoleFileDocumentFilter).register()));
            });
            // Find and process flagpole files with error handling
            if (flagpoleFileDocumentFilter.pattern) {
                (0, sentry_1.addBreadcrumb)('Searching for flagpole files', 'initialization', 'info', {
                    pattern: flagpoleFileDocumentFilter.pattern,
                });
                vscode.workspace
                    .findFiles(flagpoleFileDocumentFilter.pattern, '**/node_modules/**')
                    .then((0, sentry_1.withSentrySync)('findFiles.success', (found) => {
                    (0, sentry_1.addBreadcrumb)('Found flagpole files', 'initialization', 'info', {
                        count: found.length,
                    });
                    found.forEach(uri => {
                        try {
                            outlineStore.fire({ uri });
                        }
                        catch (error) {
                            (0, sentry_1.captureException)(error, {
                                context: 'outlineStore.fire',
                                uri: uri.toString(),
                            });
                        }
                    });
                }), (error) => {
                    (0, sentry_1.captureException)(error, {
                        context: 'findFiles',
                        pattern: flagpoleFileDocumentFilter.pattern,
                    });
                });
            }
            (0, sentry_1.addBreadcrumb)('Extension activation completed', 'lifecycle');
            console.log('Flagpole extension activated successfully');
        }
        catch (error) {
            (0, sentry_1.addBreadcrumb)('Extension activation failed', 'lifecycle', 'error');
            (0, sentry_1.captureException)(error, {
                context: 'extension.activate',
            });
            // Show error to user
            vscode.window.showErrorMessage(`Failed to activate Flagpole Explorer: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    });
}
/**
 * Safely register a provider, capturing any errors to Sentry.
 */
function safeRegister(providerName, register) {
    return (0, sentry_1.startActiveSpan)({ name: `register.${providerName}`, op: 'provider.register' }, () => {
        try {
            const disposables = register();
            (0, sentry_1.addBreadcrumb)(`Registered ${providerName}`, 'provider', 'info');
            return disposables;
        }
        catch (error) {
            (0, sentry_1.addBreadcrumb)(`Failed to register ${providerName}`, 'provider', 'error');
            (0, sentry_1.captureException)(error, {
                context: 'provider.register',
                provider: providerName,
            });
            // Show warning but don't prevent extension from loading
            vscode.window.showWarningMessage(`Failed to register ${providerName}: ${error instanceof Error ? error.message : String(error)}`);
            return [];
        }
    });
}
// This method is called when your extension is deactivated
function deactivate() {
    return (0, sentry_1.startActiveSpanAsync)({
        name: 'extension.deactivate',
        op: 'deactivation',
    }, async () => {
        console.log("Deactivating Flagpole extension...");
        try {
            (0, sentry_1.addBreadcrumb)('Extension deactivation started', 'lifecycle');
            // Flush any pending Sentry events before shutdown
            await (0, sentry_1.flushSentry)();
            (0, sentry_1.addBreadcrumb)('Extension deactivation completed', 'lifecycle');
            console.log("Deactivated Flagpole extension.");
        }
        catch (error) {
            console.error('Error during deactivation:', error);
            // Don't throw - we're shutting down anyway
        }
    });
}
//# sourceMappingURL=extension.js.map