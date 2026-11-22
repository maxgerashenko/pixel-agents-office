import { expect, test } from '../../fixtures/standalone';
import { preToolUseBash, sendHookEvent, sessionStartStartup } from '../../helpers/hooks';
import { expectOverlayCount } from '../../helpers/office';
import { setSettings } from '../../helpers/webview';

test.describe('Standalone / pass and fail reactions', () => {
  test('a failed command and a passed check reach the browser as reactions @area:standalone', async ({
    page,
    standalone,
  }) => {
    await setSettings(page, { watchAllSessions: true });
    await standalone.drainMessages();

    const sessionId = 'standalone-reaction-session';
    await sendHookEvent(
      standalone.hookServerConfig,
      sessionStartStartup(sessionId, standalone.workspaceDir),
    );
    await sendHookEvent(standalone.hookServerConfig, preToolUseBash(sessionId, 'npm test'));
    await expectOverlayCount(page, 1);

    // The command ran and failed
    await sendHookEvent(standalone.hookServerConfig, {
      session_id: sessionId,
      hook_event_name: 'PostToolUseFailure',
      tool_name: 'Bash',
      tool_input: { command: 'npm test' },
    });
    await expect
      .poll(async () => {
        const messages = await standalone.drainMessages();
        return messages.filter((m) => m.type === 'agentReaction').map((m) => m.reaction);
      })
      .toEqual(['fail']);

    // The retry passed
    await sendHookEvent(standalone.hookServerConfig, preToolUseBash(sessionId, 'npm test'));
    await sendHookEvent(standalone.hookServerConfig, {
      session_id: sessionId,
      hook_event_name: 'PostToolUse',
      tool_name: 'Bash',
      tool_input: { command: 'npm test' },
    });
    await expect
      .poll(async () => {
        const messages = await standalone.drainMessages();
        return messages.filter((m) => m.type === 'agentReaction').map((m) => m.reaction);
      })
      .toEqual(['pass']);
  });
});
