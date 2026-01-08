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
const vscode = __importStar(require("vscode"));
const sentryVscode = __importStar(require("../utils/sentryVscode"));
const types_1 = require("../types");
const evaluateView_1 = __importDefault(require("../view/evaluateView"));
const terminalProvider_1 = require("./terminalProvider");
const transformers_1 = require("../transform/transformers");
class CommandProvider {
    context;
    constructor(context) {
        this.context = context;
    }
    register() {
        return [
            sentryVscode.commands.registerTextEditorCommand('flagpole-explorer.addFeature', this.addFeature),
            sentryVscode.commands.registerTextEditorCommand('flagpole-explorer.addSegment', this.addSegment),
            sentryVscode.commands.registerTextEditorCommand('flagpole-explorer.addCondition', this.addCondition),
            sentryVscode.commands.registerCommand('flagpole-explorer.show-evaluate-view', this.showEvaluateView),
            sentryVscode.commands.registerCommand('flagpole-explorer.evaluate-flag', this.evaluateFlag),
        ];
    }
    addFeature = (textEditor, edit, position = textEditor.selection.start) => {
        const target = position.with({ character: 0 });
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
    addSegment = (textEditor, edit, position = textEditor.selection.start) => {
        const target = position.with({ character: 0 });
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
        }
        else {
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
    addCondition = (textEditor, edit, position = textEditor.selection.start) => {
        const target = position.with({ character: 0 });
        const snippet = new vscode.SnippetString();
        const lineAt = textEditor.document.lineAt(target.line);
        if (lineAt.text.endsWith('conditions: []')) {
            snippet
                .appendText('      - conditions:\n')
                .appendText('          - property: ').appendChoice(Object.keys(types_1.PROPERTIES)).appendText('\n')
                .appendText('            operator: ').appendChoice(types_1.OPERATORS).appendText('\n')
                .appendText('            value: []\n');
            textEditor.insertSnippet(snippet, new vscode.Range(target, target.translate(1)), {
                undoStopBefore: true,
                undoStopAfter: true,
                keepWhitespace: true,
            });
        }
        else {
            snippet
                .appendText('          - property: ').appendChoice(Object.keys(types_1.PROPERTIES)).appendText('\n')
                .appendText('            operator: ').appendChoice(types_1.OPERATORS).appendText('\n')
                .appendText('            value: []\n');
            textEditor.insertSnippet(snippet, target, {
                undoStopBefore: true,
                undoStopAfter: true,
                keepWhitespace: true,
            });
        }
    };
    showEvaluateView = (feature) => {
        evaluateView_1.default.createOrShow(this.context.extensionUri, (0, transformers_1.logicalFeatureToFeature)(feature));
    };
    evaluateFlag = async (flagName = 'feature.organizations:use-case-insensitive-codeowners', context = {
        organization_slug: 'sentry'
    }) => {
        const config = vscode.workspace.getConfiguration('flagpole-explorer.eval');
        const bin = config.get('bin', './bin/flagpole');
        const cwd = config.get('sentry-workspace', '~/code/sentry');
        const flagpoleFile = config.get('flagpole-file');
        const runner = await terminalProvider_1.CommandRunner.factory(vscode.window.createTerminal({
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
        const flagpoleCmd = runner.run({ bin: ';\n\ndirenv', args: [
                'exec',
                cwd,
                `${cwd}/${bin}`,
                `--flagpole-file=${flagpoleFile}`,
                `--flag-name=${flagName}`,
                `--`,
                // JANKY!!!
                // Double-stringify to escape quotes in a way that works for the shell too.
                JSON.stringify(JSON.stringify(context))
            ] }, { timeout: 1_000 });
        await flagpoleCmd.execution;
    };
}
exports.default = CommandProvider;
//# sourceMappingURL=commandProvider.js.map