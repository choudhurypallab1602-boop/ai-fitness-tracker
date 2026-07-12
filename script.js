// ==========================================
// AI Fitness Tracker Framework Setup
// ==========================================

const API_URL = "https://script.google.com/macros/s/AKfycbx0HJJqR_CqWbBeDODYsqGHiIDVBV7OUvegNpQmindiqne_z7L_B-vh2j6uqpFQvf9Sig/exec";

// SECURITY ACCESS KEY configuration
const APP_SECURE_PASSWORD = "admin123"; 

let globalHistoryCache = [];
let currentFilterScope = "today"; 
let isGuestModeActive = false; 

// DOM Element Registry variables
let mealInput, voiceBtn, logBtn, loading, resultCard;
let mealCalories, mealProtein, confidence, foodList;
let todayCalories, todayProtein, calorieBar, proteinBar;
let coach, timelineContainer, datePicker;

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Core Elements Cache safely
  mealInput = document.getElementById("meal");
  voiceBtn = document.getElementById("voiceBtn");
  logBtn = document.getElementById("logBtn");
  loading = document.getElementById("loading");
  resultCard = document.getElementById("result");
  mealCalories = document.getElementById("mealCalories");
  mealProtein = document.getElementById("mealProtein");
  confidence = document.getElementById("confidence");
  foodList = document.getElementById("foodList");
  todayCalories = document.getElementById("todayCalories");
  todayProtein = document.getElementById("todayProtein");
  calorieBar = document.getElementById("calorieBar");
  proteinBar = document.getElementById("proteinBar");
  coach = document.getElementById("coach");
  timelineContainer = document.querySelector(".timeline");
  datePicker = document.getElementById("historyDatePicker");

  // Format calendar setup defaults
  const todayDateStr = new Date().toISOString().split('T')[0];
  if(datePicker) datePicker.value = todayDateStr;

  if (mealInput) {
    mealInput.addEventListener("input", function() {
      this.style.height = "auto";
      this.style.height = (this.scrollHeight) + "px";
    });
  }

  // Bind Listeners explicitly via JavaScript Injection
  const loginBtnElement = document.getElementById("loginBtn");
  const guestBtnElement = document.getElementById("guestBtn");
  const logoutBtnElement = document.getElementById("logoutBtn");

  if(loginBtnElement) loginBtnElement.addEventListener("click", handleDashboardLogin);
  if(guestBtnElement) guestBtnElement.addEventListener("click", handleGuestLogin);
  if(logoutBtnElement) logoutBtnElement.addEventListener("click", handleUserLogout);
  if(logBtn) logBtn.addEventListener("click", logMeal);

  // Initialize Voice Speech Recognizer Engine
  initializeVoiceRecognizer();

  // Session token parsing state restoration checks
  const savedAuthMode = sessionStorage.getItem("app_session_auth");
  if(savedAuthMode === "master") {
    executeInterfaceActivation(false);
  } else if(savedAuthMode === "guest") {
    executeInterfaceActivation(true);
  }
});

// ==========================================
// CORE AUTHENTICATION LOGIC ROUTERS
// ==========================================
function handleDashboardLogin() {
  const passwordField = document.getElementById("authPassword");
  if(!passwordField) return;
  
  if(passwordField.value === APP_SECURE_PASSWORD) {
    sessionStorage.setItem("app_session_auth", "master");
    executeInterfaceActivation(false);
  } else {
    alert("Invalid access password entry. Please try again.");
  }
}

function handleGuestLogin() {
  sessionStorage.setItem("app_session_auth", "guest");
  executeInterfaceActivation(true);
}

function handleUserLogout() {
  sessionStorage.clear();
  window.location.reload();
}

