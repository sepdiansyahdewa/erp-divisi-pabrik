<script setup>
import { computed, reactive, ref } from 'vue'
import DataTable from '../components/DataTable.vue'
import Modal from '../components/Modal.vue'
import Icon from '../components/Icon.vue'
import ImportModal from '../components/ImportModal.vue'
import { store, save, remove, toast, askConfirm, PRODUCT_CATEGORIES, UNITS, CRO_LEVELS, PKS_LIST } from '../store'
import { rupiah } from '../utils'

const imp = ref(false)
const q = ref('')
const cat = ref('')
const croF = ref('')
const pksF = ref('')
const croF = ref('')
const onlyLow = ref(false)
const isLow = (p) => p.stock <= p.minStock

const rows = computed(() =>
  store.products.filter(
    (p) =>
      (!cat.value || p.category === cat.value) &&
      (!croF.value || p.cro === croF.value) &&
      (!pksF.value || p.pks === pksF.value) &&
      (!onlyLow.value || isLow(p)) &&
      (!q.value || (p.name + p.sku).toLowerCase().includes(q.value.toLowerCase())),
  ),
)
const num = (v) => Number(v) || 0

const stats = computed(() => ({
  sku: store.products.length,
  value: store.products.reduce((s, p) => s + num(p.price), 0),
  total: store.products.reduce((s, p) => s + num(p.stock) * num(p.price), 0),
  low: store.products.filter(isLow).length,
}))

const columns = [
  { key: 'name', label: 'Produk' },
  { key: 'category', label: 'Kategori' },
  { key: 'cro', label: 'CRO', sortValue: (r) => CRO_LEVELS.indexOf(r.cro) },
  { key: 'pks', label: 'PKS' },
  { key: 'stock', label: 'Stok', align: 'center' },
  { key: 'price', label: 'Harga satuan', align: 'center' },
  { key: 'total', label: 'Harga total', align: 'center', sortValue: (r) => r.stock * r.price },
]

