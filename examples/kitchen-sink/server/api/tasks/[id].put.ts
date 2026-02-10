import { taskStore } from '~/server/utils/taskStore';
import type { Task } from '~/data/tasks';

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
  const body = await readBody<Partial<Task>>(event);

  const updatedTask = taskStore.updateTask(id, body);

  if (!updatedTask) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Task not found',
    });
  }

  return {
    task: updatedTask,
    taskDetail: taskStore.getTaskDetail(id),
  };
});
