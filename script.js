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

// Premium Input Textarea Autoresizer utility
document.addEventListener("DOMContentLoaded", () => {
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
    voiceBtn.innerHTML = "🎙 Listening...";
  };

  recognition.onend = function () {
    voiceBtn.innerHTML = "🎤 Speak";
  };

  recognition.onerror = function (e) {
    alert("Voice Error : " + e.error);
  };

  recognition.onresult = function (event) {
    mealInput.value = event.results[0][0].transcript;
    mealInput.dispatchEvent(new Event('input'));
  };
}

voiceBtn.addEventListener("click", function () {
  if (!recognition) {
    alert("Speech Recognition not supported.");
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
    alert("Please enter a meal.");
    return;
  }

  // Exact UI interaction state toggling logic from original script
  loading.style.display = "block";
  resultCard.style.display = "none";

  try {
    const response = await fetch(API_URL + "?meal=" + encodeURIComponent(meal));

    if (!response.ok) {
      throw new Error("Server returned " + response.status);
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
    loading.style.display = "none";
  }
}

// ==========================================
// Analysis Output Parsing Engine
// ==========================================

function showResult(data) {
  resultCard.style.display = "block";

  // Retaining exact markup structure your backend looks for
  mealCalories.innerHTML = "🔥 <b>" + data.totalCalories + "</b> kcal";
  mealProtein.innerHTML = "💪 <b>" + data.totalProtein + "</b> g protein";
  confidence.innerHTML = "🎯 Confidence : " + Math.round(data.confidence * 100) + "%";

  foodList.innerHTML = "";

  data.foods.forEach(function (food) {
    foodList.innerHTML += "<li>" + food.quantity + " × " + food.name + "</li>";
  });

  updateDashboard(data);
}

// ==========================================
// Dynamic Dashboard Engine
// ==========================================

function updateDashboard(data) {
  todayCalories.innerHTML = "<b>" + data.todayCalories + " / " + data.calorieGoal + " kcal</b>";

  let caloriePercent = (data.todayCalories / data.calorieGoal) * 100;
  calorieBar.style.width = Math.min(caloriePercent, 100) + "%";

  // Tonal status changes utilizing premium custom colors variables
  if (caloriePercent < 80) {
    calorieBar.style.background = "var(--success)";
  } else if (caloriePercent <= 100) {
    calorieBar.style.background = "var(--warning)";
  } else {
    calorieBar.style.background = "var(--danger)";
  }

  if (data.todayCalories > data.calorieGoal) {
    todayCalories.innerHTML += "<br><span style='color:var(--danger); font-size:12px; font-weight:500;'>Over by " + (data.todayCalories - data.calorieGoal).toFixed(0) + " kcal</span>";
  } else {
    todayCalories.innerHTML += "<br><span style='color:var(--success); font-size:12px; font-weight:500;'>Remaining " + (data.calorieGoal - data.todayCalories).toFixed(0) + " kcal</span>";
  }

  todayProtein.innerHTML = "<b>" + data.todayProtein + " / " + data.proteinGoal + " g</b>";

  let proteinPercent = (data.todayProtein / data.proteinGoal) * 100;
  proteinBar.style.width = Math.min(proteinPercent, 100) + "%";

  if (proteinPercent < 100) {
    proteinBar.style.background = "var(--accent-muted)";
  } else {
    proteinBar.style.background = "var(--success)";
  }

  if (data.todayProtein >= data.proteinGoal) {
    todayProtein.innerHTML += "<br><span style='color:var(--success); font-size:12px; font-weight:500;'>Goal achieved ✅</span>";
  } else {
    todayProtein.innerHTML += "<br><span style='color:var(--warning); font-size:12px; font-weight:500;'>Remaining " + (data.proteinGoal - data.todayProtein).toFixed(1) + " g</span>";
  }

  coach.innerHTML = data.coach;
}
