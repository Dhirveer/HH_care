// Your Firebase config - Replace with your actual config from Firebase console
const firebaseConfig = {
  apiKey: "AIzaSyAOFddWrnp3UAzbaflgzW4RfyP7ml3y_go",
  authDomain: "health-monitor-hackathon-6f8d0.firebaseapp.com",
  databaseURL: "https://health-monitor-hackathon-6f8d0-default-rtdb.firebaseio.com",
  projectId: "health-monitor-hackathon-6f8d0",
  storageBucket: "health-monitor-hackathon-6f8d0.firebasestorage.app",
  messagingSenderId: "54277357583",
  appId: "1:54277357583:web:826d813c467ec5773f637a"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const MAX_HEART_RATE = 100;
const MIN_HEART_RATE = 50;
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

let chart;
let waveInterval = null;
let vitalsInterval = null;

const ecgWaveforms = [
    
    [1700,1680,1650,1620,1700,1750,1680,1625,1725,1710,1660,1805,1660,1775,1775,1715,1850,1705,1815,1805,1715,1855,1710,1790,1775,1670,1760,1665,1800,1780,1735,1865,1735,1875,1875,1860,2000,1870,2030,1965,1885,1910,1665,1690,1635,1650,1775,1560,1710,1660],

    [1900,1630,1730,1750,1585,1810,1600,1740,1770,1560,1790,1720,2200,2810,2400,1660,1150,1360,1650,1630,1910,1700,1860,1900,1730,1970,1750,1890,1930,1760,2000,1800,1940,1990,1840,2100,1880,2010,2060,1900,2160,1920,2050,2100,1885,2100,1830,1900,1890,1680],

    [1650,1730,1680,1660,1740,1660,1760,1610,1560,1550,1320,1740,1920,2420,1900,1180,890,650,800,1120,1450,1560,1460,1440,1450,1390,1540,1600,1580,1650,1560,1750,1620,1670,1820,1690,1810,1880,1870,1860,1830,1910,1680,1660,1680,1570,1560,1280,1320,1600],

    [0,120,3600,0,4100,0,50,3980,0,4080,0,0,3850,0,4100,0,0,3740,0,4090,0,0,3770,0,4090,0,0,0,3760,0,4060,0,0,4100,0,0,4090,0,0,4100,0,0,4080,0,0,4100,0,0,4070,0]
];

// Vital profile for each waveform
// 0 = mostly normal
// 1 = elevated / warning
// 2 = unstable / lower oxygen
// 3 = highly abnormal / critical-looking spike pattern
const waveVitalsProfile = [
    { hrMin: 72, hrMax: 88, spo2Min: 97, spo2Max: 99, tempMin: 36.7, tempMax: 37.1 },
    { hrMin: 75, hrMax: 88, spo2Min: 94, spo2Max: 97, tempMin: 37.0, tempMax: 36.9 },
    { hrMin: 70, hrMax: 82, spo2Min: 90, spo2Max: 94, tempMin: 37.2, tempMax: 38.0 },
    { hrMin: 76, hrMax: 80, spo2Min: 84, spo2Max: 90, tempMin: 38.0, tempMax: 39.2 }
];

let currentWaveIndex = 0;
let currentPointIndex = 0;

function goToLogin() {
    document.getElementById("welcomePage").style.display = "none";
    document.getElementById("loginPage").style.display = "flex";
}

function login() {
    const user = document.getElementById("username").value.trim();
    const pass = document.getElementById("password").value.trim();

    if (user === "patient" && pass === "1234") {
        document.getElementById("loginPage").style.display = "none";
        document.getElementById("dashboard").style.display = "block";
        initDashboard();
    } else {
        alert("Wrong login");
    }
}

function logout() {
    document.getElementById("dashboard").style.display = "none";
    document.getElementById("welcomePage").style.display = "flex";

    if (waveInterval) {
        clearInterval(waveInterval);
        waveInterval = null;
    }

    if (vitalsInterval) {
        clearInterval(vitalsInterval);
        vitalsInterval = null;
    }
}

function callSkype(number) {
    window.location.href = `skype:${number}?call`;
}

function contactWhatsApp(number) {
    window.open("https://wa.me/" + number.replace(/\D/g, ""), "_blank");
}

function openHospitalMap(location) {
    const mapUrl = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(location);
    window.open(mapUrl, "_blank");
}

function initDashboard() {
    const ctx = document.getElementById("ecgChart").getContext("2d");

    if (chart) {
        chart.destroy();
    }

    chart = new Chart(ctx, {
        type: "line",
        data: {
            labels: Array(50).fill(""),
            datasets: [{
                data: Array(50).fill(0),
                borderColor: "lime",
                borderWidth: 2,
                fill: false,
                tension: 0,
                pointRadius: 0
            }]
        },
        options: {
            responsive: true,
            animation: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { display: false },
                y: { beginAtZero: false }
            }
        }
    });

    startWaveCycle();
    startVitalsSync();
}

