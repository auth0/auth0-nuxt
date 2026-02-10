<script setup lang="ts">
const { value: user } = await useUser();

// Redirect to login if not authenticated
if (!user) {
  await navigateTo('/login');
}
</script>

<template>
  <div class="container py-5">
    <div class="row">
      <div class="col-lg-8 mx-auto">
        <div class="mb-4">
          <h1 class="display-5 fw-bold">
            <i class="bi bi-person-circle text-primary me-2"></i>
            Profile
          </h1>
          <p class="lead text-muted">Manage your account settings and preferences</p>
        </div>

        <!-- Profile Card -->
        <Card class="mb-4">
          <CardBody>
            <div class="p-2">
              <div class="row align-items-center">
                <div class="col-auto">
                  <img
                    :src="user?.picture || 'https://via.placeholder.com/100'"
                    :alt="user?.name"
                    class="rounded-circle"
                    width="100"
                    height="100"
                  />
                </div>
                <div class="col">
                  <h3 class="mb-1">{{ user?.name }}</h3>
                  <p class="text-muted mb-2">{{ user?.email }}</p>
                  <Badge variant="success">
                    <i class="bi bi-check-circle-fill me-1"></i>
                    Email Verified
                  </Badge>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <!-- Personal Information -->
        <Card class="mb-4">
          <CardHeader>
            <h5 class="mb-0 fw-bold">
              <i class="bi bi-person-fill me-2"></i>
              Personal Information
            </h5>
          </CardHeader>
          <CardBody>
            <div class="row mb-3">
              <div class="col-md-6">
                <span class="form-label text-muted small">Full Name</span>
                <p class="fw-medium">{{ user?.name }}</p>
              </div>
              <div class="col-md-6">
                <span class="form-label text-muted small">Email Address</span>
                <p class="fw-medium">{{ user?.email }}</p>
              </div>
            </div>
            <div class="row mb-3">
              <div class="col-md-6">
                <span class="form-label text-muted small">User ID</span>
                <p class="fw-medium font-monospace small">{{ user?.sub }}</p>
              </div>
              <div class="col-md-6">
                <span class="form-label text-muted small">Email Verified</span>
                <p class="fw-medium">
                  <span v-if="user?.email_verified" class="text-success">
                    <i class="bi bi-check-circle-fill me-1"></i>
                    Yes
                  </span>
                  <span v-else class="text-warning">
                    <i class="bi bi-exclamation-circle-fill me-1"></i>
                    No
                  </span>
                </p>
              </div>
            </div>
            <div class="row">
              <div class="col-md-6">
                <span class="form-label text-muted small">Last Updated</span>
                <p class="fw-medium">
                  {{ user?.updated_at ? new Date(user.updated_at as string).toLocaleDateString() : 'N/A' }}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <!-- User Data (Raw JSON) -->
        <Card>
          <CardHeader>
            <h5 class="mb-0 fw-bold">
              <i class="bi bi-code-square me-2"></i>
              User Data (Raw JSON)
            </h5>
          </CardHeader>
          <CardBody>
            <pre class="bg-light p-3 rounded border"><code>{{ JSON.stringify(user, null, 2) }}</code></pre>
          </CardBody>
        </Card>
      </div>
    </div>
  </div>
</template>

<style scoped>
.list-group-item {
  border-left: none;
  border-right: none;
  padding: 1rem 0;
}

.list-group-item:first-child {
  border-top: none;
}

.list-group-item:last-child {
  border-bottom: none;
}

pre {
  max-height: 400px;
  overflow-y: auto;
  font-size: 0.85rem;
}
</style>
