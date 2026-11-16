/* ==========================================================================
   SIERRA'S BARBERSHOP — CAMADA DE LÓGICA, REGRAS DE NEGÓCIO E PERSISTÊNCIA
   ========================================================================== */

const STORAGE_KEYS = {
  USERS: 'sierra_users_v1',
  SERVICES: 'sierra_services_v1',
  APPOINTMENTS: 'sierra_appointments_v1',
  SCHEDULE: 'sierra_schedule_v1',
  SESSION: 'sierra_session_v1'
};

let state = {
  currentView: 'client',
  selectedServiceId: null,
  selectedTimeSlot: null,
  authMode: 'login',
  simulatedNow: new Date('2026-11-16T10:00:00')
};

/* --- RNF03: Simulação de Hash Criptográfico (SHA-256 via Web Crypto API) --- */
async function hashPassword(plainText) {
  const encoder = new TextEncoder();
  const data = encoder.encode('sierra_salt_' + plainText);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return '$sha256$' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/* --- SEED INICIAL DO BANCO DE DADOS RELACIONAL SIMULADO (RNF07) --- */
async function initDatabase() {
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    const clientHash = await hashPassword('123456');
    const adminHash = await hashPassword('admin123');
    const defaultUsers = [
      {
        id: 'usr_1',
        name: 'Eduardo Levi Giannicchini Sierra',
        phone: '(11) 98765-4321',
        passwordHash: clientHash,
        role: 'client'
      },
      {
        id: 'usr_admin',
        name: 'Barbeiro Sierra (Admin)',
        phone: '(11) 99999-0000',
        passwordHash: adminHash,
        role: 'admin'
      }
    ];
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(defaultUsers));
  }

  if (!localStorage.getItem(STORAGE_KEYS.SERVICES)) {
    const defaultServices = [
      { id: 'srv_1', name: 'Corte Masculino Clássico', desc: 'Corte na tesoura e máquina com acabamento na navalha e lavagem.', price: 45.00, duration: 30, active: true },
      { id: 'srv_2', name: 'Barba Terapia & Toalha Quente', desc: 'Modelagem de barba com toalha quente, óleo essencial e pós-barba.', price: 35.00, duration: 30, active: true },
      { id: 'srv_3', name: 'Combo Completo (Corte + Barba)', desc: 'Pacote completo de corte degradê ou social + barba terapia.', price: 70.00, duration: 60, active: true },
      { id: 'srv_4', name: 'Pezinho & Sobrancelha', desc: 'Acabamento de contornos e alinhamento de sobrancelha na navalha.', price: 25.00, duration: 20, active: true }
    ];
    localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(defaultServices));
  }

  if (!localStorage.getItem(STORAGE_KEYS.SCHEDULE)) {
    const defaultSchedule = {
      start: '09:00',
      end: '19:00',
      lunchStart: '12:00',
      lunchEnd: '13:00',
      blockedDates: []
    };
    localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(defaultSchedule));
  }

  if (!localStorage.getItem(STORAGE_KEYS.APPOINTMENTS)) {
    const defaultAppointments = [
      {
        id: 'apt_101',
        clientId: 'usr_1',
        clientName: 'Eduardo Levi Giannicchini Sierra',
        clientPhone: '(11) 98765-4321',
        serviceId: 'srv_3',
        serviceName: 'Combo Completo (Corte + Barba)',
        price: 70.00,
        barber: 'Barbeiro Sierra',
        date: '2026-11-16',
        time: '11:00',
        status: 'Confirmado'
      },
      {
        id: 'apt_102',
        clientId: 'usr_1',
        clientName: 'Eduardo Levi Giannicchini Sierra',
        clientPhone: '(11) 98765-4321',
        serviceId: 'srv_1',
        serviceName: 'Corte Masculino Clássico',
        price: 45.00,
        barber: 'Barbeiro Vinicius',
        date: '2026-11-16',
        time: '15:00',
        status: 'Confirmado'
      },
      {
        id: 'apt_103',
        clientId: 'usr_demo_2',
        clientName: 'Vinicius Esdras Lima Silva',
        clientPhone: '(11) 97777-2222',
        serviceId: 'srv_2',
        serviceName: 'Barba Terapia & Toalha Quente',
        price: 35.00,
        barber: 'Barbeiro Sierra',
        date: '2026-11-16',
        time: '14:00',
        status: 'Confirmado'
      }
    ];
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(defaultAppointments));
  }

  if (!localStorage.getItem(STORAGE_KEYS.SESSION)) {
    const users = getUsers();
    localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(users[0]));
  }
}

