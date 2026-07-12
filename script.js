// ==========================================
// AI Fitness Tracker Framework Setup
// ==========================================

const API_URL = "https://script.google.com/macros/s/AKfycbx0HJJqR_CqWbBeDODYsqGHiIDVBV7OUvegNpQmindiqne_z7L_B-vh2j6uqpFQvf9Sig/exec";

// SECURITY CONFIGURATION
const APP_SECURE_PASSWORD = "admin123"; // 👈 Apn pasand ka password yahan daal do!

let globalHistoryCache = [];
let currentFilterScope = "today"; 
let isGuestModeActive = false; // System context switch flag

const mealInput = document.getElementById("meal");
const voiceBtn = document.getElementById("voiceBtn");
const logBtn = document.getElementById("logBtn");

const loading = document.getElementById("loading");
const resultCard = document.getElementById("result");

const mealCalories = document.getElementById("mealCalories");
const mealProtein = document.getElementById("mealProtein");
const confidence = document.getElementById("confidence");
const foodList = document.getElementById("foodList");

const todayCalories = document.getElementById("todayCalories");
const todayProtein = document.getElementById("todayProtein");
const calorieBar = document.getElementById("calorieBar");
const proteinBar = document.getElementById("proteinBar");

const coach = document.getElementById("coach");
const timelineContainer = document.querySelector(".timeline");
const datePicker = document.getElementById("historyDatePicker");

document.addEventListener("DOMContentLoaded", () => {
  const todayDateStr = new Date().toISOString().split('T')[0];
  if(datePicker) datePicker.value = todayDateStr;

  if (mealInput) {
    mealInput.addEventListener("input", function() {
      this.style.height = "auto";
      this.style.height = (this.scrollHeight) + "px";
    });
  }

  // Session state preservation check
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
  const enteredPass = document.getElementById("authPassword").value;
  if(enteredPass === APP_SECURE_PASSWORD) {
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
  document.getElementById("authScreen").style.display = "none";
  document.getElementById("mainDashboard").style.display = "block";
  
  if(isGuestModeActive) {
    document.getElementById("guestBanner").style.display = "block";
    document.getElementById("userModeLabel").innerText = "Connected Engine: Sandbox Guest Mode Memory";
    // Load some mock starting values for the guest preview to keep dashboard interesting
    globalHistoryCache = [
      { actualRowIndex: 2, date: new Date().toISOString().split('T')[0], time: "08:30", rawInput: "Guest Demo: 2 Boiled Eggs & Coffee", calories: 220, protein: 14, rowId: 10001 }
    ];
    processMetricsAndTimelineView();
  } else {
    document.getElementById("guestBanner").style.display = "none";
    document.getElementById("userModeLabel").innerText = "Connected Engine: Google Cloud Sync";
    loadDashboardOnStart();
  }
}

// ==========================================
// Voice Engine Mechanics
// ==========================================
let recognition = null;
if ("webkitSpeechRecognition" in window) {
  recognition = new webkitSpeechRecognition();
  recognition.lang = "en-IN";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = function () { voiceBtn.innerHTML = "🎙 Listening..."; };
  recognition.onend = function () { voiceBtn.innerHTML = "🎤 Speak"; };
  recognition.onresult = function (event) {
    mealInput.value = event.results[0][0].transcript;
    mealInput.dispatchEvent(new Event('input'));
  };
}
if(voiceBtn) {
  voiceBtn.addEventListener("click", () => { if(recognition) recognition.start(); });
}

// ==========================================
// DATA SYNC LOG MEAL CONTROLLERS
// ==========================================
logBtn.addEventListener("click", logMeal);

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
    console.log("Database load fault.");
  }
}

