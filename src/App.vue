<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import Icon from './components/Icon.vue'
import Modal from './components/Modal.vue'
import Dashboard from './views/Dashboard.vue'
import Transactions from './views/Transactions.vue'
import Invoices from './views/Invoices.vue'
import Inventory from './views/Inventory.vue'
import Contacts from './views/Contacts.vue'
import Reports from './views/Reports.vue'
import Settings from './views/Settings.vue'
import Login from './views/Login.vue'
import { user, logout, ROLES } from './auth'
import { store, ui, invoiceStatus } from './store'

const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', view: Dashboard, section: 'Utama' },
  { id: 'transaksi', label: 'Transaksi', icon: 'transactions', view: Transactions, section: 'Keuangan' },
  { id: 'invoice', label: 'Invoice', icon: 'invoice', view: Invoices, section: 'Keuangan' },
  { id: 'laporan', label: 'Laporan', icon: 'reports', view: Reports, section: 'Keuangan', ownerOnly: true },
  { id: 'inventori', label: 'Inventori', icon: 'box', view: Inventory, section: 'Operasional' },
  { id: 'kontak', label: 'Pelanggan & Vendor', icon: 'users', view: Contacts, section: 'Operasional' },
  { id: 'pengaturan', label: 'Pengaturan', icon: 'settings', view: Settings, section: 'Sistem' },
]
const allowed = computed(() => nav.filter((n) => !n.ownerOnly || user.value?.role === 'owner'))
const sections = computed(() => [...new Set(allowed.value.map((n) => n.section))])

const route = ref(location.hash.slice(1) || 'dashboard')
const onHash = () => {
  route.value = location.hash.slice(1) || 'dashboard'
  mobileOpen.value = false
  window.scrollTo({ top: 0 })
}
onMounted(() => addEventListener('hashchange', onHash))
onUnmounted(() => removeEventListener('hashchange', onHash))
const current = computed(() => allowed.value.find((n) => n.id === route.value) || allowed.value[0])
watch(current, (c) => (document.title = `${c.label} · ERP Divisi Pabrik`), { immediate: true })

const collapsed = ref(localStorage.getItem('erp-collapsed') === '1')
watch(collapsed, (v) => localStorage.setItem('erp-collapsed', v ? '1' : '0'))
const mobileOpen = ref(false)

const dark = computed(() => store.settings.theme === 'dark')
function toggleTheme() {
  store.settings.theme = dark.value ? 'light' : 'dark'
}
watch(() => store.settings.theme, (t) => (document.documentElement.dataset.theme = t), { immediate: true })

const overdueCount = computed(() => store.invoices.filter((i) => invoiceStatus(i) === 'overdue').length)
const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
</script>

<template>
  <Login v-if="!user" />
  <div v-else class="shell" :class="{ collapsed, 'mobile-open': mobileOpen }">
    <div class="scrim" @click="mobileOpen = false"></div>

    <aside class="sidebar">
      <div class="brand">
        <img src="/logo-pabrik.png" alt="Logo" class="logo-img" />
        <div class="brand-text">
          <strong>{{ store.settings.company }}</strong>
          <small>ERP Divisi Pabrik</small>
        </div>
      </div>

      <nav>
        <template v-for="s in sections" :key="s">
          <div class="nav-section">{{ s }}</div>
          <a
            v-for="n in allowed.filter((x) => x.section === s)"
            :key="n.id"
            :href="'#' + n.id"
            class="nav-item"
            :class="{ active: current.id === n.id }"
            :title="collapsed ? n.label : ''"
          >
            <Icon :name="n.icon" :size="19" />
            <span class="nav-label">{{ n.label }}</span>
            <span v-if="n.id === 'invoice' && overdueCount" class="count">{{ overdueCount }}</span>
          </a>
        </template>
      </nav>

      <button class="collapse-btn" @click="collapsed = !collapsed">
        <Icon name="collapse" :size="18" style="transition: transform 0.3s" :style="{ transform: collapsed ? 'rotate(180deg)' : '' }" />
        <span class="nav-label">Ciutkan menu</span>
      </button>
    </aside>

    <div class="main">
      <header class="topbar">
        <button class="icon-btn menu-btn" aria-label="Menu" @click="mobileOpen = true"><Icon name="menu" /></button>
        <div>
          <div class="crumb">{{ today }}</div>
        </div>
        <div class="spacer"></div>
        <button class="icon-btn" :aria-label="dark ? 'Mode terang' : 'Mode gelap'" @click="toggleTheme">
          <Icon :name="dark ? 'sun' : 'moon'" />
        </button>
        <a href="#invoice" class="icon-btn bell" aria-label="Invoice jatuh tempo">
          <Icon name="alert" />
          <i v-if="overdueCount"></i>
        </a>
        <div class="me">
          <div class="avatar">{{ user.name.slice(0, 2).toUpperCase() }}</div>
          <div class="me-text"><strong>{{ user.name }}</strong><small>{{ ROLES[user.role] }}</small></div>
          <button class="icon-btn" aria-label="Keluar" title="Keluar" @click="logout"><Icon name="logout" /></button>
        </div>
      </header>

      <main class="content">
        <Transition name="page" mode="out-in">
          <component :is="current.view" :key="current.id" />
        </Transition>
      </main>
    </div>

    <!-- toast -->
    <TransitionGroup name="toast" tag="div" class="toasts">
      <div v-for="t in ui.toasts" :key="t.id" class="toast" :class="t.type">
        <span class="dot"><Icon :name="t.type === 'error' ? 'x' : 'check'" :size="13" /></span>{{ t.message }}
      </div>
    </TransitionGroup>

    <!-- confirm -->
    <Modal :model-value="!!ui.confirm" :title="ui.confirm?.title" width="420px" @update:model-value="ui.confirm?.resolve(false)">
      <p class="muted">{{ ui.confirm?.message }}</p>
      <template #footer>
        <button class="btn" @click="ui.confirm.resolve(false)">Batal</button>
        <button class="btn" :class="ui.confirm?.danger ? 'danger' : 'primary'" @click="ui.confirm.resolve(true)">
          {{ ui.confirm?.okText }}
        </button>
      </template>
    </Modal>
  </div>
