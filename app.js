/* ─────────────────────── Constantes ─────────────────── */
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Paleta de colores para plataformas (cicla si hay más de 6)
const PLAT_COLORS = ['#818cf8','#fbbf24','#34d399','#f472b6','#60a5fa','#a78bfa'];

// Config por defecto (se aplica a usuarios nuevos)
const DEFAULT_CONFIG = {
  platforms: [
    { name: 'Civitatis', rate: 3 },
    { name: 'Viabam',    rate: 2.5 },
    { name: 'Web',       rate: 2 }
  ],
  paymentMethods: ['Efectivo', 'Revolut', 'Sumup']
};

/* ─────────────────────── Estado global ──────────────── */
let db, col, currentUser;
let userConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
let records        = [];
let curYear, curMonth;
let editingId      = null;
let periodoFiltered = [];
let appInited      = false;
let unsubSnapshot  = null;

/* ─────────────────────── Login / Register ───────────── */
function showLoginPanel() {
  document.getElementById('login-panel').style.display    = '';
  document.getElementById('register-panel').style.display = 'none';
  document.getElementById('login-error').textContent      = '';
  setTimeout(() => document.getElementById('login-email').focus(), 100);
}

function showRegisterPanel() {
  document.getElementById('login-panel').style.display    = 'none';
  document.getElementById('register-panel').style.display = '';
  document.getElementById('register-error').textContent   = '';
  setTimeout(() => document.getElementById('reg-email').focus(), 100);
}

async function submitLogin() {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');
  const errEl    = document.getElementById('login-error');

  errEl.textContent = '';
  btn.disabled      = true;
  btn.textContent   = 'Entrando…';

  try {
    await firebase.auth().signInWithEmailAndPassword(email, password);
  } catch (err) {
    const msgs = {
      'auth/invalid-email':      'Email inválido.',
      'auth/user-not-found':     'Usuario no encontrado.',
      'auth/wrong-password':     'Contraseña incorrecta.',
      'auth/invalid-credential': 'Email o contraseña incorrectos.',
      'auth/too-many-requests':  'Demasiados intentos. Intentá más tarde.',
    };
    errEl.textContent = msgs[err.code] || `Error: ${err.code}`;
    btn.disabled    = false;
    btn.textContent = 'Entrar';
  }
}

async function submitRegister() {
  const email    = document.getElementById('reg-email').value.trim().toLowerCase();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  const btn      = document.getElementById('register-btn');
  const errEl    = document.getElementById('register-error');

  errEl.textContent = '';

  if (!email)              { errEl.textContent = 'Ingresá tu email.'; return; }
  if (password.length < 6) { errEl.textContent = 'La contraseña debe tener al menos 6 caracteres.'; return; }
  if (password !== confirm) { errEl.textContent = 'Las contraseñas no coinciden.'; return; }

  btn.disabled    = true;
  btn.textContent = 'Verificando…';

  try {
    // Verificar si el email está aprobado
    const snap = await db.collection('approved_emails').doc(email).get();
    if (!snap.exists) {
      errEl.textContent = 'Tu email no está autorizado. Contactá al administrador.';
      btn.disabled    = false;
      btn.textContent = 'Crear cuenta';
      return;
    }

    btn.textContent = 'Creando cuenta…';
    await firebase.auth().createUserWithEmailAndPassword(email, password);
    // onAuthStateChanged se encarga del resto
  } catch (err) {
    const msgs = {
      'auth/email-already-in-use': 'Ese email ya tiene una cuenta registrada.',
      'auth/invalid-email':        'Email inválido.',
      'auth/weak-password':        'La contraseña es muy débil.',
    };
    errEl.textContent = msgs[err.code] || `Error: ${err.code}`;
    btn.disabled    = false;
    btn.textContent = 'Crear cuenta';
  }
}

function cerrarSesion() {
  if (unsubSnapshot) { unsubSnapshot(); unsubSnapshot = null; }
  records   = [];
  appInited = false;
  firebase.auth().signOut();
}

