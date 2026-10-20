<script setup>
import { ref } from 'vue'
import Icon from '../components/Icon.vue'
import { login } from '../auth'
import { store } from '../store'
 
const username = ref('')
const password = ref('')
const show = ref(false)
const error = ref('')
const shake = ref(false)
const loading = ref(false)
 
function submit() {
  error.value = ''
  loading.value = true
  // jeda singkat agar terasa halus dan memperlambat tebak-tebakan
  setTimeout(() => {
    const r = login(username.value, password.value)
    loading.value = false
    if (!r.ok) {
      error.value = r.error
      shake.value = true
      setTimeout(() => (shake.value = false), 450)
    } else location.hash = 'dashboard'
  }, 450)
}
const fill = (u, p) => {
  username.value = u
  password.value = p
}
</script>
 
<template>
  <div class="login">
    <div class="overlay"></div>
 
    <header class="top">
      <img src="/logo-pabrik.png" alt="Logo" class="brand-logo" />
      <span class="divider"></span>
      <div class="brand-name">
        <strong>{{ store.settings.company }}</strong>
        <small>Sistem ERP Divisi Pabrik</small>
      </div>
    </header>
 
    <main class="stage">
      <section class="hero">
        <p class="eyebrow">SISTEM KEUANGAN &amp; INVENTORI</p>
        <h1>Mengelola Data Pabrik <em>Lebih Terukur</em></h1>
        <p class="lead">Catat transaksi, pantau stok, dan susun laporan divisi pabrik dalam satu sistem yang rapi dan mudah dipakai.</p>
        <ul>
          <li><Icon name="check" :size="16" />Dashboard &amp; grafik arus kas</li>
          <li><Icon name="check" :size="16" />Stok dan harga total otomatis</li>
          <li><Icon name="check" :size="16" />Laporan siap ekspor</li>
        </ul>
      </section>
 
      <form class="panel" :class="{ shake }" @submit.prevent="submit">
        <h2>Masuk</h2>
        <p class="sub">Selamat datang di {{ store.settings.company }}.</p>
 
        <div class="field">
          <label for="u">Username</label>
          <input id="u" v-model="username" class="in" autocomplete="username" autofocus placeholder="Username" />
        </div>
        <div class="field">
          <label for="p">Password</label>
          <div class="pw">
            <input id="p" v-model="password" :type="show ? 'text' : 'password'" class="in" autocomplete="current-password" placeholder="••••••••" />
            <button type="button" class="toggle" @click="show = !show">{{ show ? 'Sembunyi' : 'Lihat' }}</button>
          </div>
        </div>
 
        <Transition name="page">
          <div v-if="error" class="err" role="alert"><Icon name="alert" :size="16" />{{ error }}</div>
        </Transition>
 
        <button class="go" :disabled="loading || !username || !password">
          {{ loading ? 'Memeriksa…' : 'MASUK' }}
        </button>
 
        <div class="demo">
          <span>Akun demo:</span>
          <button type="button" class="chip" @click="fill('admin', 'admin123')">Pemilik</button>
          <button type="button" class="chip" @click="fill('kasir', 'kasir123')">Kasir</button>
        </div>
      </form>
    </main>
 
    <footer class="bottom">
      <span class="dot"></span>
      <b>STATUS</b>
      <i></i>
      <span>Sistem siap digunakan</span>
    </footer>
  </div>
</template>
 
<style scoped>
/* Ganti foto latar: simpan file ke public/login-bg.webp */
.login {
  position: relative;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  color: #fff;
  font-family: 'Montserrat', 'Inter', system-ui, sans-serif;
  background: #06190f url('/login-bg.webp') center / cover no-repeat;
  overflow: hidden;
}
.overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse at 80% 20%, rgba(34, 139, 84, 0.28), transparent 55%),
    linear-gradient(90deg, rgba(4, 26, 15, 0.94) 0%, rgba(4, 26, 15, 0.72) 50%, rgba(4, 26, 15, 0.5) 100%);
}
.top,
.stage,
.bottom {
  position: relative;
  z-index: 1;
}
 
