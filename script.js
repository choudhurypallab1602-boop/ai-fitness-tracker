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
  document.getElementById("quickBanana").addEventListener("click", function() { triggerQuickMacro("1 Whole fresh Banana"); });
  document.getElementById("quickEgg").addEventListener("click", function() { triggerQuickMacro("2 Boiled Whole Eggs"); });
  document.getElementById("quickWhey").addEventListener("click", function() { triggerQuickMacro("1 scoop Organic Whey Isolate Shake"); });

  // Segmented Pill Filtering Logic Loop
  const pills = document.querySelectorAll(".segment-pills .pill-btn");
  pills.forEach(function(pill) {
    pill.addEventListener("click", function() {
      pills.forEach(p => p.classList.remove("active"));
      pill.classList.add("active");
      currentScope = pill.getAttribute("data-scope");
      
      // Title Update dynamically
      const titleMap = { today: 'Daily Progress Matrix', week: 'Weekly Total Metrics', month: 'Monthly Total Metrics' };
      document.getElementById("metricsTitle").innerText = titleMap[currentScope] || 'Progress Indicators';
      processView();
    });
  });

  // Sticky Pad Notepad Event Persistence Loop
  const notepad = document.getElementById("dashboardMemo");
  const memoStatus = document.getElementById("memoStatus");
  
  if(localStorage.getItem("aura_workspace_memo")) {
    notepad.value = localStorage.getItem("aura_workspace_memo");
  }
  notepad.addEventListener("input", function() {
    memoStatus.innerText = "Saving...";
    localStorage.setItem("aura_workspace_memo", notepad.value);
    setTimeout(() => { memoStatus.innerText = "Autosaved"; }, 800);
  });

  const picker = document.getElementById("historyDatePicker");
  picker.value = new Date().toISOString().split('T')[0];
  picker.addEventListener("change", function() { processView(); });

  initializeVoice();

  const savedUser = sessionStorage.getItem("auth_user");
  if(savedUser) {
    activateDashboard(savedUser === "Guest", savedUser);
  }
});

function routeToView(target) {
  // Menu highlight updates
  document.getElementById("menuHome").classList.remove("active");
  document.getElementById("menuJournal").classList.remove("active");
  document.getElementById("menuCoach").classList.remove("active");
  
  // Clean page targets toggle
  document.getElementById("viewHome").style.display = "none";
  document.getElementById("viewJournal").style.display = "none";
  document.getElementById("viewCoach").style.display = "none";

  if(target === 'home') {
    document.getElementById("menuHome").classList.add("active");
    document.getElementById("viewHome").style.display = "block";
  } else if(target === 'journal') {
    document.getElementById("menuJournal").classList.add("active");
    document.getElementById("viewJournal").style.display = "block";
  } else if(target === 'coach') {
    document.getElementById("menuCoach").classList.add("active");
    document.getElementById("viewCoach").style.display = "block";
  }
}

function triggerQuickMacro(text) {
  const inputField = document.getElementById("meal");
  inputField.value = text;
  inputField.focus();
}

function handleLogin() {
  const u = document.getElementById("authUsername").value.trim().toLowerCase();
  const p = document.getElementById("authPassword").value.trim();
  if(u === ALLOWED_USER.username && p === ALLOWED_USER.password) {
    sessionStorage.setItem("auth_user", u);
    activateDashboard(false, u);
  } else {
    alert("Incorrect Credentials.");
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
  document.getElementById("mainDashboard").style.display = "grid";
  document.getElementById("userDisplay").innerText = name.substring(0,1).toUpperCase();
  if(isGuestModeActive) {
    document.getElementById("guestBanner").style.display = "block";
    processView();
  } else {
    loadData();
  }
}

function normalizeInputString(str) {
  if(!str) return "";
  let clean = str.trim().toLowerCase();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function initializeVoice() {
  if ("webkitSpeechRecognition" in window) {
    recognition = new webkitSpeechRecognition();
    recognition.lang = "en-IN";
    recognition.continuous = true;       
    recognition.interimResults = false;   
    const voiceBtn = document.getElementById("voiceBtn");
    const mealInput = document.getElementById("meal");

    recognition.onstart = function() {
      isListening = true;
      voiceBtn.querySelector('.voice-label').innerText = "Stop";
      voiceBtn.style.background = "#fee2e2";
    };
    recognition.onend = function() {
      isListening = false;
      voiceBtn.querySelector('.voice-label').innerText = "Speak";
      voiceBtn.style.background = "#f1f5f9";
    };
    recognition.onresult = function(event) {
      let txt = "";
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) txt += event.results[i][0].transcript + " ";
      }
      if(txt.trim()) mealInput.value += normalizeInputString(txt);
    };
    voiceBtn.addEventListener("click", function(e) {
      e.preventDefault();
      if (isListening) recognition.stop(); else recognition.start();
    });
  }
}

