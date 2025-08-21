// ======================= Firebase v12 (Modular) =======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  serverTimestamp, Timestamp, increment,
  collection, query, where, getDocs, orderBy
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// ==== আপনার আসল Firebase কনফিগ এখানে বসান ====
// Firebase console > Project settings > Your apps থেকে এই তথ্যগুলো পাবেন
const firebaseConfig = {
  apiKey: "AIzaSyDZkV0aOLY-Yiyh5s_Nq_GSz8aiIPoSohc", // <-- আপনার আসল কী বসান
  authDomain: "coin-bazar-f3093.firebaseapp.com",
  projectId: "coin-bazar-f3093",
  storageBucket: "coin-bazar-f3093.firebasestorage.app", // <-- সঠিক Storage Bucket
  messagingSenderId: "551875632672",
  appId: "1:551875632672:web:55bdd11d4654bc4984a645",
  measurementId: "G-776LFTSXTP"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ======================= DOM Ready =======================
document.addEventListener("DOMContentLoaded", () => {
  // ---------- DOM Elements ----------
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
  const referralLinkInput = document.getElementById('referral-link');
  const profilePic = document.getElementById('profile-pic');
  const joinBonusBtns = document.querySelectorAll('.join-btn');

  // Withdraw UI elements
  const withdrawForm = document.getElementById('withdraw-form');
  const paymentMethodSelect = document.getElementById('payment-method');
  const amountInput = document.getElementById('amount');
  const withdrawMessageSpan = document.getElementById('withdraw-message');

  // New Withdrawal History UI elements
  const withdrawalHistoryList = document.getElementById('withdrawal-history-list');
  const totalWithdrawalsCount = document.getElementById('total-withdrawals-count');
  const totalPointsWithdrawn = document.getElementById('total-points-withdrawn');

  // Referral UI elements
  const shareBtn = document.querySelector('.share-btn');
  const referralCountDisplay = document.getElementById('referral-count');
  const referralPointsEarnedDisplay = document.getElementById('referral-points-earned');
  
  // Copy buttons
  const copyButtons = document.querySelectorAll('.copy-btn');


  // ---------- State ----------
  let adsWatched = 0;
  let dailyAdsWatched = 0;
  const maxAdsPerCycle = 10;
  const adResetTimeInMinutes = 15;
  let adTimerInterval = null;
  let adCooldownEnds = null;
  let totalPoints = 0;
  let userName = 'User';
  const pointsPerAd = 5;
  const pointsPerTask = 10;
  const referrerPoints = 200;
  let taskTimers = {};
  let telegramId = null;
  let telegramUser = null;
  let referrerCode = null;
  
  // New State for Bonus Logic
  let bonusClaimed = {};
  let lastAdResetDate = null;

  const TELEGRAM_BOT_TOKEN = '7812568979:AAGHvXfEufrcDBopGtGCPAmsFVIBWelFz3g';
  const ADMIN_TELEGRAM_ID = '5932597801';

  // ======================= Telegram Init =======================
  try {
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
      telegramUser = window.Telegram.WebApp.initDataUnsafe.user;
      telegramId = String(telegramUser.id);
      referrerCode = window.Telegram.WebApp.initDataUnsafe.start_param;
      if (referrerCode) {
        console.log("Referrer code found:", referrerCode);
      }
      if (telegramUser?.photo_url) {
        profilePic.src = telegramUser.photo_url;
      }
    } else {
      console.warn("Telegram user not found. Using fallback ID.");
      telegramId = 'fallback-test-user-id';
      telegramUser = {
        id: telegramId,
        first_name: 'Fallback',
        last_name: 'User',
        username: 'fallback_user'
      };
    }
  } catch (e) {
    console.error("Telegram init error:", e);
    telegramId = 'fallback-test-user-id';
    telegramUser = {
      id: telegramId,
      first_name: 'Fallback',
      last_name: 'User',
      username: 'fallback_user'
    };
  }

  // ======================= Firebase Auth (Anonymous) =======================
  let firebaseUID = null;
  signInAnonymously(auth).catch(err => {
    console.error("Anonymous sign-in failed:", err);
  });
  onAuthStateChanged(auth, async (user) => {
    if (!user) return;
    firebaseUID = user.uid;
    await loadUserDataFromFirebase();
    updateReferralLinkInput();
    setInterval(updateTaskButtons, 1000);
  });

  // ======================= Firestore Helpers =======================
  const usersDocRef = () => doc(db, "users", firebaseUID || "temp");
  const withdrawalsCollectionRef = () => collection(db, "withdrawals");
  const serverNow = () => serverTimestamp();
  const toDate = (maybeTs) => {
    try {
      if (!maybeTs) return null;
      if (maybeTs instanceof Date) return maybeTs;
      if (maybeTs.toDate && typeof maybeTs.toDate === 'function') return maybeTs.toDate();
      return new Date(maybeTs);
    } catch {
      return null;
    }
  };

  // ======================= UI Updates =======================
  const updatePointsDisplay = () => {
    totalPointsDisplay.textContent = String(totalPoints);
  };
  const updateAdsCounter = () => {
    const adsLeft = Math.max(0, maxAdsPerCycle - adsWatched);
    adWatchedCountSpan.textContent = `${adsWatched}/${maxAdsPerCycle} watched`;
    adsLeftValue.textContent = String(adsLeft);
    welcomeAdsLeft.textContent = String(adsLeft);
    totalAdsWatched.textContent = String(dailyAdsWatched);

    if (adsWatched >= maxAdsPerCycle && adCooldownEnds && adCooldownEnds.getTime() > Date.now()) {
      watchAdBtn.disabled = true;
      watchAdBtn.textContent = 'Waiting for timer to finish';
    } else {
      watchAdBtn.disabled = false;
      watchAdBtn.textContent = `Watch Ad & Earn ${pointsPerAd} Points`;
    }
  };
  const updateReferralStats = (referralCount, pointsEarned) => {
    referralCountDisplay.textContent = referralCount;
    referralPointsEarnedDisplay.textContent = pointsEarned;
  };
  const switchPage = (pageId) => {
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById(pageId)?.classList.add('active');
    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.page + '-page' === pageId) item.classList.add('active');
    });
  };
  const generateReferralCode = () => {
    const uniqueId = Math.floor(100000 + Math.random() * 900000);
    return `CB${uniqueId}`;
  };
  const updateReferralLinkInput = () => {
    const code = referralCodeInput.value || "CB123456";
    referralLinkInput.value = `https://t.me/CoinBazar_bot?start=${code}`;
  };

  // ======================= Referral Logic =======================
  const awardReferralPoints = async (referrerCode) => {
    if (!referrerCode) return;
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("referralCode", "==", referrerCode));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const referrerDoc = querySnapshot.docs[0];
        const referrerDocRef = referrerDoc.ref;
        await updateDoc(referrerDocRef, {
          points: increment(referrerPoints),
          referralCount: increment(1),
          referralPointsEarned: increment(referrerPoints)
        });
        console.log("Referral points awarded to:", referrerCode);
      } else {
        console.warn("Referrer not found with code:", referrerCode);
      }
    } catch (error) {
      console.error("Error awarding referral points:", error);
    }
  };

  // ======================= Firestore Save/Load =======================
  const saveUserDataToFirebase = async () => {
    if (!firebaseUID) return;
    try {
      const timersToSave = {};
      Object.keys(taskTimers || {}).forEach(k => {
        const d = toDate(taskTimers[k]);
        if (d) timersToSave[k] = Timestamp.fromDate(d);
      });
      await setDoc(usersDocRef(), {
        firebaseUID,
        telegramId,
        userName,
        points: totalPoints,
        adsWatched,
        dailyAdsWatched,
        lastAdResetDate: lastAdResetDate ? Timestamp.fromDate(lastAdResetDate) : null,
        adsCooldownEnds: adCooldownEnds ? Timestamp.fromDate(adCooldownEnds) : null,
        taskTimers: timersToSave,
        bonusClaimed,
        referralCode: referralCodeInput.value || generateReferralCode(),
        lastUpdated: serverNow(),
      }, { merge: true });
    } catch (error) {
      console.error("Error saving data:", error);
    }
  };
  
  const loadUserDataFromFirebase = async () => {
    if (!firebaseUID) return;
    try {
      const snap = await getDoc(usersDocRef());

      if (snap.exists()) {
        const data = snap.data();
        userName = data.userName || (telegramUser?.first_name || 'User');
        totalPoints = data.points || 0;
        adsWatched = data.adsWatched || 0;
        dailyAdsWatched = data.dailyAdsWatched || 0;
        lastAdResetDate = data.lastAdResetDate ? toDate(data.lastAdResetDate) : null;
        taskTimers = data.taskTimers || {};
        bonusClaimed = data.bonusClaimed || {};
        if (data.adsCooldownEnds) {
          adCooldownEnds = toDate(data.adsCooldownEnds);
        } else {
          adCooldownEnds = null;
        }
        referralCodeInput.value = data.referralCode || generateReferralCode();
        updateReferralStats(data.referralCount || 0, data.referralPointsEarned || 0);
        totalWithdrawalsCount.textContent = data.totalWithdrawalsCount || 0;
        totalPointsWithdrawn.textContent = data.totalPointsWithdrawn || 0;
        
        // --- Daily Ad Reset Logic ---
        const now = new Date();
        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const resetDate = toDate(lastAdResetDate);
        if (!resetDate || resetDate.getDate() !== now.getDate() || resetDate.getMonth() !== now.getMonth() || resetDate.getFullYear() !== now.getFullYear()) {
             dailyAdsWatched = 0;
             lastAdResetDate = now;
             console.log("Daily ad count reset.");
        }
        
        // Check if user has a referrer and if the bonus has not been processed yet
        if (referrerCode && !data.hasReferrer) {
            await awardReferralPoints(referrerCode);
            await updateDoc(usersDocRef(), {
                hasReferrer: true,
                lastUpdated: serverNow()
            });
            console.log("Referral bonus processed for new user.");
        }
        
      } else {
        // New user logic
        let newName = telegramUser?.first_name || 'User';
        if (telegramUser?.last_name) newName += ` ${telegramUser.last_name}`;
        userName = newName;
        const newReferralCode = generateReferralCode();
        let hasReferrer = false;

        if (referrerCode) {
            hasReferrer = true;
        }

        await setDoc(usersDocRef(), {
          firebaseUID,
          telegramId,
          userName,
          points: 0,
          adsWatched: 0,
          dailyAdsWatched: 0,
          lastAdResetDate: serverNow(),
          adsCooldownEnds: null,
          taskTimers: {},
          referralCode: newReferralCode,
          lastUpdated: serverNow(),
          hasReferrer: hasReferrer,
          referralCount: 0,
          referralPointsEarned: 0,
          totalWithdrawalsCount: 0,
          totalPointsWithdrawn: 0,
          bonusClaimed: {}
        });

        totalPoints = 0;
        referralCodeInput.value = newReferralCode;
        dailyAdsWatched = 0;
      }
      
      // Update UI after loading/setting data
      userNameDisplay.textContent = userName;
      welcomeUserNameDisplay.textContent = userName;
      updatePointsDisplay();
      updateAdsCounter();
      updateTaskButtons();
      updateBonusButtons();

      if (adCooldownEnds && adCooldownEnds.getTime() > Date.now()) {
        const secondsLeft = Math.max(0, Math.floor((adCooldownEnds.getTime() - Date.now()) / 1000));
        startAdTimer(secondsLeft);
      } else {
        adsWatched = 0;
        adCooldownEnds = null;
        updateAdsCounter();
        adTimerSpan.textContent = 'Ready!';
        saveUserDataToFirebase();
      }
      
      saveUserDataToFirebase();

    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  // ======================= Tasks =======================
  const updateTaskButtons = () => {
    const now = Date.now();
    const taskCooldownInHours = 1;

    taskButtons.forEach(button => {
      const taskId = button.dataset.taskId;
      let cooldownEndTime = null;
      const saved = taskTimers[taskId];
      if (saved) {
        const d = toDate(saved);
        if (d) cooldownEndTime = d.getTime();
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
    button.addEventListener('click', async () => {
      const taskId = button.dataset.taskId;
      const taskUrl = button.dataset.taskUrl;
      const taskCooldownInSeconds = 15; // 15 seconds timer
      
      if (button.disabled) return;

      button.textContent = `Please wait ${taskCooldownInSeconds} seconds...`;
      button.disabled = true;

      const newWindow = window.open(taskUrl, '_blank');
      
      const timerStart = Date.now();
      const timerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - timerStart) / 1000);
        const remaining = Math.max(0, taskCooldownInSeconds - elapsed);
        button.textContent = `Please wait ${remaining} seconds...`;
        if (remaining <= 0) {
          clearInterval(timerInterval);
          if (newWindow) newWindow.close();
          // User stayed for the required time, award points
          alert(`Task ${taskId} completed! You earned ${pointsPerTask} points.`);
          totalPoints += pointsPerTask;
          updatePointsDisplay();
          const cooldownEnds = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1-hour cooldown
          taskTimers[taskId] = cooldownEnds;
          saveUserDataToFirebase();
          updateTaskButtons();
        }
      }, 1000);

      // Check if user closes the window or comes back before the timer is up
      const checkBack = () => {
        if (Date.now() - timerStart < taskCooldownInSeconds * 1000) {
          clearInterval(timerInterval);
          alert("Task failed! You must stay on the page for at least 15 seconds to earn points.");
          button.textContent = `Task ${taskId}: +${pointsPerTask} Points`;
          button.disabled = false;
        }
        window.removeEventListener('focus', checkBack);
      };
      
      window.addEventListener('focus', checkBack);
    });
  });

  // ======================= Bonus Buttons =======================
  const updateBonusButtons = () => {
    joinBonusBtns.forEach(btn => {
      const bonusName = btn.dataset.bonusName;
      if (bonusClaimed[bonusName]) {
        btn.textContent = 'Join Now';
        btn.disabled = false;
      } else {
        btn.textContent = `+${btn.dataset.bonusPoints} Points`;
        btn.disabled = false;
      }
    });
  };

  joinBonusBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const bonusName = btn.dataset.bonusName;
      const channelLink = btn.dataset.channelLink;
      const bonusPoints = Number(btn.dataset.bonusPoints);

      if (bonusClaimed[bonusName]) {
        // User has already claimed, just open the link
        window.open(channelLink, '_blank');
        return;
      }

      // Check for a pending claim for this button
      if (btn.dataset.claiming === 'true') {
        alert("Please wait for the current bonus to process.");
        return;
      }

      // Open the link for the user to join
      window.open(channelLink, '_blank');
      
      // Set a claiming flag and disable the button
      btn.dataset.claiming = 'true';
      btn.disabled = true;

      try {
        // Award the points and update the user's bonusClaimed state in Firebase
        const userDocRef = usersDocRef();
        await updateDoc(userDocRef, {
          points: increment(bonusPoints),
          [`bonusClaimed.${bonusName}`]: true
        });
        
        totalPoints += bonusPoints;
        updatePointsDisplay();
        bonusClaimed[bonusName] = true;
        
        alert(`You've successfully claimed your bonus of ${bonusPoints} points!`);
        
      } catch(error) {
        console.error("Error claiming bonus:", error);
        alert("Failed to claim bonus. Please try again.");
      } finally {
        // Reset button state regardless of success or failure
        btn.dataset.claiming = 'false';
        btn.textContent = 'Join Now';
        btn.disabled = false;
        await saveUserDataToFirebase();
        updateBonusButtons(); // Re-render the button state
      }
    });
  });

  // ======================= Navigation =======================
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const pageId = item.dataset.page + '-page';
      switchPage(pageId);
      if (pageId === 'withdraw-page') {
        loadWithdrawalHistory();
      }
    });
  });

  // ======================= Copy & Share =======================
  copyButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const input = e.target.previousElementSibling;
      input.select();
      input.setSelectionRange(0, 99999);
      document.execCommand('copy');
      alert('Link copied to clipboard! You can now share it with friends to earn points.');
    });
  });

  // Update Share link button logic
  shareBtn.addEventListener('click', () => {
    const referralLink = referralLinkInput.value;
    const shareText = `Join Coin Bazar Mini App and earn daily rewards! My referral code is: ${referralCodeInput.value}\n\n${referralLink}`;

    if (navigator.share) {
      navigator.share({
        title: 'Join Coin Bazar',
        text: shareText,
      }).catch(error => {
        console.error('Error sharing:', error);
      });
    } else {
      // Fallback for browsers that don't support Web Share API
      alert('Your browser does not support the Web Share API. Please copy the link manually.');
      // Fallback to copy the link to clipboard
      referralLinkInput.select();
      document.execCommand('copy');
    }
  });

  // ======================= Withdraw =======================
  paymentMethodSelect.addEventListener('change', () => {
    const method = paymentMethodSelect.value;
    if (method === 'bkash' || method === 'nagad') {
      withdrawMessageSpan.textContent = 'Minimum 10,000 points are required for Mobile Banking withdrawal.';
      amountInput.placeholder = "Enter amount (min 10000)";
      amountInput.value = '';
    } else if (method === 'grameenphone' || method === 'robi' || method === 'jio' || method === 'airtel' || method === 'banglalink' || method === 'teletalk') {
      withdrawMessageSpan.textContent = 'Minimum 2,000 points are required for Mobile Recharge.';
      amountInput.placeholder = "Enter amount (min 2000)";
      amountInput.value = '';
    } else if (method === 'binance' || method === 'webmoney') {
      withdrawMessageSpan.textContent = 'Minimum 100,000 points are required for International Banking withdrawal.';
      amountInput.placeholder = "Enter amount (min 100000)";
    } else {
      withdrawMessageSpan.textContent = '';
      amountInput.placeholder = "Enter amount (points)";
    }
  });

  withdrawForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const paymentMethod = paymentMethodSelect.value;
    const amount = Number(amountInput.value || 0);
    const accountId = document.getElementById('account-id').value.trim();

    if (!paymentMethod || amount <= 0 || !accountId) {
      alert('Please fill out all fields correctly.');
      return;
    }

    if (totalPoints < amount) {
      alert(`Not enough points. You only have ${totalPoints} points.`);
      return;
    }

    if (!firebaseUID) {
      alert('Authentication error. Please refresh the page and try again.');
      return;
    }

    try {
      // 1. Point minus from Firebase
      const userDocRef = usersDocRef();
      await updateDoc(userDocRef, {
        points: increment(-amount),
        totalWithdrawalsCount: increment(1),
        totalPointsWithdrawn: increment(amount)
      });

      // Update local state
      totalPoints -= amount;
      updatePointsDisplay();
      
      // 2. Save withdrawal request to Firestore
      const withdrawalDoc = doc(withdrawalsCollectionRef());
      await setDoc(withdrawalDoc, {
        firebaseUID: firebaseUID,
        telegramId: telegramId,
        userName: userName,
        amount: amount,
        paymentMethod: paymentMethod,
        accountId: accountId,
        timestamp: serverNow(),
        status: 'pending'
      });

      alert('Withdrawal request submitted successfully!');
      e.target.reset();
      loadWithdrawalHistory(); // Refresh history

    } catch (error) {
      console.error('Error submitting withdrawal request:', error);
      alert('An error occurred. Please check your connection and try again.');
    }
  });

  // ======================= Withdrawal History Display =======================
  const loadWithdrawalHistory = async () => {
    if (!firebaseUID) {
      withdrawalHistoryList.innerHTML = '<li class="error-message">Authentication error. Please refresh the page.</li>';
      return;
    }

    withdrawalHistoryList.innerHTML = '<li class="loading-message">Loading history...</li>';
    totalWithdrawalsCount.textContent = '0';
    totalPointsWithdrawn.textContent = '0';

    try {
      const userDoc = await getDoc(usersDocRef());
      if (userDoc.exists()) {
        const userData = userDoc.data();
        totalWithdrawalsCount.textContent = userData.totalWithdrawalsCount || 0;
        totalPointsWithdrawn.textContent = userData.totalPointsWithdrawn || 0;
      }

      const q = query(
        withdrawalsCollectionRef(),
        where("firebaseUID", "==", firebaseUID),
        orderBy("timestamp", "desc")
      );
      const querySnapshot = await getDocs(q);

      withdrawalHistoryList.innerHTML = '';

      if (querySnapshot.empty) {
        withdrawalHistoryList.innerHTML = '<li class="no-history-message">No withdrawal history found.</li>';
      } else {
        querySnapshot.forEach(doc => {
          const withdrawal = doc.data();
          const date = withdrawal.timestamp ? toDate(withdrawal.timestamp).toLocaleDateString() : 'N/A';
          const time = withdrawal.timestamp ? toDate(withdrawal.timestamp).toLocaleTimeString() : 'N/A';

          const listItem = document.createElement('li');
          listItem.className = `withdrawal-item ${withdrawal.status}`;

          const statusText = withdrawal.status.charAt(0).toUpperCase() + withdrawal.status.slice(1);

          listItem.innerHTML = `
            <div class="withdrawal-info">
              <span>Method: ${withdrawal.paymentMethod}</span>
              <span class="withdrawal-amount">Amount: ${withdrawal.amount} Points</span>
            </div>
            <div class="withdrawal-details">
              <span>Date: ${date} ${time}</span>
              <span class="status ${withdrawal.status}">${statusText}</span>
            </div>
          `;
          withdrawalHistoryList.appendChild(listItem);
        });
      }
    } catch (error) {
      console.error("Error loading withdrawal history:", error);
      withdrawalHistoryList.innerHTML = '<li class="error-message">Error loading history. Please try again.</li>';
    }
  };

  // ======================= Name Edit =======================
  editNameBtn.addEventListener('click', () => {
    const currentName = userNameDisplay.textContent;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = currentName;
    nameInput.className = 'user-name-input';
    nameInput.maxLength = 20;
    userNameDisplay.replaceWith(nameInput);
    nameInput.focus();
    const saveName = async () => {
      const newName = nameInput.value.trim() || 'User';
      userName = newName;
      userNameDisplay.textContent = newName;
      welcomeUserNameDisplay.textContent = newName;
      nameInput.replaceWith(userNameDisplay);
      await saveUserDataToFirebase();
    };
    nameInput.addEventListener('blur', saveName);
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') saveName();
    });
  });

  // ======================= Ad Timer =======================
  const startAdTimer = (initialSeconds = adResetTimeInMinutes * 60) => {
    let timeLeft = Math.ceil(initialSeconds);
    adTimerSpan.textContent = formatTime(timeLeft);
    watchAdBtn.disabled = true;
    if (adTimerInterval) clearInterval(adTimerInterval);
    adTimerInterval = setInterval(async () => {
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
  const formatTime = (seconds) => {
    if (seconds <= 0) return 'Ready!';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')} remaining`;
  };

  // ======================= Watch Ad =======================
  watchAdBtn.addEventListener('click', async () => {
    if (adsWatched >= maxAdsPerCycle) {
      alert('You have reached the ad limit for this cycle. Please wait for the timer to finish.');
      return;
    }

    if (typeof window.show_9673543 === 'function') {
      try {
        await window.show_9673543().then(() => {
          adsWatched++;
          dailyAdsWatched++;
          totalPoints += pointsPerAd;
          updateAdsCounter();
          updatePointsDisplay();
          if (adsWatched >= maxAdsPerCycle) {
            adCooldownEnds = new Date(Date.now() + adResetTimeInMinutes * 60 * 1000);
            startAdTimer();
            alert('You have watched all ads for this cycle. The timer has started!');
          } else {
            alert(`You earned ${pointsPerAd} points!`);
          }
          saveUserDataToFirebase();
        }).catch(async (e) => {
          console.error('Rewarded Interstitial failed, trying Rewarded Popup:', e);
          await window.show_9673543('pop').then(() => {
            adsWatched++;
            dailyAdsWatched++;
            totalPoints += pointsPerAd;
            updateAdsCounter();
            updatePointsDisplay();
            if (adsWatched >= maxAdsPerCycle) {
              adCooldownEnds = new Date(Date.now() + adResetTimeInMinutes * 60 * 1000);
              startAdTimer();
              alert('You have watched all ads for this cycle. The timer has started!');
            } else {
              alert(`You earned ${pointsPerAd} points!`);
            }
            saveUserDataToFirebase();
          }).catch(e => {
            console.error('Rewarded Popup also failed:', e);
            alert('There was an error loading the ad. Please try again.');
          });
        });
      } catch (e) {
        console.error('Ad function call failed:', e);
        alert('Ad script not loaded. Please try again.');
      }
    } else {
      alert('Ad script not loaded. Please try again.');
    }
  });

  // ======================= Init (UI defaults) =======================
  userNameDisplay.textContent = userName;
  welcomeUserNameDisplay.textContent = userName;
  updatePointsDisplay();
  updateAdsCounter();
  navItems.forEach(item => {
    const pageId = item.dataset.page + '-page';
    if (item.classList.contains('active')) switchPage(pageId);
  });
});
