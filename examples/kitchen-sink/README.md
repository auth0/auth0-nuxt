# Task0 - Kitchen Sink Example

A comprehensive demonstration of the `@auth0/auth0-nuxt` SDK featuring a full-featured task management and team collaboration application.

## Features

This example showcases:

- **Custom Login Page**: Multiple authentication options (Email/Password and Google OAuth)
- **Protected Routes**: Pages that require authentication
- **User Profile**: Display user information
- **Header Component**: Global navigation with user avatar and dropdown menu
- **Dashboard**: Overview with stats, recent activity, and quick actions
- **Task Management**: Create, view, filter, and search tasks
- **Task Details**: In-depth task view with checklist, comments, and attachments
- **Team Directory**: Browse and search team members by department (powered by separate API)
- **API Integration**: Demonstrates calling a protected API with access tokens
- **Responsive Design**: Mobile-friendly interface using Bootstrap 5

## Application Scenario

Task0 is a task management and team collaboration platform that helps teams organize their work, track progress, and collaborate effectively. It demonstrates real-world authentication patterns and user experience flows.

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- An Auth0 account and application

### Installation

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

3. Configure your Auth0 application:

Update the `.env` file with your Auth0 credentials:

```
NUXT_AUTH0_DOMAIN=your-tenant.auth0.com
NUXT_AUTH0_CLIENT_ID=your-client-id
NUXT_AUTH0_CLIENT_SECRET=your-client-secret
NUXT_AUTH0_SESSION_SECRET=your-random-session-secret
NUXT_AUTH0_APP_BASE_URL=http://localhost:3000
NUXT_AUTH0_AUDIENCE=https://api.example.com
NUXT_PUBLIC_API_URL=http://localhost:3001
```

**Note**: The `NUXT_AUTH0_AUDIENCE` should match the API identifier configured in your Auth0 API settings.

4. Configure Auth0 Application Settings:

In your Auth0 Dashboard, configure:
- **Allowed Callback URLs**: `http://localhost:3000/auth/callback`
- **Allowed Logout URLs**: `http://localhost:3000`
- **Allowed Web Origins**: `http://localhost:3000`

5. Configure Auth0 API:

The Team Directory feature requires a protected API:
- Go to your Auth0 Dashboard
- Navigate to Applications > APIs
- Create a new API (or use an existing one)
- Set the **Identifier** to match your `NUXT_AUTH0_AUDIENCE` (e.g., `https://api.example.com`)
- Note: The identifier doesn't need to be a real URL, it's just an identifier

6. Enable Google Social Connection (optional):

To use the "Login with Google" feature:
- Go to your Auth0 Dashboard
- Navigate to Authentication > Social
- Enable the Google connection
- Configure with your Google OAuth credentials

### Running the Application

This example includes two services that run together:

1. **Fastify API** (Protected API for team data) - Port 3001
2. **Nuxt App** (Main application) - Port 3000

#### Setup API Configuration

Configure the API environment variables:

```bash
cd api
cp .env.example .env
# Edit api/.env with your Auth0 credentials
cd ..
```

The `api/.env` should match your main `.env` for Auth0 domain and audience.

#### Start Both Services

From the kitchen-sink root directory:

```bash
npm install  # This will also install API dependencies via postinstall
npm run dev
```

This will start both the Fastify API (port 3001) and the Nuxt app (port 3000) concurrently.

Visit `http://localhost:3000` in your browser.

**Note**: The `npm run dev` command uses `concurrently` to run both services. You'll see logs from both the API and Nuxt in the same terminal.

## Project Structure

```
kitchen-sink/
├── api/                         # Separate Fastify API
│   ├── server.js               # API server with protected endpoints
│   ├── package.json            # API dependencies
│   └── README.md               # API documentation
├── components/
│   └── Header.vue              # Global navigation header
├── composables/
│   ├── useDashboard.ts         # Dashboard state and logic
│   ├── useTasks.ts             # Task filtering and search logic
│   └── useTeam.ts              # Team member filtering logic (calls API)
├── data/
│   ├── dashboard.ts            # Dashboard mock data
│   ├── tasks.ts                # Task mock data and types
│   └── team.ts                 # Team member types
├── layouts/
│   └── default.vue             # Default layout with header and footer
├── pages/
│   ├── index.vue               # Dashboard (home page)
│   ├── login.vue               # Custom login page
│   ├── profile.vue             # User profile page
│   ├── tasks/
│   │   ├── index.vue          # Task list page
│   │   └── [id].vue           # Task detail page
│   └── team/
│       └── index.vue          # Team directory page
├── server/
│   └── api/
│       ├── team.get.ts         # Proxy endpoint to call protected API
│       └── tasks/              # Task management API endpoints
├── app.vue                     # Root component
├── nuxt.config.ts             # Nuxt configuration
└── package.json

```

### Architecture

The example follows a clean separation of concerns:

- **Components** (`components/`): Reusable UI components focused on presentation
- **Composables** (`composables/`): Business logic, state management, and filtering/search functionality
- **Data** (`data/`): Mock data and TypeScript type definitions
- **Pages** (`pages/`): Route components that compose composables and components
- **Layouts** (`layouts/`): Page layouts with shared structure

This structure keeps components simple and readable while making the data and logic reusable and testable.

## Key Features Demonstrated

### Authentication

- **Custom Login Page** (`/login`): Presents users with multiple authentication options
- **Social Login**: Google OAuth integration via Auth0
- **Username/Password**: Traditional email-based authentication
- **Protected Routes**: Automatic redirect to login for unauthenticated users
- **User Session**: Persistent authentication across page navigations

