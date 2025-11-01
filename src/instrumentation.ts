import {
  defaultStackParser,
  getDefaultIntegrations,
  makeNodeTransport,
  NodeClient,
  // makeFetchTransport,
  // BrowserClient,
  Scope,
} from "@sentry/node-core";
import VSCodeExtensionIntegration from "./vscodeIntegration";

export function initializeSentry({dsn}: {dsn: string}): Scope {
  // filter integrations that use the global variable
  console.log('Default integrations', getDefaultIntegrations());

  const client = new NodeClient({
    dsn,
    transport: makeNodeTransport,
    // transport: makeFetchTransport,
    stackParser: defaultStackParser,
    // integrations: integrations,
    integrations: [VSCodeExtensionIntegration],
  });
  const scope = new Scope();
  scope.setClient(client);
  client.init(); // initializing has to be done after setting the client on the scope
  return scope;
}