/**
 * Redirects the user to the login page when there is no session.
 * The `returnTo` query parameter sends them back to the requested page after login.
 */
export default defineNuxtRouteMiddleware((to) => {
  const user = useUser();

  if (!user.value) {
    return navigateTo(`/auth/login?returnTo=${to.path}`);
  }
});
