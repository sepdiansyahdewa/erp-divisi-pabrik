<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { compact, rupiah } from '../utils'

const props = defineProps({
  labels: Array,
  series: Array, // {name,color,values}
  height: { type: Number, default: 280 },
})

const box = ref(null)
const width = ref(600)
const ready = ref(false)
const hover = ref(-1)
let ro
onMounted(() => {
  ro = new ResizeObserver(([e]) => (width.value = Math.max(300, e.contentRect.width)))
  ro.observe(box.value)
  nextTick(() => requestAnimationFrame(() => (ready.value = true)))
})
onUnmounted(() => ro?.disconnect())

const pad = { t: 12, r: 8, b: 28, l: 46 }
const innerW = computed(() => width.value - pad.l - pad.r)
const innerH = computed(() => props.height - pad.t - pad.b)

const niceMax = computed(() => {
  const max = Math.max(1, ...props.series.flatMap((s) => s.values))
  const mag = 10 ** Math.floor(Math.log10(max))
  const n = max / mag
  return ([1, 1.2, 1.6, 2, 2.4, 3, 4, 5, 6, 8, 10].find((x) => n <= x) ?? 10) * mag
})
const ticks = computed(() => [0, 1, 2, 3, 4].map((i) => (niceMax.value / 4) * i))
const y = (v) => pad.t + innerH.value - (v / niceMax.value) * innerH.value

const groupW = computed(() => innerW.value / props.labels.length)
const barW = computed(() => Math.min(26, (groupW.value * 0.7) / props.series.length))
const barX = (gi, si) => {
  const total = barW.value * props.series.length + 4 * (props.series.length - 1)
  return pad.l + gi * groupW.value + (groupW.value - total) / 2 + si * (barW.value + 4)
}
</script>

<template>
  <div ref="box" class="chart" :style="{ height: height + 'px' }" @mouseleave="hover = -1">
    <svg :width="width" :height="height" role="img">
      <g>
        <template v-for="t in ticks" :key="t">
          <line :x1="pad.l" :x2="width - pad.r" :y1="y(t)" :y2="y(t)" stroke="var(--border)" stroke-dasharray="3 4" />
          <text :x="pad.l - 10" :y="y(t) + 4" text-anchor="end" class="axis">{{ compact(t) }}</text>
        </template>
      </g>
      <g v-for="(l, gi) in labels" :key="l">
        <rect
          :x="pad.l + gi * groupW"
          :y="pad.t"
          :width="groupW"
          :height="innerH"
          rx="8"
          :fill="hover === gi ? 'var(--surface-2)' : 'transparent'"
          @mouseenter="hover = gi"
        />
        <rect
          v-for="(s, si) in series"
          :key="s.name"
          class="bar-rect"
          :class="{ in: ready }"
          :x="barX(gi, si)"
          :y="y(s.values[gi])"
          :width="barW"
          :height="Math.max(0, pad.t + innerH - y(s.values[gi]))"
          rx="5"
          :fill="s.color"
          :style="{ transitionDelay: gi * 60 + si * 30 + 'ms' }"
          @mouseenter="hover = gi"
        />
        <text :x="pad.l + gi * groupW + groupW / 2" :y="height - 8" text-anchor="middle" class="axis" :class="{ on: hover === gi }">{{ l }}</text>
      </g>
    </svg>
    <Transition name="tip">
      <div
        v-if="hover > -1"
        class="tip"
        :style="{ left: Math.min(width - 190, Math.max(0, pad.l + hover * groupW + groupW / 2 - 90)) + 'px' }"
      >
        <strong>{{ labels[hover] }}</strong>
        <div v-for="s in series" :key="s.name" class="tip-row">
          <i :style="{ background: s.color }"></i>{{ s.name }}
          <b>{{ rupiah(s.values[hover]) }}</b>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.chart {
  position: relative;
  width: 100%;
}
svg {
  display: block;
  overflow: visible;
}
.axis {
  fill: var(--muted);
  font-size: 11.5px;
  transition: fill 0.2s;
}
.axis.on {
  fill: var(--text);
  font-weight: 600;
}
.bar-rect {
  transform-box: fill-box;
  transform-origin: bottom;
  transform: scaleY(0);
  transition: transform 0.8s var(--ease);
  pointer-events: none;
}
.bar-rect.in {
  transform: scaleY(1);
}
.tip {
  position: absolute;
  top: 0;
  width: 180px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--surface);
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  pointer-events: none;
  font-size: 12.5px;
  z-index: 2;
}
.tip-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
  color: var(--muted);
  flex-wrap: wrap;
}
.tip-row i {
  width: 8px;
  height: 8px;
  border-radius: 3px;
}
.tip-row b {
  margin-left: auto;
  color: var(--text);
}
.tip-enter-active,
.tip-leave-active {
  transition: opacity 0.15s;
}
.tip-enter-from,
.tip-leave-to {
  opacity: 0;
}
</style>
