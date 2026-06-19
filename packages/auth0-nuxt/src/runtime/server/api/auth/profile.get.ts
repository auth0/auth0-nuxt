import { useAuth0 } from '../../composables/use-auth0';
import { defineEventHandler, setHeader } from 'h3';

export default defineEventHandler(async (event) => {
  setHeader(event, 'Cache-Control', 'no-store');

  const auth0Client = useAuth0(event);
  const user = await auth0Client.getUser();

  return user ?? null;
});
