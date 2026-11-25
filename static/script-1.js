// ============ STATE ============
const state = {
  user: null,
  sessionStart: null,
  sessionTimerId: null,
  // Mini calendar: which month is currently being displayed.
  // Initialized to the real current date so the calendar follows the months as they pass.
  calMonth: new Date().getMonth(),   // 0-indexed current month
  calYear: new Date().getFullYear(),
  // Currently selected day (highlighted in gold). Initialized to today.
  selectedDay: new Date().getDate(),
  selectedMonth: new Date().getMonth(),
  selectedYear: new Date().getFullYear(),
  // Reservations keyed by "YYYY-MM-DD-HH". Value: { room, who, color }.
  // This lets reservations persist while the user navigates between weeks.
  reservations: {},
  mineOnly: false,
  editingBooking: null,
  // Salas cadastradas pelo diretor: { id, type, capacity, hours }
  rooms: [],
};

// ============ ROUTING ============
function go(screenName) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + screenName);
  if (el) {
    el.classList.add('active');
    window.scrollTo(0, 0);
  }
}

// Navigation history stack for the back button
const navHistory = [];

function goBack() {
  // Pop the previous screen from the history; fall back to home
  const previous = navHistory.pop();
  const target = !state.user && ['dashboard','director'].includes(previous) ? 'home' : (previous || 'home');
  // Switch screen directly without re-recording history
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById('screen-' + target);
  if (el) {
    el.classList.add('active');
    window.scrollTo(0, 0);
  }
}

// Wrap go() so each navigation pushes the *current* screen onto the history,
// except when we are already on that same screen (avoids duplicates).
const _go = go;
go = function(screen) {
  const current = document.querySelector('.screen.active');
  if (current) {
    const currentId = current.id.replace('screen-', '');
    if (currentId !== screen) {
      navHistory.push(currentId);
      // Keep history bounded
      if (navHistory.length > 20) navHistory.shift();
    }
  }
  _go(screen);
};

function requireAuth() {
  if (state.user) {
    go(isDirector(state.user.type) ? 'director' : 'dashboard');
  } else {
    go('login');
  }
}

// ============ API BACKEND (Flask) ============
const API_BASE = new URL('api/', document.baseURI).href.replace(/\/$/, '');

async function apiRequest(endpoint, method = 'GET', payload = null) {
  const options = {
    method,
    credentials: 'same-origin',
    headers: { 'Accept': 'application/json' }
  };
  if (payload !== null) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(payload);
  }

  const response = await fetch(`${API_BASE}/${endpoint}`, options);
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('O servidor retornou uma resposta inválida.');
  }

  if (!response.ok || data.ok === false) {
    throw new Error(data.erro || 'Não foi possível concluir a operação.');
  }
  return data;
}

const apiGet = endpoint => apiRequest(endpoint, 'GET');
const apiPost = (endpoint, payload) => apiRequest(endpoint, 'POST', payload);

// ============ AUTH HANDLERS ============
async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('login-email').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;

  try {
    const response = await apiPost('login', { email, senha: password });
    const user = response.usuario;
    await loginUser(user.nome, user.email, user.tipo);
    toast('Bem-vindo de volta, ' + user.nome.split(' ')[0] + '!');
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
  } catch (error) {
    toast(error.message || 'Erro de conexão com o servidor.');
  }
}

// ============ PASSWORD STRENGTH ============
// Regras obrigatórias: mínimo 6 caracteres, 1 letra maiúscula e 1 caractere especial.
function getPasswordIssues(pwd) {
  const issues = [];
  if (pwd.length < 6) issues.push('mínimo de 6 caracteres');
  if (!/[A-Z]/.test(pwd)) issues.push('1 letra maiúscula');
  if (!/[^A-Za-z0-9]/.test(pwd)) issues.push('1 caractere especial');
  return issues;
}

