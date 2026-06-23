<script setup lang="ts">
import { useUser } from '../../../../../src/runtime/composables/use-user';
const user = useUser();
</script>

<template>
  <div>
    <span data-testid="user-sub">{{ user?.sub ?? 'anonymous' }}</span>
  </div>
</template>
