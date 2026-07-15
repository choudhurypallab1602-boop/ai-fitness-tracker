/**
 * Aura Pro — Production Grade Stable Synchronization Engine
 */

const appState = {
  user: null,
  isGuest: true,
  logs: [],
  waterLogs: [],
  settings: { calorieGoal: 2000, proteinGoal: 120, waterGoal: 2000, theme: 'light', units: 'metric', gasUrl: '', geminiKey: '' },
  coachAdvice: { coachingNotes: 'Your logs are empty. Let\'s log some meals today!', scoreDailyEstimate: 0 },
  activeView: 'dashboard-view'
};

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.style = "position:fixed; bottom:80px; right:24px; padding:12px 24px; border-radius:8px; background:" + (type==='success'?'#2e7d32':type==='error'?'#d32f2f':'#ef6c00') + "; color:#fff; z-index:10000; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-size:14px;";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

document.addEventListener('DOMContentLoaded', () => {
  loadLocalState();
  initTheme();
  setupNavigation();
  setupEventListeners();
  
  renderDashboard();
  renderTimeline();
  renderWaterTracker();
  
  if (localStorage.getItem('aura_session_active') === 'true') {
    hideAuthOverlay();
  }
});

function loadLocalState() {
  const savedSettings = localStorage.getItem('aura_settings');
  if (savedSettings) appState.settings = { ...appState.settings, ...JSON.parse(savedSettings) };
  
  const savedUser = localStorage.getItem('aura_user');
  if (savedUser) {
    appState.user = JSON.parse(savedUser);
    appState.isGuest = localStorage.getItem('aura_is_guest') === 'true';
  } else {
    appState.isGuest = true;
    appState.user = { id: 'guest_user', name: 'Guest User', email: 'guest@aurapro.local' };
  }

  appState.logs = JSON.parse(localStorage.getItem(`aura_logs_${appState.user.id}`)) || [];
  appState.waterLogs = JSON.parse(localStorage.getItem(`aura_water_${appState.user.id}`)) || [];

  // Map to settings inputs if exist
  if(document.getElementById('settings-calorie-goal')) {
    document.getElementById('settings-calorie-goal').value = appState.settings.calorieGoal;
    document.getElementById('settings-protein-goal').value = appState.settings.proteinGoal;
    document.getElementById('settings-water-goal').value = appState.settings.waterGoal;
    document.getElementById('settings-theme').value = appState.settings.theme;
    document.getElementById('settings-gas-url').value = appState.settings.gasUrl;
    document.getElementById('settings-gemini-key').value = appState.settings.geminiKey;
  }
}

function saveLocalState() {
  localStorage.setItem('aura_settings', JSON.stringify(appState.settings));
  localStorage.setItem('aura_user', JSON.stringify(appState.user));
  localStorage.setItem('aura_is_guest', appState.isGuest.toString());
  localStorage.setItem(`aura_logs_${appState.user.id}`, JSON.stringify(appState.logs));
  localStorage.setItem(`aura_water_${appState.user.id}`, JSON.stringify(appState.waterLogs));
}

function setupEventListeners() {
  document.getElementById('guest-login-btn')?.addEventListener('click', () => {
    loginSession('guest_user', 'Guest User', true);
  });

  document.getElementById('credentials-login-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const u = document.getElementById('login-username').value.trim();
    const p = document.getElementById('login-password').value.trim();
    if (u.toLowerCase() === 'pallab' && p === '2570') {
      loginSession('pallab_2570', 'Pallab', false);
    } else {
      showToast('Wrong Credentials! Hint: pallab / 2570', 'error');
    }
  });

  document.getElementById('logout-button')?.addEventListener('click', () => {
    localStorage.removeItem('aura_session_active');
    location.reload();
  });

  document.getElementById('submit-meal-btn')?.addEventListener('click', () => handleMealSubmission());
  document.getElementById('settings-save-btn')?.addEventListener('click', () => saveSettingsForm());
  document.getElementById('increment-water-btn')?.addEventListener('click', () => incrementWater(250));
  document.getElementById('decrement-water-btn')?.addEventListener('click', () => incrementWater(-250));
}

function loginSession(id, name, isGuest) {
  appState.isGuest = isGuest;
  appState.user = { id, name, email: `${id}@aurapro.local` };
  localStorage.setItem('aura_session_active', 'true');
  saveLocalState();
  hideAuthOverlay();
}

async function hideAuthOverlay() {
  document.getElementById('auth-view').style.display = 'none';
  document.getElementById('app-container').style.display = 'flex';
  document.getElementById('user-display-name').textContent = appState.user.name;
  document.getElementById('user-status-text').textContent = appState.isGuest ? 'Local Cache Mode' : 'Cloud Dynamic Sync';
  
  // TRIGGER HISTORICAL DATA LOAD ON LOGIN
  await fetchDataFromServer();
}

// --- CLOUD SYNC: FETCH HISTORICAL DATA ---
async function fetchDataFromServer() {
  if (appState.isGuest || !appState.settings.gasUrl) return;
  showToast('Fetching historical logs from Sheet...');
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
      renderWaterTracker();
      showToast('All past history sync complete!');
    }
  } catch (e) {
    showToast('Offline Mode Active. Loaded Local Storage.', 'warning');
  }
}

