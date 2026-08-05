import * as vscode from 'vscode';

/**
 * Returns a label for `uri` using just enough trailing path segments to tell
 * it apart from every other uri in `allUris`. Flagpole files are always named
 * `flagpole.yaml`, so when a workspace has more than one, the bare basename
 * can't distinguish them; this walks up the path only as far as needed.
 */
export function getDisambiguatedLabel(uri: vscode.Uri, allUris: vscode.Uri[]): string {
  const segments = uri.path.split('/').filter(Boolean);
  const otherSegments = allUris
    .filter(other => other.toString() !== uri.toString())
    .map(other => other.path.split('/').filter(Boolean));

  let length = 1;
  while (length < segments.length) {
    const suffix = segments.slice(-length).join('/');
    const collides = otherSegments.some(other => other.slice(-length).join('/') === suffix);
    if (!collides) {
      break;
    }
    length++;
  }

  return segments.slice(-length).join('/');
}
