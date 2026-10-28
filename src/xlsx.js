/*
 * Pembaca/penulis .xlsx minimal tanpa dependency.
 * Membaca: sheet pertama (teks, angka, tanggal, shared/inline string) dan CSV.
 * Menulis: satu sheet, dipakai untuk template impor.
 * Butuh DecompressionStream (Chrome/Edge 80+, Firefox 113+, Safari 16.4+).
 */

const td = new TextDecoder()
const te = new TextEncoder()

/* ---------------- ZIP (baca) ---------------- */
async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

function readZip(buf) {
  const dv = new DataView(buf)
  let eocd = -1
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('File bukan .xlsx yang valid.')
  const count = dv.getUint16(eocd + 10, true)
  let p = dv.getUint32(eocd + 16, true)
  const entries = {}
  for (let i = 0; i < count; i++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break
    const method = dv.getUint16(p + 10, true)
    const csize = dv.getUint32(p + 20, true)
    const nameLen = dv.getUint16(p + 28, true)
    const extraLen = dv.getUint16(p + 30, true)
    const commentLen = dv.getUint16(p + 32, true)
    const off = dv.getUint32(p + 42, true)
    const name = td.decode(new Uint8Array(buf, p + 46, nameLen))
    entries[name] = { method, csize, off }
    p += 46 + nameLen + extraLen + commentLen
  }
  return {
    has: (n) => n in entries,
    async text(name) {
      const e = entries[name]
      if (!e) return null
      const nameLen = dv.getUint16(e.off + 26, true)
      const extraLen = dv.getUint16(e.off + 28, true)
      const start = e.off + 30 + nameLen + extraLen
      const raw = new Uint8Array(buf, start, e.csize)
      return td.decode(e.method === 0 ? raw : await inflateRaw(raw))
    },
  }
}

/* ---------------- XLSX (baca) ---------------- */
const xml = (s) => new DOMParser().parseFromString(s, 'application/xml')
const colIndex = (ref) => {
  let n = 0
  for (const ch of ref.replace(/[0-9]/g, '')) n = n * 26 + ch.charCodeAt(0) - 64
  return n - 1
}
const BUILTIN_DATE_FMT = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 45, 46, 47])

function serialToISO(serial) {
  const d = new Date(Math.round((serial - 25569) * 86400000))
  return d.toISOString().slice(0, 10)
}

