// ======================= Firebase v12 (Modular) =======================
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  serverTimestamp, Timestamp, increment, FieldValue,
  collection, query, where, getDocs, orderBy
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
  
  // Withdraw UI elements
  const withdrawForm = document.getElementById('withdraw-form');
  const paymentMethodSelect = document.getElementById('payment-method');
  const amountInput = document.getElementById('amount');
  const withdrawMessageSpan = document.getElementById('withdraw-message');
  const successfulCountSpan = document.getElementById('successful-count');
  const pendingCountSpan = document.getElementById('pending-count');
  const withdrawalHistoryList = document.getElementById('withdrawal-history-list');
  const noHistoryMessage = document.getElementById('no-history-message');

  // ======================= State & Settings =======================
  let adsWatched = 0;
  let adCooldownEnds = null;
  let totalPoints = 0;
  let userName = 'User';
  let telegramId = null;
  let telegramUser = null;
  let referrerCode = null;

  let settings = {
    ad_reset_minutes: 30,
    ad_points: 5,
    referral_points: 200,
    min_withdraw_points_bkash: 10000,
    min_withdraw_points_recharge: 2000,
    is_maintenance_mode: false,
    task_urls: {}
  };

  const taskCooldownInHours = 1;
  let taskTimers = {};
  
  // ======================= Telegram Init =======================
  try {
    if (window.Telegram?.WebApp?.initDataUnsafe) {
      telegramUser = window.Telegram.WebApp.initDataUnsafe.user;
      telegramId = String(telegramUser.id);
      referrerCode = window.Telegram.WebApp.initDataUnsafe.start_param;
    } else {
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
    await loadSettingsFromFirebase(); // Load settings first
    await loadUserDataFromFirebase();
    await loadWithdrawalHistory(); // নতুন ফাংশন কল
    updateReferralLinkInput();
    setInterval(updateTaskButtons, 1000);
  });

  // ======================= Firestore Helpers =======================
  const usersDocRef = () => doc(db, "users", firebaseUID || "temp");
  const settingsDocRef = doc(db, "settings", "app_config");
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
    const adsLeft = Math.max(0, 100 - adsWatched);
    adWatchedCountSpan.textContent = `${adsWatched} watched`;
    adsLeftValue.textContent = String(adsLeft);
    welcomeAdsLeft.textContent = String(adsLeft);
    totalAdsWatched.textContent = String(adsWatched);
    
    if (adCooldownEnds && adCooldownEnds.getTime() > Date.now()) {
      watchAdBtn.disabled = true;
      watchAdBtn.textContent = 'Waiting for timer to finish';
    } else {
      watchAdBtn.disabled = false;
      watchAdBtn.textContent = `Watch Ad & Earn ${settings.ad_points} Points`;
    }
  };
  const switchPage = (pageId) => {
    pages.forEach(p => p.classList.remove('active'));
    document.getElementById(pageId)?.classList.add('active');
    navItems.forEach(item => {
      item.classList.remove('active');
      if (item.dataset.page + '-page' === pageId) item.classList.add('active');
    });
    if (pageId === 'withdraw-page') {
      loadWithdrawalHistory(); // প্রতিবার উইথড্র পেজে এলে হিস্টোরি লোড হবে
    }
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
          points: increment(settings.referral_points)
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
  const loadSettingsFromFirebase = async () => {
    try {
      const docSnap = await getDoc(settingsDocRef);
      if (docSnap.exists()) {
        settings = docSnap.data();
      } else {
        console.warn("Settings document not found. Using default settings.");
      }
    } catch (error) {
      console.error("Error loading settings:", error);
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

      if (settings.is_maintenance_mode) {
          alert("The app is currently in maintenance mode. Please try again later.");
          // Disable all buttons and features
          document.body.style.pointerEvents = 'none';
          document.body.style.opacity = '0.5';
      }

    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  // ======================= Withdrawal History =======================
  const loadWithdrawalHistory = async () => {
      if (!firebaseUID) return;

      try {
          const q = query(collection(db, "withdrawals"), 
              where("userId", "==", firebaseUID),
              orderBy("requestDate", "desc")
          );
          
          const querySnapshot = await getDocs(q);
          const history = [];
          let pendingCount = 0;
          let successfulCount = 0;
          
          querySnapshot.forEach((doc) => {
              const data = doc.data();
              if (data.status === 'pending') {
                  pendingCount++;
              } else if (data.status === 'completed') {
                  successfulCount++;
              }
              history.push(data);
          });
          
          successfulCountSpan.textContent = successfulCount;
          pendingCountSpan.textContent = pendingCount;
          
          withdrawalHistoryList.innerHTML = '';
          if (history.length > 0) {
              noHistoryMessage.style.display = 'none';
              history.forEach(item => {
                  const itemDiv = document.createElement('div');
                  itemDiv.className = 'history-item';
                  itemDiv.innerHTML = `
                      <div class="item-info">
                          <p><strong>Method:</strong> ${item.paymentMethod}</p>
                          <p><strong>Amount:</strong> ${item.amount} points</p>
                          <p><strong>Status:</strong> <span class="status-${item.status}">${item.status}</span></p>
                      </div>
                  `;
                  withdrawalHistoryList.appendChild(itemDiv);
              });
          } else {
              noHistoryMessage.style.display = 'block';
          }
      } catch (error) {
          console.error("Error loading withdrawal history:", error);
      }
  };

  // ======================= Tasks =======================
  const updateTaskButtons = () => {
    const now = Date.at(Date.now());
    taskButtons.forEach(button => {
      const taskId = button.dataset.taskId;
      const taskUrl = settings.task_urls?.[taskId]; // Get URL from settings
      if (!taskUrl) {
        button.style.display = 'none'; // Hide if URL is not set in settings
        return;
      }
      button.style.display = 'block';

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
        button.textContent = `Task ${taskId}: +${settings.ad_points || 10} Points`; // Use ad_points for tasks as well
        button.disabled = false;
      }
    });
  };
  taskButtons.forEach(button => {
    button.addEventListener('click', async () => {
      const taskId = button.dataset.taskId;
      const taskUrl = settings.task_urls?.[taskId];
      if (!taskUrl) return;

      button.textContent = 'Please wait 10 seconds...';
      button.disabled = true;
      const newWindow = window.open(taskUrl, '_blank');
      setTimeout(async () => {
        try { if (newWindow) newWindow.close(); } catch {}
        alert(`Task ${taskId} completed! You earned ${settings.ad_points} points.`);
        totalPoints += settings.ad_points;
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
  // Payment Method সিলেক্ট পরিবর্তন হলে মেসেজ আপডেট করবে
  paymentMethodSelect.addEventListener('change', () => {
    const method = paymentMethodSelect.value;
    if (method === 'bkash' || method === 'nagad') {
      withdrawMessageSpan.textContent = `Minimum ${settings.min_withdraw_points_bkash} points are required for Mobile Banking withdrawal.`;
      amountInput.placeholder = `Enter amount (min ${settings.min_withdraw_points_bkash})`;
      amountInput.value = '';
    } else if (method === 'grameenphone' || method === 'robi' || method === 'jio' || method === 'airtel' || method === 'banglalink' || method === 'teletalk') {
      withdrawMessageSpan.textContent = `Minimum ${settings.min_withdraw_points_recharge} points are required for Mobile Recharge.`;
      amountInput.placeholder = `Enter amount (min ${settings.min_withdraw_points_recharge})`;
      amountInput.value = '';
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
    let minimumPoints = 0;

    // মিনিমাম পয়েন্ট চেক করা হচ্ছে
    if (paymentMethod === 'bkash' || paymentMethod === 'nagad') {
      minimumPoints = settings.min_withdraw_points_bkash;
    } else if (paymentMethod === 'grameenphone' || paymentMethod === 'robi' || paymentMethod === 'jio' || paymentMethod === 'airtel' || paymentMethod === 'banglalink' || paymentMethod === 'teletalk') {
      minimumPoints = settings.min_withdraw_points_recharge;
    } else {
      alert('Please select a valid payment method.');
      return;
    }

    if (totalPoints < minimumPoints) {
      alert(`Not enough points. Minimum withdrawal is ${minimumPoints} points.`);
      return;
    }

    if (amount > totalPoints) {
      alert('The amount you entered is more than your total points.');
      return;
    }
    
    // অটোমেটিক মিনিমাম পয়েন্ট কেটে নেওয়া হচ্ছে
    if (amount < minimumPoints) {
      alert(`The amount you entered is less than the minimum withdrawal amount of ${minimumPoints} points.`);
      return;
    }

    const payload = {
      userName,
      telegramId,
      firebaseUID,
      amount: minimumPoints, // শুধুমাত্র মিনিমাম পয়েন্ট কাটা হবে
      paymentMethod,
      accountId
    };

    try {
      // Firebase থেকে পয়েন্ট মাইনাস করা হচ্ছে
      await updateDoc(usersDocRef(), {
        points: FieldValue.increment(-minimumPoints),
        lastWithdrawal: serverNow(),
      });
      totalPoints -= minimumPoints;
      updatePointsDisplay();

      // Vercel API Function-এ মেসেজ পাঠানোর জন্য রিকোয়েস্ট পাঠানো হচ্ছে
      const res = await fetch('https://telegram-mini-app-admin-panel.vercel.app/api/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await res.json();
      if (res.ok) {
        alert('Withdrawal request submitted successfully!');
        e.target.reset();
        loadWithdrawalHistory(); // নতুন রিকোয়েস্ট পাঠানোর পর হিস্টোরি রিফ্রেশ হবে
      } else {
        console.error('API Error:', result.error);
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
  const startAdTimer = (initialSeconds = settings.ad_reset_minutes * 60) => {
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
    if (adCooldownEnds && adCooldownEnds.getTime() > Date.now()) {
      alert(`Please wait for the timer to finish.`);
      return;
    }
    if (typeof window.show_9673543 === 'function') {
      try {
        await window.show_9673543();
        adsWatched++;
        totalPoints += settings.ad_points;
        updateAdsCounter();
        updatePointsDisplay();
        adCooldownEnds = new Date(Date.now() + settings.ad_reset_minutes * 60 * 1000);
        startAdTimer();
        alert(`You earned ${settings.ad_points} points! The timer has started.`);
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
