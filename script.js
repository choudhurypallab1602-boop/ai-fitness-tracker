/**
 * Aura Pro — Production Grade Stable Synchronization Engine (V4)
 * Fully mapped to your original HTML structures
 */

const appState = {
  user: null,
  isGuest: true,
  logs: [],
  waterLogs: [],
  settings: { calorieGoal: 2000, proteinGoal: 120, waterGoal: 2000, theme: 'light', units: 'metric', gasUrl: '', geminiKey: '' },
  selectedTimelineDate: new Date().toISOString().split('T')[0]
};

// --- TOAST NOTIFICATIONS ---
function showToast(message, type = 'success') {
  // Purane style ko disturb kiye bina simple alert notification
  const toast = document.createElement('div');
  toast.style = "position:fixed; bottom:80px; right:24px; padding:12px 24px; border-radius:8px; background:" + (type==='success'?'#2e7d32':type==='error'?'#d32f2f':'#ef6c00') + "; color:#fff; z-index:10000; box-shadow:0 4px 12px rgba(0,0,0,0.15); font-size:14px; font-weight:500;";
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
  updateCoachAdvice();
  
  if (localStorage.getItem('aura_session_active') === 'true') {
    hideAuthOverlay();
  }
});

// --- LOCAL STORAGE STATE ---
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

  // HTML inputs values mapping
  if(document.getElementById('settings-calorie-goal')) document.getElementById('settings-calorie-goal').value = appState.settings.calorieGoal;
  if(document.getElementById('settings-protein-goal')) document.getElementById('settings-protein-goal').value = appState.settings.proteinGoal;
  if(document.getElementById('settings-water-goal')) document.getElementById('settings-water-goal').value = appState.settings.waterGoal;
  if(document.getElementById('settings-theme')) document.getElementById('settings-theme').value = appState.settings.theme;
  if(document.getElementById('settings-gas-url')) document.getElementById('settings-gas-url').value = appState.settings.gasUrl;
  if(document.getElementById('settings-gemini-key')) document.getElementById('settings-gemini-key').value = appState.settings.geminiKey;
}

function saveLocalState() {
  localStorage.setItem('aura_settings', JSON.stringify(appState.settings));
  localStorage.setItem('aura_user', JSON.stringify(appState.user));
  localStorage.setItem('aura_is_guest', appState.isGuest.toString());
  localStorage.setItem(`aura_logs_${appState.user.id}`, JSON.stringify(appState.logs));
  localStorage.setItem(`aura_water_${appState.user.id}`, JSON.stringify(appState.waterLogs));
}

// --- EVENT LISTENERS ---
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
  
  // Custom Date input trigger for scrolling/jumping timeline dates
  document.getElementById('timeline-date-filter')?.addEventListener('change', (e) => {
    appState.selectedTimelineDate = e.target.value;
    renderTimeline();
  });
}

function loginSession(id, name, isGuest) {
  appState.isGuest = isGuest;
  appState.user = { id, name, email: `${id}@aurapro.local` };
  localStorage.setItem('aura_session_active', 'true');
  saveLocalState();
  hideAuthOverlay();
}

async function hideAuthOverlay() {
  const authView = document.getElementById('auth-view');
  const appContainer = document.getElementById('app-container');
  if(authView) authView.style.display = 'none';
  if(appContainer) appContainer.style.display = 'flex';
  
  const displayName = document.getElementById('user-display-name');
  const statusText = document.getElementById('user-status-text');
  if(displayName) displayName.textContent = appState.user.name;
  if(statusText) statusText.textContent = appState.isGuest ? 'Local Mode' : 'Cloud Connected';
  
  await fetchDataFromServer();
}

// --- FETCH HISTORICAL SHEET DATA ---
async function fetchDataFromServer() {
  if (appState.isGuest || !appState.settings.gasUrl) return;
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
      updateCoachAdvice();
    }
  } catch (e) {
    console.log("Offline mode active.");
  }
}