async function loadData() {
  try {
    const res = await fetch(API_URL);
    const data = await res.json();
    if(data.history) globalHistoryCache = data.history; 
    
    // Inject speech system into dynamic companion window interface
    if(data.coach || data.coachResponse) {
      const speechText = data.coach || data.coachResponse;
      document.getElementById("coachCharacterSpeech").innerText = speechText;
    }
    processView();
  } catch (err) { console.log("System initialization data sync failure."); }
}

async function logMeal() {
  const input = document.getElementById("meal");
  let meal = normalizeInputString(input.value);
  if (!meal) return;
  const loading = document.getElementById("loading");
  if(loading) loading.style.display = "block";
  const date = document.getElementById("historyDatePicker").value;

  try {
    const res = await fetch(API_URL + "?meal=" + encodeURIComponent(meal) + "&customDate=" + date);
    const data = await res.json();
    if(data.history) globalHistoryCache = data.history;
    if(data.coach || data.coachResponse) {
      document.getElementById("coachCharacterSpeech").innerText = data.coach || data.coachResponse;
    }
    processView();
  } catch (err) { alert("Logging engine payload sync fault."); }
  finally { if(loading) loading.style.display = "none"; input.value = ""; }
}

function updateRadialGauge(elementId, current, limit, overColor, baseColor) {
  const el = document.getElementById(elementId);
  if(!el) return;
  const radius = el.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  let percent = current / limit;
  if(percent > 1) {
    el.style.stroke = overColor;
    percent = 1; 
  } else {
    el.style.stroke = baseColor;
  }
  const offset = circumference - (percent * circumference);
  el.style.strokeDasharray = circumference + " " + circumference;
  el.style.strokeDashoffset = offset;
}

function processView() {
  const homeTimeline = document.querySelector(".timeline");
  const journalTimeline = document.querySelector(".journal-timeline-target");
  const selectedDateStr = document.getElementById("historyDatePicker").value;
  if(!selectedDateStr) return;
  
  const targetDate = new Date(selectedDateStr);
  targetDate.setHours(0,0,0,0);

  let filtered = [];
  let cal = 0, prot = 0;
  let targetLimit = 2000, proteinLimit = 120;

  if (currentScope === 'week') { targetLimit = 14000; proteinLimit = 840; }
  if (currentScope === 'month') { targetLimit = 60000; proteinLimit = 3600; }

  globalHistoryCache.forEach(function(item, index) {
    const itemDate = new Date(item.date);
    itemDate.setHours(0,0,0,0);
    let match = false;

    if (currentScope === 'today') match = (item.date === selectedDateStr);
    else if (currentScope === 'week') {
      const diffDays = Math.ceil((targetDate - itemDate) / (1000 * 60 * 60 * 24));
      match = (diffDays >= 0 && diffDays < 7);
    } else if (currentScope === 'month') {
      match = (itemDate.getMonth() === targetDate.getMonth() && itemDate.getFullYear() === targetDate.getFullYear());
    }

    if (match) {
      filtered.push({
        date: item.date,
        time: item.time,
        rawInput: item.rawInput,
        calories: item.calories,
        protein: item.protein,
        originalIndex: index
      });
      cal += item.calories;
      prot += item.protein;
    }
  });

  document.getElementById("todayCalories").innerText = cal + " / " + targetLimit + " kcal";
  document.getElementById("todayProtein").innerText = prot + " / " + proteinLimit + " g";

  updateRadialGauge("calorieGaugeFill", cal, targetLimit, "#ef4444", "#0d9488");
  updateRadialGauge("proteinGaugeFill", prot, proteinLimit, "#ef4444", "#6366f1");

  // Render Layout Feed Function
  renderTimelineDom(filtered, homeTimeline);
  renderTimelineDom(filtered, journalTimeline);
}

