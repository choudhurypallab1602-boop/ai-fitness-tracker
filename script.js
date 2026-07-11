// ==========================================
// AI Fitness Tracker Frontend Layer Setup
// ==========================================

const API_URL = "https://script.google.com/macros/s/AKfycbx0HJJqR_CqWbBeDODYsqGHiIDVBV7OUvegNpQmindiqne_z7L_B-vh2j6uqpFQvf9Sig/exec"; // <--- APNA NAYA DEPLOYED URL YAHA DAALEIN!

let globalHistoryCache = [];
let currentFilterScope = "today"; // today, weekly, monthly

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
  // Autofill date picker input with today's date structure
  const todayDateStr = new Date().toISOString().split('T')[0];
  if(datePicker) datePicker.value = todayDateStr;

  if (mealInput) {
    mealInput.addEventListener("input", function() {
      this.style.height = "auto";
      this.style.height = (this.scrollHeight) + "px";
    });
  }
  loadDashboardOnStart();
});

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
// Core Sync Framework Data Pipelines
// ==========================================
logBtn.addEventListener("click", logMeal);

async function loadDashboardOnStart() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) return;
    const data = await response.json();
    
    if(data.history) {
      globalHistoryCache = data.history; 
      processMetricsAndTimelineView();
    }
  } catch (err) {
    console.log("Database fetch fault.");
  }
}

async function logMeal() {
  const meal = mealInput.value.trim();
  if (!meal) { alert("Please enter a meal."); return; }

  loading.style.display = "block";
  resultCard.style.display = "none";

  try {
    const response = await fetch(API_URL + "?meal=" + encodeURIComponent(meal));
    if (!response.ok) throw new Error("HTTP failure");

    const data = await response.json();
    if(data.history) {
      globalHistoryCache = data.history;
      showResult(data);
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
  
  // Clean checks to shield UI renderers from crashing if properties are deep nested
  const mealCalVal = data.totalCalories !== undefined ? data.totalCalories : 0;
  const mealProtVal = data.totalProtein !== undefined ? data.totalProtein : 0;
  const confVal = data.confidence !== undefined ? Math.round(data.confidence * 100) : 0;

  mealCalories.innerHTML = "🔥 <b>" + mealCalVal + "</b> kcal";
  mealProtein.innerHTML = "💪 <b>" + mealProtVal + "</b> g protein";
  confidence.innerHTML = "🎯 Confidence : " + confVal + "%";

  foodList.innerHTML = "";
  if (data.foods && Array.isArray(data.foods)) {
    data.foods.forEach(f => {
      foodList.innerHTML += "<li>" + f.quantity + " × " + f.name + "</li>";
    });
  }
}

  foodList.innerHTML = "";
  if (data.foods && Array.isArray(data.foods)) {
    data.foods.forEach(f => {
      foodList.innerHTML += "<li>" + f.quantity + " × " + f.name + "</li>";
    });
  }
}

// ==========================================
// DELETE ELEMENT FUNCTION PIPELINE
// ==========================================
async function promptDeleteMeal(rowId) {
  if(!confirm("Are you sure you want to delete this logged meal?")) return;
  
  try {
    const response = await fetch(`${API_URL}?action=delete&rowId=${rowId}`);
    const result = await response.json();
    if(result.success) {
      // Reload fresh matrix state directly from spreadsheet database
      loadDashboardOnStart();
    } else {
      alert("Delete transaction dropped by Google Cloud endpoint.");
    }
  } catch(err) {
    alert("Connection Error on deletion query execution.");
  }
}

// ==========================================
// DYNAMIC COMPUTE FILTERS & TAB ANALYTICS 
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
  const targetDateStr = datePicker.value; // yyyy-mm-dd
  const todayStr = new Date().toISOString().split('T')[0];

  let filteredList = [];
  let sumCal = 0;
  let sumProt = 0;
  let calGoal = 2000;
  let protGoal = 120;

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

    if (match) {
      filteredList.push(item);
      sumCal += item.calories;
      sumProt += item.protein;
    }
  });

  // UI Bar Calculations update
  todayCalories.innerHTML = "<b>" + sumCal + " / " + calGoal + " kcal</b>";
  let calPercent = (sumCal / calGoal) * 100;
  calorieBar.style.width = Math.min(calPercent, 100) + "%";

  todayProtein.innerHTML = "<b>" + sumProt + " / " + protGoal + " g</b>";
  let protPercent = (sumProt / protGoal) * 100;
  proteinBar.style.width = Math.min(protPercent, 100) + "%";

  // Re-render Timeline Rows matching the contextual filter query selection
  timelineContainer.innerHTML = "";
  if(filteredList.length === 0) {
    timelineContainer.innerHTML = "<p style='font-size:13px; color:#999; text-align:center; padding:20px;'>No logs tracked inside this analytical window.</p>";
    return;
  }

  // Reverse loop to stack new entries dynamically on top
  for(let i = filteredList.length - 1; i >= 0; i--) {
    const row = filteredList[i];
    timelineContainer.innerHTML += `
      <div class="timeline-item">
        <div class="timeline-marker"></div>
        <div class="timeline-content">
          <button class="delete-btn" onclick="promptDeleteMeal(${row.rowId})">Remove</button>
          <div class="timeline-meta">
            <span class="timeline-time">${row.date} • ${row.time}</span>
            <span class="timeline-tag">Logged</span>
          </div>
          <h4 class="timeline-title" style="margin-top:6px;">${row.rawInput}</h4>
          <p class="timeline-desc">${row.calories} kcal • ${row.protein}g Protein</p>
        </div>
      </div>
    `;
  }
}
