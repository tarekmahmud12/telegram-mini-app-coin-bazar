// ======================= Firebase v12 (Modular) =======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  serverTimestamp, Timestamp, increment
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

// ==== Firebase কনফিগ Vercel থেকে লোড করা হচ্ছে ====
const firebaseConfig = {
  apiKey: "AIzaSyDZkV0aOLY-Yiyh5s_Nq_GSz8aiIPoSohc",
  authDomain: "coin-bazar-f3093.firebaseapp.com",
  projectId: "coin-bazar-f3093",
  storageBucket: "coin-bazar-f3093.appspot.com",
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

  // ---------- State ----------
  let adsWatched = 0;
  const maxAdsPerCycle = 10;
  const adResetTimeInMinutes = 15;
  let adTimerInterval = null;
  let adCooldownEnds = null;
  let totalPoints = 0;
  let userName = 'User';
  const pointsPerAd = 5;
  const pointsPerTask = 10;
  const referralPoints = 200; // এখানে রেফারেল পয়েন্ট 200 করা হয়েছে
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
  let referrerCode = null;

  // ======================= Telegram Init =======================
  try {
    if (window.Telegram?.WebApp?.initDataUnsafe) {
      telegramUser = window.Telegram.WebApp.initDataUnsafe.user;
      telegramId = String(telegramUser.id);
      referrerCode = window.Telegram.WebApp.initDataUnsafe.start_param;
      if (referrerCode) {
        console.log("Referrer code found:", referrerCode);
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
  const serverNow = () => serverTimestamp();
  const toDate = (maybeTs) => {
    try {
      if (!maybeTs) return null;
      if (maybeTs instanceof Date) return maybeTs;
      if (maybeTs.toDate && typeof maybeTs.toDate === 'function') return maybeTs.toDate();
      return new Date(maybeTs);
    } catch { return null; }
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
    totalAdsWatched.textContent = String(adsWatched);
    
    if (adsWatched >= maxAdsPerCycle && adCooldownEnds && adCooldownEnds.getTime() > Date.now()) {
      watchAdBtn.disabled = true;
      watchAdBtn.textContent = 'Waiting for timer to finish';
    } else {
      watchAdBtn.disabled = false;
      watchAdBtn.textContent = `Watch Ad & Earn ${pointsPerAd} Points`;
    }
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
      const usersRef = db.collection("users");
      const querySnapshot = await usersRef.where("referralCode", "==", referrerCode).limit(1).get();
      if (!querySnapshot.empty) {
        const referrerDoc = querySnapshot.docs[0];
        const referrerDocRef = referrerDoc.ref;
        await updateDoc(referrerDocRef, {
          points: increment(referralPoints)
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
        adsCooldownEnds: adCooldownEnds ? Timestamp.fromDate(adCooldownEnds) : null,
        taskTimers: timersToSave,
        referralCode: referralCodeInput.value || generateReferralCode(),
        lastUpdated: serverNow(),
        hasReferrer: !!referrerCode,
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
        taskTimers = data.taskTimers || {};
        if (data.adsCooldownEnds) {
          adCooldownEnds = toDate(data.adsCooldownEnds);
        } else {
          adCooldownEnds = null;
        }
        referralCodeInput.value = data.referralCode || generateReferralCode();
        
        if (referrerCode && !data.hasReferrer) {
          await awardReferralPoints(referrerCode);
          await saveUserDataToFirebase();
        }

      } else {
        let newName = telegramUser?.first_name || 'User';
        if (telegramUser?.last_name) newName += ` ${telegramUser.last_name}`;
        userName = newName;
        referralCodeInput.value = generateReferralCode();
        await saveUserDataToFirebase();
      }
      userNameDisplay.textContent = userName;
      welcomeUserNameDisplay.textContent = userName;
      updatePointsDisplay();
      updateAdsCounter();
      updateTaskButtons();
      
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

    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  // ======================= Tasks =======================
  const updateTaskButtons = () => {
    const now = Date.now();
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
      const taskUrl = taskUrls[taskId];
      button.textContent = 'Please wait 10 seconds...';
      button.disabled = true;
      const newWindow = window.open(taskUrl, '_blank');
      setTimeout(async () => {
        try { if (newWindow) newWindow.close(); } catch {}
        alert(`Task ${taskId} completed! You earned ${pointsPerTask} points.`);
        totalPoints += pointsPerTask;
        updatePointsDisplay();
        const cooldownEnds = new Date(Date.now() + taskCooldownInHours * 60 * 60 * 1000);
        taskTimers[taskId] = cooldownEnds;
        await saveUserDataToFirebase();
        updateTaskButtons();
      }, 10000);
    });
  });

  // ======================= Navigation =======================
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const pageId = item.dataset.page + '-page';
      switchPage(pageId);
    });
  });

  // ======================= Copy & Share =======================
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
    const referralLink = referralLinkInput.value;
    if (navigator.share) {
      navigator.share({
        title: 'Coin Bazar Referral',
        text: 'Join Coin Bazar and earn points!',
        url: referralLink,
      }).catch(() => {});
    } else {
      alert('Web Share API is not supported in this browser.');
    }
  });

  // ======================= Withdraw =======================
  document.getElementById('withdraw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(document.getElementById('amount').value || 0);
    const paymentMethod = document.getElementById('payment-method').value;
    const accountId = document.getElementById('account-id').value.trim();
    if (amount < 1000) {
      alert('Minimum withdrawal is 1000 points.');
      return;
    }
    if (amount > totalPoints) {
      alert('Not enough points.');
      return;
    }
    const payload = {
      userName,
      telegramId,
      firebaseUID,
      amount,
      paymentMethod,
      accountId
    };
    try {
      const res = await fetch('/withdraw-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
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
        await saveUserDataToFirebase();
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
        await window.show_9673543();
        adsWatched++;
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
        await saveUserDataToFirebase();
      } catch (e) {
        console.error('Ad error:', e);
        alert('There was an error loading the ad. Please try again.');
      }
    } else {
      alert('Monetag script is not loaded. Please refresh the page.');
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