function executeInterfaceActivation(guestFlag) {
  isGuestModeActive = guestFlag;
  
  const authScreen = document.getElementById("authScreen");
  const mainDashboard = document.getElementById("mainDashboard");
  const guestBanner = document.getElementById("guestBanner");
  const userModeLabel = document.getElementById("userModeLabel");

  if(authScreen) authScreen.style.display = "none";
  if(mainDashboard) mainDashboard.style.display = "block";
  
  if(isGuestModeActive) {
    if(guestBanner) guestBanner.style.display = "block";
    if(userModeLabel) userModeLabel.innerText = "Connected Engine: Sandbox Guest Mode Memory";
    
    // Default dynamic array structure seed for testing dashboard graphics instantly
    globalHistoryCache = [
      { actualRowIndex: 2, date: new Date().toISOString().split('T')[0], time: "08:30", rawInput: "Guest Demo: 3 Egg Whites & Oats", calories: 290, protein: 18, rowId: 10001 }
    ];
    processMetricsAndTimelineView();
  } else {
    if(guestBanner) guestBanner.style.display = "none";
    if(userModeLabel) userModeLabel.innerText = "Connected Engine: Google Cloud Sync";
    loadDashboardOnStart();
  }
}

// ==========================================
// Voice Engine Mechanics
// ==========================================
function initializeVoiceRecognizer() {
  if ("webkitSpeechRecognition" in window) {
    const recognition = new webkitSpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = function () { if(voiceBtn) voiceBtn.innerHTML = "🎙 Listening..."; };
    recognition.onend = function () { if(voiceBtn) voiceBtn.innerHTML = "🎤 Speak"; };
    recognition.onresult = function (event) {
      if(mealInput) {
        mealInput.value = event.results[0][0].transcript;
        mealInput.dispatchEvent(new Event('input'));
      }
    };
    if(voiceBtn) {
      voiceBtn.addEventListener("click", () => { recognition.start(); });
    }
  }
}

// ==========================================
// DATA SYNC LOG MEAL CONTROLLERS
// ==========================================
async function loadDashboardOnStart() {
  if(isGuestModeActive) return;
  try {
    const response = await fetch(API_URL);
    if (!response.ok) return;
    const data = await response.json();
    if(data.history) {
      globalHistoryCache = data.history; 
      processMetricsAndTimelineView();
    }
  } catch (err) {
    console.log("Database fetch layout drop.");
  }
}

async function logMeal() {
  if(!mealInput) return;
  const meal = mealInput.value.trim();
  if (!meal) { alert("Please enter a meal."); return; }

  if(loading) loading.style.display = "block";
  if(resultCard) resultCard.style.display = "none";
  const activeSelectedDate = datePicker ? datePicker.value : new Date().toISOString().split('T')[0];

  if(isGuestModeActive) {
    setTimeout(() => {
      let mockCal = 380; let mockProt = 14;
      if (meal.toLowerCase().includes("egg")) { mockCal = 180; mockProt = 15; }
      if (meal.toLowerCase().includes("dosa") || meal.toLowerCase().includes("chowmein") || meal.toLowerCase().includes("roti")) { mockCal = 480; mockProt = 9; }
      
      const guestNewItem = {
        actualRowIndex: globalHistoryCache.length + 2,
        date: activeSelectedDate,
        time: new Date().toTimeString().substring(0,5),
        rawInput: meal,
        calories: mockCal,
        protein: mockProt,
        rowId: new Date().getTime()
      };
      
      globalHistoryCache.push(guestNewItem);
      showResult({ totalCalories: mockCal, totalProtein: mockProt, confidence: 0.95, foods: [{ name: meal, quantity: 1 }] });
      processMetricsAndTimelineView();
      if(loading) loading.style.display = "none";
      mealInput.value = "";
    }, 500);
    return;
  }

  try {
    const response = await fetch(`${API_URL}?meal=${encodeURIComponent(meal)}&customDate=${activeSelectedDate}`);
    if (!response.ok) throw new Error("HTTP failure");

    const data = await response.json();
    if(data.history) {
      globalHistoryCache = data.history;
      if (data.history.length > 0) {
        const lastEntry = data.history[data.history.length - 1];
        showResult({ totalCalories: lastEntry.calories, totalProtein: lastEntry.protein, confidence: 0.95, foods: [{ name: lastEntry.rawInput, quantity: 1 }] });
      }
      processMetricsAndTimelineView();
    }
  } catch (err) {
    alert("Error logging tracking point: " + err.message);
  } finally {
    if(loading) loading.style.display = "none";
    mealInput.value = "";
  }
}

