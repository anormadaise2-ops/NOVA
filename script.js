const callSound = document.getElementById("callSound");

// Démarrer la sonnerie
function startRingtone() {
    callSound.loop = true;
    callSound.currentTime = 0;

    callSound.play().catch(error => {
        console.log("Le navigateur attend une interaction :", error);
    });
}

// Arrêter la sonnerie
function stopRingtone() {
    callSound.pause();
    callSound.currentTime = 0;
}

// Exemple : appel entrant
function incomingCall() {
    document.getElementById("incoming").classList.add("show");
    startRingtone();
}

// Accepter
document.getElementById("acceptCall").addEventListener("click", () => {
    stopRingtone();

    document.getElementById("incoming").classList.remove("show");

    // Ouvre l'écran des appels
    goTo("calls");
});

// Refuser
document.getElementById("declineCall").addEventListener("click", () => {
    stopRingtone();

    document.getElementById("incoming").classList.remove("show");
});