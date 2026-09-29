export const MIN_CLI_VERSION = '1.2.13';

/**
 * Given the output of `sentry-options-cli --version`, returns why it can't be
 * used to evaluate flags, or `null` if it can.
 */
export default function cliVersionProblem(versionOutput: string): string | null {
  const match = versionOutput.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!match) {
    if (/not found|no such file/i.test(versionOutput)) {
      return `Flag evaluation needs sentry-options-cli ${MIN_CLI_VERSION} or later, and it isn't installed.`;
    }
    return `Couldn't read the sentry-options-cli version from "${versionOutput.trim()}".`;
  }
  const found = match.slice(1).map(Number);
  const min = MIN_CLI_VERSION.split('.').map(Number);
  for (let i = 0; i < min.length; i++) {
    if (found[i] !== min[i]) {
      return found[i] > min[i]
        ? null
        : `Flag evaluation needs sentry-options-cli ${MIN_CLI_VERSION} or later, found ${match[0]}.`;
    }
  }
  return null;
}