function getPasswordStrengthLabel(pwd) {
  if (!pwd) return null;
  const hasUpper = /[A-Z]/.test(pwd);
  const hasLower = /[a-z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = /[^A-Za-z0-9]/.test(pwd);
  const longEnough = pwd.length >= 6;
  const veryLong = pwd.length >= 10;

  if (!longEnough || !hasUpper || !hasSpecial) {
    return { level: 'weak', text: 'Senha fraca — precisa de 6+ caracteres, 1 maiúscula e 1 caractere especial' };
  }
  if (veryLong && hasLower && hasNumber) {
    return { level: 'strong', text: 'Senha forte' };
  }
  return { level: 'medium', text: 'Senha média — adicione números, letras minúsculas ou mais caracteres para deixá-la forte' };
}

function updatePasswordStrength() {
  const pwd = document.getElementById('reg-pass').value;
  const msgEl = document.getElementById('pwd-strength-msg');
  if (!msgEl) return;
  msgEl.classList.remove('weak', 'medium', 'strong');
  const result = getPasswordStrengthLabel(pwd);
  if (!result) {
    msgEl.textContent = '';
    return;
  }
  msgEl.classList.add(result.level);
  msgEl.textContent = result.text;
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim().toLowerCase();
  const type = document.getElementById('reg-type').value;
  const p1 = document.getElementById('reg-pass').value;
  const p2 = document.getElementById('reg-pass2').value;

  if (!type) {
    toast('Selecione o tipo de usuário.');
    return;
  }
  if (p1 !== p2) {
    toast('As senhas não coincidem.');
    return;
  }
  const issues = getPasswordIssues(p1);
  if (issues.length > 0) {
    toast('A senha precisa ter ' + issues.join(', ') + '.');
    return;
  }

  try {
    await apiPost('registrar', {
      nome: name,
      email: email,
      tipo: type,
      senha: p1
    });

    toast('Cadastro criado! Agora faça login.');
    document.getElementById('reg-name').value = '';
    document.getElementById('reg-email').value = '';
    document.getElementById('reg-type').value = '';
    document.getElementById('reg-pass').value = '';
    document.getElementById('reg-pass2').value = '';
    updatePasswordStrength();

    setTimeout(() => {
      go('login');
      document.getElementById('login-email').value = email;
      document.getElementById('login-password').focus();
    }, 800);
  } catch (error) {
    toast(error.message || 'Erro de conexão com o servidor.');
  }
}

function handleForgot(e) {
  e.preventDefault();
  toast('A recuperação de senha ainda não está disponível no servidor.');
}

function handleVerifyCode(e) {
  e.preventDefault();
  toast('A verificação de código ainda não está disponível no servidor.');
}

function resendCode() {
  toast('O reenvio de código ainda não está disponível no servidor.');
}



async function loginUser(name, email, type) {
  await refreshData();
  state.user = { name, email, type: type || '' };
  setMineFilter(false);
  state.sessionStart = new Date();
  startSessionTimer();
  updateUserChip();
  if (isDirector(type)) {
    renderRooms();
    go('director');
  } else {
    go('dashboard');
  }
}

function isDirector(type) {
  return typeof type === 'string' && type.toLowerCase().indexOf('diretor') !== -1;
}

// ============ ROOMS (director) ============


// Períodos usados para resumir os horários selecionados de cada sala
const SCHEDULE_PERIODS = [
  { label: 'Manhã', hours: [7, 8, 9, 10, 11, 12] },
  { label: 'Tarde', hours: [13, 14, 15, 16, 17, 18] },
  { label: 'Noite', hours: [19, 20, 21, 22, 23] },
];

function formatRoomHours(hours) {
  const set = new Set(hours);
  const periods = SCHEDULE_PERIODS.filter(p => p.hours.some(h => set.has(h))).map(p => p.label);
  const count = hours.length;
  return `${count} horário${count === 1 ? '' : 's'}/semana disponíve${count === 1 ? 'l' : 'is'} (${periods.join(', ')})`;
}

async function handleAddRoom(e) {
  e.preventDefault();
  const type = document.getElementById('room-type').value.trim();
  const capacity = parseInt(document.getElementById('room-capacity').value, 10);

  const checkedHours = document.querySelectorAll('#room-hours input[type="checkbox"]:checked');
  const hours = Array.from(checkedHours).map(cb => parseInt(cb.value, 10));

  if (!type || !capacity) {
    toast('Preencha todos os campos da sala.');
    return;
  }
  if (hours.length === 0) {
    toast('Selecione ao menos um horário para a sala.');
    return;
  }

  try { await apiPost('rooms', {type, capacity, hours}); await refreshData(); } catch (error) { toast(error.message); return; }

  document.getElementById('room-type').value = '';
  document.getElementById('room-capacity').value = '';
  toast('Sala cadastrada com sucesso! ✨');
}

async function removeRoom(id) {
  if (!confirm('Remover esta sala?')) return;
  try { await apiRequest('rooms/' + id, 'DELETE'); await refreshData(); } catch (error) { toast(error.message); return; }
  toast('Sala removida.');
}

function openRoomHoursModal(id) {
  const room = state.rooms.find(r => r.id === id);
  if (!room) return;
  document.getElementById('edit-room-id').value = id;
  document.getElementById('edit-room-name').textContent = room.type;
  const hoursSet = new Set(room.hours || []);
  document.querySelectorAll('#edit-room-hours input[type="checkbox"]').forEach(cb => {
    cb.checked = hoursSet.has(parseInt(cb.value, 10));
  });
  document.getElementById('room-hours-modal').classList.add('active');
}

function closeRoomHoursModal() {
  document.getElementById('room-hours-modal').classList.remove('active');
}

async function saveRoomHours(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById('edit-room-id').value, 10);
  const room = state.rooms.find(r => r.id === id);
  if (!room) return;

  const checkedHours = document.querySelectorAll('#edit-room-hours input[type="checkbox"]:checked');
  const hours = Array.from(checkedHours).map(cb => parseInt(cb.value, 10));

  if (hours.length === 0) {
    toast('Selecione ao menos um horário para a sala.');
    return;
  }

  try { await apiRequest('rooms/' + id, 'PATCH', {hours}); await refreshData(); } catch (error) { toast(error.message); return; }
  closeRoomHoursModal();
  toast('Horários atualizados! ✨');
}

