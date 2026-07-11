// ==========================================
// AI Fitness Tracker Frontend Layer Setup
// ==========================================

const API_URL = "https://script.google.com/macros/s/AKfycbx0HJJqR_CqWbBeDODYsqGHiIDVBV7OUvegNpQmindiqne_z7L_B-vh2j6uqpFQvf9Sig/exec";

let globalHistoryCache = [];
let currentFilterScope = "today"; // today, weekly, monthly, date-specific

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

  // Capture active context date from dashboard picker input
  const activeSelectedDate = datePicker.value;

  try {
    const response = await fetch(`${API_URL}?meal=${encodeURIComponent(meal)}&customDate=${activeSelectedDate}`);
    if (!response.ok) throw new Error("HTTP failure");

    const data = await response.json();
    if(data.history) {
      globalHistoryCache = data.history;
      
      // Calculate individual metrics internally if deep array objects are returned
      if (data.history.length > 0) {
        const lastEntry = data.history[data.history.length - 1];
        showResult({
          totalCalories: lastEntry.calories,
          totalProtein: lastEntry.protein,
          confidence: 0.95,
          foods: [{ name: lastEntry.rawInput, quantity: 1 }]
        });
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
      loadDashboardOnStart();
    } else {
      alert("Delete transaction dropped by Google Cloud endpoint.");
    }
  } catch(err) {
    alert("Connection Error on deletion query execution.");
  }
}

// ==========================================
// QUICK INLINE HISTORICAL ADJUSTMENT ENGINE
// ==========================================
function triggerAdjustMealPopup(rowId, currentText) {
  const newMealText = prompt("Adjust your logged entry descriptive metrics:", currentText);
  if (newMealText === null) return; 
  
  const trimmed = newMealText.trim();
  if (!trimmed) {
    alert("Description cannot be empty.");
    return;
  }
  executeMealAdjustment(rowId, trimmed);
}

async function executeMealAdjustment(rowId, newText) {
  loading.style.display = "block";
  const activeSelectedDate = datePicker.value; // Retain targeted chart timeline view date Context
  
  try {
    const deleteResp = await fetch(`${API_URL}?action=delete&rowId=${rowId}`);
    const deleteJson = await deleteResp.json();
    
    if(deleteJson.success) {
      const response = await fetch(`${API_URL}?meal=${encodeURIComponent(newText)}&customDate=${activeSelectedDate}`);
      if (!response.ok) throw new Error("HTTP connection drop during overwrite script.");
      
      const data = await response.json();
      if(data.history) {
        globalHistoryCache = data.history;
        processMetricsAndTimelineView();
      }
    } else {
      alert("Sheet baseline modifications rejected by Google Script Engine.");
    }
  } catch(err) {
    alert("Adjustment execution error details: " + err.message);
  } finally {
    loading.style.display = "none";
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
  const targetDateStr = datePicker.value; 
  const todayStr = new Date().toISOString().split('T')[0];

  let filteredList = [];
  let sumCal = 0;
  let sumProt = 0;
  let calGoal = 2000;
  let protGoal = 120;

  const millisecondsInDay = 24 * 60 * 60 * 1000;

  globalHistoryCache.forEach(item => {
    // Structural split sanitization logic check for explicit cross-system platform integrity
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
            <button class="action-icon-btn btn-adjust" data-tooltip="Adjust Meal" onclick="triggerAdjustMealPopup(${row.rowId}, '${row.rawInput.replace(/'/g, "\\'")}')">
              ✏️
            </button>
            <button class="action-icon-btn btn-delete" data-tooltip="Remove Meal" onclick="promptDeleteMeal(${row.rowId})">
              🗑️
            </button>
          </div>

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

function updateDashboard(sumCal, calGoal, sumProt, protGoal) {
  todayCalories.innerHTML = "<b>" + sumCal + " / " + calGoal + " kcal</b>";
  let calPercent = (sumCal / calGoal) * 100;
  calorieBar.style.width = Math.min(calPercent, 100) + "%";

  // Calorie Limit warning indicator change hooks
  if (sumCal > calGoal) {
    calorieBar.style.backgroundColor = "#dc2626"; // Alert Red
  } else {
    calorieBar.style.backgroundColor = "#16a34a"; // Clean Leaf Green
  }

  todayProtein.innerHTML = "<b>" + sumProt + " / " + protGoal + " g</b>";
  let protPercent = (sumProt / protGoal) * 100;
  proteinBar.style.width = Math.min(protPercent, 100) + "%";

  // Protein threshold condition scale
  if (sumProt >= protGoal) {
    proteinBar.style.backgroundColor = "#16a34a"; // Target hit green
  } else {
    proteinBar.style.backgroundColor = "#ea580c"; // Tracking low orange
  }

  const coachElement = document.getElementById("coach");
  if (coachElement) {
    if (sumCal > calGoal) {
      coachElement.innerHTML = "⚠️ You are over your calorie goal today. Keep your next meal light and lean-protein rich.";
    } else if (sumProt < (protGoal * 0.5)) {
      coachElement.innerHTML = "💪 Protein intake is tracking low for this period. Consider adding clean sources like eggs, chicken, paneer, tofu, or dal.";
    } else {
      coachElement.innerHTML = "✅ You are doing beautifully today. Keep making balanced, clean whole-food choices.";
    }
  }
}