export async function readXlsx(arrayBuffer) {
  const zip = readZip(arrayBuffer)
  if (!zip.has('xl/workbook.xml')) throw new Error('File bukan .xlsx yang valid.')

  // sheet pertama
  let sheetPath = 'xl/worksheets/sheet1.xml'
  const wb = xml(await zip.text('xl/workbook.xml'))
  const rels = zip.has('xl/_rels/workbook.xml.rels') ? xml(await zip.text('xl/_rels/workbook.xml.rels')) : null
  const first = wb.getElementsByTagName('sheet')[0]
  const rid = first && (first.getAttribute('r:id') || first.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id'))
  if (rid && rels) {
    for (const r of rels.getElementsByTagName('Relationship')) {
      if (r.getAttribute('Id') === rid) {
        const t = r.getAttribute('Target')
        sheetPath = t.startsWith('/') ? t.slice(1) : 'xl/' + t.replace(/^\.\//, '')
      }
    }
  }
  if (!zip.has(sheetPath)) throw new Error('Sheet pertama tidak ditemukan.')

  // shared strings
  const shared = []
  if (zip.has('xl/sharedStrings.xml')) {
    const ss = xml(await zip.text('xl/sharedStrings.xml'))
    for (const si of ss.getElementsByTagName('si')) {
      shared.push([...si.getElementsByTagName('t')].map((t) => t.textContent).join(''))
    }
  }

  // style -> apakah format tanggal
  const dateStyle = []
  if (zip.has('xl/styles.xml')) {
    const st = xml(await zip.text('xl/styles.xml'))
    const custom = {}
    for (const nf of st.getElementsByTagName('numFmt')) custom[nf.getAttribute('numFmtId')] = nf.getAttribute('formatCode')
    const xfs = st.getElementsByTagName('cellXfs')[0]
    if (xfs) {
      for (const xf of xfs.getElementsByTagName('xf')) {
        const id = Number(xf.getAttribute('numFmtId'))
        const code = (custom[id] || '').replace(/"[^"]*"|\[[^\]]*\]|\\./g, '')
        dateStyle.push(BUILTIN_DATE_FMT.has(id) || (custom[id] && /[dmyh]/i.test(code) && !/[#0]/.test(code)))
      }
    }
  }

  const sheet = xml(await zip.text(sheetPath))
  const rows = []
  for (const row of sheet.getElementsByTagName('row')) {
    const r = Number(row.getAttribute('r')) - 1
    const arr = []
    for (const c of row.getElementsByTagName('c')) {
      const ci = colIndex(c.getAttribute('r'))
      const t = c.getAttribute('t')
      const vEl = c.getElementsByTagName('v')[0]
      let val = vEl ? vEl.textContent : ''
      if (t === 's') val = shared[Number(val)] ?? ''
      else if (t === 'inlineStr') val = [...c.getElementsByTagName('t')].map((x) => x.textContent).join('')
      else if (t === 'b') val = val === '1' ? 'TRUE' : 'FALSE'
      else if (t === 'str' || t === 'e') val = val
      else if (val !== '' && !isNaN(Number(val))) {
        val = Number(val)
        if (dateStyle[Number(c.getAttribute('s') || 0)] && val > 0) val = serialToISO(val)
      }
      arr[ci] = val
    }
    rows[r] = arr
  }
  return Array.from(rows, (r) => (r ? Array.from(r, (v) => v ?? '') : []))
}

/* ---------------- CSV (baca) ---------------- */
export function readCsv(text) {
  text = text.replace(/^﻿/, '')
  const firstLine = text.split(/\r?\n/, 1)[0]
  const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ','
  const rows = []
  let row = []
  let cell = ''
  let q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') (cell += '"'), i++
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === delim) (row.push(cell), (cell = ''))
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) (row.push(cell), rows.push(row))
  return rows
}

/* ---------------- XLSX (tulis) ---------------- */
const crcTable = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (b) => {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = crcTable[(c ^ b[i]) & 255] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function zipStore(files) {
  const parts = []
  const central = []
  let offset = 0
  const u16 = (n) => [n & 255, (n >>> 8) & 255]
  const u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]
  for (const [name, content] of Object.entries(files)) {
    const nameB = te.encode(name)
    const data = te.encode(content)
    const crc = crc32(data)
    const local = new Uint8Array([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(33), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameB.length), ...u16(0), ...nameB])
    parts.push(local, data)
    central.push(new Uint8Array([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(33), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameB.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset), ...nameB]))
    offset += local.length + data.length
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length), ...u32(cdSize), ...u32(offset), ...u16(0)])
  return new Blob([...parts, ...central, end], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const colName = (i) => {
  let s = ''
  for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s
  return s
}

export function writeXlsx(rows, sheetName = 'Data', opts = {}) {
  // opts.center: semua isi kolom rata tengah; opts.money: nomor kolom (mulai 0) berformat Rupiah
  const money = opts.money || []
  const colStyle = (ci) => (money.includes(ci) ? 3 : opts.center ? 2 : 0)
  const width = Math.max(...rows.map((r) => r.length))
  const cols = Array.from({ length: width }, (_, i) => `<col min="${i + 1}" max="${i + 1}" width="22" customWidth="1"${colStyle(i) ? ` style="${colStyle(i)}"` : ''}/>`).join('')
  const body = rows
    .map(
      (r, ri) =>
        `<row r="${ri + 1}">` +
        r
          .map((v, ci) => {
            const ref = colName(ci) + (ri + 1)
            const st = ri === 0 ? 1 : colStyle(ci) // baris judul: tebal + rata tengah
            const s = st ? ` s="${st}"` : ''
            return typeof v === 'number' ? `<c r="${ref}"${s}><v>${v}</v></c>` : `<c r="${ref}"${s} t="inlineStr"><is><t>${esc(v)}</t></is></c>`
          })
          .join('') +
        '</row>',
    )
    .join('')
  const styles =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;Rp &quot;#,##0"/></numFmts>' +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="4">' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>' +
    '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>' +
    '</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>'
  return zipStore({
    '[Content_Types].xml': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>',
    '_rels/.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
    'xl/styles.xml': styles,
    'xl/worksheets/sheet1.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`,
  })
}