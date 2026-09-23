// assets/js/match-timer.js
let setTimer;
let timeLeft = 600; // 10 minutes in seconds
let isPaused = false;
let extraTime = 0;

function startSet() {
    if (setTimer) clearInterval(setTimer);
    
    setTimer = setInterval(() => {
        if (!isPaused) {
            timeLeft--;
            updateDisplay();
            
            if (timeLeft <= 0) {
                endSetByTime();
            }
        }
    }, 1000);
    
    // Enable buzz for 2 goals
    checkForTwoGoals();
}

function endSetByTime() {
    clearInterval(setTimer);
    playBuzzSound();
    alert("Set ended! Time's up!");
    // Submit results to server
}

function checkForTwoGoals() {
    let scoreA = parseInt(document.getElementById('scoreA').textContent);
    let scoreB = parseInt(document.getElementById('scoreB').textContent);
    
    if (scoreA >= 2 || scoreB >= 2) {
        clearInterval(setTimer);
        playBuzzSound();
        alert("Set ended! 2 goals scored!");
        // Submit results to server
    }
}

function playBuzzSound() {
    let audio = new Audio('assets/sounds/buzz.mp3');
    audio.play();
    // Also vibrate if on mobile device
    if ("vibrate" in navigator) {
        navigator.vibrate([200, 100, 200]);
    }
}