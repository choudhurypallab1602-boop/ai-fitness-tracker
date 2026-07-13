/**
 * Aura Core Application State & UI Engineering Engine 
 * Core Fixed: Syntax checked, clean termination, and range-based loaders.
 */

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
  // Authentication Engine Handlers
  document.getElementById("loginBtn").addEventListener("click", handleLogin);
  document.getElementById("guestBtn").addEventListener("click", handleGuest);
  document.getElementById("logoutBtn").addEventListener("click", handleLogout);
  document.getElementById("logBtn").addEventListener("click", logMeal);
  
  // Navigation Router Switches
  document.getElementById("menuHome").addEventListener("click", function() { routeToView('home'); });
  document.getElementById("menuJournal").addEventListener("click", function() { routeToView('journal'); });
  document.getElementById("menuCoach").addEventListener("click", function() { routeToView('coach'); });

  // Quick Action Matrix Links
  const bananaBtn = document.getElementById("quickBanana");
  const eggBtn = document.getElementById("quickEgg");
  const wheyBtn = document.getElementById("quickWhey");

  if(bananaBtn) bananaBtn.addEventListener("click", function() { triggerQuickMacro("1 Whole fresh Banana"); });
  if(eggBtn) eggBtn.addEventListener("click", function() { triggerQuickMacro("2 Boiled Whole Eggs"); });
  if(wheyBtn) wheyBtn.addEventListener("click", function() { triggerQuickMacro("1 scoop Organic Whey Isolate Shake"); });

  // DYNAMIC SELECTION UI TOGGLE ENGINE (Daily Date vs Month Dropdown)
  const pills = document.querySelectorAll(".segment-pills .pill-btn");
  const dailyPicker = document.getElementById("historyDatePicker");
  const monthPicker = document.getElementById("historyMonthPicker");

  pills.forEach(function(pill) {
    pill.addEventListener("click", function(e) {
      e.preventDefault();
      pills.forEach(p => p.classList.remove("active"));
      this.classList.add("active");
      
      currentScope = this.getAttribute("data-scope");
      
      // UI Dropdown Controller Switch
      if (currentScope === 'month') {
        if(dailyPicker) dailyPicker.style.display = "none";
        if(monthPicker) {
          monthPicker.style.display = "block";
          if(!monthPicker.value) {
            const now = new Date();
            monthPicker.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
          }
        }
      } else {
        if(monthPicker) monthPicker.style.display = "none";
        if(dailyPicker) dailyPicker.style.display = "block";
      }
      
      const titleMap = { today: 'Daily Progress Matrix', week: 'Weekly Total Metrics', month: 'Monthly Total Metrics' };
      const metricsTitle = document.getElementById("metricsTitle");
      if(metricsTitle) metricsTitle.innerText = titleMap[currentScope] || 'Progress Indicators';
      
      processView();
    });
  });

  // Date Pickers Change Triggers
  if (dailyPicker) {
    if (!dailyPicker.value) {
      const localToday = new Date();
      const offset = localToday.getTimezoneOffset();
      const adjustedDate = new Date(localToday.getTime() - (offset * 60 * 1000));
      dailyPicker.value = adjustedDate.toISOString().split('T')[0];
    }
    dailyPicker.addEventListener("change", function() { 
      processView(); 
      loadDailyMemo(); 
    });
  }

  if (monthPicker) {
    monthPicker.addEventListener("change", function() {
      processView();
    });
  }

  // Sidebar Notepad Sync
  const notepad = document.getElementById("dashboardMemo");
  if (notepad) {
    notepad.addEventListener("input", saveDailyMemo);
  }

  initializeVoice();

  // Session Checker
  const savedUser = sessionStorage.getItem("auth_user");
  if(savedUser) {
    activateDashboard(savedUser === "Guest", savedUser);
  }
  
  loadDailyMemo();
});

