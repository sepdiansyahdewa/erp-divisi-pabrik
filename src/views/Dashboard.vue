<script setup>
import { computed } from 'vue'
import StatCard from '../components/StatCard.vue'
import BarChart from '../components/BarChart.vue'
import DonutChart from '../components/DonutChart.vue'
import Icon from '../components/Icon.vue'
import ImportModal from '../components/ImportModal.vue'
import { ref } from 'vue'
import InvoiceBadge from '../components/InvoiceBadge.vue'
import {
  store,
  balance,
  lastMonthKeys,
  monthlyTotals,
  categoryTotals,
  invoiceTotal,
  invoiceStatus,
  contactName,
} from '../store'
import { fmtDate, monthShort, rupiah } from '../utils'

const keys = lastMonthKeys(6)
const labels = keys.map(monthShort)
const totals = computed(() => monthlyTotals(keys))
const series = computed(() => [
  { name: 'Pemasukan', color: 'var(--primary)', values: totals.value.income },
  { name: 'Pengeluaran', color: '#f59e0b', values: totals.value.expense },
])
const cur = computed(() => ({ inc: totals.value.income.at(-1), exp: totals.value.expense.at(-1) }))
const prev = computed(() => ({ inc: totals.value.income.at(-2), exp: totals.value.expense.at(-2) }))
const pct = (a, b) => (b ? ((a - b) / b) * 100 : null)

const net = computed(() => totals.value.income.map((v, i) => v - totals.value.expense[i]))
const receivable = computed(() =>
  store.invoices.filter((i) => ['sent', 'overdue'].includes(invoiceStatus(i))).reduce((s, i) => s + invoiceTotal(i), 0),
)
const overdue = computed(() => store.invoices.filter((i) => invoiceStatus(i) === 'overdue'))
const expenseCats = computed(() => categoryTotals('expense', [keys.at(-1)]))
const recent = computed(() => store.transactions.slice(0, 6))
const lowStock = computed(() => store.products.filter((p) => p.stock <= p.minStock).sort((a, b) => a.stock / a.minStock - b.stock / b.minStock))
const upcoming = computed(() =>
  store.invoices
    .filter((i) => ['sent', 'overdue'].includes(invoiceStatus(i)))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 5),
)

const imp = ref(false)
const hour = new Date().getHours()
const greet = hour < 11 ? 'Selamat pagi' : hour < 15 ? 'Selamat siang' : hour < 19 ? 'Selamat sore' : 'Selamat malam'
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>{{ greet }} 👋</h1>
        <p>Ringkasan kondisi keuangan {{ store.settings.company }} bulan ini.</p>
      </div>
      <div class="row">
        <button class="btn" @click="imp = true"><Icon name="upload" :size="16" />Impor Excel</button>
        <a href="#transaksi" class="btn"><Icon name="transactions" :size="16" />Transaksi</a>
        <a href="#invoice" class="btn primary"><Icon name="plus" :size="16" />Invoice baru</a>
      </div>
    </div>

    <div class="grid cols-4">
      <StatCard label="Saldo Kas & Bank" :value="balance()" icon="wallet" tone="primary" :spark="net" />
      <StatCard label="Pemasukan Bulan Ini" :value="cur.inc" icon="up" tone="success" :delta="pct(cur.inc, prev.inc)" :spark="totals.income" />
      <StatCard label="Pengeluaran Bulan Ini" :value="cur.exp" icon="down" tone="danger" :delta="pct(cur.exp, prev.exp)" :delta-good-when-up="false" :spark="totals.expense" />
      <StatCard label="Piutang Belum Dibayar" :value="receivable" icon="clock" tone="warn" :spark="[]" />
    </div>

    <div class="grid main-side" style="margin-top: 18px">
      <div class="card">
        <div class="card-head">
          <div>
            <h3>Arus Kas</h3>
            <div class="sub">Pemasukan vs pengeluaran 6 bulan terakhir</div>
          </div>
          <div class="row" style="gap: 14px; font-size: 12.5px">
            <span class="row" style="gap: 6px"><i class="sw" style="background: var(--primary)"></i>Pemasukan</span>
            <span class="row" style="gap: 6px"><i class="sw" style="background: #f59e0b"></i>Pengeluaran</span>
          </div>
        </div>
        <BarChart :labels="labels" :series="series" :height="290" />
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <h3>Pengeluaran per Kategori</h3>
            <div class="sub">Bulan ini</div>
          </div>
        </div>
        <DonutChart v-if="expenseCats.length" :items="expenseCats" />
        <div v-else class="empty">Belum ada pengeluaran bulan ini</div>
      </div>
    </div>

    <div class="grid cols-3" style="margin-top: 18px">
      <div class="card">
        <div class="card-head">
          <h3>Transaksi Terbaru</h3>
          <a href="#transaksi" class="link">Lihat semua</a>
        </div>
        <div v-for="t in recent" :key="t.id" class="list-item">
          <div class="avatar" :class="t.type"><Icon :name="t.type === 'income' ? 'up' : 'down'" :size="16" /></div>
          <div style="min-width: 0; flex: 1">
            <strong style="display: block; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis">{{ t.description }}</strong>
            <small class="muted">{{ t.category }} · {{ fmtDate(t.date) }}</small>
          </div>
          <b class="num" :class="t.type === 'income' ? 'pos' : 'neg'">{{ t.type === 'income' ? '+' : '−' }}{{ rupiah(t.amount) }}</b>
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <h3>Tagihan Mendatang</h3>
            <div class="sub">{{ overdue.length }} invoice lewat jatuh tempo</div>
          </div>
          <a href="#invoice" class="link">Kelola</a>
        </div>
        <div v-for="i in upcoming" :key="i.id" class="list-item">
          <div style="min-width: 0; flex: 1">
            <strong style="display: block; font-weight: 600">{{ contactName(i.contactId) }}</strong>
            <small class="muted">{{ i.number }} · {{ fmtDate(i.dueDate) }}</small>
          </div>
          <div style="text-align: right">
            <b class="num" style="display: block">{{ rupiah(invoiceTotal(i)) }}</b>
            <InvoiceBadge :invoice="i" />
          </div>
        </div>
        <div v-if="!upcoming.length" class="empty">Semua tagihan sudah lunas 🎉</div>
      </div>

      <div class="card">
        <div class="card-head">
          <div>
            <h3>Stok Menipis</h3>
            <div class="sub">{{ lowStock.length }} produk di bawah batas minimum</div>
          </div>
          <a href="#inventori" class="link">Inventori</a>
        </div>
        <div v-for="p in lowStock.slice(0, 5)" :key="p.id" class="list-item">
          <div style="min-width: 0; flex: 1">
            <strong style="display: block; font-weight: 600">{{ p.name }}</strong>
            <small class="muted">{{ p.sku }} · min. {{ p.minStock }}</small>
          </div>
          <div style="width: 90px">
            <div class="bar"><i :class="p.stock / p.minStock < 0.6 ? 'low' : 'mid'" :style="{ width: Math.min(100, (p.stock / p.minStock) * 100) + '%' }"></i></div>
          </div>
          <b class="num" style="width: 30px; text-align: right">{{ p.stock }}</b>
        </div>
        <div v-if="!lowStock.length" class="empty">Stok semua produk aman</div>
      </div>
    </div>
    <ImportModal v-model="imp" type="transactions" />
  </div>
</template>

<style scoped>
.sw {
  width: 9px;
  height: 9px;
  border-radius: 3px;
  display: inline-block;
}
</style>
