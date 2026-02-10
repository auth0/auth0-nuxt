export interface DashboardStat {
  icon: string;
  label: string;
  value: string;
  color: string;
}

export interface RecentTask {
  id: number;
  title: string;
  status: string;
  priority: string;
  assignee: string;
}

export const dashboardStats: DashboardStat[] = [
  { icon: 'bi-check-circle-fill', label: 'Completed Tasks', value: '24', color: 'success' },
  { icon: 'bi-clock-fill', label: 'In Progress', value: '8', color: 'warning' },
  { icon: 'bi-exclamation-circle-fill', label: 'Overdue', value: '3', color: 'danger' },
  { icon: 'bi-people-fill', label: 'Team Members', value: '12', color: 'info' },
];

export const recentTasks: RecentTask[] = [
  { id: 1, title: 'Design new landing page', status: 'In Progress', priority: 'High', assignee: 'Sarah Chen' },
  { id: 2, title: 'Fix authentication bug', status: 'Completed', priority: 'Critical', assignee: 'Mike Johnson' },
  { id: 3, title: 'Update documentation', status: 'Todo', priority: 'Medium', assignee: 'Emily Davis' },
  { id: 4, title: 'Review pull requests', status: 'In Progress', priority: 'Low', assignee: 'John Smith' },
];