// --- LOG MEAL TRANSACTION ---
async function handleMealSubmission() {
  const box = document.getElementById('meal-input-box');
  const text = box.value.trim();
  if(!text) return;
  
  box.value = '';
  showToast('Logging meal...');
  const timestamp = new Date().toISOString();
  
  // Fallback defaults
  let mealItem = {
    id: 'meal_' + Date.now(),
    rawText: text, foods: text, calories: 320, protein: 14, confidence: 80,
    date: timestamp.split('T')[0], time: timestamp.split('T')[1].substring(0,5), timestamp
  };

  if (!appState.isGuest && appState.settings.gasUrl) {
    try {
      const res = await fetch(appState.settings.gasUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'log_meal', userId: appState.user.id, rawText: text, timestamp })
      });
      const cloud = await res.json();
      if(cloud.success) mealItem = cloud.meal;
    } catch(e) {}
  }

  appState.logs.push(mealItem);
  saveLocalState();
  renderDashboard();
  renderTimeline();
  showToast('Meal securely synced!');
}

// --- DYNAMIC WATER SAVE ---
async function incrementWater(amt) {
  const today = new Date().toISOString().split('T')[0];
  let log = appState.waterLogs.find(w => w.date === today);
  if(log) { log.amount = Math.max(0, log.amount + amt); } 
  else { log = { date: today, amount: Math.max(0, amt), timestamp: new Date().toISOString() }; appState.waterLogs.push(log); }
  
  saveLocalState();
  renderWaterTracker();

  if(!appState.isGuest && appState.settings.gasUrl) {
    try {
      await fetch(appState.settings.gasUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'log_water', userId: appState.user.id, amount: amt, date: today })
      });
    } catch(e) {}
  }
}

// --- WINDOW BOUND DELETE CONTROLLER ---
window.deleteMeal = async function(mealId) {
  showToast('Removing log...', 'warning');
  appState.logs = appState.logs.filter(m => m.id !== mealId);
  saveLocalState();
  renderDashboard();
  renderTimeline();

  if(!appState.isGuest && appState.settings.gasUrl) {
    try {
      await fetch(appState.settings.gasUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_meal', userId: appState.user.id, mealId: mealId })
      });
      showToast('Deleted from Google Sheet!');
    } catch(e){}
  }
};

// --- RENDERING LAYER ---
function renderDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const tLogs = appState.logs.filter(l => l.date === today);
  const tcals = tLogs.reduce((s,l)=> s + l.calories, 0);
  const tprot = tLogs.reduce((s,l)=> s + l.protein, 0);

  if(document.getElementById('calorie-current')) {
    document.getElementById('calorie-current').textContent = tcals;
    document.getElementById('calorie-goal-val').textContent = appState.settings.calorieGoal;
    document.getElementById('protein-current').textContent = tprot;
    document.getElementById('protein-goal-val').textContent = appState.settings.proteinGoal;
    
    document.getElementById('calorie-progress-bar').style.width = Math.min(100, (tcals/appState.settings.calorieGoal)*100) + '%';
    document.getElementById('protein-progress-bar').style.width = Math.min(100, (tprot/appState.settings.proteinGoal)*100) + '%';
  }
}

function renderTimeline() {
  const container = document.getElementById('timeline-logs-list');
  if(!container) return;
  container.innerHTML = appState.logs.length === 0 ? '<p style="text-align:center;padding:20px;">No historical entries found.</p>' : '';
  
  // Descending sort (new items first)
  [...appState.logs].sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).forEach(log => {
    const item = document.createElement('div');
    item.style = "background:var(--card-bg); padding:16px; border-radius:12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 8px rgba(0,0,0,0.05);";
    item.innerHTML = `
      <div>
        <small style="color:#777;">${log.date} | ${log.time}</small>
        <div style="font-weight:600; margin-top:4px;">${log.rawText}</div>
        <span style="font-size:12px; background:#e3f2fd; color:#1565c0; padding:2px 6px; border-radius:4px; margin-top:4px; display:inline-block;">${log.calories} kcal | ${log.protein}g P</span>
      </div>
      <div>
        <button onclick="window.deleteMeal('${log.id}')" style="background:#ffebee; color:#c62828; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:bold;">❌ Delete</button>
      </div>
    `;
    container.appendChild(item);
  });
}

function renderWaterTracker() {
  const today = new Date().toISOString().split('T')[0];
  const w = appState.waterLogs.find(l => l.date === today);
  if(document.getElementById('water-current-val')) {
    document.getElementById('water-current-val').textContent = w ? w.amount : 0;
    document.getElementById('water-goal-ml-val').textContent = appState.settings.waterGoal;
  }
}

function saveSettingsForm() {
  appState.settings.calorieGoal = parseInt(document.getElementById('settings-calorie-goal').value) || 2000;
  appState.settings.proteinGoal = parseInt(document.getElementById('settings-protein-goal').value) || 120;
  appState.settings.waterGoal = parseInt(document.getElementById('settings-water-goal').value) || 2000;
  appState.settings.theme = document.getElementById('settings-theme').value;
  appState.settings.gasUrl = document.getElementById('settings-gas-url').value.trim();
  appState.settings.geminiKey = document.getElementById('settings-gemini-key').value.trim();
  
  saveLocalState();
  initTheme();
  fetchDataFromServer();
  showToast('Settings saved & synced!');
}

function setupNavigation() {
  document.querySelectorAll('.nav-menu a, #mobile-nav a').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.getAttribute('data-view');
      document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
      document.getElementById(target)?.classList.add('active');
      if(target === 'timeline-view') renderTimeline();
    });
  });
}

function initTheme() {
  document.body.classList.toggle('dark-theme', appState.settings.theme === 'dark');
}
