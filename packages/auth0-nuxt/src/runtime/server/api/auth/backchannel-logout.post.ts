import { useAuth0 } from '../../composables/use-auth0';
import { defineEventHandler, readBody, createError } from 'h3';

export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event);
  const body = await readBody(event);
  const logoutToken = body?.logout_token;

  if (!logoutToken) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing `logout_token` in the request body.',
    });
  }

  try {
    await auth0Client.handleBackchannelLogout(logoutToken);
    return null;
  } catch (e) {
    throw createError({
      statusCode: 400,
      statusMessage: (e as Error).message,
    });
  }
});
