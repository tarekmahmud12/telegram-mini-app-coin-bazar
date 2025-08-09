document.addEventListener('DOMContentLoaded', () => {
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
    
    let adsWatched = 0;
    const maxAdsPerCycle = 10;
    const adResetTimeInMinutes = 30;
    let timerInterval = null;

    let totalPoints = 0;
    let userName = 'User';
    const pointsPerAd = 10;

    // Telegram user ID
    const telegramId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();

    // Firebase Firestore
    const usersCollection = db.collection("users");

    const updatePointsDisplay = () => {
        totalPointsDisplay.textContent = totalPoints;
    };

    const updateAdsCounter = () => {
        adWatchedCountSpan.textContent = `${adsWatched}/${maxAdsPerCycle} watched`;
        adsLeftValue.textContent = maxAdsPerCycle - adsWatched;
        welcomeAdsLeft.textContent = maxAdsPerCycle - adsWatched;
        totalAdsWatched.textContent = adsWatched;
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

    const saveUserDataToFirebase = async () => {
        try {
            await usersCollection.doc(telegramId).set({
                userName: userName,
                points: totalPoints,
                adsWatched: adsWatched,
                lastUpdated: new Date()
            }, { merge: true });
            console.log("User data saved to Firebase.");
        } catch (error) {
            console.error("Error saving data to Firebase:", error);
        }
    };

    const loadUserDataFromFirebase = async () => {
        try {
            const userDoc = await usersCollection.doc(telegramId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                userName = userData.userName || 'User';
                totalPoints = userData.points || 0;
                adsWatched = userData.adsWatched || 0;
                
                userNameDisplay.textContent = userName;
                welcomeUserNameDisplay.textContent = userName;
                updatePointsDisplay();
                updateAdsCounter();
            } else {
                console.log("User not found. Creating a new entry.");
                saveUserDataToFirebase();
            }
        } catch (error) {
            console.error('Error loading data from Firebase:', error);
        }
    };

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const pageId = item.dataset.page + '-page';
            switchPage(pageId);
        });
    });

    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const input = e.target.previousElementSibling;
            input.select();
            input.setSelectionRange(0, 99999);
            document.execCommand('copy');
            alert('Copied to clipboard!');
        });
    });

    document.querySelector('.share-btn').addEventListener('click', () => {
        const referralLink = document.getElementById('referral-link').value;
        if (navigator.share) {
            navigator.share({
                title: 'Coin Bazar Referral',
                text: 'Join Coin Bazar and earn points!',
                url: referralLink,
            }).then(() => console.log('Shared successfully')).catch(console.error);
        } else {
            alert('Web Share API is not supported in this browser.');
        }
    });

    document.getElementById('withdraw-form').addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Withdrawal request submitted successfully!');
        e.target.reset();
    });

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
            const newName = nameInput.value.trim() || 'User';
            userName = newName;
            userNameDisplay.textContent = newName;
            welcomeUserNameDisplay.textContent = newName;
            nameInput.replaceWith(userNameDisplay);
            saveUserDataToFirebase();
        };

        nameInput.addEventListener('blur', saveName);
        nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                saveName();
            }
        });
    });

    const startAdTimer = () => {
        let timeLeft = adResetTimeInMinutes * 60;
        adTimerSpan.textContent = formatTime(timeLeft);
        timerInterval = setInterval(() => {
            timeLeft--;
            adTimerSpan.textContent = formatTime(timeLeft);
            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                adsWatched = 0;
                updateAdsCounter();
                adTimerSpan.textContent = 'Ready!';
            }
        }, 1000);
    };

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')} remaining`;
    };

    document.querySelector('.watch-ad-btn').addEventListener('click', () => {
        if (adsWatched < maxAdsPerCycle) {
            show_9673543().then(() => {
                adsWatched++;
                totalPoints += pointsPerAd;
                updateAdsCounter();
                updatePointsDisplay();
                saveUserDataToFirebase();

                if (adsWatched === maxAdsPerCycle) {
                    alert('You have watched all ads for this cycle. The timer has started!');
                    // startAdTimer();
                } else {
                    alert('You earned ' + pointsPerAd + ' points!');
                }
            }).catch(e => {
                console.error('Monetag ad error:', e);
                alert('There was an error loading the ad. Please try again.');
            });
        } else {
            alert('You have reached the ad limit for this cycle. Please wait for the timer to finish.');
        }
    });
    
    loadUserDataFromFirebase();
});
