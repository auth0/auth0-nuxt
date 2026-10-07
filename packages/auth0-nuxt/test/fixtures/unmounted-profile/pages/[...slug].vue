<script setup lang="ts">
import { ref } from 'vue';
import { useNuxtApp } from '#imports';
import { useUser } from '../../../../src/runtime/composables/use-user';

const user = useUser();

// Nuxt runs `app:suspense:resolve` hooks in series, and the module's client plugin registers
// its hook before any page mounts. So by the time this one fires, the plugin's fetch and the
// assignment behind it are done, which is what a test needs to wait for before reading the DOM.
const settled = ref(false);
useNuxtApp().hook('app:suspense:resolve', () => {
  settled.value = true;
});
</script>

<template>
  <div>
    <!-- A catch-all page is what turns an unmounted `/auth/profile` into a 200 HTML answer. -->
    <span data-testid="user-state">{{ user ? 'signed in' : 'anonymous' }}</span>
    <span data-testid="hydration">{{ settled ? 'settled' : 'pending' }}</span>
  </div>
</template>
