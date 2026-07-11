// ==========================================
// AI Fitness Tracker Frontend Layer Setup
// ==========================================

const API_URL = "https://script.google.com/macros/s/AKfycbx0HJJqR_CqWbBeDODYsqGHiIDVBV7OUvegNpQmindiqne_z7L_B-vh2j6uqpFQvf9Sig/exec"; // <--- APNA EXEC URL YAHA RE-PASTE KARNA!

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

// Controls startup and resizing mechanics
document.addEventListener("DOMContentLoaded", () => {
  if (mealInput) {
    mealInput.addEventListener("input", function() {
      this.style.height = "auto";
      this.style.height = (this.scrollHeight) + "px";
    });
  }
  // Load database state directly from spreadsheet data array on load
  loadDashboardOnStart();
});

// ==========================================
// Voice Recognition Processing Engine
// ==========================================
let recognition = null;
if ("webkitSpeechRecognition" in window) {
  recognition = new webkitSpeechRecognition();
  recognition.lang = "en-IN";
  recognition.interimResults = false;
  recognition.continuous = false;

  recognition.onstart = function () { voiceBtn.innerHTML = "🎙 Listening..."; };
  recognition.onend = function () { voiceBtn.innerHTML = "🎤 Speak"; };
  recognition.onerror = function (e) { alert("Voice Error : " + e.error); };
  recognition.onresult = function (event) {
    mealInput.value = event.results[0][0].transcript;
    mealInput.dispatchEvent(new Event('input'));
  };
}

voiceBtn.addEventListener("click", function () {
  if (!recognition) { alert("Speech Recognition not supported."); return; }
  recognition.start();
});

// ==========================================
// Page Load Sync & Log Processing Pipelines
// ==========================================
logBtn.addEventListener("click", logMeal);

async function loadDashboardOnStart() {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) return;
    const data = await response.json();
    
    if(data.todayCalories !== undefined) {
      updateDashboard(data);
      
      // Agar pehle se aaj ki items logged hain sheet me toh unhe timeline par render karo
      if(data.history && data.history.length > 0) {
        renderFullHistoryTimeline(data.history);
      }
    }
  } catch (err) {
    console.log("Database sync skipped.");
  }
}

async function logMeal() {
  const meal = mealInput.value.trim();
  if (!meal) { alert("Please enter a meal."); return; }

  loading.style.display = "block";
  resultCard.style.display = "none";

  try {
    const response = await fetch(API_URL + "?meal=" + encodeURIComponent(meal));
    if (!response.ok) throw new Error("Server returned HTTP " + response.status);

    const data = await response.json();
    if (data.success === false || data.error) throw new Error(data.error || "Backend failed.");

    showResult(data, meal);
  } catch (err) {
    alert("System Diagnostic Message: " + err.message);
  } finally {
    loading.style.display = "none";
  }
}

function showResult(data, mealText) {
  resultCard.style.display = "block";
  mealCalories.innerHTML = "🔥 <b>" + data.totalCalories + "</b> kcal";
  mealProtein.innerHTML = "💪 <b>" + data.totalProtein + "</b> g protein";
  confidence.innerHTML = "🎯 Confidence : " + Math.round(data.confidence * 100) + "%";

  foodList.innerHTML = "";
  if (data.foods && Array.isArray(data.foods)) {
    data.foods.forEach(function (food) {
      foodList.innerHTML += "<li>" + food.quantity + " × " + food.name + "</li>";
    });
  }

  updateDashboard(data);
  
  // Real-time local append logic 
  appendSingleTimelineItem(mealText, data.totalCalories, data.totalProtein);
}

// ==========================================
// UI Rendering Core Mechanics
// ==========================================
function updateDashboard(data) {
  todayCalories.innerHTML = "<b>" + data.todayCalories + " / " + data.calorieGoal + " kcal</b>";
  let caloriePercent = (data.todayCalories / data.calorieGoal) * 100;
  calorieBar.style.width = Math.min(caloriePercent, 100) + "%";

  if (caloriePercent < 80) calorieBar.style.background = "var(--success)";
  else if (caloriePercent <= 100) calorieBar.style.background = "var(--warning)";
  else calorieBar.style.background = "var(--danger)";

  todayProtein.innerHTML = "<b>" + data.todayProtein + " / " + data.proteinGoal + " g</b>";
  let proteinPercent = (data.todayProtein / data.proteinGoal) * 100;
  proteinBar.style.width = Math.min(proteinPercent, 100) + "%";
  proteinBar.style.background = proteinPercent >= 100 ? "var(--success)" : "var(--accent-muted)";

  coach.innerHTML = data.coach || "Keep tracking!";
}

function clearFakeTimeline() {
  if (!window.timelineCleaned && timelineContainer) {
    timelineContainer.innerHTML = "";
    window.timelineCleaned = true;
  }
}

function appendSingleTimelineItem(text, kcal, protein) {
  clearFakeTimeline();
  const now = new Date();
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  const html = createTimelineRow(timeStr, text, kcal, protein);
  timelineContainer.insertAdjacentHTML('afterbegin', html);
}

function renderFullHistoryTimeline(historyArray) {
  if (!timelineContainer) return;
  window.timelineCleaned = true;
  timelineContainer.innerHTML = ""; // Complete purge of template data
  
  // Loop backward to keep latest items at the top of the timeline feed
  for(let i = historyArray.length - 1; i >= 0; i--) {
    const item = historyArray[i];
    const html = createTimelineRow(item.time, item.rawInput, item.calories, item.protein);
    timelineContainer.innerHTML += html;
  }
}

function createTimelineRow(time, title, kcal, prot) {
  return `
    <div class="timeline-item">
      <div class="timeline-marker"></div>
      <div class="timeline-content">
        <div class="timeline-meta">
          <span class="timeline-time">${time}</span>
          <span class="timeline-tag">Logged</span>
        </div>
        <h4 class="timeline-title">${title}</h4>
        <p class="timeline-desc">${kcal} kcal • ${prot}g Protein</p>
      </div>
    </div>
  `;
}