function showResult(data) {
  if (!data || !resultCard) return;
  resultCard.style.display = "block";
  
  const mealCalVal = data.totalCalories !== undefined ? data.totalCalories : 0;
  const mealProtVal = data.totalProtein !== undefined ? data.totalProtein : 0;
  const confVal = data.confidence !== undefined ? Math.round(data.confidence * 100) : 0;

  if(mealCalories) mealCalories.innerHTML = "🔥 <b>" + mealCalVal + "</b> kcal";
  if(mealProtein) mealProtein.innerHTML = "💪 <b>" + mealProtVal + "</b> g protein";
  if(confidence) confidence.innerHTML = "🎯 Confidence : " + confVal + "%";

  if(foodList) {
    foodList.innerHTML = "";
    if (data.foods && Array.isArray(data.foods)) {
      data.foods.forEach(f => { foodList.innerHTML += "<li>" + f.quantity + " × " + f.name + "</li>"; });
    }
  }
}

// ==========================================
// DYNAMIC MODIFICATION ACTIONS ENGINE
// ==========================================
async function promptDeleteMeal(rowId, rowIndex) {
  if(!confirm("Are you sure you want to delete this logged meal?")) return;
  
  if(isGuestModeActive) {
    globalHistoryCache = globalHistoryCache.filter(item => item.rowId !== rowId);
    processMetricsAndTimelineView();
    return;
  }
  
  try {
    const response = await fetch(`${API_URL}?action=delete&rowId=${rowId}&rowIndex=${rowIndex}`);
    const result = await response.json();
    if(result.success) { loadDashboardOnStart(); }
  } catch(err) { alert("Connection Error on deletion query execution."); }
}

function triggerAdjustMealPopup(rowId, rowIndex, currentText) {
  const newMealText = prompt("Adjust your logged entry descriptive metrics:", currentText);
  if (newMealText === null) return; 
  const trimmed = newMealText.trim();
  if (!trimmed) return;
  executeMealAdjustment(rowId, rowIndex, trimmed);
}

async function executeMealAdjustment(rowId, rowIndex, newText) {
  if(loading) loading.style.display = "block";
  const activeSelectedDate = datePicker ? datePicker.value : new Date().toISOString().split('T')[0];
  
  if(isGuestModeActive) {
    globalHistoryCache = globalHistoryCache.filter(item => item.rowId !== rowId);
    let mockCal = 250; let mockProt = 12;
    globalHistoryCache.push({
      actualRowIndex: rowIndex, date: activeSelectedDate, time: new Date().toTimeString().substring(0,5),
      rawInput: newText, calories: mockCal, protein: mockProt, rowId: rowId
    });
    processMetricsAndTimelineView();
    if(loading) loading.style.display = "none";
    return;
  }
  
  try {
    const deleteResp = await fetch(`${API_URL}?action=delete&rowId=${rowId}&rowIndex=${rowIndex}`);
    const deleteJson = await deleteResp.json();
    if(deleteJson.success) {
      const response = await fetch(`${API_URL}?meal=${encodeURIComponent(newText)}&customDate=${activeSelectedDate}`);
      const data = await response.json();
      if(data.history) { globalHistoryCache = data.history; processMetricsAndTimelineView(); }
    }
  } catch(err) { alert("Adjustment execution fault."); }
  finally { if(loading) loading.style.display = "none"; }
}

// ==========================================
// ANALYTICS COMPUTE SYSTEM FILTERS
// ==========================================
function switchViewScope(scope) {
  currentFilterScope = scope;
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  if(event && event.target) event.target.classList.add("active");
  
  const titleMap = { "today": "Daily Progress", "weekly": "Weekly Summary Dashboard", "monthly": "Monthly View Metrics" };
  const titleEl = document.getElementById("dashboardScopeTitle");
  if(titleEl) titleEl.innerText = titleMap[scope];
  processMetricsAndTimelineView();
}

function filterTimelineByDate() {
  currentFilterScope = "date-specific";
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  const titleEl = document.getElementById("dashboardScopeTitle");
  if(titleEl) titleEl.innerText = "Selected Date Metrics";
  processMetricsAndTimelineView();
}

