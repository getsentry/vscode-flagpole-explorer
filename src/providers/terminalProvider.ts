import * as vscode from 'vscode';
import { addBreadcrumb, startManualSpan } from '../utils/sentry';
import { createTimeoutPromise } from '../utils/createTimeoutPromise';

export class CommandRunner {
  public static factory(terminal: vscode.Terminal, timeout: number) {
    // Fast path: shell integration already available
    if (terminal.shellIntegration) {
      addBreadcrumb('Terminal shell integration ready', 'terminal', 'info');
      return Promise.resolve(new CommandRunner(terminal, terminal.shellIntegration));
    }

    // Wait for shell integration with timeout
    addBreadcrumb('Waiting for terminal shell integration', 'terminal', 'info', { timeout });
    return createTimeoutPromise<CommandRunner>(
      timeout,
      'Terminal shell integration',
      (resolve) => {
        return vscode.window.onDidChangeTerminalShellIntegration(
          (event: vscode.TerminalShellIntegrationChangeEvent) => {
            if (event.terminal === terminal) {
              addBreadcrumb('Terminal shell integration established', 'terminal', 'info');
              resolve(new CommandRunner(event.terminal, event.shellIntegration));
            }
          }
        );
      }
    );
  }

  private constructor(
    public terminal: vscode.Terminal,
    public shellIntegration: vscode.TerminalShellIntegration,
  ) {}

  /**
   * Run `commandLine` exactly as written. Callers must shell-quote anything
   * that isn't meant to be shell syntax.
   */
  public run(commandLine: string, options: {timeout: number}): Command {
    const shellExecution = this.shellIntegration.executeCommand(commandLine);
    return new Command(shellExecution, options.timeout);
  }
}

class Command {
  /** Resolves with the command's exit code, `undefined` if the shell didn't report one. */
  public exitCode: Promise<number | undefined>;

  constructor(
    shellExecution: vscode.TerminalShellExecution,
    timeout: number,
  ) {
    addBreadcrumb('Terminal command started', 'terminal', 'info', { timeout });
    const endSpan = startManualSpan('terminal.command', 'terminal');

    this.exitCode = createTimeoutPromise<number | undefined>(
      timeout,
      'Terminal command execution',
      (resolve) => {
        return vscode.window.onDidEndTerminalShellExecution(
          (event: vscode.TerminalShellExecutionEndEvent) => {
            if (event.execution === shellExecution) {
              addBreadcrumb('Terminal command completed', 'terminal', 'info', {
                exitCode: event.exitCode,
              });
              resolve(event.exitCode);
            }
          }
        );
      }
    ).finally(endSpan);
  }
}
