import * as vscode from 'vscode';
import * as sentryVscode from '../utils/sentryVscode';
import { OPERATORS, PROPERTIES } from '../types';
import EvaluateView from '../view/evaluateView';
import { CommandRunner } from './terminalProvider';
import { LogicalFeature, logicalFeatureToFeature } from '../transform/transformers';
import { cliProblem, expandHome, shellQuote } from '../utils/sentryOptionsCli';

const CLI_INSTALL_URL = 'https://github.com/getsentry/sentry-options/releases';

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
      .appendText('    created_at: "').appendVariable('CURRENT_YEAR', '').appendText('-').appendVariable('CURRENT_MONTH', '').appendText('-').appendVariable('CURRENT_DATE', '').appendText('"\n')
      .appendText('    enabled: ').appendChoice(['true', 'false']).appendText('\n')
      .appendText('    owner:\n')
      .appendText('      team: ').appendPlaceholder('REQUIRED').appendText('\n')
      .appendText('      email: ').appendPlaceholder('yourname@sentry.io').appendText('\n')
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
    feature?: LogicalFeature,
  ) => {
    EvaluateView.createOrShow(
      this.context.extensionUri,
      feature ? logicalFeatureToFeature(feature) : null,
    );
  };

  public evaluateFlag = async (
    flagName: string = 'feature.organizations:use-case-insensitive-codeowners',
    context: Object = {
      organization_slug: 'sentry'
    },
  ) => {
    const config = vscode.workspace.getConfiguration('flagpole-explorer.eval');
    const home = process.env.HOME ?? '~';
    const bin = expandHome(config.get('bin', 'sentry-options-cli'), home);
    const flagpoleFile = expandHome(config.get('flagpole-file', ''), home);

    const runner = await CommandRunner.factory(vscode.window.createTerminal({
      name: flagName,
      iconPath: vscode.Uri.file('./dist/static/flag.svg'),
      location: vscode.TerminalLocation.Panel,
      hideFromUser: false,
      isTransient: true,
    }), 5_000);
    runner.terminal.show(false);

    // Every value is quoted, so settings and context can't inject shell syntax.
    const commandLine = [
      bin,
      'eval',
      `--values=${flagpoleFile}`,
      `--flag=${flagName}`,
      `--context=${JSON.stringify(context)}`,
    ].map(shellQuote).join(' ');
    const exitCode = await runner.run(commandLine, {timeout: 10_000}).exitCode;

    const problem = cliProblem(exitCode);
    if (problem) {
      const install = 'Install instructions';
      const choice = await vscode.window.showErrorMessage(
        `${problem} Install it with \`cargo install sentry-options-cli\` or from the sentry-options releases, or point flagpole-explorer.eval.bin at it.`,
        install,
      );
      if (choice === install) {
        void vscode.env.openExternal(vscode.Uri.parse(CLI_INSTALL_URL));
      }
    }
  };
}
