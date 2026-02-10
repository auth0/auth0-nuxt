export default defineEventHandler(
  async (event): Promise<{ members: string[] }> => {
    const auth0 = useAuth0(event);
    const user = await auth0.getUser();

    if (!user) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Unauthorized',
      });
    }

    // Get access token for external API
    const tokenSet = await auth0.getAccessToken();

    // Call the protected Fastify API
    const config = useRuntimeConfig();
    const apiUrl = config.public.apiUrl;

    try {
      const response = await $fetch(`${apiUrl}/api/team`, {
        headers: {
          Authorization: `Bearer ${tokenSet.accessToken}`,
        },
      });

      return response;
    } catch (error) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch team data from API',
      });
    }
  },
);
