<script setup lang="ts">
interface Props {
  padding?: boolean;
}

withDefaults(defineProps<Props>(), {
  padding: true,
});
</script>

<template>
  <div :class="padding ? 'card-body' : 'card-body p-0'">
    <slot />
  </div>
</template>
