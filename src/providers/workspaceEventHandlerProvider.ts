import * as vscode from 'vscode';
import * as sentryVscode from '../utils/sentryVscode';
import { addBreadcrumb } from '../utils/sentry';
import OutlineStore from '../stores/outlineStore';

function isDocumentOpen(uri: vscode.Uri): boolean {
  const key = uri.toString();
  return vscode.workspace.textDocuments.some(doc => doc.uri.toString() === key);
}

export default class WorkspaceEventHandlerProvider {
  public constructor(
    private outlineStore: OutlineStore,
    private documentFilter: vscode.DocumentFilter,
  ) {}

  public register(): vscode.Disposable[] {
    return [
      // Refresh when a flagpole file is (re)opened, in case its outline was
      // computed from an older version of the file:
      sentryVscode.workspace.onDidOpenTextDocument(this.handleDidOpenTextDocument, this),
      // We don't care about these:
      // sentryVscode.workspace.onDidSaveTextDocument(),
      // sentryVscode.workspace.onDidCloseTextDocument(),

      // We do care if flagpole.yaml is changed:
      sentryVscode.workspace.onDidChangeTextDocument(this.handleDidChangeTextDocument, this),

      // We do care if the workspace itself is changed:
      sentryVscode.workspace.onDidRenameFiles(this.handleDidRenameFiles, this),
      sentryVscode.workspace.onDidChangeWorkspaceFolders(this.handleDidChangeWorkspaceFolders, this),

      // We do care if flagpole.yaml is changed on disk outside the editor,
      // e.g. by git pull/rebase/checkout running in the background:
      ...this.registerFileSystemWatcher(),
    ];
  }

  /**
   * Watch for flagpole files changing on disk. TextDocument events only fire
   * for open editors, so without this, background updates (git pull, rebase,
   * checkout, ...) to closed files would never refresh the outline.
   */
  private registerFileSystemWatcher(): vscode.Disposable[] {
    const pattern = this.documentFilter.pattern;
    if (!pattern) {
      return [];
    }

    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    const handleDiskChange = (uri: vscode.Uri) => {
      // Open documents are handled through onDidChangeTextDocument: when the
      // file is clean VSCode reloads the buffer (firing that event), and when
      // it is dirty the buffer -- which symbols are computed from -- hasn't
      // changed. Only closed files need a refresh from here.
      if (isDocumentOpen(uri)) {
        return;
      }
      addBreadcrumb('Refreshing outline for file changed on disk', 'workspace', 'info', {
        uri: uri.toString(),
      });
      this.outlineStore.fire({uri});
    };

    return [
      watcher,
      watcher.onDidCreate(handleDiskChange),
      watcher.onDidChange(handleDiskChange),
      watcher.onDidDelete((uri) => {
        addBreadcrumb('Forgetting outline for file deleted on disk', 'workspace', 'info', {
          uri: uri.toString(),
        });
        this.outlineStore.forgetOutline(uri);
      }),
    ];
  }

  /**
   * An event that is emitted when a {@link TextDocument text document} is opened.
   */
  handleDidOpenTextDocument = async (document: vscode.TextDocument) => {
    if (vscode.languages.match(this.documentFilter, document)) {
      await this.outlineStore.refreshIfStale(document.uri);
    }
  };

  /**
   * An event that is emitted when a {@link TextDocument text document} is changed. This usually happens
   * when the {@link TextDocument.getText contents} changes but also when other things like the
   * {@link TextDocument.isDirty dirty}-state changes.
   */
  handleDidChangeTextDocument = async (event: vscode.TextDocumentChangeEvent) => {
    if (vscode.languages.match(this.documentFilter, event.document)) {
      addBreadcrumb('Refreshing outline for changed document', 'workspace', 'info', {
        documentUri: event.document.uri.toString(),
        changeCount: event.contentChanges.length,
        isDirty: event.document.isDirty,
      });
      await this.outlineStore.fire({uri: event.document.uri});
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
  handleDidRenameFiles = (event: vscode.FileRenameEvent) => {
    const flagpoleFiles = event.files.filter(
      file => file.oldUri.path.endsWith('/flagpole.yaml') || file.newUri.path.endsWith('/flagpole.yaml')
    );
    
    if (flagpoleFiles.length > 0) {
      addBreadcrumb('Handling flagpole.yaml file rename', 'workspace', 'info', {
        renamedFlagpoleFiles: flagpoleFiles.length,
      });
    }

    for (const file of event.files) {
      if (file.oldUri.path.endsWith('/flagpole.yaml')) {
        addBreadcrumb('Forgetting outline for old path', 'workspace', 'debug', {
          oldPath: file.oldUri.path,
        });
        this.outlineStore.forgetOutline(file.oldUri);
      }
      if (file.newUri.path.endsWith('/flagpole.yaml')) {
        addBreadcrumb('Refreshing outline for new path', 'workspace', 'debug', {
          newPath: file.newUri.path,
        });
        this.outlineStore.fire({uri: file.newUri});
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
  handleDidChangeWorkspaceFolders = (event: vscode.WorkspaceFoldersChangeEvent) => {
    if (event.added.length > 0) {
      addBreadcrumb('Searching for flagpole files in added workspace folders', 'workspace', 'info', {
        addedFolders: event.added.map(f => f.uri.path),
        pattern: this.documentFilter.pattern,
      });
    }

    event.added.forEach((folder) => {
      if (this.documentFilter.pattern) {
        vscode.workspace.findFiles(this.documentFilter.pattern, '**/node_modules/**').then(found => {
          addBreadcrumb('Found flagpole files in new workspace folder', 'workspace', 'info', {
            folderPath: folder.uri.path,
            filesFound: found.length,
          });
          found.forEach(uri => this.outlineStore.fire({uri}));
        });
      }
    });
  };
}
