import * as vscode from 'vscode';
import { addBreadcrumb } from '../utils/sentry';
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

  public run(
    cmd: {bin: string, args: string[]},
    options: {timeout: number}
  ): Command {
    const shellExecution = this.shellIntegration.executeCommand(cmd.bin, cmd.args);    
    return new Command(shellExecution, options.timeout);
  }
}

class Command {
  public execution: Promise<vscode.TerminalShellExecution>;

  constructor(
    shellExecution: vscode.TerminalShellExecution,
    timeout: number,
  ) {
    addBreadcrumb('Terminal command started', 'terminal', 'info', { timeout });
    
    this.execution = createTimeoutPromise<vscode.TerminalShellExecution>(
      timeout,
      'Terminal command execution',
      (resolve) => {
        return vscode.window.onDidEndTerminalShellExecution(
          (event: vscode.TerminalShellExecutionEndEvent) => {
            if (event.execution === shellExecution) {
              addBreadcrumb('Terminal command completed', 'terminal', 'info', {
                exitCode: event.exitCode,
              });
              resolve(shellExecution);
            }
          }
        );
      }
    );
  }
}