function renderTimelineDom(dataset, targetContainer) {
  if(!targetContainer) return;
  targetContainer.innerHTML = "";
  
  if(dataset.length === 0) {
    targetContainer.innerHTML = "<div class='null-state-msg'>No entries registered in this selection scope.</div>";
    return;
  }
  
  // Create safe explicit copies to prevent double reversing references
  let localCopy = dataset.slice().reverse();

  localCopy.forEach(function(row) {
    const itemEl = document.createElement("div");
    itemEl.className = "timeline-node";
    
    itemEl.innerHTML = "<div class='node-dot-track'><span class='node-dot'></span></div>" +
      "<div class='node-payload' style='width: 100%;'>" +
        "<div class='node-meta-row'>" +
          "<span class='node-timestamp'>" + row.time + "</span>" +
          "<div class='node-crud-triggers'>" +
            "<button class='action-trigger-btn unique-edit-btn-" + row.originalIndex + "'>✏️</button>" +
            "<button class='action-trigger-btn unique-del-btn-" + row.originalIndex + "'>🗑️</button>" +
          "</div>" +
        "</div>" +
        "<div class='node-title-meal'>" + normalizeInputString(row.rawInput) + "</div>" +
        "<p class='node-macro-summary' style='margin-top:4px; font-size:11px; color:#64748b;'>" + row.calories + " kcal  ·  " + row.protein + "g Protein</p>" +
      "</div>";

    targetContainer.appendChild(itemEl);

    // Context-independent target matching loops
    itemEl.querySelector(".unique-edit-btn-" + row.originalIndex).addEventListener("click", function() {
      document.getElementById("meal").value = row.rawInput;
      routeToView('home');
      document.getElementById("meal").focus();
    });
    itemEl.querySelector(".unique-del-btn-" + row.originalIndex).addEventListener("click", function() {
      deleteMeal(row.originalIndex);
    });
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
        document.getElementById("coachCharacterSpeech").innerText = data.coach || data.coachResponse;
      }
      processView();
    } catch (err) { alert("Delete pipeline drop synchronization error."); }
    finally { if(loading) loading.style.display = "none"; }
  }
}
// ================= DRAGGABLE & PER-DAY STICKY ENGINE =================
const stickyEl = document.getElementById("draggableSticky");
const handleEl = document.getElementById("stickyHandle");
const memoTextarea = document.getElementById("dashboardMemo");
const memoStatus = document.getElementById("memoStatus");
const datePicker = document.getElementById("historyDatePicker");
const stickyDateLabel = document.getElementById("stickyDateLabel");

// 1. DRAG ENGINE LOGIC
let isDragging = false;
let currentX, currentY, initialX, initialY;
let xOffset = 0, yOffset = 0;

handleEl.addEventListener("mousedown", dragStart);
document.addEventListener("mousemove", drag);
document.addEventListener("mouseup", dragEnd);

handleEl.addEventListener("touchstart", dragStart, { passive: true });
document.addEventListener("touchmove", drag, { passive: false });
document.addEventListener("touchend", dragEnd);

function dragStart(e) {
    let clientX = e.type === "touchstart" ? e.touches[0].clientX : e.clientX;
    let clientY = e.type === "touchstart" ? e.touches[0].clientY : e.clientY;
    
    initialX = clientX - xOffset;
    initialY = clientY - yOffset;

    if (e.target === handleEl || handleEl.contains(e.target)) {
        isDragging = true;
    }
}

function drag(e) {
    if (!isDragging) return;
    if (e.type === "touchmove") e.preventDefault(); // Stop screen scroll during drag

    let clientX = e.type === "touchmove" ? e.touches[0].clientX : e.clientX;
    let clientY = e.type === "touchmove" ? e.touches[0].clientY : e.clientY;

    currentX = clientX - initialX;
    currentY = clientY - initialY;

    xOffset = currentX;
    yOffset = currentY;

    stickyEl.style.transform = `translate(${currentX}px, ${currentY}px)`;
}

function dragEnd() {
    isDragging = false;
}

// 2. PER-DAY LOCKER LOGIC
function getActiveStickyDate() {
    // Agar datepicker me date selected h toh vo lega, nahi toh default current date
    return datePicker && datePicker.value ? datePicker.value : new Date().toISOString().split('T')[0];
}

function loadDailyMemo() {
    const targetDate = getActiveStickyDate();
    const savedMemo = localStorage.getItem(`sticky_memo_${targetDate}`);
    
    memoTextarea.value = savedMemo ? savedMemo : "";
    if(stickyDateLabel) {
        stickyDateLabel.textContent = targetDate;
    }
    memoStatus.textContent = "Saved";
    memoStatus.style.background = "#ccfbf1";
}

// Auto Save on typing
memoTextarea.addEventListener("input", () => {
    memoStatus.textContent = "Saving...";
    memoStatus.style.background = "#fef3c7";
    
    const targetDate = getActiveStickyDate();
    localStorage.setItem(`sticky_memo_${targetDate}`, memoTextarea.value);
    
    setTimeout(() => {
        memoStatus.textContent = "Saved";
        memoStatus.style.background = "#ccfbf1";
    }, 600);
});

// Sync note when calendar date/timeline change
if(datePicker) {
    datePicker.addEventListener("change", loadDailyMemo);
}

// Initial Load
document.addEventListener("DOMContentLoaded", loadDailyMemo);
