import * as vscode from 'vscode';
import * as sentryVscode from '../utils/sentryVscode';
import { OPERATORS, PROPERTIES } from '../types';
import EvaluateView from '../view/evaluateView';
import { CommandRunner } from './terminalProvider';
import { LogicalFeature, logicalFeatureToFeature } from '../transform/transformers';

export default class CommandProvider {
  constructor(
    private context: vscode.ExtensionContext,
  ) {}

  public register(): vscode.Disposable[] {
    return [
      sentryVscode.commands.registerTextEditorCommand('flagpole-explorer.addFeature', this.addFeature),
      sentryVscode.commands.registerTextEditorCommand('flagpole-explorer.addSegment', this.addSegment),
      sentryVscode.commands.registerTextEditorCommand('flagpole-explorer.addCondition', this.addCondition),
      sentryVscode.commands.registerCommand('flagpole-explorer.show-evaluate-view', this.showEvaluateView),
      sentryVscode.commands.registerCommand('flagpole-explorer.evaluate-flag', this.evaluateFlag),
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
      .appendText('    owner:\n')
      .appendText('      email: ').appendPlaceholder('yourname@sentry.io').appendText('\n')
      .appendText('      team: ').appendPlaceholder('unknown').appendText('\n')
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
      name: flagName,
      iconPath: vscode.Uri.file('./dist/static/flag.svg'),
      location: vscode.TerminalLocation.Panel,
      hideFromUser: false,
      isTransient: true,
    }), 5_000);
    runner.terminal.show(false);

    // Prefix the command with `;\n\n` to end any partial commands that are being
    // executed, and just run ours. If `direnv` is already running that's ok,
    // we're going to call `direnv exec` again anyway in the correct folder.
    const flagpoleCmd = runner.run(
      {bin: ';\n\ndirenv', args: [
        'exec',
        cwd,
        `${cwd}/${bin}`,
        `--flagpole-file=${flagpoleFile}`,
        `--flag-name=${flagName}`,
        `--`,
        // JANKY!!!
        // Double-stringify to escape quotes in a way that works for the shell too.
        JSON.stringify(JSON.stringify(context)) 
      ]},
      {timeout: 1_000}
    );
    await flagpoleCmd.execution;
  };
}
