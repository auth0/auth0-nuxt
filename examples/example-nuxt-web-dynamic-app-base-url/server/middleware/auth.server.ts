export default defineEventHandler(async (event) => {
  const url = getRequestURL(event);
  
  if (url.pathname === '/private') {
    const auth0Client = useAuth0(event);
    const session = await auth0Client.getSession();
    if (!session) {
      return sendRedirect(event, '/auth/login?returnTo=' + url.pathname);
    }
  }
})