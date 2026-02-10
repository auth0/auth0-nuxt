<script setup lang="ts">
const { value: user } = await useUser();

// Redirect to login if not authenticated
if (!user) {
  await navigateTo('/login');
}

const { teamMembers, searchQuery, selectedDepartment, filteredMembers, departments, stats } = useTeam();
</script>

<template>
  <div class="container py-5">
    <div class="row mb-4">
      <div class="col">
        <h1 class="display-5 fw-bold">
          <i class="bi bi-people text-primary me-2"></i>
          Team
        </h1>
        <p class="lead text-muted">Collaborate with {{ stats.totalMembers }} talented team members</p>
      </div>
      <div class="col-auto">
        <button class="btn btn-primary btn-lg">
          <i class="bi bi-person-plus me-2"></i>
          Invite Member
        </button>
      </div>
    </div>

    <!-- Team Stats -->
    <div class="row mb-4">
      <div class="col-md-3 mb-3">
        <StatCard
          icon="bi-people-fill"
          color="primary"
          :value="stats.totalMembers"
          label="Team Members"
        />
      </div>
      <div class="col-md-3 mb-3">
        <StatCard
          icon="bi-check-circle-fill"
          color="success"
          :value="stats.onlineMembers"
          label="Online Now"
        />
      </div>
      <div class="col-md-3 mb-3">
        <StatCard
          icon="bi-briefcase-fill"
          color="info"
          :value="stats.departmentCount"
          label="Departments"
        />
      </div>
      <div class="col-md-3 mb-3">
        <StatCard
          icon="bi-list-check"
          color="warning"
          :value="stats.totalTasks"
          label="Active Tasks"
        />
      </div>
    </div>

    <!-- Search and Filter -->
    <Card class="mb-4">
      <CardBody>
        <div class="row g-3">
          <div class="col-md-8">
            <div class="input-group">
              <span class="input-group-text bg-white border-end-0">
                <i class="bi bi-search"></i>
              </span>
              <input
                v-model="searchQuery"
                type="text"
                class="form-control border-start-0"
                placeholder="Search team members..."
              />
            </div>
          </div>
          <div class="col-md-4">
            <select v-model="selectedDepartment" class="form-select">
              <option value="all">All Departments</option>
              <option v-for="dept in departments.filter(d => d !== 'all')" :key="dept" :value="dept">
                {{ dept }}
              </option>
            </select>
          </div>
        </div>
      </CardBody>
    </Card>

    <!-- Team Members Grid -->
    <div class="row">
      <div v-for="member in filteredMembers" :key="member.id" class="col-md-6 col-lg-4 mb-4">
        <Card :hoverable="true" class="h-100">
          <CardBody>
            <div class="text-center">
            <div class="position-relative d-inline-block mb-3">
              <img
                :src="member.picture"
                :alt="member.name"
                class="rounded-circle"
                width="80"
                height="80"
              />
              <span
                class="position-absolute bottom-0 end-0 p-2 border border-white border-3 rounded-circle"
                :class="{
                  'bg-success': member.status === 'online',
                  'bg-warning': member.status === 'away',
                  'bg-secondary': member.status === 'offline'
                }"
              ></span>
            </div>

            <h5 class="card-title fw-bold mb-1">{{ member.name }}</h5>
            <p class="text-primary small mb-1">{{ member.role }}</p>
            <p class="text-muted small mb-3">
              <i class="bi bi-building me-1"></i>
              {{ member.department }}
            </p>

            <div class="d-flex justify-content-around mb-3 py-3 border-top border-bottom">
              <div>
                <div class="fw-bold text-primary">{{ member.tasksCount }}</div>
                <small class="text-muted">Tasks</small>
              </div>
              <div>
                <div class="fw-bold text-primary">
                  {{ Math.floor((Date.now() - new Date(member.joinedDate).getTime()) / (1000 * 60 * 60 * 24 * 30)) }}m
                </div>
                <small class="text-muted">Member</small>
              </div>
            </div>

            <div class="d-flex gap-2">
              <button class="btn btn-outline-primary btn-sm flex-grow-1">
                <i class="bi bi-envelope me-1"></i>
                Email
              </button>
              <button class="btn btn-outline-primary btn-sm flex-grow-1">
                <i class="bi bi-chat me-1"></i>
                Message
              </button>
            </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="filteredMembers.length === 0" class="text-center py-5">
      <i class="bi bi-people text-muted" style="font-size: 4rem;"></i>
      <h3 class="mt-3 text-muted">No team members found</h3>
      <p class="text-muted">Try adjusting your search or filters</p>
    </div>
  </div>
</template>

<style scoped>
.input-group-text {
  border: 1px solid #dee2e6;
}
</style>
