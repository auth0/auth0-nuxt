export interface Task {
  id: number;
  title: string;
  description: string;
  status: 'Todo' | 'In Progress' | 'Completed';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  assignee: string;
  dueDate: string;
  tags: string[];
}

export interface TaskDetail extends Task {
  assignee: {
    name: string;
    email: string;
    picture: string;
  };
  creator: {
    name: string;
    email: string;
  };
  createdAt: string;
  attachments: Array<{
    name: string;
    size: string;
    type: string;
  }>;
  comments: Array<{
    id: number;
    author: string;
    picture: string;
    text: string;
    timestamp: string;
  }>;
  checklist: Array<{
    id: number;
    text: string;
    completed: boolean;
  }>;
}

export const tasks: Task[] = [
  {
    id: 1,
    title: 'Design new landing page',
    description: 'Create mockups for the new product landing page with modern design',
    status: 'In Progress',
    priority: 'High',
    assignee: 'Sarah Chen',
    dueDate: '2026-02-15',
    tags: ['Design', 'Frontend'],
  },
  {
    id: 2,
    title: 'Fix authentication bug',
    description: 'Users are experiencing login issues with social providers',
    status: 'Completed',
    priority: 'Critical',
    assignee: 'Mike Johnson',
    dueDate: '2026-02-10',
    tags: ['Backend', 'Bug'],
  },
  {
    id: 3,
    title: 'Update documentation',
    description: 'Add API documentation for new endpoints',
    status: 'Todo',
    priority: 'Medium',
    assignee: 'Emily Davis',
    dueDate: '2026-02-20',
    tags: ['Documentation'],
  },
  {
    id: 4,
    title: 'Review pull requests',
    description: 'Review and merge pending pull requests from the team',
    status: 'In Progress',
    priority: 'Low',
    assignee: 'John Smith',
    dueDate: '2026-02-12',
    tags: ['Code Review'],
  },
  {
    id: 5,
    title: 'Implement search feature',
    description: 'Add full-text search capability to the task list',
    status: 'Todo',
    priority: 'Medium',
    assignee: 'Sarah Chen',
    dueDate: '2026-02-25',
    tags: ['Feature', 'Backend'],
  },
  {
    id: 6,
    title: 'Optimize database queries',
    description: 'Improve performance of slow queries in the reporting module',
    status: 'Todo',
    priority: 'High',
    assignee: 'Mike Johnson',
    dueDate: '2026-02-18',
    tags: ['Performance', 'Database'],
  },
];

export const taskDetails: Record<number, TaskDetail> = {
  1: {
    id: 1,
    title: 'Design new landing page',
    description: 'Create mockups for the new product landing page with modern design principles. The landing page should be responsive, accessible, and optimized for conversions.',
    status: 'In Progress',
    priority: 'High',
    assignee: {
      name: 'Sarah Chen',
      email: 'sarah.chen@example.com',
      picture: 'https://i.pravatar.cc/150?img=1',
    },
    creator: {
      name: 'Mike Johnson',
      email: 'mike.johnson@example.com',
    },
    createdAt: '2026-02-05T10:30:00Z',
    dueDate: '2026-02-15',
    tags: ['Design', 'Frontend', 'UI/UX'],
    attachments: [
      { name: 'wireframe-v1.pdf', size: '2.3 MB', type: 'pdf' },
      { name: 'design-specs.fig', size: '5.1 MB', type: 'figma' },
    ],
    comments: [
      {
        id: 1,
        author: 'Mike Johnson',
        picture: 'https://i.pravatar.cc/150?img=2',
        text: 'Great progress on the mockups! Can you add a dark mode variant?',
        timestamp: '2026-02-08T14:20:00Z',
      },
      {
        id: 2,
        author: 'Sarah Chen',
        picture: 'https://i.pravatar.cc/150?img=1',
        text: 'Sure! I\'ll have the dark mode mockups ready by tomorrow.',
        timestamp: '2026-02-08T15:45:00Z',
      },
    ],
    checklist: [
      { id: 1, text: 'Create wireframes', completed: true },
      { id: 2, text: 'Design hero section', completed: true },
      { id: 3, text: 'Design features section', completed: false },
      { id: 4, text: 'Design testimonials section', completed: false },
      { id: 5, text: 'Create dark mode variant', completed: false },
    ],
  },
};
