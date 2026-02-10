<script setup lang="ts">
import type { Task } from '~/data/tasks';

const { value: user } = await useUser();
const { stats, recentTasks } = useDashboard();
const { addTask } = useTasks();

// Modal state
const showModal = ref(false);

// Toast state
const showToast = ref(false);
const toastMessage = ref('');

const openCreateModal = () => {
  showModal.value = true;
};

const closeModal = () => {
  showModal.value = false;
};

const handleSaveTask = async (task: Partial<Task>) => {
  const newTask = await addTask(task as Omit<Task, 'id'>);
  closeModal();
  toastMessage.value = `Task "${newTask.title}" created successfully!`;
  showToast.value = true;
};
</script>

<template>
  <div class="container py-5">
    <div class="row mb-4">
      <div class="col">
        <h1 class="display-5 fw-bold">
          <i class="bi bi-speedometer2 text-primary me-2"></i>
          Dashboard
        </h1>
        <p class="lead text-muted" v-if="user">
          Welcome back, {{ user.name }}! Here's what's happening with your projects.
        </p>
        <p class="lead text-muted" v-else>
          Welcome to Task0! Sign in to manage your tasks and collaborate with your team.
        </p>
      </div>
    </div>

    <!-- Guest View -->
    <GuestView v-if="!user" />

    <!-- Authenticated View -->
    <div v-if="user">
      <!-- Stats Cards -->
      <div class="row mb-4">
        <div v-for="stat in stats" :key="stat.label" class="col-md-6 col-lg-3 mb-3">
          <StatCard
            :icon="stat.icon"
            :color="stat.color"
            :value="stat.value"
            :label="stat.label"
          />
        </div>
      </div>

      <!-- Recent Tasks -->
      <div class="row">
        <div class="col-lg-8">
          <Card>
            <CardHeader>
              <h5 class="mb-0 fw-bold">
                <i class="bi bi-list-task me-2"></i>
                Recent Tasks
              </h5>
            </CardHeader>
            <CardBody :padding="false">
              <div class="table-responsive">
                <table class="table table-hover mb-0">
                  <thead class="table-light">
                    <tr>
                      <th>Task</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Assignee</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="task in recentTasks" :key="task.id">
                      <td class="fw-medium">{{ task.title }}</td>
                      <td>
                        <Badge :status="task.status" />
                      </td>
                      <td>
                        <Badge :priority="task.priority" />
                      </td>
                      <td>{{ task.assignee }}</td>
                      <td>
                        <a :href="`/tasks/${task.id}`" class="btn btn-sm btn-outline-primary">
                          View
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardBody>
            <CardFooter>
              <a href="/tasks" class="text-decoration-none">
                View all tasks <i class="bi bi-arrow-right"></i>
              </a>
            </CardFooter>
          </Card>
        </div>

        <!-- Quick Actions -->
        <div class="col-lg-4">
          <Card class="mb-3">
            <CardHeader>
              <h5 class="mb-0 fw-bold">
                <i class="bi bi-lightning-fill me-2"></i>
                Quick Actions
              </h5>
            </CardHeader>
            <CardBody>
              <div class="d-grid gap-2">
                <button class="btn btn-primary" @click="openCreateModal">
                  <i class="bi bi-plus-circle me-2"></i>
                  New Task
                </button>
                <button class="btn btn-outline-primary">
                  <i class="bi bi-person-plus me-2"></i>
                  Invite Team Member
                </button>
                <button class="btn btn-outline-primary">
                  <i class="bi bi-calendar-event me-2"></i>
                  Schedule Meeting
                </button>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h5 class="mb-0 fw-bold">
                <i class="bi bi-bell-fill me-2"></i>
                Recent Activity
              </h5>
            </CardHeader>
            <CardBody>
              <div class="d-flex align-items-start mb-3">
                <i class="bi bi-check-circle-fill text-success me-2 mt-1"></i>
                <div class="small">
                  <strong>Sarah Chen</strong> completed "Design new landing page"
                  <div class="text-muted">2 hours ago</div>
                </div>
              </div>
              <div class="d-flex align-items-start mb-3">
                <i class="bi bi-chat-fill text-primary me-2 mt-1"></i>
                <div class="small">
                  <strong>Mike Johnson</strong> commented on your task
                  <div class="text-muted">5 hours ago</div>
                </div>
              </div>
              <div class="d-flex align-items-start">
                <i class="bi bi-person-plus-fill text-info me-2 mt-1"></i>
                <div class="small">
                  <strong>Emily Davis</strong> joined the team
                  <div class="text-muted">1 day ago</div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>

    <!-- Create Task Modal -->
    <TaskModal
      :show="showModal"
      mode="create"
      @close="closeModal"
      @save="handleSaveTask"
    />

    <!-- Toast Notification -->
    <Toast
      :show="showToast"
      :message="toastMessage"
      type="success"
      @close="showToast = false"
    />
  </div>
</template>

<style scoped>
.table > :not(caption) > * > * {
  padding: 1rem;
}
</style>
