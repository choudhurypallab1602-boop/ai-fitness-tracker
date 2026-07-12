const API_URL = "https://script.google.com/macros/s/AKfycbx0HJJqR_CqWbBeDODYsqGHiIDVBV7OUvegNpQmindiqne_z7L_B-vh2j6uqpFQvf9Sig/exec";

// 🔑 USERNAME & PASSWORD SETTINGS
const ALLOWED_USER = {
  username: "pallab",
  password: "123"
};

let globalHistoryCache = [];
let currentFilterScope = "today"; 
let isGuestModeActive = false; 
let recognition;
let isListening = false;

window.addEventListener("load", () => {
  document.getElementById("loginBtn").addEventListener("click", handleLogin);
  document.getElementById("guestBtn").addEventListener("click", handleGuest);
  document.getElementById("logoutBtn").addEventListener("click", handleLogout);
  document.getElementById("logBtn").addEventListener("click", logMeal);

  document.getElementById("historyDatePicker").value = new Date().toISOString().split('T')[0];

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

// 🎙️ FIXED: CONTINUOUS VOICE MICROPHONE RECOGNITION
function initializeVoice() {
  if ("webkitSpeechRecognition" in window) {
    recognition = new webkitSpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;       // Keeps mic on even during pauses
    recognition.interimResults = false;   // Delivers only final clear text

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
  } catch (err) { console.log("Offline"); }
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
  } catch (err) { alert("Error saving log."); }
  finally { if(loading) loading.style.display = "none"; input.value = ""; }
}

function processView() {
  const container = document.querySelector(".timeline");
  const today = new Date().toISOString().split('T')[0];
  let filtered = [];
  let cal = 0, prot = 0;

  globalHistoryCache.forEach(item => {
    if (item.date === today) {
      filtered.push(item);
      cal += item.calories;
      prot += item.protein;
    }
  });

  document.getElementById("todayCalories").innerText = cal + " / 2000 kcal";
  document.getElementById("calorieBar").style.width = Math.min((cal / 2000) * 100, 100) + "%";
  document.getElementById("todayProtein").innerText = prot + " / 120 g";
  document.getElementById("proteinBar").style.width = Math.min((prot / 120) * 100, 100) + "%";

  container.innerHTML = "";
  if(filtered.length === 0) {
    container.innerHTML = "<p style='font-size:12px;color:#999;text-align:center;'>No entries today.</p>";
    return;
  }
  
  filtered.reverse().forEach(row => {
    container.innerHTML += `
      <div style="margin-bottom:12px; padding-bottom:8px; border-bottom:1px solid #f5f5f5;">
        <small style="color:#999;">${row.time}</small>
        <h4 style="margin:2px 0; font-size:14px; font-weight:600;">${row.rawInput}</h4>
        <small style="color:#666;">${row.calories} kcal • ${row.protein}g</small>
      </div>`;
  });
}