### User Experience

- **Responsive Design**: Works on desktop, tablet, and mobile devices
- **User Avatar**: Displays user profile picture from Auth0
- **User Dropdown**: Quick access to profile and logout
- **Protected Content**: Different views for authenticated vs. guest users
- **Real-time Status**: Online/offline indicators for team members

### UI Components

- **Dashboard Stats**: Visual metrics with icons and cards
- **Task Cards**: Grid layout with status badges and priorities
- **Search & Filter**: Dynamic filtering of tasks and team members
- **Task Details**: Comprehensive view with checklist, comments, and attachments
- **Team Directory**: Member cards with role, department, and contact options

### Task Management

- **Create Tasks**: Add new tasks from the dashboard or tasks page
- **Edit Tasks**: Update existing task details from the task detail page
- **In-Memory Persistence**: All changes persist during your session (until page refresh)
- **Real-time Updates**: Dashboard stats and recent tasks update automatically
- **Toast Notifications**: Visual confirmation when tasks are created or updated
- **Detail Pages**: Newly created tasks are immediately viewable with full detail pages

## In-Memory State Management

This example demonstrates in-memory state persistence using Nuxt's `useState`:

- **Session Persistence**: Tasks you create or edit persist across page navigation
- **Global State**: Changes are reflected immediately throughout the application
- **Dashboard Integration**: Stats and recent tasks update based on actual task data
- **No Backend Required**: Perfect for demos and prototypes without API setup

**Note**: Changes are stored in memory only and will reset when you refresh the page or close the browser. In a production app, these would be persisted to a database via API calls.

## Composables Pattern

This example uses Vue composables to separate data and business logic from presentation components. Each feature area has its own composable:

### `useTasks()`

Provides task data, search, and filtering functionality:

```vue
<script setup lang="ts">
const { searchQuery, selectedFilter, filteredTasks, statusCounts } = useTasks();
</script>
```

### `useTaskDetail(taskId)`

Provides detailed task information and computed progress metrics:

```vue
<script setup lang="ts">
const { task, completedItems, progressPercentage } = useTaskDetail(route.params.id);
</script>
```

### `useTeam()`

Provides team member data with search and filtering:

```vue
<script setup lang="ts">
const { searchQuery, selectedDepartment, filteredMembers, departments, stats } = useTeam();
</script>
```

### `useDashboard()`

Provides dashboard statistics and recent activity:

```vue
<script setup lang="ts">
const { stats, recentTasks } = useDashboard();
</script>
```

This pattern keeps components focused on presentation while making logic reusable and testable.

## API Integration Pattern

The Team Directory feature demonstrates calling a protected API with access tokens while keeping the token secure on the server:

### 1. Protected API (Fastify)

The `api/` directory contains a separate Fastify server that uses `@auth0/auth0-fastify-api` to protect endpoints:

```javascript
// Protected endpoint - requires valid access token
fastify.get('/api/team', {
  preHandler: fastify.auth()
}, async (request, reply) => {
  return { members: teamMembers };
});
```

### 2. Nuxt Server Proxy

The Nuxt app has a server endpoint that acts as a proxy, handling token management server-side:

```typescript
// server/api/team.get.ts
const auth0 = useAuth0(event);
const user = await auth0.getUser();

// Get access token with specific audience (server-side only)
const tokenSet = await auth0.getAccessToken();

// Call the protected Fastify API with the token
const response = await $fetch(`${apiUrl}/api/team`, {
  headers: {
    Authorization: `Bearer ${tokenSet.access_token}`,
  },
});

return response;
```

### 3. Client Call

The composable simply calls the Nuxt server endpoint - no token handling needed:

```typescript
// composables/useTeam.ts
const { data: teamData } = useFetch('/api/team');
```

### Security Benefits

This architecture ensures:
- **Access tokens never exposed to the client** - They stay on the server
- **Secure token storage** - Tokens are not in browser localStorage or memory
- **Simplified client code** - Client doesn't need to manage tokens
- **Backend-for-Frontend pattern** - Nuxt server acts as a secure proxy

This demonstrates a complete, secure flow:
1. Client calls Nuxt server endpoint
2. Nuxt server gets access token from Auth0 with specific audience
3. Nuxt server calls protected Fastify API with the token
4. Fastify API validates token and returns data
5. Nuxt server returns data to client (without exposing the token)

## Auth0 SDK Usage Examples

### Get Current User

```vue
<script setup lang="ts">
const { value: user } = await useUser();
</script>
```

### Protected Route Pattern

```vue
<script setup lang="ts">
const { value: user } = await useUser();

if (!user) {
  await navigateTo('/login');
}
</script>
```

### Custom Login with Connection

```html
<!-- Login with Google -->
<a href="/auth/login?connection=google-oauth2">
  Continue with Google
</a>

<!-- Login with Email/Password -->
<a href="/auth/login">
  Continue with Email
</a>
```

### Display User Information

```vue
<template>
  <div v-if="user">
    <img :src="user.picture" :alt="user.name" />
    <span>{{ user.name }}</span>
    <span>{{ user.email }}</span>
  </div>
</template>
```

### Logout

```html
<a href="/auth/logout">Log out</a>
```

## Building for Production

Build the application for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Learn More

- [Auth0 Documentation](https://auth0.com/docs)
- [Nuxt Documentation](https://nuxt.com/docs)
- [@auth0/auth0-nuxt SDK](https://github.com/auth0/auth0-nuxt)

## License

This example is part of the auth0-nuxt repository and follows the same license.