/* ---- header ---- */
.top {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 28px clamp(24px, 5vw, 64px) 0;
}
.brand-logo {
  width: 85px;
  height: 75px;
  object-fit: contain;
  filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.45));
}
.divider {
  width: 1px;
  height: 34px;
  background: rgba(255, 255, 255, 0.25);
}
.brand-name strong {
  display: block;
  font-size: 15px;
  letter-spacing: 0.02em;
}
.brand-name small {
  font-size: 10px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: #7fd6a4;
}
 
/* ---- isi ---- */
.stage {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1.25fr) minmax(320px, 400px);
  gap: clamp(32px, 6vw, 96px);
  align-items: center;
  padding: 32px clamp(24px, 5vw, 64px);
}
.eyebrow {
  margin: 0 0 18px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.28em;
  color: #7fd6a4;
}
h1 {
  margin: 0;
  font-family: 'Lora', Georgia, 'Times New Roman', serif;
  font-weight: 500;
  font-size: clamp(38px, 5.4vw, 68px);
  line-height: 1.08;
  letter-spacing: -0.01em;
}
h1 em {
  display: block;
  color: #9fe3bb;
  font-style: italic;
}
.lead {
  max-width: 520px;
  margin: 24px 0 22px;
  font-size: 17px;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.82);
}
ul {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}
li svg {
  color: #7fd6a4;
}
 
/* ---- panel login ---- */
.panel {
  padding: 32px;
  border-radius: 24px;
  background: rgba(8, 30, 19, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.14);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
}
.panel h2 {
  margin: 0;
  font-family: 'Lora', Georgia, serif;
  font-size: 30px;
  font-weight: 500;
}
.sub {
  margin: 6px 0 22px;
  font-size: 13.5px;
  color: rgba(255, 255, 255, 0.65);
}
.field {
  margin-bottom: 16px;
}
.field label {
  display: block;
  margin-bottom: 7px;
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
}
.in {
  width: 100%;
  height: 46px;
  padding: 0 16px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  background: rgba(255, 255, 255, 0.08);
  color: #fff;
  font: inherit;
  font-size: 14.5px;
  outline: none;
  transition: border-color 0.2s, background 0.2s;
}
.in::placeholder {
  color: rgba(255, 255, 255, 0.4);
}
.in:focus {
  border-color: #7fd6a4;
  background: rgba(255, 255, 255, 0.12);
}
.pw {
  position: relative;
}
.pw .in {
  padding-right: 76px;
}
.toggle {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  border: 0;
  background: none;
  color: #9fe3bb;
  font: inherit;
  font-size: 12.5px;
  font-weight: 700;
  cursor: pointer;
}
.err {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  padding: 10px 14px;
  border-radius: 14px;
  font-size: 13px;
  background: rgba(244, 63, 94, 0.18);
  color: #fecdd3;
}
.go {
  width: 100%;
  height: 48px;
  border: 0;
  border-radius: 999px;
  background: #fff;
  color: #0b3a22;
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.16em;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, opacity 0.2s;
}
.go:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(127, 214, 164, 0.35);
}
.go:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.demo {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 18px;
  font-size: 12.5px;
  color: rgba(255, 255, 255, 0.55);
}
.chip {
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  background: transparent;
  color: #fff;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.chip:hover {
  background: rgba(255, 255, 255, 0.12);
}
 
/* ---- footer ---- */
.bottom {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0 clamp(24px, 5vw, 64px);
  padding: 20px 0 26px;
  border-top: 1px solid rgba(255, 255, 255, 0.18);
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}
.bottom b {
  font-size: 11px;
  letter-spacing: 0.16em;
  color: #7fd6a4;
}
.bottom i {
  width: 1px;
  height: 14px;
  background: rgba(255, 255, 255, 0.3);
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 0 4px rgba(74, 222, 128, 0.2);
}
 
.shake {
  animation: shake 0.45s;
}
@keyframes shake {
  20%, 60% { transform: translateX(-7px); }
  40%, 80% { transform: translateX(7px); }
}
 
@media (max-width: 880px) {
  .stage {
    grid-template-columns: 1fr;
    gap: 28px;
  }
  .hero ul {
    display: none;
  }
}
</style>