</template>

<style scoped>
.shell {
  display: grid;
  grid-template-columns: var(--sidebar-w) minmax(0, 1fr);
  min-height: 100vh;
  transition: grid-template-columns 0.35s var(--ease);
}
.shell.collapsed {
  grid-template-columns: var(--sidebar-w-collapsed) minmax(0, 1fr);
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 18px 14px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  overflow: hidden;
  z-index: 50;
  transition:
    background 0.3s,
    transform 0.35s var(--ease);
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 8px 18px;
}
.logo {
  flex: none;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  color: #fff;
  font-weight: 800;
  font-size: 18px;
  background: linear-gradient(135deg, var(--primary), var(--primary-2));
  box-shadow: 0 8px 18px -6px var(--primary);
}
.brand-text {
  min-width: 0;
  white-space: nowrap;
}
.brand-text strong {
  display: block;
  font-size: 15px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.brand-text small {
  color: var(--muted);
}
nav {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}
.nav-section {
  padding: 16px 12px 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--muted);
  opacity: 0.8;
  white-space: nowrap;
  height: 36px;
  overflow: hidden;
  transition: opacity 0.2s;
}
.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 42px;
  padding: 0 12px;
  margin-bottom: 2px;
  border-radius: 11px;
  color: var(--muted);
  text-decoration: none;
  font-weight: 550;
  white-space: nowrap;
  transition:
    background 0.2s,
    color 0.2s,
    transform 0.2s var(--ease);
}
.nav-item svg {
  flex: none;
}
.nav-item:hover {
  background: var(--surface-2);
  color: var(--text);
  transform: translateX(2px);
}
.nav-item.active {
  background: var(--primary-soft);
  color: var(--primary);
}
.nav-item.active::before {
  content: '';
  position: absolute;
  left: -14px;
  top: 10px;
  bottom: 10px;
  width: 4px;
  border-radius: 0 4px 4px 0;
  background: var(--primary);
}
.count {
  margin-left: auto;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  display: grid;
  place-items: center;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: var(--danger);
}
.collapse-btn {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 40px;
  padding: 0 12px;
  border: none;
  border-radius: 11px;
  background: transparent;
  color: var(--muted);
  white-space: nowrap;
  transition: background 0.2s;
}
.collapse-btn:hover {
  background: var(--surface-2);
  color: var(--text);
}
.collapsed .brand-text,
.collapsed .nav-label,
.collapsed .count {
  opacity: 0;
  width: 0;
  pointer-events: none;
}
.collapsed .nav-section {
  opacity: 0;
}
.brand-text,
.nav-label {
  transition: opacity 0.2s;
}

.main {
  min-width: 0;
}
.topbar {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 8px;
  height: 64px;
  padding: 0 28px;
  background: color-mix(in srgb, var(--bg) 82%, transparent);
  backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
}
.crumb {
  color: var(--muted);
  font-weight: 500;
}
.menu-btn {
  display: none;
}
.bell {
  position: relative;
  text-decoration: none;
}
.bell i {
  position: absolute;
  top: 7px;
  right: 8px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--danger);
  border: 2px solid var(--bg);
}
.me {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 8px;
  padding-left: 14px;
  border-left: 1px solid var(--border);
}
.me-text strong {
  display: block;
  line-height: 1.2;
}
.me-text small {
  color: var(--muted);
}
.content {
  padding: 28px;
  max-width: 1440px;
  margin: 0 auto;
}
.scrim {
  display: none;
}

@media (max-width: 900px) {
  .shell,
  .shell.collapsed {
    grid-template-columns: 1fr;
  }
  .sidebar {
    position: fixed;
    left: 0;
    width: 280px;
    transform: translateX(-100%);
    visibility: hidden;
    transition:
      transform 0.35s var(--ease),
      visibility 0s 0.35s;
  }
  .collapsed .brand-text,
  .collapsed .nav-label,
  .collapsed .count,
  .collapsed .nav-section {
    opacity: 1;
    width: auto;
    pointer-events: auto;
  }
  .mobile-open .sidebar {
    transform: none;
    visibility: visible;
    box-shadow: var(--shadow-lg);
    transition-delay: 0s;
  }
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 45;
    background: rgba(10, 12, 30, 0.5);
    backdrop-filter: blur(3px);
    opacity: 0;
    pointer-events: none;
    display: block;
    transition: opacity 0.3s;
  }
  .mobile-open .scrim {
    opacity: 1;
    pointer-events: auto;
  }
  .collapse-btn {
    display: none;
  }
  .menu-btn {
    display: inline-grid;
  }
  .topbar {
    padding: 0 16px;
  }
  .content {
    padding: 18px 16px 40px;
  }
  .me-text {
    display: none;
  }
  .crumb {
    display: none;
  }
}
.logo-img { width: 100px; height: 100px; border-radius: 35px; object-fit: cover; }
</style>