const open = ref(false)
const blank = () => ({ sku: '', name: '', category: PRODUCT_CATEGORIES[0], unit: UNITS[0], stock: 0, minStock: 10, cost: 0, price: 0, cro: '', pks: '' })
const form = reactive(blank())
const add = () => {
  Object.assign(form, blank(), { id: undefined })
  open.value = true
}
const edit = (p) => {
  Object.assign(form, p)
  open.value = true
}
function submit() {
  if (!form.name.trim() || !form.sku.trim()) return toast('Nama dan SKU wajib diisi', 'error')
  if (store.products.some((p) => p.sku === form.sku && p.id !== form.id)) return toast('SKU sudah dipakai', 'error')
  const isNew = !form.id
  save('products', { ...form })
  open.value = false
  toast(isNew ? 'Produk ditambahkan' : 'Produk diperbarui')
}
async function del(p) {
  if (await askConfirm({ title: 'Hapus produk?', message: `${p.name} akan dihapus dari inventori.` })) {
    remove('products', p.id)
    toast('Produk dihapus')
  }
}
const adjust = (p, d) => (p.stock = Math.max(0, p.stock + d))
const margin = (p) => (p.price ? ((p.price - p.cost) / p.price) * 100 : 0)
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Inventori</h1>
        <p>Pantau stok, harga, dan margin tiap produk.</p>
      </div>
      <button class="btn" @click="imp = true"><Icon name="upload" :size="16" />Impor Excel</button>
        <button class="btn primary" @click="add"><Icon name="plus" :size="16" />Tambah produk</button>
    </div>

    <div class="grid cols-4" style="margin-bottom: 18px">
      <div class="card hover"><div class="muted">Total SKU</div><div class="big num">{{ stats.sku }}</div></div>
      <div class="card hover"><div class="muted">Nilai stok (HPP)</div><div class="big num">{{ rupiah(stats.value) }}</div></div>
      <div class="card hover"><div class="muted">Total Keseluruhan</div><div class="big num pos">{{ rupiah(stats.total) }}</div></div>
      <div class="card hover"><div class="muted">Stok menipis</div><div class="big num" :class="stats.low ? 'neg' : ''">{{ stats.low }} produk</div></div>
    </div>

    <div class="card flush">
      <div class="row wrap" style="padding: 16px 18px">
        <div class="search"><Icon name="search" :size="16" /><input v-model="q" class="input" placeholder="Cari nama / SKU…" /></div>
        <select v-model="cat" class="select" style="width: 170px">
        <select v-model="croF" class="select"><option value="">Semua CRO</option><option v-for="c in CRO_LEVELS" :key="c" :value="c">{{ c }}</option></select>
        <select v-model="pksF" class="select"><option value="">Semua PKS</option><option v-for="p in PKS_LIST" :key="p" :value="p">{{ p }}</option></select>
          <option value="">Semua kategori</option>
          <option v-for="c in PRODUCT_CATEGORIES" :key="c">{{ c }}</option>
        </select>
        <div class="segmented">
          <button :class="{ active: !onlyLow }" @click="onlyLow = false">Semua</button>
          <button :class="{ active: onlyLow }" @click="onlyLow = true">Menipis</button>
        </div>
      </div>
      <DataTable :columns="columns" :rows="rows" :page-size="8" empty-text="Produk tidak ditemukan">
        <template #cell-name="{ row }">
          <div class="cell-main">
            <div class="avatar"><Icon name="box" :size="17" /></div>
            <div><strong>{{ row.name }}</strong><small>{{ row.sku }}</small></div>
          </div>
        </template>
        <template #cell-category="{ value }"><span class="badge plain">{{ value }}</span></template>
        <template #cell-cro="{ value }"><span v-if="value" class="badge plain">{{ value }}</span><span v-else class="muted">-</span></template>
        <template #cell-pks="{ value }"><span v-if="value" class="badge plain">{{ value }}</span><span v-else class="muted">-</span></template>
        <template #cell-stock="{ row }">
          <div class="row" style="gap: 10px">
            <button class="icon-btn" style="width: 26px; height: 26px; font-size: 17px; line-height: 1" aria-label="Kurangi" @click="adjust(row, -1)">−</button>
            <div style="min-width: 90px; text-align: center">
              <b class="num" :class="{ neg: isLow(row) }">{{ row.stock }} <small class="muted">{{ row.unit || 'pcs' }}</small></b>
              <div class="bar" style="margin-top: 4px; min-width: 60px"><i :class="row.stock <= row.minStock * 0.6 ? 'low' : row.stock <= row.minStock ? 'mid' : ''" :style="{ width: Math.min(100, (row.stock / (row.minStock * 2)) * 100) + '%' }"></i></div>
            </div>
            <button class="icon-btn" style="width: 26px; height: 26px; font-size: 17px; line-height: 1" aria-label="Tambah" @click="adjust(row, 1)">+</button>
          </div>
        </template>
        <template #cell-price="{ value }"><span class="num">{{ rupiah(value) }}</span></template>
        <template #cell-total="{ row }"><b class="num">{{ rupiah(row.stock * row.price) }}</b></template>
        <template #actions="{ row }">
          <button class="icon-btn" aria-label="Edit" @click="edit(row)"><Icon name="edit" :size="16" /></button>
          <button class="icon-btn danger" aria-label="Hapus" @click="del(row)"><Icon name="trash" :size="16" /></button>
        </template>
      </DataTable>
    </div>

    <ImportModal v-model="imp" type="products" lock />

    <Modal v-model="open" :title="form.id ? 'Edit produk' : 'Produk baru'">
      <form id="prod-form" class="form-grid" @submit.prevent="submit">
        <div class="field full"><label>Nama produk</label><input v-model="form.name" class="input" placeholder="Mis. Mouse Wireless" /></div>
        <div class="field"><label>SKU</label><input v-model="form.sku" class="input" placeholder="AKS-004" /></div>
        <div class="field"><label>Kategori</label><select v-model="form.category" class="select"><option v-for="c in PRODUCT_CATEGORIES" :key="c">{{ c }}</option></select></div>
        <div class="field"><label>Stok</label><input v-model.number="form.stock" type="number" min="0" class="input" /></div>
        <div class="field"><label>Satuan</label><select v-model="form.unit" class="select"><option v-for="u in UNITS" :key="u">{{ u }}</option></select></div>
        <div class="field"><label>Nama PKS</label><select v-model="form.pks" class="select"><option value="">— Pilih —</option><option v-for="p in PKS_LIST" :key="p" :value="p">{{ p }}</option></select></div>
        <div class="field"><label>Harga satuan (Rp)</label><input v-model.number="form.price" type="number" min="0" class="input" /></div>
        <div class="field"><label>CRO</label><select v-model="form.cro" class="select"><option value="">— Pilih —</option><option v-for="c in CRO_LEVELS" :key="c" :value="c">{{ c }}</option></select></div>
      </form>
      <template #footer>
        <button class="btn" @click="open = false">Batal</button>
        <button class="btn primary" type="submit" form="prod-form">Simpan</button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.big {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-top: 2px;
}
</style>
