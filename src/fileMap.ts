import * as vscode from 'vscode';
import * as fs from 'node:fs';
import FlagpoleFile from './flagpoleFile';

export default class FileMap {
  private roots: Map<string, FlagpoleFile> = new Map();

  _readFile(uri: vscode.Uri): void {
    const document = fs.readFileSync(uri.fsPath, 'utf8');
    const file = FlagpoleFile.factory(uri, document);
    this.roots.set(uri.toString(), file);
  } 

  add(uri: vscode.Uri): void {
    this._readFile(uri);
  }

  update(uri: vscode.Uri): void {
    this._readFile(uri);
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
