<script setup lang="ts">
const user = useUser();
</script>

<template>
  <h1 v-if="user">Hello, {{ user.name }}!</h1>
  <h1 v-else>You are not logged in.</h1>
</template>
