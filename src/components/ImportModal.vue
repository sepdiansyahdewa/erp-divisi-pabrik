<script setup>
import { computed, ref, watch } from 'vue'
import Modal from './Modal.vue'
import Icon from './Icon.vue'
import { SCHEMAS, parseTable, commitImport } from '../importer'
import { readXlsx, readCsv, writeXlsx } from '../xlsx'
import { downloadFile } from '../utils'
import { toast } from '../store'

const props = defineProps({
  modelValue: Boolean,
  type: { type: String, default: 'transactions' }, // jenis awal
  lock: { type: Boolean, default: false }, // true = jenis tidak bisa diganti
})
const emit = defineEmits(['update:modelValue'])

const kind = ref(props.type)
const table = ref(null)
const fileName = ref('')
const error = ref('')
const busy = ref(false)
const drag = ref(false)
const input = ref(null)

watch(
  () => props.modelValue,
  (v) => {
    if (v) {
      kind.value = props.type
      reset()
    }
  },
)
function reset() {
  table.value = null
  fileName.value = ''
  error.value = ''
}

const schema = computed(() => SCHEMAS[kind.value])
const result = computed(() => (table.value ? parseTable(kind.value, table.value) : null))
const count = (s) => result.value?.items.filter((i) => i.status === s).length ?? 0
const importable = computed(() => result.value?.items.filter((i) => i.status === 'ok' || i.status === 'warn') ?? [])
const issues = computed(() => result.value?.items.filter((i) => i.status !== 'ok') ?? [])

async function handle(file) {
  if (!file) return
  reset()
  busy.value = true
  try {
    const name = file.name.toLowerCase()
    const buf = await file.arrayBuffer()
    if (name.endsWith('.xlsx')) table.value = await readXlsx(buf)
    else if (name.endsWith('.csv') || name.endsWith('.txt')) table.value = readCsv(new TextDecoder().decode(buf))
    else throw new Error('Format harus .xlsx atau .csv. File .xls lama: buka di Excel lalu Save As .xlsx.')
    fileName.value = file.name
  } catch (e) {
    error.value = e.message || 'File tidak bisa dibaca.'
  } finally {
    busy.value = false
  }
}
const onDrop = (e) => {
  drag.value = false
  handle(e.dataTransfer.files[0])
}
const onPick = (e) => {
  handle(e.target.files[0])
  e.target.value = ''
}

