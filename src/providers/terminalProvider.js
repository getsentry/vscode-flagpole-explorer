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
exports.CommandRunner = void 0;
const vscode = __importStar(require("vscode"));
const sentry_1 = require("../utils/sentry");
const createTimeoutPromise_1 = require("../utils/createTimeoutPromise");
class CommandRunner {
    terminal;
    shellIntegration;
    static factory(terminal, timeout) {
        // Fast path: shell integration already available
        if (terminal.shellIntegration) {
            (0, sentry_1.addBreadcrumb)('Terminal shell integration ready', 'terminal', 'info');
            return Promise.resolve(new CommandRunner(terminal, terminal.shellIntegration));
        }
        // Wait for shell integration with timeout
        (0, sentry_1.addBreadcrumb)('Waiting for terminal shell integration', 'terminal', 'info', { timeout });
        return (0, createTimeoutPromise_1.createTimeoutPromise)(timeout, 'Terminal shell integration', (resolve) => {
            return vscode.window.onDidChangeTerminalShellIntegration((event) => {
                if (event.terminal === terminal) {
                    (0, sentry_1.addBreadcrumb)('Terminal shell integration established', 'terminal', 'info');
                    resolve(new CommandRunner(event.terminal, event.shellIntegration));
                }
            });
        });
    }
    constructor(terminal, shellIntegration) {
        this.terminal = terminal;
        this.shellIntegration = shellIntegration;
    }
    run(cmd, options) {
        const shellExecution = this.shellIntegration.executeCommand(cmd.bin, cmd.args);
        return new Command(shellExecution, options.timeout);
    }
}
exports.CommandRunner = CommandRunner;
class Command {
    execution;
    constructor(shellExecution, timeout) {
        (0, sentry_1.addBreadcrumb)('Terminal command started', 'terminal', 'info', { timeout });
        this.execution = (0, createTimeoutPromise_1.createTimeoutPromise)(timeout, 'Terminal command execution', (resolve) => {
            return vscode.window.onDidEndTerminalShellExecution((event) => {
                if (event.execution === shellExecution) {
                    (0, sentry_1.addBreadcrumb)('Terminal command completed', 'terminal', 'info', {
                        exitCode: event.exitCode,
                    });
                    resolve(shellExecution);
                }
            });
        });
    }
}
//# sourceMappingURL=terminalProvider.js.map