/* ─────────────────────── Config ─────────────────────── */
async function loadUserConfig() {
  try {
    const doc = await db
      .collection('users').doc(currentUser.uid)
      .collection('config').doc('settings').get();

    if (doc.exists) {
      const data = doc.data();
      userConfig = {
        platforms:      (data.platforms      && data.platforms.length)      ? data.platforms      : DEFAULT_CONFIG.platforms,
        paymentMethods: (data.paymentMethods && data.paymentMethods.length) ? data.paymentMethods : DEFAULT_CONFIG.paymentMethods,
        userName:       data.userName || ''
      };
    } else {
      userConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
      userConfig.userName = '';
      // Guardar config inicial para el usuario nuevo
      await db.collection('users').doc(currentUser.uid)
        .collection('config').doc('settings').set(userConfig);
    }
    updateGreeting(userConfig.userName);
  } catch (e) {
    console.warn('No se pudo cargar la config, usando defaults:', e);
    userConfig = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
  }
}

async function saveConfig() {
  // Leer plataformas del DOM
  const platforms = [];
  document.querySelectorAll('.cfg-platform-row').forEach(row => {
    const name = row.querySelector('.cfg-name').value.trim();
    const rate = parseFloat(row.querySelector('.cfg-rate').value) || 0;
    if (name) platforms.push({ name, rate });
  });

  // Leer medios de pago del DOM
  const paymentMethods = [];
  document.querySelectorAll('.cfg-payment-row').forEach(row => {
    const name = row.querySelector('.cfg-name').value.trim();
    if (name) paymentMethods.push(name);
  });

  if (platforms.length === 0)      { toast('Necesitás al menos una plataforma', 'err'); return; }
  if (paymentMethods.length === 0) { toast('Necesitás al menos un medio de pago', 'err'); return; }

  const userName = document.getElementById('cfg-name').value.trim();

  try {
    userConfig = { platforms, paymentMethods, userName };
    await db.collection('users').doc(currentUser.uid)
      .collection('config').doc('settings').set(userConfig);
    updateGreeting(userName);
    buildForms();
    toast('Configuración guardada');
  } catch (e) {
    console.error(e);
    toast('Error al guardar la configuración', 'err');
  }
}

/* ─────────────────────── Greeting ───────────────────── */
function updateGreeting(name) {
  const el = document.getElementById('header-greeting');
  if (el) el.textContent = name ? `Hola, ${name}` : '';
}

/* ─────────────────────── Config view UI ─────────────── */
function renderConfigView() {
  document.getElementById('cfg-name').value = userConfig.userName || '';

  const platContainer = document.getElementById('cfg-platforms');
  platContainer.innerHTML = '';
  userConfig.platforms.forEach(p => addPlatformRow(p.name, p.rate));

  const payContainer = document.getElementById('cfg-payments');
  payContainer.innerHTML = '';
  userConfig.paymentMethods.forEach(m => addPaymentRow(m));
}

function addPlatformRow(name = '', rate = '') {
  const row = document.createElement('div');
  row.className = 'config-item cfg-platform-row';
  row.innerHTML = `
    <input type="text"   class="cfg-name" placeholder="Ej: GetYourGuide" value="${escHtml(String(name))}">
    <input type="number" class="cfg-rate" placeholder="0" value="${rate}" min="0" step="0.01">
    <button class="btn btn-icon" onclick="this.closest('.cfg-platform-row').remove()" title="Eliminar">×</button>
  `;
  document.getElementById('cfg-platforms').appendChild(row);
}

function addPaymentRow(name = '') {
  const row = document.createElement('div');
  row.className = 'config-item cfg-payment-row';
  row.innerHTML = `
    <input type="text" class="cfg-name" placeholder="Ej: Stripe" value="${escHtml(String(name))}">
    <button class="btn btn-icon" onclick="this.closest('.cfg-payment-row').remove()" title="Eliminar">×</button>
  `;
  document.getElementById('cfg-payments').appendChild(row);
}

/* ─────────────────────── Build dynamic forms ────────── */
function buildForms() {
  buildRegistroForm();
  buildEditModal();
}

