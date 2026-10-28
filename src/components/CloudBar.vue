<script setup>
import { computed, onUnmounted, ref, watchEffect } from 'vue'
import { isOwner } from '../auth'
import { sync, legacyBackup, uploadLegacy } from '../sync'
import { toast, askConfirm } from '../store'
import { downloadFile } from '../utils'

// kelas "viewer" di <html> dipakai style.css untuk menyembunyikan tombol ubah/hapus
watchEffect(() => document.documentElement.classList.toggle('viewer', !isOwner.value))
onUnmounted(() => document.documentElement.classList.remove('viewer'))

const busy = ref(false)
const legacyText = computed(() => {
  const l = sync.legacy
  if (!l) return ''
  const names = { products: 'produk', transactions: 'transaksi', contacts: 'kontak', invoices: 'invoice' }
  return Object.entries(l)
    .filter(([, n]) => n)
    .map(([k, n]) => `${n} ${names[k]}`)
    .join(', ')
})

const status = computed(() => {
  if (sync.state === 'saving') return { text: 'Menyimpan…', cls: 'warn' }
  if (sync.state === 'error') return { text: 'Gagal menyimpan, mencoba lagi…', cls: 'danger' }
  if (sync.state === 'loading') return { text: 'Memuat…', cls: 'warn' }
  return { text: 'Tersimpan di cloud', cls: 'success' }
})

function backup() {
  downloadFile('cadangan-data-browser.json', legacyBackup(), 'application/json')
  toast('Cadangan diunduh')
}
async function upload() {
  const ok = await askConfirm({
    title: 'Unggah data lama ke cloud?',
    message: `Data di browser ini (${legacyText.value}) akan dikirim ke cloud dan bisa dibuka dari perangkat lain. Data yang sudah ada di cloud dengan ID yang sama akan diperbarui.`,
    okText: 'Unggah',
    danger: false,
  })
  if (!ok) return
  busy.value = true
  try {
    await uploadLegacy()
    toast('Data berhasil diunggah ke cloud')
  } catch (e) {
    toast(e.message || 'Gagal mengunggah', 'error')
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="cloudbar">
    <div v-if="!isOwner" class="cb-note">
      <b>Mode lihat saja.</b> Hanya Pemilik yang dapat mengubah data. Data diperbarui otomatis tiap 30 detik.
    </div>
    <div v-if="isOwner && sync.legacy" class="cb-legacy">
      <div>
        <b>Ada data lama di browser ini:</b> {{ legacyText }}.
        <span class="muted">Unggah ke cloud agar bisa dibuka dari perangkat lain. Disarankan unduh cadangan dulu.</span>
      </div>
      <div class="cb-actions">
        <button class="btn sm" :disabled="busy" @click="backup">Unduh cadangan</button>
        <button class="btn sm primary" :disabled="busy" @click="upload">{{ busy ? 'Mengunggah…' : 'Unggah ke cloud' }}</button>
      </div>
    </div>
    <div class="cb-status" :title="sync.error">
      <span class="dot" :class="status.cls"></span>{{ status.text }}
    </div>
  </div>
</template>

<style scoped>
.cloudbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}
.cb-note,
.cb-legacy {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
}
.cb-note {
  background: var(--info-soft);
  color: var(--info);
}
.cb-legacy {
  background: var(--warn-soft);
  color: var(--text);
  border: 1px solid var(--warn);
}
.cb-actions {
  display: flex;
  gap: 8px;
}
.cb-status {
  align-self: flex-end;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--muted);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--muted);
}
.dot.success {
  background: var(--success);
}
.dot.warn {
  background: var(--warn);
}
.dot.danger {
  background: var(--danger);
}
</style>