async function logMeal() {
  const meal = mealInput.value.trim();
  if (!meal) { alert("Please enter a meal."); return; }

  loading.style.display = "block";
  resultCard.style.display = "none";
  const activeSelectedDate = datePicker.value;

  // INTERCEPT REQUEST IF GUEST MODE ACTIVE
  if(isGuestModeActive) {
    setTimeout(() => {
      // Direct mock logic execution for client sandbox safety simulation
      let mockCal = 350; let mockProt = 12;
      if (meal.toLowerCase().includes("egg")) { mockCal = 180; mockProt = 14; }
      if (meal.toLowerCase().includes("dosa") || meal.toLowerCase().includes("chowmein")) { mockCal = 550; mockProt = 8; }
      
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
      showResult({ totalCalories: mockCal, totalProtein: mockProt, confidence: 0.98, foods: [{ name: meal, quantity: 1 }] });
      processMetricsAndTimelineView();
      loading.style.display = "none";
      mealInput.value = "";
    }, 600);
    return;
  }

  // STANDARD PRODUCTION SYNC PIPELINE RUN
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
    loading.style.display = "none";
    mealInput.value = "";
  }
}

function showResult(data) {
  if (!data) return;
  resultCard.style.display = "block";
  
  const mealCalVal = data.totalCalories !== undefined ? data.totalCalories : 0;
  const mealProtVal = data.totalProtein !== undefined ? data.totalProtein : 0;
  const confVal = data.confidence !== undefined ? Math.round(data.confidence * 100) : 0;

  mealCalories.innerHTML = "🔥 <b>" + mealCalVal + "</b> kcal";
  mealProtein.innerHTML = "💪 <b>" + mealProtVal + "</b> g protein";
  confidence.innerHTML = "🎯 Confidence : " + confVal + "%";

  foodList.innerHTML = "";
  if (data.foods && Array.isArray(data.foods)) {
    data.foods.forEach(f => { foodList.innerHTML += "<li>" + f.quantity + " × " + f.name + "</li>"; });
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
    if(result.success) { logBtn.click(); loadDashboardOnStart(); }
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
  loading.style.display = "block";
  const activeSelectedDate = datePicker.value;
  
  if(isGuestModeActive) {
    // Local processing optimization hook
    globalHistoryCache = globalHistoryCache.filter(item => item.rowId !== rowId);
    let mockCal = 280; let mockProt = 10;
    globalHistoryCache.push({
      actualRowIndex: rowIndex, date: activeSelectedDate, time: new Date().toTimeString().substring(0,5),
      rawInput: newText, calories: mockCal, protein: mockProt, rowId: rowId
    });
    processMetricsAndTimelineView();
    loading.style.display = "none";
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
  finally { loading.style.display = "none"; }
}

// ==========================================
// ANALYTICS COMPUTE SYSTEM FILTERS
// ==========================================
function switchViewScope(scope) {
  currentFilterScope = scope;
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  event.target.classList.add("active");
  const titleMap = { "today": "Daily Progress", "weekly": "Weekly Summary Dashboard", "monthly": "Monthly View Metrics" };
  document.getElementById("dashboardScopeTitle").innerText = titleMap[scope];
  processMetricsAndTimelineView();
}

function filterTimelineByDate() {
  currentFilterScope = "date-specific";
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  document.getElementById("dashboardScopeTitle").innerText = "Selected Date Metrics";
  processMetricsAndTimelineView();
}

function processMetricsAndTimelineView() {
  const targetDateStr = datePicker.value; 
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
  todayCalories.innerHTML = "<b>" + sumCal + " / " + calGoal + " kcal</b>";
  let calPercent = (sumCal / calGoal) * 100;
  calorieBar.style.width = Math.min(calPercent, 100) + "%";
  calorieBar.style.backgroundColor = sumCal > calGoal ? "#dc2626" : "#16a34a";

  todayProtein.innerHTML = "<b>" + sumProt + " / " + protGoal + " g</b>";
  let protPercent = (sumProt / protGoal) * 100;
  proteinBar.style.width = Math.min(protPercent, 100) + "%";
  proteinBar.style.backgroundColor = sumProt >= protGoal ? "#16a34a" : "#ea580c";

  if (coach) {
    if (sumCal > calGoal) coach.innerHTML = "⚠️ You are over your calorie goal today. Keep your next meal light.";
    else if (sumProt < (protGoal * 0.5)) coach.innerHTML = "💪 Protein intake is tracking low. Add clean sources like eggs, chicken or paneer.";
    else coach.innerHTML = "✅ You are doing beautifully today. Keep making balanced whole-food choices.";
  }
}
