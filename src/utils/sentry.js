"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSentry = initializeSentry;
exports.withSentry = withSentry;
exports.withSentrySync = withSentrySync;
exports.startManualSpan = startManualSpan;
exports.captureMessage = captureMessage;
exports.captureException = captureException;
exports.setUser = setUser;
exports.addBreadcrumb = addBreadcrumb;
exports.startActiveSpan = startActiveSpan;
exports.startActiveSpanAsync = startActiveSpanAsync;
exports.flushSentry = flushSentry;
const node_1 = require("@sentry/node");
const vscode = __importStar(require("vscode"));
let isInitialized = false;
let sentryScope = null;
let sentryClient = null;
const SENTRY_DSN = 'https://de6384136e8cd20d0224bfc245100b12@o1.ingest.us.sentry.io/4509634000519168';
/**
 * Initialize Sentry for error tracking and performance monitoring.
 * Uses manual client/scope setup to avoid polluting global state in VSCode extensions.
 * See: https://docs.sentry.io/platforms/javascript/best-practices/shared-environments/
 */
function initializeSentry(context) {
    if (isInitialized) {
        return;
    }
    const config = vscode.workspace.getConfiguration('flagpole-explorer');
    const allowDiagnostics = config.get('allowSendingDiagnostics', true);
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
    const integrations = (0, node_1.getDefaultIntegrations)({}).filter((integration) => {
        return !integrationsToExclude.includes(integration.name);
    });
    // Manually create client instead of using Sentry.init()
    sentryClient = new node_1.NodeClient({
        dsn: SENTRY_DSN,
        transport: node_1.makeNodeTransport,
        stackParser: node_1.defaultStackParser,
        integrations,
        environment,
        release: `flagpole-explorer@${version}`,
        tracesSampleRate: 1.0,
        beforeSend(event) {
            // Double-check user preference before sending
            const currentConfig = vscode.workspace.getConfiguration('flagpole-explorer');
            if (!currentConfig.get('allowSendingDiagnostics', true)) {
                console.log('Sentry event blocked by user preference:', event);
                return null;
            }
            return event;
        },
    });
    // Create a scope and attach the client
    sentryScope = new node_1.Scope();
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
    const session = (0, node_1.startSession)({
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
function withSentry(operationName, fn) {
    return (async (...args) => {
        if (!sentryClient || !sentryScope) {
            return fn(...args);
        }
        return (0, node_1.startSpan)({
            name: operationName,
            op: 'function',
        }, async () => {
            try {
                return await fn(...args);
            }
            catch (error) {
                sentryScope?.captureException(error);
                throw error;
            }
        });
    });
}
/**
 * Wrap a synchronous function with Sentry error handling and span tracking.
 */
function withSentrySync(operationName, fn) {
    return ((...args) => {
        if (!sentryClient || !sentryScope) {
            return fn(...args);
        }
        return (0, node_1.startSpan)({
            name: operationName,
            op: 'function',
        }, () => {
            try {
                return fn(...args);
            }
            catch (error) {
                sentryScope?.captureException(error);
                throw error;
            }
        });
    });
}
/**
 * Start a manual span for long-running operations.
 * Returns a function to end the span.
 */
function startManualSpan(operationName, op = 'operation') {
    if (!sentryClient) {
        return () => { }; // No-op if not initialized
    }
    const span = (0, node_1.startInactiveSpan)({
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
function captureMessage(message, level = 'info', context) {
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
function captureException(error, context) {
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
function setUser(user) {
    if (!sentryScope) {
        return;
    }
    sentryScope.setUser(user);
}
/**
 * Add breadcrumb for debugging context.
 */
function addBreadcrumb(message, category = 'default', level = 'info', data) {
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
function startActiveSpan(options, callback) {
    if (!sentryClient || !sentryScope) {
        return callback();
    }
    return (0, node_1.startSpan)(options, callback);
}
/**
 * Start an active span for async operations.
 * Use this for wrapping async functions that need to be traced.
 */
async function startActiveSpanAsync(options, callback) {
    if (!sentryClient || !sentryScope) {
        return callback();
    }
    return (0, node_1.startSpan)(options, callback);
}
/**
 * Flush Sentry events before extension deactivation.
 */
async function flushSentry() {
    if (sentryClient && sentryScope) {
        // End and capture the session before flushing
        const session = sentryScope.getSession();
        if (session) {
            sentryScope.setSession({
                ...session,
                status: 'exited',
            });
            (0, node_1.captureSession)();
        }
        await sentryClient.flush(2000);
    }
}
//# sourceMappingURL=sentry.js.map