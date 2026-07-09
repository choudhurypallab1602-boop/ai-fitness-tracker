// ===============================
// AI Fitness Tracker Frontend
// ===============================

// CHANGE THIS TO YOUR APPS SCRIPT WEB APP URL
const API_URL =
"https://script.google.com/macros/s/AKfycbx1xpXsQwtsGNGaIlFlxlAFeEIcT4tRRpik65ugnFma6ibydox03qQGJMsra5FL2F9C0w/exec";

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
// ===============================
// Voice Recognition
// ===============================

let recognition = null;

if ("webkitSpeechRecognition" in window) {

    recognition = new webkitSpeechRecognition();

    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = function(){

        voiceBtn.innerHTML = "🎙 Listening...";

    };

    recognition.onend = function(){

        voiceBtn.innerHTML = "🎤 Speak";

    };

    recognition.onerror = function(e){

        alert("Voice Error : " + e.error);

    };

    recognition.onresult = function(event){

        const transcript = event.results[0][0].transcript;

        mealInput.value = transcript;

    };

}

voiceBtn.addEventListener("click", function(){

    if(!recognition){

        alert("Speech Recognition is not supported.");

        return;

    }

    recognition.start();

});
// ===============================
// Log Meal
// ===============================

logBtn.addEventListener("click", logMeal);

async function logMeal() {

    const meal = mealInput.value.trim();

    if (meal === "") {

        alert("Please enter a meal.");

        return;

    }

    loading.style.display = "block";
    resultCard.style.display = "none";

    try {

        const response = await fetch(API_URL, {

            method: "POST",

            headers: {

                "Content-Type": "application/json"

            },

            body: JSON.stringify({

                meal: meal

            })

        });

        const data = await response.json();

        if (data.success === false) {

            throw new Error(data.error);

        }

        showResult(data);

    }

    catch (err) {

        alert("Error : " + err.message);

    }

    finally {

        loading.style.display = "none";

    }

}// ===============================
// Show Result
// ===============================

function showResult(data){

    resultCard.style.display = "block";

    mealCalories.innerHTML =
        "🔥 <b>" + data.totalCalories + "</b> kcal";

    mealProtein.innerHTML =
        "💪 <b>" + data.totalProtein + "</b> g protein";

    confidence.innerHTML =
        "🎯 Confidence : " + Math.round(data.confidence * 100) + "%";

    foodList.innerHTML = "";

    data.foods.forEach(function(food){

        foodList.innerHTML +=
            "<li>" +
            food.quantity +
            " × " +
            food.name +
            "</li>";

    });

    updateDashboard(data);

}// ===============================
// Dashboard
// ===============================

function updateDashboard(data){

    // ---------- Calories ----------

    todayCalories.innerHTML =
        "<b>" +
        data.todayCalories +
        " / " +
        data.calorieGoal +
        " kcal</b>";

    let caloriePercent =
        (data.todayCalories / data.calorieGoal) * 100;

    calorieBar.style.width =
        Math.min(caloriePercent,100) + "%";

    if(caloriePercent < 80){

        calorieBar.style.background = "#4CAF50";

    }
    else if(caloriePercent <= 100){

        calorieBar.style.background = "#ff9800";

    }
    else{

        calorieBar.style.background = "#e53935";

    }

    if(data.todayCalories > data.calorieGoal){

        todayCalories.innerHTML +=
        "<br><span style='color:#e53935;'>Over by " +
        (data.todayCalories-data.calorieGoal).toFixed(0) +
        " kcal</span>";

    }
    else{

        todayCalories.innerHTML +=
        "<br><span style='color:green;'>Remaining " +
        (data.calorieGoal-data.todayCalories).toFixed(0) +
        " kcal</span>";

    }


    // ---------- Protein ----------

    todayProtein.innerHTML =
        "<b>" +
        data.todayProtein +
        " / " +
        data.proteinGoal +
        " g</b>";

    let proteinPercent =
        (data.todayProtein / data.proteinGoal) * 100;

    proteinBar.style.width =
        Math.min(proteinPercent,100) + "%";

    if(proteinPercent < 100){

        proteinBar.style.background="#2196F3";

    }
    else{

        proteinBar.style.background="#4CAF50";

    }

    if(data.todayProtein >= data.proteinGoal){

        todayProtein.innerHTML +=
        "<br><span style='color:green;'>Goal achieved ✅</span>";

    }
    else{

        todayProtein.innerHTML +=
        "<br><span style='color:#ff9800;'>Remaining " +
        (data.proteinGoal-data.todayProtein).toFixed(1) +
        " g</span>";

    }


    // ---------- AI Coach ----------

    coach.innerHTML = data.coach;

}
