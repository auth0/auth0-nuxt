<script setup lang="ts">
import type { Task } from '~/data/tasks';

const props = defineProps<{
  show: boolean;
  task?: Partial<Task>;
  mode: 'create' | 'edit';
}>();

const emit = defineEmits<{
  close: [];
  save: [task: Partial<Task>];
}>();

const handleSave = (task: Partial<Task>) => {
  emit('save', task);
};

const handleCancel = () => {
  emit('close');
};
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="modal-backdrop"
        @click.self="handleCancel"
      >
        <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable modal-lg">
          <div class="modal-content">
            <div class="modal-header border-0">
              <button
                type="button"
                class="btn-close"
                @click="handleCancel"
              ></button>
            </div>
            <div class="modal-body">
              <TaskForm
                :task="task"
                :mode="mode"
                @save="handleSave"
                @cancel="handleCancel"
              />
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1050;
  padding: 1rem;
}

.modal-dialog {
  max-width: 600px;
  width: 100%;
}

.modal-content {
  background: white;
  border-radius: 0.75rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
}

.modal-header {
  padding: 1rem 1.5rem 0;
}

.modal-body {
  padding: 1rem 1.5rem 1.5rem;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-dialog,
.modal-leave-active .modal-dialog {
  transition: transform 0.2s ease;
}

.modal-enter-from .modal-dialog,
.modal-leave-to .modal-dialog {
  transform: scale(0.95);
}
</style>
