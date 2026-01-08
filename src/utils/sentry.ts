import {
  NodeClient,
  defaultStackParser,
  makeNodeTransport,
  Scope,
  type SeverityLevel,
  getDefaultIntegrations,
  startSpan,
  startInactiveSpan,
  startSession,
  captureSession,
} from '@sentry/node';
import * as vscode from 'vscode';

let isInitialized = false;
let sentryScope: Scope | null = null;
let sentryClient: NodeClient | null = null;

const SENTRY_DSN = 'https://de6384136e8cd20d0224bfc245100b12@o1.ingest.us.sentry.io/4509634000519168';

/**
 * Initialize Sentry for error tracking and performance monitoring.
 * Uses manual client/scope setup to avoid polluting global state in VSCode extensions.
 * See: https://docs.sentry.io/platforms/javascript/best-practices/shared-environments/
 */
export function initializeSentry(context: vscode.ExtensionContext): void {
  if (isInitialized) {
    return;
  }

  const config = vscode.workspace.getConfiguration('flagpole-explorer');
  const allowDiagnostics = config.get<boolean>('allowSendingDiagnostics', true);

  // Only initialize if user has not opted out
  if (!allowDiagnostics) {
    console.log('Sentry diagnostics disabled by user preference.');
    return;
  }

  const extension = vscode.extensions.getExtension('getsentry.flagpole-explorer');
  const version = extension?.packageJSON?.version || 'unknown';
  
  // Detect IDE type (Cursor, VSCode, etc.)
  const ideType = vscode.env.appName.toLowerCase();
  
  // Use version 0.0.0 as development indicator
  const environment = version === '0.0.0' ? 'development' : 'production';
  const isDevelopment = environment === 'development';

  // Filter out integrations that use global state
  // For VSCode extensions, we want to avoid polluting the global environment
  const integrationsToExclude = [
    'OnUncaughtException',
    'OnUnhandledRejection',
    'ContextLines',
  ];
  
  // In development, also exclude Console to keep console.log working in VSCode extension host
  // In production, keep Console to capture console messages as breadcrumbs
  if (isDevelopment) {
    integrationsToExclude.push('Console');
  }
  
  const integrations = getDefaultIntegrations({}).filter((integration) => {
    return !integrationsToExclude.includes(integration.name);
  });

  // Manually create client instead of using Sentry.init()
  sentryClient = new NodeClient({
    dsn: SENTRY_DSN,
    transport: makeNodeTransport,
    stackParser: defaultStackParser,
    integrations,
    environment,
    release: `flagpole-explorer@${version}`,
    tracesSampleRate: 1.0,
    beforeSend(event) {
      // Double-check user preference before sending
      const currentConfig = vscode.workspace.getConfiguration('flagpole-explorer');
      if (!currentConfig.get<boolean>('allowSendingDiagnostics', true)) {
        console.log('Sentry event blocked by user preference:', event);
        return null;
      }
      return event;
    },
  });

  // Create a scope and attach the client
  sentryScope = new Scope();
  sentryScope.setClient(sentryClient);

  // Initialize the client after setting it on the scope
  sentryClient.init();

  // Set user context
  sentryScope.setUser({
    id: vscode.env.machineId,
  });

  // Set tags
  sentryScope.setTags({
    'ide.type': ideType,
    'ide.version': vscode.version,
    'ide.language': vscode.env.language,
    'extension.version': version,
  });

  const session = startSession({
  // Start a session for release health tracking
    release: `flagpole-explorer@${version}`,
    environment,
  });
  sentryScope.setSession(session);

  isInitialized = true;
  console.log(`Sentry initialized for Flagpole Explorer (isolated scope) - ${environment} environment, ${ideType} IDE, version ${version}`);
}

/**
 * Wrap an async function with Sentry error handling and span tracking.
 */
export function withSentry<T extends (...args: any[]) => Promise<any>>(
  operationName: string,
  fn: T
): T {
  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    if (!sentryClient || !sentryScope) {
      return fn(...args);
    }

    return startSpan(
      {
        name: operationName,
        op: 'function',
      },
      async () => {
        try {
          return await fn(...args);
        } catch (error) {
          sentryScope?.captureException(error);
          throw error;
        }
      }
    );
  }) as T;
}

/**
 * Wrap a synchronous function with Sentry error handling and span tracking.
 */
export function withSentrySync<T extends (...args: any[]) => any>(
  operationName: string,
  fn: T
): T {
  return ((...args: Parameters<T>): ReturnType<T> => {
    if (!sentryClient || !sentryScope) {
      return fn(...args);
    }

    return startSpan(
      {
        name: operationName,
        op: 'function',
      },
      () => {
        try {
          return fn(...args);
        } catch (error) {
          sentryScope?.captureException(error);
          throw error;
        }
      }
    );
  }) as T;
}

/**
 * Start a manual span for long-running operations.
 * Returns a function to end the span.
 */
export function startManualSpan(operationName: string, op: string = 'operation'): () => void {
  if (!sentryClient) {
    return () => {}; // No-op if not initialized
  }

  const span = startInactiveSpan({
    name: operationName,
    op,
  });

  return () => {
    if (span) {
      span.end();
    }
  };
}

/**
 * Capture a message to Sentry with optional context.
 */
export function captureMessage(
  message: string,
  level: SeverityLevel = 'info',
  context?: Record<string, any>
): void {
  if (!sentryScope) {
    return;
  }

  if (context) {
    sentryScope.setContext('additional', context);
  }
  
  sentryScope.captureMessage(message, level);
}

/**
 * Capture an exception to Sentry with optional context.
 */
export function captureException(error: Error, context?: Record<string, any>): void {
  if (!sentryScope) {
    return;
  }

  if (context) {
    sentryScope.setContext('additional', context);
  }
  
  sentryScope.captureException(error);
}

/**
 * Set user context for Sentry events.
 */
export function setUser(user: { id?: string; email?: string; username?: string }): void {
  if (!sentryScope) {
    return;
  }

  sentryScope.setUser(user);
}

/**
 * Add breadcrumb for debugging context.
 */
export function addBreadcrumb(
  message: string,
  category: string = 'default',
  level: SeverityLevel = 'info',
  data?: Record<string, any>
): void {
  if (!sentryScope) {
    return;
  }

  sentryScope.addBreadcrumb({
    message,
    category,
    level,
    data,
  });
}

/**
 * Start an active span for synchronous operations.
 * Use this for wrapping functions that need to be traced.
 */
export function startActiveSpan<T>(
  options: { name: string; op: string },
  callback: () => T
): T {
  if (!sentryClient || !sentryScope) {
    return callback();
  }

  return startSpan(options, callback);
}

/**
 * Start an active span for async operations.
 * Use this for wrapping async functions that need to be traced.
 */
export async function startActiveSpanAsync<T>(
  options: { name: string; op: string },
  callback: () => Promise<T>
): Promise<T> {
  if (!sentryClient || !sentryScope) {
    return callback();
  }

  return startSpan(options, callback);
}

/**
 * Flush Sentry events before extension deactivation.
 */
export async function flushSentry(): Promise<void> {
  if (sentryClient && sentryScope) {
    // End and capture the session before flushing
    const session = sentryScope.getSession();
    if (session) {
      sentryScope.setSession({
        ...session,
        status: 'exited',
      });
      captureSession();
    }
    
    await sentryClient.flush(2000);
  }
}

