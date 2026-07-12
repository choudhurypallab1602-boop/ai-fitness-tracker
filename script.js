const API_URL = "https://script.google.com/macros/s/AKfycbx0HJJqR_CqWbBeDODYsqGHiIDVBV7OUvegNpQmindiqne_z7L_B-vh2j6uqpFQvf9Sig/exec";
const APP_SECURE_PASSWORD = "admin123"; 

let globalHistoryCache = [];
let currentFilterScope = "today"; 
let isGuestModeActive = false; 

window.addEventListener("load", () => {
  const loginBtnElement = document.getElementById("loginBtn");
  const guestBtnElement = document.getElementById("guestBtn");
  const logoutBtnElement = document.getElementById("logoutBtn");
  const logBtn = document.getElementById("logBtn");
  const mealInput = document.getElementById("meal");
  const datePicker = document.getElementById("historyDatePicker");

  const todayDateStr = new Date().toISOString().split('T')[0];
  if(datePicker) datePicker.value = todayDateStr;

  if (mealInput) {
    mealInput.addEventListener("input", function() {
      this.style.height = "auto";
      this.style.height = (this.scrollHeight) + "px";
    });
  }

  if(loginBtnElement) loginBtnElement.addEventListener("click", handleDashboardLogin);
  if(guestBtnElement) guestBtnElement.addEventListener("click", handleGuestLogin);
  if(logoutBtnElement) logoutBtnElement.addEventListener("click", handleUserLogout);
  if(logBtn) logBtn.addEventListener("click", logMeal);

  initializeVoiceRecognizer();

  const savedAuthMode = sessionStorage.getItem("app_session_auth");
  if(savedAuthMode === "master") {
    executeInterfaceActivation(false);
  } else if(savedAuthMode === "guest") {
    executeInterfaceActivation(true);
  }
});

function handleDashboardLogin() {
  const passwordField = document.getElementById("authPassword");
  if(!passwordField) return;
  if(passwordField.value === APP_SECURE_PASSWORD) {
    sessionStorage.setItem("app_session_auth", "master");
    executeInterfaceActivation(false);
  } else {
    alert("Invalid access password entry.");
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
    globalHistoryCache = [
      { actualRowIndex: 2, date: new Date().toISOString().split('T')[0], time: "22:20", rawInput: "Guest Demo: 2 aloo chop", calories: 380, protein: 7, rowId: 10001 }
    ];
    processMetricsAndTimelineView();
  } else {
    document.getElementById("guestBanner").style.display = "none";
    loadDashboardOnStart();
  }
}

function initializeVoiceRecognizer() {
  if ("webkitSpeechRecognition" in window) {
    const recognition = new webkitSpeechRecognition();
    recognition.lang = "en-IN";
    const voiceBtn = document.getElementById("voiceBtn");
    
    recognition.onstart = function () { if(voiceBtn) voiceBtn.innerHTML = "🎙 Listening..."; };
    recognition.onend = function () { if(voiceBtn) voiceBtn.innerHTML = "🎤 Speak"; };
    recognition.onresult = function (event) {
      const mealInput = document.getElementById("meal");
      if(mealInput) {
        mealInput.value = event.results[0][0].transcript;
        mealInput.dispatchEvent(new Event('input'));
      }
    };
    if(voiceBtn) voiceBtn.addEventListener("click", () => { recognition.start(); });
  }
}

async function loadDashboardOnStart() {
  if(isGuestModeActive) return;
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    if(data.history) {
      globalHistoryCache = data.history; 
      processMetricsAndTimelineView();
    }
  } catch (err) { console.log("Database fetch failed."); }
}

async function logMeal() {
  const mealInput = document.getElementById("meal");
  if(!mealInput) return;
  const meal = mealInput.value.trim();
  if (!meal) { alert("Please enter a meal."); return; }

  const loading = document.getElementById("loading");
  const datePicker = document.getElementById("historyDatePicker");
  const activeSelectedDate = datePicker ? datePicker.value : new Date().toISOString().split('T')[0];

  if(loading) loading.style.display = "block";

  if(isGuestModeActive) {
    setTimeout(() => {
      let mockCal = 440; let mockProt = 7;
      if (meal.toLowerCase().includes("egg")) { mockCal = 180; mockProt = 15; }
      
      globalHistoryCache.push({
        actualRowIndex: globalHistoryCache.length + 2, date: activeSelectedDate,
        time: new Date().toTimeString().substring(0,5), rawInput: meal, calories: mockCal, protein: mockProt, rowId: new Date().getTime()
      });
      showResult({ totalCalories: mockCal, totalProtein: mockProt, confidence: 0.90, foods: [{ name: meal, quantity: 1 }] });
      processMetricsAndTimelineView();
      if(loading) loading.style.display = "none";
      mealInput.value = "";
    }, 500);
    return;
  }

  try {
    const response = await fetch(`${API_URL}?meal=${encodeURIComponent(meal)}&customDate=${activeSelectedDate}`);
    const data = await response.json();
    if(data.history) {
      globalHistoryCache = data.history;
      if (data.history.length > 0) {
        const lastEntry = data.history[data.history.length - 1];
        showResult({ totalCalories: lastEntry.calories, totalProtein: lastEntry.protein, confidence: 0.90, foods: [{ name: lastEntry.rawInput, quantity: 1 }] });
      }
      processMetricsAndTimelineView();
    }
  } catch (err) { alert("Error logging meal: " + err.message); }
  finally { if(loading) loading.style.display = "none"; mealInput.value = ""; }
}

