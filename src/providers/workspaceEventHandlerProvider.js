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
const sentryVscode = __importStar(require("../utils/sentryVscode"));
const sentry_1 = require("../utils/sentry");
class WorkspaceEventHandlerProvider {
    outlineStore;
    documentFilter;
    constructor(outlineStore, documentFilter) {
        this.outlineStore = outlineStore;
        this.documentFilter = documentFilter;
    }
    register() {
        return [
            // We don't care about whether flagpole.yaml is open or not:
            // sentryVscode.workspace.onDidOpenTextDocument(),
            // sentryVscode.workspace.onDidSaveTextDocument(),
            // sentryVscode.workspace.onDidCloseTextDocument(),
            // We do care if flagpole.yaml is changed:
            sentryVscode.workspace.onDidChangeTextDocument(this.handleDidChangeTextDocument, this),
            // We do care if the workspace itself is changed:
            sentryVscode.workspace.onDidRenameFiles(this.handleDidRenameFiles, this),
            sentryVscode.workspace.onDidChangeWorkspaceFolders(this.handleDidChangeWorkspaceFolders, this),
        ];
    }
    /**
     * An event that is emitted when a {@link TextDocument text document} is changed. This usually happens
     * when the {@link TextDocument.getText contents} changes but also when other things like the
     * {@link TextDocument.isDirty dirty}-state changes.
     */
    handleDidChangeTextDocument = async (event) => {
        if (vscode.languages.match(this.documentFilter, event.document)) {
            (0, sentry_1.addBreadcrumb)('Refreshing outline for changed document', 'workspace', 'info', {
                documentUri: event.document.uri.toString(),
                changeCount: event.contentChanges.length,
                isDirty: event.document.isDirty,
            });
            await this.outlineStore.fire({ uri: event.document.uri });
        }
    };
    /**
     * An event that is emitted when files have been renamed.
     *
     * *Note 1:* This event is triggered by user gestures, like renaming a file from the
     * explorer, and from the {@linkcode workspace.applyEdit}-api, but this event is *not* fired when
     * files change on disk, e.g triggered by another application, or when using the
     * {@linkcode FileSystem workspace.fs}-api.
     *
     * *Note 2:* When renaming a folder with children only one event is fired.
     */
    handleDidRenameFiles = (event) => {
        const flagpoleFiles = event.files.filter(file => file.oldUri.path.endsWith('/flagpole.yaml') || file.newUri.path.endsWith('/flagpole.yaml'));
        if (flagpoleFiles.length > 0) {
            (0, sentry_1.addBreadcrumb)('Handling flagpole.yaml file rename', 'workspace', 'info', {
                renamedFlagpoleFiles: flagpoleFiles.length,
            });
        }
        for (const file of event.files) {
            if (file.oldUri.path.endsWith('/flagpole.yaml')) {
                (0, sentry_1.addBreadcrumb)('Forgetting outline for old path', 'workspace', 'debug', {
                    oldPath: file.oldUri.path,
                });
                this.outlineStore.forgetOutline(file.oldUri);
            }
            if (file.newUri.path.endsWith('/flagpole.yaml')) {
                (0, sentry_1.addBreadcrumb)('Refreshing outline for new path', 'workspace', 'debug', {
                    newPath: file.newUri.path,
                });
                this.outlineStore.fire({ uri: file.newUri });
            }
        }
    };
    /**
     * An event that is emitted when a workspace folder is added or removed.
     *
     * **Note:** this event will not fire if the first workspace folder is added, removed or changed,
     * because in that case the currently executing extensions (including the one that listens to this
     * event) will be terminated and restarted so that the (deprecated) `rootPath` property is updated
     * to point to the first workspace folder.
     */
    handleDidChangeWorkspaceFolders = (event) => {
        if (event.added.length > 0) {
            (0, sentry_1.addBreadcrumb)('Searching for flagpole files in added workspace folders', 'workspace', 'info', {
                addedFolders: event.added.map(f => f.uri.path),
                pattern: this.documentFilter.pattern,
            });
        }
        event.added.forEach((folder) => {
            if (this.documentFilter.pattern) {
                vscode.workspace.findFiles(this.documentFilter.pattern, '**/node_modules/**').then(found => {
                    (0, sentry_1.addBreadcrumb)('Found flagpole files in new workspace folder', 'workspace', 'info', {
                        folderPath: folder.uri.path,
                        filesFound: found.length,
                    });
                    found.forEach(uri => this.outlineStore.fire({ uri }));
                });
            }
        });
    };
}
exports.default = WorkspaceEventHandlerProvider;
//# sourceMappingURL=workspaceEventHandlerProvider.js.map