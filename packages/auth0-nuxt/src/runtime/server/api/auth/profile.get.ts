import { defineEventHandler } from 'h3';

export default defineEventHandler(async (event) => {
  const auth0Client = event.context.auth0Client ;
  const session = await auth0Client.getSession({ event });

  return session?.user;
});