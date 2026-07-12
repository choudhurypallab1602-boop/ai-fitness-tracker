const API_URL = "https://script.google.com/macros/s/AKfycbx0HJJqR_CqWbBeDODYsqGHiIDVBV7OUvegNpQmindiqne_z7L_B-vh2j6uqpFQvf9Sig/exec";

const ALLOWED_USER = {
  username: "pallab",
  password: "123"
};

let globalHistoryCache = [];
let isGuestModeActive = false; 
let recognition;
let isListening = false;
let currentScope = 'today'; 

window.addEventListener("load", function() {
  document.getElementById("loginBtn").addEventListener("click", handleLogin);
  document.getElementById("guestBtn").addEventListener("click", handleGuest);
  document.getElementById("logoutBtn").addEventListener("click", handleLogout);
  document.getElementById("logBtn").addEventListener("click", logMeal);
  
  document.getElementById("todayTabBtn").addEventListener("click", function() { switchViewScope('today'); });
  document.getElementById("weekTabBtn").addEventListener("click", function() { switchViewScope('week'); });
  document.getElementById("monthTabBtn").addEventListener("click", function() { switchViewScope('month'); });

  const picker = document.getElementById("historyDatePicker");
  picker.value = new Date().toISOString().split('T')[0];
  picker.addEventListener("change", function() { switchViewScope('today'); });

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
    alert("Incorrect Credentials.");
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
  document.getElementById("mainDashboard").style.display = "grid";
  document.getElementById("userDisplay").innerText = name.substring(0,1).toUpperCase();
  if(isGuestModeActive) {
    document.getElementById("guestBanner").style.display = "block";
    processView();
  } else {
    loadData();
  }
}

function normalizeInputString(str) {
  if(!str) return "";
  let clean = str.trim().toLowerCase();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function initializeVoice() {
  if ("webkitSpeechRecognition" in window) {
    recognition = new webkitSpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;       
    recognition.interimResults = false;   
    const voiceBtn = document.getElementById("voiceBtn");
    const mealInput = document.getElementById("meal");

    recognition.onstart = function() {
      isListening = true;
      voiceBtn.querySelector('.voice-label').innerText = "Stop";
      voiceBtn.style.background = "#fee2e2";
    };
    recognition.onend = function() {
      isListening = false;
      voiceBtn.querySelector('.voice-label').innerText = "Speak";
      voiceBtn.style.background = "#f1f5f9";
    };
    recognition.onresult = function(event) {
      let txt = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) txt += event.results[i][0].transcript + " ";
      }
      if(txt.trim()) mealInput.value += normalizeInputString(txt);
    };
    voiceBtn.addEventListener("click", function(e) {
      e.preventDefault();
      if (isListening) recognition.stop(); else recognition.start();
    });
  }
}

async function loadData() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    if(data.history) globalHistoryCache = data.history; 
    if(data.coach || data.coachResponse) {
      document.getElementById("coach").innerText = data.coach || data.coachResponse;
    }
    processView();
  } catch (err) { console.log("System data sync failure."); }
}

async function logMeal() {
  const input = document.getElementById("meal");
  let meal = normalizeInputString(input.value);
  if (!meal) return;
  const loading = document.getElementById("loading");
  if(loading) loading.style.display = "block";
  const date = document.getElementById("historyDatePicker").value;

  try {
    const res = await fetch(API_URL + "?meal=" + encodeURIComponent(meal) + "&customDate=" + date);
    const data = await res.json();
    if(data.history) globalHistoryCache = data.history;
    if(data.coach || data.coachResponse) {
      document.getElementById("coach").innerText = data.coach || data.coachResponse;
    }
    processView();
  } catch (err) { alert("Logging engine sync fault."); }
  finally { if(loading) loading.style.display = "none"; input.value = ""; }
}

function switchViewScope(scope) {
  currentScope = scope;
  document.getElementById("todayTabBtn").classList.remove("active");
  document.getElementById("weekTabBtn").classList.remove("active");
  document.getElementById("monthTabBtn").classList.remove("active");
  
  if(scope === 'today') document.getElementById("todayTabBtn").classList.add("active");
  if(scope === 'week') document.getElementById("weekTabBtn").classList.add("active");
  if(scope === 'month') document.getElementById("monthTabBtn").classList.add("active");

  document.getElementById("metricsTitle").innerText = scope === 'today' ? 'Daily Progress Matrix' : (scope === 'week' ? 'Weekly total Metrics' : 'Monthly total Metrics');
  processView();
}

