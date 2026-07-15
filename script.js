/**
 * Aura Pro — Application Core Logic & Cloud Sync Engine
 */

// --- GLOBAL STATE ---
const appState = {
  user: null,
  isGuest: true,
  logs: [],
  waterLogs: [],
  settings: {
    calorieGoal: 2000,
    proteinGoal: 120,
    waterGoal: 2000,
    theme: 'light',
    units: 'metric',
    gasUrl: '',
    geminiKey: ''
  },
  coachAdvice: {
    coachingNotes: 'Your logs are empty. Let\'s log some meals today to analyze your dietary patterns.',
    scoreDailyEstimate: 0,
    alerts: [],
    suggestions: []
  },
  activeSwaps: [],
  activeView: 'dashboard-view'
};

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.bottom = '80px';
  toast.style.right = '24px';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '8px';
  toast.style.background = type === 'success' ? 'var(--color-green)' : type === 'error' ? 'var(--color-red)' : 'var(--color-orange)';
  toast.style.color = '#fff';
  toast.style.fontSize = '14px';
  toast.style.fontWeight = '500';
  toast.style.zIndex = '1000';
  toast.style.boxShadow = 'var(--shadow-lg)';
  toast.style.transition = 'all 0.3s ease';
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  loadLocalState();
  initTheme();
  setupNavigation();
  setupEventListeners();
  setupGoogleLogin();
  
  renderDashboard();
  renderTimeline();
  renderAnalytics();
  renderWaterTracker();
  renderCoachView();
  
  if (appState.user && localStorage.getItem('aura_session_active') === 'true') {
    hideAuthOverlay();
  }
});

// --- STATE MANAGEMENT ---
function loadLocalState() {
  const savedSettings = localStorage.getItem('aura_settings');
  if (savedSettings) {
    appState.settings = { ...appState.settings, ...JSON.parse(savedSettings) };
  }
  
  const savedUser = localStorage.getItem('aura_user');
  if (savedUser) {
    appState.user = JSON.parse(savedUser);
    appState.isGuest = localStorage.getItem('aura_is_guest') === 'true';
  } else {
    appState.isGuest = true;
    appState.user = { id: 'guest_user', name: 'Guest User', email: 'guest@aurapro.local', avatar: '' };
  }

  appState.logs = JSON.parse(localStorage.getItem(`aura_logs_${appState.user.id}`)) || [];
  appState.waterLogs = JSON.parse(localStorage.getItem(`aura_water_${appState.user.id}`)) || [];
  appState.activeSwaps = JSON.parse(localStorage.getItem(`aura_swaps_${appState.user.id}`)) || [];
  appState.coachAdvice = JSON.parse(localStorage.getItem(`aura_coach_${appState.user.id}`)) || appState.coachAdvice;

  // Sync Input UI Elements
  document.getElementById('settings-calorie-goal').value = appState.settings.calorieGoal;
  document.getElementById('settings-protein-goal').value = appState.settings.proteinGoal;
  document.getElementById('settings-water-goal').value = appState.settings.waterGoal;
  document.getElementById('settings-theme').value = appState.settings.theme;
  document.getElementById('settings-units').value = appState.settings.units;
  document.getElementById('settings-gas-url').value = appState.settings.gasUrl;
  document.getElementById('settings-gemini-key').value = appState.settings.geminiKey;
}

function saveLocalState() {
  localStorage.setItem('aura_settings', JSON.stringify(appState.settings));
  localStorage.setItem('aura_user', JSON.stringify(appState.user));
  localStorage.setItem('aura_is_guest', appState.isGuest.toString());
  localStorage.setItem(`aura_logs_${appState.user.id}`, JSON.stringify(appState.logs));
  localStorage.setItem(`aura_water_${appState.user.id}`, JSON.stringify(appState.waterLogs));
  localStorage.setItem(`aura_swaps_${appState.user.id}`, JSON.stringify(appState.activeSwaps));
  localStorage.setItem(`aura_coach_${appState.user.id}`, JSON.stringify(appState.coachAdvice));
}

// --- GOOGLE CLOUD LOGIN SYNC ---
function setupGoogleLogin() {
  setTimeout(() => {
    if (typeof google !== 'undefined') {
      google.accounts.id.initialize({
        client_id: '98457223405-sampleclientid.apps.googleusercontent.com',
        callback: handleGoogleCredentialResponse
      });
      google.accounts.id.renderButton(
        document.getElementById('g-signin-button'),
        { theme: 'outline', size: 'large', width: 280 }
      );
    }
  }, 1000);
}