function buildRegistroForm() {
  // Campos PAX
  document.getElementById('pax-fields').innerHTML =
    userConfig.platforms.map((p, i) => `
      <div>
        <div class="source-tag">
          <span class="dot" style="background:${PLAT_COLORS[i % PLAT_COLORS.length]}"></span>
          ${escHtml(p.name)} · ×€${p.rate}
        </div>
        <input type="number" id="pax-${i}" min="0" value="0" oninput="calcPreview()">
      </div>
    `).join('');

  // Campos cobros
  document.getElementById('payment-fields').innerHTML =
    userConfig.paymentMethods.map((m, i) => `
      <div>
        <div class="source-tag">${escHtml(m)}</div>
        <input type="number" id="pay-${i}" min="0" step="0.01" value="0" oninput="calcPreview()">
      </div>
    `).join('');

  // Preview: PAX total + una celda por plataforma
  document.getElementById('pv-platforms').innerHTML = `
    <div class="preview-cell">
      <div class="preview-val c-acc" id="pv-pax">0</div>
      <div class="preview-lbl">PAX total</div>
    </div>
    ${userConfig.platforms.map((p, i) => `
      <div class="preview-cell">
        <div class="preview-val" id="pv-plat-${i}" style="color:${PLAT_COLORS[i % PLAT_COLORS.length]}">€0</div>
        <div class="preview-lbl">${escHtml(p.name)}</div>
      </div>
    `).join('')}
  `;

  calcPreview();
}

function buildEditModal() {
  document.getElementById('e-pax-fields').innerHTML =
    userConfig.platforms.map((p, i) => `
      <div>
        <div class="source-tag">
          <span class="dot" style="background:${PLAT_COLORS[i % PLAT_COLORS.length]}"></span>
          ${escHtml(p.name)} · ×€${p.rate}
        </div>
        <input type="number" id="e-pax-${i}" min="0" value="0">
      </div>
    `).join('');

  document.getElementById('e-payment-fields').innerHTML =
    userConfig.paymentMethods.map((m, i) => `
      <div>
        <div class="source-tag">${escHtml(m)}</div>
        <input type="number" id="e-pay-${i}" min="0" step="0.01" value="0">
      </div>
    `).join('');
}

/* ─────────────────────── App init ───────────────────── */
function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-header').style.display   = '';
  document.getElementById('app-main').style.display     = '';
  buildForms();
  init();
}

function init() {
  const now = new Date();
  curYear   = now.getFullYear();
  curMonth  = now.getMonth();

  document.getElementById('fecha').value = toISO(now);

  // Listener en tiempo real — apunta a la subcolección del usuario
  if (unsubSnapshot) unsubSnapshot();
  unsubSnapshot = col.onSnapshot({ includeMetadataChanges: true }, snapshot => {
    records = snapshot.docs.map(doc => doc.data());
    sortRecords();
    renderHistory();
    updateSyncBadge(snapshot.metadata);
  }, err => {
    console.error('Firestore error:', err);
    setSyncBadge('offline', 'Sin conexión');
  });

  db.enablePersistence({ synchronizeTabs: true }).catch(err => {
    if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
      console.warn('enablePersistence:', err.code);
    }
  });

  window.addEventListener('online',  () => setSyncBadge('loading', 'Reconectando…'));
  window.addEventListener('offline', () => setSyncBadge('offline', 'Sin conexión'));
}

/* ─────────────────────── Sync badge ─────────────────── */
function updateSyncBadge(meta) {
  if (meta.hasPendingWrites)   setSyncBadge('pending', 'Guardando…');
  else if (meta.fromCache)     setSyncBadge('offline', 'Sin conexión');
  else                         setSyncBadge('ok', 'Sincronizado');
}

function setSyncBadge(state, label) {
  const el = document.getElementById('sync-status');
  el.className   = `sync-pill sync-${state}`;
  if (window.innerWidth <= 640) {
    const short = { 'Sincronizado':'Sinc.', 'Guardando…':'Guard…', 'Sin conexión':'Offline', 'Conectando…':'···', 'Reconectando…':'···' };
    el.textContent = short[label] || label;
  } else {
    el.textContent = label;
  }
}

