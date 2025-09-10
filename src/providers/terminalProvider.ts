import * as vscode from 'vscode';

export class CommandRunner {
  public static factory(terminal: vscode.Terminal, timeout: number) {
    const theTerminal = terminal;
    return new Promise<CommandRunner>((resolve, reject) => {
      const rejectionTimeout = setTimeout(() => {
        reject();
        unsubscribe.dispose();
      }, timeout);
      
      const unsubscribe = vscode.window.onDidChangeTerminalShellIntegration(
        ({terminal, shellIntegration}) => {
          if (terminal === theTerminal) {
            resolve(new CommandRunner(terminal, shellIntegration));
            unsubscribe.dispose();
            clearTimeout(rejectionTimeout);
          }
        }
      );
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
    const output = shellExecution.read();
    return new Command(output, shellExecution, options.timeout);
  }
}

export class Command {
  public execution: Promise<vscode.TerminalShellExecution>;

  constructor(
    public output: AsyncIterable<string>,
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