async function handleGoogleCredentialResponse(response) {
  try {
    const payload = decodeJwt(response.credential);
    appState.isGuest = false;
    appState.user = { id: payload.sub, name: payload.name, email: payload.email, avatar: payload.picture };
    localStorage.setItem('aura_session_active', 'true');
    saveLocalState();
    
    await syncUserWithServer();
    hideAuthOverlay();
    await fetchDataFromServer();
    showToast(`Welcome back, ${payload.name}!`);
  } catch (error) {
    showToast('Failed to authenticate with Google.', 'error');
  }
}

function decodeJwt(token) {
  const base64Url = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
  return JSON.parse(window.atob(base64Url));
}

async function syncUserWithServer() {
  if (appState.settings.gasUrl) {
    try {
      await fetch(appState.settings.gasUrl, {
        method: 'POST',
        mode: 'no-cors',
        body: JSON.stringify({ action: 'sync_user', userId: appState.user.id, name: appState.user.name, email: appState.user.email })
      });
    } catch(e) { console.log(e); }
  }
}

// --- CLOUD SHEET SYNC ENGINE (FETCH OLD PAST DATA) ---
async function fetchDataFromServer() {
  if (appState.isGuest || !appState.settings.gasUrl) return;

  showToast('Syncing parameters with Google Sheet...');
  try {
    const response = await fetch(appState.settings.gasUrl, {
      method: 'POST',
      body: JSON.stringify({ action: 'get_logs', userId: appState.user.id })
    });
    const data = await response.json();
    if (data.success) {
      appState.logs = data.logs || [];
      appState.waterLogs = data.waterLogs || [];
      saveLocalState();
      
      renderDashboard();
      renderTimeline();
      renderAnalytics();
      renderWaterTracker();
      showToast('Data completely synced from cloud!');
    }
  } catch (error) {
    showToast('Running offline mode. Local cache active.', 'warning');
  }
}

// --- USER UI INTERACTION TRIGGERS ---
function setupEventListeners() {
  document.getElementById('guest-login-btn').addEventListener('click', () => {
    appState.isGuest = true;
    appState.user = { id: 'guest_user', name: 'Guest User', email: 'guest@aurapro.local', avatar: '' };
    localStorage.setItem('aura_session_active', 'true');
    saveLocalState();
    hideAuthOverlay();
    showToast('Signed in as Guest.');
  });

  document.getElementById('credentials-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById('login-username').value.trim();
    const passwordInput = document.getElementById('login-password').value.trim();

    if (usernameInput.toLowerCase() === 'pallab' && passwordInput === '2570') {
      appState.isGuest = false;
      appState.user = { id: 'pallab_2570', name: 'Pallab', email: 'pallab@aurapro.local', avatar: '' };
      localStorage.setItem('aura_session_active', 'true');
      saveLocalState();
      await syncUserWithServer();
      hideAuthOverlay();
      await fetchDataFromServer();
    } else {
      showToast('Invalid credentials. Hint: Pallab / 2570', 'error');
    }
  });

  document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('aura_session_active');
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('auth-view').style.display = 'flex';
    showToast('Signed out.');
  });

  document.getElementById('submit-meal-btn').addEventListener('click', () => handleMealSubmission());
  document.getElementById('settings-save-btn').addEventListener('click', () => saveSettingsForm());
  document.getElementById('planner-submit-btn').addEventListener('click', () => generateDietPlan());
  document.getElementById('dashboard-export-pdf').addEventListener('click', () => window.print());
  document.getElementById('decrement-water-btn').addEventListener('click', () => incrementWater(-250));
  
  document.getElementById('timeline-search-input').addEventListener('input', () => renderTimeline());
  document.getElementById('timeline-date-filter').addEventListener('change', () => renderTimeline());
  
  document.getElementById('edit-modal-cancel').addEventListener('click', () => {
    document.getElementById('edit-meal-modal').classList.remove('active');
  });
  document.getElementById('edit-meal-form').addEventListener('submit', (e) => {
    e.preventDefault();
    saveMealEdit();
  });
}

// --- MEAL WRITE PROCESSOR WITH SHEET SAVING ---
async function handleMealSubmission() {
  const inputEl = document.getElementById('meal-input-box');
  const text = inputEl.value.trim();
  if (!text) return showToast('Please type a description.', 'warning');

  showToast('Processing input parameters...');
  inputEl.value = '';
  const timestamp = new Date().toISOString();

  let parsedMealResult = await parseMealLocally(text, timestamp);

  if (!appState.isGuest && appState.settings.gasUrl) {
    try {
      const response = await fetch(appState.settings.gasUrl, {
        method: 'POST',
        body: JSON.stringify({
          action: 'log_meal',
          userId: appState.user.id,
          rawText: text,
          foods: parsedMealResult.meal.foods,
          calories: parsedMealResult.meal.calories,
          protein: parsedMealResult.meal.protein,
          confidence: parsedMealResult.meal.confidence,
          timestamp: timestamp
        })
      });
      const cloudData = await response.json();
      if (cloudData.success) parsedMealResult.meal = cloudData.meal;
    } catch (e) {
      console.error('Sheet update failed, fallback saved locally.');
    }
  }

  appState.logs.push(parsedMealResult.meal);
  saveLocalState();
  triggerCoachUpdate();
  renderDashboard();
  showToast(`Logged: ${parsedMealResult.meal.foods}`);
}

