<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import Icon from './Icon.vue'
import { rupiah } from '../utils'

const props = defineProps({
  label: String,
  value: Number,
  icon: String,
  tone: { type: String, default: 'primary' }, // primary|success|danger|warn
  delta: { type: Number, default: null }, // persen
  deltaGoodWhenUp: { type: Boolean, default: true },
  spark: { type: Array, default: () => [] },
  format: { type: Function, default: rupiah },
})

// angka berjalan (count-up)
const shown = ref(0)
function animate(to) {
  const from = shown.value
  const start = performance.now()
  const step = (now) => {
    const p = Math.min(1, (now - start) / 900)
    shown.value = from + (to - from) * (1 - Math.pow(1 - p, 4))
    if (p < 1) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}
onMounted(() => animate(props.value))
watch(() => props.value, animate)

const good = computed(() => (props.delta >= 0) === props.deltaGoodWhenUp)

const path = computed(() => {
  const v = props.spark
  if (v.length < 2) return ''
  const max = Math.max(...v)
  const min = Math.min(...v)
  const w = 100
  const h = 34
  return v
    .map((n, i) => `${i ? 'L' : 'M'}${(i / (v.length - 1)) * w},${h - 3 - ((n - min) / (max - min || 1)) * (h - 6)}`)
    .join(' ')
})
</script>

<template>
  <div class="card hover stat">
    <div class="top">
      <span class="ic" :class="tone"><Icon :name="icon" :size="20" /></span>
      <span v-if="delta !== null" class="badge plain" :class="good ? 'success' : 'danger'">
        <Icon :name="delta >= 0 ? 'up' : 'down'" :size="12" />{{ Math.abs(delta).toFixed(1).replace('.', ',') }}%
      </span>
    </div>
    <div class="label">{{ label }}</div>
    <div class="value num">{{ format(Math.round(shown)) }}</div>
    <svg v-if="path" class="spark" aria-hidden="true" viewBox="0 0 100 34" preserveAspectRatio="none">
      <path :d="path" fill="none" :stroke="`var(--${tone})`" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    </svg>
  </div>
</template>

<style scoped>
.stat {
  position: relative;
  overflow: hidden;
}
.top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.ic {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
}
.ic.primary {
  background: var(--primary-soft);
  color: var(--primary);
}
.ic.success {
  background: var(--success-soft);
  color: var(--success);
}
.ic.danger {
  background: var(--danger-soft);
  color: var(--danger);
}
.ic.warn {
  background: var(--warn-soft);
  color: var(--warn);
}
.label {
  margin-top: 14px;
  color: var(--muted);
  font-weight: 500;
}
.value {
  font-size: 24px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-top: 2px;
}
.spark {
  display: block;
  width: 100%;
  height: 34px;
  margin-top: 12px;
  opacity: 0.85;
}
</style>
