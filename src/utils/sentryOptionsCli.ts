const MIN_CLI_VERSION = '1.2.13';

/**
 * Quote a value for a POSIX shell, so the terminal passes it through as one
 * literal argument: no expansion of `$`, backticks, globs or whitespace.
 */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/** Expand a leading `~` or `$HOME` the way the shell would have. */
export function expandHome(path: string, home: string): string {
  return path.replace(/^(~|\$HOME|\$\{HOME\})(?=\/|$)/, home);
}

/**
 * Explains an `eval` exit code that means the CLI itself is unusable, or
 * returns `null`. Other failures are already printed in the terminal.
 */
export function cliProblem(exitCode: number | undefined): string | null {
  switch (exitCode) {
    case 127:
      return `Flag evaluation needs sentry-options-cli ${MIN_CLI_VERSION} or later, and it isn't installed.`;
    case 126:
      return 'sentry-options-cli was found but is not executable.';
    case 2:
      // clap's usage error: CLIs before 1.2.13 have no `eval` subcommand.
      return `Flag evaluation needs sentry-options-cli ${MIN_CLI_VERSION} or later. Check \`sentry-options-cli --version\`.`;
    default:
      return null;
  }
}
