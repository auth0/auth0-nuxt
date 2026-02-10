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

  const id = Number.parseInt(event.context.params?.id || '0');
  const task = taskStore.getTask(id);
  const taskDetail = taskStore.getTaskDetail(id);

  if (!task) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Task not found',
    });
  }

  return {
    task,
    taskDetail,
  };
});
