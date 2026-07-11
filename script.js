// ==========================================
// AI Fitness Tracker Frontend Layer Setup
// ==========================================

const API_URL = "https://script.google.com/macros/s/AKfycbx1xpXsQwtsGNGaIlFlxlAFeEIcT4tRRpik65ugnFma6ibydox03qQGJMsra5FL2F9C0w/exec";

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

// Initialize State Visibility matching premium design definitions
document.addEventListener("DOMContentLoaded", () => {
  if (loading) loading.classList.add("hidden");
  if (resultCard) resultCard.classList.add("hidden");
  
  // Dynamic Input Textarea Autoresizer
  if (mealInput) {
    mealInput.addEventListener("input", function() {
      this.style.height = "auto";
      this.style.height = (this.scrollHeight) + "px";
    });
  }
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

  recognition.onstart = function () {
    voiceBtn.innerHTML = `
      <svg class="spinner" style="animation-duration: 1.5s" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/></svg>
    `;
  };

  recognition.onend = function () {
    voiceBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
    `;
  };

  recognition.onerror = function (e) {
    alert("Voice Processing Error: " + e.error);
  };

  recognition.onresult = function (event) {
    mealInput.value = event.results[0][0].transcript;
    mealInput.dispatchEvent(new Event('input')); // trigger auto-resize calculation
  };
}

voiceBtn.addEventListener("click", function () {
  if (!recognition) {
    alert("Speech Recognition engine is not supported by your current web browser architecture.");
    return;
  }
  recognition.start();
});

// ==========================================
// Log Meal Event Handling Pipeline
// ==========================================

logBtn.addEventListener("click", logMeal);

async function logMeal() {
  const meal = mealInput.value.trim();

  if (!meal) {
    alert("Please formulate a valid meal statement description.");
    return;
  }

  loading.classList.remove("hidden");
  resultCard.classList.add("hidden");

  try {
    const response = await fetch(API_URL + "?meal=" + encodeURIComponent(meal));

    if (!response.ok) {
      throw new Error("Target API Node returned status code " + response.status);
    }

    const data = await response.json();

    if (data.success === false) {
      throw new Error(data.error);
    }

    showResult(data);
  } catch (err) {
    console.error(err);
    alert(err.message);
  } finally {
    loading.classList.add("hidden");
  }
}

// ==========================================
// Analysis Output Parsing Engine
// ==========================================

function showResult(data) {
  resultCard.classList.remove("hidden");

  // Format single meal values seamlessly into premium card slots
  mealCalories.innerText = `${data.totalCalories} kcal`;
  mealProtein.innerText = `${data.totalProtein} g`;
  confidence.innerText = `Confidence: ${Math.round(data.confidence * 100)}%`;

  foodList.innerHTML = "";

  data.foods.forEach(function (food) {
    const chip = document.createElement("li");
    chip.innerText = `${food.quantity} × ${food.name}`;
    foodList.appendChild(chip);
  });

  updateDashboard(data);
}

// ==========================================
// Premium Dynamic Dashboard Engine
// ==========================================

function updateDashboard(data) {
  const calGoal = data.calorieGoal || 2000;
  const protGoal = data.proteinGoal || 120;

  // Build high-end minimal visual text responses
  todayCalories.innerHTML = `${data.todayCalories} <span class="unit">/ ${calGoal} kcal</span>`;
  todayProtein.innerHTML = `${data.todayProtein} <span class="unit">/ ${protGoal} g</span>`;

  // Calculate strict progress metrics percentages
  let caloriePercent = (data.todayCalories / calGoal) * 100;
  let proteinPercent = (data.todayProtein / protGoal) * 100;

  calorieBar.style.width = Math.min(caloriePercent, 100) + "%";
  proteinBar.style.width = Math.min(proteinPercent, 100) + "%";

  // Class Reset Pipeline for Calorie Bar State Mapping
  calorieBar.className = "progress-bar";
  if (caloriePercent < 80) {
    calorieBar.classList.add("progress-safe"); // Premium soft green
  } else if (caloriePercent <= 100) {
    calorieBar.classList.add("progress-warn"); // Muted warning amber
  } else {
    calorieBar.classList.add("progress-danger"); // Flat warning red
  }

  // Class Reset Pipeline for Protein Progression Mapping
  proteinBar.className = "progress-bar";
  if (proteinPercent < 100) {
    proteinBar.classList.add("progress-neutral"); // Clean brand asset gray-green
  } else {
    proteinBar.classList.add("progress-safe"); // Full performance complete green
  }

  // Inject Clean Context Text string directly into AI Box interface cleanly
  coach.innerText = data.coach || "Metrics calibrated. Continue log patterns for deeper behavioral analytics tracking.";
}