/* ─────────────────────── Helpers ────────────────────── */
function toISO(d)    { return d.toISOString().split('T')[0]; }
function fmtDate(iso){ const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}`; }
function euro(v)     { return '€' + Math.abs(v).toFixed(2).replace('.', ','); }
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function escHtml(s)  { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function sortRecords() {
  records.sort((a, b) =>
    a.fecha.localeCompare(b.fecha) || a.horario.localeCompare(b.horario));
}

/* ── Compatibilidad con registros en formato anterior ── */
function getRecordPax(r) {
  if (r.pax) return r.pax;
  return { 'Civitatis': r.civitatis||0, 'Viabam': r.viabam||0, 'Web': r.web||0 };
}

function getRecordFees(r) {
  if (r.fees) return r.fees;
  return { 'Civitatis': r.civitatisFee||0, 'Viabam': r.viabamFee||0, 'Web': r.webFee||0 };
}

function getRecordPayments(r) {
  if (r.payments) return r.payments;
  const p = {};
  if (r.efectivo||0) p['Efectivo'] = r.efectivo;
  if (r.revolut||0)  p['Revolut']  = r.revolut;
  if (r.sumup||0)    p['Sumup']    = r.sumup;
  return p;
}

function getTotalCash(r) {
  if (r.totalCash !== undefined) return r.totalCash;
  return r.efectivo || 0;
}

/* ─────────────────────── Cálculo ────────────────────── */
function compute(paxObj) {
  let totalPax = 0, totalComm = 0;
  const fees = {};
  userConfig.platforms.forEach(p => {
    const pax = paxObj[p.name] || 0;
    const fee = pax * p.rate;
    fees[p.name] = fee;
    totalPax  += pax;
    totalComm += fee;
  });
  return { totalPax, fees, totalComm };
}

/* ─────────────────────── Preview ────────────────────── */
function calcPreview() {
  const paxObj = {};
  userConfig.platforms.forEach((p, i) => {
    paxObj[p.name] = parseInt(document.getElementById(`pax-${i}`)?.value) || 0;
  });

  let cash = 0;
  userConfig.paymentMethods.forEach((m, i) => {
    cash += parseFloat(document.getElementById(`pay-${i}`)?.value) || 0;
  });

  const { totalPax, fees, totalComm } = compute(paxObj);
  const netGain = cash - totalComm;

  setText('pv-pax', totalPax);
  userConfig.platforms.forEach((p, i) => setText(`pv-plat-${i}`, euro(fees[p.name] || 0)));
  setText('pv-comm', euro(totalComm));
  setText('pv-cash', euro(cash));

  const netEl = document.getElementById('pv-net');
  if (netEl) {
    netEl.textContent = euro(netGain);
    netEl.className   = 'total-val ' + (netGain >= 0 ? 'c-ok' : 'c-err');
  }
}

/* ─────────────────────── Guardar registro ───────────── */
async function guardarRegistro() {
  const fecha   = document.getElementById('fecha').value;
  const horario = document.getElementById('horario').value;
  if (!fecha) { toast('Seleccioná una fecha', 'err'); return; }

  const paxObj = {};
  userConfig.platforms.forEach((p, i) => {
    paxObj[p.name] = parseInt(document.getElementById(`pax-${i}`)?.value) || 0;
  });

  const paymentsObj = {};
  let totalCash = 0;
  userConfig.paymentMethods.forEach((m, i) => {
    const v = parseFloat(document.getElementById(`pay-${i}`)?.value) || 0;
    paymentsObj[m] = v;
    totalCash += v;
  });

  const { totalPax, fees, totalComm } = compute(paxObj);
  const netGain = totalCash - totalComm;
  const id      = Date.now();

  const record = {
    id, fecha, horario,
    pax: paxObj, fees, payments: paymentsObj,
    totalPax, totalComm, totalCash, netGain
  };

  try {
    await col.doc(String(id)).set(record);
    toast('Registro guardado');
    resetForm();
  } catch (e) {
    console.error(e);
    toast('Error al guardar', 'err');
  }
}

function resetForm() {
  document.getElementById('fecha').value   = toISO(new Date());
  document.getElementById('horario').value = 'SM 10:30';
  userConfig.platforms.forEach((p, i) => {
    const el = document.getElementById(`pax-${i}`);
    if (el) el.value = 0;
  });
  userConfig.paymentMethods.forEach((m, i) => {
    const el = document.getElementById(`pay-${i}`);
    if (el) el.value = 0;
  });
  calcPreview();
}

/* ─────────────────────── Historial ──────────────────── */
function shiftMonth(delta) {
  curMonth += delta;
  if (curMonth > 11) { curMonth = 0;  curYear++; }
  if (curMonth <  0) { curMonth = 11; curYear--; }
  renderHistory();
}

function renderHistory() {
  setText('month-label', `${MONTHS[curMonth]} ${curYear}`);
  const pfx      = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;
  const filtered = records.filter(r => r.fecha.startsWith(pfx));
  renderSummary(filtered);
  renderTable(filtered);
}

function renderSummary(list) {
  const s = list.reduce((a, r) => {
    a.tours++;
    a.pax  += r.totalPax;
    a.comm += r.totalComm;
    a.cash += getTotalCash(r);
    a.net  += r.netGain;
    return a;
  }, { tours: 0, pax: 0, comm: 0, cash: 0, net: 0 });

  document.getElementById('summary-grid').innerHTML = `
    <div class="sum-card"><div class="sum-val c-acc">${s.tours}</div><div class="sum-lbl">Tours</div></div>
    <div class="sum-card"><div class="sum-val c-acc">${s.pax}</div><div class="sum-lbl">PAX total</div></div>
    <div class="sum-card"><div class="sum-val c-err">${euro(s.comm)}</div><div class="sum-lbl">Comisiones</div></div>
    <div class="sum-card"><div class="sum-val">${euro(s.cash)}</div><div class="sum-lbl">Total cobros</div></div>
    <div class="sum-card"><div class="sum-val ${s.net >= 0 ? 'c-ok' : 'c-err'}">${euro(s.net)}</div><div class="sum-lbl">Ganancia neta</div></div>
  `;
}

function renderTable(list) {
  const tbody = document.getElementById('hist-body');
  const tfoot = document.getElementById('hist-foot');
  const thead = document.getElementById('hist-head');

  const platCols = userConfig.platforms.map(p => `<th>${escHtml(p.name)}</th>`).join('');
  thead.innerHTML = `<tr><th>Fecha</th><th>Horario</th><th>PAX</th>${platCols}<th>Comisiones</th><th>Cobros</th><th>Neta</th><th></th></tr>`;

  const numCols = 4 + userConfig.platforms.length + 3;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${numCols}"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-msg">Sin registros para este mes</div></div></td></tr>`;
    tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = list.map(r => {
    const paxObj      = getRecordPax(r);
    const feesObj     = getRecordFees(r);
    const paymentsObj = getRecordPayments(r);
    const totalCash   = getTotalCash(r);

    const platCells = userConfig.platforms.map((p, i) => `
      <td>
        <span style="color:${PLAT_COLORS[i % PLAT_COLORS.length]}">${paxObj[p.name] || 0}</span>
        <span class="sub"> ${euro(feesObj[p.name] || 0)}</span>
      </td>
    `).join('');

    const payEntries   = Object.entries(paymentsObj).filter(([,v]) => v > 0);
    const payDetails   = payEntries.map(([k,v]) => `${k.slice(0,2)} ${euro(v)}`).join(' · ');
    const hasMultiPay  = payEntries.length > 1;

    return `
      <tr>
        <td>${fmtDate(r.fecha)}</td>
        <td><span class="badge ${r.horario.includes('10') ? 'badge-am' : 'badge-pm'}">${r.horario}</span></td>
        <td><strong>${r.totalPax}</strong></td>
        ${platCells}
        <td class="c-err"><strong>${euro(r.totalComm)}</strong></td>
        <td>
          ${euro(totalCash)}
          ${hasMultiPay ? `<br><span class="sub">${payDetails}</span>` : ''}
        </td>
        <td class="${r.netGain >= 0 ? 'c-ok' : 'c-err'}"><strong>${euro(r.netGain)}</strong></td>
        <td>
          <div class="td-actions">
            <button class="btn btn-ghost btn-sm" onclick="openEdit(${r.id})">Editar</button>
            <button class="btn btn-icon" onclick="deleteRecord(${r.id})" title="Eliminar">×</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  const s = list.reduce((a, r) => {
    a.pax  += r.totalPax;
    a.comm += r.totalComm;
    a.cash += getTotalCash(r);
    a.net  += r.netGain;
    return a;
  }, { pax: 0, comm: 0, cash: 0, net: 0 });

  const emptyPlatCols = userConfig.platforms.map(() => '<td>—</td>').join('');
  tfoot.innerHTML = `
    <tr>
      <td colspan="2">TOTAL MES</td>
      <td>${s.pax}</td>
      ${emptyPlatCols}
      <td class="c-err">${euro(s.comm)}</td>
      <td>${euro(s.cash)}</td>
      <td class="${s.net >= 0 ? 'c-ok' : 'c-err'}">${euro(s.net)}</td>
      <td></td>
    </tr>
  `;
}

/* ─────────────────────── Editar ─────────────────────── */
function openEdit(id) {
  const r = records.find(x => x.id === id);
  if (!r) return;
  editingId = id;

  document.getElementById('e-fecha').value   = r.fecha;
  document.getElementById('e-horario').value = r.horario;

  const paxObj      = getRecordPax(r);
  const paymentsObj = getRecordPayments(r);

  userConfig.platforms.forEach((p, i) => {
    const el = document.getElementById(`e-pax-${i}`);
    if (el) el.value = paxObj[p.name] || 0;
  });
  userConfig.paymentMethods.forEach((m, i) => {
    const el = document.getElementById(`e-pay-${i}`);
    if (el) el.value = paymentsObj[m] || 0;
  });

  document.getElementById('overlay').classList.add('open');
}

async function saveEdit() {
  const fecha   = document.getElementById('e-fecha').value;
  const horario = document.getElementById('e-horario').value;

  const paxObj = {};
  userConfig.platforms.forEach((p, i) => {
    paxObj[p.name] = parseInt(document.getElementById(`e-pax-${i}`)?.value) || 0;
  });

  const paymentsObj = {};
  let totalCash = 0;
  userConfig.paymentMethods.forEach((m, i) => {
    const v = parseFloat(document.getElementById(`e-pay-${i}`)?.value) || 0;
    paymentsObj[m] = v;
    totalCash += v;
  });

  const { totalPax, fees, totalComm } = compute(paxObj);
  const netGain = totalCash - totalComm;

  const updated = {
    id: editingId,
    fecha, horario,
    pax: paxObj, fees, payments: paymentsObj,
    totalPax, totalComm, totalCash, netGain
  };

  try {
    await col.doc(String(editingId)).set(updated);
    closeModal();
    toast('Registro actualizado');
  } catch (e) {
    console.error(e);
    toast('Error al guardar', 'err');
  }
}

function closeModal() {
  document.getElementById('overlay').classList.remove('open');
  editingId = null;
}

function onOverlayClick(e) {
  if (e.target === document.getElementById('overlay')) closeModal();
}

/* ─────────────────────── Eliminar ───────────────────── */
async function deleteRecord(id) {
  if (!confirm('¿Eliminar este registro?')) return;
  try {
    await col.doc(String(id)).delete();
    toast('Registro eliminado', 'warn');
  } catch (e) {
    console.error(e);
    toast('Error al eliminar', 'err');
  }
}

/* ─────────────────────── Modo historial ─────────────── */
function setHistMode(mode) {
  document.querySelectorAll('.hist-tab').forEach(b => b.classList.remove('active'));
  document.querySelector(`.hist-tab[onclick="setHistMode('${mode}')"]`).classList.add('active');
  document.getElementById('hist-mes').style.display     = mode === 'mes'     ? '' : 'none';
  document.getElementById('hist-periodo').style.display = mode === 'periodo' ? '' : 'none';
}

/* ─────────────────────── Período ────────────────────── */
function aplicarFiltro() {
  const desde = document.getElementById('p-desde').value;
  const hasta = document.getElementById('p-hasta').value;
  if (!desde || !hasta)  { toast('Seleccioná ambas fechas', 'warn'); return; }
  if (desde > hasta)     { toast('La fecha inicial debe ser anterior a la final', 'err'); return; }

  periodoFiltered = records.filter(r => r.fecha >= desde && r.fecha <= hasta);
  document.getElementById('periodo-results').style.display = '';
  renderPeriodo(periodoFiltered, desde, hasta);
}

function renderPeriodo(list, desde, hasta) {
  const count = list.length;
  document.getElementById('periodo-info').innerHTML =
    `Período: <strong>${fmtDate(desde)}</strong> → <strong>${fmtDate(hasta)}</strong>
     &nbsp;·&nbsp; <strong>${count}</strong> tour${count !== 1 ? 's' : ''}`;

  // Acumular totales dinámicamente
  const platComm = {};
  userConfig.platforms.forEach(p => platComm[p.name] = 0);
  const payTotals = {};
  userConfig.paymentMethods.forEach(m => payTotals[m] = 0);
  let totalComm = 0, totalCash = 0, netTotal = 0;

  list.forEach(r => {
    const feesObj     = getRecordFees(r);
    const paymentsObj = getRecordPayments(r);
    userConfig.platforms.forEach(p => {
      platComm[p.name] = (platComm[p.name] || 0) + (feesObj[p.name] || 0);
    });
    userConfig.paymentMethods.forEach(m => {
      payTotals[m] = (payTotals[m] || 0) + (paymentsObj[m] || 0);
    });
    totalComm += r.totalComm;
    totalCash += getTotalCash(r);
    netTotal  += r.netGain;
  });

  const platCards = userConfig.platforms.map((p, i) => `
    <div class="breakdown-card">
      <div class="breakdown-val" style="color:${PLAT_COLORS[i % PLAT_COLORS.length]}">${euro(platComm[p.name] || 0)}</div>
      <div class="breakdown-lbl">${escHtml(p.name)}</div>
    </div>
  `).join('');

  const payCards = userConfig.paymentMethods.map(m => `
    <div class="breakdown-card">
      <div class="breakdown-val">${euro(payTotals[m] || 0)}</div>
      <div class="breakdown-lbl">${escHtml(m)}</div>
    </div>
  `).join('');

  document.getElementById('breakdown-grid').innerHTML = `
    ${platCards}
    <div class="breakdown-card" style="border-color:var(--danger);background:rgba(239,68,68,.04)">
      <div class="breakdown-val c-err">${euro(totalComm)}</div>
      <div class="breakdown-lbl">Total comisiones</div>
    </div>
    ${payCards}
    <div class="breakdown-card">
      <div class="breakdown-val">${euro(totalCash)}</div>
      <div class="breakdown-lbl">Total cobros</div>
    </div>
    <div class="breakdown-card">
      <div class="breakdown-val ${netTotal >= 0 ? 'c-ok' : 'c-err'}">${euro(netTotal)}</div>
      <div class="breakdown-lbl">Ganancia neta</div>
    </div>
  `;

  // Tabla del período
  const tbody = document.getElementById('periodo-body');
  const tfoot = document.getElementById('periodo-foot');
  const thead = document.getElementById('periodo-head');

  const platHeaders = userConfig.platforms.map(p => `<th>${escHtml(p.name)}</th>`).join('');
  thead.innerHTML = `<tr><th>Fecha</th><th>Horario</th><th>PAX</th>${platHeaders}<th>Comisiones</th><th>Cobros</th><th>Neta</th></tr>`;

  const numCols = 3 + userConfig.platforms.length + 3;

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${numCols}"><div class="empty-state"><div class="empty-icon">📋</div><div class="empty-msg">Sin registros en este período</div></div></td></tr>`;
    tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = list.map(r => {
    const paxObj      = getRecordPax(r);
    const feesObj     = getRecordFees(r);
    const paymentsObj = getRecordPayments(r);
    const totalCashR  = getTotalCash(r);

    const platCells = userConfig.platforms.map((p, i) => `
      <td>
        <span style="color:${PLAT_COLORS[i % PLAT_COLORS.length]}">${paxObj[p.name] || 0}</span>
        <span class="sub"> ${euro(feesObj[p.name] || 0)}</span>
      </td>
    `).join('');

    const payEntries  = Object.entries(paymentsObj).filter(([,v]) => v > 0);
    const payDetails  = payEntries.map(([k,v]) => `${k.slice(0,2)} ${euro(v)}`).join(' · ');
    const hasMultiPay = payEntries.length > 1;

    return `
      <tr>
        <td>${fmtDate(r.fecha)}</td>
        <td><span class="badge ${r.horario.includes('10') ? 'badge-am' : 'badge-pm'}">${r.horario}</span></td>
        <td><strong>${r.totalPax}</strong></td>
        ${platCells}
        <td class="c-err"><strong>${euro(r.totalComm)}</strong></td>
        <td>
          ${euro(totalCashR)}
          ${hasMultiPay ? `<br><span class="sub">${payDetails}</span>` : ''}
        </td>
        <td class="${r.netGain >= 0 ? 'c-ok' : 'c-err'}"><strong>${euro(r.netGain)}</strong></td>
      </tr>
    `;
  }).join('');

  const emptyPlatCols = userConfig.platforms.map(() => '<td>—</td>').join('');
  tfoot.innerHTML = `
    <tr>
      <td colspan="2">TOTAL PERÍODO</td>
      <td>—</td>
      ${emptyPlatCols}
      <td class="c-err">${euro(totalComm)}</td>
      <td>${euro(totalCash)}</td>
      <td class="${netTotal >= 0 ? 'c-ok' : 'c-err'}">${euro(netTotal)}</td>
    </tr>
  `;
}

/* ─────────────────────── CSV Export ─────────────────── */
function exportCSV() {
  const pfx      = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`;
  const filtered = records.filter(r => r.fecha.startsWith(pfx));
  if (!filtered.length) { toast('No hay datos este mes', 'warn'); return; }
  _downloadCSV(filtered, `itaka_comisiones_${pfx}.csv`);
  toast('CSV exportado');
}

function exportCSVPeriodo() {
  if (!periodoFiltered.length) { toast('No hay datos en el período', 'warn'); return; }
  const desde = document.getElementById('p-desde').value;
  const hasta = document.getElementById('p-hasta').value;
  _downloadCSV(periodoFiltered, `itaka_periodo_${desde}_${hasta}.csv`);
  toast('CSV exportado');
}

function _downloadCSV(list, filename) {
  const platHeads = userConfig.platforms.flatMap(p => [`${p.name} PAX`, `${p.name} €`]);
  const payHeads  = [...userConfig.paymentMethods, 'Total Cobros'];
  const heads     = ['Fecha','Horario','PAX Total', ...platHeads, 'Total Comisiones', ...payHeads, 'Ganancia Neta'];

  const rows = list.map(r => {
    const paxObj      = getRecordPax(r);
    const feesObj     = getRecordFees(r);
    const paymentsObj = getRecordPayments(r);
    const platCols    = userConfig.platforms.flatMap(p => [paxObj[p.name]||0, (feesObj[p.name]||0).toFixed(2)]);
    const payCols     = [...userConfig.paymentMethods.map(m => (paymentsObj[m]||0).toFixed(2)), getTotalCash(r).toFixed(2)];
    return [r.fecha, r.horario, r.totalPax, ...platCols, r.totalComm.toFixed(2), ...payCols, r.netGain.toFixed(2)];
  });

  const csv  = [heads, ...rows].map(r => r.join(';')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ─────────────────────── Navegación ─────────────────── */
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`view-${name}`).classList.add('active');
  document.querySelector(`.nav-btn[onclick="switchView('${name}')"]`).classList.add('active');
  if (name === 'historial') renderHistory();
  if (name === 'config')    renderConfigView();
}

/* ─────────────────────── Toast ──────────────────────── */
function toast(msg, type = 'ok') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.background =
    type === 'err'  ? 'var(--danger)'  :
    type === 'warn' ? 'var(--warning)' :
    'var(--success)';
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ─────────────────────── Boot ───────────────────────── */
async function initApp() {
  const res    = await fetch('/firebase-config');
  const config = await res.json();
  firebase.initializeApp(config);
  db = firebase.firestore();

  firebase.auth().onAuthStateChanged(async user => {
    document.getElementById('loading-screen').style.display = 'none';
    if (user) {
      if (!appInited) {
        currentUser  = user;
        col          = db.collection('users').doc(user.uid).collection('registros');
        await loadUserConfig();
        appInited    = true;
        showApp();
      }
    } else {
      appInited   = false;
      currentUser = null;
      document.getElementById('login-screen').style.display = '';
      document.getElementById('app-header').style.display   = 'none';
      document.getElementById('app-main').style.display     = 'none';
      showLoginPanel();
    }
  });
}

initApp();
