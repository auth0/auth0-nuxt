import { taskStore } from '~/server/utils/taskStore';

export default defineEventHandler(async (event) => {
  const auth0 = useAuth0(event);
  const user = await auth0.getUser();

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  return {
    tasks: taskStore.getAllTasks(),
    taskDetails: taskStore.getAllTaskDetails(),
  };
});
