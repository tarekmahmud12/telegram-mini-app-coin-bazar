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
  
  // Withdraw UI elements
  const withdrawForm = document.getElementById('withdraw-form');
  const paymentMethodSelect = document.getElementById('payment-method');
  const amountInput = document.getElementById('amount');
  const withdrawMessageSpan = document.getElementById('withdraw-message');
  const submitRequestBtn = document.getElementById('submit-request-btn');
  
  // Withdrawal History UI elements (এগুলো এখন ব্যবহার হচ্ছে না, কিন্তু UI তে আছে)
  const totalWithdrawalsCount = document.getElementById('total-withdrawals-count');
  const totalPointsWithdrawn = document.getElementById('total-points-withdrawn');
  
  // Referral UI elements
  const shareBtn = document.querySelector('.share-btn');
  const referralCountDisplay = document.getElementById('referral-count');
  const referralPointsEarnedDisplay = document.getElementById('referral-points-earned');

  // Bonus UI elements
  const officialChannelBtn = document.getElementById('official-channel-btn');
  const supportGroupBtn = document.getElementById('support-group-btn');
  const telegramCommunityBtn = document.getElementById('telegram-community-btn');
  const whatsappCommunityBtn = document.getElementById('whatsapp-community-btn');

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
  const referrerPoints = 200; // রেফারকারী পাবে
  const newUserPoints = 100; // নতুন ইউজার পাবে
  const bonusPoints = 50; // বোনাসের জন্য পয়েন্ট
  const taskUrls = {
    '1': 'https://www.profitableratecpm.com/yh7pvdve?key=58d4a9b60d7d99d8d92682690909edc3',
    '2': 'https://www.profitableratecpm.com/yh7pvdve?key=58d4a9b60d7d99d8d92682690909edc3',
    '3': 'https://www.profitableratecpm.com/yh7pvdve?key=58d4a9b60d7d99d8d92682690909edc3',
    '4': 'https://www.profitableratecpm.com/yh7pvdve?key=58d4a9b6d7d99d8d92682690909edc3',
    '5': 'https://www.profitableratecpm.com/yh7pvdve?key=58d4a9b60d7d99d8d92682690909edc3',
  };
  const taskCooldownInHours = 1;
  let taskTimers = {};
  let claimedBonuses = {}; // বোনাস ট্র্যাক করার জন্য নতুন ভেরিয়েবল
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
    // বাটনে লোডিং অবস্থা সেট করা হয়েছে
    submitRequestBtn.disabled = false;
    submitRequestBtn.textContent = 'Submit Request';
    
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
        adsCooldownEnds: adCooldownEnds ? Timestamp.fromDate(adCooldownEnds) : null,
        taskTimers: timersToSave,
        referralCode: referralCodeInput.value || generateReferralCode(),
        lastUpdated: serverNow(),
        hasReferrer: !!referrerCode,
        referralCount: 0,
        referralPointsEarned: 0,
        totalWithdrawalsCount: 0,
        totalPointsWithdrawn: 0,
        // বোনাস ট্র্যাক করার জন্য নতুন ফিল্ড
        claimedBonuses
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
        claimedBonuses = data.claimedBonuses || {}; // ডেটা লোড করা
        if (data.adsCooldownEnds) {
          adCooldownEnds = toDate(data.adsCooldownEnds);
        } else {
          adCooldownEnds = null;
        }
        referralCodeInput.value = data.referralCode || generateReferralCode();
        
        if (referrerCode && !data.hasReferrer) {
          totalPoints += newUserPoints;
          await awardReferralPoints(referrerCode);
          await saveUserDataToFirebase();
        }
        
        updateReferralStats(data.referralCount || 0, data.referralPointsEarned || 0);
        totalWithdrawalsCount.textContent = data.totalWithdrawalsCount || 0;
        totalPointsWithdrawn.textContent = data.totalPointsWithdrawn || 0;
        updateBonusButtons(); // বোনাস বাটন আপডেট করা

      } else {
        let newName = telegramUser?.first_name || 'User';
        if (telegramUser?.last_name) newName += ` ${telegramUser.last_name}`;
        userName = newName;
        referralCodeInput.value = generateReferralCode();
        totalPoints = referrerCode ? newUserPoints : 0;
        
        await setDoc(usersDocRef(), {
          firebaseUID,
          telegramId,
          userName,
          points: totalPoints,
          adsWatched: 0,
          adsCooldownEnds: null,
          taskTimers: {},
          referralCode: referralCodeInput.value,
          lastUpdated: serverNow(),
          hasReferrer: !!referrerCode,
          referralCount: 0,
          referralPointsEarned: 0,
          totalWithdrawalsCount: 0,
          totalPointsWithdrawn: 0,
          claimedBonuses: {} // নতুন ডকুমেন্ট তৈরির সময় খালি অবজেক্ট যোগ করা হয়েছে
        });
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
      navigator.clipboard.writeText(input.value);
      alert('Copied to clipboard!');
    });
  });
  
  shareBtn.addEventListener('click', () => {
    const referralLink = referralLinkInput.value;
    const shareText = `Join Coin Bazar Mini App and earn daily rewards! Use my referral link to get a bonus of ${newUserPoints} points. My referral code is: ${referralCodeInput.value}\n\n${referralLink}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Join Coin Bazar',
        text: shareText,
      }).catch(error => {
        console.error('Error sharing:', error);
      });
    } else {
      alert('Your browser does not support the Web Share API. Please copy the link manually.');
      referralLinkInput.select();
      navigator.clipboard.writeText(referralLinkInput.value);
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

  // সম্পূর্ণ নতুন উইথড্রয়াল লজিক
  withdrawForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!firebaseUID) {
      alert('Authentication error. Please refresh the page.');
      return;
    }

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

    try {
      // পয়েন্ট মাইনাস করা
      await updateDoc(usersDocRef(), {
        points: FieldValue.increment(-amount),
        totalWithdrawalsCount: FieldValue.increment(1),
        totalPointsWithdrawn: FieldValue.increment(amount)
      });

      // স্থানীয় অবস্থা আপডেট করা
      totalPoints -= amount;
      updatePointsDisplay();
      
      // মেসেজ তৈরি করা
      const message = `
*উইথড্রয়াল রিকোয়েস্ট*
----------------------------------------
*নাম:* ${userName}
*ইউজার আইডি:* ${telegramId}
*রেফার কোড:* ${referralCodeInput.value}
*পেমেন্ট মেথড:* ${paymentMethod}
*অ্যাকাউন্ট আইডি:* ${accountId}
*অ্যামাউন্ট:* ${amount} পয়েন্ট
----------------------------------------
_মেসেজটি সেন্ড করতে নিচে পেস্ট করুন।_
      `.trim();
      
      // ক্লিপবোর্ডে মেসেজ কপি করা
      await navigator.clipboard.writeText(message);
      
      // টেলিগ্রাম চ্যানেলে রিডাইরেক্ট করা
      window.location.href = 'https://t.me/coinbazarmessage';
      
      alert('উইথড্রয়াল রিকোয়েস্টের তথ্য কপি করা হয়েছে! টেলিগ্রামে মেসেজটি পেস্ট করে সেন্ড করুন।');
      e.target.reset();
      
    } catch (error) {
      console.error('Error in withdrawal process:', error);
      alert('An error occurred. Please check your connection and try again.');
    }
  });
  
  // ======================= Bonus Rewards =======================
  // বোনাস বাটন আপডেট করার ফাংশন
  const updateBonusButtons = () => {
    if (claimedBonuses.officialChannel) {
      officialChannelBtn.textContent = "Claimed!";
      officialChannelBtn.disabled = true;
    }
    if (claimedBonuses.supportGroup) {
      supportGroupBtn.textContent = "Claimed!";
      supportGroupBtn.disabled = true;
    }
    // অন্যান্য বোনাস বাটনের জন্য একই লজিক
    if (claimedBonuses.telegramCommunity) {
      telegramCommunityBtn.textContent = "Claimed!";
      telegramCommunityBtn.disabled = true;
    }
    if (claimedBonuses.whatsappCommunity) {
      whatsappCommunityBtn.textContent = "Claimed!";
      whatsappCommunityBtn.disabled = true;
    }
  };

  // বোনাস বাটনের জন্য ক্লিক ইভেন্ট লিসেনার
  const addBonusListener = (button, bonusName, url) => {
    button.addEventListener('click', async () => {
      if (claimedBonuses[bonusName]) {
        alert('আপনি ইতিমধ্যেই এই বোনাসটি পেয়েছেন!');
        return;
      }
      
      // পয়েন্ট যোগ করা এবং Firebase-এ সেভ করা
      totalPoints += bonusPoints;
      claimedBonuses[bonusName] = true;
      await saveUserDataToFirebase();
      updatePointsDisplay();
      
      alert(`আপনি ${bonusPoints} পয়েন্ট পেয়েছেন!`);
      
      // বাটন নিষ্ক্রিয় করা এবং টেক্সট পরিবর্তন করা
      button.textContent = 'Claimed!';
      button.disabled = true;
      
      // টেলিগ্রামে রিডাইরেক্ট করা
      window.open(url, '_blank');
    });
  };

  // প্রতিটি বোনাস বাটনে লিসেনার যোগ করা
  addBonusListener(officialChannelBtn, 'officialChannel', 'https://t.me/coinbazarmessage');
  addBonusListener(supportGroupBtn, 'supportGroup', 'https://t.me/CoinBazarWithdraRequest');
  // অন্যান্য বোনাস বাটনের জন্য লিসেনার যোগ করা
  addBonusListener(telegramCommunityBtn, 'telegramCommunity', 'https://t.me/CoinBazar_bot');
  addBonusListener(whatsappCommunityBtn, 'whatsappCommunity', 'https://chat.whatsapp.com/GfJkI21qL854bKq9tL7018');

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
        await window.show_9673543().then(() => {
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
            saveUserDataToFirebase();
        }).catch(async (e) => {
            console.error('Rewarded Interstitial failed, trying Rewarded Popup:', e);
            await window.show_9673543('pop').then(() => {
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
