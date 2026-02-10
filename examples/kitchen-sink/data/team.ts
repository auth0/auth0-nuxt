export interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: string;
  department: string;
  picture: string;
  status: 'online' | 'away' | 'offline';
  tasksCount: number;
  joinedDate: string;
}

export const teamMembers: TeamMember[] = [
  {
    id: 1,
    name: 'Sarah Chen',
    email: 'sarah.chen@example.com',
    role: 'Lead Designer',
    department: 'Design',
    picture: 'https://i.pravatar.cc/150?img=1',
    status: 'online',
    tasksCount: 8,
    joinedDate: '2025-01-15',
  },
  {
    id: 2,
    name: 'Mike Johnson',
    email: 'mike.johnson@example.com',
    role: 'Senior Developer',
    department: 'Engineering',
    picture: 'https://i.pravatar.cc/150?img=2',
    status: 'online',
    tasksCount: 12,
    joinedDate: '2024-11-20',
  },
  {
    id: 3,
    name: 'Emily Davis',
    email: 'emily.davis@example.com',
    role: 'Technical Writer',
    department: 'Documentation',
    picture: 'https://i.pravatar.cc/150?img=3',
    status: 'away',
    tasksCount: 5,
    joinedDate: '2025-02-01',
  },
  {
    id: 4,
    name: 'John Smith',
    email: 'john.smith@example.com',
    role: 'DevOps Engineer',
    department: 'Infrastructure',
    picture: 'https://i.pravatar.cc/150?img=4',
    status: 'offline',
    tasksCount: 6,
    joinedDate: '2024-10-10',
  },
  {
    id: 5,
    name: 'Lisa Wang',
    email: 'lisa.wang@example.com',
    role: 'Product Manager',
    department: 'Product',
    picture: 'https://i.pravatar.cc/150?img=5',
    status: 'online',
    tasksCount: 15,
    joinedDate: '2024-09-05',
  },
  {
    id: 6,
    name: 'David Kim',
    email: 'david.kim@example.com',
    role: 'QA Engineer',
    department: 'Quality Assurance',
    picture: 'https://i.pravatar.cc/150?img=6',
    status: 'online',
    tasksCount: 9,
    joinedDate: '2025-01-20',
  },
];