function renderRooms() {
  const list = document.getElementById('rooms-list');
  const count = document.getElementById('rooms-count');
  if (!list) return;
  if (count) count.textContent = state.rooms.length;

  if (state.rooms.length === 0) {
    list.innerHTML = '<p class="rooms-empty" id="rooms-empty">Nenhuma sala cadastrada ainda.</p>';
    return;
  }

  list.innerHTML = state.rooms.map(r => `
    <div class="room-item">
      <div class="room-item-info">
        <div class="room-item-name">${escapeHtml(r.type)}</div>
        <div class="room-item-meta">Capacidade: ${r.capacity} pessoas</div>
        <div class="room-item-meta">${formatRoomHours(r.hours || [])}</div>
      </div>
      ${r.manageable ? `<div style="display:flex;gap:0.5rem;align-items:center;">
        <button class="btn btn-ghost" type="button" style="padding:0.4rem 0.8rem;font-size:0.85rem;" onclick="openRoomHoursModal(${r.id})">Editar horários</button>
        <button class="room-delete" type="button" onclick="removeRoom(${r.id})" aria-label="Remover sala">×</button>
      </div>` : ''}
    </div>
  `).join('');
}

async function logout() {
  try { await apiPost('logout', {}); } catch (error) { toast(error.message); return; }
  state.rooms = []; state.reservations = {}; state.editingBooking = null; navHistory.length = 0;
  state.user = null;
  state.sessionStart = null;
  if (state.sessionTimerId) clearInterval(state.sessionTimerId);
  closeSettings();
  toast('Você saiu da conta.');
  go('home');
}

function updateUserChip() {
  if (!state.user) return;
  const firstName = state.user.name.split(' ')[0];
  const initial = state.user.name.charAt(0).toUpperCase();
  const setText = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  setText('user-chip-name', firstName);
  setText('user-avatar-letter', initial);
  setText('dash-user-name', firstName);
  setText('dir-chip-name', firstName);
  setText('dir-avatar-letter', initial);
  setText('settings-name', state.user.name);
  setText('settings-email', state.user.email);
  setText('settings-avatar', initial);
}

// ============ SESSION TIMER ============
function startSessionTimer() {
  document.getElementById('session-start').textContent = formatStart(state.sessionStart);
  if (state.sessionTimerId) clearInterval(state.sessionTimerId);
  state.sessionTimerId = setInterval(updateSessionTime, 1000);
  updateSessionTime();
}

function updateSessionTime() {
  if (!state.sessionStart) return;
  const diff = Math.floor((Date.now() - state.sessionStart.getTime()) / 1000);
  const h = String(Math.floor(diff / 3600)).padStart(2, '0');
  const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
  const s = String(diff % 60).padStart(2, '0');
  document.getElementById('session-time').textContent = `${h}:${m}:${s}`;
}

