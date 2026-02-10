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

  const body = await readBody<Omit<Task, 'id'>>(event);
  const newTask = taskStore.addTask(body);

  return {
    task: newTask,
    taskDetail: taskStore.getTaskDetail(newTask.id),
  };
});
