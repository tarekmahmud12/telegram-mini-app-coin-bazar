document.addEventListener('DOMContentLoaded', async () => {
    /** ================================
     *  Firebase Initialization
     *  ================================ */
    // 🔹 Firebase Config অবশ্যই নিজের প্রোজেক্টের দিয়ে বদলাবে
    const firebaseConfig = {
        apiKey: "YOUR_API_KEY",
        authDomain: "YOUR_AUTH_DOMAIN",
        projectId: "YOUR_PROJECT_ID",
        storageBucket: "YOUR_STORAGE_BUCKET",
        messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
        appId: "YOUR_APP_ID"
    };

    // পুরানো SDK হলে এইভাবে করো:
    if (typeof firebase !== "undefined" && firebase.firestore) {
        firebase.initializeApp(firebaseConfig);
        var db = firebase.firestore();
    } else {
        console.error("Firebase SDK not loaded!");
        return;
    }

    /** ================================
     *  Telegram User Detection
     *  ================================ */
    let telegramId = null;
    let telegramUser = null;

    try {
        if (window.Telegram?.WebApp) {
            window.Telegram.WebApp.ready();
            if (window.Telegram.WebApp.initDataUnsafe?.user) {
                telegramUser = window.Telegram.WebApp.initDataUnsafe.user;
                telegramId = telegramUser.id.toString();
            }
        }
    } catch (e) {
        console.error("Telegram API init error:", e);
    }

    // Fallback mode (dev/test only)
    if (!telegramId) {
        console.warn("No Telegram ID found, using fallback (dev mode)!");
        telegramId = 'fallback-user-' + Math.floor(Math.random() * 1000000); // Random for each test
        telegramUser = {
            id: telegramId,
            first_name: 'Fallback',
            last_name: 'User',
            username: 'fallback_user'
        };
    }

    /** ================================
     *  DOM Elements
     *  ================================ */
    const navItems = document.querySelectorAll('.app-footer .nav-item');
    const pages = document.querySelectorAll('.main-content .page');
    const adWatchedCountSpan = document.getElementById('ad-watched-count');
    const adTimerSpan = document.getElementById('ad-timer');
    const totalPointsDisplay = document.getElementById('total-points');
    const userNameDisplay = document.getElementById('user-name-display');
    const welcomeUserNameDisplay = document.getElementById('welcome-user-name');
    const editNameBtn = document.getElementById('edit-name-btn');
    const adsLeftValue = document.getElementById('ads-left-value');
    const totalAdsWatched = document.getElementById('total-ads-watched');
    const welcomeAdsLeft = document.getElementById('welcome-ads-left');
    const watchAdBtn = document.querySelector('.watch-ad-btn');
    const taskButtons = document.querySelectorAll('.task-btn');
    const referralCodeInput = document.getElementById('referral-code');

    /** ================================
     *  State Variables
     *  ================================ */
    let adsWatched = 0;
    const maxAdsPerCycle = 10;
    const adResetTimeInMinutes = 30;
    let adTimerInterval = null;
    let adCooldownEnds = null;

    let totalPoints = 0;
    let userName = telegramUser?.first_name || 'User';
    const pointsPerAd = 5;
    const pointsPerTask = 10;

    const taskUrls = {
        '1': 'https://www.profitableratecpm.com/yh7pvdve?key=58d4a9b60d7d99d8d92682690909edc3',
        '2': 'https://www.profitableratecpm.com/yh7pvdve?key=58d4a9b60d7d99d8d92682690909edc3',
        '3': 'https://www.profitableratecpm.com/yh7pvdve?key=58d4a9b60d7d99d8d92682690909edc3',
        '4': 'https://www.profitableratecpm.com/yh7pvdve?key=58d4a9b60d7d99d8d92682690909edc3',
        '5': 'https://www.profitableratecpm.com/yh7pvdve?key=58d4a9b60d7d99d8d92682690909edc3',
    };
    const taskCooldownInHours = 1;
    let taskTimers = {};

    const usersCollection = db.collection("users");

    /** ================================
     *  Helper Functions
     *  ================================ */
    const updatePointsDisplay = () => totalPointsDisplay.textContent = totalPoints;

    const updateAdsCounter = () => {
        const adsLeft = maxAdsPerCycle - adsWatched;
        adWatchedCountSpan.textContent = `${adsWatched}/${maxAdsPerCycle} watched`;
        adsLeftValue.textContent = adsLeft;
        welcomeAdsLeft.textContent = adsLeft;
        totalAdsWatched.textContent = adsWatched;

        if (adsWatched >= maxAdsPerCycle && adCooldownEnds) {
            watchAdBtn.disabled = true;
            watchAdBtn.textContent = 'Waiting for timer to finish';
        } else {
            watchAdBtn.disabled = false;
            watchAdBtn.textContent = `Watch Ad & Earn ${pointsPerAd} Points`;
        }
    };

    const switchPage = (pageId) => {
        pages.forEach(page => page.classList.remove('active'));
        document.getElementById(pageId).classList.add('active');
        navItems.forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page + '-page' === pageId) {
                item.classList.add('active');
            }
        });
    };

    const generateReferralCode = () => `CB${Math.floor(100000 + Math.random() * 900000)}`;

    const formatTime = (seconds) => {
        if (seconds <= 0) return 'Ready!';
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')} remaining`;
    };

    /** ================================
     *  Firebase Save / Load
     *  ================================ */
    const saveUserDataToFirebase = async () => {
        if (!telegramId) return;
        try {
            await usersCollection.doc(telegramId).set({
                userName,
                points: totalPoints,
                adsWatched,
                adsCooldownEnds: adCooldownEnds || null,
                taskTimers,
                referralCode: referralCodeInput.value || generateReferralCode(),
                lastUpdated: new Date()
            }, { merge: true });
            console.log(`✅ User data saved for ${telegramId}`);
        } catch (error) {
            console.error("❌ Save error:", error);
        }
    };

    const loadUserDataFromFirebase = async () => {
        if (!telegramId) return;

        try {
            const userDoc = await usersCollection.doc(telegramId).get();
            if (userDoc.exists) {
                const data = userDoc.data();
                userName = data.userName || telegramUser.first_name || 'User';
                totalPoints = data.points || 0;
                adsWatched = data.adsWatched || 0;
                taskTimers = data.taskTimers || {};
                adCooldownEnds = data.adsCooldownEnds ? new Date(data.adsCooldownEnds) : null;
                referralCodeInput.value = data.referralCode || generateReferralCode();
            } else {
                referralCodeInput.value = generateReferralCode();
                await saveUserDataToFirebase();
            }

            userNameDisplay.textContent = userName;
            welcomeUserNameDisplay.textContent = userName;
            updatePointsDisplay();
            updateAdsCounter();
            updateTaskButtons();

            if (adCooldownEnds && adCooldownEnds.getTime() > Date.now()) {
                startAdTimer((adCooldownEnds.getTime() - Date.now()) / 1000);
            }
        } catch (error) {
            console.error("❌ Load error:", error);
        }
    };

    /** ================================
     *  Task Buttons
     *  ================================ */
    const updateTaskButtons = () => {
        const now = Date.now();
        taskButtons.forEach(button => {
            const taskId = button.dataset.taskId;
            let cooldownEndTime = taskTimers[taskId] ? new Date(taskTimers[taskId]).getTime() : null;

            if (cooldownEndTime && now < cooldownEndTime) {
                const timeLeft = Math.floor((cooldownEndTime - now) / 1000);
                const hours = Math.floor(timeLeft / 3600);
                const minutes = Math.floor((timeLeft % 3600) / 60);
                const seconds = timeLeft % 60;
                button.textContent = `Active in: ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
                button.disabled = true;
            } else {
                button.textContent = `Task ${taskId}: +${pointsPerTask} Points`;
                button.disabled = false;
            }
        });
    };

    taskButtons.forEach(button => {
        button.addEventListener('click', () => {
            const taskId = button.dataset.taskId;
            const taskUrl = taskUrls[taskId];
            button.textContent = 'Please wait 10 seconds...';
            button.disabled = true;

            const newWindow = window.open(taskUrl, '_blank');
            setTimeout(() => {
                if (newWindow) newWindow.close();
                alert(`Task ${taskId} completed! You earned ${pointsPerTask} points.`);
                totalPoints += pointsPerTask;
                taskTimers[taskId] = new Date(Date.now() + taskCooldownInHours * 60 * 60 * 1000);
                updatePointsDisplay();
                saveUserDataToFirebase();
                updateTaskButtons();
            }, 10000);
        });
    });

    /** ================================
     *  Ads Timer
     *  ================================ */
    const startAdTimer = (initialTime = adResetTimeInMinutes * 60) => {
        let timeLeft = Math.ceil(initialTime);
        adTimerSpan.textContent = formatTime(timeLeft);
        watchAdBtn.disabled = true;

        if (adTimerInterval) clearInterval(adTimerInterval);

        adTimerInterval = setInterval(() => {
            timeLeft--;
            adTimerSpan.textContent = formatTime(timeLeft);
            if (timeLeft <= 0) {
                clearInterval(adTimerInterval);
                adsWatched = 0;
                adCooldownEnds = null;
                updateAdsCounter();
                adTimerSpan.textContent = 'Ready!';
                saveUserDataToFirebase();
            }
        }, 1000);
    };

    watchAdBtn.addEventListener('click', async () => {
        if (adsWatched < maxAdsPerCycle) {
            if (typeof show_9673543 === 'function') {
                try {
                    await show_9673543();
                    adsWatched++;
                    totalPoints += pointsPerAd;
                    updateAdsCounter();
                    updatePointsDisplay();

                    if (adsWatched >= maxAdsPerCycle) {
                        adCooldownEnds = new Date(Date.now() + adResetTimeInMinutes * 60 * 1000);
                        startAdTimer();
                        alert('All ads watched. Timer started!');
                    } else {
                        alert(`You earned ${pointsPerAd} points!`);
                    }
                    saveUserDataToFirebase();
                } catch (e) {
                    console.error('Ad error:', e);
                    alert('Error loading ad. Try again.');
                }
            } else {
                alert('Ad script not loaded. Refresh the page.');
            }
        } else {
            alert('Ad limit reached. Wait for timer.');
        }
    });

    /** ================================
     *  Edit Name
     *  ================================ */
    editNameBtn.addEventListener('click', () => {
        const currentName = userNameDisplay.textContent;
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.value = currentName;
        nameInput.className = 'user-name-input';
        nameInput.maxLength = 20;

        userNameDisplay.replaceWith(nameInput);
        nameInput.focus();

        const saveName = () => {
            userName = nameInput.value.trim() || 'User';
            userNameDisplay.textContent = userName;
            welcomeUserNameDisplay.textContent = userName;
            nameInput.replaceWith(userNameDisplay);
            saveUserDataToFirebase();
        };

        nameInput.addEventListener('blur', saveName);
        nameInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') saveName();
        });
    });

    /** ================================
     *  Init
     *  ================================ */
    await loadUserDataFromFirebase();
    setInterval(updateTaskButtons, 1000);
});