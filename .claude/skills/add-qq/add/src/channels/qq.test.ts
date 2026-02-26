import { describe, it, expect, vi, beforeEach } from 'vitest';

import { QQChannel, QQCredentials } from './qq.js';
import { logger } from '../logger.js';

// Mock the logger
vi.mock('../logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock qq-guild-bot
vi.mock('qq-guild-bot', () => ({
  createOpenAPI: vi.fn().mockReturnValue({
    messageApi: {
      postMessage: vi.fn().mockResolvedValue(undefined),
    },
  }),
  createWebsocket: vi.fn().mockReturnValue({
    on: vi.fn(),
    close: vi.fn(),
  }),
  AvailableIntentsEventsEnum: {
    GUILD_MESSAGES: 'GUILD_MESSAGES',
    DIRECT_MESSAGE: 'DIRECT_MESSAGE',
    PUBLIC_GUILD_MESSAGES: 'PUBLIC_GUILD_MESSAGES',
  },
}));

describe('QQChannel', () => {
  const mockCredentials: QQCredentials = {
    appID: '123456789',
    token: 'test-token',
  };

  const mockOpts = {
    onMessage: vi.fn(),
    onChatMetadata: vi.fn(),
    registeredGroups: vi.fn().mockReturnValue({}),
  };

  let channel: QQChannel;

  beforeEach(() => {
    vi.clearAllMocks();
    channel = new QQChannel(mockCredentials, mockOpts);
  });

  describe('constructor', () => {
    it('should set the channel name to qq', () => {
      expect(channel.name).toBe('qq');
    });

    it('should not be connected initially', () => {
      expect(channel.isConnected()).toBe(false);
    });
  });

  describe('ownsJid', () => {
    it('should return true for qq: prefixed JIDs', () => {
      expect(channel.ownsJid('qq:123456')).toBe(true);
      expect(channel.ownsJid('qq:guild-channel')).toBe(true);
    });

    it('should return false for non-qq JIDs', () => {
      expect(channel.ownsJid('whatsapp:123456')).toBe(false);
      expect(channel.ownsJid('tg:123456')).toBe(false);
      expect(channel.ownsJid('123456@g.us')).toBe(false);
    });
  });

  describe('setTyping', () => {
    it('should be a no-op (QQ does not support typing indicators)', async () => {
      await channel.setTyping('qq:123', true);

      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ jid: 'qq:123', isTyping: true }),
        'QQ typing indicator (not supported)',
      );
    });
  });
});
