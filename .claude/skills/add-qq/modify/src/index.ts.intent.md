# Intent: src/index.ts modifications

## What changed
Added QQ Bot channel support alongside existing WhatsApp channel using the `Channel` interface.

## Key sections

### Imports (top of file)
- Added: `QQChannel` from `./channels/qq.js`
- Added: `QQ_APP_ID`, `QQ_TOKEN`, `QQ_SECRET`, `QQ_ONLY` from `./config.js`
- Added: `findChannel` from `./router.js` (if not already present from Telegram)
- Added: `Channel` type from `./types.js` (if not already present)

### Module-level state
- Keep: `const channels: Channel[] = []` — array of all active channels
- Keep: `let whatsapp: WhatsAppChannel` — still needed for `syncGroupMetadata` reference

### processGroupMessages()
- Uses `findChannel(channels, chatJid)` lookup at the start
- Uses `channel.setTyping?.()` for typing indicators (QQ doesn't support typing)
- Uses `channel.sendMessage()` in output callback

### startMessageLoop()
- Uses `findChannel(channels, chatJid)` lookup per group in message processing
- Uses `channel.setTyping?.()` for typing indicators

### main()
- Changed: shutdown disconnects all channels via `for (const ch of channels)`
- Keep: shared `channelOpts` object for channel callbacks
- Keep: conditional WhatsApp creation (`if (!QQ_ONLY)`)
- Added: conditional QQ creation (`if (QQ_APP_ID && QQ_TOKEN && QQ_SECRET)`)
- Changed: scheduler `sendMessage` uses `findChannel()` → `channel.sendMessage()`
- Changed: IPC `sendMessage` uses `findChannel()` → `channel.sendMessage()`
- Keep: IPC `syncGroupMetadata` still uses `whatsapp?.syncGroupMetadata()` (QQ doesn't have equivalent)

## Invariants
- All existing message processing logic (triggers, cursors, idle timers) is preserved
- The `runAgent` function is completely unchanged
- State management (loadState/saveState) is unchanged
- Recovery logic is unchanged
- Container runtime check is unchanged (ensureContainerSystemRunning)

## Must-keep
- The `escapeXml` and `formatMessages` re-exports
- The `_setRegisteredGroups` test helper
- The `isDirectRun` guard at bottom
- All error handling and cursor rollback logic in processGroupMessages
- The outgoing queue flush and reconnection logic (in WhatsAppChannel, not here)

## QQ-specific notes
- QQ JIDs use format `qq:<chat_id>` or `qq:<guild_id>-<channel_id>`
- QQ doesn't support typing indicators (setTyping is a no-op)
- QQ has a 5-minute timeout for passive messages (replies to user messages)
- QQ bot requires all three credentials: APP_ID, TOKEN, and SECRET
