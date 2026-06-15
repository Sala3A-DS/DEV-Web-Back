// ============ STATE ============
const state = {
    user: null,
    sessionStart: null,
    sessionTimerId: null,
    users: [], // registered accounts: { name, email, password, type }
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
    // Salas cadastradas pelo diretor: { id, name, type, capacity }
    rooms: [],
  };

  // ============ API (backend PHP/PostgreSQL) ============
  // Caminho dos endpoints PHP.
  // - Se o front e o PHP estão na MESMA pasta servida pelo Apache, deixe 'api/'.
  // - Se o PHP roda em outro endereço, use a URL completa,
  //   ex.: 'http://localhost/yarooms_integrado/api/'.
  const API_BASE = window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'api/';

  async function apiPost(endpoint, dados) {
    const resp = await fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include', // envia/recebe o cookie de sessão
      body: JSON.stringify(dados),
    });
    return resp.json();
  }

  async function apiGet(endpoint) {
    const resp = await fetch(API_BASE + endpoint, { credentials: 'include' });
    return resp.json();
  }

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
    const target = previous || 'home';
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
  
  // ============ AUTH HANDLERS ============
  async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim().toLowerCase();
    const password = document.getElementById('login-password').value;

    try {
      const resp = await apiPost('login', { email: email, senha: password });

      if (!resp.ok) {
        toast(resp.erro || 'Não foi possível entrar.');
        return;
      }

      const u = resp.usuario;
      loginUser(u.nome, u.email, u.tipo);
      toast('Bem-vindo de volta, ' + u.nome.split(' ')[0] + '!');

      // limpa os campos
      document.getElementById('login-email').value = '';
      document.getElementById('login-password').value = '';
    } catch (err) {
      toast('Erro de conexão com o servidor.');
    }
  }
  
  async function handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim().toLowerCase();
    const type = document.getElementById('reg-type').value;
    const p1 = document.getElementById('reg-pass').value;
    const p2 = document.getElementById('reg-pass2').value;

    // Validações no cliente (o servidor revalida tudo de novo)
    if (!type) {
      toast('Selecione o tipo de usuário');
      return;
    }
    if (p1 !== p2) {
      toast('As senhas não coincidem');
      return;
    }
    if (p1.length < 6) {
      toast('A senha precisa ter no mínimo 6 caracteres');
      return;
    }

    try {
      const resp = await apiPost('registrar', {
        nome: name,
        email: email,
        tipo: type,
        senha: p1,
      });

      if (!resp.ok) {
        toast(resp.erro || 'Não foi possível cadastrar.');
        return;
      }

      toast('Cadastro criado! Agora faça login.');

      // limpa os campos do cadastro
      document.getElementById('reg-name').value = '';
      document.getElementById('reg-email').value = '';
      document.getElementById('reg-type').value = '';
      document.getElementById('reg-pass').value = '';
      document.getElementById('reg-pass2').value = '';

      // leva para o login, já preenchendo o e-mail
      setTimeout(() => {
        go('login');
        document.getElementById('login-email').value = email;
        document.getElementById('login-password').focus();
      }, 2000);
    } catch (err) {
      toast('Erro de conexão com o servidor.');
    }
  }
  
  function handleForgot(e) {
    e.preventDefault();
    toast('Link de recuperação enviado!');
    setTimeout(() => go('login'), 1200);
  }
  
  function loginUser(name, email, type) {
    state.user = { name, email, type: type || '' };
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
  let roomIdSeq = 1;
  
  function handleAddRoom(e) {
    e.preventDefault();
    const type = document.getElementById('room-type').value;
    const capacity = parseInt(document.getElementById('room-capacity').value, 10);
  
    if (!type || !capacity) {
      toast('Preencha todos os campos da sala.');
      return;
    }
  
    state.rooms.push({ id: roomIdSeq++, type, capacity });
    renderRooms();
  
    document.getElementById('room-type').value = '';
    document.getElementById('room-capacity').value = '';
    toast('Sala cadastrada com sucesso! ✨');
  }
  
  function removeRoom(id) {
    state.rooms = state.rooms.filter(r => r.id !== id);
    renderRooms();
    toast('Sala removida.');
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
        </div>
        <button class="room-delete" type="button" onclick="removeRoom(${r.id})" aria-label="Remover sala">×</button>
      </div>
    `).join('');
  }
  
  async function logout() {
    try {
      await apiPost('logout', {});
    } catch (err) {
      // sem servidor: ainda assim limpamos o estado local
    }
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
  function openReserveModal() {
    document.getElementById('reserve-modal').classList.add('active');
  }
  function closeReserveModal() {
    document.getElementById('reserve-modal').classList.remove('active');
  }
  
  // Cycle through color variants so consecutive reservations look distinct
  const eventColors = ['', 'amber', 'azure', 'crimson'];
  let eventColorIndex = 0;
  
  function handleReserve(e) {
    e.preventDefault();
    const dateVal = document.getElementById('res-day').value; // "YYYY-MM-DD"
    const notes = document.getElementById('res-notes').value.trim();
  
    // Collect all checked hours
    const checkedBoxes = document.querySelectorAll('#res-hours input[type="checkbox"]:checked');
    const hours = Array.from(checkedBoxes).map(cb => parseInt(cb.value, 10));
  
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
    const who = state.user ? state.user.name.split(' ')[0] : 'Usuário';
    const colorClass = eventColors[eventColorIndex % eventColors.length];
    eventColorIndex++;
  
    let alreadyBooked = [];
    hours.forEach(hour => {
      const k = dateKey(resDate.getFullYear(), resDate.getMonth(), resDate.getDate(), hour);
      if (state.reservations[k]) {
        alreadyBooked.push(hour);
      }
    });
  
    if (alreadyBooked.length > 0) {
      toast('Um ou mais horários já estão reservados!');
      return;
    }
  
    // Save all selected slots with same color (same reservation block)
    hours.forEach(hour => {
      const k = dateKey(resDate.getFullYear(), resDate.getMonth(), resDate.getDate(), hour);
      state.reservations[k] = { who: notes || who, color: colorClass };
    });
  
    // Navigate calendar to the reservation's week
    state.selectedDay   = resDate.getDate();
    state.selectedMonth = resDate.getMonth();
    state.selectedYear  = resDate.getFullYear();
  
    markMiniCalDay(resDate.getFullYear(), resDate.getMonth(), resDate.getDate());
    renderMainCalendar();
  
    // Reset form
    document.getElementById('res-day').value = '';
    document.querySelectorAll('#res-hours input[type="checkbox"]').forEach(cb => cb.checked = false);
    document.getElementById('res-notes').value = '';
  
    closeReserveModal();
    const label = hours.length > 1 ? `${hours.length} horários reservados` : '1 horário reservado';
    toast(`Reserva confirmada! ${label} ✨`);
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
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.cssText = 'position:fixed;bottom:2rem;right:2rem;padding:1rem 1.5rem;background:#1e2d4a;border:1px solid #c9a84c;border-radius:12px;color:#fff;font-size:0.9rem;z-index:99999;box-shadow:0 8px 32px rgba(0,0,0,0.4);';
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s ease';
    setTimeout(() => t.style.opacity = '1', 10);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => t.textContent = '', 300);
    }, 2800);
  }
  
  // ============ MINI CALENDAR ============
  const MONTH_NAMES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];
  
  // Days that already have reserved events in the demo (April 2026 only).
  // Updated by markMiniCalDay when the user creates a reservation.
  const eventDaysByMonth = {
    '2026-3': new Set() // key = `${year}-${month}` (month is 0-indexed)
  };
  
  function renderMiniCal() {
    const grid = document.getElementById('mini-cal-grid');
    const label = document.getElementById('mini-cal-label');
    if (!grid || !label) return;
  
    const year = state.calYear;
    const month = state.calMonth; // 0-indexed
    label.textContent = `${MONTH_NAMES[month]} ${year}`;
  
    // What day of the week does the 1st of this month fall on? (0 = Sunday)
    const firstWeekday = new Date(year, month, 1).getDay();
    // How many days does this month have?
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // How many days does the previous month have? (for the muted leading cells)
    const daysInPrevMonth = new Date(year, month, 0).getDate();
  
    // "Selected" day comes from state, set by clicks on the grid.
    // Only show the gold highlight when the displayed month matches the selected month.
    const isSelectedMonth = (year === state.selectedYear && month === state.selectedMonth);
  
    const labels = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
    let html = labels.map(l => `<div class="day-label">${l}</div>`).join('');
  
    // Leading muted days from the previous month
    for (let i = firstWeekday - 1; i >= 0; i--) {
      html += `<div class="day muted">${daysInPrevMonth - i}</div>`;
    }
  
    // Days of the current month
    const eventsThisMonth = eventDaysByMonth[`${year}-${month}`];
    for (let d = 1; d <= daysInMonth; d++) {
      let cls = 'day';
      if (isSelectedMonth && d === state.selectedDay) cls += ' active';
      if (eventsThisMonth && eventsThisMonth.has(d)) cls += ' has-events';
      html += `<div class="${cls}" data-day="${d}">${d}</div>`;
    }
  
    // Trailing muted days from the next month to fill the grid
    const filled = 7 + firstWeekday + daysInMonth; // header + leading + current
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
  
  // Day selection disabled — calendar is display-only; days are marked automatically on reservation.
  
  // ============ MAIN CALENDAR (week view) ============
  // The weekday columns in the main grid, in display order.
  const WEEK_DAYS = ['seg', 'ter', 'qua', 'qui', 'sex']; // Mon..Fri
  const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23];
  
  function pad2(n) { return String(n).padStart(2, '0'); }
  
  function dateKey(year, month, day, hour) {
    // month is 0-indexed; key uses 1-indexed month for readability
    return `${year}-${pad2(month + 1)}-${pad2(day)}-${pad2(hour)}`;
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
  
  function renderMainCalendar() {
    const weekStart = getWeekStart();
  
    // Header "today" highlight — only on the selected day, if it's Mon–Fri
    const selectedDate = new Date(state.selectedYear, state.selectedMonth, state.selectedDay);
    const selectedDow = selectedDate.getDay();
    const selectedKey = (selectedDow >= 1 && selectedDow <= 5) ? WEEK_DAYS[selectedDow - 1] : null;
  
    WEEK_DAYS.forEach(key => {
      const head = document.querySelector(`.cal-cell.head[data-day="${key}"]`);
      if (!head) return;
      head.classList.toggle('today', key === selectedKey);
    });
  
    // Clear existing events from slots
    document.querySelectorAll('.cal-cell[data-slot] .event').forEach(ev => ev.remove());
  
    // Re-render reservations that fall in this week
    WEEK_DAYS.forEach((key, idx) => {
      const cellDate = new Date(weekStart);
      cellDate.setDate(cellDate.getDate() + idx);
      HOURS.forEach(h => {
        const k = dateKey(cellDate.getFullYear(), cellDate.getMonth(), cellDate.getDate(), h);
        const res = state.reservations[k];
        if (!res) return;
        const slot = document.querySelector(`[data-slot="${key}-${h}"]`);
        if (!slot) return;
        const eventEl = document.createElement('div');
        eventEl.className = 'event' + (res.color ? ' ' + res.color : '');
        eventEl.innerHTML = `
          <div class="who">${escapeHtml(res.who)}</div>
        `;
        slot.appendChild(eventEl);
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

  // Restaura a sessão caso o usuário já esteja logado no servidor.
  // Assim, ao recarregar a página (F5) ele continua dentro do sistema.
  (async function restaurarSessao() {
    try {
      const resp = await apiGet('me');
      if (resp && resp.ok && resp.usuario) {
        const u = resp.usuario;
        loginUser(u.nome, u.email, u.tipo);
      }
    } catch (err) {
      // Sem servidor disponível: segue como visitante (tela inicial).
    }
  })();