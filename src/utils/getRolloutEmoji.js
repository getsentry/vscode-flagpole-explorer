"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = getRolloutEmoji;
function getRolloutEmoji(rolloutState) {
    switch (rolloutState) {
        case '0%':
            return '⭕';
        case 'partial':
            return '🟠';
        case '100%':
            return '🟢';
        default:
            throw new Error(`Unknown rollout state: ${rolloutState}`);
    }
}
//# sourceMappingURL=getRolloutEmoji.js.map