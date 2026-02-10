<script setup lang="ts">
const { value: user } = await useUser();
</script>

<template>
  <nav class="navbar navbar-expand-lg navbar-dark bg-primary">
    <div class="container-fluid">
      <a class="navbar-brand d-flex align-items-center" href="/">
        <img src="/logo.svg" alt="Task0 Logo" class="me-2" width="27" height="35">
        <span class="fw-bold">Task0</span>
      </a>

      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarNav"
        aria-controls="navbarNav"
        aria-expanded="false"
        aria-label="Toggle navigation"
      >
        <span class="navbar-toggler-icon"></span>
      </button>

      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav me-auto">
          <li class="nav-item">
            <a class="nav-link" href="/">
              <i class="bi bi-house-door me-1"></i>
              Dashboard
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="/tasks">
              <i class="bi bi-check2-square me-1"></i>
              Tasks
            </a>
          </li>
          <li class="nav-item">
            <a class="nav-link" href="/team">
              <i class="bi bi-people me-1"></i>
              Team
            </a>
          </li>
        </ul>

        <ul class="navbar-nav">
          <li v-if="user" class="nav-item dropdown">
            <a
              class="nav-link dropdown-toggle d-flex align-items-center"
              href="#"
              id="userDropdown"
              role="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              <img
                :src="user.picture || 'https://via.placeholder.com/32'"
                :alt="user.name"
                class="rounded-circle me-2"
                width="32"
                height="32"
              />
              <span>{{ user.name }}</span>
            </a>
            <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="userDropdown">
              <li>
                <a class="dropdown-item" href="/profile">
                  <i class="bi bi-person me-2"></i>
                  Profile
                </a>
              </li>
              <li><hr class="dropdown-divider" /></li>
              <li>
                <a class="dropdown-item" href="/auth/logout">
                  <i class="bi bi-box-arrow-right me-2"></i>
                  Log out
                </a>
              </li>
            </ul>
          </li>

          <li v-if="!user" class="nav-item">
            <a class="nav-link" href="/login">
              <i class="bi bi-box-arrow-in-right me-1"></i>
              Log in
            </a>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>

<style scoped>
.navbar {
  box-shadow: 0 2px 4px rgba(0,0,0,.1);
}
</style>