// --- SMART REGEX NUTRITION PARSER ---
function parseMealFallback(text) {
  let calories = 250; 
  let protein = 12;
  
  // Text se numbers check karne ke liye: "Had chicken salad with 350 kcal and 30g protein"
  const calMatch = text.match(/(\d+)\s*(?:kcal|calories|cal|cals)/i);
  const protMatch = text.match(/(\d+)\s*(?:g\s*protein|g\s*p|grams\s*protein)/i);
  
  if (calMatch) calories = parseInt(calMatch[1]);
  if (protMatch) protein = parseInt(protMatch[1]);
  
  const foods = text.split(/with|and|,/gi)[0].trim();
  return { foods, calories, protein, confidence: 85 };
}

// --- SUBMIT MEAL LOG ---
async function handleMealSubmission() {
  const box = document.getElementById('meal-input-box');
  const text = box.value.trim();
  if(!text) return;
  
  box.value = '';
  showToast('Processing nutrition values...');
  const timestamp = new Date().toISOString();
  
  let parsedResult = parseMealFallback(text);

  let mealItem = {
    id: 'meal_' + Date.now(),
    rawText: text, 
    foods: parsedResult.foods, 
    calories: parsedResult.calories, 
    protein: parsedResult.protein, 
    confidence: parsedResult.confidence,
    date: timestamp.split('T')[0], 
    time: timestamp.split('T')[1].substring(0,5), 
    timestamp
  };

  if (!appState.isGuest && appState.settings.gasUrl) {
    try {
      const res = await fetch(appState.settings.gasUrl, {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'log_meal', 
          userId: appState.user.id, 
          rawText: text, 
          calories: mealItem.calories,
          protein: mealItem.protein,
          timestamp 
        })
      });
      const cloud = await res.json();
      if(cloud.success) mealItem = cloud.meal;
    } catch(e) {}
  }

  appState.logs.push(mealItem);
  saveLocalState();
  renderDashboard();
  renderTimeline();
  updateCoachAdvice();
  showToast('Logged successfully!');
}

// --- DELETE LOG ---
window.deleteMeal = async function(mealId) {
  appState.logs = appState.logs.filter(m => String(m.id) !== String(mealId));
  saveLocalState();
  renderDashboard();
  renderTimeline();
  updateCoachAdvice();

  if(!appState.isGuest && appState.settings.gasUrl) {
    try {
      await fetch(appState.settings.gasUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'delete_meal', userId: appState.user.id, mealId: mealId })
      });
    } catch(e){}
  }
};

// --- RENDER FUNCTIONS ---
function renderDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const tLogs = appState.logs.filter(l => l.date === today);
  const tcals = tLogs.reduce((s,l)=> s + l.calories, 0);
  const tprot = tLogs.reduce((s,l)=> s + l.protein, 0);

  // Dynamic elements mapping safely
  if(document.getElementById('calorie-current')) document.getElementById('calorie-current').textContent = tcals;
  if(document.getElementById('calorie-goal-val')) document.getElementById('calorie-goal-val').textContent = appState.settings.calorieGoal;
  if(document.getElementById('protein-current')) document.getElementById('protein-current').textContent = tprot;
  if(document.getElementById('protein-goal-val')) document.getElementById('protein-goal-val').textContent = appState.settings.proteinGoal;
  
  if(document.getElementById('calorie-progress-bar')) {
    document.getElementById('calorie-progress-bar').style.width = Math.min(100, (tcals/appState.settings.calorieGoal)*100) + '%';
  }
  if(document.getElementById('protein-progress-bar')) {
    document.getElementById('protein-progress-bar').style.width = Math.min(100, (tprot/appState.settings.proteinGoal)*100) + '%';
  }
  
  // Render today's quick meals on Dashboard
  const dashList = document.getElementById('dashboard-timeline-list');
  if(dashList) {
    dashList.innerHTML = tLogs.length === 0 ? '<p style="color:#777; font-size:13px;">No meals logged today.</p>' : '';
    tLogs.slice(-3).reverse().forEach(log => {
      const d = document.createElement('div');
      d.style = "display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid rgba(0,0,0,0.05); font-size:13px;";
      d.innerHTML = `<div><b>${log.time}</b> - ${log.rawText}</div><div style="color:var(--color-green); font-weight:600;">+${log.calories} kcal</div>`;
      dashList.appendChild(d);
    });
  }
}

