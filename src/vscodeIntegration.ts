import * as vscode from 'vscode';

import { Integration } from '@sentry/core';

/**
 * Type-safe function patching utility that preserves function signatures.
 * 
 * @template TFunc - The function type being patched
 * @param original - The original function to patch
 * @param wrapper - A wrapper function that receives the original function and returns a patched version
 * @returns The patched function with the same signature as the original
 * 
 * @example
 * // Patch a vscode.window method
 * const patched = patchFunction(
 *   vscode.window.onDidChangeTextEditorSelection,
 *   (original) => (listener, thisArgs, disposables) => {
 *     console.log('Selection changed!');
 *     return original(listener, thisArgs, disposables);
 *   }
 * );
 * 
 * @example
 * // Patch vscode.commands.registerCommand
 * const patched = patchFunction(
 *   vscode.commands.registerCommand,
 *   (original) => (command, callback, thisArgs) => {
 *     console.log(`Registering command: ${command}`);
 *     return original(command, callback, thisArgs);
 *   }
 * );
 */
function patchFunction<TFunc extends (...args: unknown[]) => unknown>(
  original: TFunc,
  wrapper: (original: TFunc) => TFunc
): TFunc {
  return wrapper(original);
}

/**
 * Type-safe method patching utility for patching methods on objects.
 * 
 * @template TObj - The object type containing the method
 * @template TKey - The key of the method on the object
 * @param obj - The object containing the method to patch
 * @param key - The key of the method to patch
 * @param wrapper - A wrapper function that receives the original method and returns a patched version
 * 
 * @example
 * // Patch vscode.window.onDidChangeTextEditorSelection
 * patchMethod(vscode.window, 'onDidChangeTextEditorSelection', (original) => {
 *   return (listener, thisArgs, disposables) => {
 *     console.log('Selection changed!');
 *     return original.call(vscode.window, listener, thisArgs, disposables);
 *   };
 * });
 * 
 * @example
 * // Patch vscode.commands.registerCommand
 * patchMethod(vscode.commands, 'registerCommand', (original) => {
 *   return (command, callback, thisArgs) => {
 *     console.log(`Registering command: ${command}`);
 *     return original.call(vscode.commands, command, callback, thisArgs);
 *   };
 * });
 */
function patchMethod<
  TObj extends Record<string, any>,
  TKey extends keyof TObj
>(
  obj: TObj,
  key: TKey,
  wrapper: (original: TObj[TKey]) => TObj[TKey]
): void {
  const original = obj[key];
  obj[key] = wrapper(original.bind(obj));
}

function wrapWithConsoleLog<TFunc extends (...args: any[]) => any>(original: TFunc): TFunc {
  return ((...args: Parameters<TFunc>): ReturnType<TFunc> => {
    console.log(`VSCodeExtensionIntegration ${original.name}`, args);
    return original(...args);
  }) as TFunc;
}

export default function VSCodeExtensionIntegration(): Integration {
  return {
    name: 'VSCodeExtensionIntegration',
    setupOnce: () => {
      console.log('VSCodeExtensionIntegration setupOnce');
      
      // Example: Patch vscode.window methods with full type safety
      patchMethod(vscode.window, 'onDidChangeTextEditorSelection', wrapWithConsoleLog);
      patchMethod(vscode.window, 'onDidChangeTerminalShellIntegration', wrapWithConsoleLog);
      patchMethod(vscode.window, 'onDidEndTerminalShellExecution', wrapWithConsoleLog);
      patchMethod(vscode.commands, 'registerTextEditorCommand', wrapWithConsoleLog);
      patchMethod(vscode.commands, 'registerCommand', wrapWithConsoleLog);
    },
  };
}
