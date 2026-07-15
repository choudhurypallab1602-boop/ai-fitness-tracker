/**
 * Aura Pro — Application Core Logic
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

  // Update Settings Form Fields
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

// --- GOOGLE SIGN IN INTEGRATION ---
function setupGoogleLogin() {
  // Wait for Google GSI Script to load
  setTimeout(() => {
    if (typeof google !== 'undefined') {
      google.accounts.id.initialize({
        client_id: '98457223405-sampleclientid.apps.googleusercontent.com', // Placeholder client ID, user can override or configure
        callback: handleGoogleCredentialResponse
      });
      google.accounts.id.renderButton(
        document.getElementById('g-signin-button'),
        { theme: 'outline', size: 'large', width: 280 }
      );
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
  // Guest Login Button
  document.getElementById('guest-login-btn').addEventListener('click', () => {
    appState.isGuest = true;
    appState.user = { id: 'guest_user', name: 'Guest User', email: 'guest@aurapro.local', avatar: '' };
    localStorage.setItem('aura_session_active', 'true');
    saveLocalState();
    updateProfileBox();
    hideAuthOverlay();
    showToast('Signed in as Guest. Data stored locally.');
  });

  // Custom Credentials Login Form
  document.getElementById('credentials-login-form').addEventListener('submit', (e) => {
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

  // Logout Button
  document.getElementById('logout-button').addEventListener('click', () => {
    localStorage.removeItem('aura_session_active');
    document.getElementById('app-container').style.display = 'none';
    document.getElementById('auth-view').style.display = 'flex';
    showToast('Signed out successfully.');
  });

  // Log Meal Submit Button
  document.getElementById('submit-meal-btn').addEventListener('click', () => {
    handleMealSubmission();
  });

  // Voice recording toggle
  document.getElementById('voice-record-btn').addEventListener('click', () => {
    toggleVoiceRecording();
  });

  // Save Settings Button
  document.getElementById('settings-save-btn').addEventListener('click', () => {
    saveSettingsForm();
  });

  // Generate Diet Plan Button
  document.getElementById('planner-submit-btn').addEventListener('click', () => {
    generateDietPlan();
  });

  // Export to PDF
  document.getElementById('dashboard-export-pdf').addEventListener('click', () => {
    window.print();
  });

  // Decrement Hydration Button
  document.getElementById('decrement-water-btn').addEventListener('click', () => {
    incrementWater(-250);
  });

  // Search input and Date filters for Timeline
  document.getElementById('timeline-search-input').addEventListener('input', () => {
    renderTimeline();
  });
  document.getElementById('timeline-date-filter').addEventListener('change', () => {
    renderTimeline();
  });

  // Edit Modal controls
  document.getElementById('edit-modal-cancel').addEventListener('click', () => {
    document.getElementById('edit-meal-modal').classList.remove('active');
  });
  document.getElementById('edit-meal-form').addEventListener('submit', (e) => {
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
  // Hide active views
  document.querySelectorAll('.view-section').forEach(view => {
    view.classList.remove('active');
  });

  // Show target view
  const targetViewEl = document.getElementById(viewId);
  if (targetViewEl) {
    targetViewEl.classList.add('active');
    appState.activeView = viewId;
  }

  // Update navigation visual states
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(btn => {
    if (btn.getAttribute('data-view') === viewId) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Specific render steps on view activate
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

  nameEl.textContent = appState.user.name;
  statusEl.textContent = appState.isGuest ? 'Offline Cache' : 'Cloud Sync';
  
  if (appState.user.avatar) {
    avatarEl.innerHTML = `<img src="${appState.user.avatar}" alt="Avatar">`;
  } else {
    avatarEl.textContent = appState.user.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
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
    return; // local state handles it
  }

  try {
    const payload = {
      action: 'get_logs',
      userId: appState.user.id
    };

    const response = await fetch(appState.settings.gasUrl, {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (data.success) {
      appState.logs = data.logs;
      // Convert backend date strings to proper timestamps if they are clean dates
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
  const text = inputEl.value.trim();
  
  if (!text) {
    showToast('Please type or describe your meal first.', 'warning');
    return;
  }

  showToast('Processing meal with AI...');
  inputEl.value = '';
  
  const tempId = 'log_' + new Date().getTime();
  const timestamp = new Date().toISOString();

  let parsedMealResult;

  // Decide how to parse
  if (!appState.isGuest && appState.settings.gasUrl) {
    // Cloud Mode
    try {
      const response = await fetch(appState.settings.gasUrl, {
        method: 'POST',
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
    // Guest Mode / Local Mode
    parsedMealResult = await parseMealLocally(text, timestamp);
  }

  if (parsedMealResult && parsedMealResult.meal) {
    appState.logs.push(parsedMealResult.meal);
    
    // Add swaps if triggered
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
    triggerCoachUpdate(); // Fetch updated advice from coach
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

  // If user provided client-side Gemini key
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

  // Smart Offline Fallback heuristic dictionary
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

  // Simple quantity extractor
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

  // Fallback defaults if no keywords matched
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
      confidence: 65, // simulated low confidence
      date: dateStr,
      time: timeStr,
      timestamp: timestamp
    },
    swaps: swaps
  };
}

// --- VOICE LOGGER CONTROLS (SPEECH SYNTHESIS/RECOGNITION) ---
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
      document.getElementById('meal-input-box').value = transcript;
      showToast('Parsed voice transcription!');
    };

    recognition.start();
  }
}

// --- UPDATE ACTIVE SWAPS GRAPHICS ---
function renderActiveSwapsBanner(swaps) {
  const container = document.getElementById('quick-swap-container');
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

  // Local/Guest Mode coach simulation
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

    // Swaps checking
    if (appState.activeSwaps.filter(s => s.date === today).length > 0) {
      score -= 10;
      alerts.push('Detected processed/high-fat ingredients in logged meals.');
      suggestions.push({ target: 'Meal Balance', improvement: 'Swap simple sugars for low GI foods to flatten energy curve spikes.' });
    }

    score = Math.min(100, Math.max(0, score));

    if (score >= 90) {
      notes = 'A perfect day! Outstanding balance. You\'ve hit your protein objectives cleanly while maintaining a sensible calorie margin. Carry this momentum forward!';
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

  // Set numbers
  document.getElementById('calorie-current').textContent = totalCals;
  document.getElementById('calorie-goal-val').textContent = appState.settings.calorieGoal;
  document.getElementById('protein-current').textContent = totalProt;
  document.getElementById('protein-goal-val').textContent = appState.settings.proteinGoal;

  // Calorie remaining logic
  const calDiff = appState.settings.calorieGoal - totalCals;
  const calDesc = document.getElementById('calorie-remaining-desc');
  if (calDiff >= 0) {
    calDesc.textContent = `${calDiff} kcal remaining`;
    calDesc.style.color = 'var(--text-secondary)';
  } else {
    calDesc.textContent = `${Math.abs(calDiff)} kcal over limit`;
    calDesc.style.color = 'var(--color-red)';
  }

  // Protein remaining logic
  const protDiff = appState.settings.proteinGoal - totalProt;
  const protDesc = document.getElementById('protein-remaining-desc');
  if (protDiff >= 0) {
    protDesc.textContent = `${protDiff} g remaining`;
    protDesc.style.color = 'var(--text-secondary)';
  } else {
    protDesc.textContent = `Goal met! (+${Math.abs(protDiff)} g)`;
    protDesc.style.color = 'var(--color-green)';
  }

  // Calorie Progress bar color
  const calPercent = Math.min(100, (totalCals / appState.settings.calorieGoal) * 100);
  const calBar = document.getElementById('calorie-progress-bar');
  calBar.style.width = `${calPercent}%`;
  calBar.className = 'progress-bar-fill';
  if (totalCals > appState.settings.calorieGoal) {
    calBar.classList.add('red');
  } else if (totalCals > appState.settings.calorieGoal * 0.85) {
    calBar.classList.add('orange');
  } else {
    calBar.classList.add('green');
  }

  // Protein Progress bar color
  const protPercent = Math.min(100, (totalProt / appState.settings.proteinGoal) * 100);
  const protBar = document.getElementById('protein-progress-bar');
  protBar.style.width = `${protPercent}%`;
  protBar.className = 'progress-bar-fill';
  if (totalProt >= appState.settings.proteinGoal) {
    protBar.classList.add('green');
  } else if (totalProt >= appState.settings.proteinGoal * 0.5) {
    protBar.classList.add('orange');
  } else {
    protBar.classList.add('red');
  }

  // Score Dashboard updates
  const scoreDisplay = document.getElementById('score-number-display');
  const ratingText = document.getElementById('score-rating-text');
  const ring = document.getElementById('score-ring');
  
  if (todayLogs.length > 0) {
    const score = appState.coachAdvice.scoreDailyEstimate || 70;
    scoreDisplay.textContent = score;
    
    // Animate SVG stroke dashoffset: radius is 60 -> circumference is 377
    const offset = 377 - (377 * score) / 100;
    ring.style.strokeDashoffset = offset;

    if (score >= 90) {
      ratingText.textContent = 'Excellent Balance';
      ratingText.style.color = 'var(--color-green)';
    } else if (score >= 70) {
      ratingText.textContent = 'Good Balance';
      ratingText.style.color = 'var(--color-orange)';
    } else {
      ratingText.textContent = 'Improvable Base';
      ratingText.style.color = 'var(--color-red)';
    }
  } else {
    scoreDisplay.textContent = '0';
    ring.style.strokeDashoffset = 377;
    ratingText.textContent = 'Awaiting logs';
    ratingText.style.color = 'var(--text-secondary)';
  }

  // Coach advice card updates
  document.getElementById('dashboard-coach-preview').textContent = 
    appState.coachAdvice.coachingNotes.substring(0, 140) + '...';

  // Render recent meals timeline (max 3 today)
  const dashboardTimeline = document.getElementById('dashboard-timeline-list');
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

  // Set date string
  const options = { weekday: 'long', month: 'long', day: 'numeric' };
  document.getElementById('dashboard-date-str').textContent = new Date().toLocaleDateString('en-US', options);
}

// 2. Timeline View
function renderTimeline() {
  const container = document.getElementById('timeline-logs-list');
  const searchVal = document.getElementById('timeline-search-input').value.toLowerCase();
  const dateVal = document.getElementById('timeline-date-filter').value;

  container.innerHTML = '';

  // Filter logs
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

  // Sort logs by date descending and time descending
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
    avgCalEl.textContent = '0 kcal';
    avgProtEl.textContent = '0 g';
    peakCalEl.textContent = '—';
    lowCalEl.textContent = '—';
    drawEmptyCharts();
    return;
  }

  // Calculate daily summaries
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

  const avgCal = Math.round(cals.reduce((a, b) => a + b, 0) / dates.length);
  const avgProt = Math.round(prots.reduce((a, b) => a + b, 0) / dates.length);

  avgCalEl.textContent = `${avgCal} kcal`;
  avgProtEl.textContent = `${avgProt} g`;

  // Find max and min days
  let maxC = -1; let minC = 99999;
  let maxDay = '—'; let minDay = '—';
  
  dates.forEach(d => {
    if (dailyData[d].calories > maxC) {
      maxC = dailyData[d].calories;
      maxDay = `${d} (${maxC} kcal)`;
    }
    if (dailyData[d].calories < minC) {
      minC = dailyData[d].calories;
      minDay = `${d} (${minC} kcal)`;
    }
  });

  peakCalEl.textContent = maxDay;
  lowCalEl.textContent = minDay;

  // Draw Charts
  drawWeeklyChart(dailyData);
  drawTimingChart();
  renderMonthlyCalendar(dailyData);
  renderFrequentFoods();
}

function drawEmptyCharts() {
  const wCanvas = document.getElementById('weekly-canvas');
  const tCanvas = document.getElementById('timing-canvas');
  if (wCanvas) {
    const ctx = wCanvas.getContext('2d');
    ctx.clearRect(0, 0, wCanvas.width, wCanvas.height);
  }
  if (tCanvas) {
    const ctx = tCanvas.getContext('2d');
    ctx.clearRect(0, 0, tCanvas.width, tCanvas.height);
  }
}

function drawWeeklyChart(dailyData) {
  const canvas = document.getElementById('weekly-canvas');
  if (!canvas) return;

  // Make canvas responsive high DPI
  const rect = canvas.parentNode.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = 200 * devicePixelRatio;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `200px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const w = rect.width;
  const h = 200;
  
  // Get last 7 days keys
  const labels = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    labels.push(d.toISOString().split('T')[0]);
  }

  // Draw background grids
  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--border-color').trim() || '#e5e5e7';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30, 20); ctx.lineTo(w - 10, 20);
  ctx.moveTo(30, 75); ctx.lineTo(w - 10, 75);
  ctx.moveTo(30, 130); ctx.lineTo(w - 10, 130);
  ctx.stroke();

  // Draw Y Axis labels (Max calories reference 2500)
  ctx.fillStyle = '#86868b';
  ctx.font = '10px Inter';
  ctx.fillText('2.5k', 2, 24);
  ctx.fillText('1.2k', 2, 79);
  ctx.fillText('0', 2, 134);

  // Bars width
  const barWidth = (w - 50) / 7 - 12;
  let currentX = 40;

  labels.forEach(date => {
    const data = dailyData[date] || { calories: 0, protein: 0 };
    
    // Calorie Bar (Dark Gray/Black)
    const calHeight = Math.min(110, (data.calories / 2500) * 110);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-primary').trim() || '#1d1d1f';
    ctx.fillRect(currentX, 130 - calHeight, barWidth / 2, calHeight);

    // Protein Bar (Muted accent)
    const protHeight = Math.min(110, (data.protein / 150) * 110);
    ctx.fillStyle = '#86868b';
    ctx.fillRect(currentX + barWidth / 2 + 2, 130 - protHeight, barWidth / 2, protHeight);

    // Date Label
    const dateLabel = date.split('-')[2];
    ctx.fillStyle = '#86868b';
    ctx.fillText(dateLabel, currentX + barWidth / 4, 150);

    currentX += barWidth + 12;
  });

  // Draw simple Legend
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-primary').trim() || '#1d1d1f';
  ctx.fillRect(40, 170, 10, 10);
  ctx.fillStyle = '#86868b';
  ctx.fillText('Calories (kcal)', 56, 178);

  ctx.fillStyle = '#86868b';
  ctx.fillRect(160, 170, 10, 10);
  ctx.fillStyle = '#86868b';
  ctx.fillText('Protein (g)', 176, 178);
}

function drawTimingChart() {
  const canvas = document.getElementById('timing-canvas');
  if (!canvas) return;

  const rect = canvas.parentNode.getBoundingClientRect();
  canvas.width = rect.width * devicePixelRatio;
  canvas.height = 150 * devicePixelRatio;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `150px`;

  const ctx = canvas.getContext('2d');
  ctx.scale(devicePixelRatio, devicePixelRatio);

  const w = rect.width;
  const h = 150;

  // Distribute meals into Morning (6-11), Afternoon (11-16), Evening (16-22), Night (22-6)
  let morning = 0; let afternoon = 0; let evening = 0; let night = 0;
  
  appState.logs.forEach(l => {
    const hr = parseInt(l.time.split(':')[0]);
    if (hr >= 6 && hr < 11) morning++;
    else if (hr >= 11 && hr < 16) afternoon++;
    else if (hr >= 16 && hr < 22) evening++;
    else night++;
  });

  const total = morning + afternoon + evening + night || 1;
  const data = [
    { label: 'Morning', val: morning },
    { label: 'Afternoon', val: afternoon },
    { label: 'Evening', val: evening },
    { label: 'Night', val: night }
  ];

  ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--border-color').trim() || '#e5e5e7';
  ctx.beginPath();
  ctx.moveTo(10, 110); ctx.lineTo(w - 10, 110);
  ctx.stroke();

  const barW = (w - 40) / 4 - 10;
  let currX = 20;

  data.forEach(item => {
    const fillH = Math.min(80, (item.val / total) * 80);
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--text-primary').trim() || '#1d1d1f';
    ctx.fillRect(currX, 110 - fillH, barW, fillH);

    ctx.fillStyle = '#86868b';
    ctx.font = '10px Inter';
    ctx.fillText(item.label, currX + 4, 126);
    ctx.fillText(`${Math.round((item.val / total) * 100)}%`, currX + 4, 142);
    
    currX += barW + 10;
  });
}

function renderMonthlyCalendar(dailyData) {
  const grid = document.getElementById('monthly-calendar-grid');
  grid.innerHTML = '';

  // Render headers
  const headers = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  headers.forEach(h => {
    const cell = document.createElement('div');
    cell.style.fontWeight = '600';
    cell.style.color = 'var(--text-secondary)';
    cell.textContent = h;
    grid.appendChild(cell);
  });

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Fill padding blocks
  for (let i = 0; i < firstDay; i++) {
    grid.appendChild(document.createElement('div'));
  }

  // Draw actual days
  for (let day = 1; day <= totalDays; day++) {
    const dayStr = `${year}-${(month + 1).toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
    const cell = document.createElement('div');
    cell.textContent = day;
    cell.style.padding = '8px';
    cell.style.borderRadius = '6px';
    cell.style.border = '1px solid var(--border-color)';
    cell.style.background = 'var(--bg-card)';

    if (dailyData[dayStr]) {
      const c = dailyData[dayStr].calories;
      if (c > appState.settings.calorieGoal) {
        cell.style.background = 'var(--color-red-light)';
        cell.style.color = 'var(--color-red)';
      } else if (c > appState.settings.calorieGoal * 0.85) {
        cell.style.background = 'var(--color-orange-light)';
        cell.style.color = 'var(--color-orange)';
      } else {
        cell.style.background = 'var(--color-green-light)';
        cell.style.color = 'var(--color-green)';
      }
    }
    grid.appendChild(cell);
  }
}

function renderFrequentFoods() {
  const table = document.getElementById('analytics-frequent-foods');
  const counts = {};

  appState.logs.forEach(l => {
    l.foods.split(',').forEach(f => {
      const name = f.trim();
      if (!name) return;
      counts[name] = (counts[name] || 0) + 1;
    });
  });

  const sorted = Object.keys(counts).map(k => ({ name: k, count: counts[k] })).sort((a, b) => b.count - a.count).slice(0, 5);

  const tbody = table.querySelector('tbody');
  tbody.innerHTML = '';

  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: var(--text-secondary);">Awaiting log history</td></tr>';
    return;
  }

  sorted.forEach(item => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td class="item-name">${item.name}</td>
      <td class="item-val">${item.count} times logged</td>
    `;
    tbody.appendChild(row);
  });
}

// 4. AI Coach Insights View
function renderCoachView() {
  document.getElementById('coach-advice-text').textContent = appState.coachAdvice.coachingNotes;
  
  const suggestionsList = document.getElementById('coach-suggestions-list');
  suggestionsList.innerHTML = '';

  if (!appState.coachAdvice.suggestions || appState.coachAdvice.suggestions.length === 0) {
    suggestionsList.innerHTML = '<p style="font-size: 13px; color: var(--text-secondary);">No coaching suggestions yet. Please log some meals.</p>';
  } else {
    appState.coachAdvice.suggestions.forEach(item => {
      const card = document.createElement('div');
      card.className = 'coach-suggestion-item';
      card.innerHTML = `
        <div class="icon">✨</div>
        <div class="details">
          <h5>${item.target} Suggestion</h5>
          <p>${item.improvement}</p>
        </div>
      `;
      suggestionsList.appendChild(card);
    });
  }

  // Active smart swaps detailed list
  const swapsList = document.getElementById('coach-swaps-list');
  swapsList.innerHTML = '';
  
  const today = new Date().toISOString().split('T')[0];
  const todaySwaps = appState.activeSwaps.filter(s => s.date === today);

  if (todaySwaps.length === 0) {
    swapsList.innerHTML = '<p style="font-size: 13px; color: var(--text-secondary); text-align: center; padding: 16px;">No unhealthy food items detected in logs today.</p>';
  } else {
    todaySwaps.forEach(swap => {
      const el = document.createElement('div');
      el.className = 'timeline-item';
      el.innerHTML = `
        <div class="timeline-details">
          <span class="timeline-text" style="color: var(--color-orange); font-weight: 600;">⚠️ Avoided: ${swap.unhealthy}</span>
          <span class="timeline-subdetails">${swap.reason}</span>
        </div>
        <div class="timeline-macros" style="margin-right: 0;">
          ${swap.healthyAlternatives.map(alt => `<span class="swap-pill" style="font-size:11px;">🥗 Swap to: ${alt}</span>`).join('')}
        </div>
      `;
      swapsList.appendChild(el);
    });
  }
}

// 5. Water Hydration View
function renderWaterTracker() {
  const currentVal = document.getElementById('water-current-val');
  const goalVal = document.getElementById('water-goal-ml-val');
  const dashboardGoalVal = document.getElementById('hydration-goal-val');
  const glassesRow = document.getElementById('water-glasses-row');

  const today = new Date().toISOString().split('T')[0];
  
  // Find current day water
  const todayWaterLog = appState.waterLogs.find(wl => wl.date === today);
  const currentWaterAmount = todayWaterLog ? todayWaterLog.amount : 0;

  currentVal.textContent = currentWaterAmount;
  goalVal.textContent = appState.settings.waterGoal;
  dashboardGoalVal.textContent = appState.settings.waterGoal;

  glassesRow.innerHTML = '';
  // Number of glasses representation (each glass is 250ml)
  const numGlasses = Math.ceil(appState.settings.waterGoal / 250);
  const filledGlasses = Math.floor(currentWaterAmount / 250);

  for (let i = 0; i < numGlasses; i++) {
    const glass = document.createElement('div');
    glass.className = 'water-glass';
    if (i < filledGlasses) {
      glass.classList.add('active');
    }
    
    // Add click handler to toggle water
    glass.addEventListener('click', () => {
      incrementWater(250);
    });

    glassesRow.appendChild(glass);
  }
}

async function incrementWater(amount) {
  const today = new Date().toISOString().split('T')[0];
  
  let currentDayLog = appState.waterLogs.find(wl => wl.date === today);
  if (currentDayLog) {
    currentDayLog.amount = Math.max(0, currentDayLog.amount + amount);
  } else if (amount > 0) {
    currentDayLog = { date: today, amount: amount, timestamp: new Date().toISOString() };
    appState.waterLogs.push(currentDayLog);
  }

  saveLocalState();
  renderWaterTracker();

  // Cloud sync if configured
  if (!appState.isGuest && appState.settings.gasUrl) {
    try {
      await fetch(appState.settings.gasUrl, {
        method: 'POST',
        body: JSON.stringify({
          action: 'log_water',
          userId: appState.user.id,
          amount: amount,
          date: today
        })
      });
    } catch (e) {
      console.error('Water sync failed:', e);
    }
  }
}

// --- DIET PLAN GENERATION (API INTERFACE) ---
async function generateDietPlan() {
  const goal = document.getElementById('planner-goal').value;
  const dietType = document.getElementById('planner-diet').value;
  const budget = document.getElementById('planner-budget').value;
  
  const submitBtn = document.getElementById('planner-submit-btn');
  const emptyState = document.getElementById('planner-empty-state');
  const resultsContainer = document.getElementById('planner-results');

  submitBtn.disabled = true;
  submitBtn.textContent = 'Generating menu via AI...';

  let planResult = null;

  if (!appState.isGuest && appState.settings.gasUrl) {
    try {
      const response = await fetch(appState.settings.gasUrl, {
        method: 'POST',
        body: JSON.stringify({
          action: 'generate_diet_plan',
          goal: goal,
          dietType: dietType,
          budget: budget
        })
      });
      const data = await response.json();
      if (data.success) {
        planResult = data.plan;
      }
    } catch (e) {
      console.error('Cloud plan failed:', e);
    }
  }

  // Fallback direct key or mock client implementation
  if (!planResult) {
    if (appState.settings.geminiKey) {
      try {
        const prompt = `You are a professional Indian dietitian. Generate a complete, highly-customized daily Indian, specifically Bengali, meal plan based on:
- Goal: ${goal}
- Diet Profile: ${dietType}
- Budget: ${budget}

Ensure the suggested menu contains traditional Bengali dishes (like Macher Jhol, Chorchori, Moong Dal, Lal Shak, Chirer Pulao, Muri Makha) cooked healthily. Respond with EXACTLY this JSON response structure without markdown:
{
  "breakfast": { "meal": "Breakfast description", "calories": 450, "protein": 30, "ingredients": ["ingredient1", "ingredient2"] },
  "lunch": { "meal": "Lunch description", "calories": 650, "protein": 40, "ingredients": ["ingredient1", "ingredient2"] },
  "dinner": { "meal": "Dinner description", "calories": 550, "protein": 35, "ingredients": ["ingredient1", "ingredient2"] },
  "snacks": { "meal": "Snacks description", "calories": 200, "protein": 15, "ingredients": ["ingredient1", "ingredient2"] },
  "totalCalories": 1850,
  "totalProtein": 120,
  "shoppingList": ["list item 1", "list item 2", "list item 3"],
  "nutritionScoreExplanation": "brief explanation of why this Bengali menu fits their profile"
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
          planResult = JSON.parse(data.candidates[0].content.parts[0].text.trim());
        }
      } catch (e) {
        console.error('Direct plan API fail:', e);
      }
    }
  }

  // Pure Offline Mock Plan generator if everything fails
  if (!planResult) {
    const isVeg = dietType.toLowerCase().includes('veget') || dietType.toLowerCase().includes('vegan');
    
    if (isVeg) {
      planResult = {
        breakfast: { meal: 'Oats Chirer Pulao with Roasted Peanuts', calories: 360, protein: 12, ingredients: ['60g rolled oats', '1 tablespoon mustard oil', 'Handful raw peanuts', 'Curry leaves, green chillies & turmeric'] },
        lunch: { meal: 'Gobindobhog Brown Rice, Sona Moong Dal & Begun Bhaja', calories: 590, protein: 22, ingredients: ['1 cup cooked brown rice', '1 bowl dry roasted Moong Dal', 'Begun Bhaja (shallow fried eggplant slices)', 'Steamed Lal Shak greens'] },
        dinner: { meal: 'Atta Roti, Chanar Dalna & Potol Bhaja', calories: 480, protein: 26, ingredients: ['2 soft rotis', '1 bowl Chanar Dalna (Cottage cheese/paneer dumplings in ginger gravy)', 'Shallow fried pointed gourd (Potol)'] },
        snacks: { meal: 'Spiced Muri Makha with Cucumber & Sprouted Grams', calories: 160, protein: 8, ingredients: ['2 cups puffed rice (Muri)', 'Diced cucumber, tomatoes & coriander', '2 tablespoons sprouted green gram', 'Drop of raw mustard oil'] },
        totalCalories: 1590,
        totalProtein: 68,
        shoppingList: ['Rolled oats', 'Gobindobhog or Brown rice', 'Begun (Eggplant)', 'Potol (Pointed gourd)', 'Fresh Paneer/Chana', 'Moong Dal', 'Puffed rice (Muri)', 'Lal Shak greens', 'Mustard oil'],
        nutritionScoreExplanation: `A healthy, vegetarian Bengali daily layout curated to achieve your ${goal} target using traditional preparation standards.`
      };
    } else {
      planResult = {
        breakfast: { meal: 'Oats Chirer Pulao & Boiled Egg (Dim Seddho)', calories: 410, protein: 20, ingredients: ['50g oats', '1 boiled egg (Dim Seddho)', '1 tablespoon mustard oil', 'Peanuts, green chillies & curry leaves'] },
        lunch: { meal: 'Rui Macher Jhol with Brown Rice & Lal Shak', calories: 620, protein: 36, ingredients: ['150g Rohu fish slice', '1 cup cooked brown rice', 'Lal Shak fry (Amaranth leaves)', 'Light ginger-cumin fish curry gravy'] },
        dinner: { meal: 'Atta Roti, Bengali Chicken Dalna & Pepe Chorchori', calories: 530, protein: 38, ingredients: ['2 soft rotis', '120g chicken breast pieces cooked in light onion gravy', 'Raw papaya stir fry (Pepe Chorchori)'] },
        snacks: { meal: 'Spiced Muri Makha with Roasted Chana & Sprouts', calories: 170, protein: 9, ingredients: ['2 cups puffed rice (Muri)', 'Diced cucumber, tomato & onion', 'Handful roasted black gram (Chana)', 'Drop of raw mustard oil'] },
        totalCalories: 1730,
        totalProtein: 103,
        shoppingList: ['Rui or Katla fish pieces', 'Chicken curry cuts/breasts', 'Organic eggs', 'Atta (wheat flour)', 'Gobindobhog or Brown rice', 'Puffed rice (Muri)', 'Lal Shak greens', 'Raw papaya', 'Mustard oil'],
        nutritionScoreExplanation: `A balanced, high-protein traditional Bengali meal layout curated specifically to meet your ${goal} objectives.`
      };
    }
  }

  // Display results
  emptyState.style.display = 'none';
  resultsContainer.style.display = 'block';

  document.getElementById('plan-breakfast-name').textContent = planResult.breakfast.meal;
  document.getElementById('plan-breakfast-macros').textContent = `${planResult.breakfast.calories} kcal | ${planResult.breakfast.protein}g protein`;
  document.getElementById('plan-breakfast-ingredients').textContent = `Ingredients: ${planResult.breakfast.ingredients.join(', ')}`;

  document.getElementById('plan-lunch-name').textContent = planResult.lunch.meal;
  document.getElementById('plan-lunch-macros').textContent = `${planResult.lunch.calories} kcal | ${planResult.lunch.protein}g protein`;
  document.getElementById('plan-lunch-ingredients').textContent = `Ingredients: ${planResult.lunch.ingredients.join(', ')}`;

  document.getElementById('plan-dinner-name').textContent = planResult.dinner.meal;
  document.getElementById('plan-dinner-macros').textContent = `${planResult.dinner.calories} kcal | ${planResult.dinner.protein}g protein`;
  document.getElementById('plan-dinner-ingredients').textContent = `Ingredients: ${planResult.dinner.ingredients.join(', ')}`;

  document.getElementById('plan-snacks-name').textContent = planResult.snacks.meal;
  document.getElementById('plan-snacks-macros').textContent = `${planResult.snacks.calories} kcal | ${planResult.snacks.protein}g protein`;
  document.getElementById('plan-snacks-ingredients').textContent = `Ingredients: ${planResult.snacks.ingredients.join(', ')}`;

  document.getElementById('planner-totals-macros').textContent = `${planResult.totalCalories} kcal | ${planResult.totalProtein}g protein`;
  document.getElementById('planner-explanation-text').textContent = planResult.nutritionScoreExplanation;

  // Shopping list
  const shopList = document.getElementById('planner-shopping-list');
  shopList.innerHTML = '';
  planResult.shoppingList.forEach((item, index) => {
    const li = document.createElement('li');
    li.className = 'shopping-item';
    li.innerHTML = `
      <input type="checkbox" id="shop-item-${index}">
      <label for="shop-item-${index}">${item}</label>
    `;
    shopList.appendChild(li);
  });

  submitBtn.disabled = false;
  submitBtn.innerHTML = `
    <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
    Generate Menu
  `;
  showToast('AI Diet Plan formulation complete!');
}

// --- SAVE SETTINGS FORM ---
async function saveSettingsForm() {
  const cal = parseInt(document.getElementById('settings-calorie-goal').value) || 2000;
  const prot = parseInt(document.getElementById('settings-protein-goal').value) || 120;
  const water = parseInt(document.getElementById('settings-water-goal').value) || 2000;
  const theme = document.getElementById('settings-theme').value;
  const units = document.getElementById('settings-units').value;
  const gas = document.getElementById('settings-gas-url').value.trim();
  const key = document.getElementById('settings-gemini-key').value.trim();

  appState.settings = {
    calorieGoal: cal,
    proteinGoal: prot,
    waterGoal: water,
    theme: theme,
    units: units,
    gasUrl: gas,
    geminiKey: key
  };

  saveLocalState();
  initTheme();
  renderDashboard();
  renderWaterTracker();
  showToast('Settings saved successfully!');

  // Sync settings with Cloud if active
  if (!appState.isGuest && appState.settings.gasUrl) {
    try {
      await fetch(appState.settings.gasUrl, {
        method: 'POST',
        body: JSON.stringify({
          action: 'save_settings',
          userId: appState.user.id,
          calorieGoal: cal,
          proteinGoal: prot,
          theme: theme,
          units: units
        })
      });
    } catch (e) {
      console.error('Settings sync failed:', e);
    }
  }
}

// --- TIMELINE MANAGEMENT: EDIT & DELETE ---
let activeEditId = null;

function openEditMealModal(id) {
  const log = appState.logs.find(l => l.id === id);
  if (!log) return;

  activeEditId = id;
  document.getElementById('edit-meal-id').value = id;
  document.getElementById('edit-meal-desc').value = log.rawText;
  document.getElementById('edit-meal-calories').value = log.calories;
  document.getElementById('edit-meal-protein').value = log.protein;

  document.getElementById('edit-meal-modal').classList.add('active');
}

async function saveMealEdit() {
  const desc = document.getElementById('edit-meal-desc').value;
  const cal = parseInt(document.getElementById('edit-meal-calories').value);
  const prot = parseInt(document.getElementById('edit-meal-protein').value);

  const idx = appState.logs.findIndex(l => l.id === activeEditId);
  if (idx !== -1) {
    appState.logs[idx].rawText = desc;
    appState.logs[idx].foods = desc; // update display label
    appState.logs[idx].calories = cal;
    appState.logs[idx].protein = prot;
    appState.logs[idx].confidence = 100; // manually corrected

    saveLocalState();
    document.getElementById('edit-meal-modal').classList.remove('active');
    showToast('Meal record updated successfully.');
    triggerCoachUpdate();
    renderDashboard();
    renderTimeline();
    renderAnalytics();

    // Cloud sync edit
    if (!appState.isGuest && appState.settings.gasUrl) {
      try {
        await fetch(appState.settings.gasUrl, {
          method: 'POST',
          body: JSON.stringify({
            action: 'update_log',
            userId: appState.user.id,
            id: activeEditId,
            rawText: desc,
            calories: cal,
            protein: prot
          })
        });
      } catch (e) {
        console.error('Cloud update failed:', e);
      }
    }
  }
}

async function deleteMeal(id) {
  if (confirm('Are you sure you want to remove this meal entry?')) {
    appState.logs = appState.logs.filter(l => l.id !== id);
    saveLocalState();
    showToast('Meal record deleted.');
    triggerCoachUpdate();
    renderDashboard();
    renderTimeline();
    renderAnalytics();

    // Cloud delete
    if (!appState.isGuest && appState.settings.gasUrl) {
      try {
        await fetch(appState.settings.gasUrl, {
          method: 'POST',
          body: JSON.stringify({
            action: 'delete_log',
            userId: appState.user.id,
            id: id
          })
        });
      } catch (e) {
        console.error('Cloud delete failed:', e);
      }
    }
  }
}

// --- UTILITIES: TOASTS ---
function showToast(message, type = 'success') {
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.position = 'fixed';
    toastContainer.style.bottom = '24px';
    toastContainer.style.right = '24px';
    toastContainer.style.zIndex = '9999';
    toastContainer.style.display = 'flex';
    toastContainer.style.flexDirection = 'column';
    toastContainer.style.gap = '8px';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.style.background = 'var(--bg-card)';
  toast.style.color = 'var(--text-primary)';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = 'var(--border-radius-sm)';
  toast.style.border = '1px solid var(--border-color)';
  toast.style.boxShadow = 'var(--shadow-lg)';
  toast.style.fontSize = '13px';
  toast.style.fontWeight = '500';
  toast.style.display = 'flex';
  toast.style.alignItems = 'center';
  toast.style.gap = '8px';
  toast.style.animation = 'slideDown 0.25s ease';

  if (type === 'warning') {
    toast.style.borderLeft = '4px solid var(--color-orange)';
    toast.innerHTML = `⚠️ ${message}`;
  } else if (type === 'error') {
    toast.style.borderLeft = '4px solid var(--color-red)';
    toast.innerHTML = `🚨 ${message}`;
  } else {
    toast.style.borderLeft = '4px solid var(--color-green)';
    toast.innerHTML = `✨ ${message}`;
  }

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.5s ease';
    setTimeout(() => toast.remove(), 500);
  }, 4000);
}
