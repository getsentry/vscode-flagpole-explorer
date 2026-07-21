import * as vscode from 'vscode';
import { Document, isAlias, isMap, isNode, isScalar, isSeq, Node, parseDocument, Scalar, YAMLMap, YAMLSeq } from 'yaml';

/**
 * Builds the `DocumentSymbol` tree for a flagpole.yaml document by parsing the
 * text ourselves rather than asking `vscode.executeDocumentSymbolProvider`.
 *
 * The YAML language server truncates its symbol tree once `yaml.maxItemsComputed`
 * is reached, and flagpole.yaml is large enough to exceed it. Past the cutoff,
 * whole segment bodies come back with their children dropped, which the transform
 * layer then mis-reads as a fully rolled-out (100%) segment. Parsing here has no
 * item budget, so every feature is represented in full regardless of file size.
 *
 * The output mirrors the shape `vscode-json-languageservice` produces so the
 * transform layer and every downstream consumer keep working unchanged:
 *   - a map property becomes a symbol named after its key, whose `detail` is
 *     derived from its *value* node (scalar text, or `'{}'`/`'[]'` for an empty
 *     collection, or `undefined` for a non-empty one);
 *   - a sequence item becomes a symbol named after its index; its `detail` is
 *     derived the same way as a map value. The language server always leaves
 *     sequence-item detail empty, but we populate it so condition value lists
 *     (`- sentry`, `- charlie-test`, ...) can be read back without re-parsing.
 *   - `range` spans the key start to the value's content end, `selectionRange`
 *     covers just the key.
 *
 * flagpole.yaml aliases whole segments and condition-value lists to shared
 * anchors (`- *_internal_orgs_segment`, `value: *_customer_single_tenants`). An
 * alias is resolved to its anchor's node so the aliased segment's real rollout
 * and conditions are seen; otherwise it would look like a bare 100% segment. The
 * alias keeps its own source range so navigation still points at the usage site.
 */
export default function parseFlagpoleSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
  const doc = parseDocument(document.getText());
  if (!doc.contents) {
    return [];
  }
  return collectChildren(document, doc, doc.contents as Node);
}

function collectChildren(document: vscode.TextDocument, doc: Document, node: Node): vscode.DocumentSymbol[] {
  if (isMap(node)) {
    return (node as YAMLMap).items.flatMap(pair => {
      const key = pair.key;
      // Ranges come from the alias usage site (`pair.value`); structure and
      // children come from the resolved anchor, whose own range points at the
      // definition elsewhere in the file.
      const original = pair.value as Node | null;
      const value = resolve(doc, original);
      if (!isScalar(key) || !key.range) {
        return [];
      }
      const keyRange = key.range;
      const endOffset = original?.range ? original.range[1] : keyRange[1];
      const range = new vscode.Range(document.positionAt(keyRange[0]), document.positionAt(endOffset));
      const selectionRange = new vscode.Range(document.positionAt(keyRange[0]), document.positionAt(keyRange[1]));

      const symbol = makeSymbol(String(key.value), getDetail(value), symbolKind(value), range, selectionRange);
      symbol.children = value ? collectChildren(document, doc, value) : [];
      return [symbol];
    });
  }

  if (isSeq(node)) {
    return (node as YAMLSeq).items.flatMap((item, index) => {
      if (!isNode(item) || !item.range) {
        return [];
      }
      const range = new vscode.Range(document.positionAt(item.range[0]), document.positionAt(item.range[1]));
      const resolved = resolve(doc, item);
      const symbol = makeSymbol(String(index), getDetail(resolved), symbolKind(resolved), range, range);
      symbol.children = resolved ? collectChildren(document, doc, resolved) : [];
      return [symbol];
    });
  }

  return [];
}

/**
 * Follows an alias to the node its anchor points at, so aliased segments and
 * condition values expose their real structure. Non-alias nodes pass through.
 */
function resolve(doc: Document, node: Node | null): Node | null {
  if (isAlias(node)) {
    return node.resolve(doc) ?? null;
  }
  return node;
}

/**
 * Mirrors `vscode-json-languageservice`'s `getDetail`: scalars stringify their
 * value, an empty map/seq reports `'{}'`/`'[]'`, and a non-empty collection has
 * no detail. The transform layer depends on the `'[]'`-vs-`undefined` split to
 * tell an empty `conditions` list from one that has items.
 */
function getDetail(node: Node | null): string | undefined {
  if (isScalar(node)) {
    return String((node as Scalar).value);
  }
  if (isMap(node)) {
    return (node as YAMLMap).items.length ? undefined : '{}';
  }
  if (isSeq(node)) {
    return (node as YAMLSeq).items.length ? undefined : '[]';
  }
  return undefined;
}

function symbolKind(node: Node | null): vscode.SymbolKind {
  if (isMap(node)) {
    return vscode.SymbolKind.Module;
  }
  if (isSeq(node)) {
    return vscode.SymbolKind.Array;
  }
  if (isScalar(node)) {
    const value = (node as Scalar).value;
    if (typeof value === 'boolean') {
      return vscode.SymbolKind.Boolean;
    }
    if (typeof value === 'number') {
      return vscode.SymbolKind.Number;
    }
    if (typeof value === 'string') {
      return vscode.SymbolKind.String;
    }
  }
  return vscode.SymbolKind.Variable;
}

function makeSymbol(
  name: string,
  detail: string | undefined,
  kind: vscode.SymbolKind,
  range: vscode.Range,
  selectionRange: vscode.Range,
): vscode.DocumentSymbol {
  // `detail` is typed `string`, but the language server (and the rest of this
  // extension) rely on it being `undefined` for non-empty collections and
  // sequence items; the cast preserves that at runtime.
  return new vscode.DocumentSymbol(name, detail as string, kind, range, selectionRange);
}
