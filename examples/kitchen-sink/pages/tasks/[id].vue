<script setup lang="ts">
import type { Task } from '~/data/tasks';

const route = useRoute();
const { value: user } = await useUser();

// Redirect to login if not authenticated
if (!user) {
  await navigateTo('/login');
}

const { task, completedItems, progressPercentage } = useTaskDetail(route.params.id as string);
const { updateTask, getTaskById } = useTasks();

// Edit mode state
const showEditModal = ref(false);

// Toast state
const showToast = ref(false);
const toastMessage = ref('');

const taskData = computed(() => {
  if (!task.value) return null;
  // Get basic task data for editing
  const basicTask = getTaskById(Number(route.params.id));
  return basicTask;
});

const openEditModal = () => {
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
};

const handleSaveTask = async (updates: Partial<Task>) => {
  const updatedTask = await updateTask(Number(route.params.id), updates);
  closeEditModal();
  if (updatedTask) {
    toastMessage.value = `Task "${updatedTask.title}" updated successfully!`;
    showToast.value = true;
  }
};
</script>

<template>
  <div class="container py-5">
    <!-- Back Button -->
    <div class="mb-4">
      <a href="/tasks" class="btn btn-link text-decoration-none ps-0">
        <i class="bi bi-arrow-left me-1"></i>
        Back to Tasks
      </a>
    </div>

    <div v-if="!task" class="text-center py-5">
      <i class="bi bi-exclamation-circle text-muted" style="font-size: 4rem;"></i>
      <h3 class="mt-3 text-muted">Task not found</h3>
      <p class="text-muted">The task you're looking for doesn't exist.</p>
      <a href="/tasks" class="btn btn-primary">Back to Tasks</a>
    </div>

    <div v-else class="row">
      <!-- Main Content -->
      <div class="col-lg-8">
        <!-- Task Header -->
        <Card class="mb-4">
          <CardBody>
            <div class="p-2">
              <div class="d-flex justify-content-between align-items-start mb-3">
                <div class="d-flex gap-2">
                  <Badge :status="task.status" />
                  <Badge :priority="task.priority">{{ task.priority }} Priority</Badge>
                </div>
              <div class="dropdown">
                <button
                  class="btn btn-link text-muted"
                  type="button"
                  data-bs-toggle="dropdown"
                >
                  <i class="bi bi-three-dots-vertical"></i>
                </button>
                <ul class="dropdown-menu dropdown-menu-end">
                  <li><a class="dropdown-item" href="#" @click.prevent="openEditModal"><i class="bi bi-pencil me-2"></i>Edit</a></li>
                  <li><a class="dropdown-item" href="#"><i class="bi bi-link-45deg me-2"></i>Copy Link</a></li>
                  <li><hr class="dropdown-divider"></li>
                  <li><a class="dropdown-item text-danger" href="#"><i class="bi bi-trash me-2"></i>Delete</a></li>
                </ul>
              </div>
            </div>

              <h1 class="display-6 fw-bold mb-3">{{ task.title }}</h1>
              <p class="text-muted">{{ task.description }}</p>

              <div class="d-flex flex-wrap gap-2 mb-3">
                <Badge v-for="tag in task.tags" :key="tag" variant="light" class="text-dark">
                  {{ tag }}
                </Badge>
              </div>
            </div>
          </CardBody>
        </Card>

        <!-- Checklist -->
        <Card class="mb-4">
          <CardHeader>
            <div class="d-flex justify-content-between align-items-center">
              <h5 class="mb-0 fw-bold">
                <i class="bi bi-list-check me-2"></i>
                Checklist
              </h5>
              <span class="text-muted small">{{ completedItems }} / {{ task.checklist.length }}</span>
            </div>
          </CardHeader>
          <CardBody>
            <div class="progress mb-3" style="height: 8px;">
              <div
                class="progress-bar"
                role="progressbar"
                :style="`width: ${progressPercentage}%`"
                :aria-valuenow="progressPercentage"
                aria-valuemin="0"
                aria-valuemax="100"
              ></div>
            </div>
            <div class="list-group list-group-flush">
              <div
                v-for="item in task.checklist"
                :key="item.id"
                class="list-group-item border-0 px-0"
              >
                <div class="form-check">
                  <input
                    :id="`check-${item.id}`"
                    class="form-check-input"
                    type="checkbox"
                    :checked="item.completed"
                  />
                  <label
                    :for="`check-${item.id}`"
                    class="form-check-label"
                    :class="{ 'text-decoration-line-through text-muted': item.completed }"
                  >
                    {{ item.text }}
                  </label>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <!-- Attachments -->
        <Card class="mb-4">
          <CardHeader>
            <h5 class="mb-0 fw-bold">
              <i class="bi bi-paperclip me-2"></i>
              Attachments
            </h5>
          </CardHeader>
          <CardBody>
            <div class="list-group list-group-flush">
              <a
                v-for="attachment in task.attachments"
                :key="attachment.name"
                href="#"
                class="list-group-item list-group-item-action d-flex justify-content-between align-items-center border-0 px-0"
              >
                <div class="d-flex align-items-center">
                  <i
                    class="bi fs-4 me-3"
                    :class="{
                      'bi-file-pdf text-danger': attachment.type === 'pdf',
                      'bi-file-earmark text-primary': attachment.type === 'figma'
                    }"
                  ></i>
                  <div>
                    <div class="fw-medium">{{ attachment.name }}</div>
                    <small class="text-muted">{{ attachment.size }}</small>
                  </div>
                </div>
                <i class="bi bi-download"></i>
              </a>
            </div>
          </CardBody>
        </Card>

        <!-- Comments -->
        <Card>
          <CardHeader>
            <h5 class="mb-0 fw-bold">
              <i class="bi bi-chat-left-text me-2"></i>
              Comments
            </h5>
          </CardHeader>
          <CardBody>
            <div v-for="comment in task.comments" :key="comment.id" class="d-flex mb-4">
              <img
                :src="comment.picture"
                :alt="comment.author"
                class="rounded-circle me-3"
                width="40"
                height="40"
              />
              <div class="flex-grow-1">
                <div class="d-flex justify-content-between align-items-start mb-1">
                  <strong>{{ comment.author }}</strong>
                  <small class="text-muted">
                    {{ new Date(comment.timestamp).toLocaleDateString() }}
                  </small>
                </div>
                <p class="mb-0">{{ comment.text }}</p>
              </div>
            </div>

            <div class="d-flex mt-4">
              <img
                :src="user?.picture || 'https://via.placeholder.com/40'"
                :alt="user?.name"
                class="rounded-circle me-3"
                width="40"
                height="40"
              />
              <div class="flex-grow-1">
                <textarea
                  class="form-control mb-2"
                  rows="3"
                  placeholder="Add a comment..."
                ></textarea>
                <button class="btn btn-primary btn-sm">
                  <i class="bi bi-send me-1"></i>
                  Post Comment
                </button>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>

      <!-- Sidebar -->
      <div class="col-lg-4">
        <!-- Task Details -->
        <Card class="mb-4">
          <CardHeader>
            <h5 class="mb-0 fw-bold">Task Details</h5>
          </CardHeader>
          <CardBody>
            <div class="mb-3">
              <label class="form-label text-muted small">Assignee</label>
              <div class="d-flex align-items-center">
                <img
                  :src="task.assignee.picture"
                  :alt="task.assignee.name"
                  class="rounded-circle me-2"
                  width="32"
                  height="32"
                />
                <div>
                  <div class="fw-medium">{{ task.assignee.name }}</div>
                  <small class="text-muted">{{ task.assignee.email }}</small>
                </div>
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label text-muted small">Created By</label>
              <div class="fw-medium">{{ task.creator.name }}</div>
            </div>

            <div class="mb-3">
              <label class="form-label text-muted small">Created</label>
              <div class="fw-medium">
                {{ new Date(task.createdAt).toLocaleDateString() }}
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label text-muted small">Due Date</label>
              <div class="fw-medium d-flex align-items-center">
                <i class="bi bi-calendar3 me-2 text-primary"></i>
                {{ task.dueDate }}
              </div>
            </div>
          </CardBody>
        </Card>

        <!-- Quick Actions -->
        <Card>
          <CardHeader>
            <h5 class="mb-0 fw-bold">Actions</h5>
          </CardHeader>
          <CardBody>
            <div class="d-grid gap-2">
              <button class="btn btn-primary">
                <i class="bi bi-check-circle me-2"></i>
                Mark Complete
              </button>
              <button class="btn btn-outline-primary" @click="openEditModal">
                <i class="bi bi-pencil me-2"></i>
                Edit Task
              </button>
              <button class="btn btn-outline-primary">
                <i class="bi bi-person-plus me-2"></i>
                Reassign
              </button>
              <button class="btn btn-outline-primary">
                <i class="bi bi-files me-2"></i>
                Duplicate
              </button>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>

    <!-- Edit Task Modal -->
    <TaskModal
      v-if="taskData"
      :show="showEditModal"
      :task="taskData"
      mode="edit"
      @close="closeEditModal"
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
.form-check-input:checked {
  background-color: #198754;
  border-color: #198754;
}
</style>