function showResult(data) {
  const resultCard = document.getElementById("result");
  if (!data || !resultCard) return;
  resultCard.style.display = "block";
  
  if(document.getElementById("mealCalories")) document.getElementById("mealCalories").innerHTML = (data.totalCalories || 0) + " kcal";
  if(document.getElementById("mealProtein")) document.getElementById("mealProtein").innerHTML = (data.totalProtein || 0) + " g protein";
  if(document.getElementById("confidence")) document.getElementById("confidence").innerHTML = "🎯 Confidence : " + Math.round((data.confidence || 0) * 100) + "%";

  const foodList = document.getElementById("foodList");
  if(foodList) {
    foodList.innerHTML = "";
    if (data.foods) data.foods.forEach(f => { foodList.innerHTML += "<li>" + f.quantity + " × " + f.name + "</li>"; });
  }
}

async function promptDeleteMeal(rowId, rowIndex) {
  if(!confirm("Are you sure you want to delete this log?")) return;
  if(isGuestModeActive) {
    globalHistoryCache = globalHistoryCache.filter(item => item.rowId !== rowId);
    processMetricsAndTimelineView();
    return;
  }
  try {
    const response = await fetch(`${API_URL}?action=delete&rowId=${rowId}&rowIndex=${rowIndex}`);
    const result = await response.json();
    if(result.success) { loadDashboardOnStart(); }
  } catch(err) { alert("Deletion error."); }
}

function switchViewScope(scope) {
  currentFilterScope = scope;
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  if(event && event.target) event.target.classList.add("active");
  const titleMap = { "today": "Timeline Feed", "weekly": "Weekly Summary Dashboard", "monthly": "Monthly View Metrics" };
  if(document.getElementById("dashboardScopeTitle")) document.getElementById("dashboardScopeTitle").innerText = titleMap[scope];
  processMetricsAndTimelineView();
}

function filterTimelineByDate() {
  currentFilterScope = "date-specific";
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
  if(document.getElementById("dashboardScopeTitle")) document.getElementById("dashboardScopeTitle").innerText = "Selected Date Metrics";
  processMetricsAndTimelineView();
}

function processMetricsAndTimelineView() {
  const timelineContainer = document.querySelector(".timeline");
  if(!timelineContainer) return;
  const datePicker = document.getElementById("historyDatePicker");
  const targetDateStr = datePicker ? datePicker.value : new Date().toISOString().split('T')[0]; 
  const todayStr = new Date().toISOString().split('T')[0];
  let filteredList = [];
  let sumCal = 0; let sumProt = 0;
  let calGoal = 2000; let protGoal = 120;

  globalHistoryCache.forEach(item => {
    const dateDiff = (new Date(todayStr) - new Date(item.date)) / (24 * 60 * 60 * 1000);
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
            <button class="btn-remove" onclick="promptDeleteMeal(${row.rowId}, ${row.actualRowIndex})">Remove</button>
          </div>
          <div class="timeline-meta">${row.date} • ${row.time} <span>Logged</span></div>
          <h4>${row.rawInput}</h4>
          <p>${row.calories} kcal • ${row.protein}g Protein</p>
        </div>
      </div>`;
  }
}

function updateDashboard(sumCal, calGoal, sumProt, protGoal) {
  if(document.getElementById("todayCalories")) document.getElementById("todayCalories").innerText = sumCal + " / " + calGoal + " kcal";
  if(document.getElementById("calorieBar")) {
    document.getElementById("calorieBar").style.width = Math.min((sumCal / calGoal) * 100, 100) + "%";
  }
  if(document.getElementById("todayProtein")) document.getElementById("todayProtein").innerText = sumProt + " / " + protGoal + " g";
  if(document.getElementById("proteinBar")) {
    document.getElementById("proteinBar").style.width = Math.min((sumProt / protGoal) * 100, 100) + "%";
  }
  const coach = document.getElementById("coach");
  if (coach) {
    if(sumCal === 0) coach.innerHTML = "Log your first meal to initialize live context-aware coaching feedback.";
    else if (sumCal > calGoal) coach.innerHTML = "You have crossed your optimal target calories limit for this structural frame.";
    else coach.innerHTML = "Great job tracking! Your nutritional targets are perfectly aligned.";
  }
}