function routeToView(target) {
  const mHome = document.getElementById("menuHome");
  const mJournal = document.getElementById("menuJournal");
  const mCoach = document.getElementById("menuCoach");
  const vHome = document.getElementById("viewHome");
  const vJournal = document.getElementById("viewJournal");
  const vCoach = document.getElementById("viewCoach");

  if(mHome) mHome.classList.remove("active");
  if(mJournal) mJournal.classList.remove("active");
  if(mCoach) mCoach.classList.remove("active");
  if(vHome) vHome.style.display = "none";
  if(vJournal) vJournal.style.display = "none";
  if(vCoach) vCoach.style.display = "none";

  if(target === 'home') { if(mHome) mHome.classList.add("active"); if(vHome) vHome.style.display = "block"; }
  else if(target === 'journal') { if(mJournal) mJournal.classList.add("active"); if(vJournal) vJournal.style.display = "block"; }
  else if(target === 'coach') { if(mCoach) mCoach.classList.add("active"); if(vCoach) vCoach.style.display = "block"; }
}

function triggerQuickMacro(text) {
  const inputField = document.getElementById("meal");
  if(inputField) { inputField.value = text; inputField.focus(); }
}

function handleLogin() {
  const u = document.getElementById("authUsername").value.trim().toLowerCase();
  const p = document.getElementById("authPassword").value.trim();
  if(u === ALLOWED_USER.username && p === ALLOWED_USER.password) {
    sessionStorage.setItem("auth_user", u);
    activateDashboard(false, u);
  } else { alert("Incorrect Credentials."); }
}

function handleGuest() { sessionStorage.setItem("auth_user", "Guest"); activateDashboard(true, "Guest"); }
function handleLogout() { sessionStorage.clear(); window.location.reload(); }

function activateDashboard(isGuest, name) {
  isGuestModeActive = isGuest;
  const authScreen = document.getElementById("authScreen");
  const mainDashboard = document.getElementById("mainDashboard");
  const guestBanner = document.getElementById("guestBanner");
  const userDisplay = document.getElementById("userDisplay");

  if(authScreen) authScreen.style.display = "none";
  if(mainDashboard) mainDashboard.style.display = (window.innerWidth <= 1024) ? "block" : "grid";
  if(userDisplay && name) userDisplay.innerText = name.substring(0,1).toUpperCase();

  if(isGuestModeActive) {
    if(guestBanner) guestBanner.style.display = "block";
    processView();
  } else { loadData(); }
}

function normalizeInputString(str) {
  if(!str) return "";
  let clean = str.trim().toLowerCase();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function initializeVoice() {
  if ("webkitSpeechRecognition" in window) {
    recognition = new webkitSpeechRecognition();
    recognition.lang = "en-IN"; recognition.continuous = true; recognition.interimResults = false;   
    const voiceBtn = document.getElementById("voiceBtn");
    const mealInput = document.getElementById("meal");
    if(!voiceBtn) return;

    recognition.onstart = function() {
      isListening = true;
      if(voiceBtn.querySelector('.voice-label')) voiceBtn.querySelector('.voice-label').innerText = "Stop";
      voiceBtn.style.background = "#fee2e2";
    };
    recognition.onend = function() {
      isListening = false;
      if(voiceBtn.querySelector('.voice-label')) voiceBtn.querySelector('.voice-label').innerText = "Speak";
      voiceBtn.style.background = "#f1f5f9";
    };
    recognition.onresult = function(event) {
      let txt = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) txt += event.results[i][0].transcript + " ";
      }
      if(txt.trim() && mealInput) mealInput.value += normalizeInputString(txt);
    };
    voiceBtn.addEventListener("click", function(e) { e.preventDefault(); if (isListening) recognition.stop(); else recognition.start(); });
  }
}

async function loadData() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    if(data.history) globalHistoryCache = data.history; 
    if(data.coach || data.coachResponse) {
      const speechBox = document.getElementById("coachCharacterSpeech");
      if(speechBox) speechBox.innerText = data.coach || data.coachResponse;
    }
    processView();
  } catch (err) { console.log("Data core fetch fault."); }
}