function formatStart(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())} — ${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()}`;
}

// ============ SETTINGS MODAL ============
function openSettings() {
  document.getElementById('settings-modal').classList.add('active');
}
function closeSettings() {
  document.getElementById('settings-modal').classList.remove('active');
}

// ============ RESERVATION MODAL ============
function ownsBooking(booking) {
  return Boolean(state.user && booking && booking.mine);
}
function setMineFilter(enabled) {
  state.mineOnly = enabled;
  document.getElementById('mine-filter').setAttribute('aria-pressed', String(enabled));
  renderMiniCal();
  renderMainCalendar();
}
function removeBookingSlots(booking) {
  for (const [key, value] of Object.entries(state.reservations)) {
    if (value === booking) delete state.reservations[key];
  }
}
function openBookingMenu(booking) {
  if (!ownsBooking(booking)) return;
  state.editingBooking = booking;
  const menu = document.getElementById('booking-menu');
  document.getElementById('booking-summary').textContent = booking.room + ' · ' + booking.date.split('-').reverse().join('/');
  document.getElementById('booking-edit').onclick = () => {
    menu.close();
    openReserveModal(booking);
  };
  menu.showModal();
}
async function deleteBooking() {
  const booking = state.editingBooking;
  if (!ownsBooking(booking) || !confirm('Excluir esta reserva e todos os horários selecionados?')) return;
  document.getElementById("booking-menu").close();
  try { await apiRequest('bookings/' + booking.id, 'DELETE'); await refreshData(); } catch (error) { toast(error.message); return; }
  closeReserveModal();
  renderMainCalendar();
  renderMiniCal();
  toast('Reserva excluída.');
}
function openReserveModal(booking = null) {
  if (!state.user || isDirector(state.user.type) || (booking && !ownsBooking(booking))) return;
  if (state.rooms.length === 0) {
    toast('Nenhuma sala cadastrada ainda. Peça ao diretor para cadastrar uma sala.');
    return;
  }
  const modal = document.getElementById('reserve-modal');
  state.editingBooking = booking;
  modal.querySelector('form').reset();
  populateRoomSelect();
  modal.querySelector('.modal-title').textContent = booking ? 'Editar reserva' : 'Nova reserva';
  modal.querySelector('[type="submit"]').textContent = booking ? 'Salvar alterações' : 'Confirmar reserva';
  if (booking) {
    document.getElementById('res-room').value = booking.roomId;
    document.getElementById('res-day').value = booking.date;
    document.getElementById('res-notes').value = booking.notes;
    modal.querySelectorAll('#res-hours input').forEach(cb => {
      cb.checked = booking.hours.includes(Number(cb.value));
    });
    filterReserveHours();
  }
  document.getElementById('reserve-modal').classList.add('active');
}
function closeReserveModal() {
  document.getElementById('reserve-modal').classList.remove('active');
}

// Fills the room <select> with the rooms registered by the director
function populateRoomSelect() {
  const select = document.getElementById('res-room');
  const current = select.value;
  select.innerHTML = '<option value="">Selecione uma sala</option>' +
    state.rooms.map(r => `<option value="${r.id}">${escapeHtml(r.type)} (até ${r.capacity} pessoas)</option>`).join('');
  // Keep the previous selection if that room still exists
  if (current && state.rooms.some(r => String(r.id) === current)) {
    select.value = current;
  } else if (state.rooms.length === 1) {
    // Only one room registered — select it automatically so the hour
    // filter (filterReserveHours) is applied right away, instead of
    // showing every hour until the teacher manually touches the dropdown.
    select.value = String(state.rooms[0].id);
  }
  filterReserveHours();
}

// Shows only the hour checkboxes that the selected room is available for
function filterReserveHours() {
  const roomId = document.getElementById('res-room').value;
  const room = state.rooms.find(r => String(r.id) === roomId);
  const available = room ? new Set(room.hours || []) : null;

  document.querySelectorAll('#res-hours .hour-check').forEach(label => {
    const cb = label.querySelector('input[type="checkbox"]');
    if (!cb) return;
    const hour = parseInt(cb.value, 10);
    const isAvailable = !available || available.has(hour);
    label.style.display = isAvailable ? '' : 'none';
    if (!isAvailable) cb.checked = false;
  });

  // Hide period labels whose hours are all unavailable
  document.querySelectorAll('#res-hours .hour-period-label').forEach(label => {
    let sib = label.nextElementSibling;
    let anyVisible = false;
    while (sib && sib.classList.contains('hour-check')) {
      if (sib.style.display !== 'none') anyVisible = true;
      sib = sib.nextElementSibling;
    }
    label.style.display = anyVisible ? '' : 'none';
  });
}

// Cycle through color variants so consecutive reservations look distinct
const eventColors = ['', 'amber', 'azure', 'crimson'];
let eventColorIndex = 0;

async function handleReserve(e) {
  e.preventDefault();
  const roomId = document.getElementById('res-room').value;
  const room = state.rooms.find(r => String(r.id) === roomId);
  const dateVal = document.getElementById('res-day').value; // "YYYY-MM-DD"
  const notes = document.getElementById('res-notes').value.trim();

  // Collect all checked hours
  const checkedBoxes = document.querySelectorAll('#res-hours input[type="checkbox"]:checked');
  const hours = Array.from(checkedBoxes).map(cb => parseInt(cb.value, 10));

  if (!room) {
    toast('Selecione a sala.');
    return;
  }
  if (!dateVal) {
    toast('Selecione o dia.');
    return;
  }
  if (hours.length === 0) {
    toast('Selecione ao menos um horário.');
    return;
  }

  const [y, m, d] = dateVal.split('-').map(Number);
  const resDate = new Date(y, m - 1, d);

  if (isNonSchoolDay(resDate.getFullYear(), resDate.getMonth(), resDate.getDate())) {
    const motivo = getNonSchoolLabel(resDate.getFullYear(), resDate.getMonth(), resDate.getDate());
    toast(`Não é possível reservar em dia não letivo (${motivo}).`);
    return;
  }

  const previous = state.editingBooking;
  if (!state.user || (previous && !ownsBooking(previous))) return;
  try {
    await apiRequest(previous ? 'bookings/' + previous.id : 'bookings', previous ? 'PUT' : 'POST', {roomId: Number(roomId), date: dateVal, hours, notes});
    await refreshData();
  } catch (error) { toast(error.message); return; }

  // Navigate calendar to the reservation's week
  state.selectedDay   = resDate.getDate();
  state.selectedMonth = resDate.getMonth();
  state.selectedYear  = resDate.getFullYear();

  markMiniCalDay(resDate.getFullYear(), resDate.getMonth(), resDate.getDate());
  renderMainCalendar();

  // Reset form
  document.getElementById('res-room').value = '';
  document.getElementById('res-day').value = '';
  document.querySelectorAll('#res-hours input[type="checkbox"]').forEach(cb => cb.checked = false);
  document.querySelectorAll('#res-hours .hour-check, #res-hours .hour-period-label').forEach(el => el.style.display = '');
  document.getElementById('res-notes').value = '';

  closeReserveModal();
  const label = hours.length > 1 ? `${hours.length} horários reservados` : '1 horário reservado';
  if (previous) toast('Reserva atualizada.');
  else toast(`Reserva confirmada! ${label} ✨`);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[c]);
}

function markMiniCalDay(year, month, day) {
  const key = `${year}-${month}`;
  if (!eventDaysByMonth[key]) eventDaysByMonth[key] = new Set();
  eventDaysByMonth[key].add(day);

  // Navigate the mini calendar to the month of the reservation
  state.calMonth = month;
  state.calYear = year;

  // Re-render the mini cal so the dot appears immediately
  renderMiniCal();
}

// ============ THEME ============
function setTheme(theme) {
  document.body.setAttribute('data-theme', theme);
  document.getElementById('theme-light-btn').classList.toggle('active', theme === 'light');
  document.getElementById('theme-dark-btn').classList.toggle('active', theme === 'dark');
}

// ============ TOAST ============
let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

// ============ MINI CALENDAR ============
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Days that already have reserved events in the demo (April 2026 only).
// Updated by markMiniCalDay when the user creates a reservation.
const eventDaysByMonth = {}; // começa vazio: nenhum dia aparece como reservado sem agendamento

// ============ FERIADOS E DIAS NÃO LETIVOS ============
// Formato: 'MM-DD' para feriados fixos, ou 'YYYY-MM-DD' para datas específicas
const FERIADOS_FIXOS = new Set([
  '01-01', // Confraternização Universal
  '04-21', // Tiradentes
  '05-01', // Dia do Trabalho
  '09-07', // Independência
  '10-12', // Nossa Sra. Aparecida
  '11-02', // Finados
  '11-15', // Proclamação da República
  '11-20', // Consciência Negra
  '12-25', // Natal
]);

const FERIADOS_ESPECIFICOS = new Set([
  '2026-03-03', // Carnaval
  '2026-03-04', // Carnaval
  '2026-03-05', // Carnaval
  '2026-04-02', // Paixão de Cristo
  '2026-04-03', // Páscoa
  '2026-05-21', // Corpus Christi
]);

function isNonSchoolDay(year, month, day) {
  const date = new Date(year, month, day);
  const dow = date.getDay();
  if (dow === 0) return true;
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  if (FERIADOS_FIXOS.has(`${mm}-${dd}`)) return true;
  if (FERIADOS_ESPECIFICOS.has(`${year}-${mm}-${dd}`)) return true;
  return false;
}

function getNonSchoolLabel(year, month, day) {
  const date = new Date(year, month, day);
  const dow = date.getDay();
  if (dow === 0) return 'Domingo';
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const dateStr = `${year}-${mm}-${dd}`;
  const labels = {
    '01-01': 'Ano Novo',
    '04-21': 'Tiradentes',
    '05-01': 'Dia do Trabalho',
    '09-07': 'Independência',
    '10-12': 'N. Sra. Aparecida',
    '11-02': 'Finados',
    '11-15': 'Proclamação da República',
    '11-20': 'Consciência Negra',
    '12-25': 'Natal',
    '2026-03-03': 'Carnaval',
    '2026-03-04': 'Carnaval',
    '2026-03-05': 'Carnaval',
    '2026-04-02': 'Paixão de Cristo',
    '2026-04-03': 'Páscoa',
    '2026-05-21': 'Corpus Christi',
  };
  return labels[`${mm}-${dd}`] || labels[dateStr] || 'Feriado';
}

// Get all reservations for a specific day, grouped by hour
function getReservationsForDay(year, month, day) {
  const entries = [];
  state.rooms.forEach(room => {
    HOURS.forEach(h => {
      const k = dateKey(year, month, day, h, room.id);
      const res = state.reservations[k];
      if (res && (!state.mineOnly || ownsBooking(res))) {
        entries.push({
          who: res.who,
          room: res.room,
          hour: h,
        });
      }
    });
  });
  // Sort by hour
  entries.sort((a, b) => a.hour - b.hour);
  return entries;
}

function renderMiniCal() {
  const grid = document.getElementById('mini-cal-grid');
  const label = document.getElementById('mini-cal-label');
  if (!grid || !label) return;

  const year = state.calYear;
  const month = state.calMonth; // 0-indexed
  label.textContent = `${MONTH_NAMES[month]} ${year}`;

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const isSelectedMonth = (year === state.selectedYear && month === state.selectedMonth);

  const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  let html = labels.map(l => `<div class="day-label">${l}</div>`).join('');

  // Leading muted days from the previous month
  for (let i = firstWeekday - 1; i >= 0; i--) {
    html += `<div class="day muted">${daysInPrevMonth - i}</div>`;
  }


  for (let d = 1; d <= daysInMonth; d++) {
    const nonSchool = isNonSchoolDay(year, month, d);
    const reservas = getReservationsForDay(year, month, d);
    const hasEvents = reservas.length > 0;
    const isSelected = isSelectedMonth && d === state.selectedDay;
    let cls = 'day';
    if (nonSchool && !hasEvents) cls += ' blocked';
    if (hasEvents) cls += ' has-events';
    if (isSelected) cls += ' active';

    if (hasEvents) {
      // A reservation always takes priority in the display, even if the
      // day also happens to be a weekend/holiday in the demo data.

      let entriesHtml = '';
      if (nonSchool) {
        entriesHtml += `
          <div class="day-tooltip-entry">
            <span class="day-tooltip-who">🚫 ${getNonSchoolLabel(year, month, d)}</span>
          </div>`;
      }
      // Show up to 4 entries to avoid overflow
      const shown = reservas.slice(0, 4);
      shown.forEach(r => {
        entriesHtml += `
          <div class="day-tooltip-entry">
            <span class="day-tooltip-who">👤 ${escapeHtml(r.who)}</span>
            <span class="day-tooltip-room">🏢 ${escapeHtml(r.room)}</span>
            <span class="day-tooltip-hour">🕐 ${HOUR_LABELS[r.hour] || (pad2(r.hour) + ':00')}</span>
          </div>`;
      });
      if (reservas.length > 4) {
        entriesHtml += `<div class="day-tooltip-entry"><span class="day-tooltip-hour">+${reservas.length - 4} mais reserva(s)…</span></div>`;
      }
      html += `
        <div class="${cls} day-with-tooltip" data-day="${d}">
          ${d}
          <div class="day-tooltip">
            <div class="day-tooltip-title">📅 Reservas do dia ${d}</div>
            ${entriesHtml}
          </div>
        </div>`;
    } else if (nonSchool) {
      const reason = getNonSchoolLabel(year, month, d);
      html += `
        <div class="${cls} day-with-tooltip" data-day="${d}" title="${reason}">
          ${d}
          <div class="day-tooltip">
            <div class="day-tooltip-title">🚫 Dia não letivo</div>
            <div class="day-tooltip-entry">
              <span class="day-tooltip-who">${reason}</span>
            </div>
          </div>
        </div>`;
    } else {
      html += `<div class="${cls}" data-day="${d}">${d}</div>`;
    }
  }

  // Trailing muted days
  const filled = 7 + firstWeekday + daysInMonth;
  const remaining = (Math.ceil(filled / 7) * 7) - filled;
  for (let d = 1; d <= remaining; d++) {
    html += `<div class="day muted">${d}</div>`;
  }

  grid.innerHTML = html;
}

function changeMiniCalMonth(delta) {
  let m = state.calMonth + delta;
  let y = state.calYear;
  if (m < 0) { m = 11; y--; }
  else if (m > 11) { m = 0; y++; }
  state.calMonth = m;
  state.calYear = y;
  renderMiniCal();
}

// Wire up the prev/next buttons (they exist as soon as the script runs,
// since this <script> is at the end of <body>).
const _prevBtn = document.getElementById('mini-cal-prev');
const _nextBtn = document.getElementById('mini-cal-next');
if (_prevBtn) _prevBtn.addEventListener('click', () => changeMiniCalMonth(-1));
if (_nextBtn) _nextBtn.addEventListener('click', () => changeMiniCalMonth(1));

// Clicking a day in the mini calendar selects it: updates state.selectedDay/
// Month/Year and re-renders both the mini calendar (to move the highlight)
// and the main weekly grid (to jump to that day's week).
const _miniCalGrid = document.getElementById('mini-cal-grid');
if (_miniCalGrid) {
  _miniCalGrid.addEventListener('click', e => {
    const dayEl = e.target.closest('[data-day]');
    if (!dayEl || dayEl.classList.contains('muted')) return;
    const day = parseInt(dayEl.getAttribute('data-day'), 10);
    if (!day) return;
    state.selectedDay = day;
    state.selectedMonth = state.calMonth;
    state.selectedYear = state.calYear;
    renderMiniCal();
    renderMainCalendar();
  });
}

// ============ MAIN CALENDAR (week view) ============
// The weekday columns in the main grid, in display order.
const WEEK_DAYS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab'];
const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];

// Real start–end time for each class period (matches the checkboxes in the
// reservation/room-hours forms, e.g. "07:00 – 07:50"). Used to display the
// correct lesson time anywhere we show a reservation's hour.
const HOUR_LABELS = {
  7:  '07:00 – 07:50',
  8:  '07:50 – 08:40',
  9:  '08:40 – 09:30',
  10: '09:50 – 10:40',
  11: '10:40 – 11:30',
  12: '11:30 – 12:20',
  13: '13:00 – 13:50',
  14: '13:50 – 14:40',
  15: '14:40 – 15:30',
  16: '15:50 – 16:40',
  17: '16:40 – 17:30',
  18: '17:30 – 18:20',
  19: '19:00 – 19:45',
  20: '19:45 – 20:30',
  21: '20:30 – 21:30',
  22: '21:30 – 22:15',
  23: '22:15 – 23:00',
};

function pad2(n) { return String(n).padStart(2, '0'); }

function dateKey(year, month, day, hour, roomId) {
  // month is 0-indexed; key uses 1-indexed month for readability
  return `${year}-${pad2(month + 1)}-${pad2(day)}-${pad2(hour)}-${roomId}`;
}

// Returns the Date object for the Monday of the working week containing
// the selected day. If the selected day is Sunday, returns the Monday of
// the previous week (so the "just-ended" Mon–Fri is shown).
function getWeekStart() {
  const d = new Date(state.selectedYear, state.selectedMonth, state.selectedDay);
  const dow = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  return d;
}

// Short weekday names (pt-BR) used in the selected-day badge next to the turno bar.
const WEEKDAY_SHORT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

function updateSelectedDayBadge() {
  const badge = document.getElementById('selected-day-badge');
  if (!badge) return;
  const d = new Date(state.selectedYear, state.selectedMonth, state.selectedDay);
  badge.textContent = `${WEEKDAY_SHORT[d.getDay()]}, ${d.getDate()} de ${MONTH_NAMES[d.getMonth()]}`;
}

function renderMainCalendar() {
  const weekStart = getWeekStart();
  updateSelectedDayBadge();

  // Header "today" highlight — only on the selected day, if it's Mon–Fri
  const selectedDate = new Date(state.selectedYear, state.selectedMonth, state.selectedDay);
  const selectedDow = selectedDate.getDay();
  const selectedKey = (selectedDow >= 1 && selectedDow <= 6) ? WEEK_DAYS[selectedDow - 1] : null;

  WEEK_DAYS.forEach((key, idx) => {
    const head = document.querySelector(`.cal-cell.head[data-day="${key}"]`);
    if (!head) return;
    head.classList.toggle('today', key === selectedKey);
    const dateSpan = head.querySelector('.day-num');
    if (dateSpan) {
      const cellDate = new Date(weekStart);
      cellDate.setDate(cellDate.getDate() + idx);
      dateSpan.textContent = cellDate.getDate();
    }
  });

  // Clear existing events from slots
  document.querySelectorAll('.cal-cell[data-slot] .event').forEach(ev => ev.remove());

  // Re-render reservations that fall in this week
  WEEK_DAYS.forEach((key, idx) => {
    const cellDate = new Date(weekStart);
    cellDate.setDate(cellDate.getDate() + idx);
    HOURS.forEach(h => {
      const slot = document.querySelector(`[data-slot="${key}-${h}"]`);
      if (!slot) return;
      state.rooms.forEach(room => {
        const k = dateKey(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), h, room.id);
        const res = state.reservations[k];
        if (!res || (state.mineOnly && !ownsBooking(res))) return;
        const mine = ownsBooking(res);
        const eventEl = document.createElement(mine ? 'button' : 'div');
        if (mine) {
          eventEl.type = 'button';
          eventEl.title = 'Editar ou excluir reserva';
          eventEl.addEventListener('click', () => openBookingMenu(res));
        }
        eventEl.className = 'event' + (res.color ? ' ' + res.color : '');
        eventEl.innerHTML = `
          <div class="room">${escapeHtml(res.room)}</div>
          <div class="who">${escapeHtml(res.who)}</div>
        `;
        slot.appendChild(eventEl);
      });
    });
  });
}


// ============ CHIPS BEHAVIOR ============
document.querySelectorAll('.chips').forEach(group => {
  group.addEventListener('click', e => {
    if (e.target.classList.contains('chip')) {
      group.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
      e.target.classList.add('active');
    }
  });
});

// View toggle in calendar
document.querySelectorAll('.view-toggle').forEach(group => {
  group.addEventListener('click', e => {
    if (e.target.tagName === 'BUTTON') {
      group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
    }
  });
});

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('active');
  });
});

// ESC closes modals
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
  }
});

// ============ TURNO (shift) SELECTOR ============
const TURNOS = [
  { key: 'manha', label: 'Manhã' },
  { key: 'tarde', label: 'Tarde' },
  { key: 'noite', label: 'Noite' },
];
let turnoIndex = 0;

function renderTurno() {
  const grid = document.getElementById('cal-grid');
  const label = document.getElementById('turno-label');
  if (!grid || !label) return;
  const t = TURNOS[turnoIndex];
  grid.setAttribute('data-turno', t.key);
  label.textContent = t.label;
}

function changeTurno(delta) {
  turnoIndex = (turnoIndex + delta + TURNOS.length) % TURNOS.length;
  renderTurno();
}

const _turnoPrev = document.getElementById('turno-prev');
const _turnoNext = document.getElementById('turno-next');
if (_turnoPrev) _turnoPrev.addEventListener('click', () => changeTurno(-1));
if (_turnoNext) _turnoNext.addEventListener('click', () => changeTurno(1));

// Init
renderMiniCal();
renderMainCalendar();
renderTurno();
async function refreshData() {
  const data = await apiGet('schedule');
  state.rooms = data.rooms;
  state.reservations = {};
  for (const key of Object.keys(eventDaysByMonth)) delete eventDaysByMonth[key];
  for (const b of data.bookings) {
    const [y,m,d] = b.date.split('-').map(Number);
    markMiniCalDay(y,m-1,d);
    for (const h of b.hours) state.reservations[dateKey(y,m-1,d,h,b.roomId)] = b;
  }
  renderRooms(); renderMiniCal(); renderMainCalendar();
}
(async function restoreSession() {
  try { const r = await apiGet('me'); if (r.usuario) await loginUser(r.usuario.nome,r.usuario.email,r.usuario.tipo); }
  catch (error) { console.error('Sessão:', error.message); }
})();
