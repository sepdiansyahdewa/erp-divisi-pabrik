<script setup>
import { computed, ref } from 'vue'
import BarChart from '../components/BarChart.vue'
import DonutChart from '../components/DonutChart.vue'
import Icon from '../components/Icon.vue'
import { store, lastMonthKeys, monthlyTotals, categoryTotals, toast } from '../store'
import { downloadFile, monthLong, monthShort, rupiah, toCSV } from '../utils'

const range = ref(3)
const keys = computed(() => lastMonthKeys(range.value))
const totals = computed(() => monthlyTotals(keys.value))
const sum = (a) => a.reduce((s, v) => s + v, 0)
const income = computed(() => sum(totals.value.income))
const expense = computed(() => sum(totals.value.expense))
const profit = computed(() => income.value - expense.value)
const margin = computed(() => (income.value ? (profit.value / income.value) * 100 : 0))

const incomeCats = computed(() => categoryTotals('income', keys.value))
const expenseCats = computed(() => categoryTotals('expense', keys.value))
const series = computed(() => [
  { name: 'Pemasukan', color: 'var(--primary)', values: totals.value.income },
  { name: 'Pengeluaran', color: '#f59e0b', values: totals.value.expense },
])

const monthly = computed(() =>
  keys.value.map((k, i) => ({ key: k, income: totals.value.income[i], expense: totals.value.expense[i], net: totals.value.income[i] - totals.value.expense[i] })),
)

function exportCSV() {
  const rows = [['Bulan', 'Pemasukan', 'Pengeluaran', 'Laba Bersih'], ...monthly.value.map((m) => [monthLong(m.key), m.income, m.expense, m.net])]
  downloadFile('laporan-laba-rugi.csv', toCSV(rows))
  toast('Laporan diunduh')
}
</script>

<template>
  <div>
    <div class="page-head">
      <div>
        <h1>Laporan Keuangan</h1>
        <p>Laba rugi dan tren {{ store.settings.company }} per periode.</p>
      </div>
      <div class="row">
        <div class="segmented">
          <button v-for="n in [1, 3, 6]" :key="n" :class="{ active: range === n }" @click="range = n">{{ n === 1 ? 'Bulan ini' : n + ' bulan' }}</button>
        </div>
        <button class="btn" @click="exportCSV"><Icon name="download" :size="16" />Ekspor</button>
      </div>
    </div>

    <div class="grid cols-4" style="margin-bottom: 18px">
      <div class="card hover"><div class="muted">Total pemasukan</div><div class="big num pos">{{ rupiah(income) }}</div></div>
      <div class="card hover"><div class="muted">Total pengeluaran</div><div class="big num neg">{{ rupiah(expense) }}</div></div>
      <div class="card hover"><div class="muted">Laba bersih</div><div class="big num" :class="profit >= 0 ? 'pos' : 'neg'">{{ rupiah(profit) }}</div></div>
      <div class="card hover"><div class="muted">Margin laba</div><div class="big num">{{ margin.toFixed(1).replace('.', ',') }}%</div></div>
    </div>

    <div class="card" style="margin-bottom: 18px">
      <div class="card-head"><div><h3>Tren Bulanan</h3><div class="sub">Pemasukan dan pengeluaran</div></div></div>
      <BarChart :key="range" :labels="keys.map(monthShort)" :series="series" :height="260" />
    </div>

    <div class="grid cols-2" style="margin-bottom: 18px">
      <div class="card">
        <div class="card-head"><h3>Sumber Pemasukan</h3></div>
        <DonutChart :key="'i' + range" :items="incomeCats" />
      </div>
      <div class="card">
        <div class="card-head"><h3>Rincian Pengeluaran</h3></div>
        <DonutChart :key="'e' + range" :items="expenseCats" />
      </div>
    </div>

    <div class="card flush">
      <div class="card-head" style="padding-bottom: 14px"><div><h3>Laporan Laba Rugi</h3><div class="sub">Periode {{ monthLong(keys[0]) }} – {{ monthLong(keys.at(-1)) }}</div></div></div>
      <div class="table-wrap">
        <table class="table">
          <tbody>
            <tr class="group"><td colspan="2"><b>Pendapatan</b></td></tr>
            <tr v-for="c in incomeCats" :key="c.name"><td class="indent">{{ c.name }}</td><td class="right num">{{ rupiah(c.value) }}</td></tr>
            <tr class="sumrow"><td><b>Total pendapatan</b></td><td class="right num"><b>{{ rupiah(income) }}</b></td></tr>
            <tr class="group"><td colspan="2"><b>Beban</b></td></tr>
            <tr v-for="c in expenseCats" :key="c.name"><td class="indent">{{ c.name }}</td><td class="right num">({{ rupiah(c.value) }})</td></tr>
            <tr class="sumrow"><td><b>Total beban</b></td><td class="right num"><b>({{ rupiah(expense) }})</b></td></tr>
            <tr class="final"><td><b>Laba (rugi) bersih</b></td><td class="right num" :class="profit >= 0 ? 'pos' : 'neg'"><b>{{ rupiah(profit) }}</b></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.big {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-top: 2px;
}
.group td {
  background: var(--surface-2);
}
.indent {
  padding-left: 36px !important;
}
.sumrow td {
  background: color-mix(in srgb, var(--surface-2) 50%, transparent);
}
.final td {
  font-size: 16px;
  border-top: 2px solid var(--border);
}
</style>