/* --- GETTERS & SETTERS --- */
const getUsers = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || '[]');
const saveUsers = (list) => localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(list));

const getServices = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.SERVICES) || '[]');
const saveServices = (list) => localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(list));

const getAppointments = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.APPOINTMENTS) || '[]');
const saveAppointments = (list) => localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(list));

const getSchedule = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.SCHEDULE));
const saveSchedule = (cfg) => localStorage.setItem(STORAGE_KEYS.SCHEDULE, JSON.stringify(cfg));

const getCurrentUser = () => JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSION) || 'null');
const setCurrentUser = (user) => localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(user));

/* --- TOAST FEEDBACK --- */
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

/* --- RELÓGIO DO SISTEMA --- */
function updateSimulatedTime(val) {
  if (!val) return;
  state.simulatedNow = new Date(val);
  renderClientAppointments();
  renderTimeSlots();
  showToast('Relógio do sistema atualizado para simulação de regras.', 'info');
}

/* --- NAVEGAÇÃO ENTRE VISÕES --- */
function switchView(view) {
  state.currentView = view;
  document.getElementById('tab-client').classList.toggle('active', view === 'client');
  document.getElementById('tab-admin').classList.toggle('active', view === 'admin');

  document.getElementById('view-client').classList.toggle('hidden', view !== 'client');
  document.getElementById('view-admin').classList.toggle('hidden', view !== 'admin');

  if (view === 'admin') {
    checkAdminAccess();
  } else {
    renderServicesCatalog();
    renderTimeSlots();
    renderClientAppointments();
  }
}

/* --- ATUALIZA CABEÇALHO DE SESSÃO --- */
function updateSessionHeader() {
  const user = getCurrentUser();
  const badge = document.getElementById('user-session-badge');
  if (!user) {
    badge.innerHTML = 'Visitante (Não autenticado)';
  } else {
    const roleLabel = user.role === 'admin' ? 'Admin' : 'Cliente';
    badge.innerHTML = `<strong>${user.name.split(' ')[0]}</strong> (${roleLabel})`;
  }
}

/* --- ACESSO RÁPIDO PARA DEMONSTRAÇÃO --- */
function quickLogin(role) {
  const users = getUsers();
  const target = users.find(u => u.role === role);
  if (target) {
    setCurrentUser(target);
    updateSessionHeader();
    renderAuthProfileCard();
    renderClientAppointments();
    if (role === 'admin') {
      switchView('admin');
    } else {
      switchView('client');
    }
    showToast(`Autenticado como ${target.name}.`, 'success');
  }
}

async function resetDemoDatabase() {
  Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
  await initDatabase();
  state.selectedServiceId = null;
  state.selectedTimeSlot = null;
  renderAll();
  showToast('Banco de dados local restaurado para o estado inicial.', 'info');
}

/* ==========================================================================
   MÓDULO DO CLIENTE (RF01 - RF07)
   ========================================================================== */

/* RF03: Renderiza Catálogo de Serviços Ativos */
function renderServicesCatalog() {
  const container = document.getElementById('services-catalog');
  const services = getServices().filter(s => s.active);

  if (services.length === 0) {
    container.innerHTML = '<p class="card-sub">Nenhum serviço ativo disponível no momento.</p>';
    return;
  }

  container.innerHTML = services.map(srv => `
    <div class="service-item ${state.selectedServiceId === srv.id ? 'selected' : ''}" onclick="selectService('${srv.id}')">
      <div>
        <div class="service-title">${srv.name}</div>
        <div class="service-desc">${srv.desc}</div>
      </div>
      <div class="service-meta">
        <span class="service-price">R$ ${srv.price.toFixed(2).replace('.', ',')}</span>
        <span class="service-duration">${srv.duration} min</span>
      </div>
    </div>
  `).join('');
}