function processMetricsAndTimelineView() {
  if(!timelineContainer) return;
  
  const targetDateStr = datePicker ? datePicker.value : new Date().toISOString().split('T')[0]; 
  const todayStr = new Date().toISOString().split('T')[0];
  let filteredList = [];
  let sumCal = 0; let sumProt = 0;
  let calGoal = 2000; let protGoal = 120;
  const millisecondsInDay = 24 * 60 * 60 * 1000;

  globalHistoryCache.forEach(item => {
    const itemDate = new Date(item.date);
    const todayDate = new Date(todayStr);
    const dateDiff = (todayDate - itemDate) / millisecondsInDay;
    let match = false;
    
    if (currentFilterScope === "today" && item.date === todayStr) match = true;
    else if (currentFilterScope === "date-specific" && item.date === targetDateStr) match = true;
    else if (currentFilterScope === "weekly" && dateDiff >= 0 && dateDiff < 7) { match = true; calGoal = 14000; protGoal = 840; }
    else if (currentFilterScope === "monthly" && dateDiff >= 0 && dateDiff < 30) { match = true; calGoal = 60000; protGoal = 3600; }

    if (match) { filteredList.push(item); sumCal += item.calories; sumProt += item.protein; }
  });

  updateDashboard(sumCal, calGoal, sumProt, protGoal);
  timelineContainer.innerHTML = "";
  
  if(filteredList.length === 0) {
    timelineContainer.innerHTML = "<p style='font-size:13px; color:#999; text-align:center; padding:20px;'>No logs tracked inside this analytical window.</p>";
    return;
  }

  for(let i = filteredList.length - 1; i >= 0; i--) {
    const row = filteredList[i];
    timelineContainer.innerHTML += `
      <div class="timeline-item">
        <div class="timeline-marker"></div>
        <div class="timeline-content">
          <div class="timeline-actions">
            <button class="action-icon-btn btn-adjust" data-tooltip="Adjust Meal" onclick="triggerAdjustMealPopup(${row.rowId}, ${row.actualRowIndex}, '${row.rawInput.replace(/'/g, "\\'")}')">✏️</button>
            <button class="action-icon-btn btn-delete" data-tooltip="Remove Meal" onclick="promptDeleteMeal(${row.rowId}, ${row.actualRowIndex})">🗑️</button>
          </div>
          <div class="timeline-meta">
            <span class="timeline-time">${row.date} • ${row.time}</span>
            <span class="timeline-tag">${isGuestModeActive ? "Sandbox" : "Logged"}</span>
          </div>
          <h4 class="timeline-title" style="margin-top:6px;">${row.rawInput}</h4>
          <p class="timeline-desc">${row.calories} kcal • ${row.protein}g Protein</p>
        </div>
      </div>
    `;
  }
}

function updateDashboard(sumCal, calGoal, sumProt, protGoal) {
  if(todayCalories) todayCalories.innerHTML = "<b>" + sumCal + " / " + calGoal + " kcal</b>";
  if(calorieBar) {
    let calPercent = (sumCal / calGoal) * 100;
    calorieBar.style.width = Math.min(calPercent, 100) + "%";
    calorieBar.style.backgroundColor = sumCal > calGoal ? "#dc2626" : "#16a34a";
  }

  if(todayProtein) todayProtein.innerHTML = "<b>" + sumProt + " / " + protGoal + " g</b>";
  if(proteinBar) {
    let protPercent = (sumProt / protGoal) * 100;
    proteinBar.style.width = Math.min(protPercent, 100) + "%";
    proteinBar.style.backgroundColor = sumProt >= protGoal ? "#16a34a" : "#ea580c";
  }

  if (coach) {
    if (sumCal > calGoal) coach.innerHTML = "⚠️ You are over your calorie goal today. Keep your next meal light.";
    else if (sumProt < (protGoal * 0.5)) coach.innerHTML = "💪 Protein intake is tracking low. Add clean sources like eggs, chicken or paneer.";
    else coach.innerHTML = "✅ You are doing beautifully today. Keep making balanced whole-food choices.";
  }
}