function template() {
  downloadFile(`template-${schema.value.label.toLowerCase()}.xlsx`, writeXlsx(schema.value.sample, schema.value.label), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
}

function submit() {
  const { added, updated } = commitImport(kind.value, importable.value.map((i) => i.item))
  emit('update:modelValue', false)
  toast(`${added} data ditambahkan${updated ? `, ${updated} diperbarui` : ''}`)
}
</script>

<template>
  <Modal :model-value="modelValue" title="Impor dari Excel" width="720px" @update:model-value="emit('update:modelValue', $event)">
    <div class="row wrap" style="margin-bottom: 16px">
      <div v-if="!lock" class="segmented">
        <button v-for="(s, k) in SCHEMAS" :key="k" :class="{ active: kind === k }" @click="kind = k">{{ s.label }}</button>
      </div>
      <strong v-else>Data: {{ schema.label }}</strong>
      <span class="spacer"></span>
      <button class="btn sm" @click="template"><Icon name="download" :size="14" />Unduh template Excel</button>
    </div>

    <div
      class="drop"
      :class="{ drag, done: table }"
      @dragover.prevent="drag = true"
      @dragleave="drag = false"
      @drop.prevent="onDrop"
      @click="input.click()"
    >
      <input ref="input" type="file" accept=".xlsx,.csv,.txt" hidden @change="onPick" />
      <Icon name="upload" :size="28" />
      <template v-if="busy"><strong>Membaca file…</strong></template>
      <template v-else-if="table">
        <strong>{{ fileName }}</strong>
        <span class="muted">{{ table.length }} baris terbaca · klik untuk ganti file</span>
      </template>
      <template v-else>
        <strong>Tarik file Excel ke sini, atau klik untuk memilih</strong>
        <span class="muted">.xlsx atau .csv · kolom: {{ Object.values(schema.columns).map((c) => c.label).join(', ') }}</span>
      </template>
    </div>
    <p class="muted hint">{{ schema.hint }}</p>

    <div v-if="error" class="notice bad" role="alert"><Icon name="alert" :size="16" />{{ error }}</div>

    <template v-if="result">
      <div v-if="result.missing.length" class="notice bad" role="alert">
        <Icon name="alert" :size="16" />
        <span>
          Kolom wajib tidak ditemukan: <b>{{ result.missing.join(', ') }}</b>.
          Pastikan baris judul kolom ada di bagian atas sheet pertama, atau pakai template.
          <template v-if="!lock"> Cek juga jenis data di atas sudah benar.</template>
        </span>
      </div>

      <template v-else>
        <div class="row wrap stats">
          <span class="badge success">{{ count('ok') }} siap</span>
          <span v-if="count('warn')" class="badge warn">{{ count('warn') }} dengan catatan</span>
          <span v-if="count('skip')" class="badge">{{ count('skip') }} dilewati</span>
          <span v-if="count('error')" class="badge danger">{{ count('error') }} error</span>
        </div>

        <div v-if="importable.length" class="preview">
          <table class="table">
            <thead><tr><th v-for="h in schema.previewHead" :key="h">{{ h }}</th></tr></thead>
            <tbody>
              <tr v-for="r in importable.slice(0, 6)" :key="r.line">
                <td v-for="(c, i) in schema.preview(r.item)" :key="i">{{ c }}</td>
              </tr>
            </tbody>
          </table>
          <div v-if="importable.length > 6" class="muted more">+ {{ importable.length - 6 }} baris lainnya</div>
        </div>

        <details v-if="issues.length" class="issues" :open="count('error') > 0">
          <summary>Lihat catatan ({{ issues.length }})</summary>
          <ul>
            <li v-for="i in issues.slice(0, 40)" :key="i.line">
              <span class="badge plain" :class="i.status === 'error' ? 'danger' : i.status === 'warn' ? 'warn' : ''">Baris {{ i.line }}</span>
              {{ i.message }}
            </li>
          </ul>
          <p v-if="issues.length > 40" class="muted">…dan {{ issues.length - 40 }} catatan lain.</p>
        </details>
      </template>
    </template>

    <template #footer>
      <button class="btn" @click="emit('update:modelValue', false)">Batal</button>
      <button class="btn primary" :disabled="!importable.length" @click="submit">
        <Icon name="upload" :size="16" />Impor {{ importable.length || '' }} data
      </button>
    </template>
  </Modal>
</template>

<style scoped>
.drop {
  display: grid;
  justify-items: center;
  gap: 4px;
  padding: 26px 16px;
  text-align: center;
  border: 2px dashed var(--border);
  border-radius: 14px;
  color: var(--muted);
  cursor: pointer;
  transition: all 0.25s var(--ease);
}
.drop strong {
  color: var(--text);
}
.drop:hover,
.drop.drag {
  border-color: var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
  transform: scale(1.01);
}
.drop.done {
  border-style: solid;
  border-color: var(--success);
  background: var(--success-soft);
  color: var(--success);
}
.hint {
  margin: 8px 2px 14px;
  font-size: 12.5px;
}
.notice {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 12px 14px;
  border-radius: 12px;
  margin-bottom: 12px;
  font-size: 13.5px;
}
.notice.bad {
  background: var(--danger-soft);
  color: var(--danger);
}
.stats {
  margin: 14px 0 10px;
}
.preview {
  border: 1px solid var(--border);
  border-radius: 12px;
  overflow: hidden;
}
.preview .table th,
.preview .table td {
  padding: 8px 14px;
  font-size: 13px;
}
.more {
  padding: 8px 14px;
  border-top: 1px solid var(--border);
  font-size: 12.5px;
}
.issues {
  margin-top: 12px;
  font-size: 13px;
}
.issues summary {
  cursor: pointer;
  font-weight: 600;
}
.issues ul {
  list-style: none;
  padding: 0;
  margin: 8px 0 0;
  display: grid;
  gap: 6px;
  max-height: 160px;
  overflow: auto;
}
</style>
