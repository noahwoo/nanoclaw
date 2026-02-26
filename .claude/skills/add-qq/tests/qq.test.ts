import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('qq skill package', () => {
  const skillDir = path.resolve(__dirname, '..');

  it('has a valid manifest', () => {
    const manifestPath = path.join(skillDir, 'manifest.yaml');
    expect(fs.existsSync(manifestPath)).toBe(true);

    const content = fs.readFileSync(manifestPath, 'utf-8');
    expect(content).toContain('skill: qq');
    expect(content).toContain('version: 1.0.0');
    expect(content).toContain('qq-guild-bot');
  });

  it('has all files declared in adds', () => {
    const addFile = path.join(skillDir, 'add', 'src', 'channels', 'qq.ts');
    expect(fs.existsSync(addFile)).toBe(true);

    const content = fs.readFileSync(addFile, 'utf-8');
    expect(content).toContain('class QQChannel');
    expect(content).toContain('implements Channel');

    // Test file for the channel
    const testFile = path.join(skillDir, 'add', 'src', 'channels', 'qq.test.ts');
    expect(fs.existsSync(testFile)).toBe(true);

    const testContent = fs.readFileSync(testFile, 'utf-8');
    expect(testContent).toContain("describe('QQChannel'");
  });

  it('has all files declared in modifies', () => {
    const indexFile = path.join(skillDir, 'modify', 'src', 'index.ts');
    const configFile = path.join(skillDir, 'modify', 'src', 'config.ts');

    expect(fs.existsSync(indexFile)).toBe(true);
    expect(fs.existsSync(configFile)).toBe(true);

    const indexContent = fs.readFileSync(indexFile, 'utf-8');
    expect(indexContent).toContain('QQChannel');
    expect(indexContent).toContain('QQ_APP_ID');
    expect(indexContent).toContain('QQ_TOKEN');
    expect(indexContent).toContain('QQ_SECRET');
    expect(indexContent).toContain('QQ_ONLY');
    expect(indexContent).toContain('findChannel');
    expect(indexContent).toContain('channels: Channel[]');

    const configContent = fs.readFileSync(configFile, 'utf-8');
    expect(configContent).toContain('QQ_APP_ID');
    expect(configContent).toContain('QQ_TOKEN');
    expect(configContent).toContain('QQ_SECRET');
    expect(configContent).toContain('QQ_ONLY');
  });

  it('has intent files for modified files', () => {
    expect(fs.existsSync(path.join(skillDir, 'modify', 'src', 'index.ts.intent.md'))).toBe(true);
    expect(fs.existsSync(path.join(skillDir, 'modify', 'src', 'config.ts.intent.md'))).toBe(true);
  });

  it('modified index.ts preserves core structure', () => {
    const content = fs.readFileSync(
      path.join(skillDir, 'modify', 'src', 'index.ts'),
      'utf-8',
    );

    // Core functions still present
    expect(content).toContain('function loadState()');
    expect(content).toContain('function saveState()');
    expect(content).toContain('function registerGroup(');
    expect(content).toContain('function getAvailableGroups()');
    expect(content).toContain('function processGroupMessages(');
    expect(content).toContain('function runAgent(');
    expect(content).toContain('function startMessageLoop()');
    expect(content).toContain('function recoverPendingMessages()');
    expect(content).toContain('function ensureContainerSystemRunning()');
    expect(content).toContain('async function main()');

    // Test helper preserved
    expect(content).toContain('_setRegisteredGroups');

    // Direct-run guard preserved
    expect(content).toContain('isDirectRun');
  });

  it('modified index.ts includes QQ channel creation', () => {
    const content = fs.readFileSync(
      path.join(skillDir, 'modify', 'src', 'index.ts'),
      'utf-8',
    );

    // Multi-channel architecture
    expect(content).toContain('const channels: Channel[] = []');
    expect(content).toContain('channels.push(whatsapp)');
    expect(content).toContain('channels.push(qqChannel)');

    // Conditional channel creation
    expect(content).toContain('if (!QQ_ONLY)');
    expect(content).toContain('if (QQ_APP_ID && QQ_TOKEN && QQ_SECRET)');

    // Shutdown disconnects all channels
    expect(content).toContain('for (const ch of channels) await ch.disconnect()');
  });

  it('modified config.ts preserves all existing exports', () => {
    const content = fs.readFileSync(
      path.join(skillDir, 'modify', 'src', 'config.ts'),
      'utf-8',
    );

    // All original exports preserved
    expect(content).toContain('export const ASSISTANT_NAME');
    expect(content).toContain('export const POLL_INTERVAL');
    expect(content).toContain('export const TRIGGER_PATTERN');
    expect(content).toContain('export const CONTAINER_IMAGE');
    expect(content).toContain('export const DATA_DIR');
    expect(content).toContain('export const TIMEZONE');
  });

  it('has SKILL.md with setup instructions', () => {
    const skillMdPath = path.join(skillDir, 'SKILL.md');
    expect(fs.existsSync(skillMdPath)).toBe(true);

    const content = fs.readFileSync(skillMdPath, 'utf-8');
    expect(content).toContain('QQ Bot');
    expect(content).toContain('Phase 1:');
    expect(content).toContain('Phase 2:');
    expect(content).toContain('Phase 3:');
    expect(content).toContain('QQ_APP_ID');
    expect(content).toContain('QQ_TOKEN');
    expect(content).toContain('QQ_SECRET');
  });
});
