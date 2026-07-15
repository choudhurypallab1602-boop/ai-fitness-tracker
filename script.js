/**
 * Aura Pro — Production Grade Stable Synchronization Engine (V3)
 */

const appState = {
  user: null,
  isGuest: true,
  logs: [],
  waterLogs: [],
  settings: { calorieGoal: 2000, proteinGoal: 120, waterGoal: 2000, theme: 'light', units: 'metric', gasUrl: '', geminiKey: '' },
  selectedTimelineDate: new Date().toISOString().split('T')[0]
};

function showToast(message, type = 'success') {
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
  injectEditModalHTML(); // Setup dynamic edit UI overlay
  injectCalendarFilterHTML(); // Setup Dates/Weeks navigation shell
  
  renderDashboard();
  renderTimeline();
  renderWaterTracker();
  updateCoachAdvice();
  
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

  // Premium PDF styling and trigger
  const exportBtn = document.getElementById('dashboard-export-pdf');
  if(exportBtn) {
    exportBtn.style = "background:linear-gradient(135deg, #1565c0, #1e88e5); color:#fff; border:none; padding:10px 18px; border-radius:8px; font-weight:600; cursor:pointer; display:inline-flex; align-items:center; gap:8px; transition:transform 0.2s;";
    exportBtn.addEventListener('click', () => {
      showToast('Preparing health analytics report...');
      window.print();
    });
  }
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
  document.getElementById('user-status-text').textContent = appState.isGuest ? 'Offline Local Cache' : 'Google Sheet Realtime Sync';
  await fetchDataFromServer();
}

// --- CLOUD SYNC: RETRIEVE HISTORICAL SHEETS ---
async function fetchDataFromServer() {
  if (appState.isGuest || !appState.settings.gasUrl) return;
  showToast('Connecting with Google Sheet cloud server...');
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
      showToast('All historical data imported and synced!');
    }
  } catch (e) {
    showToast('Offline Mode. Loaded cached localized data.', 'warning');
  }
}

// --- SMART LOCAL MATHEMATICS PARSER ---
function parseMealFallback(text) {
  let calories = 300; // Default if nothing matches
  let protein = 15;
  
  // Custom smart text parsers for direct calorie/protein declarations
  const calMatch = text.match(/(\d+)\s*(?:kcal|calories|cal)/i);
  const protMatch = text.match(/(\d+)\s*(?:g\s*protein|g\s*p|grams\s*protein)/i);
  
  if (calMatch) calories = parseInt(calMatch[1]);
  if (protMatch) protein = parseInt(protMatch[1]);
  
  // Match foods item list
  const foods = text.split(/with|and|,/gi)[0].trim();
  
  return { foods, calories, protein, confidence: 90 };
}

// --- SUBMIT TRANSACTION ---
async function handleMealSubmission() {
  const box = document.getElementById('meal-input-box');
  const text = box.value.trim();
  if(!text) return;
  
  box.value = '';
  showToast('Analyzing and logging meal...', 'warning');
  const timestamp = new Date().toISOString();
  
  let parsedResult = parseMealFallback(text);

  // Parse with Gemini AI model if available
  if (appState.settings.geminiKey) {
    try {
      const prompt = `Analyze: "${text}". Output only JSON: {"foods": "item names", "calories": number, "protein": number, "confidence": 95}`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${appState.settings.geminiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json' } })
      });
      const resData = await res.json();
      parsedResult = JSON.parse(resData.candidates[0].content.parts[0].text.trim());
    } catch(e) {
      console.log("Gemini parsed failed, using offline regex parser.");
    }
  }

  let mealItem = {
    id: 'meal_' + Date.now(),
    rawText: text, 
    foods: parsedResult.foods, 
    calories: parsedResult.calories, 
    protein: parsedResult.protein, 
    confidence: parsedResult.confidence || 85,
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
          foods: mealItem.foods,
          calories: mealItem.calories,
          protein: mealItem.protein,
          confidence: mealItem.confidence,
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
  showToast(`Logged ${mealItem.calories} kcal!`);
}