function startWaveCycle() {
    if (waveInterval) {
        clearInterval(waveInterval);
    }

    currentWaveIndex = 0;
    currentPointIndex = 0;

    waveInterval = setInterval(() => {
        const currentWave = ecgWaveforms[currentWaveIndex];
        const nextValue = currentWave[currentPointIndex];

        chart.data.datasets[0].data.shift();
        chart.data.datasets[0].data.push(nextValue);
        chart.update();

        currentPointIndex++;

        if (currentPointIndex >= currentWave.length) {
            currentPointIndex = 0;
            currentWaveIndex++;

            if (currentWaveIndex >= ecgWaveforms.length) {
                currentWaveIndex = 0;
            }
        }
    }, 120);
}

function startVitalsSync() {
    if (vitalsInterval) {
        clearInterval(vitalsInterval);
    }

    updateVitalsFromWave();

    vitalsInterval = setInterval(() => {
        updateVitalsFromWave();
    }, 2000);
}

function randomInRange(min, max) {
    return Math.random() * (max - min) + min;
}

function updateVitalsFromWave() {
    const profile = waveVitalsProfile[currentWaveIndex];

    let hr = Math.round(randomInRange(profile.hrMin, profile.hrMax));
    let spo2 = Math.round(randomInRange(profile.spo2Min, profile.spo2Max));
    let temp = randomInRange(profile.tempMin, profile.tempMax).toFixed(1);

    document.getElementById("heartRate").innerText = hr;
    document.getElementById("spo2").innerText = spo2;
    document.getElementById("temperature").innerText = temp;

    checkHeartRate(hr);
    checkSpo2(spo2);
    checkTemperature(parseFloat(temp));
}

function checkHeartRate(hr) {
    const hrElement = document.getElementById("heartRate");
    const alertBox = document.getElementById("alertBox");

    if (hr > MAX_HEART_RATE || hr < MIN_HEART_RATE) {
        hrElement.style.color = "red";
        alertBox.style.display = "block";
        alertBox.innerText = "⚠️ Abnormal Heart Rate: " + hr + " BPM";
        playAlertSound();
    } else {
        hrElement.style.color = "black";
        if (!hasOtherAlerts()) {
            alertBox.style.display = "none";
        }
    }
}

function checkSpo2(spo2) {
    const spo2Element = document.getElementById("spo2");
    const alertBox = document.getElementById("alertBox");

    if (spo2 < 95) {
        spo2Element.style.color = "red";
        alertBox.style.display = "block";
        alertBox.innerText = "⚠️ Low SpO2 Level: " + spo2 + "%";
    } else {
        spo2Element.style.color = "black";
    }
}

function checkTemperature(temp) {
    const tempElement = document.getElementById("temperature");
    const alertBox = document.getElementById("alertBox");

    if (temp > 37.5) {
        tempElement.style.color = "red";
        alertBox.style.display = "block";
        alertBox.innerText = "⚠️ High Temperature: " + temp + " °C";
    } else {
        tempElement.style.color = "black";
    }
}

function hasOtherAlerts() {
    const spo2 = parseInt(document.getElementById("spo2").innerText, 10);
    const temp = parseFloat(document.getElementById("temperature").innerText);
    return spo2 < 95 || temp > 37.5;
}

function playAlertSound() {
    const audio = new Audio("https://www.soundjay.com/buttons/beep-01a.mp3");
    audio.play();
}

function updateECG() {
    const currentWave = ecgWaveforms[currentWaveIndex];
    const nextValue = currentWave[currentPointIndex];

    chart.data.datasets[0].data.shift();
    chart.data.datasets[0].data.push(nextValue);
    chart.update();

    currentPointIndex++;

    if (currentPointIndex >= currentWave.length) {
        currentPointIndex = 0;
        currentWaveIndex++;

        if (currentWaveIndex >= ecgWaveforms.length) {
            currentWaveIndex = 0;
        }
    }
}

// 🤖 Anime Bot JSON Content
const botData = {
    messages: [
        "👋 Hi! Welcome to MediCare!",
        "🔐 Login using username: patient | password: 1234",
        "❤️ Heart Rate shows your BPM in real-time.",
        "🫁 SpO2 shows oxygen level in your blood.",
        "🌡 Temperature shows body temperature.",
        "📈 ECG graph shows live heart activity.",
        "🚨 Alerts will appear if values go abnormal.",
        "👨‍⚕️ You can contact doctors instantly.",
        "🏥 Hospitals section helps with navigation.",
        "💡 This system uses real-time Firebase data."
    ]
};

let botIndex = 0;

function toggleBot() {
    const panel = document.getElementById("botPanel");

    if (panel.style.display === "block") {
        panel.style.display = "none";
    } else {
        panel.style.display = "block";
        startBotMessages();
    }
}

function startBotMessages() {
    const box = document.getElementById("botText");
    box.innerHTML = "";

    let i = 0;

    function showNext() {
        if (i < botData.messages.length) {
            const p = document.createElement("p");
            p.innerText = botData.messages[i];
            box.appendChild(p);
            i++;
            setTimeout(showNext, 1200);
        }
    }

    showNext();
}

window.onload = function () {
    const bot = document.getElementById("animeBot");
    if (bot) {
        bot.onclick = toggleBot;
    }
}
function callEmergency() {
    window.location.href = "tel:108";
};