async function logMeal() {
  const input = document.getElementById("meal");
  if(!input) return;
  let meal = normalizeInputString(input.value);
  if (!meal) return;
  
  const loading = document.getElementById("loading");
  if(loading) loading.style.display = "block";
  const datePicker = document.getElementById("historyDatePicker");
  const date = datePicker ? datePicker.value : new Date().toISOString().split('T')[0];

  try {
    const res = await fetch(API_URL + "?meal=" + encodeURIComponent(meal) + "&customDate=" + date);
    const data = await res.json();
    if(data.history) globalHistoryCache = data.history;
    if(data.coach || data.coachResponse) {
      const sb = document.getElementById("coachCharacterSpeech");
      if(sb) sb.innerText = data.coach || data.coachResponse;
    }
    processView();
  } catch (err) { alert("Logging processing failure."); }
  finally { if(loading) loading.style.display = "none"; input.value = ""; }
}

function updateLinearProgress(barFillId, current, limit) {
  const fillElement = document.getElementById(barFillId);
  if (!fillElement) return;
  let percentage = (current / limit) * 100;
  if (percentage > 100) percentage = 100; 
  if (percentage < 0) percentage = 0;
  fillElement.style.width = percentage + "%";
}

function processView() {
  const homeTimeline = document.querySelector(".timeline");
  const journalTimeline = document.querySelector(".journal-timeline-target");
  const dailyPicker = document.getElementById("historyDatePicker");
  const monthPicker = document.getElementById("historyMonthPicker");
  
  if(!dailyPicker || !monthPicker) return;
  
  let filtered = [];
  let cal = 0, prot = 0;
  let targetLimit = 2000, proteinLimit = 120;

  if (currentScope === 'today') {
    const selectedDateStr = dailyPicker.value;
    globalHistoryCache.forEach(function(item, index) {
      if(item.date === selectedDateStr) {
        filtered.push(Object.assign({}, item, {originalIndex: index}));
        cal += Number(item.calories) || 0;
        prot += Number(item.protein) || 0;
      }
    });
  } 
  else if (currentScope === 'week') {
    const selectedDateStr = dailyPicker.value;
    const parts = selectedDateStr.split('-');
    const endDate = new Date(parseInt(parts[0],10), parseInt(parts[1],10)-1, parseInt(parts[2],10), 0,0,0,0);
    const startDate = new Date(endDate);
    startDate.setDate(endDate.getDate() - 6);

    targetLimit = 14000; proteinLimit = 840;

    globalHistoryCache.forEach(function(item, index) {
      if(!item.date) return;
      const iP = item.date.split('-');
      const itemDate = new Date(parseInt(iP[0],10), parseInt(iP[1],10)-1, parseInt(iP[2],10), 0,0,0,0);
      
      if(itemDate >= startDate && itemDate <= endDate) {
        filtered.push(Object.assign({}, item, {originalIndex: index}));
        cal += Number(item.calories) || 0;
        prot += Number(item.protein) || 0;
      }
    });
  } 
  else if (currentScope === 'month') {
    const selectedMonthStr = monthPicker.value; 
    targetLimit = 60000; proteinLimit = 3600;

    globalHistoryCache.forEach(function(item, index) {
      if(!item.date) return;
      if(item.date.startsWith(selectedMonthStr)) {
        filtered.push(Object.assign({}, item, {originalIndex: index}));
        cal += Number(item.calories) || 0;
        prot += Number(item.protein) || 0;
      }
    });
  }

  const calBox = document.getElementById("todayCalories");
  const protBox = document.getElementById("todayProtein");
  if(calBox) calBox.innerText = cal.toFixed(0);
  if(protBox) protBox.innerText = prot.toFixed(1);

  updateLinearProgress("calorieBarFill", cal, targetLimit);
  updateLinearProgress("proteinBarFill", prot, proteinLimit);

  renderTimelineDom(filtered, homeTimeline);
  renderTimelineDom(filtered, journalTimeline);
}

