<script setup lang="ts">
import type { Task } from '~/data/tasks';

const { value: user } = await useUser();

// Redirect to login if not authenticated
if (!user) {
  await navigateTo('/login');
}

const { searchQuery, selectedFilter, filteredTasks, statusCounts, addTask } = useTasks();

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
          <i class="bi bi-check2-square text-primary me-2"></i>
          Tasks
        </h1>
        <p class="lead text-muted">Manage and track all your tasks in one place</p>
      </div>
      <div class="col-auto">
        <button class="btn btn-primary btn-lg" @click="openCreateModal">
          <i class="bi bi-plus-circle me-2"></i>
          New Task
        </button>
      </div>
    </div>

    <!-- Filters and Search -->
    <Card class="mb-4">
      <CardBody>
        <div class="row g-3">
          <div class="col-md-8">
            <div class="input-group">
              <span class="input-group-text bg-white border-end-0">
                <i class="bi bi-search"></i>
              </span>
              <input
                v-model="searchQuery"
                type="text"
                class="form-control border-start-0"
                placeholder="Search tasks..."
              />
            </div>
          </div>
          <div class="col-md-4">
            <select v-model="selectedFilter" class="form-select">
              <option value="all">All Tasks ({{ statusCounts.all }})</option>
              <option value="todo">Todo ({{ statusCounts.todo }})</option>
              <option value="in-progress">In Progress ({{ statusCounts['in-progress'] }})</option>
              <option value="completed">Completed ({{ statusCounts.completed }})</option>
            </select>
          </div>
        </div>
      </CardBody>
    </Card>

    <!-- Tasks Grid -->
    <div class="row">
      <div v-for="task in filteredTasks" :key="task.id" class="col-md-6 col-lg-4 mb-4">
        <Card :hoverable="true" class="h-100">
          <CardBody>
            <div class="d-flex flex-column h-100">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <Badge :status="task.status" />
                <Badge :priority="task.priority" />
              </div>

              <h5 class="card-title fw-bold mb-2">{{ task.title }}</h5>
              <p class="card-text text-muted small flex-grow-1">{{ task.description }}</p>

              <div class="mb-3">
                <Badge v-for="tag in task.tags" :key="tag" variant="light" class="text-dark me-1 mb-1">
                  {{ tag }}
                </Badge>
              </div>

              <div class="d-flex justify-content-between align-items-center pt-3 border-top">
                <div class="d-flex align-items-center">
                  <i class="bi bi-person-circle text-muted me-1"></i>
                  <small class="text-muted">{{ task.assignee }}</small>
                </div>
                <div class="d-flex align-items-center">
                  <i class="bi bi-calendar3 text-muted me-1"></i>
                  <small class="text-muted">{{ task.dueDate }}</small>
                </div>
              </div>

              <div class="d-grid mt-3">
                <a :href="`/tasks/${task.id}`" class="btn btn-outline-primary btn-sm">
                  View Details
                </a>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="filteredTasks.length === 0" class="text-center py-5">
      <i class="bi bi-inbox text-muted" style="font-size: 4rem;"></i>
      <h3 class="mt-3 text-muted">No tasks found</h3>
      <p class="text-muted">Try adjusting your search or filters</p>
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
.input-group-text {
  border: 1px solid #dee2e6;
}
</style>
