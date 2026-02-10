import {
  tasks as initialTasks,
  taskDetails as initialTaskDetails,
  type Task,
  type TaskDetail,
} from '~/data/tasks';

// In-memory store that persists across requests
// This will survive page refreshes but reset on server restart
const store = {
  tasks: [...initialTasks] as Task[],
  taskDetails: { ...initialTaskDetails } as Record<number, TaskDetail>,
  nextId: Math.max(...initialTasks.map((t) => t.id)) + 1,
};

export const taskStore = {
  // Get all tasks
  getAllTasks(): Task[] {
    return store.tasks;
  },

  // Get a single task
  getTask(id: number): Task | undefined {
    return store.tasks.find((t) => t.id === id);
  },

  // Get task details
  getTaskDetail(id: number): TaskDetail | undefined {
    return store.taskDetails[id];
  },

  // Add a new task
  addTask(task: Omit<Task, 'id'>): Task {
    const newTask: Task = {
      ...task,
      id: store.nextId++,
    };
    store.tasks.push(newTask);

    // Create task detail entry
    const newTaskDetail: TaskDetail = {
      ...newTask,
      assignee: {
        name: newTask.assignee,
        email: `${newTask.assignee.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        picture: `https://i.pravatar.cc/150?img=${newTask.id}`,
      },
      creator: {
        name: 'Current User',
        email: 'user@example.com',
      },
      createdAt: new Date().toISOString(),
      attachments: [],
      comments: [],
      checklist: [],
    };
    store.taskDetails[newTask.id] = newTaskDetail;

    return newTask;
  },

  // Update a task
  updateTask(id: number, updates: Partial<Task>): Task | undefined {
    const index = store.tasks.findIndex((t) => t.id === id);
    const existingTask = store.tasks[index];
    if (existingTask) {
      store.tasks[index] = { ...existingTask, ...updates };

      // Also update task details if it exists
      if (store.taskDetails[id]) {
        store.taskDetails[id] = {
          ...store.taskDetails[id],
          ...updates,
        } as TaskDetail;
      }

      return store.tasks[index];
    }
  },

  // Delete a task
  deleteTask(id: number): boolean {
    const index = store.tasks.findIndex((t) => t.id === id);
    if (index !== -1) {
      store.tasks.splice(index, 1);
      delete store.taskDetails[id];
      return true;
    }
    return false;
  },

  // Get all task details
  getAllTaskDetails(): Record<number, TaskDetail> {
    return store.taskDetails;
  },
};
