<script setup lang="ts">
definePageMeta({
  layout: false,
});

const { value: user } = await useUser();

// If user is already logged in, redirect to dashboard
if (user) {
  await navigateTo('/');
}
</script>

<template>
  <div class="min-vh-100 d-flex align-items-center justify-content-center bg-light">
    <div class="container">
      <div class="row justify-content-center">
        <div class="col-md-6 col-lg-5">
          <Card>
            <CardBody>
              <div class="p-4">
                <div class="text-center mb-4">
                  <i class="bi bi-list-check text-primary" style="font-size: 3rem;"></i>
                  <h2 class="fw-bold mt-3">Welcome to Task0</h2>
                  <p class="text-muted">Sign in to manage your tasks and collaborate with your team</p>
                </div>

              <div class="d-grid gap-3">
                <!-- Login with Google -->
                <a
                  href="/auth/login?connection=google-oauth2"
                  class="btn btn-outline-dark btn-lg d-flex align-items-center justify-content-center gap-2"
                >
                  <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    <path fill="none" d="M0 0h48v48H0z"/>
                  </svg>
                  Continue with Google
                </a>

                <!-- Divider -->
                <div class="d-flex align-items-center">
                  <hr class="flex-grow-1">
                  <span class="px-3 text-muted small">OR</span>
                  <hr class="flex-grow-1">
                </div>

                <!-- Login with Username & Password -->
                <a
                  href="/auth/login?connection=Username-Password-Authentication"
                  class="btn btn-primary btn-lg d-flex align-items-center justify-content-center gap-2"
                >
                  <i class="bi bi-envelope-fill"></i>
                  Continue with Email
                </a>
              </div>

                <div class="text-center mt-4">
                  <small class="text-muted">
                    By continuing, you agree to our Terms of Service and Privacy Policy
                  </small>
                </div>
              </div>
            </CardBody>
          </Card>

          <div class="text-center mt-3">
            <a href="/" class="text-decoration-none text-muted">
              <i class="bi bi-arrow-left me-1"></i>
              Back to home
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.btn-lg {
  padding: 0.75rem 1.5rem;
  border-radius: 0.5rem;
  font-weight: 500;
}

.btn-outline-dark:hover {
  background-color: #f8f9fa;
  border-color: #dee2e6;
  color: #212529;
}
</style>
