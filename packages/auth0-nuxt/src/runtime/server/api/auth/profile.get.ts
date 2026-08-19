import { useAuth0 } from '../../composables/use-auth0';
import { defineEventHandler, setHeader } from 'h3';

/**
 * Returns the authenticated user's claims, or `null` when there is no session.
 *
 * Served `Cache-Control: no-store` so the response is never held in a shared cache — this is
 * what makes it safe to hydrate the user in the browser on routes whose HTML *is* cacheable.
 * `Vary: Cookie` is defence in depth for intermediaries that key on the response but treat
 * `no-store` loosely. Nitro's own cache is opted out separately, in the module's `setup`,
 * because it would otherwise overwrite the header set here.
 */
export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store');
  setHeader(event, 'Vary', 'Cookie');

  // No try/catch, unlike the sibling handlers: `null` means signed out, so a session-read
  // failure has to 500 rather than be mistaken for one.

  const auth0Client = useAuth0(event);
  const user = await auth0Client.getUser();

  return user ?? null;
});