function selectService(serviceId) {
  state.selectedServiceId = serviceId;
  renderServicesCatalog();
  updateBookingSummary();
}

/* RF04 & RN01 & RN03: Grade de Horários em Tempo Real */
function renderTimeSlots() {
  const grid = document.getElementById('time-slots-grid');
  const banner = document.getElementById('day-status-banner');
  const dateVal = document.getElementById('booking-date').value;
  const barber = document.getElementById('barber-select').value;
  const schedule = getSchedule();
  const appointments = getAppointments();

  state.selectedTimeSlot = null;
  updateBookingSummary();

  if (!dateVal) {
    grid.innerHTML = '';
    return;
  }

  // RN03: Verifica se o dia está bloqueado pelo administrador
  if (schedule.blockedDates.includes(dateVal)) {
    banner.textContent = `A barbearia estará fechada nesta data (${formatDateBR(dateVal)}) conforme bloqueio administrativo (RN03).`;
    banner.classList.remove('hidden');
    grid.innerHTML = '';
    return;
  } else {
    banner.classList.add('hidden');
  }

  const slots = generateTimeSlots(schedule.start, schedule.end, schedule.lunchStart, schedule.lunchEnd);

  grid.innerHTML = slots.map(timeStr => {
    // RN01: Verifica conflito para o mesmo barbeiro, data e horário
    const isBooked = appointments.some(a =>
      a.barber === barber &&
      a.date === dateVal &&
      a.time === timeStr &&
      a.status !== 'Cancelado'
    );

    const slotDateTime = new Date(`${dateVal}T${timeStr}:00`);
    const isPast = slotDateTime < state.simulatedNow;
    const disabled = isBooked || isPast;

    let title = 'Horário disponível';
    if (isBooked) title = 'Indisponível: Já reservado para este profissional (RN01)';
    else if (isPast) title = 'Horário já expirado';

    return `
      <button
        type="button"
        class="slot-btn"
        title="${title}"
        ${disabled ? 'disabled' : ''}
        onclick="selectTimeSlot(this, '${timeStr}')"
      >
        ${timeStr}
      </button>
    `;
  }).join('');
}

