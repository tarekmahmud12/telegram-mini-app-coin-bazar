document.addEventListener('DOMContentLoaded', () => {
    // DOM elements
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

    // State variables
    let adsWatched = 0;
    const maxAdsPerCycle = 10;
    const adResetTimeInMinutes = 30;
    let adTimerInterval = null;
    let adCooldownEnds = null;

    let totalPoints = 0;
    let userName = 'User';
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

    let telegramId = null;
    let telegramUser = null;

    try {
        if (window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe && window.Telegram.WebApp.initDataUnsafe.user) {
            telegramUser = window.Telegram.WebApp.initDataUnsafe.user;
            telegramId = telegramUser.id.toString();
        } else {
            // Fallback for testing outside Telegram
            telegramUser = {
                id: 'test-user-id',
                first_name: 'Test',
                last_name: 'User',
                username: 'testuser'
            };
            telegramId = telegramUser.id;
        }
    } catch (e) {
        console.warn("Not running inside Telegram WebApp, using default values.");
        telegramUser = {
            id: 'test-user-id',
            first_name: 'Test',
            last_name: 'User',
            username: 'testuser'
        };
        telegramId = telegramUser.id;
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
        if (adsWatched === maxAdsPerCycle && adCooldownEnds) {
            watchAdBtn.disabled = true;
            watchAdBtn.textContent = 'Waiting for timer to finish';
        } else if (adCooldownEnds) {
             watchAdBtn.disabled = true;
             watchAdBtn.textContent = 'Ad cycle in progress';
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

    const saveUserDataToFirebase = async () => {
        if (!telegramId) return;
        try {
            await usersCollection.doc(telegramId).set({
                userName: userName,
                points: totalPoints,
                adsWatched: adsWatched,
                adsCooldownEnds: adCooldownEnds,
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
        if (!telegramId) {
            console.warn("Telegram ID not available. Cannot load user data.");
            return;
        }
    
        try {
            const userDoc = await usersCollection.doc(telegramId).get();
            if (userDoc.exists) {
                const userData = userDoc.data();
                userName = userData.userName || (telegramUser.first_name || 'User');
                totalPoints = userData.points || 0;
                adsWatched = userData.adsWatched || 0;
                taskTimers = userData.taskTimers || {};
                
                if (userData.adsCooldownEnds && typeof userData.adsCooldownEnds.toDate === 'function') {
                    adCooldownEnds = userData.adsCooldownEnds.toDate();
                } else if (userData.adsCooldownEnds) {
                    adCooldownEnds = new Date(userData.adsCooldownEnds);
                } else {
                    adCooldownEnds = null;
                }
                
                userNameDisplay.textContent = userName;
                welcomeUserNameDisplay.textContent = userName;
                referralCodeInput.value = userData.referralCode || generateReferralCode();
                
                updatePointsDisplay();
                updateAdsCounter();
                
                if (adCooldownEnds) {
                    const timeLeft = Math.max(0, (adCooldownEnds.getTime() - Date.now()) / 1000);
                    if (timeLeft > 0) startAdTimer(timeLeft);
                }

                updateTaskButtons();
                
                if (userName === 'User' && telegramUser) {
                    let newName = telegramUser.first_name || 'User';
                    if (telegramUser.last_name) {
                        newName += ` ${telegramUser.last_name}`;
                    }
                    userName = newName;
                    userNameDisplay.textContent = userName;
                    welcomeUserNameDisplay.textContent = userName;
                    saveUserDataToFirebase();
                }

            } else {
                console.log("User not found. Creating a new entry.");
                if (telegramUser) {
                    let newName = telegramUser.first_name || 'User';
                    if (telegramUser.last_name) {
                        newName += ` ${telegramUser.last_name}`;
                    }
                    userName = newName;
                }
                
                userNameDisplay.textContent = userName;
                welcomeUserNameDisplay.textContent = userName;
                referralCodeInput.value = generateReferralCode();

                saveUserDataToFirebase();
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
            let cooldownEndTime = null;
            if (taskTimers[taskId]) {
                if (typeof taskTimers[taskId].toDate === 'function') {
                    cooldownEndTime = taskTimers[taskId].toDate().getTime();
                } else {
                    cooldownEndTime = new Date(taskTimers[taskId]).getTime();
                }
            }

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
            let timer = setTimeout(() => {
                if (newWindow) {
                    newWindow.close();
                }
                alert(`Task ${taskId} completed! You earned ${pointsPerTask} points.`);
                totalPoints += pointsPerTask;
                updatePointsDisplay();
                
                const cooldownEnds = new Date(Date.now() + (taskCooldownInHours * 60 * 60 * 1000));
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
                adCooldownEnds = null;
                updateAdsCounter();
                adTimerSpan.textContent = 'Ready!';
                saveUserDataToFirebase(); // Save state after timer is done
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
            if (typeof show_9673543 === 'function') {
                show_9673543().then(() => {
                    adsWatched++;
                    totalPoints += pointsPerAd;
                    updateAdsCounter();
                    updatePointsDisplay();
                    
                    if (adsWatched === maxAdsPerCycle) {
                        adCooldownEnds = new Date(Date.now() + (adResetTimeInMinutes * 60 * 1000));
                        startAdTimer();
                        alert('You have watched all ads for this cycle. The timer has started!');
                    } else {
                        alert('You earned ' + pointsPerAd + ' points!');
                    }
                    saveUserDataToFirebase();
                }).catch(e => {
                    console.error('Monetag ad error:', e);
                    alert('There was an error loading the ad. Please try again.');
                });
            } else {
                alert('Monetag script is not loaded. Please refresh the page.');
            }
        } else {
            alert('You have reached the ad limit for this cycle. Please wait for the timer to finish.');
        }
    });

    loadUserDataFromFirebase();
});
