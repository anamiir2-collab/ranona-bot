import { Context } from 'telegraf';

// Re-export each handler with the expected name.
export { handleWarn, handleUnwarn } from '../moderation/warn.js';
export { handleMute, handleUnmute } from '../moderation/mute.js';
export { handleBan, handleUnban } from '../moderation/ban.js';
export { handleKick } from '../moderation/kick.js';
export { handlePromote, handleDemote } from '../moderation/actions_admin.js';
