import { defineEventHandler, readBody } from 'h3';
import { state } from './fake-state';

// Test-only: a Back-Channel Logout token for a `sid`, signed by the fake Auth0.
export default defineEventHandler(async (event) => {
  const { sid } = await readBody<{ sid: string }>(event);
  const logoutToken = await state.sign!({
    sid,
    jti: `jti-${Date.now()}`,
    events: { 'http://schemas.openid.net/event/backchannel-logout': {} },
  });
  return { logoutToken };
});
