const API_URL = "https://script.google.com/macros/s/AKfycbx0HJJqR_CqWbBeDODYsqGHiIDVBV7OUvegNpQmindiqne_z7L_B-vh2j6uqpFQvf9Sig/exec";

const ALLOWED_USER = {
  username: "pallab",
  password: "123"
};

let globalHistoryCache = [];
let isGuestModeActive = false; 
let recognition;
let isListening = false;
let currentScope = 'today'; // Tracks 'today', 'week', or 'month'

window.addEventListener("load", () => {
  document.getElementById("loginBtn").addEventListener("click", handleLogin);
  document.getElementById("guestBtn").addEventListener("click", handleGuest);
  document.getElementById("logoutBtn").addEventListener("click", handleLogout);
  document.getElementById("logBtn").addEventListener("click", logMeal);
  
  const picker = document.getElementById("historyDatePicker");
  picker.value = new Date().toISOString().split('T')[0];
  
  // When date picker changes, enforce today view tab active style
  picker.addEventListener("change", () => {
    switchViewScope('today');
  });

  initializeVoice();

  const savedUser = sessionStorage.getItem("auth_user");
  if(savedUser) {
    activateDashboard(savedUser === "Guest", savedUser);
  }
});

function handleLogin() {
  const u = document.getElementById("authUsername").value.trim().toLowerCase();
  const p = document.getElementById("authPassword").value.trim();

  if(u === ALLOWED_USER.username && p === ALLOWED_USER.password) {
    sessionStorage.setItem("auth_user", u);
    activateDashboard(false, u);
  } else {
    alert("Incorrect Username or Password.");
  }
}

function handleGuest() {
  sessionStorage.setItem("auth_user", "Guest");
  activateDashboard(true, "Guest");
}

function handleLogout() {
  sessionStorage.clear();
  window.location.reload();
}

function activateDashboard(isGuest, name) {
  isGuestModeActive = isGuest;
  document.getElementById("authScreen").style.display = "none";
  document.getElementById("mainDashboard").style.display = "block";
  document.getElementById("userDisplay").innerText = name.toUpperCase();
  
  if(isGuestModeActive) {
    document.getElementById("guestBanner").style.display = "block";
    processView();
  } else {
    loadData();
  }
}

function initializeVoice() {
  if ("webkitSpeechRecognition" in window) {
    recognition = new webkitSpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;       
    recognition.interimResults = false;   

    const voiceBtn = document.getElementById("voiceBtn");
    const mealInput = document.getElementById("meal");

    recognition.onstart = () => {
      isListening = true;
      voiceBtn.innerHTML = "🛑 Stop Listening";
      voiceBtn.style.color = "red";
    };

    recognition.onend = () => {
      isListening = false;
      voiceBtn.innerHTML = "🎤 Speak";
      voiceBtn.style.color = "";
    };

    recognition.onresult = (event) => {
      let speechText = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          speechText += event.results[i][0].transcript + " ";
        }
      }
      if(speechText.trim()) {
        mealInput.value += speechText;
      }
    };

    voiceBtn.addEventListener("click", (e) => {
      e.preventDefault();
      if (isListening) recognition.stop();
      else recognition.start();
    });
  }
}

async function loadData() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    if(data.history) {
      globalHistoryCache = data.history; 
      processView();
    }
  } catch (err) { console.log("Google sheet fetch failure."); }
}

async function logMeal() {
  const input = document.getElementById("meal");
  const meal = input.value.trim();
  if (!meal) return;

  const loading = document.getElementById("loading");
  if(loading) loading.style.display = "block";
  const date = document.getElementById("historyDatePicker").value;

  try {
    const res = await fetch(`${API_URL}?meal=${encodeURIComponent(meal)}&customDate=${date}`);
    const data = await res.json();
    if(data.history) {
      globalHistoryCache = data.history;
      processView();
    }
  } catch (err) { alert("Logging failed."); }
  finally { if(loading) loading.style.display = "none"; input.value = ""; }
}

// 🌐 FUNCTION TO SWITCH TABS SAFELY
function switchViewScope(scope) {
  currentScope = scope;
  
  // Update Tab States Graphic UI Elements
  document.getElementById("todayTabBtn").classList.remove("active");
  document.getElementById("weekTabBtn").classList.remove("active");
  document.getElementById("monthTabBtn").classList.remove("active");
  
  if(scope === 'today') document.getElementById("todayTabBtn").classList.add("active");
  if(scope === 'week') document.getElementById("weekTabBtn").classList.add("active");
  if(scope === 'month') document.getElementById("monthTabBtn").classList.add("active");

  // Dynamic Card Title Update
  const titleMap = { 'today': 'Daily Progress', 'week': 'Weekly total Progress', 'month': 'Monthly total Progress' };
  document.getElementById("metricsTitle").innerText = titleMap[scope];

  processView();
}

function processView() {
  const container = document.querySelector(".timeline");
  const selectedDateStr = document.getElementById("historyDatePicker").value;
  
  if(!selectedDateStr) return;
  
  const targetDate = new Date(selectedDateStr);
  targetDate.setHours(0,0,0,0);

  let filtered = [];
  let cal = 0, prot = 0;

  // Range Math Targets
  let targetLimit = 2000; 
  let proteinLimit = 120;

  if (currentScope === 'week') { targetLimit = 14000; proteinLimit = 840; }
  if (currentScope === 'month') { targetLimit = 60000; proteinLimit = 3600; }

  globalHistoryCache.forEach(item => {
    const itemDate = new Date(item.date);
    itemDate.setHours(0,0,0,0);

    let match = false;

    if (currentScope === 'today') {
      match = (item.date === selectedDateStr);
    } else if (currentScope === 'week') {
      const diffTime = targetDate - itemDate;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      match = (diffDays >= 0 && diffDays < 7);
    } else if (currentScope === 'month') {
      match = (itemDate.getMonth() === targetDate.getMonth() && itemDate.getFullYear() === targetDate.getFullYear());
    }

    if (match) {
      filtered.push(item);
      cal += item.calories;
      prot += item.protein;
    }
  });

  // Render numbers cleanly
  document.getElementById("todayCalories").innerText = `${cal} / ${targetLimit} kcal`;
  document.getElementById("calorieBar").style.width = Math.min((cal / targetLimit) * 100, 100) + "%";
  
  document.getElementById("todayProtein").innerText = `${prot} / ${proteinLimit} g`;
  document.getElementById("proteinBar").style.width = Math.min((prot / proteinLimit) * 100, 100) + "%";

  container.innerHTML = "";
  if(filtered.length === 0) {
    container.innerHTML = "<p style='font-size:12px;color:#999;text-align:center;padding:12px;'>No entries recorded for this range.</p>";
    return;
  }
  
  filtered.reverse().forEach(row => {
    container.innerHTML += `
      <div class="timeline-item" style="margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #f5f5f5;">
        <small style="color:#999;">${row.date} • ${row.time}</small>
        <h4 style="margin:2px 0; font-size:14px; font-weight:600;">${row.rawInput}</h4>
        <small style="color:#666;">${row.calories} kcal • ${row.protein}g</small>
      </div>`;
  });
}
// Add this event listeners snippet inside your window load or at the bottom of script.js
document.getElementById("todayTabBtn").addEventListener("click", () => switchViewScope('today'));
document.getElementById("weekTabBtn").addEventListener("click", () => switchViewScope('week'));
document.getElementById("monthTabBtn").addEventListener("click", () => switchViewScope('month'));
