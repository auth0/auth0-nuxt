import type { Task, TaskDetail } from '~/data/tasks';

export function useTasks() {
  // Global reactive state for tasks - will be populated from server
  const tasksState = useState<Task[]>('tasks', () => []);
  const taskDetailsState = useState<Record<number, TaskDetail>>('taskDetails', () => ({}));

  // Fetch tasks from server on initialization
  const { data } = useFetch<{ tasks: Task[], taskDetails: Record<number, TaskDetail> }>('/api/tasks');

  // Update state when data is loaded
  watch(data, (newData) => {
    if (newData) {
      tasksState.value = newData.tasks;
      taskDetailsState.value = newData.taskDetails;
    }
  }, { immediate: true });

  const searchQuery = ref('');
  const selectedFilter = ref('all');

  const filteredTasks = computed(() => {
    let filtered = tasksState.value;

    if (selectedFilter.value !== 'all') {
      filtered = filtered.filter(task =>
        task.status.toLowerCase().replace(' ', '-') === selectedFilter.value
      );
    }

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter(task =>
        task.title.toLowerCase().includes(query) ||
        task.description.toLowerCase().includes(query) ||
        task.assignee.toLowerCase().includes(query)
      );
    }

    return filtered;
  });

  const statusCounts = computed(() => ({
    all: tasksState.value.length,
    todo: tasksState.value.filter(t => t.status === 'Todo').length,
    'in-progress': tasksState.value.filter(t => t.status === 'In Progress').length,
    completed: tasksState.value.filter(t => t.status === 'Completed').length,
  }));

  const addTask = async (task: Omit<Task, 'id'>) => {
    const response = await $fetch<{ task: Task, taskDetail: TaskDetail }>('/api/tasks', {
      method: 'POST',
      body: task,
    });

    // Update local state
    tasksState.value.push(response.task);
    taskDetailsState.value[response.task.id] = response.taskDetail;

    return response.task;
  };

  const updateTask = async (id: number, updates: Partial<Task>) => {
    const response = await $fetch<{ task: Task, taskDetail: TaskDetail }>(`/api/tasks/${id}`, {
      method: 'PUT',
      body: updates,
    });

    // Update local state
    const index = tasksState.value.findIndex(t => t.id === id);
    if (index !== -1) {
      tasksState.value[index] = response.task;
    }
    taskDetailsState.value[id] = response.taskDetail;

    return response.task;
  };

  const deleteTask = async (id: number) => {
    await $fetch(`/api/tasks/${id}`, {
      method: 'DELETE',
    });

    // Update local state
    const index = tasksState.value.findIndex(t => t.id === id);
    if (index !== -1) {
      tasksState.value.splice(index, 1);
      delete taskDetailsState.value[id];
      return true;
    }
    return false;
  };

  const getTaskById = (id: number) => {
    return tasksState.value.find(t => t.id === id);
  };

  return {
    tasks: tasksState,
    searchQuery,
    selectedFilter,
    filteredTasks,
    statusCounts,
    addTask,
    updateTask,
    deleteTask,
    getTaskById,
  };
}

export function useTaskDetail(taskId: string | number) {
  // Access the same global state from within the composable
  const taskDetailsState = useState<Record<number, TaskDetail>>('taskDetails', () => ({}));

  const id = Number(taskId);

  // Fetch task detail from server if not already loaded
  const { data } = useFetch<{ task: Task, taskDetail: TaskDetail }>(`/api/tasks/${id}`);

  // Update state when data is loaded
  watch(data, (newData) => {
    if (newData) {
      taskDetailsState.value[id] = newData.taskDetail;
    }
  }, { immediate: true });

  const task = computed(() => taskDetailsState.value[id]);

  const completedItems = computed(() =>
    task.value?.checklist.filter(item => item.completed).length || 0
  );

  const progressPercentage = computed(() =>
    task.value ? Math.round((completedItems.value / task.value.checklist.length) * 100) : 0
  );

  return {
    task,
    completedItems,
    progressPercentage,
  };
}
