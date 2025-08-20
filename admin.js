import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";
import {
  getFirestore, collection, getDocs, getDoc, doc, query, where,
  orderBy, limit, updateDoc, setDoc, addDoc, serverTimestamp, increment, deleteDoc
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const app = window.__fbApp;
const auth = getAuth(app);
const db = getFirestore(app);

// ---------- Helpers ----------
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const fmt = (n) => new Intl.NumberFormat().format(n ?? 0);
const ts = (t) => !t ? "—" : (t.toDate ? t.toDate() : new Date(t)).toLocaleString();

// ---------- Views / Tabs ----------
const loginView = $("#login-view");
const adminView = $("#admin-view");
const tabs = $$(".tab");
const pages = $$(".tabpage");

tabs.forEach(btn=>{
  btn.addEventListener("click", ()=>{
    tabs.forEach(b=>b.classList.remove("active"));
    pages.forEach(p=>p.classList.remove("active"));
    btn.classList.add("active");
    $("#tab-"+btn.dataset.tab).classList.add("active");
  });
});

// ---------- Auth & Auto Logout ----------
let logoutTimer;
const resetLogoutTimer = () => {
  clearTimeout(logoutTimer);
  logoutTimer = setTimeout(() => {
    signOut(auth);
    alert("Session expired due to inactivity. Please log in again.");
  }, 15 * 60 * 1000); // 15 minutes
};

// Listen for auth state changes
onAuthStateChanged(auth, async (user) => {
  if (user) {
    // User is signed in, show admin view and load data
    $("#current-admin").textContent = user.email || user.uid;
    loginView.classList.remove("active");
    adminView.classList.add("active");
    resetLogoutTimer(); // Start inactivity timer
    await refreshAll();
  } else {
    // User is signed out, show login view
    loginView.classList.add("active");
    adminView.classList.remove("active");
    clearTimeout(logoutTimer); // Clear any existing timer
  }
});

$("#login-btn").addEventListener("click", async ()=>{
  const email = $("#login-email").value.trim();
  const pwd   = $("#login-password").value.trim();
  $("#login-error").textContent = "";
  try {
    await signInWithEmailAndPassword(auth, email, pwd);
    // onAuthStateChanged will handle the rest
  } catch (e) {
    $("#login-error").textContent = e.message || "Login failed";
  }
});

$("#logout-btn").addEventListener("click", async ()=>{
  await signOut(auth);
  // onAuthStateChanged will handle the view change
});

// Add listeners for inactivity
document.addEventListener("mousemove", resetLogoutTimer);
document.addEventListener("keydown", resetLogoutTimer);
document.addEventListener("scroll", resetLogoutTimer);
document.addEventListener("click", resetLogoutTimer);

// ---------- Dashboard ----------
async function loadKPIs() {
  const usersSnap = await getDocs(collection(db, "users"));
  let totalUsers = 0, sumPoints = 0, sumAds = 0;
  usersSnap.forEach(d=>{
    totalUsers++;
    const v = d.data();
    sumPoints += Number(v.points||0);
    sumAds += Number(v.adsWatched||0);
  });
  $("#kpi-users").textContent  = fmt(totalUsers);
  $("#kpi-points").textContent = fmt(sumPoints);
  $("#kpi-ads").textContent    = fmt(sumAds);

  const qs = await getDocs(query(collection(db,"withdrawals"), where("status","==","pending")));
  $("#kpi-pending").textContent = fmt(qs.size);
}

// ---------- Users ----------
async function loadUsers(filter="") {
  const tbody = $("#users-tbody"); tbody.innerHTML = "";
  const snap = await getDocs(collection(db, "users"));
  const rows = snap.docs.map(d => ({ _id: d.id, ...d.data() }));

  const f = filter.toLowerCase();
  const filtered = rows.filter(u => {
    return !f || (u.userName || "").toLowerCase().includes(f) ||
      (u.telegramId || "").toLowerCase().includes(f) ||
      (u.referralCode || "").toLowerCase().includes(f);
  });

  filtered.sort((a,b)=> (b.points||0)-(a.points||0));

  for (const u of filtered) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${u.userName || "—"}</td>
      <td>${u.telegramId || "—"}</td>
      <td>${fmt(u.points || 0)}</td>
      <td>${fmt(u.adsWatched || 0)}</td>
      <td>${u.referralCode || "—"}</td>
      <td>${fmt(u.totalWithdrawalsCount || 0)} / ${fmt(u.totalPointsWithdrawn || 0)} pts</td>
      <td>
        <div class="row-actions">
          <button data-act="add" class="ghost">+ Points</button>
          <button data-act="sub" class="ghost">− Points</button>
          <button data-act="reset-ads" class="ghost">Reset Ads</button>
        </div>
      </td>`;
    tbody.appendChild(tr);

    const userRef = doc(db, "users", u._id);
    tr.querySelector('[data-act="add"]').onclick = async () => {
      const v = Number(prompt("Add how many points?", "10") || 0);
      if (!v) return;
      await updateDoc(userRef, { points: increment(v) });
      await refreshUsers();
    };
    tr.querySelector('[data-act="sub"]').onclick = async () => {
      const v = Number(prompt("Subtract how many points?", "10") || 0);
      if (!v) return;
      await updateDoc(userRef, { points: increment(-v) });
      await refreshUsers();
    };
    tr.querySelector('[data-act="reset-ads"]').onclick = async () => {
      await updateDoc(userRef, { adsWatched: 0, adsCooldownEnds: null });
      await refreshUsers();
    };
  }
}
$("#refresh-users").addEventListener("click", ()=>refreshUsers());
$("#user-search").addEventListener("input", (e)=>loadUsers(e.target.value));
async function refreshUsers(){ await loadUsers($("#user-search").value.trim()); }

// ---------- Withdrawals ----------
async function loadWithdrawals(filter="pending") {
  const tbody = $("#withdrawals-tbody"); tbody.innerHTML = "";
  let qRef = collection(db, "withdrawals");
  if (filter !== "all") qRef = query(qRef, where("status","==", filter));
  const snap = await getDocs(qRef);
  const rows = snap.docs.map(d => ({id:d.id, ...d.data()}));
  rows.sort((a,b)=> (b.requestDate?.seconds||0)-(a.requestDate?.seconds||0));

  for (const w of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${w.userName||"—"}<div class="muted">${w.telegramId||""}</div></td>
      <td>${w.paymentMethod||"—"}</td>
      <td>${fmt(w.amount||0)}</td>
      <td>${w.accountId||"—"}</td>
      <td><span class="badge ${w.status}">${w.status}</span></td>
      <td>${ts(w.requestDate)}</td>
      <td>
        <div class="row-actions">
          ${w.status==="pending" ? `
            <button class="ghost" data-act="approve">Approve</button>
            <button class="ghost" data-act="reject">Reject</button>
          ` : `<button class="ghost" data-act="del">Delete</button>`}
        </div>
      </td>`;
    tbody.appendChild(tr);

    const ref = doc(db,"withdrawals", w.id);

    const approve = tr.querySelector('[data-act="approve"]');
    const reject  = tr.querySelector('[data-act="reject"]');
    const delBtn  = tr.querySelector('[data-act="del"]');

    if (approve) approve.onclick = async ()=>{
      await updateDoc(ref, { status:"approved" });
      await refreshWithdrawals();
    };
    if (reject) reject.onclick = async ()=>{
      const refund = confirm("Reject & refund points back to user?");
      await updateDoc(ref, { status:"rejected" });
      if (refund && w.userId && w.amount) {
        try { await updateDoc(doc(db,"users", w.userId), { points: increment(Number(w.amount)) }); } catch(e){}
      }
      await refreshWithdrawals();
    };
    if (delBtn) delBtn.onclick = async ()=>{
      if (confirm("Delete this record?")) { await deleteDoc(ref); await refreshWithdrawals(); }
    };
  }
}
$("#w-filter").addEventListener("change", (e)=>loadWithdrawals(e.target.value));
$("#refresh-withdrawals").addEventListener("click", ()=>refreshWithdrawals());
async function refreshWithdrawals(){ await loadWithdrawals($("#w-filter").value); }