function generateTimeSlots(start, end, lunchStart, lunchEnd) {
  const slots = [];
  let [h, m] = start.split(':').map(Number);
  const [endH, endM] = end.split(':').map(Number);
  const startMins = h * 60 + m;
  const endMins = endH * 60 + endM;

  const [lStartH, lStartM] = lunchStart.split(':').map(Number);
  const [lEndH, lEndM] = lunchEnd.split(':').map(Number);
  const lunchStartMins = lStartH * 60 + lStartM;
  const lunchEndMins = lEndH * 60 + lEndM;

  for (let mins = startMins; mins < endMins; mins += 30) {
    if (mins >= lunchStartMins && mins < lunchEndMins) continue;
    const hh = String(Math.floor(mins / 60)).padStart(2, '0');
    const mm = String(mins % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

function selectTimeSlot(btn, timeStr) {
  document.querySelectorAll('.slot-btn').forEach(el => el.classList.remove('selected'));
  btn.classList.add('selected');
  state.selectedTimeSlot = timeStr;
  updateBookingSummary();
}

function updateBookingSummary() {
  const textEl = document.getElementById('booking-summary-text');
  const btn = document.getElementById('btn-confirm-booking');
  const service = getServices().find(s => s.id === state.selectedServiceId);
  const barber = document.getElementById('barber-select').value;
  const dateVal = document.getElementById('booking-date').value;

  if (!service || !state.selectedTimeSlot || !dateVal) {
    textEl.innerHTML = 'Selecione um <strong>serviço</strong> e um <strong>horário disponível</strong> acima para continuar.';
    btn.disabled = true;
    return;
  }

  textEl.innerHTML = `
    <strong>Resumo:</strong> ${service.name} com <strong>${barber}</strong> em <strong>${formatDateBR(dateVal)} às ${state.selectedTimeSlot}</strong> — <span class="text-emerald">R$ ${service.price.toFixed(2).replace('.', ',')}</span>
  `;
  btn.disabled = false;
}

/* RF05 & RN01: Confirmação de Agendamento com Verificação Transacional */
function confirmBooking() {
  const user = getCurrentUser();
  if (!user) {
    showToast('Faça login ou cadastre-se na lateral antes de confirmar o agendamento (RF01).', 'error');
    return;
  }

  const service = getServices().find(s => s.id === state.selectedServiceId);
  const barber = document.getElementById('barber-select').value;
  const dateVal = document.getElementById('booking-date').value;
  const timeStr = state.selectedTimeSlot;

  if (!service || !dateVal || !timeStr) return;

  // RN01: Revalidação atômica antes da gravação
  const appointments = getAppointments();
  const conflict = appointments.some(a =>
    a.barber === barber &&
    a.date === dateVal &&
    a.time === timeStr &&
    a.status !== 'Cancelado'
  );

  if (conflict) {
    showToast('Erro RN01: Este horário acabou de ser ocupado. Selecione outro.', 'error');
    renderTimeSlots();
    return;
  }

  const newAppointment = {
    id: 'apt_' + Date.now(),
    clientId: user.id,
    clientName: user.name,
    clientPhone: user.phone,
    serviceId: service.id,
    serviceName: service.name,
    price: service.price,
    barber,
    date: dateVal,
    time: timeStr,
    status: 'Confirmado'
  };

  appointments.push(newAppointment);
  saveAppointments(appointments);

  state.selectedTimeSlot = null;
  renderTimeSlots();
  renderClientAppointments();
  showToast('Agendamento confirmado com sucesso!', 'success');
}

/* RF01 & RF02: Card de Cadastro, Login e Gestão de Perfil */
function renderAuthProfileCard() {
  const card = document.getElementById('auth-profile-card');
  const user = getCurrentUser();

  if (user) {
    card.innerHTML = `
      <div class="card-header">
        <div>
          <h2>Meu Perfil</h2>
          <p class="card-sub">Dados cadastrais ativos</p>
        </div>
        <span class="tag-rf">RF02</span>
      </div>
      <form onsubmit="handleUpdateProfile(event)">
        <div class="form-group">
          <label>Nome Completo</label>
          <input type="text" id="prof-name" value="${user.name}" required />
        </div>
        <div class="form-group">
          <label>Telefone / WhatsApp</label>
          <input type="text" id="prof-phone" value="${user.phone}" required />
        </div>
        <div class="form-group">
          <label>Hash da Senha no Banco (RNF03)</label>
          <input type="text" value="${user.passwordHash}" disabled style="font-size:0.72rem; color:#9ca3af;" />
        </div>
        <div class="crud-actions" style="display:flex; gap:8px; margin-top:10px;">
          <button type="submit" class="btn-primary" style="flex:1;">Salvar Alterações</button>
          <button type="button" class="btn-secondary" onclick="logoutUser()">Sair</button>
        </div>
      </form>
    `;
    return;
  }

  if (state.authMode === 'login') {
    card.innerHTML = `
      <div class="card-header">
        <div>
          <h2>Acessar Conta</h2>
          <p class="card-sub">Entre para gerenciar suas reservas</p>
        </div>
        <span class="tag-rf">RF01</span>
      </div>
      <form onsubmit="handleClientLogin(event)">
        <div class="form-group">
          <label>Telefone / WhatsApp</label>
          <input type="text" id="login-phone" placeholder="(11) 98765-4321" required />
        </div>
        <div class="form-group">
          <label>Senha</label>
          <input type="password" id="login-pass" placeholder="••••••" required />
        </div>
        <button type="submit" class="btn-primary full-width">Entrar</button>
      </form>
      <p class="card-sub" style="margin-top:12px; text-align:center;">
        Ainda não tem cadastro? <a href="#" style="color:var(--gold);" onclick="toggleAuthMode('register', event)">Criar conta agora</a>
      </p>
    `;
  } else {
    card.innerHTML = `
      <div class="card-header">
        <div>
          <h2>Novo Cadastro</h2>
          <p class="card-sub">Preencha seus dados básicos</p>
        </div>
        <span class="tag-rf">RF01</span>
      </div>
      <form onsubmit="handleClientRegister(event)">
        <div class="form-group">
          <label>Nome Completo</label>
          <input type="text" id="reg-name" placeholder="Seu nome completo" required />
        </div>
        <div class="form-group">
          <label>Telefone / WhatsApp</label>
          <input type="text" id="reg-phone" placeholder="(11) 90000-0000" required />
        </div>
        <div class="form-group">
          <label>Senha de Acesso</label>
          <input type="password" id="reg-pass" minlength="4" placeholder="Mínimo 4 caracteres" required />
        </div>
        <button type="submit" class="btn-primary full-width">Concluir Cadastro</button>
      </form>
      <p class="card-sub" style="margin-top:12px; text-align:center;">
        Já possui conta? <a href="#" style="color:var(--gold);" onclick="toggleAuthMode('login', event)">Fazer login</a>
      </p>
    `;
  }
}

function toggleAuthMode(mode, e) {
  if (e) e.preventDefault();
  state.authMode = mode;
  renderAuthProfileCard();
}

async function handleClientRegister(e) {
  e.preventDefault();
  const name = document.getElementById('reg-name').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const pass = document.getElementById('reg-pass').value;

  if (phone.replace(/\D/g, '').length < 8) {
    showToast('Informe um número de telefone válido (mínimo 8 dígitos).', 'error');
    return;
  }

  const users = getUsers();
  if (users.some(u => u.phone === phone)) {
    showToast('Este telefone já está cadastrado.', 'error');
    return;
  }

  const passwordHash = await hashPassword(pass);
  const newUser = {
    id: 'usr_' + Date.now(),
    name,
    phone,
    passwordHash,
    role: 'client'
  };

  users.push(newUser);
  saveUsers(users);
  setCurrentUser(newUser);
  updateSessionHeader();
  renderAuthProfileCard();
  renderClientAppointments();
  showToast('Cadastro realizado com senha criptografada (RNF03)!', 'success');
}

async function handleClientLogin(e) {
  e.preventDefault();
  const phone = document.getElementById('login-phone').value.trim();
  const pass = document.getElementById('login-pass').value;
  const hash = await hashPassword(pass);

  const user = getUsers().find(u => u.phone === phone && u.passwordHash === hash);
  if (!user) {
    showToast('Telefone ou senha inválidos.', 'error');
    return;
  }

  setCurrentUser(user);
  updateSessionHeader();
  renderAuthProfileCard();
  renderClientAppointments();
  showToast(`Bem-vindo(a), ${user.name}!`, 'success');
}

function handleUpdateProfile(e) {
  e.preventDefault();
  const user = getCurrentUser();
  if (!user) return;

  const newName = document.getElementById('prof-name').value.trim();
  const newPhone = document.getElementById('prof-phone').value.trim();

  const users = getUsers();
  const idx = users.findIndex(u => u.id === user.id);
  if (idx !== -1) {
    users[idx].name = newName;
    users[idx].phone = newPhone;
    saveUsers(users);
    setCurrentUser(users[idx]);
    updateSessionHeader();
    renderAuthProfileCard();
    showToast('Perfil atualizado com sucesso (RF02).', 'success');
  }
}

function logoutUser() {
  setCurrentUser(null);
  updateSessionHeader();
  renderAuthProfileCard();
  renderClientAppointments();
  showToast('Sessão encerrada.', 'info');
}

/* RF06, RF07 & RN02: Histórico e Cancelamento com Antecedência Mínima de 2 Horas */
function renderClientAppointments() {
  const container = document.getElementById('client-appointments-list');
  const user = getCurrentUser();

  if (!user) {
    container.innerHTML = '<p class="card-sub">Faça login para visualizar seus agendamentos.</p>';
    return;
  }

  const list = getAppointments()
    .filter(a => a.clientId === user.id)
    .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));

  if (list.length === 0) {
    container.innerHTML = '<p class="card-sub">Você ainda não possui agendamentos registrados.</p>';
    return;
  }

  container.innerHTML = list.map(appt => {
    const apptDateTime = new Date(`${appt.date}T${appt.time}:00`);
    const diffHours = (apptDateTime - state.simulatedNow) / (1000 * 60 * 60);
    const canCancel = appt.status === 'Confirmado' && diffHours >= 2;

    let cancelButtonHtml = '';
    if (appt.status === 'Confirmado') {
      if (canCancel) {
        cancelButtonHtml = `<button class="btn-danger" style="margin-top:8px;" onclick="cancelAppointmentByClient('${appt.id}')">Cancelar Reserva</button>`;
      } else {
        cancelButtonHtml = `<p style="font-size:0.74rem; color:#fca5a5; margin-top:6px;">Cancelamento bloqueado: antecedência inferior a 2h (RN02).</p>`;
      }
    }

    return `
      <div class="appt-item">
        <div class="appt-top">
          <strong>${appt.serviceName}</strong>
          <span class="status-badge status-${appt.status}">${appt.status}</span>
        </div>
        <div class="card-sub">${formatDateBR(appt.date)} às <strong>${appt.time}</strong> • ${appt.barber}</div>
        <div class="card-sub">Valor: R$ ${appt.price.toFixed(2).replace('.', ',')}</div>
        ${cancelButtonHtml}
      </div>
    `;
  }).join('');
}

function cancelAppointmentByClient(apptId) {
  const appointments = getAppointments();
  const appt = appointments.find(a => a.id === apptId);
  if (!appt) return;

  const apptDateTime = new Date(`${appt.date}T${appt.time}:00`);
  const diffHours = (apptDateTime - state.simulatedNow) / (1000 * 60 * 60);

  // RN02: Validação rigorosa de 2 horas
  if (diffHours < 2) {
    showToast('Bloqueado pela RN02: Cancelamentos exigem no mínimo 2 horas de antecedência.', 'error');
    renderClientAppointments();
    return;
  }

  appt.status = 'Cancelado';
  saveAppointments(appointments);
  renderClientAppointments();
  renderTimeSlots();
  showToast('Agendamento cancelado e horário liberado na grade.', 'success');
}

/* ==========================================================================
   MÓDULO ADMINISTRATIVO (RF08 - RF11)
   ========================================================================== */

function checkAdminAccess() {
  const user = getCurrentUser();
  const isAdmin = user && user.role === 'admin';

  document.getElementById('admin-lock-screen').classList.toggle('hidden', isAdmin);
  document.getElementById('admin-dashboard-content').classList.toggle('hidden', !isAdmin);

  if (isAdmin) {
    renderAdminDashboard();
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const phone = document.getElementById('admin-phone').value.trim();
  const pass = document.getElementById('admin-pass').value;
  const hash = await hashPassword(pass);

  const adminUser = getUsers().find(u => u.phone === phone && u.passwordHash === hash && u.role === 'admin');
  if (!adminUser) {
    showToast('Credenciais administrativas inválidas.', 'error');
    return;
  }

  setCurrentUser(adminUser);
  updateSessionHeader();
  checkAdminAccess();
  showToast('Acesso administrativo liberado.', 'success');
}

function renderAdminDashboard() {
  renderAdminKPIs();
  renderAdminAgenda();
  renderAdminServicesList();
  renderScheduleConfigForm();
}

function renderAdminKPIs() {
  const appointments = getAppointments();
  const services = getServices();
  const filterDate = document.getElementById('admin-date-filter').value;

  const todayAppts = appointments.filter(a => a.date === filterDate && a.status !== 'Cancelado');
  const todayRevenue = todayAppts.reduce((sum, a) => sum + a.price, 0);
  const completedTotal = appointments.filter(a => a.status === 'Concluído').length;
  const activeServices = services.filter(s => s.active).length;

  document.getElementById('kpi-today-count').textContent = todayAppts.length;
  document.getElementById('kpi-today-revenue').textContent = `R$ ${todayRevenue.toFixed(2).replace('.', ',')}`;
  document.getElementById('kpi-completed-count').textContent = completedTotal;
  document.getElementById('kpi-services-count').textContent = activeServices;
}

/* RF08 & RF11: Agenda Administrativa e Alteração de Status */
function renderAdminAgenda() {
  const tbody = document.getElementById('admin-agenda-tbody');
  const filterMode = document.getElementById('admin-agenda-filter').value;
  const baseDateStr = document.getElementById('admin-date-filter').value;
  let appointments = getAppointments();

  if (filterMode === 'day' && baseDateStr) {
    appointments = appointments.filter(a => a.date === baseDateStr);
  } else if (filterMode === 'week' && baseDateStr) {
    const start = new Date(`${baseDateStr}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    appointments = appointments.filter(a => {
      const d = new Date(`${a.date}T00:00:00`);
      return d >= start && d <= end;
    });
  }

  appointments.sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  renderAdminKPIs();

  if (appointments.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; color:var(--text-muted);">Nenhum agendamento encontrado para este filtro.</td></tr>';
    return;
  }

  tbody.innerHTML = appointments.map(a => `
    <tr>
      <td><strong>${formatDateBR(a.date)}</strong> às ${a.time}</td>
      <td>${a.clientName}<br><span class="card-sub">${a.clientPhone}</span></td>
      <td>${a.serviceName}</td>
      <td>${a.barber}</td>
      <td>R$ ${a.price.toFixed(2).replace('.', ',')}</td>
      <td><span class="status-badge status-${a.status}">${a.status}</span></td>
      <td>
        <div class="action-btns">
          <button class="btn-xs" onclick="updateAppointmentStatus('${a.id}', 'Concluído')">Concluído</button>
          <button class="btn-xs" onclick="updateAppointmentStatus('${a.id}', 'Ausente')">Ausente</button>
          <button class="btn-xs" onclick="updateAppointmentStatus('${a.id}', 'Cancelado')">Cancelar</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function updateAppointmentStatus(id, newStatus) {
  const appointments = getAppointments();
  const target = appointments.find(a => a.id === id);
  if (!target) return;

  target.status = newStatus;
  saveAppointments(appointments);
  renderAdminAgenda();
  showToast(`Status atualizado para "${newStatus}" (RF11).`, 'success');
}

/* RF09: CRUD Completo de Serviços */
function renderAdminServicesList() {
  const container = document.getElementById('admin-services-list');
  const services = getServices();

  container.innerHTML = services.map(srv => `
    <div class="admin-srv-row ${srv.active ? '' : 'srv-inactive'}">
      <div>
        <strong>${srv.name}</strong> ${srv.active ? '' : '<span class="status-badge status-Cancelado">Inativo</span>'}
        <div class="card-sub">R$ ${srv.price.toFixed(2).replace('.', ',')} • ${srv.duration} min — ${srv.desc}</div>
      </div>
      <div class="action-btns">
        <button class="btn-xs" onclick="editServiceCRUD('${srv.id}')">Editar</button>
        <button class="btn-xs" onclick="toggleServiceActive('${srv.id}')">${srv.active ? 'Inativar' : 'Ativar'}</button>
      </div>
    </div>
  `).join('');
}

function saveServiceCRUD(e) {
  e.preventDefault();
  const id = document.getElementById('crud-service-id').value;
  const name = document.getElementById('crud-service-name').value.trim();
  const price = parseFloat(document.getElementById('crud-service-price').value);
  const duration = parseInt(document.getElementById('crud-service-duration').value, 10);
  const desc = document.getElementById('crud-service-desc').value.trim();

  const services = getServices();

  if (id) {
    const idx = services.findIndex(s => s.id === id);
    if (idx !== -1) {
      services[idx] = { ...services[idx], name, price, duration, desc };
      showToast('Serviço atualizado no catálogo (RF09).', 'success');
    }
  } else {
    services.push({
      id: 'srv_' + Date.now(),
      name,
      price,
      duration,
      desc,
      active: true
    });
    showToast('Novo serviço cadastrado com sucesso (RF09).', 'success');
  }

  saveServices(services);
  resetServiceForm();
  renderAdminServicesList();
  renderAdminKPIs();
}

function editServiceCRUD(id) {
  const srv = getServices().find(s => s.id === id);
  if (!srv) return;

  document.getElementById('crud-service-id').value = srv.id;
  document.getElementById('crud-service-name').value = srv.name;
  document.getElementById('crud-service-price').value = srv.price;
  document.getElementById('crud-service-duration').value = srv.duration;
  document.getElementById('crud-service-desc').value = srv.desc;

  document.getElementById('btn-save-service').textContent = 'Atualizar Serviço';
  document.getElementById('btn-cancel-edit').classList.remove('hidden');
}

function resetServiceForm() {
  document.getElementById('service-crud-form').reset();
  document.getElementById('crud-service-id').value = '';
  document.getElementById('btn-save-service').textContent = 'Salvar Serviço';
  document.getElementById('btn-cancel-edit').classList.add('hidden');
}

function toggleServiceActive(id) {
  const services = getServices();
  const srv = services.find(s => s.id === id);
  if (!srv) return;

  srv.active = !srv.active;
  saveServices(services);
  renderAdminServicesList();
  renderAdminKPIs();
  showToast(`Serviço "${srv.name}" ${srv.active ? 'ativado' : 'inativado'} (RF09).`, 'info');
}

/* RF10 & RN03: Configuração de Jornada e Bloqueio de Datas */
function renderScheduleConfigForm() {
  const cfg = getSchedule();
  document.getElementById('cfg-start').value = cfg.start;
  document.getElementById('cfg-end').value = cfg.end;
  document.getElementById('cfg-lunch-start').value = cfg.lunchStart;
  document.getElementById('cfg-lunch-end').value = cfg.lunchEnd;

  const listEl = document.getElementById('blocked-dates-list');
  if (cfg.blockedDates.length === 0) {
    listEl.innerHTML = '<span class="card-sub">Nenhuma data bloqueada no calendário.</span>';
  } else {
    listEl.innerHTML = cfg.blockedDates.map(d => `
      <span class="blocked-tag">
        ${formatDateBR(d)}
        <button type="button" onclick="removeBlockedDate('${d}')" title="Remover bloqueio">&times;</button>
      </span>
    `).join('');
  }
}

function saveScheduleConfig(e) {
  e.preventDefault();
  const cfg = getSchedule();
  cfg.start = document.getElementById('cfg-start').value;
  cfg.end = document.getElementById('cfg-end').value;
  cfg.lunchStart = document.getElementById('cfg-lunch-start').value;
  cfg.lunchEnd = document.getElementById('cfg-lunch-end').value;

  saveSchedule(cfg);
  showToast('Jornada de trabalho e intervalos atualizados (RF10 / RN03).', 'success');
}

function addBlockedDate() {
  const input = document.getElementById('block-date-input');
  const dateVal = input.value;
  if (!dateVal) return;

  const cfg = getSchedule();
  if (!cfg.blockedDates.includes(dateVal)) {
    cfg.blockedDates.push(dateVal);
    saveSchedule(cfg);
    renderScheduleConfigForm();
    showToast(`Data ${formatDateBR(dateVal)} bloqueada no calendário (RF10).`, 'info');
  }
  input.value = '';
}

function removeBlockedDate(dateVal) {
  const cfg = getSchedule();
  cfg.blockedDates = cfg.blockedDates.filter(d => d !== dateVal);
  saveSchedule(cfg);
  renderScheduleConfigForm();
  showToast(`Bloqueio da data ${formatDateBR(dateVal)} removido.`, 'info');
}

/* --- UTILITÁRIOS --- */
function formatDateBR(isoDate) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
}

function renderAll() {
  updateSessionHeader();
  renderAuthProfileCard();
  renderServicesCatalog();
  renderTimeSlots();
  renderClientAppointments();
}

/* --- INICIALIZAÇÃO --- */
window.addEventListener('DOMContentLoaded', async () => {
  await initDatabase();

  const defaultDate = '2026-11-16';
  document.getElementById('booking-date').value = defaultDate;
  document.getElementById('admin-date-filter').value = defaultDate;
  document.getElementById('sim-time-input').value = '2026-11-16T10:00';

  renderAll();
});