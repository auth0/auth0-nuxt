<template>
  <div class="min-vh-100 d-flex flex-column">
    <Header />
    <main class="flex-grow-1">
      <slot />
    </main>
    <footer class="bg-light py-3 mt-auto">
      <div class="container text-center text-muted">
        <span class="fw-bold">Task0</span> -
        <small> A Nuxt Example Application using Auth0 </small>
      </div>
    </footer>
  </div>
</template>
