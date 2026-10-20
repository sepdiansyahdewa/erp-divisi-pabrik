<script setup>
import { computed, ref, watch } from 'vue'
import Icon from './Icon.vue'

const props = defineProps({
  columns: { type: Array, required: true }, // {key,label,align,sortable,sortValue}
  rows: { type: Array, required: true },
  pageSize: { type: Number, default: 8 },
  emptyText: { type: String, default: 'Belum ada data' },
})

const sortKey = ref(null)
const sortDir = ref('asc')
const page = ref(1)

function sortBy(c) {
  if (c.sortable === false) return
  if (sortKey.value === c.key) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  else {
    sortKey.value = c.key
    sortDir.value = 'asc'
  }
}

const sorted = computed(() => {
  if (!sortKey.value) return props.rows
  const col = props.columns.find((c) => c.key === sortKey.value)
  const get = (r) => (col?.sortValue ? col.sortValue(r) : r[sortKey.value])
  const dir = sortDir.value === 'asc' ? 1 : -1
  return [...props.rows].sort((a, b) => {
    const x = get(a)
    const y = get(b)
    return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir
  })
})

const pages = computed(() => Math.max(1, Math.ceil(sorted.value.length / props.pageSize)))
watch(
  () => props.rows.length,
  () => {
    if (page.value > pages.value) page.value = pages.value
  },
)
watch(
  () => props.rows,
  () => {},
)
const visible = computed(() => sorted.value.slice((page.value - 1) * props.pageSize, page.value * props.pageSize))
const from = computed(() => (sorted.value.length ? (page.value - 1) * props.pageSize + 1 : 0))
const to = computed(() => Math.min(page.value * props.pageSize, sorted.value.length))
</script>

<template>
  <div>
    <div class="table-wrap">
      <table class="table">
        <thead>
          <tr>
            <th
              v-for="c in columns"
              :key="c.key"
              :class="[c.align, { sortable: c.sortable !== false }]"
              @click="sortBy(c)"
            >
              {{ c.label }}
              <span v-if="sortKey === c.key" style="margin-left: 4px">{{ sortDir === 'asc' ? '↑' : '↓' }}</span>
            </th>
            <th v-if="$slots.actions"></th>
          </tr>
        </thead>
        <tbody :key="page + '-' + sortKey + sortDir">
          <tr v-for="(row, i) in visible" :key="row.id" :style="{ '--i': i }">
            <td v-for="c in columns" :key="c.key" :class="c.align">
              <slot :name="'cell-' + c.key" :row="row" :value="row[c.key]">{{ row[c.key] }}</slot>
            </td>
            <td v-if="$slots.actions" class="actions"><slot name="actions" :row="row" /></td>
          </tr>
        </tbody>
      </table>
      <div v-if="!rows.length" class="empty">
        <Icon name="search" :size="28" />
        <strong>{{ emptyText }}</strong>
        <span>Coba ubah filter atau tambahkan data baru.</span>
      </div>
    </div>
    <div v-if="rows.length > pageSize" class="table-foot">
      <span>Menampilkan {{ from }}–{{ to }} dari {{ sorted.length }}</span>
      <div class="row">
        <button class="icon-btn" :disabled="page === 1" aria-label="Sebelumnya" @click="page--"><Icon name="left" /></button>
        <span>{{ page }} / {{ pages }}</span>
        <button class="icon-btn" :disabled="page === pages" aria-label="Berikutnya" @click="page++"><Icon name="right" /></button>
      </div>
    </div>
  </div>
</template>
