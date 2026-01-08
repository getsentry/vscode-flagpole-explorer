# Sentry Integration

This extension includes Sentry integration for error tracking and performance monitoring to help us improve the extension.

The integration uses **Sentry v10** and follows [Sentry's best practices for shared environments](https://docs.sentry.io/platforms/javascript/best-practices/shared-environments/) like VSCode extensions. Per the documentation, we **do not use `Sentry.init()`** to avoid polluting global state. Instead:
- We manually create a `NodeClient` and `Scope`
- We filter out integrations that modify global state (OnUncaughtException, OnUnhandledRejection, etc.)
- We set the client on the scope before initializing
- Events are isolated to this extension and won't interfere with other Sentry instances

## Configuration

By default, diagnostic data is sent to help us identify and fix issues. If you prefer to opt out:

1. Open VS Code Settings (`Cmd+,` on Mac, `Ctrl+,` on Windows/Linux)
2. Search for "Flagpole Diagnostics"
3. Uncheck **`flagpole-explorer.allowSendingDiagnostics`**

### Setting Details

- **`flagpole-explorer.allowSendingDiagnostics`**: (default: `true`)
  - Allow sending diagnostic data (errors and performance metrics) to Sentry
  - Helps us identify and fix bugs faster
  - No sensitive data or file contents are transmitted
  - Set to `false` to completely disable diagnostic reporting

## What Gets Tracked

### Error Tracking

All errors are automatically captured and sent to Sentry, including:
- Extension activation errors
- Provider registration failures
- File processing errors
- Command execution errors
- Any unhandled exceptions

### Performance Monitoring

The extension tracks performance with spans for:
- Extension activation
- Provider registration (each provider)
- Store initialization
- File discovery and processing

### Session Tracking

The extension tracks sessions for release health monitoring:
- A session starts when the extension is activated
- A session ends when the extension is deactivated
- Session data helps track crash-free usage rates
- Provides insights into extension stability across releases

### Breadcrumbs

The extension logs breadcrumbs for debugging context:
- Extension lifecycle events (activation, deactivation)
- Provider registration attempts
- File searches and discoveries
- Store creation

### User Context

The following non-identifiable information is included:
- IDE type (VSCode, Cursor, etc.)
- IDE version
- IDE language setting
- Extension version
- Machine ID (anonymized)
- Environment (development if extension version is 0.0.0, otherwise production)
- Session information (activation/deactivation timestamps for health metrics)

## Example Configuration

To disable diagnostics, add to your `.vscode/settings.json`:

```json
{
  "flagpole-explorer.allowSendingDiagnostics": false
}
```

## Using Sentry in Your Code

If you're contributing to this extension and want to add Sentry tracking to your code:

### Wrapping Async Functions

```typescript
import { withSentry } from './utils/sentry';

const myAsyncFunction = withSentry('myAsyncFunction', async (param: string) => {
  // Your code here
  return result;
});
```

### Wrapping Sync Functions

```typescript
import { withSentrySync } from './utils/sentry';

const mySyncFunction = withSentrySync('mySyncFunction', (param: string) => {
  // Your code here
  return result;
});
```

### Manual Spans

```typescript
import { startManualSpan } from './utils/sentry';

function myFunction() {
  const endSpan = startManualSpan('longOperation', 'processing');
  
  try {
    // Your long-running operation
  } finally {
    endSpan();
  }
}
```

### Capturing Exceptions

```typescript
import { captureException, captureMessage } from './utils/sentry';

try {
  // Your code
} catch (error) {
  captureException(error as Error, {
    context: 'myOperation',
    additionalData: 'value',
  });
}

// Or capture a message
captureMessage('Something notable happened', 'info', {
  detail: 'Additional context',
});
```

### Adding Breadcrumbs

```typescript
import { addBreadcrumb } from './utils/sentry';

addBreadcrumb(
  'User opened settings',
  'user-action',
  'info',
  { setting: 'theme' }
);
```

## Privacy

This extension respects user privacy:
- No personal information is collected
- Only error messages and stack traces are sent
- Machine ID is anonymized
- No file contents or sensitive data are transmitted
- You can opt out at any time by disabling the diagnostic setting
- Data is sent to Sentry's US region and follows their [privacy policy](https://sentry.io/privacy/)

## Troubleshooting

### Disabling Diagnostics

If you want to disable diagnostic reporting:

1. Open Settings (`Cmd+,` or `Ctrl+,`)
2. Search for "allowSendingDiagnostics"
3. Uncheck the checkbox
4. Reload the window (`Cmd+R` or `Ctrl+R`)

### Verifying Diagnostics Are Disabled

Check the VS Code Output panel:
1. Open Output panel (`Cmd+Shift+U` or `Ctrl+Shift+U`)
2. Select "Flagpole Explorer" from the dropdown
3. Look for the message: "Sentry diagnostics disabled by user preference."

## Support

For issues related to Sentry integration, please open an issue on the GitHub repository.

