<script setup>
import { computed } from 'vue'
import { invoiceStatus } from '../store'

const props = defineProps({ invoice: Object })
const map = {
  paid: ['Lunas', 'success'],
  sent: ['Terkirim', 'info'],
  overdue: ['Jatuh tempo', 'danger'],
  draft: ['Draft', ''],
}
const s = computed(() => map[invoiceStatus(props.invoice)])
</script>

<template>
  <span class="badge" :class="s[1]">{{ s[0] }}</span>
</template>