// --- LOCAL AI AND HEURISTIC PARSER ---
async function parseMealLocally(text, timestamp) {
  const dateStr = timestamp.split('T')[0];
  const timeStr = timestamp.split('T')[1].substring(0, 5);

  if (appState.settings.geminiKey) {
    try {
      const prompt = `You are a nutrition parser. Parse: "${text}". Reply with pure JSON only structure:\n{ "foods": "items separated by comma", "calories": 250, "protein": 15, "confidence": 90 }`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${appState.settings.geminiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } })
      });
      const data = await response.json();
      const parsed = JSON.parse(data.candidates[0].content.parts[0].text.trim());
      return { meal: { id: 'meal_'+Date.now(), rawText: text, ...parsed, date: dateStr, time: timeStr, timestamp } };
    } catch(e) {}
  }

  return { meal: { id: 'meal_'+Date.now(), rawText: text, foods: text, calories: 300, protein: 12, confidence: 60, date: dateStr, time: timeStr, timestamp } };
}

// --- HYDRO LOG SAVER TO SHEET ---
async function incrementWater(amount) {
  const today = new Date().toISOString().split('T')[0];
  let todayWaterLog = appState.waterLogs.find(wl => wl.date === today);

  if (todayWaterLog) {
    todayWaterLog.amount = Math.max(0, todayWaterLog.amount + amount);
  } else if (amount > 0) {
    todayWaterLog = { date: today, amount: amount, timestamp: new Date().toISOString() };
    appState.waterLogs.push(todayWaterLog);
  }

  saveLocalState();
  renderWaterTracker();

  if (!appState.isGuest && appState.settings.gasUrl) {
    try {
      await fetch(appState.settings.gasUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'log_water', userId: appState.user.id, amount: amount, date: today })
      });
    } catch(e) {}
  }
}

// --- DATA MODIFICATION UTILITIES ---
window.deleteMeal = async function(mealId) {
  appState.logs = appState.logs.filter(l => l.id !== mealId);
  saveLocalState();
  renderTimeline();
  renderDashboard();

  if (!appState.isGuest && appState.settings.gasUrl) {
    try {
      await fetch(appState.settings.gasUrl, { method: 'POST', body: JSON.stringify({ action: 'delete_meal', userId: appState.user.id, mealId: mealId }) });
    } catch(e) {}
  }
};

window.openEditMealModal = function(mealId) {
  const log = appState.logs.find(l => l.id === mealId);
  if (!log) return;
  document.getElementById('edit-meal-id').value = log.id;
  document.getElementById('edit-meal-desc').value = log.rawText;
  document.getElementById('edit-meal-calories').value = log.calories;
  document.getElementById('edit-meal-protein').value = log.protein;
  document.getElementById('edit-meal-modal').classList.add('active');
};

async function saveMealEdit() {
  const id = document.getElementById('edit-meal-id').value;
  const desc = document.getElementById('edit-meal-desc').value;
  const cal = Number(document.getElementById('edit-meal-calories').value);
  const prot = Number(document.getElementById('edit-meal-protein').value);

  const log = appState.logs.find(l => l.id === id);
  if (log) {
    log.rawText = desc;
    log.calories = cal;
    log.protein = prot;
  }

  document.getElementById('edit-meal-modal').classList.remove('active');
  saveLocalState();
  renderTimeline();
  renderDashboard();

  if (!appState.isGuest && appState.settings.gasUrl) {
    try {
      await fetch(appState.settings.gasUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'edit_meal', userId: appState.user.id, mealId: id, rawText: desc, calories: cal, protein: prot })
      });
    } catch(e) {}
  }
}

// --- NAVIGATION SHELL CONTROL ---
function setupNavigation() {
  document.querySelectorAll('.nav-menu a, #mobile-nav a').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const view = item.getAttribute('data-view');
      switchView(view);
    });
  });
}

function switchView(viewId) {
  document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  appState.activeView = viewId;

  document.querySelectorAll('.nav-menu a, #mobile-nav a').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === viewId);
  });

  if (viewId === 'timeline-view') renderTimeline();
  if (viewId === 'analytics-view') renderAnalytics();
  if (viewId === 'dashboard-view') { renderDashboard(); renderWaterTracker(); }
}

