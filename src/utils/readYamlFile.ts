import yaml from 'yaml';

export function parseYaml(content: string) {
  return yaml.parseDocument(content, {strict: true, keepSourceTokens: true});
}
