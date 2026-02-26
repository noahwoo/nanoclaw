import { createOpenAPI, createWebsocket, IMessage, AvailableIntentsEventsEnum } from 'qq-guild-bot';

import { ASSISTANT_NAME, TRIGGER_PATTERN } from '../config.js';
import { logger } from '../logger.js';
import {
  Channel,
  OnChatMetadata,
  OnInboundMessage,
  RegisteredGroup,
} from '../types.js';

export interface QQChannelOpts {
  onMessage: OnInboundMessage;
  onChatMetadata: OnChatMetadata;
  registeredGroups: () => Record<string, RegisteredGroup>;
}

export interface QQCredentials {
  appID: string;
  token: string;
}

export class QQChannel implements Channel {
  name = 'qq';

  private client: ReturnType<typeof createOpenAPI> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private ws: any = null;
  private opts: QQChannelOpts;
  private credentials: QQCredentials;
  private connected = false;

  constructor(credentials: QQCredentials, opts: QQChannelOpts) {
    this.credentials = credentials;
    this.opts = opts;
  }

  async connect(): Promise<void> {
    // Initialize QQ Bot client
    this.client = createOpenAPI({
      appID: this.credentials.appID,
      token: this.credentials.token,
      sandbox: false,
    });

    // Create websocket connection
    this.ws = createWebsocket({
      appID: this.credentials.appID,
      token: this.credentials.token,
      sandbox: false,
      intents: [
        AvailableIntentsEventsEnum.GUILD_MESSAGES,
        AvailableIntentsEventsEnum.DIRECT_MESSAGE,
        AvailableIntentsEventsEnum.PUBLIC_GUILD_MESSAGES,
      ],
    });

    // Handle messages
    this.ws.on('GUILD_MESSAGES', (event: { msg: IMessage }) => {
      this.handleMessage(event.msg).catch((err: Error) => {
        logger.error({ err }, 'Error handling guild message');
      });
    });

    this.ws.on('DIRECT_MESSAGE', (event: { msg: IMessage }) => {
      this.handleMessage(event.msg, true).catch((err: Error) => {
        logger.error({ err }, 'Error handling direct message');
      });
    });

    this.ws.on('PUBLIC_GUILD_MESSAGES', (event: { msg: IMessage }) => {
      this.handleMessage(event.msg).catch((err: Error) => {
        logger.error({ err }, 'Error handling public guild message');
      });
    });

    // Handle AT_MESSAGE_CREATE (mentions)
    this.ws.on('AT_MESSAGE_CREATE', (event: { msg: IMessage }) => {
      this.handleMessage(event.msg, false, true).catch((err: Error) => {
        logger.error({ err }, 'Error handling at message');
      });
    });

    // Handle errors
    this.ws.on('ERROR', (err: Error) => {
      logger.error({ err }, 'QQ WebSocket error');
    });

    // Wait for connection
    return new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('QQ Bot connection timeout'));
      }, 30000);

      this.ws!.on('READY', () => {
        this.connected = true;
        clearTimeout(timeout);
        logger.info(
          { appID: this.credentials.appID },
          'QQ Bot connected',
        );
        console.log(`\n  QQ Bot connected: ${this.credentials.appID}`);
        console.log(`  Send /chatid to get a chat's registration ID\n`);
        resolve();
      });

      this.ws!.on('ERROR', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private async handleMessage(
    msg: IMessage,
    isDirectMessage = false,
    isAtMessage = false,
  ): Promise<void> {
    // Handle /chatid command
    if (msg.content?.trim() === '/chatid') {
      const chatType = msg.guild_id ? 'guild' : 'direct';
      const chatId = msg.channel_id || msg.guild_id || msg.author?.id;
      const chatJid = `qq:${chatId}`;

      // Reply with chat ID
      try {
        await this.client!.messageApi.postMessage(msg.channel_id!, {
          content: `Chat ID: \`${chatJid}\`\nType: ${chatType}`,
          msg_id: msg.id,
        });
      } catch (err) {
        logger.error({ err, msg }, 'Failed to send /chatid response');
      }
      return;
    }

    // Skip other commands
    if (msg.content?.startsWith('/')) return;

    const chatId = msg.channel_id || msg.guild_id || msg.author?.id;
    if (!chatId) {
      logger.warn({ msg }, 'QQ message without identifiable chat ID');
      return;
    }

    const chatJid = `qq:${chatId}`;
    const timestamp = new Date(msg.timestamp).toISOString();

    // Get sender info
    const senderName =
      msg.member?.nick || msg.author?.username || msg.author?.id || 'Unknown';
    const sender = msg.author?.id || '';
    const msgId = msg.id;

    // Get chat name
    const chatName = msg.guild_id
      ? `${msg.guild_id}-${msg.channel_id}`
      : senderName;

    // Determine if this is a group chat
    const isGroup = !!msg.guild_id;

    // Process content - handle mentions
    let content = msg.content || '';

    // If it's an @ message and doesn't already have trigger pattern, prepend it
    if (isAtMessage && !TRIGGER_PATTERN.test(content)) {
      content = `@${ASSISTANT_NAME} ${content}`;
    }

    // Store chat metadata for discovery
    this.opts.onChatMetadata(chatJid, timestamp, chatName, 'qq', isGroup);

    // Only deliver full message for registered groups
    const group = this.opts.registeredGroups()[chatJid];
    if (!group) {
      logger.debug(
        { chatJid, chatName },
        'Message from unregistered QQ chat',
      );
      return;
    }

    // Deliver message
    this.opts.onMessage(chatJid, {
      id: msgId,
      chat_jid: chatJid,
      sender,
      sender_name: senderName,
      content,
      timestamp,
      is_from_me: false,
    });

    logger.info(
      { chatJid, chatName, sender: senderName },
      'QQ message stored',
    );
  }

  async sendMessage(jid: string, text: string): Promise<void> {
    if (!this.client || !this.connected) {
      logger.warn('QQ Bot not initialized or not connected');
      return;
    }

    try {
      const chatId = jid.replace(/^qq:/, '');

      // Parse the chat ID to determine type
      const parts = chatId.split('-');

      if (parts.length === 2) {
        // Guild-Channel format: guild_id-channel_id
        const [guildId, channelId] = parts;

        // QQ has a message length limit - split if needed
        const MAX_LENGTH = 2000;
        if (text.length <= MAX_LENGTH) {
          await this.client.messageApi.postMessage(channelId, {
            content: text,
          });
        } else {
          // Split long messages
          for (let i = 0; i < text.length; i += MAX_LENGTH) {
            await this.client.messageApi.postMessage(channelId, {
              content: text.slice(i, i + MAX_LENGTH),
            });
          }
        }
      } else {
        // Direct message or single channel
        const MAX_LENGTH = 2000;
        if (text.length <= MAX_LENGTH) {
          await this.client.messageApi.postMessage(chatId, {
            content: text,
          });
        } else {
          for (let i = 0; i < text.length; i += MAX_LENGTH) {
            await this.client.messageApi.postMessage(chatId, {
              content: text.slice(i, i + MAX_LENGTH),
            });
          }
        }
      }

      logger.info({ jid, length: text.length }, 'QQ message sent');
    } catch (err) {
      logger.error({ jid, err }, 'Failed to send QQ message');
      throw err;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  ownsJid(jid: string): boolean {
    return jid.startsWith('qq:');
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      logger.info('QQ Bot stopped');
    }
    this.client = null;
  }

  async setTyping(jid: string, isTyping: boolean): Promise<void> {
    // QQ doesn't have a direct typing indicator API
    // This is a no-op for compatibility
    logger.debug({ jid, isTyping }, 'QQ typing indicator (not supported)');
  }
}
