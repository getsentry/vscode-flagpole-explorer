import type * as vscode from 'vscode';
import { captureException } from '../utils/sentry';

/**
 * Helper to create a promise that rejects after a timeout.
 * Automatically captures timeout errors to Sentry.
 */
export function createTimeoutPromise<T>(
  timeout: number,
  operation: string,
  onSetup: (resolve: (value: T) => void, reject: (error: Error) => void) => vscode.Disposable): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const rejectionTimeout = setTimeout(() => {
      const error = new Error(`${operation} timeout after ${timeout}ms`);
      captureException(error, { context: 'terminal', operation });
      reject(error);
      subscription.dispose();
    }, timeout);

    const subscription = onSetup(
      (value) => {
        resolve(value);
        subscription.dispose();
        clearTimeout(rejectionTimeout);
      },
      (error) => {
        reject(error);
        subscription.dispose();
        clearTimeout(rejectionTimeout);
      }
    );
  });
}
