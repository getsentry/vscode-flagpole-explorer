import * as vscode from 'vscode';

export class CommandRunner {
  public static factory(terminal: vscode.Terminal, timeout: number) {
    return new Promise<CommandRunner>((resolve, reject) => {
      if (terminal.shellIntegration) {
        resolve(new CommandRunner(terminal, terminal.shellIntegration));
      } else {
        const rejectionTimeout = setTimeout(() => {
          reject();
          subscription.dispose();
        }, timeout);
        
        const subscription = vscode.window.onDidChangeTerminalShellIntegration(
          (event) => {
            if (event.terminal === terminal) {
              resolve(new CommandRunner(event.terminal, event.shellIntegration));
              subscription.dispose();
              clearTimeout(rejectionTimeout);
            }
          }
        );
      }
    });
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
    shellExecution: vscode.TerminalShellExecution, timeout: number,
  ) {
    this.execution = new Promise((resolve, reject) => {
      const rejectionTimeout = setTimeout(() => {
        reject();
        subscription.dispose();
      }, timeout);

      const subscription = vscode.window.onDidEndTerminalShellExecution(event => {
        if (event.execution === shellExecution) {
          resolve(shellExecution);
          subscription.dispose();
          clearTimeout(rejectionTimeout);
        }
      });
    });
  }
}