function updateRadialGauge(elementId, current, limit, overColor, baseColor) {
  const el = document.getElementById(elementId);
  if(!el) return;
  const radius = el.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  let percent = current / limit;
  if(percent > 1) {
    el.style.stroke = overColor;
    percent = 1; 
  } else {
    el.style.stroke = baseColor;
  }
  const offset = circumference - (percent * circumference);
  el.style.strokeDasharray = `${circumference} ${circumference}`;
  el.style.strokeDashoffset = offset;
}

function processView() {
  const container = document.querySelector(".timeline");
  const selectedDateStr = document.getElementById("historyDatePicker").value;
  if(!selectedDateStr) return;
  
  const targetDate = new Date(selectedDateStr);
  targetDate.setHours(0,0,0,0);

  let filtered = [];
  let cal = 0, prot = 0;
  let targetLimit = 2000, proteinLimit = 120;

  if (currentScope === 'week') { targetLimit = 14000; proteinLimit = 840; }
  if (currentScope === 'month') { targetLimit = 60000; proteinLimit = 3600; }

  globalHistoryCache.forEach(function(item, index) {
    const itemDate = new Date(item.date);
    itemDate.setHours(0,0,0,0);
    let match = false;

    if (currentScope === 'today') match = (item.date === selectedDateStr);
    else if (currentScope === 'week') {
      const diffDays = Math.ceil((targetDate - itemDate) / (1000 * 60 * 60 * 24));
      match = (diffDays >= 0 && diffDays < 7);
    } else if (currentScope === 'month') {
      match = (itemDate.getMonth() === targetDate.getMonth() && itemDate.getFullYear() === targetDate.getFullYear());
    }

    if (match) {
      filtered.push({ ...item, originalIndex: index });
      cal += item.calories;
      prot += item.protein;
    }
  });

  document.getElementById("todayCalories").innerText = cal + " / " + targetLimit + " kcal";
  document.getElementById("todayProtein").innerText = prot + " / " + proteinLimit + " g";

  // 🔥 Update Radial SVG Rings mathematically
  updateRadialGauge("calorieGaugeFill", cal, targetLimit, "#ef4444", "#0d9488");
  updateRadialGauge("proteinGaugeFill", prot, proteinLimit, "#ef4444", "#6366f1");

  container.innerHTML = "";
  if(filtered.length === 0) {
    container.innerHTML = "<div class='null-state-msg'>No entries registered in this selection scope.</div>";
    return;
  }
  
  filtered.reverse().forEach(function(row) {
    const itemEl = document.createElement("div");
    itemEl.className = "timeline-node";
    
    itemEl.innerHTML = "<div class='node-dot-track'><span class='node-dot'></span></div>" +
      "<div class='node-payload'>" +
        "<div class='node-meta-row'>" +
          "<span class='node-timestamp'>" + row.time + "</span>" +
          "<div class='node-crud-triggers'>" +
            "<button class='action-trigger-btn' id='edit-"+row.originalIndex+"'>✏️</button>" +
            "<button class='action-trigger-btn' id='del-"+row.originalIndex+"'>🗑️</button>" +
          "</div>" +
        "</div>" +
        "<h4 class='node-title-meal'>" + normalizeInputString(row.rawInput) + "</h4>" +
        "<p class='node-macro-summary'>" + row.calories + " kcal  ·  " + row.protein + "g Protein</p>" +
      "</div>";

    container.appendChild(itemEl);

    document.getElementById("edit-"+row.originalIndex).addEventListener("click", function() {
      document.getElementById("meal").value = row.rawInput;
      document.getElementById("meal").focus();
    });
    document.getElementById("del-"+row.originalIndex).addEventListener("click", function() {
      deleteMeal(row.originalIndex);
    });
  });
}

async function deleteMeal(index) {
  if(!confirm("Purge recorded entry?")) return;
  const loading = document.getElementById("loading");
  if(loading) loading.style.display = "block";

  if(isGuestModeActive) {
    globalHistoryCache.splice(index, 1);
    if(loading) loading.style.display = "none";
    processView();
  } else {
    try {
      const res = await fetch(API_URL + "?action=delete&row=" + (index + 2));
      const data = await res.json();
      if(data.history) globalHistoryCache = data.history;
      if(data.coach || data.coachResponse) {
        document.getElementById("coach").innerText = data.coach || data.coachResponse;
      }
      processView();
    } catch (err) { alert("Delete pipeline drop error."); }
    finally { if(loading) loading.style.display = "none"; }
  }
}
