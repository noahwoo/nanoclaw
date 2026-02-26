---
name: add-qq
description: Add QQ Bot as a channel. Can replace WhatsApp entirely or run alongside it. Supports QQ Groups (群), Channels (频道), and Direct Messages (单聊).
---

# Add QQ Bot Channel

This skill adds QQ Bot support to NanoClaw using the skills engine for deterministic code changes, then walks through interactive setup.

## Phase 1: Pre-flight

### Check if already applied

Read `.nanoclaw/state.yaml`. If `qq` is in `applied_skills`, skip to Phase 3 (Setup). The code changes are already in place.

### Ask the user

Use `AskUserQuestion` to collect configuration:

AskUserQuestion: Should QQ Bot replace WhatsApp or run alongside it?
- **Replace WhatsApp** - QQ will be the only channel (sets QQ_ONLY=true)
- **Alongside** - Both QQ and WhatsApp channels active

AskUserQuestion: Do you have QQ Bot credentials, or do you need to create them?

If they have credentials, collect:
- QQ_APP_ID
- QQ_TOKEN
- QQ_SECRET

If not, we'll create them in Phase 3.

## Phase 2: Apply Code Changes

Run the skills engine to apply this skill's code package. The package files are in this directory alongside this SKILL.md.

### Initialize skills system (if needed)

If `.nanoclaw/` directory doesn't exist yet:

```bash
npx tsx scripts/apply-skill.ts --init
```

Or call `initSkillsSystem()` from `skills-engine/migrate.ts`.

### Apply the skill

```bash
npx tsx scripts/apply-skill.ts .claude/skills/add-qq
```

This deterministically:
- Adds `src/channels/qq.ts` (QQChannel class implementing Channel interface)
- Adds `src/channels/qq.test.ts` (unit tests)
- Three-way merges QQ support into `src/index.ts` (multi-channel support)
- Three-way merges QQ config into `src/config.ts` (QQ_APP_ID, QQ_TOKEN, QQ_SECRET, QQ_ONLY exports)
- Installs the `qq-guild-bot` npm dependency
- Updates `.env.example` with QQ environment variables
- Records the application in `.nanoclaw/state.yaml`

If the apply reports merge conflicts, read the intent files:
- `modify/src/index.ts.intent.md` — what changed and invariants for index.ts
- `modify/src/config.ts.intent.md` — what changed for config.ts

### Validate code changes

```bash
npm test
npm run build
```

All tests must pass (including the new qq tests) and build must be clean before proceeding.

## Phase 3: Setup

### Create QQ Bot (if needed)

If the user doesn't have credentials, tell them:

> I need you to create a QQ Bot:
>
> 1. Go to the [QQ Bot Open Platform](https://bot.q.qq.com/) and register as a developer
> 2. Create a new bot application
> 3. Note down the AppID, Token, and AppSecret
> 4. Add your bot to a sandbox group/channel for testing
> 5. Whitelist your server's public IP address in the bot dashboard

Wait for the user to provide the credentials.

### Configure environment

Add to `.env`:

```bash
QQ_APP_ID=<your-app-id>
QQ_TOKEN=<your-token>
QQ_SECRET=<your-secret>
```

If they chose to replace WhatsApp:

```bash
QQ_ONLY=true
```

Sync to container environment:

```bash
mkdir -p data/env && cp .env data/env/env
```

The container reads environment from `data/env/env`, not `.env` directly.

### Build and restart

```bash
npm run build
launchctl kickstart -k gui/$(id -u)/com.nanoclaw  # macOS
# Linux: systemctl --user restart nanoclaw
```

## Phase 4: Registration

### Get Channel/Group ID

Tell the user:

> 1. Add your bot to a QQ group or channel
> 2. Send `/chatid` in the group/channel — it will reply with the chat ID
>
> Wait for the bot to respond with the chat ID (format: `qq:<channel_id>` or `qq:<group_id>`).

Wait for the user to provide the chat ID.

### Register the chat

Use the IPC register flow or register directly. The chat ID, name, and folder name are needed.

For a main chat (responds to all messages, uses the `main` folder):

```typescript
registerGroup("qq:<chat-id>", {
  name: "<chat-name>",
  folder: "main",
  trigger: `@${ASSISTANT_NAME}`,
  added_at: new Date().toISOString(),
  requiresTrigger: false,
});
```

For additional chats (trigger-only):

```typescript
registerGroup("qq:<chat-id>", {
  name: "<chat-name>",
  folder: "<folder-name>",
  trigger: `@${ASSISTANT_NAME}`,
  added_at: new Date().toISOString(),
  requiresTrigger: true,
});
```

## Phase 5: Verify

### Test the connection

Tell the user:

> Send a message to your registered QQ chat:
> - For main chat: Any message works
> - For non-main: `@Andy hello` or @mention the bot
>
> The bot should respond within a few seconds.

**Important:** QQ enforces a 5-minute timeout for passive messages (replies to user messages). Ensure the agent responds within this window.

### Check logs if needed

```bash
tail -f logs/nanoclaw.log
```

## Troubleshooting

### Bot not responding

Check:
1. `QQ_APP_ID`, `QQ_TOKEN`, `QQ_SECRET` are set in `.env` AND synced to `data/env/env`
2. Your server's IP is whitelisted in the QQ Bot dashboard
3. Chat is registered in SQLite (check with: `sqlite3 store/messages.db "SELECT * FROM registered_groups WHERE jid LIKE 'qq:%'"`)
4. For non-main chats: message includes trigger pattern
5. Service is running: `launchctl list | grep nanoclaw` (macOS) or `systemctl --user status nanoclaw` (Linux)

### 5-minute timeout error

QQ requires passive messages (replies) to be sent within 5 minutes. If your agent takes longer:
- Consider using "Active messages" (has daily rate limits)
- Optimize your agent's response time

### Getting chat ID

If `/chatid` doesn't work:
- Verify credentials: Check bot logs for authentication errors
- Check bot is started: `tail -f logs/nanoclaw.log`
- Ensure bot has been added to the group/channel

## After Setup

If running `npm run dev` while the service is active:
```bash
# macOS:
launchctl unload ~/Library/LaunchAgents/com.nanoclaw.plist
npm run dev
# When done testing:
launchctl load ~/Library/LaunchAgents/com.nanoclaw.plist
# Linux:
# systemctl --user stop nanoclaw
# npm run dev
# systemctl --user start nanoclaw
```

## Removal

To remove QQ integration:

1. Delete `src/channels/qq.ts`
2. Remove `QQChannel` import and creation from `src/index.ts`
3. Remove `channels` array and revert to using `whatsapp` directly in processGroupMessages, scheduler deps, and IPC deps
4. Revert `getAvailableGroups()` filter to only include `@g.us` chats
5. Remove QQ config (`QQ_APP_ID`, `QQ_TOKEN`, `QQ_SECRET`, `QQ_ONLY`) from `src/config.ts`
6. Remove QQ registrations from SQLite: `sqlite3 store/messages.db "DELETE FROM registered_groups WHERE jid LIKE 'qq:%'"`
7. Uninstall: `npm uninstall qq-guild-bot`
8. Rebuild: `npm run build && launchctl kickstart -k gui/$(id -u)/com.nanoclaw` (macOS) or `npm run build && systemctl --user restart nanoclaw` (Linux)
