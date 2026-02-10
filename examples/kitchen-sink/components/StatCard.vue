<script setup lang="ts">
interface Props {
  icon: string;
  color: string;
  value: string | number;
  label: string;
}

defineProps<Props>();
</script>

<template>
  <Card>
    <CardBody>
      <div class="d-flex align-items-center">
        <div
          :class="`d-flex align-items-center justify-content-center bg-${color} bg-opacity-10 rounded-circle me-3`"
          style="width: 4rem; height: 4rem;"
        >
          <i :class="`bi ${icon} text-${color} fs-4`"></i>
        </div>
        <div>
          <h2 class="mb-0 fw-bold">{{ value }}</h2>
          <p class="text-muted mb-0 small">{{ label }}</p>
        </div>
      </div>
    </CardBody>
  </Card>
</template>
