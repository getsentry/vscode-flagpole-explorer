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
  let rejectionTimeout: ReturnType<typeof setTimeout>;
  let subscription: vscode.Disposable;

  const timeoutPromise = new Promise<never>((_, reject) => {
    rejectionTimeout = setTimeout(() => {
      const error = new Error(`${operation} timeout after ${timeout}ms`);
      captureException(error, { context: 'terminal', operation });
      reject(error);
    }, timeout);
  });

  const operationPromise = new Promise<T>((resolve, reject) => {
    subscription = onSetup(resolve, reject);
  });

  return Promise.race([operationPromise, timeoutPromise]).finally(() => {
    clearTimeout(rejectionTimeout);
    subscription.dispose();
  });
}
