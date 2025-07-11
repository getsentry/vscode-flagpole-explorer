import * as vscode from 'vscode';
import FlagpoleFile from './flagpoleFile';

export default class FileMap {
  private roots: Map<string, FlagpoleFile> = new Map();

  _readFile(uri: vscode.Uri): Promise<void> {
    return new Promise((resolve, reject) => {
      vscode.workspace.openTextDocument(uri).then(doc => {
        const file = FlagpoleFile.factory(uri, doc.getText());
        this.roots.set(uri.toString(), file);
        resolve();
      }, reject);
    });
  } 

  add(uri: vscode.Uri): Promise<void> {
    return this._readFile(uri);
  }

  update(uri: vscode.Uri): Promise<void> {
    return this._readFile(uri);
  }

  remove(uri: vscode.Uri): void {
    this.roots.delete(uri.toString());
  }

  getFile(uri: vscode.Uri): FlagpoleFile | undefined {
    return this.roots.get(uri.toString());
  }

  get files(): FlagpoleFile[] {
    return Array.from(this.roots.values());
  }
}