function renderTimeline() {
  const container = document.getElementById('timeline-logs-list');
  if(!container) return;
  
  let list = [...appState.logs];
  if(appState.selectedTimelineDate) {
    list = list.filter(l => l.date === appState.selectedTimelineDate);
  }

  container.innerHTML = list.length === 0 ? `<p style="text-align:center;padding:20px;color:#888;">No entries found for this date.</p>` : '';
  
  list.sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).forEach(log => {
    const item = document.createElement('div');
    item.style = "background:var(--card-bg, #fff); padding:16px; border-radius:12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 8px rgba(0,0,0,0.05);";
    item.innerHTML = `
      <div>
        <small style="color:#777;">${log.date} | ${log.time}</small>
        <div style="font-weight:600; margin-top:4px; font-size:14px;">${log.rawText}</div>
        <span style="font-size:12px; background:#e3f2fd; color:#1565c0; padding:2px 6px; border-radius:4px; margin-top:4px; display:inline-block;">${log.calories} kcal | ${log.protein}g Protein</span>
      </div>
      <div>
        <button onclick="window.deleteMeal('${log.id}')" style="background:#ffebee; color:#c62828; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:600; font-size:12px;">Delete</button>
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
  }
  if(document.getElementById('water-goal-ml-val')) {
    document.getElementById('water-goal-ml-val').textContent = appState.settings.waterGoal;
  }
}

// --- DYNAMIC AI COACH & REAL TARGET SCORE ---
function updateCoachAdvice() {
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = appState.logs.filter(l => l.date === today);
  const totalCals = todayLogs.reduce((sum, l) => sum + l.calories, 0);
  const totalProt = todayLogs.reduce((sum, l) => sum + l.protein, 0);

  const calPercent = Math.min(100, (totalCals / appState.settings.calorieGoal) * 100);
  const protPercent = Math.min(100, (totalProt / appState.settings.proteinGoal) * 100);
  
  // Real calculation score based on performance
  const score = Math.round((calPercent + protPercent) / 2);
  
  // HTML elements check to safely avoid crashes
  const scoreBadge = document.getElementById('score-value') || document.querySelector('.score-badge');
  if(scoreBadge) scoreBadge.textContent = `${score}%`;

  let advice = "Your logs are empty today. Track some meals to get live insight suggestions!";
  if(todayLogs.length > 0) {
    if(totalCals > appState.settings.calorieGoal) {
      advice = `Alert: Calorie consumption is slightly over-budget. Stick to protein-only snacks for the remaining part of the day.`;
    } else {
      advice = `Good tracking! You are currently at ${score}% of your goals. Keep eating clean!`;
    }
  }

  const coachAdviceText = document.getElementById('coach-advice-text');
  if(coachAdviceText) coachAdviceText.textContent = advice;
}

// --- SAVE SETTINGS ---
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
  showToast('Settings Saved!');
}

function incrementWater(amt) {
  const today = new Date().toISOString().split('T')[0];
  let log = appState.waterLogs.find(w => w.date === today);
  if(log) { log.amount = Math.max(0, log.amount + amt); } 
  else { log = { date: today, amount: Math.max(0, amt), timestamp: new Date().toISOString() }; appState.waterLogs.push(log); }
  
  saveLocalState();
  renderWaterTracker();

  if(!appState.isGuest && appState.settings.gasUrl) {
    try {
      fetch(appState.settings.gasUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'log_water', userId: appState.user.id, amount: amt, date: today })
      });
    } catch(e) {}
  }
}

function setupNavigation() {
  document.querySelectorAll('.nav-menu a, #mobile-nav a').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.getAttribute('data-view');
      document.querySelectorAll('.view-section').forEach(v => v.classList.remove('active'));
      const targetView = document.getElementById(target);
      if(targetView) targetView.classList.add('active');
      if(target === 'timeline-view') renderTimeline();
    });
  });
}

function initTheme() {
  document.body.classList.toggle('dark-theme', appState.settings.theme === 'dark');
}
