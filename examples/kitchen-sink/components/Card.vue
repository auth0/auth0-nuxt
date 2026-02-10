<script setup lang="ts">
interface Props {
  shadow?: boolean;
  hoverable?: boolean;
}

withDefaults(defineProps<Props>(), {
  shadow: true,
  hoverable: false,
});
</script>

<template>
  <div
    class="card border-0"
    :class="{
      'shadow-sm': shadow,
      'card-hoverable': hoverable
    }"
  >
    <slot />
  </div>
</template>

<style scoped>
.card {
  border-radius: 0.75rem;
}

.card-hoverable {
  transition: transform 0.2s, box-shadow 0.2s;
}

.card-hoverable:hover {
  transform: translateY(-4px);
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
}
</style>
