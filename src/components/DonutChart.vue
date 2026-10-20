<script setup>
import { computed, onMounted, ref } from 'vue'
import { rupiah } from '../utils'

const props = defineProps({ items: Array, size: { type: Number, default: 170 } })
const colors = ['#6366f1', '#14b8a6', '#f59e0b', '#ec4899', '#0ea5e9', '#a78bfa']
const hover = ref(-1)
const ready = ref(false)
onMounted(() => requestAnimationFrame(() => (ready.value = true)))

const total = computed(() => props.items.reduce((s, i) => s + i.value, 0))
const R = 62
const C = 2 * Math.PI * R
const segs = computed(() => {
  let acc = 0
  return props.items.map((it, i) => {
    const len = total.value ? (it.value / total.value) * C : 0
    const seg = { ...it, color: colors[i % colors.length], len, offset: -acc, pct: total.value ? (it.value / total.value) * 100 : 0 }
    acc += len
    return seg
  })
})
</script>

<template>
  <div class="donut">
    <div class="ring" :style="{ width: size + 'px', height: size + 'px' }">
      <svg :width="size" :height="size" viewBox="0 0 160 160">
        <circle cx="80" cy="80" :r="R" fill="none" stroke="var(--surface-2)" stroke-width="18" />
        <circle
          v-for="(s, i) in segs"
          :key="s.name"
          cx="80"
          cy="80"
          :r="R"
          fill="none"
          :stroke="s.color"
          :stroke-width="hover === i ? 22 : 18"
          :stroke-dasharray="ready ? `${Math.max(0, s.len - 2)} ${C}` : `0 ${C}`"
          :stroke-dashoffset="s.offset"
          transform="rotate(-90 80 80)"
          style="transition: stroke-dasharray 1s var(--ease), stroke-width 0.2s"
          @mouseenter="hover = i"
          @mouseleave="hover = -1"
        />
      </svg>
      <div class="center">
        <small>{{ hover > -1 ? segs[hover].name : 'Total' }}</small>
        <strong>{{ hover > -1 ? segs[hover].pct.toFixed(0) + '%' : (total / 1e6).toFixed(1).replace('.', ',') + ' jt' }}</strong>
      </div>
    </div>
    <ul class="legend">
      <li v-for="(s, i) in segs" :key="s.name" :class="{ dim: hover > -1 && hover !== i }" @mouseenter="hover = i" @mouseleave="hover = -1">
        <i :style="{ background: s.color }"></i>
        <span>{{ s.name }}</span>
        <b class="num">{{ rupiah(s.value) }}</b>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.donut {
  display: flex;
  align-items: center;
  gap: 22px;
  flex-wrap: wrap;
  justify-content: center;
}
.ring {
  position: relative;
  flex: none;
}
.center {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  text-align: center;
  pointer-events: none;
}
.center small {
  color: var(--muted);
  font-size: 12px;
  max-width: 90px;
}
.center strong {
  font-size: 20px;
  letter-spacing: -0.02em;
}
.legend {
  list-style: none;
  margin: 0;
  padding: 0;
  flex: 1;
  min-width: 190px;
  display: grid;
  gap: 4px;
}
.legend li {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 8px;
  transition:
    opacity 0.2s,
    background 0.2s;
  font-size: 13px;
}
.legend li:hover {
  background: var(--surface-2);
}
.legend li.dim {
  opacity: 0.45;
}
.legend i {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  flex: none;
}
.legend b {
  margin-left: auto;
  font-weight: 600;
}
</style>
