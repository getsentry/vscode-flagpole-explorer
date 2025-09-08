import * as vscode from 'vscode';
import { OPERATORS, PROPERTIES } from '../types';
import EvaluateView from '../view/evaluateView';

export default class CommandProvider {
  constructor(
    private context: vscode.ExtensionContext,
  ) {}

  public register(): vscode.Disposable[] {
    return [
      vscode.commands.registerTextEditorCommand('flagpole-explorer.addFeature', this.addFeature),
      vscode.commands.registerTextEditorCommand('flagpole-explorer.addSegment', this.addSegment),
      vscode.commands.registerTextEditorCommand('flagpole-explorer.addCondition', this.addCondition),
      vscode.commands.registerCommand('flagpole-explorer.show-evaluate-view', this.showEvaluateView),
      vscode.commands.registerCommand('flagpole-explorer.evaluate-flag', this.evaluateFlag),
    ];
  }

  public addFeature = (
    textEditor: vscode.TextEditor,
    edit: vscode.TextEditorEdit,
    position: vscode.Position = textEditor.selection.start,
  ) => {
    const target = position.with({character: 0});
    console.log('flagpole-explorer.addFeature', target);

    const snippet = new vscode.SnippetString();

    const lineAbove = textEditor.document.lineAt(target.line - 1);
    if (lineAbove.text !== 'options:' && !lineAbove.isEmptyOrWhitespace) {
      snippet.appendText('\n');
    }

    snippet
      .appendText('  feature.organizations:').appendPlaceholder('my-new-flag').appendText(':\n')
      .appendText('    created_at: ').appendVariable('CURRENT_YEAR', '').appendText('-').appendVariable('CURRENT_MONTH', '').appendText('-').appendVariable('CURRENT_DATE', '').appendText('\n')
      .appendText('    enabled: ').appendChoice(['true', 'false']).appendText('\n')
      .appendText('    owner: ').appendPlaceholder('unknown').appendText('\n')
      .appendText('    segments: []\n');

    textEditor.insertSnippet(snippet, target, {
      undoStopBefore: true,
      undoStopAfter: true,
      keepWhitespace: true,
    });
  };

  public addSegment = (
    textEditor: vscode.TextEditor,
    edit: vscode.TextEditorEdit,
    position: vscode.Position = textEditor.selection.start,
  ) => {
    const target = position.with({character: 0});
    console.log('flagpole-explorer.addSegment', target);

    const snippet = new vscode.SnippetString();

    const lineAbove = textEditor.document.lineAt(target.line);
    if (lineAbove.text.endsWith('segments: []')) {
      snippet
        .appendText('    segments:\n')
        .appendText('      - name: ').appendPlaceholder('new segment').appendText('\n')
        .appendText('        rollout: ').appendPlaceholder('0').appendText('\n')
        .appendText('        conditions: []\n');

      textEditor.insertSnippet(snippet, new vscode.Range(target, target.translate(1)), {
        undoStopBefore: true,
        undoStopAfter: true,
        keepWhitespace: true,
      });
    } else {
      snippet
        .appendText('      - name: ').appendPlaceholder('new segment').appendText('\n')
        .appendText('        rollout: ').appendPlaceholder('0').appendText('\n')
        .appendText('        conditions: []\n');

      textEditor.insertSnippet(snippet, target, {
        undoStopBefore: true,
        undoStopAfter: true,
        keepWhitespace: true,
      });
    }
  };

  public addCondition = (
    textEditor: vscode.TextEditor,
    edit: vscode.TextEditorEdit,
    position: vscode.Position = textEditor.selection.start,
  ) => {
    const target = position.with({character: 0});
    console.log('flagpole-explorer.addCondition', target);

    const snippet = new vscode.SnippetString();

    console.log('adding condition', target);
    const lineAt = textEditor.document.lineAt(target.line);
    console.log('lineAt', lineAt.text);

    if (lineAt.text.endsWith('conditions: []')) {
      snippet
        .appendText('      - conditions:\n')
        .appendText('          - property: ').appendChoice(PROPERTIES).appendText('\n')
        .appendText('            operator: ').appendChoice(OPERATORS).appendText('\n')
        .appendText('            value: []\n');

      textEditor.insertSnippet(snippet, new vscode.Range(target, target.translate(1)), {
        undoStopBefore: true,
        undoStopAfter: true,
        keepWhitespace: true,
      });
    } else {
      snippet
        .appendText('          - property: ').appendChoice(PROPERTIES).appendText('\n')
        .appendText('            operator: ').appendChoice(OPERATORS).appendText('\n')
        .appendText('            value: []\n');

      textEditor.insertSnippet(snippet, target, {
        undoStopBefore: true,
        undoStopAfter: true,
        keepWhitespace: true,
      });
    }
  };

  public showEvaluateView = (flag: string) => {
    EvaluateView.createOrShow(this.context.extensionUri, flag);
  };

  public evaluateFlag = (flag: string) => {
    console.log('evaluateFlag', flag);
    if (EvaluateView.currentPanel) {
      EvaluateView.currentPanel.selectFlag(flag);
    } else {
      EvaluateView.createOrShow(this.context.extensionUri, flag);
    }
    
  };
}
