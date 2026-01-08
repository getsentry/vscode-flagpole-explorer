"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTimeoutPromise = createTimeoutPromise;
const sentry_1 = require("../utils/sentry");
/**
 * Helper to create a promise that rejects after a timeout.
 * Automatically captures timeout errors to Sentry.
 */
function createTimeoutPromise(timeout, operation, onSetup) {
    return new Promise((resolve, reject) => {
        const rejectionTimeout = setTimeout(() => {
            const error = new Error(`${operation} timeout after ${timeout}ms`);
            (0, sentry_1.captureException)(error, { context: 'terminal', operation });
            reject(error);
            subscription.dispose();
        }, timeout);
        const subscription = onSetup((value) => {
            resolve(value);
            subscription.dispose();
            clearTimeout(rejectionTimeout);
        }, (error) => {
            reject(error);
            subscription.dispose();
            clearTimeout(rejectionTimeout);
        });
    });
}
//# sourceMappingURL=createTimeoutPromise.js.map