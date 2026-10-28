export default defineEventHandler(async (event) => {
  try {
    guardPasskeyRequest(event, { name: 'complete', limit: 30 });
    const { credential, verification } = await readCompleteBody(event);

    // 2. Complete a signup or a login. The SDK reads the flow from its cookie, exchanges the passkey for tokens and
    //    writes the session.
    await useAuth0(event).passkey.complete({ credential, verification }, forwardedFor(event));

    return { status: 'complete' };
  } catch (error) {
    return completeFailure(event, error);
  }
});
