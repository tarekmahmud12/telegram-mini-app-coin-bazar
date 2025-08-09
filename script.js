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
    const watchAdBtn = document.querySelector('.watch-ad-btn');
    const taskButtons = document.querySelectorAll('.task-btn');
    const referralCodeInput = document.getElementById('referral-code');

    let adsWatched = 0;
    const maxAdsPerCycle = 10;
    const adResetTimeInMinutes = 30;
    let adTimerInterval = null;

    let totalPoints = 0;
    let userName = 'User';
    const pointsPerAd = 5;
    const pointsPerTask = 10;

    // Updated taskUrls with the new link for all tasks
    const taskUrls = {
        '1': 'https://www.profitableratecpm.com/yh7pvdve?key=58d4a9b60d7d99d8d92682690909edc3',
        '2': 'https://www.profitableratecpm.com/yh7pvdve?key=58d4a9b60d7d99d8d92682690909edc3',
        '3': 'https://www.profitableratecpm.com/yh7pvdve?key=58d4a9b60d7d99d8d92682690909edc3',
        '4': 'https://www.profitableratecpm.com/yh7pvdve?key=58d4a9b60d7d99d8d92682690909edc3',
        '5': 'https://www.profitableratecpm.com/yh7pvdve?key=58d4a9b60d7d99d8d92682690909edc3',
    };
    const taskCooldownInHours = 1;
    let taskTimers = {};

    let telegramId = 'test-user-id';
    try {
        if (window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
            telegramId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
        }
    } catch (e) {
        console.warn("Not running inside Telegram WebApp, using default ID.");
    }

    const usersCollection = db.collection("users");

    const updatePointsDisplay = () => {
        totalPointsDisplay.textContent = totalPoints;
    };

    const updateAdsCounter = () => {
        adWatchedCountSpan.textContent = `${adsWatched}/${maxAdsPerCycle} watched`;
        adsLeftValue.textContent = maxAdsPerCycle - adsWatched;
        welcomeAdsLeft.textContent = maxAdsPerCycle - adsWatched;
        totalAdsWatched.textContent = adsWatched;
        if (adsWatched === maxAdsPerCycle) {
            watchAdBtn.disabled = true;
        } else {
            watchAdBtn.disabled = false;
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

    const saveUserDataToFirebase = async () => {
        try {
            await usersCollection.doc(telegramId).set({
                userName: userName,
                points: totalPoints,
                adsWatched: adsWatched,
                adsCooldownEnds: adTimerInterval ? new Date(Date.now() + (adResetTimeInMinutes * 60 * 1000)) : null,
                taskTimers: taskTimers,
                referralCode: referralCodeInput.value,
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
                taskTimers = userData.taskTimers || {};
                
                userNameDisplay.textContent = userName;
                welcomeUserNameDisplay.textContent = userName;
                referralCodeInput.value = userData.referralCode || generateReferralCode();
                
                updatePointsDisplay();
                updateAdsCounter();
                
                if (userData.adsCooldownEnds) {
                    const timeLeft = Math.max(0, (new Date(userData.adsCooldownEnds.toDate()).getTime() - Date.now()) / 1000);
                    if (timeLeft > 0) startAdTimer(timeLeft);
                }

                updateTaskButtons();

                if (userName === 'User') {
                    editNameBtn.click();
                }

            } else {
                console.log("User not found. Creating a new entry.");
                referralCodeInput.value = generateReferralCode();
                saveUserDataToFirebase();
                editNameBtn.click();
            }
        } catch (error) {
            console.error('Error loading data from Firebase:', error);
        }
    };

    const generateReferralCode = () => {
        const uniqueId = Math.floor(100000 + Math.random() * 900000);
        return `CB${uniqueId}`;
    };

    const updateTaskButtons = () => {
        const now = Date.now();
        taskButtons.forEach(button => {
            const taskId = button.dataset.taskId;
            if (taskTimers[taskId] && now < taskTimers[taskId]) {
                const timeLeft = Math.floor((taskTimers[taskId] - now) / 1000);
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
            const originalButtonText = button.textContent;
            
            button.textContent = 'Please wait 10 seconds...';
            button.disabled = true;

            const newWindow = window.open(taskUrl, '_blank');
            let hasWaited = false;
            let timer = setTimeout(() => {
                hasWaited = true;
                if (newWindow) {
                    newWindow.close();
                }
                alert(`Task ${taskId} completed! You earned ${pointsPerTask} points.`);
                totalPoints += pointsPerTask;
                updatePointsDisplay();
                
                const cooldownEnds = Date.now() + (taskCooldownInHours * 60 * 60 * 1000);
                taskTimers[taskId] = cooldownEnds;
                saveUserDataToFirebase();
                updateTaskButtons();
            }, 10000); // 10 second timer
        });
    });

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

    document.getElementById('withdraw-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const amount = document.getElementById('amount').value;
        const paymentMethod = document.getElementById('payment-method').value;
        const accountId = document.getElementById('account-id').value;
        
        const withdrawalData = {
            userName: userName,
            telegramId: telegramId,
            amount: amount,
            paymentMethod: paymentMethod,
            accountId: accountId
        };
        
        try {
            const response = await fetch('/withdraw-request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(withdrawalData)
            });

            if (response.ok) {
                alert('Withdrawal request submitted successfully!');
                e.target.reset();
            } else {
                alert('Failed to submit withdrawal request. Please try again.');
            }
        } catch (error) {
            console.error('Error submitting withdrawal request:', error);
            alert('An error occurred. Please check your connection and try again.');
        }
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

    const startAdTimer = (initialTime = adResetTimeInMinutes * 60) => {
        let timeLeft = initialTime;
        adTimerSpan.textContent = formatTime(timeLeft);
        watchAdBtn.disabled = true;

        adTimerInterval = setInterval(() => {
            timeLeft--;
            adTimerSpan.textContent = formatTime(timeLeft);
            if (timeLeft <= 0) {
                clearInterval(adTimerInterval);
                adsWatched = 0;
                updateAdsCounter();
                adTimerSpan.textContent = 'Ready!';
                watchAdBtn.disabled = false;
            }
        }, 1000);
    };

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')} remaining`;
    };

    watchAdBtn.addEventListener('click', () => {
        if (adsWatched < maxAdsPerCycle) {
            show_9673543().then(() => {
                adsWatched++;
                totalPoints += pointsPerAd;
                updateAdsCounter();
                updatePointsDisplay();
                saveUserDataToFirebase();

                if (adsWatched === maxAdsPerCycle) {
                    alert('You have watched all ads for this cycle. The timer has started!');
                    startAdTimer();
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
