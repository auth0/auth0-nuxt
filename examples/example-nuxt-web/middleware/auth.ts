/**
 * Example Nuxt.js middleware to check for a valid session.
 * If no session is found, it redirects the user to the login page.
 * The returnTo query parameter is used to redirect back to the original requested page after login.
 */
export default defineNuxtRouteMiddleware((to, from) => {
  const user = useUser();

  if (!user.value) {
    return navigateTo(`/auth/login?returnTo=${to.path}`);
  }
});
