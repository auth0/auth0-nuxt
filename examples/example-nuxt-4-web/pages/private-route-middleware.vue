<script setup>
definePageMeta({
  middleware: [ 'auth' ],
});
</script>
<template>This is a private page that uses a route middleware.</template>
