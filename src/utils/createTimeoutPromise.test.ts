import * as assert from '../test-utils/assert';
import * as vscode from 'vscode';
import { createTimeoutPromise } from './createTimeoutPromise';

suite('createTimeoutPromise', () => {
  test('resolves when onSetup calls resolve', async () => {
    const result = await createTimeoutPromise<string>(5000, 'test-resolve', (resolve) => {
      resolve('hello');
      return new vscode.Disposable(() => {});
    });
    assert.strictEqual(result, 'hello');
  });

  test('rejects when onSetup calls reject', async () => {
    await assert.rejects(
      () => createTimeoutPromise<string>(5000, 'test-reject', (_resolve, reject) => {
        reject(new Error('manual reject'));
        return new vscode.Disposable(() => {});
      }),
      /manual reject/,
    );
  });

  test('rejects on timeout', async () => {
    await assert.rejects(
      () => createTimeoutPromise<string>(50, 'test-timeout', () => {
        return new vscode.Disposable(() => {});
      }),
      /test-timeout timeout after 50ms/,
    );
  });

  test('disposes subscription on resolve', async () => {
    let disposed = false;
    await createTimeoutPromise<string>(5000, 'test-dispose-resolve', (resolve) => {
      resolve('ok');
      return new vscode.Disposable(() => { disposed = true; });
    });
    assert.strictEqual(disposed, true);
  });

  test('disposes subscription on reject', async () => {
    let disposed = false;
    await createTimeoutPromise<string>(5000, 'test-dispose-reject', (_resolve, reject) => {
      reject(new Error('fail'));
      return new vscode.Disposable(() => { disposed = true; });
    }).catch(() => {});
    assert.strictEqual(disposed, true);
  });

  test('disposes subscription on timeout', async () => {
    let disposed = false;
    await createTimeoutPromise<string>(50, 'test-dispose-timeout', () => {
      return new vscode.Disposable(() => { disposed = true; });
    }).catch(() => {});
    assert.strictEqual(disposed, true);
  });

  test('clears timeout after resolve', async () => {
    let disposed = false;
    await createTimeoutPromise<string>(50, 'test-clear-timeout', (resolve) => {
      resolve('fast');
      return new vscode.Disposable(() => { disposed = true; });
    });
    // Wait longer than the timeout to ensure it doesn't fire after resolve
    await new Promise(r => setTimeout(r, 100));
    assert.strictEqual(disposed, true);
  });

  test('resolves with async callback', async () => {
    const result = await createTimeoutPromise<number>(5000, 'test-async', (resolve) => {
      setTimeout(() => resolve(42), 10);
      return new vscode.Disposable(() => {});
    });
    assert.strictEqual(result, 42);
  });
});