function renderTimelineDom(dataset, targetContainer) {
  if(!targetContainer) return;
  targetContainer.innerHTML = "";
  
  if(dataset.length === 0) {
    targetContainer.innerHTML = "<div class='null-state-msg' style='padding:20px; font-size:12px; color:#64748b; text-align:center;'>No entries registered in this scope.</div>";
    return;
  }
  
  let localCopy = dataset.slice().reverse();

  localCopy.forEach(function(row) {
    const itemEl = document.createElement("div");
    itemEl.className = "timeline-node";
    itemEl.innerHTML = "<div class='node-dot-track'><span class='node-dot'></span></div>" +
      "<div class='node-payload' style='width: 100%;'>" +
        "<div class='node-meta-row'>" +
          "<span class='node-timestamp'>" + row.date + " · " + (row.time || "00:00") + "</span>" +
          "<div class='node-crud-triggers'>" +
            "<button class='unique-edit-btn-" + row.originalIndex + "'>✏️</button>" +
            "<button class='unique-del-btn-" + row.originalIndex + "'>🗑️</button>" +
          "</div>" +
        "</div>" +
        "<div class='node-title-meal'>" + normalizeInputString(row.rawInput || row.meal) + "</div>" +
        "<p class='node-macro-summary' style='margin-top:4px; font-size:11px; color:#64748b;'>" + row.calories + " kcal · " + row.protein + "g Protein</p>" +
      "</div>";

    targetContainer.appendChild(itemEl);

    itemEl.querySelector(".unique-edit-btn-" + row.originalIndex).addEventListener("click", function() {
      const mb = document.getElementById("meal"); if(mb) { mb.value = row.rawInput || row.meal; routeToView('home'); mb.focus(); }
    });
    itemEl.querySelector(".unique-del-btn-" + row.originalIndex).addEventListener("click", function() { deleteMeal(row.originalIndex); });
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
        const sb = document.getElementById("coachCharacterSpeech"); if(sb) sb.innerText = data.coach || data.coachResponse;
      }
      processView();
    } catch (err) { alert("Deletion engine dropped connection."); }
    finally { if(loading) loading.style.display = "none"; }
  }
}

function getActiveTimelineDate() {
  const dp = document.getElementById("historyDatePicker"); return dp && dp.value ? dp.value : new Date().toISOString().split('T')[0];
}

function loadDailyMemo() {
  const mt = document.getElementById("dashboardMemo"); const ms = document.getElementById("memoStatus"); if (!mt) return;
  const activeDate = getActiveTimelineDate(); const cachedData = localStorage.getItem("aura_notes_" + activeDate);
  mt.value = cachedData ? cachedData : "";
  if (ms) { ms.textContent = "Saved"; ms.style.background = "#ccfbf1"; ms.style.color = "#0d9488"; }
}

let saveTimeout;
function saveDailyMemo() {
  const mt = document.getElementById("dashboardMemo"); const ms = document.getElementById("memoStatus"); if (!mt) return;
  if (ms) { ms.textContent = "Saving..."; ms.style.background = "#fef3c7"; ms.style.color = "#b45309"; }
  clearTimeout(saveTimeout);
  saveTimeout = setTimeout(function() {
    const activeDate = getActiveTimelineDate(); localStorage.setItem("aura_notes_" + activeDate, mt.value);
    if (ms) { ms.textContent = "Saved"; ms.style.background = "#ccfbf1"; ms.style.color = "#0d9488"; }
  }, 400);
}

window.addEventListener("resize", function() {
  const mb = document.getElementById("mainDashboard");
  if (mb && mb.style.display !== "none") mb.style.display = (window.innerWidth <= 1024) ? "block" : "grid";
});
