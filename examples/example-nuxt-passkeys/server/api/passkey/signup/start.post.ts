export default defineEventHandler(async (event) => {
  try {
    guardPasskeyRequest(event, { name: 'signup-start', limit: 5 });
    const profile = await readSignupBody(event);
    const realm = useRuntimeConfig(event).passkey.realm || undefined;

    // 1a. Start a signup. When the connection verifies the email address or phone number, Auth0 sends the codes now.
    const { authnParamsPublicKey, verificationRequired } = await useAuth0(event).passkey.startSignup(
      { ...profile, realm },
      forwardedFor(event)
    );

    return { authnParamsPublicKey, verificationRequired: verificationRequired ?? [] };
  } catch (error) {
    return startFailure(event, error);
  }
});
