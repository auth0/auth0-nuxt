export default defineEventHandler(async (event) => {
  try {
    guardPasskeyRequest(event, { name: 'login-start', limit: 30 });
    const realm = useRuntimeConfig(event).passkey.realm || undefined;

    // 1b. Start a login.
    const { authnParamsPublicKey } = await useAuth0(event).passkey.startLogin({ realm }, forwardedFor(event));

    return { authnParamsPublicKey };
  } catch (error) {
    return startFailure(event, error);
  }
});
