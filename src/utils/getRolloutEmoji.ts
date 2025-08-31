import { RolloutState } from '../types';

export default function getRolloutEmoji(rolloutState: RolloutState): string {
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
