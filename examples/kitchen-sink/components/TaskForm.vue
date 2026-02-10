<script setup lang="ts">
import type { Task } from '~/data/tasks';

const props = defineProps<{
  task?: Partial<Task>;
  mode: 'create' | 'edit';
}>();

const emit = defineEmits<{
  save: [task: Partial<Task>];
  cancel: [];
}>();

const formData = ref({
  title: props.task?.title || '',
  description: props.task?.description || '',
  status: props.task?.status || 'Todo',
  priority: props.task?.priority || 'Medium',
  assignee: props.task?.assignee || '',
  dueDate: props.task?.dueDate || '',
  tags: props.task?.tags?.join(', ') || '',
});

const errors = ref<Record<string, string>>({});

const validate = () => {
  errors.value = {};

  if (!formData.value.title.trim()) {
    errors.value.title = 'Title is required';
  }

  if (!formData.value.description.trim()) {
    errors.value.description = 'Description is required';
  }

  if (!formData.value.assignee.trim()) {
    errors.value.assignee = 'Assignee is required';
  }

  if (!formData.value.dueDate) {
    errors.value.dueDate = 'Due date is required';
  }

  return Object.keys(errors.value).length === 0;
};

const handleSubmit = () => {
  if (!validate()) {
    return;
  }

  const task: Partial<Task> = {
    ...props.task,
    title: formData.value.title,
    description: formData.value.description,
    status: formData.value.status as Task['status'],
    priority: formData.value.priority as Task['priority'],
    assignee: formData.value.assignee,
    dueDate: formData.value.dueDate,
    tags: formData.value.tags.split(',').map(t => t.trim()).filter(Boolean),
  };

  emit('save', task);
};

const handleCancel = () => {
  emit('cancel');
};
</script>

<template>
  <div class="task-form">
    <h4 class="mb-4">
      {{ mode === 'create' ? 'Create New Task' : 'Edit Task' }}
    </h4>

    <form @submit.prevent="handleSubmit">
      <!-- Title -->
      <div class="mb-3">
        <label for="title" class="form-label">Title *</label>
        <input
          id="title"
          v-model="formData.title"
          type="text"
          class="form-control"
          :class="{ 'is-invalid': errors.title }"
          placeholder="Enter task title"
        />
        <div v-if="errors.title" class="invalid-feedback">
          {{ errors.title }}
        </div>
      </div>

      <!-- Description -->
      <div class="mb-3">
        <label for="description" class="form-label">Description *</label>
        <textarea
          id="description"
          v-model="formData.description"
          class="form-control"
          :class="{ 'is-invalid': errors.description }"
          rows="3"
          placeholder="Describe the task"
        ></textarea>
        <div v-if="errors.description" class="invalid-feedback">
          {{ errors.description }}
        </div>
      </div>

      <div class="row">
        <!-- Status -->
        <div class="col-md-6 mb-3">
          <label for="status" class="form-label">Status</label>
          <select
            id="status"
            v-model="formData.status"
            class="form-select"
          >
            <option value="Todo">Todo</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
          </select>
        </div>

        <!-- Priority -->
        <div class="col-md-6 mb-3">
          <label for="priority" class="form-label">Priority</label>
          <select
            id="priority"
            v-model="formData.priority"
            class="form-select"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </div>
      </div>

      <div class="row">
        <!-- Assignee -->
        <div class="col-md-6 mb-3">
          <label for="assignee" class="form-label">Assignee *</label>
          <input
            id="assignee"
            v-model="formData.assignee"
            type="text"
            class="form-control"
            :class="{ 'is-invalid': errors.assignee }"
            placeholder="Enter assignee name"
          />
          <div v-if="errors.assignee" class="invalid-feedback">
            {{ errors.assignee }}
          </div>
        </div>

        <!-- Due Date -->
        <div class="col-md-6 mb-3">
          <label for="dueDate" class="form-label">Due Date *</label>
          <input
            id="dueDate"
            v-model="formData.dueDate"
            type="date"
            class="form-control"
            :class="{ 'is-invalid': errors.dueDate }"
          />
          <div v-if="errors.dueDate" class="invalid-feedback">
            {{ errors.dueDate }}
          </div>
        </div>
      </div>

      <!-- Tags -->
      <div class="mb-4">
        <label for="tags" class="form-label">Tags</label>
        <input
          id="tags"
          v-model="formData.tags"
          type="text"
          class="form-control"
          placeholder="Enter tags separated by commas (e.g., Design, Frontend)"
        />
        <small class="text-muted">Separate multiple tags with commas</small>
      </div>

      <!-- Actions -->
      <div class="d-flex gap-2 justify-content-end">
        <button
          type="button"
          class="btn btn-outline-secondary"
          @click="handleCancel"
        >
          Cancel
        </button>
        <button type="submit" class="btn btn-primary">
          <i class="bi bi-check-circle me-1"></i>
          {{ mode === 'create' ? 'Create Task' : 'Save Changes' }}
        </button>
      </div>
    </form>
  </div>
</template>