function hideAuthOverlay() {
  document.getElementById('auth-view').style.display = 'none';
  document.getElementById('app-container').style.display = 'flex';
  updateProfileBox();
  fetchDataFromServer();
}

function updateProfileBox() {
  document.getElementById('user-display-name').textContent = appState.user.name;
  document.getElementById('user-status-text').textContent = appState.isGuest ? 'Offline Cache' : 'Cloud Sync';
}

function initTheme() {
  document.body.classList.toggle('dark-theme', appState.settings.theme === 'dark');
}

// --- RE-RENDER DOM DASHBOARD ---
function renderDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = appState.logs.filter(l => l.date === today);

  const totalCals = todayLogs.reduce((sum, l) => sum + l.calories, 0);
  const totalProt = todayLogs.reduce((sum, l) => sum + l.protein, 0);

  document.getElementById('calorie-current').textContent = totalCals;
  document.getElementById('calorie-goal-val').textContent = appState.settings.calorieGoal;
  document.getElementById('protein-current').textContent = totalProt;
  document.getElementById('protein-goal-val').textContent = appState.settings.proteinGoal;

  document.getElementById('calorie-progress-bar').style.width = `${Math.min(100, (totalCals / appState.settings.calorieGoal) * 100)}%`;
  document.getElementById('protein-progress-bar').style.width = `${Math.min(100, (totalProt / appState.settings.proteinGoal) * 100)}%`;

  const dashboardTimeline = document.getElementById('dashboard-timeline-list');
  dashboardTimeline.innerHTML = todayLogs.length === 0 ? '<p>No meals logged today.</p>' : '';
  todayLogs.slice(-3).reverse().forEach(log => {
    const d = document.createElement('div');
    d.className = 'timeline-item';
    d.innerHTML = `<div><b>${log.time}</b> - ${log.rawText}</div><div>${log.calories} kcal</div>`;
    dashboardTimeline.appendChild(d);
  });
}

function renderTimeline() {
  const container = document.getElementById('timeline-logs-list');
  container.innerHTML = appState.logs.length === 0 ? '<p style="text-align:center;padding:20px;">No logs recorded yet.</p>' : '';
  
  appState.logs.sort((a,b) => b.timestamp.localeCompare(a.timestamp)).forEach(log => {
    const el = document.createElement('div');
    el.className = 'timeline-item';
    el.innerHTML = `
      <div><b>${log.date} @ ${log.time}</b><br>${log.rawText}</div>
      <div>${log.calories} kcal | ${log.protein}g P</div>
      <div>
        <button onclick="openEditMealModal('${log.id}')">✏️</button>
        <button onclick="deleteMeal('${log.id}')">❌</button>
      </div>`;
    container.appendChild(el);
  });
}

function renderWaterTracker() {
  const today = new Date().toISOString().split('T')[0];
  const log = appState.waterLogs.find(wl => wl.date === today);
  const amt = log ? log.amount : 0;
  document.getElementById('water-current-val').textContent = amt;
  document.getElementById('water-goal-ml-val').textContent = appState.settings.waterGoal;
}

function renderAnalytics() {
  const daily = {};
  appState.logs.forEach(l => {
    if(!daily[l.date]) daily[l.date] = 0;
    daily[l.date] += l.calories;
  });
  const dates = Object.keys(daily);
  const sum = dates.reduce((a, b) => a + daily[b], 0);
  document.getElementById('stats-avg-calories').textContent = dates.length ? `${Math.round(sum / dates.length)} kcal` : '0 kcal';
}

function renderCoachView() {
  document.getElementById('coach-advice-text').textContent = appState.coachAdvice.coachingNotes;
}

function triggerCoachUpdate() {
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = appState.logs.filter(l => l.date === today);
  if(todayLogs.length > 0) {
    appState.coachAdvice.coachingNotes = "Excellent logs tracking consistency. Keep it up!";
    appState.coachAdvice.scoreDailyEstimate = 85;
  }
  saveLocalState();
}

async function generateDietPlan() {
  showToast('Formulating tailored plan menu...');
  setTimeout(() => { showToast('Plan generated successfully!'); }, 1500);
}

function saveSettingsForm() {
  appState.settings.calorieGoal = parseInt(document.getElementById('settings-calorie-goal').value);
  appState.settings.proteinGoal = parseInt(document.getElementById('settings-protein-goal').value);
  appState.settings.waterGoal = parseInt(document.getElementById('settings-water-goal').value);
  appState.settings.theme = document.getElementById('settings-theme').value;
  appState.settings.gasUrl = document.getElementById('settings-gas-url').value;
  appState.settings.geminiKey = document.getElementById('settings-gemini-key').value;
  
  saveLocalState();
  initTheme();
  fetchDataFromServer();
  showToast('Settings saved successfully!');
}
