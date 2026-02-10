<script setup lang="ts">
const props = defineProps<{
  show: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
}>();

const emit = defineEmits<{
  close: [];
}>();

// Auto-close after 3 seconds
watch(() => props.show, (newVal) => {
  if (newVal) {
    setTimeout(() => {
      emit('close');
    }, 3000);
  }
});

const iconClass = computed(() => {
  switch (props.type) {
    case 'success':
      return 'bi-check-circle-fill';
    case 'error':
      return 'bi-x-circle-fill';
    case 'info':
    default:
      return 'bi-info-circle-fill';
  }
});

const bgClass = computed(() => {
  switch (props.type) {
    case 'success':
      return 'bg-success';
    case 'error':
      return 'bg-danger';
    case 'info':
    default:
      return 'bg-primary';
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="toast">
      <div
        v-if="show"
        class="toast-container position-fixed top-0 end-0 p-3"
        style="z-index: 1100;"
      >
        <div
          class="toast show"
          role="alert"
          aria-live="assertive"
          aria-atomic="true"
        >
          <div :class="['toast-body', 'text-white', bgClass]">
            <div class="d-flex align-items-center">
              <i :class="['bi', iconClass, 'me-2', 'fs-5']"></i>
              <span>{{ message }}</span>
              <button
                type="button"
                class="btn-close btn-close-white ms-auto"
                @click="emit('close')"
              ></button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.toast {
  min-width: 300px;
  border-radius: 0.5rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
}

.toast-body {
  padding: 1rem;
  border-radius: 0.5rem;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.toast-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
