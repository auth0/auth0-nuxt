<script setup lang="ts">
const { value: user } = await useUser();
const host = useRequestURL().host;
</script>

<template>
  <div>
    <h1>Welcome to the homepage</h1>
    <p v-if="user">
      You are logged in as <strong>{{ user?.name }}</strong> on
      <strong>{{ host }}</strong
      >.
    </p>
    <p v-else>
      You are not logged in. Logging in from <strong>{{ host }}</strong> will
      redirect you back to this same origin.
    </p>
  </div>
</template>