// --- DYNAMIC WEEKLY/MONTHLY CALENDAR NAVIGATION ---
function injectCalendarFilterHTML() {
  const container = document.getElementById('timeline-view');
  if(!container) return;
  
  // Search if calendar block already loaded
  if(document.getElementById('dynamic-date-scroller')) return;
  
  const scroller = document.createElement('div');
  scroller.id = 'dynamic-date-scroller';
  scroller.style = "background:var(--card-bg); padding:16px; border-radius:12px; margin-bottom:16px; display:flex; gap:10px; align-items:center; justify-content:space-between; box-shadow:0 2px 8px rgba(0,0,0,0.05);";
  scroller.innerHTML = `
    <div>
      <span style="font-weight:600; font-size:14px; display:block; margin-bottom:4px;">📅 Jump to Date (Scroll History)</span>
      <input type="date" id="history-date-picker" style="border:1px solid #ddd; padding:6px 12px; border-radius:6px;" />
    </div>
    <div style="display:flex; gap:6px;">
      <button id="btn-show-all-dates" style="background:#f5f5f5; color:#333; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-size:12px; font-weight:600;">Show All History</button>
    </div>
  `;
  container.insertBefore(scroller, container.firstChild);

  document.getElementById('history-date-picker').value = appState.selectedTimelineDate;
  document.getElementById('history-date-picker').addEventListener('change', (e) => {
    appState.selectedTimelineDate = e.target.value;
    renderTimeline();
  });
  document.getElementById('btn-show-all-dates').addEventListener('click', () => {
    appState.selectedTimelineDate = null;
    renderTimeline();
  });
}

// --- RENDER TIMELINE ENTRIES ---
function renderTimeline() {
  const container = document.getElementById('timeline-logs-list');
  if(!container) return;
  
  let list = [...appState.logs];
  if(appState.selectedTimelineDate) {
    list = list.filter(l => l.date === appState.selectedTimelineDate);
  }

  container.innerHTML = list.length === 0 ? `<p style="text-align:center;padding:30px;color:#888;">No entries recorded ${appState.selectedTimelineDate ? 'on ' + appState.selectedTimelineDate : 'yet'}. Use date selector to jump/scroll.</p>` : '';
  
  list.sort((a,b)=>b.timestamp.localeCompare(a.timestamp)).forEach(log => {
    const item = document.createElement('div');
    item.style = "background:var(--card-bg); padding:16px; border-radius:12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 8px rgba(0,0,0,0.05);";
    item.innerHTML = `
      <div>
        <small style="color:#777; font-weight:500;">📅 ${log.date} | ⏰ ${log.time}</small>
        <div style="font-weight:600; margin-top:4px; font-size:15px; color:var(--text-color);">${log.rawText}</div>
        <span style="font-size:12px; background:#e3f2fd; color:#1565c0; padding:3px 8px; border-radius:4px; margin-top:6px; display:inline-block; font-weight:600;">${log.calories} kcal | ${log.protein}g Protein</span>
      </div>
      <div style="display:flex; gap:6px;">
        <button onclick="window.openEditMealModal('${log.id}')" style="background:#f5f5f5; border:none; padding:8px 12px; border-radius:6px; cursor:pointer;">✏️ Edit</button>
        <button onclick="window.deleteMeal('${log.id}')" style="background:#ffebee; color:#c62828; border:none; padding:8px 12px; border-radius:6px; cursor:pointer; font-weight:600;">❌ Delete</button>
      </div>
    `;
    container.appendChild(item);
  });
}

