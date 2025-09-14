import * as vscode from 'vscode';
import { OPERATORS, PROPERTIES } from '../types';
import EvaluateView from '../view/evaluateView';
import { CommandRunner, StreamPty } from './terminalProvider';
import { LogicalFeature, logicalFeatureToFeature } from '../transform/transformers';

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
    const snippet = new vscode.SnippetString();
    const lineAt = textEditor.document.lineAt(target.line);
    if (lineAt.text.endsWith('conditions: []')) {
      snippet
        .appendText('      - conditions:\n')
        .appendText('          - property: ').appendChoice(Object.keys(PROPERTIES)).appendText('\n')
        .appendText('            operator: ').appendChoice(OPERATORS).appendText('\n')
        .appendText('            value: []\n');

      textEditor.insertSnippet(snippet, new vscode.Range(target, target.translate(1)), {
        undoStopBefore: true,
        undoStopAfter: true,
        keepWhitespace: true,
      });
    } else {
      snippet
        .appendText('          - property: ').appendChoice(Object.keys(PROPERTIES)).appendText('\n')
        .appendText('            operator: ').appendChoice(OPERATORS).appendText('\n')
        .appendText('            value: []\n');

      textEditor.insertSnippet(snippet, target, {
        undoStopBefore: true,
        undoStopAfter: true,
        keepWhitespace: true,
      });
    }
  };

  public showEvaluateView = (
    feature: LogicalFeature,
  ) => {
    EvaluateView.createOrShow(
      this.context.extensionUri,
      logicalFeatureToFeature(feature),
    );
  };
      
  public evaluateFlag = async (
    flagName: string = 'feature.organizations:use-case-insensitive-codeowners',
    context: Object = {
      organization_slug: 'sentry'
    },
  ) => {
    const config = vscode.workspace.getConfiguration('flagpole-explorer.eval');
    const bin = config.get('bin', './bin/flagpole');
    const cwd = config.get('sentry-workspace', '~/code/sentry');
    const flagpoleFile = config.get('flagpole-file');

    const runner = await CommandRunner.factory(vscode.window.createTerminal({
      name: bin,
      iconPath: vscode.Uri.file('./dist/static/flag.svg'),
      location: vscode.TerminalLocation.Panel,
      isTransient: true,
    }), 5_000);
    await runner.run({bin: 'cd', args: [cwd]}, {timeout: 3_000}).execution;
    
    const flagpoleCmd = runner.run(
      {bin, args: [
        `--flagpole-file=${flagpoleFile}`,
        `--flag-name=${flagName}`,
        `--`,
        // JANKY!!!
        // Double-stringify to escape quotes in a way that works for the shell too.
        JSON.stringify(JSON.stringify(context)) 
      ]},
      {timeout: 5_000}
    );

    const outputTerminal = vscode.window.createTerminal({
      name: 'flagpole',
      pty: new StreamPty(flagpoleCmd.output),
      iconPath: vscode.Uri.file('./dist/static/flag.svg'),
      location: vscode.TerminalLocation.Panel,
      isTransient: true,
    });
    outputTerminal.show(true);

    await flagpoleCmd.execution;

    runner.terminal.dispose();
  };
}
