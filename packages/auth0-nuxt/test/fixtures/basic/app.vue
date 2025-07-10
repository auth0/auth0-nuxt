<script setup lang="ts">
const { value: user } = await useUser();
</script>

<template>
  <nav class="py-2 bg-body-tertiary border-bottom">
    <div class="container d-flex flex-wrap">
      <ul class="nav">
        <li class="nav-item">
          <a v-if="user" class="nav-link link-body-emphasis px-2" href="/auth/logout" data-testid="logout-link"
            >Log out</a
          >

          <a v-if="!user" class="nav-link link-body-emphasis px-2" href="/auth/login" data-testid="login-link"
            >Log in</a
          >
        </li>
      </ul>
    </div>
  </nav>
  <div class="container py-4">
    <h1>Auth0 Testing</h1>
  </div>
</template>
