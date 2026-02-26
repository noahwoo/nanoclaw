Based on the official QQ Bot documentation and the architecture of NanoClaw, here is a comprehensive guide on how to integrate a QQ Bot into the NanoClaw agent system.

### Understanding the Architectures
1. **QQ Bot**: Operates via WebSockets (for receiving event payloads like mentions or direct messages) and an OpenAPI (for sending messages). It requires an `AppID`, `Token`, and `AppSecret`. It supports QQ Channels (频道), Groups (群), and Direct Messages (单聊).
2. **NanoClaw**: A lightweight, Node.js-based AI agent that runs Claude agents in isolated containers. Its architecture flows like this: `Channel --> SQLite --> Polling Loop --> Container (Claude Agent) --> Response`. 
3. **NanoClaw's Philosophy**: NanoClaw explicitly discourages bloating the main repository with every messenger integration (like Telegram, Slack, or QQ). Instead, you should create a **"Skill"** (a `SKILL.md` file) that tells Claude Code how to automatically rewrite the user's local source code to support the QQ Bot.

Here is the step-by-step summary of how to build and integrate a QQ Bot into NanoClaw.

---

### Step 1: Prepare the QQ Bot Platform
Before touching NanoClaw, you need to set up the bot on Tencent's platform.
1. **Register**: Go to the [QQ Bot Open Platform](https://bot.q.qq.com/) and register as a developer (Personal or Enterprise).
2. **Create Application**: Create a bot to generate an `AppID`, `Token`, and `AppSecret`. 
3. **Sandbox Setup**: Add your bot to a sandboxed QQ Channel or Group to test it. This unlocks testing capabilities before full platform review.
4. **IP Whitelist**: You must whitelist the public IP address of the server hosting NanoClaw in the QQ Bot dashboard to allow WebSocket connections and OpenAPI calls.

### Step 2: Build the NanoClaw QQ Adapter
NanoClaw currently uses `src/channels/whatsapp.ts` for I/O. You need to create a parallel file for QQ, for example, `src/channels/qq.ts`.

1. **Dependency**: Use the official QQ Bot Node.js SDK (e.g., `qq-guild-bot`) to handle the WebSocket connection.
2. **Receiving Messages**: Listen for `AT_MESSAGE_CREATE` (Group mentions) or `DIRECT_MESSAGE_CREATE` (DMs). When a message arrives, parse it and insert it into NanoClaw's SQLite database (`src/db.ts`).
3. **Sending Messages**: Create an outbound router function that takes NanoClaw's processed response and pushes it to QQ's OpenAPI. 
   * *Important Note:* QQ enforces strict messaging rules. "Passive messages" (replying to a user) must be sent within 5 minutes of the user's prompt. Since Claude agents might take time to "think" in their containers, ensure your agent loop replies within this window, or use "Active messages" (which have strict daily rate limits).

### Step 3: Wire it into NanoClaw's Core
You need to connect the new QQ channel to NanoClaw's orchestrator.
1. **`src/index.ts`**: Import the QQ adapter so that the bot initiates its WebSocket connection on startup.
2. **`src/router.ts`**: Update the message formatting and routing logic so NanoClaw knows how to format its text and push it back to the QQ API rather than WhatsApp.

### Step 4: Package it as a "Skill" (The NanoClaw Way)
Instead of submitting a Pull Request to NanoClaw with your `qq.ts` file, you package these instructions into a **Claude Skill** so any user can run `/add-qq` to get the integration.

Create a file at `.claude/skills/add-qq/SKILL.md` with instructions for Claude Code. The file should prompt Claude to:
1. Prompt the user for their QQ `AppID`, `Token`, and `AppSecret` and save them to `.env`.
2. Run `npm install qq-guild-bot` (or equivalent SDK).
3. Generate the `src/channels/qq.ts` file containing the connection logic.
4. Modify `src/index.ts` to comment out/remove the WhatsApp initialization and replace it with the QQ bot initialization.
5. Update `src/router.ts` to handle QQ's payload formats.

### Summary of Workflow
Once built, a NanoClaw user simply runs:
```bash
claude
/add-qq
```
Claude Code will read your `SKILL.md`, write the QQ connection logic into the user's local fork, adjust the SQLite polling loop to feed QQ messages to the Anthropic Container, and start routing the Agent's output back to the user's QQ App.
