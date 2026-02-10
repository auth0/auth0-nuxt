<script setup lang="ts">
interface Props {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark';
  status?: 'Todo' | 'In Progress' | 'Completed';
  priority?: 'Low' | 'Medium' | 'High' | 'Critical';
}

const props = defineProps<Props>();

const computedVariant = computed(() => {
  if (props.status) {
    switch (props.status) {
      case 'Completed':
        return 'success';
      case 'In Progress':
        return 'primary';
      case 'Todo':
        return 'secondary';
    }
  }

  if (props.priority) {
    switch (props.priority) {
      case 'Critical':
      case 'High':
        return 'danger';
      case 'Medium':
        return 'warning';
      case 'Low':
        return 'info';
    }
  }

  return props.variant || 'secondary';
});
</script>

<template>
  <span :class="`badge bg-${computedVariant}`">
    <slot>{{ status || priority }}</slot>
  </span>
</template>
