import * as vscode from 'vscode';
import { RolloutState } from '../types';

export function getRolloutStateIconPath(rolloutState: RolloutState) {
  switch (rolloutState) {
    case '0%':
      return new vscode.ThemeIcon('circle-large-outline', new vscode.ThemeColor('terminal.ansiBrightRed'));
    case 'partial':
      return new vscode.ThemeIcon('color-mode', new vscode.ThemeColor('terminal.ansiYellow'));
    case '100%':
      return new vscode.ThemeIcon('pass-filled', new vscode.ThemeColor('terminal.ansiGreen'));
    default:
      return new vscode.ThemeIcon('question', new vscode.ThemeColor('terminal.ansiYellow'));
  }
}
