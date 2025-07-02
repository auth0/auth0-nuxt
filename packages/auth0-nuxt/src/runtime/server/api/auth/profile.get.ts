import { defineEventHandler } from 'h3';
import { useAuth0 } from '../../composables/use-auth0';

export default defineEventHandler(async (event) => {
  const auth0Client = useAuth0(event); ;
  const session = await auth0Client.getSession();

  return session?.user;
});