// ---------- Tasks ----------
async function loadTasks() {
  const tb = $("#tasks-tbody"); tb.innerHTML = "";
  const snap = await getDocs(collection(db,"tasks"));
  const list = snap.docs.map(d => ({id:d.id, ...d.data()}));
  
  list.forEach(t=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.title || "—"}</td>
      <td>${fmt(t.reward || 0)}</td>
      <td>${fmt(t.cooldownHours || 0)}</td>
      <td>${t.active ? "Yes" : "No"}</td>
      <td style="max-width:320px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.url || "—"}</td>
      <td>
        <div class="row-actions">
          <button class="ghost" data-act="edit">Edit</button>
          <button class="ghost" data-act="del">Delete</button>
        </div>
      </td>`;
    tb.appendChild(tr);

    tr.querySelector('[data-act="edit"]').onclick = ()=>{
      $("#task-title").value = t.title || "";
      $("#task-url").value = t.url || "";
      $("#task-reward").value = t.reward || 0;
      $("#task-cooldown").value = t.cooldownHours || 0;
      $("#task-active").checked = !!t.active;
      $("#task-save").dataset.id = t.id;
    };
    tr.querySelector('[data-act="del"]').onclick = async ()=>{
      if (confirm("Delete task?")) { await deleteDoc(doc(db,"tasks", t.id)); await loadTasks(); }
    };
  });
}
$("#task-save").addEventListener("click", async ()=>{
  const payload = {
    title: $("#task-title").value.trim(),
    url: $("#task-url").value.trim(),
    reward: Number($("#task-reward").value || 0),
    cooldownHours: Number($("#task-cooldown").value || 0),
    active: $("#task-active").checked,
    updatedAt: serverTimestamp()
  };
  const id = $("#task-save").dataset.id;
  if (id) {
    await updateDoc(doc(db,"tasks", id), payload);
    $("#task-save").dataset.id = "";
  } else {
    payload.createdAt = serverTimestamp();
    await addDoc(collection(db,"tasks"), payload);
  }
  $("#task-title").value = $("#task-url").value = $("#task-reward").value = $("#task-cooldown").value = "";
  $("#task-active").checked = true;
  await loadTasks();
});

// ---------- Settings ----------
async function loadSettings() {
  const ref = doc(db,"adminSettings","appConfig");
  const snap = await getDoc(ref);
  const d = snap.exists() ? snap.data() : {};
  $("#set-minWithdraw").value = d.minWithdraw ?? "";
  $("#set-adReward").value    = d.adReward ?? "";
  $("#set-taskReward").value  = d.taskReward ?? "";
  $("#set-ref-new").value     = d.referralBonusNew ?? "";
  $("#set-ref-ref").value     = d.referralBonusReferrer ?? "";
  $("#set-maxAds").value      = d.maxAdsPerCycle ?? "";
  $("#set-adCooldown").value  = d.adCooldownMinutes ?? "";
}
$("#settings-save").addEventListener("click", async ()=>{
  const ref = doc(db,"adminSettings","appConfig");
  await setDoc(ref, {
    minWithdraw: Number($("#set-minWithdraw").value||0),
    adReward: Number($("#set-adReward").value||0),
    taskReward: Number($("#set-taskReward").value||0),
    referralBonusNew: Number($("#set-ref-new").value||0),
    referralBonusReferrer: Number($("#set-ref-ref").value||0),
    maxAdsPerCycle: Number($("#set-maxAds").value||0),
    adCooldownMinutes: Number($("#set-adCooldown").value||0),
    updatedAt: serverTimestamp()
  }, { merge:true });
  $("#settings-status").textContent = "Saved!";
  setTimeout(()=> $("#settings-status").textContent="", 1500);
});

// ---------- Bootstrap ----------
async function refreshAll() {
  await Promise.all([loadKPIs(), refreshUsers(), refreshWithdrawals(), loadTasks(), loadSettings()]);
}