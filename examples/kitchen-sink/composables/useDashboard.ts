import { dashboardStats } from '~/data/dashboard';

export function useDashboard() {
  const { tasks } = useTasks();

  // Compute real-time stats from actual tasks
  const stats = computed(() => {
    const completedCount = tasks.value.filter(t => t.status === 'Completed').length;
    const inProgressCount = tasks.value.filter(t => t.status === 'In Progress').length;
    const overdueCount = tasks.value.filter(t => {
      const dueDate = new Date(t.dueDate);
      return dueDate < new Date() && t.status !== 'Completed';
    }).length;

    return [
      { icon: 'bi-check-circle-fill', label: 'Completed Tasks', value: String(completedCount), color: 'success' },
      { icon: 'bi-clock-fill', label: 'In Progress', value: String(inProgressCount), color: 'warning' },
      { icon: 'bi-exclamation-circle-fill', label: 'Overdue', value: String(overdueCount), color: 'danger' },
      { icon: 'bi-people-fill', label: 'Team Members', value: '12', color: 'info' },
    ];
  });

  // Get the 4 most recently created tasks
  const recentTasks = computed(() => {
    return [...tasks.value]
      .sort((a, b) => b.id - a.id)
      .slice(0, 4)
      .map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
        priority: task.priority,
        assignee: task.assignee,
      }));
  });

  return {
    stats,
    recentTasks,
  };
}
