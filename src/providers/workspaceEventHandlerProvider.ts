import * as vscode from 'vscode';
import OutlineStore from '../stores/outlineStore';

export default class WorkspaceEventHandlerProvider {
  public constructor(
    private outlineStore: OutlineStore,
    private documentFilter: vscode.DocumentFilter,
  ) {}

  public register(): vscode.Disposable[] {
    return [
      // We don't care about whether flagpole.yaml is open or not:
      // vscode.workspace.onDidOpenTextDocument(),
      // vscode.workspace.onDidSaveTextDocument(),
      // vscode.workspace.onDidCloseTextDocument(),

      // We do care if flagpole.yaml is changed:
      vscode.workspace.onDidChangeTextDocument(this.handleDidChangeTextDocument),
      
      // We do care if the workspace itself is changed:
      vscode.workspace.onDidRenameFiles(this.handleDidRenameFiles),
      vscode.workspace.onDidChangeWorkspaceFolders(this.handleDidChangeWorkspaceFolders),
    ];
  }

  /**
   * An event that is emitted when a {@link TextDocument text document} is changed. This usually happens
   * when the {@link TextDocument.getText contents} changes but also when other things like the
   * {@link TextDocument.isDirty dirty}-state changes.
   */
  handleDidChangeTextDocument = async (event: vscode.TextDocumentChangeEvent) => {
    if (vscode.languages.match(this.documentFilter, event.document)) {
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
    for (const file of event.files) {
      if (file.oldUri.path.endsWith('/flagpole.yaml')) {
        this.outlineStore.forgetOutline(file.oldUri);
      }
      if (file.newUri.path.endsWith('/flagpole.yaml')) {
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
    event.added.forEach(() => {
      if (this.documentFilter.pattern) {
        vscode.workspace.findFiles(this.documentFilter.pattern, '**/node_modules/**').then(found => {
          found.forEach(uri => this.outlineStore.fire({uri}));
        });
      }
    });
  };
}
