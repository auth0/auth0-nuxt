import Fastify from 'fastify';
import 'dotenv/config';
import auth0FastifyApi from '@auth0/auth0-fastify-api';

const fastify = Fastify({
  logger: true
});

console.log(process.env.AUTH0_AUDIENCE);
// Register Auth0 plugin
await fastify.register(auth0FastifyApi, {
  domain: process.env.AUTH0_DOMAIN,
  audience: process.env.AUTH0_AUDIENCE,
});

// Team members data
const teamMembers = [
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

// Protected route - requires valid access token
fastify.get('/api/team', {
  preHandler: fastify.requireAuth()
}, async (request, reply) => {
  return { members: teamMembers };
});

// Health check endpoint (unprotected)
fastify.get('/health', async (request, reply) => {
  return { status: 'ok' };
});

// Start server
const start = async () => {
  try {
    const port = process.env.API_PORT || 3001;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 API Server running at http://localhost:${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
