/**
 * Aura Pro — Application Core Logic (Updated & Optimized)
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
    coachingNotes: "Your logs are empty. Let's log some meals today to analyze your dietary patterns.",
    scoreDailyEstimate: 0,
    alerts: [],
    suggestions: []
  },
  activeSwaps: [],
  activeView: 'dashboard-view'
};

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
  loadLocalState();
  initTheme();
  setupNavigation();
  setupEventListeners();
  setupGoogleLogin();
  
  // Refresh UI based on state
  renderDashboard();
  renderTimeline();
  renderAnalytics();
  renderWaterTracker();
  renderCoachView();
  
  if (appState.user || localStorage.getItem('aura_session_active') === 'true') {
    hideAuthOverlay();
  }
});

// --- STATE MANAGEMENT ---
function loadLocalState() {
  // Load settings
  const savedSettings = localStorage.getItem('aura_settings');
  if (savedSettings) {
    appState.settings = { ...appState.settings, ...JSON.parse(savedSettings) };
  }
  
  // Load session
  const savedUser = localStorage.getItem('aura_user');
  if (savedUser) {
    appState.user = JSON.parse(savedUser);
    appState.isGuest = localStorage.getItem('aura_is_guest') === 'true';
  } else {
    appState.isGuest = true;
    appState.user = { id: 'guest_user', name: 'Guest User', email: 'guest@aurapro.local', avatar: '' };
  }

  // Load offline data fallback
  const savedLogs = localStorage.getItem(`aura_logs_${appState.user.id}`);
  if (savedLogs) {
    appState.logs = JSON.parse(savedLogs);
  }

  const savedWater = localStorage.getItem(`aura_water_${appState.user.id}`);
  if (savedWater) {
    appState.waterLogs = JSON.parse(savedWater);
  }

  const savedSwaps = localStorage.getItem(`aura_swaps_${appState.user.id}`);
  if (savedSwaps) {
    appState.activeSwaps = JSON.parse(savedSwaps);
  }

  const savedCoach = localStorage.getItem(`aura_coach_${appState.user.id}`);
  if (savedCoach) {
    appState.coachAdvice = JSON.parse(savedCoach);
  }

  // Update Settings Form Fields safely
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };
  
  setVal('settings-calorie-goal', appState.settings.calorieGoal);
  setVal('settings-protein-goal', appState.settings.proteinGoal);
  setVal('settings-water-goal', appState.settings.waterGoal);
  setVal('settings-theme', appState.settings.theme);
  setVal('settings-units', appState.settings.units);
  setVal('settings-gas-url', appState.settings.gasUrl);
  setVal('settings-gemini-key', appState.settings.geminiKey);
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

// --- GOOGLE SIGN IN INTEGRATION ---
function setupGoogleLogin() {
  setTimeout(() => {
    if (typeof google !== 'undefined') {
      google.accounts.id.initialize({
        client_id: '98457223405-sampleclientid.apps.googleusercontent.com',
        callback: handleGoogleCredentialResponse
      });
      const loginBtn = document.getElementById('g-signin-button');
      if (loginBtn) {
        google.accounts.id.renderButton(loginBtn, { theme: 'outline', size: 'large', width: 280 });
      }
    }
  }, 1000);
}

function handleGoogleCredentialResponse(response) {
  try {
    const payload = decodeJwt(response.credential);
    appState.isGuest = false;
    appState.user = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      avatar: payload.picture
    };
    localStorage.setItem('aura_session_active', 'true');
    saveLocalState();
    updateProfileBox();
    hideAuthOverlay();
    fetchDataFromServer();
    showToast(`Welcome back, ${payload.given_name || payload.name}!`);
  } catch (error) {
    console.error('JWT decoding failed:', error);
    showToast('Failed to authenticate with Google. Continuing as Guest.', 'warning');
  }
}

function decodeJwt(token) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
    return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
  }).join(''));
  return JSON.parse(jsonPayload);
}

// --- USER ACTIONS ---
function setupEventListeners() {
  const addEv = (id, event, cb) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener(event, cb);
  };

  addEv('guest-login-btn', 'click', () => {
    appState.isGuest = true;
    appState.user = { id: 'guest_user', name: 'Guest User', email: 'guest@aurapro.local', avatar: '' };
    localStorage.setItem('aura_session_active', 'true');
    saveLocalState();
    updateProfileBox();
    hideAuthOverlay();
    showToast('Signed in as Guest. Data stored locally.');
  });

  addEv('credentials-login-form', 'submit', (e) => {
    e.preventDefault();
    const usernameInput = document.getElementById('login-username').value.trim();
    const passwordInput = document.getElementById('login-password').value.trim();

    if (usernameInput.toLowerCase() === 'pallab' && passwordInput === '2570') {
      appState.isGuest = false;
      appState.user = { id: 'pallab_user', name: 'Pallab', email: 'pallab@aurapro.local', avatar: '' };
      localStorage.setItem('aura_session_active', 'true');
      saveLocalState();
      updateProfileBox();
      hideAuthOverlay();
      showToast('Signed in successfully! Welcome, Pallab.');
    } else {
      showToast('Invalid credentials. Hint: Pallab / 2570', 'error');
    }
  });

  addEv('logout-button', 'click', () => {
    localStorage.removeItem('aura_session_active');
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('auth-view').style.display = 'flex';
    showToast('Signed out successfully.');
  });

  addEv('submit-meal-btn', 'click', () => {
    handleMealSubmission();
  });

  addEv('voice-record-btn', 'click', () => {
    toggleVoiceRecording();
  });

  addEv('settings-save-btn', 'click', () => {
    saveSettingsForm();
  });

  addEv('planner-submit-btn', 'click', () => {
    generateDietPlan();
  });

  addEv('dashboard-export-pdf', 'click', () => {
    window.print();
  });

  addEv('decrement-water-btn', 'click', () => {
    incrementWater(-250);
  });

  addEv('timeline-search-input', 'input', () => {
    renderTimeline();
  });
  
  addEv('timeline-date-filter', 'change', () => {
    renderTimeline();
  });

  addEv('edit-modal-cancel', 'click', () => {
    document.getElementById('edit-meal-modal').classList.remove('active');
  });
  
  addEv('edit-meal-form', 'submit', (e) => {
    e.preventDefault();
    saveMealEdit();
  });
}

// --- ROUTING / VIEW SWITCHER ---
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item, .mobile-nav-item');
  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = item.getAttribute('data-view');
      switchView(targetView);
    });
  });
}

function switchView(viewId) {
  document.querySelectorAll('.view-section').forEach(view => {
    view.classList.remove('active');
  });

  const targetViewEl = document.getElementById(viewId);
  if (targetViewEl) {
    targetViewEl.classList.add('active');
    appState.activeView = viewId;
  }

  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(btn => {
    if (btn.getAttribute('data-view') === viewId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (viewId === 'timeline-view') {
    renderTimeline();
  } else if (viewId === 'analytics-view') {
    renderAnalytics();
  } else if (viewId === 'coach-view') {
    renderCoachView();
  } else if (viewId === 'dashboard-view') {
    renderDashboard();
    renderWaterTracker();
  }
}

// --- VIEW UPDATES & PROFILE RENDER ---
function hideAuthOverlay() {
  document.getElementById('auth-view').style.display = 'none';
  document.getElementById('app-container').style.display = 'flex';
  updateProfileBox();
  fetchDataFromServer();
}

function updateProfileBox() {
  const nameEl = document.getElementById('user-display-name');
  const statusEl = document.getElementById('user-status-text');
  const avatarEl = document.getElementById('user-avatar-initials');

  if (nameEl) nameEl.textContent = appState.user.name;
  if (statusEl) statusEl.textContent = appState.isGuest ? 'Offline Cache' : 'Cloud Sync';
  
  if (avatarEl) {
    if (appState.user.avatar) {
      avatarEl.innerHTML = `<img src="${appState.user.avatar}" alt="Avatar">`;
    } else {
      avatarEl.textContent = appState.user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    }
  }
}

// --- THEME ENGINE ---
function initTheme() {
  if (appState.settings.theme === 'dark') {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
}

// --- SERVERSIDE LOG FETCHING ---
async function fetchDataFromServer() {
  if (appState.isGuest || !appState.settings.gasUrl) {
    return;
  }

  try {
    const payload = {
      action: 'get_logs',
      userId: appState.user.id
    };

    const response = await fetch(appState.settings.gasUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data.success) {
      appState.logs = data.logs;
      appState.waterLogs = data.waterLogs || [];
      saveLocalState();
      renderDashboard();
      renderTimeline();
      renderAnalytics();
      renderWaterTracker();
    }
  } catch (error) {
    console.error('Server sync failed, running in local mode:', error);
    showToast('Failed to connect to spreadsheet. Using offline data.', 'warning');
  }
}

// --- MEAL SUBMISSION ---
async function handleMealSubmission() {
  const inputEl = document.getElementById('meal-input-box');
  if (!inputEl) return;
  const text = inputEl.value.trim();
  
  if (!text) {
    showToast('Please type or describe your meal first.', 'warning');
    return;
  }

  showToast('Processing meal with AI...');
  inputEl.value = '';
  
  const timestamp = new Date().toISOString();
  let parsedMealResult;

  if (!appState.isGuest && appState.settings.gasUrl) {
    try {
      const response = await fetch(appState.settings.gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'log_meal',
          userId: appState.user.id,
          rawText: text,
          timestamp: timestamp
        })
      });
      const data = await response.json();
      if (data.success) {
        parsedMealResult = {
          meal: data.meal,
          swaps: data.swaps
        };
      } else {
        throw new Error(data.error);
      }
    } catch (e) {
      console.error(e);
      showToast('Cloud parse failed, using local AI fallback.', 'warning');
      parsedMealResult = await parseMealLocally(text, timestamp);
    }
  } else {
    parsedMealResult = await parseMealLocally(text, timestamp);
  }

  if (parsedMealResult && parsedMealResult.meal) {
    appState.logs.push(parsedMealResult.meal);
    
    if (parsedMealResult.swaps && parsedMealResult.swaps.length > 0) {
      parsedMealResult.swaps.forEach(s => {
        appState.activeSwaps.push({
          ...s,
          date: timestamp.split('T')[0]
        });
      });
      renderActiveSwapsBanner(parsedMealResult.swaps);
    }

    saveLocalState();
    triggerCoachUpdate();
    renderDashboard();
    showToast(`Logged: ${parsedMealResult.meal.foods} (${parsedMealResult.meal.calories} kcal)`);
  } else {
    showToast('Failed to analyze food description. Check internet or API key.', 'warning');
  }
}

// --- LOCAL AI AND HEURISTIC PARSER ---
async function parseMealLocally(text, timestamp) {
  const dateStr = timestamp.split('T')[0];
  const timeStr = timestamp.split('T')[1].substring(0, 5);

  if (appState.settings.geminiKey) {
    try {
      const prompt = `You are a professional nutrition parser. Parse this food query: "${text}".
Generate a JSON object. Ensure all numerical estimations are as accurate as possible for calories and protein. Respond with EXACTLY this JSON structure without markdown code blocks:
{
  "foods": "a clean comma-separated list of items",
  "calories": number,
  "protein": number,
  "confidence": number (0 to 100 representing certainty of estimation),
  "swaps": [
    { "unhealthy": "item from rawText that is high in calories, trans fats, sugar, or processed", "healthyAlternatives": ["alt1", "alt2", "alt3"], "reason": "a gentle non-judgmental explanation" }
  ]
}`;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${appState.settings.geminiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json' }
        })
      });
      const data = await response.json();
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        const parsed = JSON.parse(data.candidates[0].content.parts[0].text.trim());
        return {
          meal: {
            id: 'meal_' + new Date().getTime(),
            rawText: text,
            foods: parsed.foods,
            calories: Number(parsed.calories),
            protein: Number(parsed.protein),
            confidence: Number(parsed.confidence),
            date: dateStr,
            time: timeStr,
            timestamp: timestamp
          },
          swaps: parsed.swaps || []
        };
      }
    } catch (e) {
      console.error('Client Gemini query failed, falling back to heuristics:', e);
    }
  }

  const dictionary = [
    { regex: /egg/i, name: 'Eggs', cal: 70, prot: 6 },
    { regex: /bread|roti/i, name: 'Bread/Roti', cal: 80, prot: 3 },
    { regex: /chicken|breast/i, name: 'Chicken Breast', cal: 165, prot: 31 },
    { regex: /rice/i, name: 'White Rice', cal: 130, prot: 2.5 },
    { regex: /paneer/i, name: 'Paneer', cal: 265, prot: 18 },
    { regex: /biryani/i, name: 'Biryani', cal: 500, prot: 15, unhealthy: true, swaps: ['Paneer bowl', 'Brown rice pilaf', 'Sprouts mix'], reason: 'Biryani is delicious but relatively high in refined oil and white rice carbs.' },
    { regex: /samosa/i, name: 'Samosa', cal: 260, prot: 3, unhealthy: true, swaps: ['Egg sandwich', 'Paneer sandwich', 'Moong Sprouts salad'], reason: 'Samosas are deep fried. Sprouted beans or egg sandwich offer clean protein.' },
    { regex: /pizza/i, name: 'Pizza slice', cal: 280, prot: 11, unhealthy: true, swaps: ['Whole wheat wrap', 'Chicken salad', 'Sourdough toast'], reason: 'Processed white flour base and cheese fats.' },
    { regex: /milk|latte/i, name: 'Milk', cal: 120, prot: 6 },
    { regex: /tea|chai/i, name: 'Chai', cal: 60, prot: 1 },
    { regex: /salad/i, name: 'Mixed Green Salad', cal: 110, prot: 2 },
    { regex: /dal|lentil/i, name: 'Lentils (Dal)', cal: 150, prot: 9 },
    { regex: /apple|banana|orange|fruit/i, name: 'Fruit', cal: 80, prot: 0.5 },
    { regex: /protein shake|powder/i, name: 'Protein Shake', cal: 140, prot: 25 }
  ];

  let cals = 0;
  let prot = 0;
  let matches = [];
  let swaps = [];

  let qty = 1;
  const numbers = text.match(/\d+/);
  if (numbers) {
    qty = parseInt(numbers[0]);
  }

  dictionary.forEach(item => {
    if (item.regex.test(text)) {
      cals += item.cal * qty;
      prot += item.prot * qty;
      matches.push(`${qty}x ${item.name}`);
      if (item.unhealthy) {
        swaps.push({
          unhealthy: item.name,
          healthyAlternatives: item.swaps,
          reason: item.reason
        });
      }
    }
  });

  if (matches.length === 0) {
    cals = 250;
    prot = 10;
    matches.push(text);
  }

  return {
    meal: {
      id: 'meal_' + new Date().getTime(),
      rawText: text,
      foods: matches.join(', '),
      calories: cals,
      protein: prot,
      confidence: 65,
      date: dateStr,
      time: timeStr,
      timestamp: timestamp
    },
    swaps: swaps
  };
}

// --- VOICE LOGGER CONTROLS ---
let recognition;
let isRecording = false;

function toggleVoiceRecording() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    showToast('Your browser does not support Speech Recognition. Please type your meal.', 'warning');
    return;
  }

  const recordBtn = document.getElementById('voice-record-btn');
  const statusEl = document.getElementById('voice-status');

  if (!recordBtn || !statusEl) return;

  if (isRecording) {
    recognition.stop();
    isRecording = false;
    recordBtn.classList.remove('recording');
    statusEl.style.visibility = 'hidden';
  } else {
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => {
      isRecording = true;
      recordBtn.classList.add('recording');
      statusEl.style.visibility = 'visible';
      statusEl.textContent = 'Listening...';
    };

    recognition.onerror = (e) => {
      console.error(e);
      showToast('Speech recognition failed. Try speaking clearly.', 'warning');
      isRecording = false;
      recordBtn.classList.remove('recording');
      statusEl.style.visibility = 'hidden';
    };

    recognition.onend = () => {
      isRecording = false;
      recordBtn.classList.remove('recording');
      statusEl.style.visibility = 'hidden';
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      const inputEl = document.getElementById('meal-input-box');
      if (inputEl) inputEl.value = transcript;
      showToast('Parsed voice transcription!');
    };

    recognition.start();
  }
}

// --- UPDATE ACTIVE SWAPS GRAPHICS ---
function renderActiveSwapsBanner(swaps) {
  const container = document.getElementById('quick-swap-container');
  if (!container) return;
  container.innerHTML = '';
  
  if (!swaps || swaps.length === 0) return;

  swaps.forEach(swap => {
    const el = document.createElement('div');
    el.className = 'swap-alert';
    el.innerHTML = `
      <div class="swap-icon">💡</div>
      <div class="swap-content">
        <h4>Consider Swap for: ${swap.unhealthy}</h4>
        <p>${swap.reason}</p>
        <div class="swap-list">
          ${swap.healthyAlternatives.map(alt => `<span class="swap-pill">🥗 ${alt}</span>`).join('')}
        </div>
      </div>
    `;
    container.appendChild(el);
  });
}

// --- DYNAMIC AI COACH CALLS ---
async function triggerCoachUpdate() {
  if (appState.logs.length === 0) return;

  if (!appState.isGuest && appState.settings.gasUrl) {
    try {
      const response = await fetch(appState.settings.gasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_coach_advice',
          userId: appState.user.id
        })
      });
      const data = await response.json();
      if (data.success) {
        appState.coachAdvice = data.coachAdvice;
        saveLocalState();
        renderCoachView();
        return;
      }
    } catch (e) {
      console.error('Cloud coach fetch failed:', e);
    }
  }

  const today = new Date().toISOString().split('T')[0];
  const todayLogs = appState.logs.filter(l => l.date === today);
  const totalCals = todayLogs.reduce((sum, l) => sum + l.calories, 0);
  const totalProt = todayLogs.reduce((sum, l) => sum + l.protein, 0);

  let score = 50;
  let notes = 'Welcome to Aura! Log more meals so we can analyze your nutritional distribution trends.';
  let alerts = [];
  let suggestions = [];

  if (todayLogs.length > 0) {
    score = 75;
    if (totalCals > appState.settings.calorieGoal) {
      score -= 15;
      alerts.push('Calorie intake has exceeded your configured limit.');
      suggestions.push({ target: 'Calorie Limit', improvement: 'Swap heavy carbohydrates for fibrous greens in dinner.' });
    } else if (totalCals > appState.settings.calorieGoal * 0.8) {
      score += 10;
    }

    if (totalProt < appState.settings.proteinGoal * 0.7) {
      score -= 15;
      alerts.push('Protein intake is slightly below optimal parameters today.');
      suggestions.push({ target: 'Protein', improvement: 'Incorporate Greek yogurt, lean eggs, tofu, or lean proteins into your meals.' });
    } else {
      score += 15;
    }

    if (appState.activeSwaps.filter(s => s.date === today).length > 0) {
      score -= 10;
      alerts.push('Detected processed/high-fat ingredients in logged meals.');
      suggestions.push({ target: 'Meal Balance', improvement: 'Swap simple sugars for low GI foods to flatten energy curve spikes.' });
    }

    score = Math.min(100, Math.max(0, score));

    if (score >= 90) {
      notes = "A perfect day! Outstanding balance. You've hit your protein objectives cleanly while maintaining a sensible calorie margin. Carry this momentum forward!";
    } else if (score >= 70) {
      notes = 'Highly balanced day. Calorie ceilings have been respected, and protein levels are healthy. Keep tracking to fine-tune energy and satiety.';
    } else {
      notes = 'A developmental day. Focus on packing structured lean proteins early to manage hunger signals and avoid blood sugar spikes later in the evening.';
    }
  }

  appState.coachAdvice = {
    coachingNotes: notes,
    scoreDailyEstimate: score,
    alerts: alerts,
    suggestions: suggestions
  };

  saveLocalState();
  renderCoachView();
}

// --- RENDER FUNCTIONS ---

// 1. Dashboard View
function renderDashboard() {
  const today = new Date().toISOString().split('T')[0];
  const todayLogs = appState.logs.filter(l => l.date === today);

  const totalCals = todayLogs.reduce((sum, l) => sum + l.calories, 0);
  const totalProt = todayLogs.reduce((sum, l) => sum + l.protein, 0);

  const setHtml = (id, text) => {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  };

  setHtml('calorie-current', totalCals);
  setHtml('calorie-goal-val', appState.settings.calorieGoal);
  setHtml('protein-current', totalProt);
  setHtml('protein-goal-val', appState.settings.proteinGoal);

  const calDiff = appState.settings.calorieGoal - totalCals;
  const calDesc = document.getElementById('calorie-remaining-desc');
  if (calDesc) {
    if (calDiff >= 0) {
      calDesc.textContent = `${calDiff} kcal remaining`;
      calDesc.style.color = 'var(--text-secondary)';
    } else {
      calDesc.textContent = `${Math.abs(calDiff)} kcal over limit`;
      calDesc.style.color = 'var(--color-red, #e11d48)';
    }
  }

  const protDiff = appState.settings.proteinGoal - totalProt;
  const protDesc = document.getElementById('protein-remaining-desc');
  if (protDesc) {
    if (protDiff >= 0) {
      protDesc.textContent = `${protDiff} g remaining`;
      protDesc.style.color = 'var(--text-secondary)';
    } else {
      protDesc.textContent = `Goal met! (+${Math.abs(protDiff)} g)`;
      protDesc.style.color = 'var(--color-green, #0d9488)';
    }
  }

  const calPercent = Math.min(100, (totalCals / appState.settings.calorieGoal) * 100);
  const calBar = document.getElementById('calorie-progress-bar');
  if (calBar) {
    calBar.style.width = `${calPercent}%`;
    calBar.className = 'progress-bar-fill';
    if (totalCals > appState.settings.calorieGoal) {
      calBar.classList.add('red');
    } else if (totalCals > appState.settings.calorieGoal * 0.85) {
      calBar.classList.add('orange');
    } else {
      calBar.classList.add('green');
    }
  }

  const protPercent = Math.min(100, (totalProt / appState.settings.proteinGoal) * 100);
  const protBar = document.getElementById('protein-progress-bar');
  if (protBar) {
    protBar.style.width = `${protPercent}%`;
    protBar.className = 'progress-bar-fill';
    if (totalProt >= appState.settings.proteinGoal) {
      protBar.classList.add('green');
    } else if (totalProt >= appState.settings.proteinGoal * 0.5) {
      protBar.classList.add('orange');
    } else {
      protBar.classList.add('red');
    }
  }

  const scoreDisplay = document.getElementById('score-number-display');
  const ratingText = document.getElementById('score-rating-text');
  const ring = document.getElementById('score-ring');
  
  if (todayLogs.length > 0) {
    const score = appState.coachAdvice.scoreDailyEstimate || 70;
    if (scoreDisplay) scoreDisplay.textContent = score;
    
    if (ring) {
      const offset = 377 - (377 * score) / 100;
      ring.style.strokeDashoffset = offset;
    }

    if (ratingText) {
      if (score >= 90) {
        ratingText.textContent = 'Excellent Balance';
        ratingText.style.color = 'var(--color-green, #0d9488)';
      } else if (score >= 70) {
        ratingText.textContent = 'Good Balance';
        ratingText.style.color = 'var(--color-orange, #d97706)';
      } else {
        ratingText.textContent = 'Improvable Base';
        ratingText.style.color = 'var(--color-red, #e11d48)';
      }
    }
  } else {
    if (scoreDisplay) scoreDisplay.textContent = '0';
    if (ring) ring.style.strokeDashoffset = 377;
    if (ratingText) {
      ratingText.textContent = 'Awaiting logs';
      ratingText.style.color = 'var(--text-secondary)';
    }
  }

  const coachPreview = document.getElementById('dashboard-coach-preview');
  if (coachPreview && appState.coachAdvice.coachingNotes) {
    coachPreview.textContent = appState.coachAdvice.coachingNotes.substring(0, 140) + '...';
  }

  const dashboardTimeline = document.getElementById('dashboard-timeline-list');
  if (dashboardTimeline) {
    dashboardTimeline.innerHTML = '';
    if (todayLogs.length === 0) {
      dashboardTimeline.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px; text-align: center; padding: 16px;">No meals logged today yet.</p>';
    } else {
      todayLogs.slice(-3).reverse().forEach(log => {
        const item = document.createElement('div');
        item.className = 'timeline-item';
        item.innerHTML = `
          <div class="timeline-details">
            <span class="timeline-time">${log.time}</span>
            <span class="timeline-text">${log.rawText}</span>
            <span class="timeline-subdetails">${log.foods}</span>
          </div>
          <div class="timeline-macros">
            <span class="timeline-macro-pill">${log.calories} <span class="unit">kcal</span></span>
            <span class="timeline-macro-pill">${log.protein}g <span class="unit">pro</span></span>
          </div>
        `;
        dashboardTimeline.appendChild(item);
      });
    }
  }

  const dateStrEl = document.getElementById('dashboard-date-str');
  if (dateStrEl) {
    const options = { weekday: 'long', month: 'long', day: 'numeric' };
    dateStrEl.textContent = new Date().toLocaleDateString('en-US', options);
  }
}

// 2. Timeline View
function renderTimeline() {
  const container = document.getElementById('timeline-logs-list');
  if (!container) return;

  const searchEl = document.getElementById('timeline-search-input');
  const dateEl = document.getElementById('timeline-date-filter');
  
  const searchVal = searchEl ? searchEl.value.toLowerCase() : '';
  const dateVal = dateEl ? dateEl.value : '';

  container.innerHTML = '';

  let filtered = appState.logs;
  
  if (dateVal) {
    filtered = filtered.filter(l => l.date === dateVal);
  }
  
  if (searchVal) {
    filtered = filtered.filter(l => 
      l.rawText.toLowerCase().includes(searchVal) || 
      l.foods.toLowerCase().includes(searchVal) || 
      l.calories.toString().includes(searchVal)
    );
  }

  if (filtered.length === 0) {
    container.innerHTML = '<p style="color: var(--text-secondary); font-size: 13px; text-align: center; padding: 32px;">No logged items found matching criteria.</p>';
    return;
  }

  filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).forEach(log => {
    const el = document.createElement('div');
    el.className = 'timeline-item';
    el.innerHTML = `
      <div class="timeline-details">
        <span class="timeline-time">${log.date} @ ${log.time}</span>
        <span class="timeline-text">${log.rawText}</span>
        <span class="timeline-subdetails">${log.foods} (Confidence: ${log.confidence}%)</span>
      </div>
      <div class="timeline-macros">
        <span class="timeline-macro-pill">${log.calories} <span class="unit">kcal</span></span>
        <span class="timeline-macro-pill">${log.protein}g <span class="unit">pro</span></span>
      </div>
      <div class="timeline-actions">
        <button class="timeline-btn" onclick="openEditMealModal('${log.id}')" title="Edit">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        </button>
        <button class="timeline-btn delete" onclick="deleteMeal('${log.id}')" title="Delete">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      </div>
    `;
    container.appendChild(el);
  });
}

// 3. Analytics View & Canvas Draw
function renderAnalytics() {
  const avgCalEl = document.getElementById('stats-avg-calories');
  const avgProtEl = document.getElementById('stats-avg-protein');
  const peakCalEl = document.getElementById('stats-max-calorie-day');
  const lowCalEl = document.getElementById('stats-min-calorie-day');

  if (appState.logs.length === 0) {
    if (avgCalEl) avgCalEl.textContent = '0 kcal';
    if (avgProtEl) avgProtEl.textContent = '0 g';
    if (peakCalEl) peakCalEl.textContent = '—';
    if (lowCalEl) lowCalEl.textContent = '—';
    drawEmptyCharts();
    return;
  }

  const dailyData = {};
  appState.logs.forEach(log => {
    if (!dailyData[log.date]) {
      dailyData[log.date] = { calories: 0, protein: 0 };
    }
    dailyData[log.date].calories += log.calories;
    dailyData[log.date].protein += log.protein;
  });

  const dates = Object.keys(dailyData);
  const cals = dates.map(d => dailyData[d].calories);
  const prots = dates.map(d => dailyData[d].protein);

  const totalCals = cals.reduce((a, b) => a + b, 0);
  const totalProts = prots.reduce((a, b) => a + b, 0);

  if (avgCalEl) avgCalEl.textContent = `${Math.round(totalCals / dates.length)} kcal`;
  if (avgProtEl) avgProtEl.textContent = `${(totalProts / dates.length).toFixed(1)} g`;
  if (peakCalEl) {
    const maxVal = Math.max(...cals);
    const maxDate = dates[cals.indexOf(maxVal)];
    peakCalEl.textContent = `${maxVal} kcal (${maxDate})`;
  }
  if (lowCalEl) {
    const minVal = Math.min(...cals);
    const minDate = dates[cals.indexOf(minVal)];
    lowCalEl.textContent = `${minVal} kcal (${minDate})`;
  }

  drawTrendCharts(dates, cals, prots);
}

// --- HELPER COMPLEMENTARY PLACEHOLDERS ---
function renderWaterTracker() {
  // Logic hook for water tracking renders
}
function renderCoachView() {
  // Logic hook for coach panel renders
}
function drawEmptyCharts() {
  // Logic hook for empty analytics panels
}
function drawTrendCharts(dates, cals, prots) {
  // Logic hook for drawing trend analysis canvases
}
function openEditMealModal(id) {
  // Edit structural overlay handlers
}
function saveMealEdit() {
  // Inline edit state saves
}
function deleteMeal(id) {
  if (confirm('Delete this entry from database?')) {
    appState.logs = appState.logs.filter(l => l.id !== id);
    saveLocalState();
    triggerCoachUpdate();
    renderDashboard();
    renderTimeline();
    renderAnalytics();
  }
}
function saveSettingsForm() {
  const calVal = parseInt(document.getElementById('settings-calorie-goal').value);
  const protVal = parseInt(document.getElementById('settings-protein-goal').value);
  const waterVal = parseInt(document.getElementById('settings-water-goal').value);
  const themeVal = document.getElementById('settings-theme').value;
  const unitsVal = document.getElementById('settings-units').value;
  const gasUrlVal = document.getElementById('settings-gas-url').value;
  const geminiKeyVal = document.getElementById('settings-gemini-key').value;

  appState.settings = {
    calorieGoal: calVal,
    proteinGoal: protVal,
    waterGoal: waterVal,
    theme: themeVal,
    units: unitsVal,
    gasUrl: gasUrlVal,
    geminiKey: geminiKeyVal
  };

  saveLocalState();
  initTheme();
  triggerCoachUpdate();
  renderDashboard();
  showToast('Settings successfully updated.');
}
function incrementWater(amount) {
  // Water tracker operations
}
function generateDietPlan() {
  // Diet plan compiler
}
function showToast(message, type = 'success') {
  // Interface notification toast builder
  console.log(`[Toast ${type.toUpperCase()}]: ${message}`);
}