// --- DYNAMIC EDIT OVERLAY ---
function injectEditModalHTML() {
  if(document.getElementById('edit-meal-modal')) return;
  const m = document.createElement('div');
  m.id = 'edit-meal-modal';
  m.style = "position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0,0,0,0.5); display:none; align-items:center; justify-content:center; z-index:100000; padding:16px;";
  m.innerHTML = `
    <div style="background:var(--card-bg, #fff); padding:24px; border-radius:16px; width:100%; max-width:400px; box-shadow:0 10px 30px rgba(0,0,0,0.2);">
      <h3 style="margin-top:0; margin-bottom:16px; font-size:18px;">✏️ Update Log Entry</h3>
      <input type="hidden" id="edit-meal-id" />
      <div style="margin-bottom:12px;">
        <label style="display:block; font-size:12px; margin-bottom:4px; font-weight:600;">Meal Details</label>
        <input type="text" id="edit-meal-desc" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" />
      </div>
      <div style="margin-bottom:12px;">
        <label style="display:block; font-size:12px; margin-bottom:4px; font-weight:600;">Calories (kcal)</label>
        <input type="number" id="edit-meal-calories" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" />
      </div>
      <div style="margin-bottom:16px;">
        <label style="display:block; font-size:12px; margin-bottom:4px; font-weight:600;">Protein (g)</label>
        <input type="number" id="edit-meal-protein" style="width:100%; padding:8px; border:1px solid #ddd; border-radius:6px;" />
      </div>
      <div style="display:flex; justify-content:flex-end; gap:8px;">
        <button id="edit-modal-cancel" style="background:#eee; border:none; padding:8px 16px; border-radius:6px; cursor:pointer;">Cancel</button>
        <button id="edit-modal-save" style="background:#1565c0; color:#fff; border:none; padding:8px 16px; border-radius:6px; cursor:pointer; font-weight:600;">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(m);

  document.getElementById('edit-modal-cancel').addEventListener('click', () => { m.style.display = 'none'; });
  document.getElementById('edit-modal-save').addEventListener('click', () => saveMealEdit());
}

window.openEditMealModal = function(mealId) {
  const log = appState.logs.find(l => String(l.id) === String(mealId));
  if (!log) return;
  document.getElementById('edit-meal-id').value = log.id;
  document.getElementById('edit-meal-desc').value = log.rawText;
  document.getElementById('edit-meal-calories').value = log.calories;
  document.getElementById('edit-meal-protein').value = log.protein;
  document.getElementById('edit-meal-modal').style.display = 'flex';
};

async function saveMealEdit() {
  const id = document.getElementById('edit-meal-id').value;
  const desc = document.getElementById('edit-meal-desc').value;
  const cal = Number(document.getElementById('edit-meal-calories').value);
  const prot = Number(document.getElementById('edit-meal-protein').value);

  const log = appState.logs.find(l => String(l.id) === String(id));
  if (log) {
    log.rawText = desc;
    log.calories = cal;
    log.protein = prot;
  }

  document.getElementById('edit-meal-modal').style.display = 'none';
  saveLocalState();
  renderDashboard();
  renderTimeline();
  updateCoachAdvice();

  if (!appState.isGuest && appState.settings.gasUrl) {
    try {
      await fetch(appState.settings.gasUrl, {
        method: 'POST',
        body: JSON.stringify({ action: 'edit_meal', userId: appState.user.id, mealId: id, rawText: desc, calories: cal, protein: prot })
      });
      showToast('Log entry updated in Google Sheets!');
    } catch(e) {}
  }
}

window.deleteMeal = async function(mealId) {
  showToast('Removing entry...', 'warning');
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
      showToast('Deleted from Google Sheet!');
    } catch(e){}
  }
};

// --- DYNAMIC AI COACH & NUTRITION SCORE ---
function updateCoachAdvice() {
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = appState.logs.filter(l => l.date === today);
  const totalCals = todayLogs.reduce((sum, l) => sum + l.calories, 0);
  const totalProt = todayLogs.reduce((sum, l) => sum + l.protein, 0);

  // Calorie & Protein Goal Deviations
  const calPercent = Math.min(100, (totalCals / appState.settings.calorieGoal) * 100);
  const protPercent = Math.min(100, (totalProt / appState.settings.proteinGoal) * 100);
  
  // Calculate True Nutrition Score
  const score = Math.round((calPercent + protPercent) / 2);
  
  // Update UI Elements
  const scoreBox = document.getElementById('health-score-val') || document.querySelector('.score-badge');
  if(scoreBox) scoreBox.textContent = `${score}%`;

  let advice = '';
  if (todayLogs.length === 0) {
    advice = "Your logs are empty today. Add meals to calculate nutrition analytics and get coach suggestions.";
  } else if (totalCals > appState.settings.calorieGoal) {
    advice = `Warning: You have exceeded your daily calorie goal of ${appState.settings.calorieGoal} kcal. Focus on high-protein, low-calorie items like grilled protein or veggies for the rest of the day.`;
  } else if (totalProt < appState.settings.proteinGoal * 0.5) {
    advice = `Your current protein is low (${totalProt}g / ${appState.settings.proteinGoal}g). Consider adding protein sources like egg whites, tofu, or lean chicken.`;
  } else {
    advice = `Excellent balance! You have successfully reached ${score}% of your nutrition targets. Maintain your hydration levels.`;
  }

  const coachContainer = document.getElementById('coach-advice-text');
  if(coachContainer) coachContainer.textContent = advice;
}

// --- WATER CALCULATOR ---
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

// --- RE-RENDER DOM DASHBOARD ---
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


