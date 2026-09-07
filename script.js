/* =========================================================
   TWYN — COMPLETE SCRIPT.JS
   V32 — Lounge + reactions + prompt + OG + typing + story views + MOTW
   ========================================================= */

let authMode = "signup";
let currentUser = null;
let selectedAvatar = null;
let selectedCover = null;
let selectedImage = null;
let activeChatUserId = null;
let replyToMessageId = null;
let editingMessageId = null;
let activeMsgId = null;
let activePostMenuId = null;
let editingPostId = null;
let realtimeChannels = [];
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

const state = {
  posts: [],
  people: [],
  followers: [],
  notifications: [],
  conversations: [],
  messages: {},
  settings: {
    notifPush: true,
    notifLikes: true,
    notifComments: true,
    privateAccount: false,
    lightMode: false
  },
  profile: {
    name: "Twyn User",
    username: "twynuser",
    bio: "Building. Creating. Sharing.",
    avatar_url: null,
    cover_url: null,
    is_verified: false
  },
  activeCategory: "typ",
  openComments: new Set(),
  openReplies: new Set(),
  openReplyThreads: new Set(),
  feedPage: 0,
  feedHasMore: true,
  isLoadingMore: false,
  viewingUserId: null,
  stories: [],
  storyGroups: [],
  activeStoryGroup: 0,
  activeStoryIndex: 0,
  storyTimer: null,
  onboardingDone: false,
  lastActivitySeenAt: null
};

const TWYN_CATEGORIES = [
  { id: "typ", name: "TYP" },
  { id: "general", name: "General" },
  { id: "gaming", name: "Gaming" },
  { id: "music", name: "Music" },
  { id: "tech", name: "Tech" },
  { id: "art", name: "Art" },
  { id: "sports", name: "Sports" },
  { id: "movies", name: "Movies" },
  { id: "web3", name: "Web3" }
];

/* ========== ELEMENTS ========== */
const authScreen = document.getElementById("authScreen");
const twynApp = document.getElementById("twynApp");
const authForm = document.getElementById("authForm");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");
const authSubmit = document.getElementById("authSubmit");
const authSwitchBtn = document.getElementById("authSwitchBtn");
const authSwitchText = document.getElementById("authSwitchText");
const authMessage = document.getElementById("authMessage");
const nameField = document.getElementById("nameField");
const authName = document.getElementById("authName");
const authEmail = document.getElementById("authEmail");
const authPassword = document.getElementById("authPassword");
const feed = document.getElementById("feed");
const profileFeed = document.getElementById("profileFeed");
const friendsContent = document.getElementById("friendsContent");
const postText = document.getElementById("postText");
const characterCount = document.getElementById("characterCount");
const imageInput = document.getElementById("imageInput");
const createPreview = document.getElementById("createPreview");
const analysisModal = document.getElementById("analysisModal");
const profileModal = document.getElementById("profileModal");
const searchPanel = document.getElementById("searchPanel");
const postOptionsModal = document.getElementById("postOptionsModal");
const editPostModal = document.getElementById("editPostModal");

/* ========== HELPERS ========== */
function verifiedBadge(isVerified) {
  return isVerified ? `<span class="verified-badge" title="Verified"></span>` : "";
}

function ogBadge(isOg) {
  return isOg ? `<span class="og-badge" title="Early Twyn member">OG</span>` : "";
}

function motwBadge(isMotw) {
  return isMotw ? `<span class="motw-badge" title="Member of the week">⭐</span>` : "";
}

function nameBadges(opts = {}) {
  return `${verifiedBadge(!!opts.isVerified)}${ogBadge(!!opts.isOg)}${motwBadge(!!opts.isMotw)}`;
}

/* ========== DAILY PROMPT ========== */
const DAILY_PROMPTS = [
  "What’s one win you’re taking into today?",
  "Share a song that matches your mood 🎵",
  "Photo dump: one frame from your day",
  "Unpopular opinion — go.",
  "What are you grinding on right now?",
  "Tag someone who always makes you laugh",
  "Best meal you had this week 🔥",
  "If Twyn had a party tonight, what’s the vibe?",
  "One game you’d 1v1 anyone in",
  "Say something kind to the Lounge",
  "What’s your main character moment today?",
  "Drop a hot take about social media",
  "Show your setup / lock screen",
  "Who’s your Member of the Week pick?",
  "What should Twyn build next?"
];

function getDailyPrompt() {
  const day = Math.floor(Date.now() / 86400000);
  return DAILY_PROMPTS[day % DAILY_PROMPTS.length];
}

function renderDailyPrompt() {
  const el = document.getElementById("dailyPromptText");
  if (el) el.textContent = getDailyPrompt();
}

/* ========== MEMBER OF THE WEEK ========== */
let memberOfWeekId = null;

async function loadMemberOfWeek() {
  try {
    const { data } = await supabaseClient
      .from("app_settings")
      .select("value")
      .eq("key", "member_of_week")
      .maybeSingle();
    memberOfWeekId = data?.value || null;
  } catch {
    memberOfWeekId = null;
  }
  renderMotwBanner();
}

async function renderMotwBanner() {
  const banner = document.getElementById("motwBanner");
  if (!banner) return;
  if (!memberOfWeekId) {
    banner.classList.add("hidden");
    return;
  }
  try {
    const { data: p } = await supabaseClient
      .from("profiles")
      .select("id, username, display_name, avatar_url, is_verified, is_og")
      .eq("id", memberOfWeekId)
      .maybeSingle();
    if (!p) {
      banner.classList.add("hidden");
      return;
    }
    const name = p.display_name || "Twyn member";
    banner.classList.remove("hidden");
    banner.innerHTML = `
      <div class="avatar" style="width:40px;height:40px">${p.avatar_url ? `<img src="${escapeAttribute(p.avatar_url)}" alt="">` : escapeHTML(name.charAt(0))}</div>
      <div>
        <strong>⭐ Member of the week</strong>
        <span>${escapeHTML(name)} ${nameBadges({ isVerified: isVerifiedProfile(p), isOg: !!p.is_og, isMotw: true })} · @${escapeHTML(p.username || "")}</span>
      </div>`;
    banner.onclick = () => openUserProfile(p.id);
  } catch {
    banner.classList.add("hidden");
  }
}

function isOgProfile(p) {
  if (!p) return false;
  if (p.is_og) return true;
  return false;
}



function getInviteLink() {
  const base = location.origin + location.pathname.replace(/index\.html$/i, "");
  const clean = base.endsWith("/") ? base : base + "/";
  const ref = state.profile?.username || currentUser?.id?.slice(0, 8) || "twyn";
  return `${clean}?ref=${encodeURIComponent(ref)}`;
}

async function shareInviteLink() {
  const link = getInviteLink();
  try {
    if (navigator.share) {
      await navigator.share({
        title: "Join me on Twyn",
        text: "Come hang on Twyn — social, reimagined.",
        url: link
      });
      return;
    }
  } catch {}
  try {
    await navigator.clipboard.writeText(link);
    alert("Invite link copied!\n" + link);
  } catch {
    prompt("Copy this invite link:", link);
  }
}

function haptic(ms = 12) {
  try {
    if (navigator.vibrate) navigator.vibrate(ms);
  } catch {}
}

function popEl(el) {
  if (!el) return;
  el.classList.remove("pop");
  void el.offsetWidth;
  el.classList.add("pop");
  setTimeout(() => el.classList.remove("pop"), 400);
}

function withCloudName(name, hasCloud) {
  const base = String(name || "Twyn User").replace(/\s*☁️\s*/g, " ").trim();
  return hasCloud ? `${base} ☁️` : base;
}

function detectCloudMark(name) {
  return /☁️/.test(String(name || ""));
}

function formatPresence(lastSeenAt) {
  if (!lastSeenAt) return { text: "Offline", online: false };
  const t = new Date(lastSeenAt).getTime();
  if (Number.isNaN(t)) return { text: "Offline", online: false };
  const diff = Date.now() - t;
  if (diff < 2 * 60 * 1000) return { text: "Online", online: true };
  if (diff < 60 * 60 * 1000) {
    const m = Math.max(1, Math.floor(diff / 60000));
    return { text: `Active ${m}m ago`, online: false };
  }
  if (diff < 24 * 60 * 60 * 1000) {
    const h = Math.floor(diff / 3600000);
    return { text: `Active ${h}h ago`, online: false };
  }
  return { text: `Active ${formatPostTime(lastSeenAt)}`, online: false };
}

async function bumpLastSeen() {
  if (!currentUser) return;
  try {
    await supabaseClient
      .from("profiles")
      .update({ last_seen_at: new Date().toISOString() })
      .eq("id", currentUser.id);
  } catch {}
}

function startPresenceHeartbeat() {
  bumpLastSeen();
  if (state.presenceTimer) clearInterval(state.presenceTimer);
  state.presenceTimer = setInterval(bumpLastSeen, 45000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") bumpLastSeen();
  });
}

/* ========== ONBOARDING ========== */
function hasFinishedOnboarding() {
  try {
    return localStorage.getItem("twyn_onboarding_done") === "1";
  } catch {
    return false;
  }
}

function setOnboardingDone() {
  state.onboardingDone = true;
  try {
    localStorage.setItem("twyn_onboarding_done", "1");
  } catch {}
}

function showOnboarding() {
  const el = document.getElementById("onboardingScreen");
  if (el) el.classList.remove("hidden");
  const nameInput = document.getElementById("obName");
  if (nameInput) nameInput.value = state.profile.name || "";
  goOnboardingStep(0);
}

function hideOnboarding() {
  document.getElementById("onboardingScreen")?.classList.add("hidden");
}

function goOnboardingStep(step) {
  document.querySelectorAll(".ob-step").forEach((s) => {
    s.classList.toggle("active", Number(s.dataset.obStep) === step);
  });
  document.querySelectorAll(".ob-dot").forEach((d) => {
    d.classList.toggle("active", Number(d.dataset.obDot) === step);
  });
}

let onboardingStep = 0;

document.querySelectorAll("[data-ob-next]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    if (onboardingStep === 1) {
      const displayName = document.getElementById("obName")?.value.trim() || state.profile.name || "Twyn User";
      try {
        if (currentUser) {
          await supabaseClient
            .from("profiles")
            .update({ display_name: displayName })
            .eq("id", currentUser.id);
          await loadCurrentProfile();
        }
      } catch (err) {
        console.error(err);
      }
    }
    onboardingStep = Math.min(2, onboardingStep + 1);
    goOnboardingStep(onboardingStep);
  });
});

document.getElementById("obEnablePush")?.addEventListener("click", async () => {
  await enablePushNotifications({ silent: false });
  setOnboardingDone();
  hideOnboarding();
});

document.getElementById("obFinish")?.addEventListener("click", () => {
  setOnboardingDone();
  hideOnboarding();
});


/* ========== WEB PUSH ========== */
const VAPID_PUBLIC_KEY = "BLyUWkcD66kcJdVj_Mc-5ieor09wDli0cnQGPJHKvl0ocbRXyFeSfwLMUS2yRBQ19Q7gGLtJpUAuib-8JBgrhYs";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function enablePushNotifications(options = {}) {
  const silent = !!options.silent;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    if (!silent) alert("Push notifications are not supported on this browser/device.");
    return false;
  }
  if (!currentUser) return false;
  if (!VAPID_PUBLIC_KEY) {
    console.warn("VAPID_PUBLIC_KEY missing");
    return false;
  }

  try {
    // If already denied, never prompt again — browsers block it
    if (typeof Notification !== "undefined" && Notification.permission === "denied") {
      if (!silent) {
        alert(
          "Notifications are blocked for Twyn on this device.\n\n" +
          "iPhone: Settings → Notifications → Twyn → Allow\n" +
          "or delete Home Screen app, clear site data, re-add, then Allow.\n\n" +
          "Android: Chrome site settings → Notifications → Allow"
        );
      }
      return false;
    }

    const permission =
      Notification.permission === "granted"
        ? "granted"
        : await Notification.requestPermission();

    if (permission !== "granted") {
      if (!silent) alert("Notification permission was denied.");
      return false;
    }

    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      });
    }

    const json = sub.toJSON();
    const endpoint = json.endpoint;
    const p256dh = json.keys && json.keys.p256dh;
    const auth = json.keys && json.keys.auth;
    if (!endpoint || !p256dh || !auth) throw new Error("Invalid push subscription");

    const { error } = await supabaseClient.from("push_subscriptions").upsert(
      {
        user_id: currentUser.id,
        endpoint,
        p256dh,
        auth
      },
      { onConflict: "user_id,endpoint" }
    );
    if (error) throw error;

    state.settings.notifPush = true;
    saveSettingsToStorage();
    const el = document.getElementById("settingNotifPush");
    if (el) el.checked = true;
    return true;
  } catch (err) {
    console.error("Push enable error:", err);
    if (!silent) {
      alert(err.message || "Could not enable push notifications. Did you create the push_subscriptions table?");
    }
    return false;
  }
}

async function disablePushNotifications() {
  try {
    if ("serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        const endpoint = sub.endpoint;
        await sub.unsubscribe();
        if (currentUser) {
          await supabaseClient
            .from("push_subscriptions")
            .delete()
            .eq("user_id", currentUser.id)
            .eq("endpoint", endpoint);
        }
      }
    }
  } catch (err) {
    console.error("Push disable error:", err);
  }
  state.settings.notifPush = false;
  saveSettingsToStorage();
}

async function sendPushToUser(userId, title, body, url = "./") {
  if (!userId || !currentUser) return;
  if (String(userId) === String(currentUser.id)) return;
  try {
    const { data: sessionData } = await supabaseClient.auth.getSession();
    const token = sessionData?.session?.access_token;
    if (!token) return;

    const fnUrl = "https://zzcyrznqxunmgivpqryi.supabase.co/functions/v1/send-push";
    const anonKey =
      supabaseClient.supabaseKey ||
      (typeof SUPABASE_ANON_KEY !== "undefined" ? SUPABASE_ANON_KEY : null) ||
      token;

    await fetch(fnUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        apikey: anonKey
      },
      body: JSON.stringify({
        user_id: userId,
        title: title || "Twyn",
        body: body || "You have a new notification",
        url: url || "./"
      })
    });
  } catch (err) {
    console.error("sendPushToUser", err);
  }
}


/* ========== SKELETON HELPERS ========== */
function createSkeletonPost() {
  return `
    <div class="skeleton-post">
      <div class="skeleton-header">
        <div class="skeleton skeleton-avatar"></div>
        <div class="skeleton-lines">
          <div class="skeleton skeleton-line short"></div>
          <div class="skeleton skeleton-line medium" style="width:55%"></div>
        </div>
      </div>
      <div class="skeleton skeleton-line long"></div>
      <div class="skeleton skeleton-line medium"></div>
      <div class="skeleton skeleton-media"></div>
      <div class="skeleton-actions">
        <div class="skeleton skeleton-action"></div>
        <div class="skeleton skeleton-action"></div>
        <div class="skeleton skeleton-action"></div>
        <div class="skeleton skeleton-action"></div>
      </div>
    </div>
  `;
}
function showFeedSkeleton(count = 4) {
  if (!feed) return;
  feed.innerHTML = Array(count).fill(0).map(() => createSkeletonPost()).join("");
}
function showProfileSkeleton() {
  if (!profileFeed) return;
  profileFeed.innerHTML = Array(3).fill(0).map(() => createSkeletonPost()).join("");
}
function showFriendsSkeleton() {
  if (!friendsContent) return;
  friendsContent.innerHTML = `
    <div class="skeleton-post"><div class="skeleton-header"><div class="skeleton skeleton-avatar"></div><div class="skeleton-lines"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line medium" style="width:40%"></div></div></div></div>
    <div class="skeleton-post"><div class="skeleton-header"><div class="skeleton skeleton-avatar"></div><div class="skeleton-lines"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line medium" style="width:50%"></div></div></div></div>
    <div class="skeleton-post"><div class="skeleton-header"><div class="skeleton skeleton-avatar"></div><div class="skeleton-lines"><div class="skeleton skeleton-line short"></div><div class="skeleton skeleton-line medium" style="width:35%"></div></div></div></div>
  `;
}

/* ========== STORAGE ========== */
async function uploadToStorage(file, folder = "posts") {
  if (!file || !currentUser) return null;
  const fileExt = file.name?.split(".").pop() || (file.type?.includes("audio") ? "webm" : "jpg");
  const fileName = `${folder}/${currentUser.id}/${Date.now()}.${fileExt}`;
  const { error } = await supabaseClient.storage.from("media").upload(fileName, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (error) {
    console.error("Upload error:", error);
    throw error;
  }
  const { data: urlData } = supabaseClient.storage.from("media").getPublicUrl(fileName);
  return urlData.publicUrl;
}

/* ========== AUTH HELPERS ========== */
function showAuth() {
  if (authScreen) authScreen.classList.remove("hidden");
  if (twynApp) twynApp.style.display = "none";
}
function showApp() {
  if (authScreen) authScreen.classList.add("hidden");
  if (twynApp) twynApp.style.display = "block";
}
function setAuthMessage(message, type = "") {
  if (!authMessage) return;
  authMessage.textContent = message || "";
  authMessage.className = "auth-message";
  if (type) authMessage.classList.add(type);
}
function updateAuthMode() {
  if (!authTitle) return;
  if (authMode === "signup") {
    authTitle.textContent = "Welcome to Twyn";
    authSubtitle.textContent = "Create your account and join Twyn.";
    nameField?.classList.remove("hidden");
    if (authName) authName.required = true;
    authSubmit.textContent = "Create account";
    authSwitchText.textContent = "Already have an account?";
    authSwitchBtn.textContent = "Log in";
  } else {
    authTitle.textContent = "Welcome back";
    authSubtitle.textContent = "Log in to continue to Twyn.";
    nameField?.classList.add("hidden");
    if (authName) authName.required = false;
    authSubmit.textContent = "Log in";
    authSwitchText.textContent = "Don't have an account?";
    authSwitchBtn.textContent = "Create account";
  }
}
if (authSwitchBtn) {
  authSwitchBtn.addEventListener("click", () => {
    authMode = authMode === "signup" ? "login" : "signup";
    setAuthMessage("");
    authForm?.reset();
    updateAuthMode();
  });
}
function createUsername(name) {
  return String(name || "").toLowerCase().trim().replace(/[^a-z0-9_]/g, "").slice(0, 20) || "twynuser";
}

/* ========== AUTH FORM ========== */
if (authForm) {
  authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const email = authEmail?.value.trim();
    const password = authPassword?.value || "";
    const name = authName?.value.trim() || "";

    if (!email || !password) {
      setAuthMessage("Enter your email and password.", "error");
      return;
    }
    if (authMode === "signup" && !name) {
      setAuthMessage("Enter your display name.", "error");
      return;
    }
    if (password.length < 6) {
      setAuthMessage("Password must be at least 6 characters.", "error");
      return;
    }

    authSubmit.disabled = true;
    setAuthMessage(authMode === "signup" ? "Creating your account..." : "Logging you in...");

    try {
      if (authMode === "signup") {
        const result = await twynSignUp(email, password, name);
        if (!result?.success) {
          setAuthMessage(result?.error || "Unable to create your account.", "error");
          return;
        }
        if (result.user) {
          const username = createUsername(name);
          await supabaseClient.auth.updateUser({ data: { display_name: name, username } });
        }
        if (!result.session) {
          setAuthMessage("Account created. Check your email to confirm your account.", "success");
          return;
        }
        currentUser = result.user;
        await ensureProfile();
        await loadCurrentProfile();
        showApp();
        await loadTwynData();
        startPresenceHeartbeat();
        if (!hasFinishedOnboarding()) showOnboarding();
        setAuthMessage("");
        return;
      }

      const result = await twynLogin(email, password);
      if (!result?.success) {
        setAuthMessage(result?.error || "Unable to log in.", "error");
        return;
      }
      currentUser = result.user;
      await ensureProfile();
      await loadCurrentProfile();
      await ensureTommyyVerified();
      showApp();
      await loadTwynData();
      startPresenceHeartbeat();
      if (!hasFinishedOnboarding()) showOnboarding();
      if (state.settings.notifPush) {
        if (typeof Notification !== "undefined" && Notification.permission === "denied") {
          state.settings.notifPush = false;
          saveSettingsToStorage();
        } else {
          enablePushNotifications({ silent: true }).catch(() => {});
        }
      }
      setAuthMessage("");
    } catch (error) {
      console.error("Twyn auth error:", error);
      setAuthMessage(error?.message || "Something went wrong. Try again.", "error");
    } finally {
      authSubmit.disabled = false;
    }
  });
}

/* ========== PROFILE ========== */
async function ensureProfile() {
  if (!currentUser) return null;
  const { data: existingProfile, error: profileError } = await supabaseClient
    .from("profiles")
    .select("id")
    .eq("id", currentUser.id)
    .maybeSingle();
  if (profileError) {
    console.error("Profile check error:", profileError);
    return null;
  }
  if (existingProfile) return existingProfile;

  const metadata = currentUser.user_metadata || {};
  const displayName = metadata.display_name || (currentUser.email ? currentUser.email.split("@")[0] : "Twyn User");
  const baseUsername = metadata.username || createUsername(displayName);
  const username = `${baseUsername}_${currentUser.id.slice(0, 6)}`;

  let shouldVerify = false;
  try {
    const { count } = await supabaseClient
      .from("profiles")
      .select("*", { count: "exact", head: true });
    shouldVerify = (count || 0) < 10;
  } catch {
    shouldVerify = false;
  }

  const { data, error } = await supabaseClient
    .from("profiles")
    .insert({
      id: currentUser.id,
      username,
      display_name: displayName,
      bio: "Building. Creating. Sharing.",
      is_verified: shouldVerify
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") return null;
    console.error("Profile creation error:", error);
    return null;
  }
  // Early members get OG (first 50)
  try {
    const { count } = await supabaseClient.from("profiles").select("id", { count: "exact", head: true });
    if ((count || 0) <= 50) {
      await supabaseClient.from("profiles").update({ is_og: true }).eq("id", currentUser.id);
    }
  } catch {}
  // Announce in Lounge
  try {
    await announceLoungeJoin(displayName);
  } catch {}
  return data;
}

async function loadCurrentProfile() {
  if (!currentUser) return;
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();
  if (error) {
    console.error("Profile load error:", error);
    return;
  }
  if (!data) {
    await ensureProfile();
    const retry = await supabaseClient.from("profiles").select("*").eq("id", currentUser.id).maybeSingle();
    if (retry.error || !retry.data) return;
    setProfileState(retry.data);
    return;
  }
  setProfileState(data);
}


async function ensureTommyyVerified() {
  if (!currentUser) return;
  const u = state.profile?.username || "";
  if (!isTommyyUsername(u)) return;
  if (state.profile.is_verified) return;
  try {
    await supabaseClient.from("profiles").update({ is_verified: true }).eq("id", currentUser.id);
    state.profile.is_verified = true;
    updateProfileUI();
  } catch {}
}

function isTommyyUsername(username) {
  return String(username || "").toLowerCase().replace(/^@/, "") === "tommyy";
}

function isVerifiedProfile(data) {
  if (!data) return false;
  if (isTommyyUsername(data.username)) return true;
  return !!data.is_verified;
}

function setProfileState(data) {
  const displayName = data.display_name || "Twyn User";
  state.profile = {
    name: displayName,
    username: data.username || "twynuser",
    bio: data.bio || "",
    avatar_url: data.avatar_url || null,
    cover_url: data.cover_url || null,
    is_verified: isVerifiedProfile(data),
    is_og: !!data.is_og,
    last_seen_at: data.last_seen_at || null
  };
  updateProfileUI();
}

function updateProfileUI() {
  const name = state.profile.name || "Twyn User";
  const username = state.profile.username || "twynuser";
  const bio = state.profile.bio || "";
  const avatar = name.charAt(0).toUpperCase() || "T";

  const setAvatar = (el) => {
    if (!el) return;
    if (state.profile.avatar_url) {
      el.innerHTML = `<img src="${escapeAttribute(state.profile.avatar_url)}" alt="${escapeAttribute(name)}">`;
    } else {
      el.textContent = avatar;
    }
  };

  const profileName = document.getElementById("profileName");
  const profileUsername = document.getElementById("profileUsername");
  const profileBio = document.getElementById("profileBio");
  if (profileName) {
    profileName.innerHTML = `${escapeHTML(name)}${nameBadges({ isVerified: state.profile.is_verified, isOg: state.profile.is_og, isMotw: memberOfWeekId && String(memberOfWeekId) === String(currentUser?.id) })}`;
  }
  if (profileUsername) profileUsername.textContent = `@${username}`;
  if (profileBio) profileBio.textContent = bio;

  const coverEl = document.getElementById("profileCover");
  if (coverEl) {
    if (state.profile.cover_url) {
      coverEl.classList.add("has-image");
      coverEl.innerHTML = `<img src="${escapeAttribute(state.profile.cover_url)}" alt="Cover">`;
    } else {
      coverEl.classList.remove("has-image");
      coverEl.innerHTML = "";
    }
  }

  const coverPreview = document.getElementById("editCoverPreview");
  if (coverPreview) {
    if (state.profile.cover_url) {
      coverPreview.innerHTML = `<img src="${escapeAttribute(state.profile.cover_url)}" alt="Cover">`;
    } else {
      coverPreview.innerHTML = "";
    }
  }

  setAvatar(document.getElementById("profileAvatar"));
  setAvatar(document.getElementById("createAvatar"));
  setAvatar(document.querySelector(".mini-avatar"));
  setAvatar(document.getElementById("editAvatarPreview"));

  const createName = document.getElementById("createName");
  const createUsername = document.getElementById("createUsername");
  if (createName) createName.textContent = name;
  if (createUsername) createUsername.textContent = `@${username}`;

  const editName = document.getElementById("editName");
  const editUsername = document.getElementById("editUsername");
  const editBio = document.getElementById("editBio");
  if (editName) editName.value = name;
  if (editUsername) editUsername.value = username;
  if (editBio) editBio.value = bio;

  const presenceEl = document.getElementById("profilePresence");
  if (presenceEl) {
    const p = formatPresence(new Date().toISOString());
    presenceEl.textContent = "Online";
    presenceEl.classList.add("is-online");
  }
}


/* ========== OTHER USER PROFILE ========== */
async function openUserProfile(userId) {
  if (!userId || !currentUser) return;
  if (String(userId) === String(currentUser.id)) {
    document.querySelector('[data-page="profilePage"]')?.click();
    return;
  }

  state.viewingUserId = userId;
  closeChatUI();

  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById("otherProfilePage")?.classList.add("active");
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));

  const nameEl = document.getElementById("otherProfileName");
  const userEl = document.getElementById("otherProfileUsername");
  const bioEl = document.getElementById("otherProfileBio");
  const avatarEl = document.getElementById("otherProfileAvatar");
  const coverEl = document.getElementById("otherProfileCover");
  const feedEl = document.getElementById("otherProfileFeed");
  const followBtn = document.getElementById("otherFollowBtn");

  if (feedEl) feedEl.innerHTML = `<div class="empty-state"><span>Loading profile...</span></div>`;

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, cover_url, is_verified, last_seen_at")
    .eq("id", userId)
    .maybeSingle();

  if (error || !profile) {
    if (feedEl) {
      feedEl.innerHTML = `<div class="empty-state"><strong>User not found</strong><span>This profile may not exist.</span></div>`;
    }
    return;
  }

  const name = profile.display_name || "Twyn User";
  const username = profile.username || "user";

  if (nameEl) nameEl.innerHTML = `${escapeHTML(name)}${verifiedBadge(!!profile.is_verified)}`;
  if (userEl) userEl.textContent = `@${username}`;
  if (bioEl) bioEl.textContent = profile.bio || "";

  const presenceEl = document.getElementById("otherProfilePresence");
  if (presenceEl) {
    const p = formatPresence(profile.last_seen_at);
    presenceEl.innerHTML = p.online
      ? `<span class="presence-dot"></span> Online`
      : escapeHTML(p.text);
    presenceEl.classList.toggle("is-online", p.online);
  }

  if (avatarEl) {
    if (profile.avatar_url) {
      avatarEl.innerHTML = `<img src="${escapeAttribute(profile.avatar_url)}" alt="">`;
    } else {
      avatarEl.textContent = name.charAt(0).toUpperCase();
    }
  }

  if (coverEl) {
    if (profile.cover_url) {
      coverEl.classList.add("has-image");
      coverEl.innerHTML = `<img src="${escapeAttribute(profile.cover_url)}" alt="Cover">`;
    } else {
      coverEl.classList.remove("has-image");
      coverEl.innerHTML = "";
    }
  }

  let person = state.people.find((p) => String(p.id) === String(userId));
  let isFollowing = person ? person.following : false;
  if (!person) {
    const { data: frow } = await supabaseClient
      .from("follows")
      .select("id")
      .eq("follower_id", currentUser.id)
      .eq("following_id", userId)
      .maybeSingle();
    isFollowing = !!frow;
  }

  if (followBtn) {
    followBtn.textContent = isFollowing ? "Following" : "Follow";
    followBtn.classList.toggle("following", isFollowing);
    followBtn.onclick = async () => {
      followBtn.disabled = true;
      try {
        if (isFollowing) {
          await supabaseClient.from("follows").delete().eq("follower_id", currentUser.id).eq("following_id", userId);
          isFollowing = false;
          if (person) person.following = false;
        } else {
          await supabaseClient.from("follows").insert({ follower_id: currentUser.id, following_id: userId });
          isFollowing = true;
          if (person) person.following = true;
          haptic(18);
          popEl(followBtn);
          sendPushToUser(
            userId,
            "Twyn",
            `${state.profile.name || "Someone"} started following you`
          );
        }
        followBtn.textContent = isFollowing ? "Following" : "Follow";
        followBtn.classList.toggle("following", isFollowing);
        await loadFollowers();
        await loadFollowCounts();
        await loadPeople();
      } catch (err) {
        alert(err.message || "Unable to follow");
      } finally {
        followBtn.disabled = false;
      }
    };
  }

  const msgBtn = document.getElementById("otherMessageBtn");
  if (msgBtn) {
    msgBtn.onclick = () => {
      document.querySelector('[data-page="inboxPage"]')?.click();
      document.querySelector('[data-inbox="messages"]')?.click();
      setTimeout(() => openChat(userId), 200);
    };
  }

  const { count: postCount } = await supabaseClient
    .from("posts")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);
  const { count: followers } = await supabaseClient
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", userId);
  const { count: following } = await supabaseClient
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", userId);

  const pc = document.getElementById("otherPostCount");
  const fc = document.getElementById("otherFollowerCount");
  const fg = document.getElementById("otherFollowingCount");
  if (pc) pc.textContent = postCount || 0;
  if (fc) fc.textContent = followers || 0;
  if (fg) fg.textContent = following || 0;

  const { data: posts } = await supabaseClient
    .from("posts")
    .select("id, user_id, content, image_url, world, created_at, likes(user_id), comments(id), saved_posts(user_id)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (!feedEl) return;
  feedEl.innerHTML = "";
  if (!posts || !posts.length) {
    feedEl.innerHTML = `<div class="empty-state"><strong>No posts yet</strong><span>This user hasn't posted anything.</span></div>`;
    return;
  }

  posts.forEach((post) => {
    const likes = post.likes || [];
    const comments = post.comments || [];
    const saved = post.saved_posts || [];
    const item = {
      id: post.id,
      userId: post.user_id,
      user: name,
      username,
      avatar: name.charAt(0).toUpperCase(),
      avatarUrl: profile.avatar_url || null,
      isVerified: isVerifiedProfile(profile),
      text: post.content || "",
      image: post.image_url || null,
      world: post.world || "general",
      likes: likes.length,
      comments: comments.length,
      commentData: [],
      shares: 0,
      saves: saved.length,
      reach: 0,
      liked: likes.some((l) => l.user_id === currentUser.id),
      saved: saved.some((s) => s.user_id === currentUser.id),
      time: formatPostTime(post.created_at)
    };
    const existingIdx = state.posts.findIndex((p) => String(p.id) === String(item.id));
    if (existingIdx === -1) {
      state.posts.push(item);
    } else {
      const prev = state.posts[existingIdx];
      state.posts[existingIdx] = {
        ...prev,
        ...item,
        commentData: prev.commentData || []
      };
    }
    const live = state.posts.find((p) => String(p.id) === String(item.id)) || item;
    feedEl.appendChild(createPostElement(live));
  });
}

document.getElementById("otherProfileBack")?.addEventListener("click", () => {
  state.viewingUserId = null;
  document.querySelector('[data-page="homePage"]')?.click();
});

/* ========== LOAD EVERYTHING ========== */
async function loadTwynData() {
  loadSettingsFromStorage();
  showFeedSkeleton(4);
  showProfileSkeleton();
  showFriendsSkeleton();

  await loadPosts({ reset: true });
  await Promise.all([loadPeople(), loadFollowers(), loadStories(), loadMemberOfWeek()]);
  await loadNotifications();
  await loadConversations();
  renderDailyPrompt();

  renderCategorySelector();
  renderFeed();
  renderProfile();
  renderFriends();
  renderInbox();
  renderConversations();
  setupRealtime();
}

/* ========== POSTS ========== */

async function recordPostView(postId) {
  if (!currentUser || !postId) return;
  try {
    await supabaseClient.from("post_views").upsert(
      { post_id: postId, user_id: currentUser.id },
      { onConflict: "post_id,user_id", ignoreDuplicates: true }
    );
  } catch {}
}

async function loadReachForPosts(posts) {
  if (!posts?.length) return;
  const ids = posts.map((p) => p.id).filter(Boolean);
  if (!ids.length) return;
  try {
    const { data } = await supabaseClient
      .from("post_views")
      .select("post_id")
      .in("post_id", ids);
    const counts = {};
    (data || []).forEach((row) => {
      counts[row.post_id] = (counts[row.post_id] || 0) + 1;
    });
    posts.forEach((p) => {
      p.reach = counts[p.id] || 0;
    });
  } catch (err) {
    console.error("reach load", err);
  }
}

async function loadPosts({ reset = false } = {}) {
  if (state.isLoadingMore) return;

  if (reset) {
    state.feedPage = 0;
    state.feedHasMore = true;
    state.posts = [];
    showFeedSkeleton(4);
  }

  if (!state.feedHasMore && !reset) return;

  state.isLoadingMore = true;
  updateLoadMoreUI();

  const PAGE_SIZE = 12;
  const from = state.feedPage * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  try {
    let data, error;

    const result = await supabaseClient
      .from("posts")
      .select(`
        id, user_id, content, image_url, world, created_at,
        profiles!user_id (username, display_name, avatar_url, is_verified, is_og),
        likes (user_id),
        comments (
          id, user_id, content, created_at, parent_id,
          profiles!user_id (username, display_name, avatar_url, is_verified, is_og)
        ),
        saved_posts (user_id)
      `)
      .order("created_at", { ascending: false })
      .range(from, to);

    data = result.data;
    error = result.error;

    if (error) {
      console.error("Posts load error:", error);
      const fallback = await supabaseClient
        .from("posts")
        .select(`
          id, user_id, content, image_url, world, created_at,
          profiles!user_id (username, display_name, avatar_url, is_verified, is_og),
          likes (user_id),
          comments (id, user_id, content, created_at, profiles!user_id (username, display_name, avatar_url, is_verified, is_og)),
          saved_posts (user_id)
        `)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (fallback.error) {
        console.error("Posts load error:", fallback.error);
        state.isLoadingMore = false;
        updateLoadMoreUI();
        return;
      }
      data = fallback.data;
    }

    await await processPosts(data || [], reset);

    if (!data || data.length < PAGE_SIZE) state.feedHasMore = false;
    else state.feedPage += 1;
  } catch (err) {
    console.error("loadPosts error:", err);
  } finally {
    state.isLoadingMore = false;
    updateLoadMoreUI();
  }
}

async function processPosts(data, reset = false) {
  const newPosts = (data || []).map((post) => {
    const likes = post.likes || [];
    const comments = post.comments || [];
    const savedPosts = post.saved_posts || [];
    const liked = likes.some((item) => item.user_id === currentUser?.id);
    const saved = savedPosts.some((item) => item.user_id === currentUser?.id);
    const displayName = post.profiles?.display_name || "Twyn User";

    return {
      id: post.id,
      userId: post.user_id,
      user: displayName,
      username: post.profiles?.username || "twynuser",
      avatar: displayName.charAt(0).toUpperCase() || "T",
      avatarUrl: post.profiles?.avatar_url || null,
      isVerified: isVerifiedProfile(post.profiles),
      isOg: !!(post.profiles && post.profiles.is_og),
      isMotw: memberOfWeekId && post.profiles && String(post.profiles.id || post.user_id) === String(memberOfWeekId),
      text: post.content || "",
      image: post.image_url || null,
      world: post.world || "general",
      likes: likes.length,
      comments: comments.length,
      commentData: comments,
      shares: 0,
      saves: savedPosts.length,
      reach: 0,
      liked,
      saved,
      time: formatPostTime(post.created_at)
    };
  });

  if (reset) state.posts = newPosts;
  else {
    const existingIds = new Set(state.posts.map((p) => p.id));
    state.posts = [...state.posts, ...newPosts.filter((p) => !existingIds.has(p.id))];
  }

  await loadReachForPosts(state.posts);
  state.posts.forEach((p) => {
    if (currentUser && String(p.userId) !== String(currentUser.id)) {
      recordPostView(p.id);
    }
  });
}

function formatPostTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString();
}

function updateLoadMoreUI() {
  const loader = document.getElementById("feedLoader");
  if (!loader) return;
  if (state.isLoadingMore) {
    loader.textContent = "Loading more posts...";
    loader.classList.remove("hidden");
  } else if (!state.feedHasMore && state.posts.length > 0) {
    loader.textContent = "You're all caught up";
    loader.classList.remove("hidden");
  } else {
    loader.classList.add("hidden");
  }
}

let scrollTimeout = null;
window.addEventListener("scroll", () => {
  if (scrollTimeout) clearTimeout(scrollTimeout);
  scrollTimeout = setTimeout(() => {
    const homePage = document.getElementById("homePage");
    if (!homePage || !homePage.classList.contains("active")) return;
    if (state.isLoadingMore || !state.feedHasMore) return;
    const scrollPosition = window.innerHeight + window.scrollY;
    if (scrollPosition >= document.body.offsetHeight - 700) loadMorePosts();
  }, 120);
});

async function loadMorePosts() {
  if (state.isLoadingMore || !state.feedHasMore) return;
  await loadPosts({ reset: false });
  renderFeed();
}

/* ========== CATEGORY ========== */
function renderCategorySelector() {
  document.querySelector(".world-strip")?.remove();
  let selector = document.getElementById("twynCategorySelector");
  if (!selector) {
    selector = document.createElement("select");
    selector.id = "twynCategorySelector";
    selector.className = "twyn-category-select";
    const homeHeader = document.querySelector(".home-header");
    if (homeHeader) homeHeader.appendChild(selector);
    else if (feed?.parentElement) feed.parentElement.insertBefore(selector, feed);
  }
  selector.innerHTML = TWYN_CATEGORIES
    .map((c) => `<option value="${escapeAttribute(c.id)}">${escapeHTML(c.name)}</option>`)
    .join("");
  selector.value = state.activeCategory;
  selector.onchange = async (e) => {
    state.activeCategory = e.target.value;
    showFeedSkeleton(3);
    await loadPosts({ reset: true });
    renderFeed();
  };
}

/* ========== RENDER FEED ========== */

/* ========== SMOOTH IN-PLACE UPDATES (no full feed rebuild) ========== */
function updatePostCardUI(postId) {
  const post = state.posts.find((p) => String(p.id) === String(postId));
  if (!post) return;
  const sid = String(postId);
  document.querySelectorAll("article.post").forEach((card) => {
    if (String(card.dataset.id) !== sid) return;
    const likeBtn = card.querySelector('[data-action="like"]');
    if (likeBtn) {
      likeBtn.classList.toggle("liked", !!post.liked);
      const span = likeBtn.querySelector("span");
      if (span) span.textContent = post.likes;
      else {
        // button text may include emoji + count
        likeBtn.innerHTML = `${post.liked ? "♥" : "♡"} <span>${post.likes}</span>`;
      }
    }
    const commentBtn = card.querySelector('[data-action="comment"]');
    if (commentBtn) {
      const span = commentBtn.querySelector("span");
      if (span) span.textContent = post.comments;
    }
    const saveBtn = card.querySelector('[data-action="save"]');
    if (saveBtn) {
      saveBtn.classList.toggle("saved", !!post.saved);
      saveBtn.innerHTML = `${post.saved ? "✓" : "♧"}`;
    }
    const reach = card.querySelector(".post-time");
    if (reach && typeof post.reach === "number") {
      reach.textContent = `${post.reach.toLocaleString()} reach`;
    }
    // comments open state
    const cbox = card.querySelector("[data-comments-for]");
    if (cbox && String(cbox.getAttribute("data-comments-for")) === sid) {
      const open = state.openComments.has(sid);
      cbox.classList.toggle("hidden", !open);
      if (open) {
        const list = cbox.querySelector(".comments-list");
        if (list) list.innerHTML = renderCommentsHTML(post);
      }
    }
  });
}

function softRefreshFeed() {
  // Only rebuild if feed is empty / first load
  if (!feed || !feed.children.length) {
    renderFeed();
    return;
  }
  // Prefer in-place for known posts; full render only when structure changed
  renderFeed();
}

function renderFeed() {
  if (!feed) return;
  feed.innerHTML = "";

  let posts = state.posts;
  if (state.activeCategory && state.activeCategory !== "typ") {
    posts = posts.filter(
      (p) => String(p.world || "general").toLowerCase() === state.activeCategory.toLowerCase()
    );
  }

  if (!posts.length) {
    const isFiltered = state.activeCategory && state.activeCategory !== "typ";
    feed.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${isFiltered ? "🔍" : "📝"}</div>
        <strong>${isFiltered ? "No posts in this category" : "No posts yet"}</strong>
        <span>${isFiltered
          ? "Try switching back to TYP or be the first to post in this world."
          : "Be the first person to share something on Twyn."}</span>
        ${!isFiltered ? `<button class="empty-action" onclick="document.querySelector('[data-page=\\'createPage\\']')?.click()">Create a post</button>` : ""}
      </div>`;
    return;
  }

  posts.forEach((post) => feed.appendChild(createPostElement(post)));
}

function createPostElement(post) {
  const article = document.createElement("article");
  article.className = "post";
  article.dataset.id = String(post.id);
  const showCategory = post.world && !["typ", "general", "all"].includes(post.world);

  article.innerHTML = `
    <div class="post-header">
      <div class="user-info">
        <div class="avatar">
          ${post.avatarUrl
            ? `<img src="${escapeAttribute(post.avatarUrl)}" alt="${escapeAttribute(post.user)}">`
            : escapeHTML(post.avatar)}
        </div>
        <div class="user-details">
          <strong>${escapeHTML(post.user)}${nameBadges({ isVerified: post.isVerified, isOg: post.isOg, isMotw: post.isMotw })}</strong>
          <span>@${escapeHTML(post.username)} · ${escapeHTML(post.time)}</span>
        </div>
      </div>
      <button class="post-menu" data-action="menu" data-id="${escapeAttribute(post.id)}" type="button">•••</button>
    </div>
    ${showCategory ? `<div class="post-category">${escapeHTML(getCategoryName(post.world))}</div>` : ""}
    ${post.text ? `<div class="post-text">${linkifyMentions(post.text)}</div>` : ""}
    ${post.image
      ? `<img class="post-media" src="${escapeAttribute(post.image)}" alt="Post media" loading="lazy">`
      : ""}
    <div class="post-actions">
      <button class="post-action ${post.liked ? "liked" : ""}" data-action="like" data-id="${escapeAttribute(post.id)}" type="button">
        ${post.liked ? "♥" : "♡"} <span>${post.likes}</span>
      </button>
      <button class="post-action" data-action="comment" data-id="${escapeAttribute(post.id)}" type="button">
        💬 <span>${post.comments}</span>
      </button>
      <button class="post-action" data-action="share" data-id="${escapeAttribute(post.id)}" type="button">
        ↗ <span>${post.shares}</span>
      </button>
      <button class="post-action ${post.saved ? "saved" : ""}" data-action="save" data-id="${escapeAttribute(post.id)}" type="button">
        ${post.saved ? "✓" : "♧"}
      </button>
      <span class="post-time">${post.reach.toLocaleString()} reach</span>
    </div>
    <div class="comments-container ${state.openComments.has(String(post.id)) ? "" : "hidden"}" data-comments-for="${escapeAttribute(post.id)}">
      <div class="comments-list">${renderCommentsHTML(post)}</div>
      <div class="comment-form">
        <input type="text" class="comment-input" placeholder="Write a comment..." maxlength="500" data-comment-input="${escapeAttribute(post.id)}">
        <button type="button" class="comment-submit" data-action="submit-comment" data-id="${escapeAttribute(post.id)}">Post</button>
      </div>
    </div>
  `;

  const userInfo = article.querySelector(".user-info");
  if (userInfo) {
    userInfo.addEventListener("click", (e) => {
      if (e.target.closest(".post-menu")) return;
      openUserProfile(post.userId);
    });
  }
  return article;
}

function getCategoryName(id) {
  return TWYN_CATEGORIES.find((c) => c.id === id)?.name || "TYP";
}

function refreshPostViews() {
  renderFeed();
  renderProfile();
  if (state.viewingUserId) {
    const feedEl = document.getElementById("otherProfileFeed");
    if (!feedEl) return;
    const posts = state.posts.filter((p) => String(p.userId) === String(state.viewingUserId));
    feedEl.innerHTML = "";
    if (!posts.length) {
      feedEl.innerHTML = `<div class="empty-state"><strong>No posts yet</strong><span>This user hasn't posted anything.</span></div>`;
      return;
    }
    posts.forEach((p) => feedEl.appendChild(createPostElement(p)));
  }
}


/* ========== COMMENTS ========== */
function getAllDescendantReplies(parentId, allComments) {
  const result = [];
  const queue = allComments.filter((c) => String(c.parent_id) === String(parentId));
  while (queue.length) {
    const c = queue.shift();
    result.push(c);
    const kids = allComments.filter((x) => String(x.parent_id) === String(c.id));
    queue.push(...kids);
  }
  // chronological
  result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  return result;
}

function renderCommentsHTML(post) {
  const all = post.commentData || [];
  if (!all.length) {
    return `<div class="no-comments">No comments yet. Say something.</div>`;
  }
  const topLevel = all.filter((c) => !c.parent_id);
  if (!topLevel.length) {
    // all are replies without loaded parents — show flat
    return all.map((c) => renderSingleComment(c, post, all, true)).join("");
  }
  return topLevel.map((c) => renderSingleComment(c, post, all, false)).join("");
}

function renderSingleComment(comment, post, allComments, isFlatReply = false) {
  const profile = comment.profiles || {};
  const name = profile.display_name || "Twyn User";
  const username = profile.username || "twynuser";
  const avatar = name.charAt(0).toUpperCase();
  const isVerified = isVerifiedProfile(profile);
  const likes = comment.likes || comment.comment_likes || [];
  const likedByMe = likes.some((l) => String(l.user_id) === String(currentUser?.id));
  const isMine = currentUser && String(comment.user_id) === String(currentUser.id);
  const replyKey = `reply-${comment.id}`;
  const threadKey = `thread-${comment.id}`;

  // ALL nested replies flattened under this top-level comment (IG style — one indent only)
  const flatReplies = isFlatReply ? [] : getAllDescendantReplies(comment.id, allComments);
  const repliesOpen = state.openReplyThreads.has(threadKey);

  const deleteBtn = isMine
    ? `<button class="comment-delete-btn" data-action="delete-comment" data-comment-id="${escapeAttribute(comment.id)}" data-post-id="${escapeAttribute(post.id)}" type="button">Delete</button>`
    : "";

  let repliesBlock = "";
  if (!isFlatReply && flatReplies.length) {
    if (repliesOpen) {
      repliesBlock = `
        <div class="replies">
          ${flatReplies.map((r) => renderSingleComment(r, post, allComments, true)).join("")}
          <button type="button" class="replies-toggle" data-action="toggle-replies" data-comment-id="${escapeAttribute(comment.id)}" data-post-id="${escapeAttribute(post.id)}">Hide replies</button>
        </div>`;
    } else {
      repliesBlock = `
        <button type="button" class="replies-toggle" data-action="toggle-replies" data-comment-id="${escapeAttribute(comment.id)}" data-post-id="${escapeAttribute(post.id)}">
          View ${flatReplies.length} ${flatReplies.length === 1 ? "reply" : "replies"}
        </button>`;
    }
  }

  return `
    <div class="comment ${isFlatReply ? "comment-reply" : ""}">
      <div class="comment-avatar" data-action="open-profile" data-user-id="${escapeAttribute(comment.user_id || "")}">
        ${profile.avatar_url
          ? `<img src="${escapeAttribute(profile.avatar_url)}" alt="${escapeAttribute(name)}">`
          : escapeHTML(avatar)}
      </div>
      <div class="comment-body">
        <div class="comment-author">
          <strong data-action="open-profile" data-user-id="${escapeAttribute(comment.user_id || "")}">${escapeHTML(name)}${verifiedBadge(isVerified)}</strong>
          <span>@${escapeHTML(username)}</span>
        </div>
        <div class="comment-text">${linkifyMentions(comment.content || "")}</div>
        <div class="comment-meta">
          <span class="comment-time">${formatPostTime(comment.created_at)}</span>
          <button class="comment-like-btn ${likedByMe ? "liked" : ""}" data-action="like-comment" data-comment-id="${escapeAttribute(comment.id)}" data-post-id="${escapeAttribute(post.id)}" type="button">
            ${likedByMe ? "♥" : "♡"} ${likes.length ? likes.length : ""}
          </button>
          <button class="comment-reply-btn" data-action="toggle-reply" data-comment-id="${escapeAttribute(comment.id)}" data-post-id="${escapeAttribute(post.id)}" type="button">Reply</button>
          ${deleteBtn}
        </div>
        <div class="reply-form ${state.openReplies.has(replyKey) ? "" : "hidden"}">
          <input type="text" class="reply-input" placeholder="Write a reply..." maxlength="500" data-reply-input="${escapeAttribute(comment.id)}">
          <button type="button" class="reply-submit" data-action="submit-reply" data-comment-id="${escapeAttribute(comment.id)}" data-post-id="${escapeAttribute(post.id)}">Reply</button>
        </div>
        ${repliesBlock}
      </div>
    </div>
  `;
}


/* ========== FEED CLICK HANDLER ========== */
async function handlePostClick(event) {
    const mentionEl = event.target.closest("[data-mention]");
    if (mentionEl) {
      event.preventDefault();
      event.stopPropagation();
      const uname = mentionEl.dataset.mention;
      if (uname) {
        try {
          const { data } = await supabaseClient.from("profiles").select("id").eq("username", uname).maybeSingle();
          if (data?.id) openUserProfile(data.id);
        } catch {}
      }
      return;
    }

    const button = event.target.closest("[data-action]");
    if (!button) return;

    const action = button.dataset.action;
    const id = button.dataset.id || button.dataset.postId;
    const post = state.posts.find((p) => String(p.id) === String(id));

    if (action === "like" && post) {
      if (!currentUser) return alert("Please log in first.");
      button.disabled = true;
      try {
        if (post.liked) {
          await supabaseClient.from("likes").delete().eq("user_id", currentUser.id).eq("post_id", post.id);
          post.liked = false;
          post.likes = Math.max(0, post.likes - 1);
        } else {
          await supabaseClient.from("likes").insert({ user_id: currentUser.id, post_id: post.id });
          post.liked = true;
          post.likes++;
          haptic(15);
          popEl(button);
          if (post.userId && String(post.userId) !== String(currentUser.id)) {
            sendPushToUser(
              post.userId,
              "Twyn",
              `${state.profile.name || "Someone"} liked your post`
            );
          }
        }
        updatePostCardUI(post.id);
        haptic(15);
        popEl(button);
        loadNotifications();
      } catch (err) {
        console.error(err);
        alert(err.message || "Unable to like");
      } finally {
        button.disabled = false;
      }
      return;
    }

    if (action === "comment" && post) {
      const key = String(post.id);
      if (state.openComments.has(key)) {
        state.openComments.delete(key);
        updatePostCardUI(post.id);
      } else {
        state.openComments.add(key);
        await loadPostComments(post);
        updatePostCardUI(post.id);
      }
      return;
    }

    if (action === "submit-comment" && post) {
      await submitComment(post, button);
      return;
    }

    if (action === "share" && post) {
      post.shares++;
      const url = `${location.origin}${location.pathname}#post-${post.id}`;
      try {
        if (navigator.share) await navigator.share({ title: "Twyn", url });
        else if (navigator.clipboard) {
          await navigator.clipboard.writeText(url);
          alert("Link copied");
        } else prompt("Copy link", url);
      } catch {}
      updatePostCardUI(post.id);
      return;
    }

    if (action === "save" && post) {
      if (!currentUser) return alert("Please log in first.");
      button.disabled = true;
      try {
        if (post.saved) {
          await supabaseClient.from("saved_posts").delete().eq("user_id", currentUser.id).eq("post_id", post.id);
          post.saved = false;
          post.saves = Math.max(0, post.saves - 1);
        } else {
          await supabaseClient.from("saved_posts").insert({ user_id: currentUser.id, post_id: post.id });
          post.saved = true;
          post.saves++;
          if (post.userId && String(post.userId) !== String(currentUser.id)) {
            sendPushToUser(
              post.userId,
              "Twyn",
              `${state.profile.name || "Someone"} saved your post`
            );
          }
        }
        updatePostCardUI(post.id);
        popEl(button);
      } catch (err) {
        alert(err.message || "Unable to save");
      } finally {
        button.disabled = false;
      }
      return;
    }

    if (action === "menu" && post) {
      openPostMenu(post);
      return;
    }

    if (action === "like-comment") {
      const commentId = button.dataset.commentId;
      const target = state.posts.find((p) => String(p.id) === String(button.dataset.postId));
      if (target) await toggleCommentLike(target, commentId, button);
      return;
    }

    if (action === "toggle-reply") {
      const key = `reply-${button.dataset.commentId}`;
      if (state.openReplies.has(key)) state.openReplies.delete(key);
      else state.openReplies.add(key);
      const postId =
        button.dataset.postId ||
        id ||
        button.closest(".post")?.dataset?.id;
      if (postId) updatePostCardUI(postId);
      return;
    }

    if (action === "toggle-replies") {
      const key = `thread-${button.dataset.commentId}`;
      if (state.openReplyThreads.has(key)) state.openReplyThreads.delete(key);
      else state.openReplyThreads.add(key);
      const postId =
        button.dataset.postId ||
        id ||
        button.closest(".post")?.dataset?.id;
      if (postId) updatePostCardUI(postId);
      return;
    }

    if (action === "delete-comment") {
      const target = state.posts.find((p) => String(p.id) === String(button.dataset.postId));
      if (target) await deleteComment(target, button.dataset.commentId);
      return;
    }

    if (action === "open-profile") {
      const uid = button.dataset.userId;
      if (uid) openUserProfile(uid);
      return;
    }

    if (action === "submit-reply") {
      const target = state.posts.find((p) => String(p.id) === String(button.dataset.postId));
      if (target) await submitReply(target, button.dataset.commentId, button);
    }
}

if (feed) feed.addEventListener("click", handlePostClick);
if (profileFeed) profileFeed.addEventListener("click", handlePostClick);
document.getElementById("otherProfileFeed")?.addEventListener("click", handlePostClick);

async function loadPostComments(post) {
  let rows = [];
  const withLikes = await supabaseClient
    .from("comments")
    .select(`
      id, post_id, user_id, content, created_at, parent_id,
      profiles!user_id (username, display_name, avatar_url, is_verified, is_og),
      comment_likes (user_id)
    `)
    .eq("post_id", post.id)
    .order("created_at", { ascending: true });

  if (!withLikes.error) {
    rows = withLikes.data || [];
  } else {
    const basic = await supabaseClient
      .from("comments")
      .select(`
        id, post_id, user_id, content, created_at, parent_id,
        profiles!user_id (username, display_name, avatar_url, is_verified, is_og)
      `)
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    rows = basic.data || [];
  }

  // normalize likes array
  rows = rows.map((c) => ({
    ...c,
    likes: c.comment_likes || c.likes || []
  }));

  post.commentData = rows;
  post.comments = rows.filter((c) => !c.parent_id).length;
  // replies stay collapsed until user taps "View replies"
}

async function submitComment(post, button) {
  if (!currentUser) return alert("Please log in first.");
  const input = button.closest(".post")?.querySelector(`[data-comment-input="${CSS.escape(String(post.id))}"]`);
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;

  button.disabled = true;
  button.textContent = "Posting...";
  try {
    const { data, error } = await supabaseClient
      .from("comments")
      .insert({ post_id: post.id, user_id: currentUser.id, content })
      .select(`id, post_id, user_id, content, created_at, parent_id, profiles!user_id (username, display_name, avatar_url, is_verified, is_og)`)
      .single();
    if (error) throw error;
    if (!post.commentData) post.commentData = [];
    post.commentData.push(data);
    post.comments = post.commentData.length;
    state.openComments.add(String(post.id));
    input.value = "";
    updatePostCardUI(post.id);
    loadNotifications();
    await notifyMentions(content, "in a comment");
    if (post.userId && String(post.userId) !== String(currentUser.id)) {
      sendPushToUser(
        post.userId,
        "Twyn",
        `${state.profile.name || "Someone"} commented on your post`
      );
    }
  } catch (err) {
    alert(err.message || "Unable to comment");
  } finally {
    button.disabled = false;
    button.textContent = "Post";
  }
}

async function deleteComment(post, commentId) {
  if (!currentUser) return alert("Please log in first.");
  if (!confirm("Delete this comment?")) return;
  try {
    const { error } = await supabaseClient
      .from("comments")
      .delete()
      .eq("id", commentId)
      .eq("user_id", currentUser.id);
    if (error) throw error;

    const removeIds = new Set([String(commentId)]);
    let changed = true;
    while (changed) {
      changed = false;
      (post.commentData || []).forEach((c) => {
        if (c.parent_id && removeIds.has(String(c.parent_id)) && !removeIds.has(String(c.id))) {
          removeIds.add(String(c.id));
          changed = true;
        }
      });
    }
    post.commentData = (post.commentData || []).filter((c) => !removeIds.has(String(c.id)));
    post.comments = (post.commentData || []).filter((c) => !c.parent_id).length;
    updatePostCardUI(post.id);
  } catch (err) {
    alert(err.message || "Unable to delete comment");
  }
}

async function toggleCommentLike(post, commentId, button) {
  if (!currentUser) return alert("Please log in first.");
  const comment = (post.commentData || []).find((c) => String(c.id) === String(commentId));
  if (!comment) return;
  if (!comment.likes) comment.likes = [];
  const already = comment.likes.some((l) => String(l.user_id) === String(currentUser.id));
  button.disabled = true;
  try {
    if (already) {
      const { error } = await supabaseClient
        .from("comment_likes")
        .delete()
        .eq("user_id", currentUser.id)
        .eq("comment_id", commentId);
      if (error) throw error;
      comment.likes = comment.likes.filter((l) => String(l.user_id) !== String(currentUser.id));
    } else {
      const { error } = await supabaseClient
        .from("comment_likes")
        .insert({ user_id: currentUser.id, comment_id: commentId });
      if (error) throw error;
      comment.likes.push({ user_id: currentUser.id });
      haptic(10);
      popEl(button);
    }
    updatePostCardUI(post.id);
  } catch (err) {
    const msg = err.message || String(err);
    if (/schema cache|Could not find the table|comment_likes/i.test(msg)) {
      alert("Comment likes need a table.\n\nRun the comment_likes SQL in Supabase, then try again.");
    } else {
      alert(msg || "Could not like comment");
    }
  } finally {
    button.disabled = false;
  }
}

async function submitReply(post, parentId, button) {
  if (!currentUser) return alert("Please log in first.");
  const input = button.closest(".post")?.querySelector(`[data-reply-input="${CSS.escape(String(parentId))}"]`);
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;

  button.disabled = true;
  button.textContent = "Replying...";
  try {
    let data;
    const payload = { post_id: post.id, user_id: currentUser.id, content, parent_id: parentId };
    const res = await supabaseClient
      .from("comments")
      .insert(payload)
      .select(`id, post_id, user_id, content, created_at, parent_id, profiles!user_id (username, display_name, avatar_url, is_verified, is_og)`)
      .single();
    if (res.error) {
      delete payload.parent_id;
      const retry = await supabaseClient
        .from("comments")
        .insert(payload)
        .select(`id, post_id, user_id, content, created_at, profiles!user_id (username, display_name, avatar_url, is_verified, is_og)`)
        .single();
      if (retry.error) throw retry.error;
      data = retry.data;
    } else {
      data = res.data;
    }
    if (!post.commentData) post.commentData = [];
    post.commentData.push(data);
    post.comments = post.commentData.length;
    state.openReplies.delete(`reply-${parentId}`);
    state.openReplyThreads.add(`thread-${parentId}`);
    state.openComments.add(String(post.id));
    input.value = "";
    updatePostCardUI(post.id);
    await loadNotifications();
  } catch (err) {
    alert(err.message || "Unable to reply");
  } finally {
    button.disabled = false;
    button.textContent = "Reply";
  }
}

/* ========== POST OPTIONS MENU ========== */
function openPostMenu(post) {
  activePostMenuId = post.id;
  const isOwner = currentUser && String(post.userId) === String(currentUser.id);

  document.getElementById("postOptEdit")?.classList.toggle("hidden", !isOwner);
  document.getElementById("postOptDelete")?.classList.toggle("hidden", !isOwner);
  document.getElementById("postOptReport")?.classList.toggle("hidden", isOwner);

  postOptionsModal?.classList.remove("hidden");
}

function closePostMenu() {
  activePostMenuId = null;
  postOptionsModal?.classList.add("hidden");
}

document.getElementById("postOptionsBackdrop")?.addEventListener("click", closePostMenu);

document.querySelectorAll("[data-post-action]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const action = btn.dataset.postAction;
    const post = state.posts.find((p) => String(p.id) === String(activePostMenuId));
    closePostMenu();
    if (!post && action !== "cancel") return;

    if (action === "edit") openEditPost(post);
    else if (action === "analysis") openAnalysis(post);
    else if (action === "copy") copyPostLink(post);
    else if (action === "delete") deletePost(post);
    else if (action === "report") {
      alert("Thanks — this post was reported. Our team will review it.");
    }
  });
});

async function copyPostLink(post) {
  const url = `${location.origin}${location.pathname}#post-${post.id}`;
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(url);
      alert("Link copied");
      return;
    }
  } catch {}
  prompt("Copy this link:", url);
}

async function deletePost(post) {
  if (!currentUser || String(post.userId) !== String(currentUser.id)) return;
  if (!confirm("Delete this post?")) return;
  const { error } = await supabaseClient.from("posts").delete().eq("id", post.id).eq("user_id", currentUser.id);
  if (error) return alert(error.message);
  state.posts = state.posts.filter((p) => String(p.id) !== String(post.id));
  renderFeed();
  renderProfile();
}

function calculatePulse(post) {
  const eng = post.likes + post.comments * 2 + post.shares * 3 + post.saves * 2;
  const ratio = eng / Math.max(post.reach, 1);
  if (ratio >= 0.1) return "HP";
  if (ratio >= 0.04) return "RP";
  return "LP";
}

function openAnalysis(post) {
  if (!analysisModal) return;
  const eng = post.likes + post.comments + post.shares + post.saves;
  const pulse = calculatePulse(post);
  document.getElementById("pulseStatus").textContent = pulse;
  document.getElementById("analysisEngagement").textContent = eng.toLocaleString();
  document.getElementById("analysisReach").textContent = post.reach.toLocaleString();
  document.getElementById("analysisLikes").textContent = post.likes.toLocaleString();
  document.getElementById("analysisComments").textContent = post.comments.toLocaleString();
  document.getElementById("pulseDescription").textContent = {
    HP: "This post is performing strongly.",
    RP: "This post is gaining momentum.",
    LP: "This post is currently receiving lower engagement."
  }[pulse];
  analysisModal.classList.remove("hidden");
}
document.getElementById("closeAnalysis")?.addEventListener("click", () => analysisModal?.classList.add("hidden"));
analysisModal?.querySelector(".modal-backdrop")?.addEventListener("click", () => analysisModal.classList.add("hidden"));

/* ========== EDIT POST ========== */
function openEditPost(post) {
  if (!post || !currentUser || String(post.userId) !== String(currentUser.id)) return;
  editingPostId = post.id;
  const textarea = document.getElementById("editPostText");
  const preview = document.getElementById("editPostPreview");
  const count = document.getElementById("editPostCount");
  if (textarea) textarea.value = post.text || "";
  if (count) count.textContent = `${(post.text || "").length} / 500`;
  if (preview) {
    preview.innerHTML = post.image
      ? `<img src="${escapeAttribute(post.image)}" alt="Post media">`
      : "";
  }
  editPostModal?.classList.remove("hidden");
}

document.getElementById("closeEditPost")?.addEventListener("click", () => {
  editingPostId = null;
  editPostModal?.classList.add("hidden");
});
document.getElementById("editPostBackdrop")?.addEventListener("click", () => {
  editingPostId = null;
  editPostModal?.classList.add("hidden");
});

document.getElementById("editPostText")?.addEventListener("input", (e) => {
  const count = document.getElementById("editPostCount");
  if (count) count.textContent = `${e.target.value.length} / 500`;
});

document.getElementById("saveEditPost")?.addEventListener("click", async () => {
  if (!currentUser || !editingPostId) return;
  const post = state.posts.find((p) => String(p.id) === String(editingPostId));
  if (!post) return;

  const text = document.getElementById("editPostText")?.value.trim() || "";
  if (!text && !post.image) return alert("Post cannot be empty.");

  const btn = document.getElementById("saveEditPost");
  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    const { error } = await supabaseClient
      .from("posts")
      .update({ content: text })
      .eq("id", post.id)
      .eq("user_id", currentUser.id);
    if (error) throw error;

    post.text = text;
    renderFeed();
    renderProfile();
    editPostModal?.classList.add("hidden");
    editingPostId = null;
  } catch (err) {
    alert(err.message || "Unable to update post.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save";
  }
});

/* ========== CREATE POST ========== */
if (postText) {
  postText.addEventListener("input", () => {
    if (characterCount) characterCount.textContent = `${postText.value.length} / 500`;
  });
}

if (imageInput) {
  imageInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return alert("Please choose an image.");
    if (file.size > 5 * 1024 * 1024) return alert("Image must be under 5MB.");
    selectedImage = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (createPreview) createPreview.innerHTML = `<img src="${escapeAttribute(ev.target.result)}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById("hashtagBtn")?.addEventListener("click", () => {
  const textarea = document.getElementById("postText");
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const value = textarea.value;
  const insert = start === 0 || value[start - 1] === " " || value[start - 1] === "\n" ? "#" : " #";
  textarea.value = value.slice(0, start) + insert + value.slice(end);
  const newPos = start + insert.length;
  textarea.setSelectionRange(newPos, newPos);
  textarea.focus();
  if (characterCount) characterCount.textContent = `${textarea.value.length} / 500`;
});

function createPostCategorySelector() {
  let sel = document.getElementById("postCategory");
  if (sel) return sel;
  sel = document.createElement("select");
  sel.id = "postCategory";
  sel.className = "post-category-select";
  const opts = [
    { id: "general", name: "General (no tag)" },
    ...TWYN_CATEGORIES.filter((c) => c.id !== "typ" && c.id !== "general")
  ];
  sel.innerHTML = opts.map((c) => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("");
  sel.value = "general";
  const card = document.querySelector(".create-card");
  const tools = card?.querySelector(".create-tools");
  if (tools) card.insertBefore(sel, tools);
  else if (card) card.appendChild(sel);
  return sel;
}

document.getElementById("publishBtn")?.addEventListener("click", async () => {
  if (!currentUser) return alert("Please log in first.");
  const text = postText?.value.trim() || "";
  if (!text && !selectedImage) return alert("Write something or add a photo.");
  if (text.length > 500) return alert("Too long.");

  const category = createPostCategorySelector()?.value || "general";
  const btn = document.getElementById("publishBtn");
  btn.disabled = true;
  btn.textContent = "Posting...";

  try {
    let imageUrl = null;
    if (selectedImage) imageUrl = await uploadToStorage(selectedImage, "posts");

    const { data, error } = await supabaseClient
      .from("posts")
      .insert({
        user_id: currentUser.id,
        content: text,
        image_url: imageUrl,
        world: category
      })
      .select()
      .single();
    if (error) throw error;

    await notifyMentions(text, "in a post");

    state.posts.unshift({
      id: data.id,
      userId: currentUser.id,
      user: state.profile.name,
      username: state.profile.username,
      avatar: state.profile.name.charAt(0).toUpperCase(),
      avatarUrl: state.profile.avatar_url,
      isVerified: state.profile.is_verified,
      text: data.content || "",
      image: data.image_url || null,
      world: data.world || category,
      likes: 0,
      comments: 0,
      commentData: [],
      shares: 0,
      saves: 0,
      reach: 0,
      liked: false,
      saved: false,
      time: "now"
    });

    if (postText) postText.value = "";
    selectedImage = null;
    if (imageInput) imageInput.value = "";
    if (createPreview) createPreview.innerHTML = "";
    if (characterCount) characterCount.textContent = "0 / 500";

    renderFeed();
    renderProfile();
    document.querySelector('[data-page="homePage"]')?.click();
  } catch (err) {
    console.error(err);
    alert(err.message || "Unable to post. Make sure the 'media' bucket exists and is public.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Post";
  }
});

/* ========== FRIENDS ========== */
document.querySelectorAll(".friend-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".friend-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    showFriendsSkeleton();
    renderFriends(tab.dataset.tab);
  });
});

async function loadPeople() {
  if (!currentUser) return;
  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, username, display_name, avatar_url, is_verified")
    .neq("id", currentUser.id)
    .limit(100);
  if (error) return console.error(error);

  const { data: followingData } = await supabaseClient
    .from("follows")
    .select("following_id")
    .eq("follower_id", currentUser.id);
  const followingIds = new Set((followingData || []).map((i) => i.following_id));

  state.people = (data || []).map((p) => {
    const name = p.display_name || "Twyn User";
    return {
      id: p.id,
      name,
      username: p.username || "twynuser",
      avatar: name.charAt(0).toUpperCase(),
      avatarUrl: p.avatar_url || null,
      isVerified: isVerifiedProfile(p),
      following: followingIds.has(p.id)
    };
  });
}

async function loadFollowers() {
  if (!currentUser) return;
  const { data, error } = await supabaseClient
    .from("follows")
    .select("follower_id")
    .eq("following_id", currentUser.id);
  state.followers = error ? [] : data || [];
}

function renderFriends(type = "followers") {
  if (!friendsContent) return;
  friendsContent.innerHTML = "";

  let people = [];
  if (type === "following") people = state.people.filter((p) => p.following);
  else if (type === "recommended") people = state.people.filter((p) => !p.following);
  else {
    const ids = new Set(state.followers.map((f) => f.follower_id));
    people = state.people.filter((p) => ids.has(p.id));
  }

  if (!people.length) {
    const messages = {
      followers: { icon: "👥", title: "No followers yet", text: "When people follow you, they’ll show up here." },
      following: { icon: "👤", title: "You’re not following anyone", text: "Find people to follow in the For You tab." },
      recommended: { icon: "✨", title: "No recommendations yet", text: "Check back later for people you might like." }
    };
    const msg = messages[type] || messages.followers;
    friendsContent.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">${msg.icon}</div>
        <strong>${msg.title}</strong>
        <span>${msg.text}</span>
      </div>`;
    return;
  }

  people.forEach((person) => {
    const card = document.createElement("div");
    card.className = "person-card";
    card.innerHTML = `
      <div class="avatar">
        ${person.avatarUrl ? `<img src="${escapeAttribute(person.avatarUrl)}" alt="">` : escapeHTML(person.avatar)}
      </div>
      <div class="person-info">
        <strong>${escapeHTML(person.name)}${verifiedBadge(person.isVerified)}</strong>
        <span>@${escapeHTML(person.username)}</span>
      </div>
      <button class="follow-btn ${person.following ? "following" : ""}" type="button">
        ${person.following ? "Following" : "Follow"}
      </button>`;
    card.querySelector(".avatar")?.addEventListener("click", () => openUserProfile(person.id));
    card.querySelector(".person-info")?.addEventListener("click", () => openUserProfile(person.id));
    card.querySelector(".follow-btn")?.addEventListener("click", async (e) => {
      e.stopPropagation();
      if (!currentUser) return;
      e.target.disabled = true;
      try {
        if (person.following) {
          await supabaseClient.from("follows").delete().eq("follower_id", currentUser.id).eq("following_id", person.id);
          person.following = false;
        } else {
          await supabaseClient.from("follows").insert({ follower_id: currentUser.id, following_id: person.id });
          person.following = true;
          haptic(18);
          popEl(e.target);
          sendPushToUser(
            person.id,
            "Twyn",
            `${state.profile.name || "Someone"} started following you`
          );
        }
        e.target.textContent = person.following ? "Following" : "Follow";
        e.target.classList.toggle("following", person.following);
        await loadFollowers();
        await loadFollowCounts();
      } catch (err) {
        alert(err.message || "Unable to follow");
      } finally {
        e.target.disabled = false;
      }
    });
    friendsContent.appendChild(card);
  });
}

function renderProfile() {
  if (!profileFeed) return;
  updateProfileUI();
  const myPosts = state.posts.filter((p) => String(p.userId) === String(currentUser?.id));
  const postCount = document.getElementById("postCount");
  if (postCount) postCount.textContent = myPosts.length;
  loadFollowCounts();
  profileFeed.innerHTML = "";
  if (!myPosts.length) {
    profileFeed.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✍️</div>
        <strong>You haven’t posted yet</strong>
        <span>Share your first post and it will appear here.</span>
        <button class="empty-action" onclick="document.querySelector('[data-page=\\'createPage\\']')?.click()">Create a post</button>
      </div>`;
    return;
  }
  myPosts.forEach((p) => profileFeed.appendChild(createPostElement(p)));
}

async function loadFollowCounts() {
  if (!currentUser) return;
  const { count: followers } = await supabaseClient
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", currentUser.id);
  const { count: following } = await supabaseClient
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_id", currentUser.id);
  const followerEl = document.getElementById("followerCount");
  const followingEl = document.getElementById("followingCount");
  if (followerEl) followerEl.textContent = followers || 0;
  if (followingEl) followingEl.textContent = following || 0;
}

/* ========== EDIT PROFILE ========== */
document.getElementById("editProfileBtn")?.addEventListener("click", () => {
  selectedAvatar = null;
  selectedCover = null;
  updateProfileUI();
  profileModal?.classList.remove("hidden");
});
document.getElementById("closeProfile")?.addEventListener("click", () => profileModal?.classList.add("hidden"));
profileModal?.querySelector(".modal-backdrop")?.addEventListener("click", () => profileModal.classList.add("hidden"));

const avatarInput = document.getElementById("avatarInput");
if (avatarInput) {
  avatarInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return alert("Please choose an image.");
    if (file.size > 3 * 1024 * 1024) return alert("Avatar must be under 3MB.");
    selectedAvatar = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const preview = document.getElementById("editAvatarPreview");
      if (preview) preview.innerHTML = `<img src="${escapeAttribute(ev.target.result)}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
  });
}

const coverInput = document.getElementById("coverInput");
if (coverInput) {
  coverInput.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return alert("Please choose an image.");
    if (file.size > 5 * 1024 * 1024) return alert("Cover photo must be under 5MB.");
    selectedCover = file;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const preview = document.getElementById("editCoverPreview");
      if (preview) preview.innerHTML = `<img src="${escapeAttribute(ev.target.result)}" alt="Cover preview">`;
    };
    reader.readAsDataURL(file);
  });
}

document.getElementById("saveProfile")?.addEventListener("click", async () => {
  if (!currentUser) return;
  const newName = document.getElementById("editName")?.value.trim() || "";
  const newUsername = (document.getElementById("editUsername")?.value.trim().toLowerCase().replace(/[^a-z0-9_]/g, "") || "").slice(0, 20);
  const newBio = document.getElementById("editBio")?.value.trim() || "";
  if (!newName || !newUsername) return alert("Name and username are required.");

  const btn = document.getElementById("saveProfile");
  btn.disabled = true;
  btn.textContent = "Saving...";

  try {
    const updates = {
      display_name: newName,
      username: newUsername,
      bio: newBio,
      updated_at: new Date().toISOString()
    };

    if (selectedAvatar) {
      const avatarUrl = await uploadToStorage(selectedAvatar, "avatars");
      updates.avatar_url = avatarUrl;
    }

    if (selectedCover) {
      const coverUrl = await uploadToStorage(selectedCover, "covers");
      updates.cover_url = coverUrl;
    }

    const { data, error } = await supabaseClient
      .from("profiles")
      .update(updates)
      .eq("id", currentUser.id)
      .select()
      .single();
    if (error) throw error;

    state.profile.name = data.display_name;
    state.profile.username = data.username;
    state.profile.bio = data.bio || "";
    if (data.avatar_url) state.profile.avatar_url = data.avatar_url;
    if (data.cover_url) state.profile.cover_url = data.cover_url;
    state.profile.is_verified = !!data.is_verified;

    await supabaseClient.auth.updateUser({
      data: { display_name: data.display_name, username: data.username }
    });

    state.posts.forEach((p) => {
      if (String(p.userId) === String(currentUser.id)) {
        p.user = data.display_name;
        p.username = data.username;
        p.avatar = data.display_name.charAt(0).toUpperCase();
        if (data.avatar_url) p.avatarUrl = data.avatar_url;
        p.isVerified = !!data.is_verified;
      }
    });

    selectedAvatar = null;
    selectedCover = null;
    updateProfileUI();
    renderProfile();
    renderFeed();
    profileModal?.classList.add("hidden");
  } catch (err) {
    console.error(err);
    alert(err.message || "Unable to update profile.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Save changes";
  }
});

/* ========== SEARCH ========== */
document.getElementById("searchBtn")?.addEventListener("click", () => {
  searchPanel?.classList.toggle("hidden");
  if (!searchPanel?.classList.contains("hidden")) document.getElementById("searchInput")?.focus();
});

document.getElementById("searchInput")?.addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase().trim();
  const results = document.getElementById("searchResults");
  if (!results) return;
  results.innerHTML = "";
  if (!q) return;
  const people = state.people.filter(
    (p) => p.name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q)
  );
  if (!people.length) {
    results.innerHTML = `<div class="empty-state">No results found.</div>`;
    return;
  }
  people.forEach((p) => {
    const el = document.createElement("div");
    el.className = "search-result";
    el.innerHTML = `
      <div class="avatar">
        ${p.avatarUrl ? `<img src="${escapeAttribute(p.avatarUrl)}" alt="">` : escapeHTML(p.avatar)}
      </div>
      <div>
        <strong>${escapeHTML(p.name)}${verifiedBadge(p.isVerified)}</strong>
        <span>@${escapeHTML(p.username)}</span>
      </div>`;
    el.addEventListener("click", () => {
      searchPanel?.classList.add("hidden");
      openUserProfile(p.id);
    });
    results.appendChild(el);
  });
});

/* ========== NOTIFICATIONS ========== */
async function loadNotifications() {
  if (!currentUser) {
    state.notifications = [];
    updateNotificationBadge();
    renderInbox();
    return;
  }

  const notifs = [];
  const myIds = state.posts
    .filter((p) => String(p.userId) === String(currentUser.id))
    .map((p) => p.id);

  // Likes on my posts
  if (myIds.length && state.settings.notifLikes) {
    try {
      const { data: likes } = await supabaseClient
        .from("likes")
        .select(`id, user_id, post_id, created_at, profiles!user_id (username, display_name, avatar_url)`)
        .in("post_id", myIds)
        .neq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(30);
      (likes || []).forEach((l) => {
        notifs.push({
          id: `like-${l.id}`,
          type: "like",
          user: l.profiles?.display_name || "Someone",
          postId: l.post_id,
          userId: l.user_id,
          time: formatPostTime(l.created_at),
          created_at: l.created_at
        });
      });
    } catch (e) {
      console.error("notif likes", e);
    }
  }

  // Comments on my posts
  if (myIds.length && state.settings.notifComments) {
    try {
      const { data: comments } = await supabaseClient
        .from("comments")
        .select(`id, user_id, post_id, content, created_at, profiles!user_id (username, display_name, avatar_url)`)
        .in("post_id", myIds)
        .neq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(30);
      (comments || []).forEach((c) => {
        notifs.push({
          id: `comment-${c.id}`,
          type: "comment",
          user: c.profiles?.display_name || "Someone",
          text: c.content,
          postId: c.post_id,
          userId: c.user_id,
          time: formatPostTime(c.created_at),
          created_at: c.created_at
        });
      });
    } catch (e) {
      console.error("notif comments", e);
    }
  }

  // New followers
  try {
    const { data: follows } = await supabaseClient
      .from("follows")
      .select(`id, follower_id, created_at, profiles!follower_id (display_name)`)
      .eq("following_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(30);
    (follows || []).forEach((f) => {
      notifs.push({
        id: `follow-${f.id}`,
        type: "follow",
        user: f.profiles?.display_name || "Someone",
        userId: f.follower_id,
        time: formatPostTime(f.created_at),
        created_at: f.created_at
      });
    });
  } catch (e) {
    console.error("notif follows", e);
  }

  // Saves on my posts
  if (myIds.length) {
    try {
      const { data: saves } = await supabaseClient
        .from("saved_posts")
        .select(`id, user_id, post_id, created_at, profiles!user_id (display_name)`)
        .in("post_id", myIds)
        .neq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(20);
      (saves || []).forEach((s) => {
        notifs.push({
          id: `save-${s.id}`,
          type: "save",
          user: s.profiles?.display_name || "Someone",
          postId: s.post_id,
          userId: s.user_id,
          time: formatPostTime(s.created_at),
          created_at: s.created_at
        });
      });
    } catch (e) {
      console.error("notif saves", e);
    }
  }

  // Messages received
  try {
    const { data: msgs } = await supabaseClient
      .from("messages")
      .select(`id, sender_id, content, media_type, created_at, profiles!sender_id (display_name)`)
      .eq("receiver_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(30);
    (msgs || []).forEach((m) => {
      let preview = m.content || "";
      if (m.media_type === "image") preview = "Sent a photo";
      if (m.media_type === "audio") preview = "Sent a voice note";
      notifs.push({
        id: `msg-${m.id}`,
        type: "message",
        user: m.profiles?.display_name || "Someone",
        text: preview,
        userId: m.sender_id,
        time: formatPostTime(m.created_at),
        created_at: m.created_at
      });
    });
  } catch (e) {
    console.error("notif messages", e);
  }

  notifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  state.notifications = notifs.slice(0, 60);
  updateNotificationBadge();
  renderInbox();
}

function getLastActivitySeenAt() {
  if (state.lastActivitySeenAt) return state.lastActivitySeenAt;
  try {
    const raw = localStorage.getItem("twyn_last_activity_seen");
    if (raw) state.lastActivitySeenAt = raw;
  } catch {}
  return state.lastActivitySeenAt || null;
}

function markActivityAsSeen() {
  const now = new Date().toISOString();
  state.lastActivitySeenAt = now;
  try {
    localStorage.setItem("twyn_last_activity_seen", now);
  } catch {}
  updateNotificationBadge();
  renderInbox();
}

function getUnreadActivityCount() {
  const seen = getLastActivitySeenAt();
  if (!seen) return (state.notifications || []).length;
  const seenTime = new Date(seen).getTime();
  return (state.notifications || []).filter((n) => {
    const t = new Date(n.created_at || 0).getTime();
    return t > seenTime;
  }).length;
}

function updateNotificationBadge() {
  const badge = document.querySelector(".notification-badge") || document.getElementById("inboxBadge");
  if (!badge) return;
  const count = getUnreadActivityCount();
  badge.textContent = count > 99 ? "99+" : String(count);
  badge.style.display = count > 0 ? "grid" : "none";
}

function renderInbox() {
  const list = document.getElementById("activityList");
  if (!list) return;
  if (!state.notifications.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔔</div>
        <strong>No activity yet</strong>
        <span>Likes, comments, follows, saves, and messages will show up here.</span>
      </div>`;
    return;
  }

  const seen = getLastActivitySeenAt();
  const seenTime = seen ? new Date(seen).getTime() : 0;

  list.innerHTML = state.notifications
    .map((n) => {
      let icon = "🔔";
      let cls = "";
      let text = "";
      if (n.type === "like") {
        icon = "♥";
        cls = "like-icon";
        text = `<strong>${escapeHTML(n.user)}</strong> liked your post`;
      } else if (n.type === "comment") {
        icon = "💬";
        cls = "comment-icon";
        text = `<strong>${escapeHTML(n.user)}</strong> commented: “${escapeHTML((n.text || "").slice(0, 55))}${(n.text || "").length > 55 ? "…" : ""}”`;
      } else if (n.type === "follow") {
        icon = "👤";
        text = `<strong>${escapeHTML(n.user)}</strong> started following you`;
      } else if (n.type === "save") {
        icon = "🔖";
        text = `<strong>${escapeHTML(n.user)}</strong> saved your post`;
      } else if (n.type === "message") {
        icon = "✉️";
        text = `<strong>${escapeHTML(n.user)}</strong> sent you a message${n.text ? `: “${escapeHTML(String(n.text).slice(0, 40))}”` : ""}`;
      }
      const t = new Date(n.created_at || 0).getTime();
      const isUnread = !seen || t > seenTime;
      return `
        <div class="notification ${isUnread ? "unread" : ""}" data-notif-type="${escapeAttribute(n.type)}" data-user-id="${escapeAttribute(n.userId || "")}" data-post-id="${escapeAttribute(n.postId || "")}">
          <div class="notification-icon ${cls}">${icon}</div>
          <div>${text}<span>${escapeHTML(n.time)}</span></div>
        </div>`;
    })
    .join("");

  list.querySelectorAll(".notification").forEach((el) => {
    el.addEventListener("click", () => {
      const type = el.dataset.notifType;
      const userId = el.dataset.userId;
      if (type === "message" && userId) {
        document.querySelector('[data-page="inboxPage"]')?.click();
        document.querySelector('[data-inbox="messages"]')?.click();
        setTimeout(() => openChat(userId), 150);
      } else if (type === "follow" && userId) {
        openUserProfile(userId);
      } else if (userId) {
        openUserProfile(userId);
      }
    });
  });
}

/* ========== INBOX TABS ========== */
document.querySelectorAll(".inbox-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".inbox-tab").forEach((t) => t.classList.remove("active"));
    tab.classList.add("active");
    const panel = tab.dataset.inbox;
    document.getElementById("activityPanel")?.classList.toggle("hidden", panel !== "activity");
    document.getElementById("messagesPanel")?.classList.toggle("hidden", panel !== "messages");
    if (panel === "messages") {
      closeChatUI();
      renderConversations();
    }
  });
});

/* ========== MESSAGING ========== */
async function loadConversations() {
  if (!currentUser) {
    state.conversations = [];
    return;
  }
  const followerIds = new Set(state.followers.map((f) => f.follower_id));
  const contacts = state.people.filter((p) => p.following || followerIds.has(p.id));

  try {
    const { data } = await supabaseClient
      .from("messages")
      .select("id, sender_id, receiver_id, content, media_url, media_type, created_at, seen_at, reply_to_id, edited_at")
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .order("created_at", { ascending: false })
      .limit(200);

    const byUser = {};
    (data || []).forEach((m) => {
      const other = m.sender_id === currentUser.id ? m.receiver_id : m.sender_id;
      if (!byUser[other]) byUser[other] = [];
      byUser[other].push(m);
    });
    state.messages = byUser;

    state.conversations = contacts
      .map((p) => {
        const msgs = byUser[p.id] || [];
        const last = msgs[0];
        let preview = "Start a conversation";
        if (last) {
          if (last.media_type === "image") preview = "📷 Photo";
          else if (last.media_type === "audio") preview = "🎙 Voice note";
          else preview = last.content || preview;
        }
        return {
          user: p,
          lastMessage: preview,
          lastTime: last ? formatPostTime(last.created_at) : "",
          unread: 0
        };
      })
      .sort((a, b) => {
        const ta = state.messages[a.user.id]?.[0]?.created_at || 0;
        const tb = state.messages[b.user.id]?.[0]?.created_at || 0;
        return new Date(tb) - new Date(ta);
      });
  } catch {
    state.conversations = contacts.map((p) => ({
      user: p,
      lastMessage: "Start a conversation",
      lastTime: "",
      unread: 0
    }));
  }
}

function renderConversations() {
  const list = document.getElementById("conversationsList");
  if (!list) return;

  if (!state.conversations.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💬</div>
        <strong>No conversations yet</strong>
        <span>Follow people or get followed to start messaging them.</span>
      </div>`;
    return;
  }

  list.innerHTML = state.conversations
    .map(
      (c) => `
    <div class="conversation-item" data-user-id="${escapeAttribute(c.user.id)}">
      <div class="avatar">
        ${c.user.avatarUrl
          ? `<img src="${escapeAttribute(c.user.avatarUrl)}" alt="">`
          : escapeHTML(c.user.avatar)}
      </div>
      <div class="conversation-info">
        <strong>${escapeHTML(c.user.name)}${verifiedBadge(c.user.isVerified)}</strong>
        <span>${escapeHTML(c.lastMessage)}</span>
      </div>
      <span style="color:var(--muted);font-size:11px">${escapeHTML(c.lastTime)}</span>
    </div>`
    )
    .join("");

  list.querySelectorAll(".conversation-item").forEach((item) => {
    item.addEventListener("click", () => openChat(item.dataset.userId));
  });
}

function openChatUI() {
  document.body.classList.add("chat-open");
  document.getElementById("chatSpace")?.classList.remove("hidden");
  document.getElementById("chatView")?.classList.remove("hidden");
}

function closeChatUI() {
  activeChatUserId = null;
  stopRecording(true);
  document.body.classList.remove("chat-open");
  document.getElementById("chatSpace")?.classList.add("hidden");
  document.getElementById("chatView")?.classList.add("hidden");
}

async function openChat(userId) {
  activeChatUserId = userId;
  let person = state.people.find((p) => String(p.id) === String(userId));
  if (!person) {
    try {
      const { data: p } = await supabaseClient
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_verified")
        .eq("id", userId)
        .maybeSingle();
      if (!p) return;
      const name = p.display_name || "Twyn User";
      person = {
        id: p.id,
        name,
        username: p.username || "user",
        avatar: name.charAt(0).toUpperCase(),
        avatarUrl: p.avatar_url || null,
        isVerified: isVerifiedProfile(p),
        following: false
      };
      state.people.push(person);
    } catch {
      return;
    }
  }

  openChatUI();

  // refresh last_seen for this user
  let lastSeen = person.lastSeenAt || null;
  try {
    const { data: p2 } = await supabaseClient
      .from("profiles")
      .select("last_seen_at, display_name, is_verified, avatar_url, username")
      .eq("id", userId)
      .maybeSingle();
    if (p2) {
      lastSeen = p2.last_seen_at || null;
      person.lastSeenAt = lastSeen;
      if (p2.display_name) person.name = p2.display_name;
      person.isVerified = !!p2.is_verified;
      person.avatarUrl = p2.avatar_url || person.avatarUrl;
      person.username = p2.username || person.username;
    }
  } catch {}

  const presence = formatPresence(lastSeen);
  const header = document.getElementById("chatHeader");
  if (header) {
    header.innerHTML = `
      <div class="avatar ${presence.online ? "online" : ""}" style="width:34px;height:34px;font-size:13px">
        ${person.avatarUrl
          ? `<img src="${escapeAttribute(person.avatarUrl)}" alt="">`
          : escapeHTML(person.avatar)}
      </div>
      <div class="chat-header-meta">
        <strong>${escapeHTML(person.name)}${verifiedBadge(person.isVerified)}</strong>
        <span class="${presence.online ? "is-online" : ""}">${escapeHTML(presence.text)}</span>
      </div>
    `;
  }

  try {
    const { data } = await supabaseClient
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`
      )
      .order("created_at", { ascending: true });
    state.messages[userId] = data || [];
  } catch {
    if (!state.messages[userId]) state.messages[userId] = [];
  }

  // Mark their messages as seen
  try {
    const now = new Date().toISOString();
    await supabaseClient
      .from("messages")
      .update({ seen_at: now })
      .eq("sender_id", userId)
      .eq("receiver_id", currentUser.id)
      .is("seen_at", null);
    (state.messages[userId] || []).forEach((m) => {
      if (m.sender_id === userId && !m.seen_at) m.seen_at = now;
    });
  } catch (err) {
    console.error("mark seen", err);
  }

  renderChatMessages(userId);
  setupTypingChannel(userId);
  document.getElementById("typingIndicator")?.classList.add("hidden");
}

function formatChatClock(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

function findMessageById(userId, msgId) {
  return (state.messages[userId] || []).find((m) => String(m.id) === String(msgId));
}

function renderChatMessages(userId) {
  const box = document.getElementById("chatMessages");
  if (!box) return;
  const list = (state.messages[userId] || []).slice().sort((a, b) => {
    return new Date(a.created_at || 0) - new Date(b.created_at || 0);
  });
  if (!list.length) {
    box.innerHTML = `<div class="empty-state" style="padding:40px 16px"><strong>No messages yet</strong><span>Say hello 👋</span></div>`;
    return;
  }

  const ids = list.map((m) => m.id).filter((id) => id && !String(id).startsWith("tmp-"));
  // async fill reactions after paint
  loadReactionsForMessages(ids).then((reactMap) => {
    list.forEach((m) => {
      const el = box.querySelector(`[data-msg-id="${CSS.escape(String(m.id))}"] .chat-reactions`);
      if (!el) return;
      const reacts = reactMap[m.id] || [];
      const counts = {};
      reacts.forEach((r) => {
        counts[r.emoji] = counts[r.emoji] || { n: 0, mine: false };
        counts[r.emoji].n++;
        if (String(r.user_id) === String(currentUser?.id)) counts[r.emoji].mine = true;
      });
      el.innerHTML = Object.entries(counts)
        .map(
          ([emoji, info]) =>
            `<button type="button" class="chat-reaction-pill ${info.mine ? "mine-react" : ""}" data-react-emoji="${escapeAttribute(emoji)}" data-msg-id="${escapeAttribute(m.id)}">${emoji} ${info.n}</button>`
        )
        .join("");
    });
  });

  box.innerHTML = list
    .map((m) => {
      const mine = String(m.sender_id) === String(currentUser?.id);
      const time = formatChatClock(m.created_at);
      const ticks = mine ? (m.seen_at ? "✓✓" : "✓") : "";
      const edited = m.edited_at ? `<span class="chat-edited">edited</span>` : "";
      let quote = "";
      if (m.reply_to_id) {
        const parent = findMessageById(userId, m.reply_to_id);
        if (parent) {
          const pMine = String(parent.sender_id) === String(currentUser?.id);
          const pName = pMine ? "You" : (state.people.find((p) => String(p.id) === String(parent.sender_id))?.name || "Reply");
          const pText = parent.content || (parent.media_type === "image" ? "Photo" : "Message");
          quote = `<div class="chat-reply-quote"><strong>${escapeHTML(pName)}</strong><span>${escapeHTML(String(pText).slice(0, 90))}</span></div>`;
        }
      }
      let body = "";
      if (m.media_type === "image" && m.media_url) {
        body += `<img src="${escapeAttribute(m.media_url)}" alt="Image">`;
      }
      if (m.media_type === "audio" && m.media_url) {
        body += `<audio controls src="${escapeAttribute(m.media_url)}"></audio>`;
      }
      if (m.content) body += `<span class="chat-msg-text">${escapeHTML(m.content)}</span>`;

      const picker = `<div class="chat-react-picker">${QUICK_EMOJIS.map(
        (e) => `<button type="button" data-react-emoji="${e}" data-msg-id="${escapeAttribute(m.id)}">${e}</button>`
      ).join("")}</div>`;

      return `<div class="chat-bubble ${mine ? "mine" : "theirs"}" data-msg-id="${escapeAttribute(m.id)}" data-mine="${mine ? "1" : "0"}">
        ${quote}${body}
        <div class="chat-reactions"></div>
        ${picker}
        <div class="chat-meta">${edited}<time>${escapeHTML(time)}</time>${mine ? `<span class="chat-ticks">${ticks}</span>` : ""}</div>
      </div>`;
    })
    .join("");
  box.scrollTop = box.scrollHeight;
}

function openMsgActions(msgId, isMine) {
  activeMsgId = msgId;
  const sheet = document.getElementById("msgActionSheet");
  const editBtn = document.getElementById("msgActEdit");
  const delBtn = document.getElementById("msgActDelete");
  if (editBtn) editBtn.classList.toggle("hidden", !isMine);
  if (delBtn) delBtn.classList.toggle("hidden", !isMine);
  sheet?.classList.remove("hidden");
}

function closeMsgActions() {
  document.getElementById("msgActionSheet")?.classList.add("hidden");
  activeMsgId = null;
}

function setReplyTo(msgId) {
  if (!activeChatUserId) return;
  const msg = findMessageById(activeChatUserId, msgId);
  if (!msg) return;
  replyToMessageId = msgId;
  editingMessageId = null;
  const preview = document.getElementById("chatReplyPreview");
  const nameEl = document.getElementById("chatReplyName");
  const textEl = document.getElementById("chatReplyText");
  const mine = String(msg.sender_id) === String(currentUser?.id);
  if (nameEl) nameEl.textContent = mine ? "You" : "Reply";
  if (textEl) textEl.textContent = msg.content || (msg.media_type === "image" ? "Photo" : "Message");
  preview?.classList.remove("hidden");
  document.getElementById("chatInput")?.focus();
  closeMsgActions();
}

function clearReplyTo() {
  replyToMessageId = null;
  document.getElementById("chatReplyPreview")?.classList.add("hidden");
}

function startEditMessage(msgId) {
  if (!activeChatUserId) return;
  const msg = findMessageById(activeChatUserId, msgId);
  if (!msg || String(msg.sender_id) !== String(currentUser?.id)) return;
  editingMessageId = msgId;
  replyToMessageId = null;
  clearReplyTo();
  const input = document.getElementById("chatInput");
  if (input) {
    input.value = msg.content || "";
    input.focus();
  }
  const btn = document.getElementById("sendMessageBtn");
  if (btn) btn.textContent = "Save";
  closeMsgActions();
}

async function deleteChatMessage(msgId) {
  if (!currentUser || !activeChatUserId) return;
  if (!confirm("Delete this message?")) return;
  try {
    const { error } = await supabaseClient
      .from("messages")
      .delete()
      .eq("id", msgId)
      .eq("sender_id", currentUser.id);
    if (error) throw error;
    state.messages[activeChatUserId] = (state.messages[activeChatUserId] || []).filter(
      (m) => String(m.id) !== String(msgId)
    );
    renderChatMessages(activeChatUserId);
  } catch (err) {
    alert(err.message || "Could not delete");
  }
  closeMsgActions();
}

document.getElementById("sendMessageBtn")?.addEventListener("click", () => sendChatMessage());
document.getElementById("chatInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChatMessage();
});

async function sendChatMessage({ mediaUrl = null, mediaType = null } = {}) {
  if (!currentUser || !activeChatUserId) return;
  const input = document.getElementById("chatInput");
  const text = input?.value.trim() || "";

  // EDIT mode
  if (editingMessageId) {
    if (!text) return;
    try {
      const { error } = await supabaseClient
        .from("messages")
        .update({ content: text, edited_at: new Date().toISOString() })
        .eq("id", editingMessageId)
        .eq("sender_id", currentUser.id);
      if (error) throw error;
      const arr = state.messages[activeChatUserId] || [];
      const m = arr.find((x) => String(x.id) === String(editingMessageId));
      if (m) {
        m.content = text;
        m.edited_at = new Date().toISOString();
      }
      editingMessageId = null;
      if (input) input.value = "";
      const btn = document.getElementById("sendMessageBtn");
      if (btn) btn.textContent = "Send";
      renderChatMessages(activeChatUserId);
      haptic(10);
    } catch (err) {
      alert(err.message || "Could not edit. Run SQL to add edited_at column.");
    }
    return;
  }

  if (!text && !mediaUrl) return;

  const tempId = "tmp-" + Date.now();
  const temp = {
    id: tempId,
    sender_id: currentUser.id,
    receiver_id: activeChatUserId,
    content: text || null,
    media_url: mediaUrl,
    media_type: mediaType,
    created_at: new Date().toISOString(),
    seen_at: null,
    reply_to_id: replyToMessageId || null,
    edited_at: null
  };
  if (!state.messages[activeChatUserId]) state.messages[activeChatUserId] = [];
  state.messages[activeChatUserId].push(temp);
  if (input) input.value = "";
  const replySnap = replyToMessageId;
  clearReplyTo();
  haptic(12);
  popEl(document.getElementById("sendMessageBtn"));
  renderChatMessages(activeChatUserId);

  try {
    const payload = {
      sender_id: currentUser.id,
      receiver_id: activeChatUserId,
      content: text || null,
      media_url: mediaUrl,
      media_type: mediaType
    };
    if (replySnap) payload.reply_to_id = replySnap;

    let { data, error } = await supabaseClient.from("messages").insert(payload).select().single();
    if (error && replySnap) {
      // column may not exist yet
      delete payload.reply_to_id;
      ({ data, error } = await supabaseClient.from("messages").insert(payload).select().single());
    }
    if (error) throw error;

    const arr = state.messages[activeChatUserId];
    const idx = arr.findIndex((m) => m.id === tempId);
    if (idx >= 0) arr[idx] = { ...arr[idx], ...data };
    renderChatMessages(activeChatUserId);
    sendPushToUser(
      activeChatUserId,
      state.profile.name || "Twyn",
      text || (mediaType === "image" ? "Sent a photo" : mediaType === "audio" ? "Sent a voice note" : "New message")
    );
    loadConversations().then(() => renderConversations());
  } catch (err) {
    state.messages[activeChatUserId] = (state.messages[activeChatUserId] || []).filter((m) => m.id !== tempId);
    renderChatMessages(activeChatUserId);
    alert(err.message || "Could not send");
  }
}

document.getElementById("chatImageInput")?.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  e.target.value = "";
  if (!file || !file.type.startsWith("image/")) return;
  if (file.size > 5 * 1024 * 1024) return alert("Image must be under 5MB.");
  if (!activeChatUserId) return;

  try {
    const url = await uploadToStorage(file, "messages");
    await sendChatMessage({ mediaUrl: url, mediaType: "image" });
  } catch (err) {
    alert(err.message || "Unable to send image.");
  }
});

document.getElementById("chatVoiceBtn")?.addEventListener("click", async () => {
  if (isRecording) {
    stopRecording(false);
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (!audioChunks.length || !activeChatUserId) return;
      const blob = new Blob(audioChunks, { type: "audio/webm" });
      const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
      try {
        const url = await uploadToStorage(file, "messages");
        await sendChatMessage({ mediaUrl: url, mediaType: "audio" });
      } catch (err) {
        alert(err.message || "Unable to send voice note.");
      }
    };
    mediaRecorder.start();
    isRecording = true;
    document.getElementById("chatVoiceBtn")?.classList.add("recording");
  } catch {
    alert("Microphone access is required for voice notes.");
  }
});

function stopRecording(discard = false) {
  if (!isRecording || !mediaRecorder) return;
  isRecording = false;
  document.getElementById("chatVoiceBtn")?.classList.remove("recording");
  if (discard) audioChunks = [];
  try {
    mediaRecorder.stop();
  } catch {}
  mediaRecorder = null;
}

/* ========== IMAGE LIGHTBOX ========== */
document.addEventListener("click", (e) => {
  const img = e.target.closest(".post-media, .chat-bubble img");
  if (!img) return;
  const lightbox = document.getElementById("imageLightbox");
  const lightboxImg = document.getElementById("lightboxImage");
  if (!lightbox || !lightboxImg) return;
  lightboxImg.src = img.src;
  lightbox.classList.remove("hidden");
});

document.getElementById("lightboxClose")?.addEventListener("click", () => {
  document.getElementById("imageLightbox")?.classList.add("hidden");
});
document.getElementById("lightboxBackdrop")?.addEventListener("click", () => {
  document.getElementById("imageLightbox")?.classList.add("hidden");
});

/* ========== SETTINGS (with Light mode) ========== */
function loadSettingsFromStorage() {
  try {
    const raw = localStorage.getItem("twyn_settings");
    if (raw) Object.assign(state.settings, JSON.parse(raw));
  } catch {}

  const map = {
    settingNotifPush: "notifPush",
    settingNotifLikes: "notifLikes",
    settingNotifComments: "notifComments",
    settingPrivate: "privateAccount",
    settingLightMode: "lightMode"
  };
  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!state.settings[key];
  });

  // Apply theme on load
  document.body.classList.toggle("light-mode", !!state.settings.lightMode);
}

function saveSettingsToStorage() {
  localStorage.setItem("twyn_settings", JSON.stringify(state.settings));
}

["settingNotifLikes", "settingNotifComments", "settingPrivate", "settingLightMode"].forEach((id) => {
  document.getElementById(id)?.addEventListener("change", (e) => {
    const key = {
      settingNotifLikes: "notifLikes",
      settingNotifComments: "notifComments",
      settingPrivate: "privateAccount",
      settingLightMode: "lightMode"
    }[id];

    state.settings[key] = e.target.checked;
    saveSettingsToStorage();

    if (key === "lightMode") {
      document.body.classList.toggle("light-mode", e.target.checked);
    }
    if (key === "notifLikes" || key === "notifComments") {
      loadNotifications();
    }
  });
});

document.getElementById("settingNotifPush")?.addEventListener("change", async (e) => {
  if (e.target.checked) {
    const ok = await enablePushNotifications();
    if (!ok) {
      e.target.checked = false;
      state.settings.notifPush = false;
      saveSettingsToStorage();
    }
  } else {
    await disablePushNotifications();
  }
});

document.getElementById("openSettingsBtn")?.addEventListener("click", () => {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.getElementById("settingsPage")?.classList.add("active");
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
});

document.getElementById("settingsEditProfile")?.addEventListener("click", () => {
  document.getElementById("editProfileBtn")?.click();
});

document.getElementById("settingsChangePassword")?.addEventListener("click", async () => {
  const newPass = prompt("Enter new password (min 6 characters):");
  if (!newPass) return;
  if (newPass.length < 6) return alert("Password must be at least 6 characters.");
  try {
    const { error } = await supabaseClient.auth.updateUser({ password: newPass });
    if (error) throw error;
    alert("Password updated successfully.");
  } catch (err) {
    alert(err.message || "Unable to change password.");
  }
});

document.getElementById("settingsClearCache")?.addEventListener("click", () => {
  if (!confirm("Clear local cache? You will stay logged in.")) return;
  localStorage.removeItem("twyn_settings");
  state.openComments.clear();
  state.openReplies.clear();
  alert("Cache cleared.");
  loadSettingsFromStorage();
});

document.getElementById("settingsLogout")?.addEventListener("click", () => {
  document.getElementById("logoutBtn")?.click();
});

/* ========== NAVIGATION ========== */
document.querySelectorAll("[data-page]").forEach((button) => {
  button.addEventListener("click", () => {
    closeChatUI();
    const target = button.dataset.page;
    document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
    document.getElementById(target)?.classList.add("active");
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    document.querySelector(`.nav-item[data-page="${target}"]`)?.classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (target === "profilePage") renderProfile();
    if (target === "friendsPage") renderFriends();
    if (target === "inboxPage") {
      renderInbox();
      renderConversations();
    }
  });
});

document.getElementById("topProfileBtn")?.addEventListener("click", () => {
  document.querySelector('[data-page="profilePage"]')?.click();
});

/* ========== REALTIME ========== */
function setupRealtime() {
  realtimeChannels.forEach((ch) => {
    try {
      supabaseClient.removeChannel(ch);
    } catch {}
  });
  realtimeChannels = [];
  if (!currentUser) return;

  const likesChannel = supabaseClient
    .channel("public:likes")
    .on("postgres_changes", { event: "*", schema: "public", table: "likes" }, (payload) =>
      handleRealtimeLike(payload)
    )
    .subscribe();

  const commentsChannel = supabaseClient
    .channel("public:comments")
    .on("postgres_changes", { event: "*", schema: "public", table: "comments" }, (payload) =>
      handleRealtimeComment(payload)
    )
    .subscribe();

  const postsChannel = supabaseClient
    .channel("public:posts")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (payload) =>
      handleRealtimeNewPost(payload)
    )
    .subscribe();

  const messagesChannel = supabaseClient
    .channel("public:messages")
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) =>
      handleRealtimeMessage(payload)
    )
    .subscribe();

  realtimeChannels.push(likesChannel, commentsChannel, postsChannel, messagesChannel);
}

function handleRealtimeLike(payload) {
  const { eventType, new: newRow, old: oldRow } = payload;
  const postId = newRow?.post_id || oldRow?.post_id;
  if (!postId) return;
  const post = state.posts.find((p) => String(p.id) === String(postId));
  if (!post) return;
  if (eventType === "INSERT") {
    post.likes += 1;
    if (newRow.user_id === currentUser?.id) post.liked = true;
  } else if (eventType === "DELETE") {
    post.likes = Math.max(0, post.likes - 1);
    if (oldRow?.user_id === currentUser?.id) post.liked = false;
  }
  updatePostCardUI(postId);
  loadNotifications();
}

function handleRealtimeComment(payload) {
  const { eventType, new: newRow, old: oldRow } = payload;
  const postId = newRow?.post_id || oldRow?.post_id;
  if (!postId) return;
  const post = state.posts.find((p) => String(p.id) === String(postId));
  if (!post) return;
  if (eventType === "INSERT") {
    post.comments += 1;
    if (state.openComments.has(String(postId))) {
      loadPostComments(post).then(() => updatePostCardUI(postId));
    } else updatePostCardUI(postId);
    if (newRow.user_id !== currentUser?.id) loadNotifications();
  } else if (eventType === "DELETE") {
    post.comments = Math.max(0, post.comments - 1);
    if (state.openComments.has(String(postId))) {
      loadPostComments(post).then(() => updatePostCardUI(postId));
    } else updatePostCardUI(postId);
  }
}

async function handleRealtimeNewPost(payload) {
  const newPost = payload.new;
  if (!newPost || newPost.user_id === currentUser?.id) return;

  const { data } = await supabaseClient
    .from("posts")
    .select(`
      id, user_id, content, image_url, world, created_at,
      profiles!user_id (username, display_name, avatar_url, is_verified, is_og),
      likes (user_id),
      comments (id),
      saved_posts (user_id)
    `)
    .eq("id", newPost.id)
    .single();

  if (!data) return;

  const likes = data.likes || [];
  const comments = data.comments || [];
  const savedPosts = data.saved_posts || [];
  const displayName = data.profiles?.display_name || "Twyn User";

  state.posts.unshift({
    id: data.id,
    userId: data.user_id,
    user: displayName,
    username: data.profiles?.username || "twynuser",
    avatar: displayName.charAt(0).toUpperCase() || "T",
    avatarUrl: data.profiles?.avatar_url || null,
    isVerified: isVerifiedProfile(data.profiles),
    text: data.content || "",
    image: data.image_url || null,
    world: data.world || "general",
    likes: likes.length,
    comments: comments.length,
    commentData: [],
    shares: 0,
    saves: savedPosts.length,
    reach: 0,
    liked: likes.some((l) => l.user_id === currentUser?.id),
    saved: savedPosts.some((s) => s.user_id === currentUser?.id),
    time: formatPostTime(data.created_at)
  });
  renderFeed();
}

function handleRealtimeMessage(payload) {
  const msg = payload.new;
  if (!msg || !currentUser) return;
  if (msg.sender_id !== currentUser.id && msg.receiver_id !== currentUser.id) return;

  const otherUserId =
    msg.sender_id === currentUser.id ? msg.receiver_id : msg.sender_id;

  if (!state.messages[otherUserId]) state.messages[otherUserId] = [];

  const exists = state.messages[otherUserId].some(
    (m) => String(m.id) === String(msg.id)
  );
  if (!exists) {
    state.messages[otherUserId] = state.messages[otherUserId].filter((m) => {
      if (!String(m.id).startsWith("temp-")) return true;
      return !(
        m.sender_id === msg.sender_id &&
        m.receiver_id === msg.receiver_id &&
        (m.content || "") === (msg.content || "")
      );
    });
    state.messages[otherUserId].push(msg);
  }

  if (String(activeChatUserId) === String(otherUserId)) {
    renderChatMessages(otherUserId);
  }

  loadConversations().then(() => {
    if (!activeChatUserId) renderConversations();
  });

  if (msg.receiver_id === currentUser.id) {
    loadNotifications();
  }
}

/* ========== LOGOUT ========== */
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  const btn = document.getElementById("logoutBtn");
  btn.disabled = true;
  try {
    const result = await twynLogout();
    if (!result?.success) return alert(result?.error || "Unable to log out.");

    realtimeChannels.forEach((ch) => {
      try {
        supabaseClient.removeChannel(ch);
      } catch {}
    });
    realtimeChannels = [];
    closeChatUI();

    currentUser = null;
    state.posts = [];
    state.people = [];
    state.followers = [];
    state.notifications = [];
    state.conversations = [];
    state.messages = {};
    state.openComments = new Set();
    state.openReplies = new Set();
    state.activeCategory = "typ";
    state.feedPage = 0;
    state.feedHasMore = true;
    state.profile = {
      name: "Twyn User",
      username: "twynuser",
      bio: "Building. Creating. Sharing.",
      avatar_url: null,
      cover_url: null,
      is_verified: false
    };
    updateNotificationBadge();
    showAuth();
    authForm?.reset();
    authMode = "login";
    updateAuthMode();
    setAuthMessage("You've been logged out.");
  } catch (err) {
    alert(err.message || "Unable to log out.");
  } finally {
    btn.disabled = false;
  }
});



/* ========== TWYN LOUNGE ========== */
async function announceLoungeJoin(displayName) {
  try {
    await supabaseClient.from("lounge_messages").insert({
      user_id: currentUser.id,
      content: `${displayName || "Someone"} just joined Twyn 🎉`,
      message_type: "system"
    });
  } catch (e) {
    console.warn("lounge announce", e);
  }
}

async function openLounge() {
  document.body.classList.add("chat-open");
  document.getElementById("loungeSpace")?.classList.remove("hidden");
  await loadLoungeMessages();
  setupLoungeRealtime();
}

function closeLounge() {
  document.body.classList.remove("chat-open");
  document.getElementById("loungeSpace")?.classList.add("hidden");
}

async function loadLoungeMessages() {
  const box = document.getElementById("loungeMessages");
  if (!box) return;
  try {
    const { data, error } = await supabaseClient
      .from("lounge_messages")
      .select("id, user_id, content, message_type, created_at, profiles!user_id (username, display_name, avatar_url, is_verified, is_og)")
      .order("created_at", { ascending: true })
      .limit(200);
    if (error) throw error;
    const rows = data || [];
    box.innerHTML = rows
      .map((m) => {
        if (m.message_type === "system") {
          return `<div class="chat-bubble lounge-system">${escapeHTML(m.content || "")}</div>`;
        }
        const mine = String(m.user_id) === String(currentUser?.id);
        const name = m.profiles?.display_name || "User";
        const time = formatChatClock(m.created_at);
        return `<div class="chat-bubble ${mine ? "mine" : "theirs"}" data-lounge-id="${escapeAttribute(m.id)}">
          ${!mine ? `<div style="font-size:11px;font-weight:700;margin-bottom:2px;opacity:.85">${escapeHTML(name)}${nameBadges({ isVerified: isVerifiedProfile(m.profiles), isOg: !!m.profiles?.is_og })}</div>` : ""}
          <span class="chat-msg-text">${escapeHTML(m.content || "")}</span>
          <div class="chat-meta"><time>${escapeHTML(time)}</time></div>
        </div>`;
      })
      .join("");
    box.scrollTop = box.scrollHeight;
  } catch (err) {
    box.innerHTML = `<div class="empty-state"><strong>Lounge unavailable</strong><span>Run the lounge_messages SQL in Supabase.</span></div>`;
  }
}

async function sendLoungeMessage() {
  if (!currentUser) return;
  const input = document.getElementById("loungeInput");
  const text = input?.value.trim();
  if (!text) return;
  try {
    const { error } = await supabaseClient.from("lounge_messages").insert({
      user_id: currentUser.id,
      content: text,
      message_type: "user"
    });
    if (error) throw error;
    if (input) input.value = "";
    await loadLoungeMessages();
  } catch (err) {
    alert(err.message || "Could not send. Create lounge_messages table.");
  }
}

let loungeChannel = null;
function setupLoungeRealtime() {
  if (loungeChannel) return;
  try {
    loungeChannel = supabaseClient
      .channel("lounge-room")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "lounge_messages" }, () => {
        loadLoungeMessages();
      })
      .subscribe();
  } catch {}
}

/* ========== MESSAGE REACTIONS ========== */
const QUICK_EMOJIS = ["😂", "🔥", "❤️", "👍", "💯"];

async function loadReactionsForMessages(messageIds) {
  if (!messageIds?.length) return {};
  try {
    const { data } = await supabaseClient
      .from("message_reactions")
      .select("message_id, user_id, emoji")
      .in("message_id", messageIds);
    const map = {};
    (data || []).forEach((r) => {
      if (!map[r.message_id]) map[r.message_id] = [];
      map[r.message_id].push(r);
    });
    return map;
  } catch {
    return {};
  }
}

async function toggleMessageReaction(messageId, emoji) {
  if (!currentUser || !messageId) return;
  try {
    const { data: existing } = await supabaseClient
      .from("message_reactions")
      .select("id, emoji")
      .eq("message_id", messageId)
      .eq("user_id", currentUser.id)
      .maybeSingle();
    if (existing) {
      if (existing.emoji === emoji) {
        await supabaseClient.from("message_reactions").delete().eq("id", existing.id);
      } else {
        await supabaseClient.from("message_reactions").update({ emoji }).eq("id", existing.id);
      }
    } else {
      await supabaseClient.from("message_reactions").insert({
        message_id: messageId,
        user_id: currentUser.id,
        emoji
      });
    }
    if (activeChatUserId) renderChatMessages(activeChatUserId);
  } catch (err) {
    if (/schema cache|Could not find the table/i.test(err.message || "")) {
      alert("Run the message_reactions SQL in Supabase.");
    }
  }
}

/* ========== TYPING INDICATOR ========== */
let typingChannel = null;
let typingStopTimer = null;

function setupTypingChannel(otherUserId) {
  try {
    if (typingChannel) {
      supabaseClient.removeChannel(typingChannel);
      typingChannel = null;
    }
    const room = [currentUser.id, otherUserId].sort().join(":");
    typingChannel = supabaseClient.channel(`typing:${room}`);
    typingChannel
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload || payload.userId === currentUser.id) return;
        const el = document.getElementById("typingIndicator");
        if (!el) return;
        el.classList.remove("hidden");
        clearTimeout(el._hide);
        el._hide = setTimeout(() => el.classList.add("hidden"), 2000);
      })
      .subscribe();
  } catch {}
}

function broadcastTyping() {
  if (!typingChannel || !currentUser) return;
  try {
    typingChannel.send({
      type: "broadcast",
      event: "typing",
      payload: { userId: currentUser.id }
    });
  } catch {}
}

/* ========== STORY VIEWS ========== */
async function recordStoryView(storyId) {
  if (!currentUser || !storyId) return;
  try {
    await supabaseClient.from("story_views").upsert(
      { story_id: storyId, user_id: currentUser.id },
      { onConflict: "story_id,user_id", ignoreDuplicates: true }
    );
  } catch {}
}

async function getStoryViewCount(storyId) {
  try {
    const { count } = await supabaseClient
      .from("story_views")
      .select("id", { count: "exact", head: true })
      .eq("story_id", storyId);
    return count || 0;
  } catch {
    return 0;
  }
}

async function sendStoryEmojiToDm(emoji) {
  const group = state.storyGroups[state.activeStoryGroup];
  if (!group || !currentUser) return;
  if (String(group.userId) === String(currentUser.id)) return;
  try {
    await supabaseClient.from("messages").insert({
      sender_id: currentUser.id,
      receiver_id: group.userId,
      content: `${emoji} reacted to your story`
    });
    sendPushToUser(group.userId, state.profile.name || "Twyn", `${emoji} to your story`);
    haptic(10);
  } catch (err) {
    console.warn(err);
  }
}


/* ========== STORIES ========== */
async function loadStories() {
  if (!currentUser) return;
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    let rows = [];

    // 1) plain select — works even without FK to profiles
    let res = await supabaseClient
      .from("stories")
      .select("*")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(100);

    if (res.error) {
      // 2) no date filter (column name differences)
      res = await supabaseClient
        .from("stories")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
    }
    if (res.error) {
      console.warn("stories load failed:", res.error.message || res.error);
      state.stories = [];
      state.storyGroups = [];
      renderStories();
      return;
    }

    rows = res.data || [];
    // only last 24h if created_at exists
    rows = rows.filter((r) => {
      if (!r.created_at) return true;
      return new Date(r.created_at).getTime() >= Date.now() - 24 * 60 * 60 * 1000;
    });

    // normalize media field
    rows = rows.map((r) => ({
      ...r,
      media_url: r.media_url || r.image_url || r.url || r.media || r.image || null
    })).filter((r) => r.media_url);

    // fetch profiles for story authors
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];
    let profileMap = {};
    if (userIds.length) {
      const { data: profiles } = await supabaseClient
        .from("profiles")
        .select("id, username, display_name, avatar_url, is_verified")
        .in("id", userIds);
      (profiles || []).forEach((p) => { profileMap[p.id] = p; });
    }

    state.stories = rows;
    const map = new Map();
    rows.forEach((s) => {
      const uid = s.user_id;
      if (!map.has(uid)) {
        const p = profileMap[uid] || {};
        const name = p.display_name || "User";
        map.set(uid, {
          userId: uid,
          name,
          username: p.username || "user",
          avatarUrl: p.avatar_url || null,
          isVerified: isVerifiedProfile(p),
          items: []
        });
      }
      map.get(uid).items.push(s);
    });
    const groups = Array.from(map.values());
    groups.forEach((g) => g.items.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0)));
    groups.sort((a, b) => {
      if (String(a.userId) === String(currentUser.id)) return -1;
      if (String(b.userId) === String(currentUser.id)) return 1;
      const at = new Date(a.items[a.items.length - 1]?.created_at || 0).getTime();
      const bt = new Date(b.items[b.items.length - 1]?.created_at || 0).getTime();
      return bt - at;
    });
    state.storyGroups = groups;
    renderStories();
  } catch (err) {
    console.error("stories", err);
    state.storyGroups = [];
    renderStories();
  }
}

function renderStories() {
  const list = document.getElementById("storiesList");
  if (!list) return;
  const addBtn = document.getElementById("addStoryBtn");
  const addAv = document.getElementById("storyAddAvatar");
  const own = state.storyGroups.find((g) => String(g.userId) === String(currentUser?.id));

  if (addAv) {
    if (state.profile.avatar_url) {
      addAv.innerHTML = `<img src="${escapeAttribute(state.profile.avatar_url)}" alt="">`;
    } else {
      addAv.textContent = "+";
    }
  }
  if (addBtn) {
    const label = addBtn.querySelector("span");
    if (label) label.textContent = own ? "Your story" : "Your story";
    // long-press / second click on ring opens own stories if any
    addBtn.onclick = () => {
      if (own && own.items.length) {
        openStoryGroup(state.storyGroups.findIndex((g) => String(g.userId) === String(currentUser.id)));
      } else {
        document.getElementById("storyInput")?.click();
      }
    };
    // double-tap Your story to add another
    addBtn.ondblclick = (e) => {
      e.preventDefault();
      document.getElementById("storyInput")?.click();
    };
  }

  // show everyone including self in horizontal list after the add button
  const groups = state.storyGroups;
  list.innerHTML = groups
    .map((g) => {
      const seenKey = `story_seen_${g.userId}`;
      let seen = false;
      try { seen = sessionStorage.getItem(seenKey) === "1"; } catch {}
      const isOwn = String(g.userId) === String(currentUser?.id);
      const initial = (g.name || "U").charAt(0).toUpperCase();
      const name = isOwn ? "You" : (g.name || "User").split(" ")[0];
      return `<button type="button" class="story-item" data-user-id="${escapeAttribute(g.userId)}">
        <div class="story-ring ${seen ? "seen" : ""}">
          <div class="story-avatar">${g.avatarUrl ? `<img src="${escapeAttribute(g.avatarUrl)}" alt="">` : escapeHTML(initial)}</div>
        </div>
        <span>${escapeHTML(name)}</span>
      </button>`;
    })
    .join("");

  list.querySelectorAll(".story-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const uid = btn.dataset.userId;
      const gi = state.storyGroups.findIndex((g) => String(g.userId) === String(uid));
      if (gi >= 0) openStoryGroup(gi);
    });
  });
}

function openStoryGroup(groupIndex) {
  if (!state.storyGroups[groupIndex]) return;
  state.activeStoryGroup = groupIndex;
  state.activeStoryIndex = 0;
  document.getElementById("storyViewer")?.classList.remove("hidden");
  showActiveStory();
}

function closeStoryViewer() {
  if (state.storyTimer) {
    clearTimeout(state.storyTimer);
    state.storyTimer = null;
  }
  document.getElementById("storyViewer")?.classList.add("hidden");
}

async function showActiveStory() {
  const group = state.storyGroups[state.activeStoryGroup];
  if (!group) return closeStoryViewer();
  const item = group.items[state.activeStoryIndex];
  if (!item) return closeStoryViewer();

  try { sessionStorage.setItem(`story_seen_${group.userId}`, "1"); } catch {}
  state.activeStoryId = item.id;

  const img = document.getElementById("storyViewerImage");
  const userEl = document.getElementById("storyViewerUser");
  const progress = document.getElementById("storyProgress");
  if (img) img.src = item.media_url;
  if (userEl) {
    userEl.innerHTML = `${group.avatarUrl ? `<div class="avatar" style="width:28px;height:28px"><img src="${escapeAttribute(group.avatarUrl)}" alt=""></div>` : ""}
      <span>${escapeHTML(group.name)}${verifiedBadge(group.isVerified)}</span>`;
  }
  if (progress) {
    progress.innerHTML = group.items
      .map((_, i) => {
        if (i < state.activeStoryIndex) return `<span class="done"><i></i></span>`;
        if (i === state.activeStoryIndex) return `<span class="active"><i style="animation-duration:5s"></i></span>`;
        return `<span><i></i></span>`;
      })
      .join("");
  }

  await refreshStoryLikeUI(item.id);

  const delBtn = document.getElementById("storyDeleteBtn");
  const isOwn = String(group.userId) === String(currentUser?.id);
  if (delBtn) delBtn.classList.toggle("hidden", !isOwn);

  if (!isOwn) recordStoryView(item.id);
  const viewsEl = document.getElementById("storyViewsLabel");
  if (viewsEl) {
    if (isOwn) {
      const n = await getStoryViewCount(item.id);
      viewsEl.textContent = n === 1 ? "1 view" : `${n} views`;
      viewsEl.classList.remove("hidden");
    } else {
      viewsEl.classList.add("hidden");
    }
  }

  if (state.storyTimer) clearTimeout(state.storyTimer);
  state.storyTimer = setTimeout(() => storyNext(), 5000);
}

async function refreshStoryLikeUI(storyId) {
  const btn = document.getElementById("storyLikeBtn");
  const countEl = document.getElementById("storyLikeCount");
  if (!btn || !storyId) return;
  try {
    const { data: likes } = await supabaseClient
      .from("story_likes")
      .select("user_id")
      .eq("story_id", storyId);
    const list = likes || [];
    const liked = list.some((l) => String(l.user_id) === String(currentUser?.id));
    btn.classList.toggle("liked", liked);
    btn.innerHTML = `${liked ? "♥" : "♡"} <span id="storyLikeCount">${list.length}</span>`;
  } catch {
    if (countEl) countEl.textContent = "0";
  }
}

async function toggleStoryLike() {
  if (!currentUser || !state.activeStoryId) return;
  const storyId = state.activeStoryId;
  const btn = document.getElementById("storyLikeBtn");
  try {
    const { data: existing } = await supabaseClient
      .from("story_likes")
      .select("id")
      .eq("story_id", storyId)
      .eq("user_id", currentUser.id)
      .maybeSingle();
    if (existing) {
      await supabaseClient.from("story_likes").delete().eq("id", existing.id);
    } else {
      await supabaseClient.from("story_likes").insert({ story_id: storyId, user_id: currentUser.id });
      haptic(12);
      popEl(btn);
      const group = state.storyGroups[state.activeStoryGroup];
      if (group && String(group.userId) !== String(currentUser.id)) {
        sendPushToUser(group.userId, "Twyn", `${state.profile.name || "Someone"} liked your story`);
      }
    }
    await refreshStoryLikeUI(storyId);
  } catch (err) {
    const msg = err.message || "";
    if (/schema cache|Could not find the table/i.test(msg)) {
      alert("Run the story_likes SQL in Supabase first.");
    }
  }
}

async function sendStoryReply() {
  if (!currentUser || !state.activeStoryId) return;
  const input = document.getElementById("storyReplyInput");
  const text = input?.value.trim();
  if (!text) return;
  try {
    const { error } = await supabaseClient.from("story_replies").insert({
      story_id: state.activeStoryId,
      user_id: currentUser.id,
      content: text
    });
    if (error) throw error;
    if (input) input.value = "";
    haptic(10);
    const group = state.storyGroups[state.activeStoryGroup];
    if (group && String(group.userId) !== String(currentUser.id)) {
      sendPushToUser(group.userId, "Twyn", `${state.profile.name || "Someone"} replied to your story: ${text.slice(0, 60)}`);
    }
    await notifyMentions(text, "in a story reply");
  } catch (err) {
    const msg = err.message || "";
    if (/schema cache|Could not find the table/i.test(msg)) {
      alert("Run the story_replies SQL in Supabase first.");
    } else alert(msg || "Could not send reply");
  }
}

function storyNext() {
  const group = state.storyGroups[state.activeStoryGroup];
  if (!group) return closeStoryViewer();
  if (state.activeStoryIndex < group.items.length - 1) {
    state.activeStoryIndex += 1;
    showActiveStory();
  } else if (state.activeStoryGroup < state.storyGroups.length - 1) {
    openStoryGroup(state.activeStoryGroup + 1);
  } else {
    closeStoryViewer();
    renderStories();
  }
}

function storyPrev() {
  if (state.activeStoryIndex > 0) {
    state.activeStoryIndex -= 1;
    showActiveStory();
  } else if (state.activeStoryGroup > 0) {
    const prev = state.activeStoryGroup - 1;
    state.activeStoryGroup = prev;
    state.activeStoryIndex = state.storyGroups[prev].items.length - 1;
    showActiveStory();
  }
}

// addStoryBtn click is bound in renderStories (open own story or pick photo)
document.getElementById("storyInput")?.addEventListener("change", async (e) => {
  const files = [...(e.target.files || [])];
  e.target.value = "";
  if (!files.length || !currentUser) return;
  const images = files.filter((f) => f.type.startsWith("image/"));
  if (!images.length) return alert("Pick image files");
  if (images.some((f) => f.size > 6 * 1024 * 1024)) return alert("Each image must be under 6MB");
  try {
    for (const file of images.slice(0, 10)) {
      const url = await uploadToStorage(file, "stories");
      let ins = await supabaseClient.from("stories").insert({
        user_id: currentUser.id,
        media_url: url
      });
      if (ins.error) {
        ins = await supabaseClient.from("stories").insert({
          user_id: currentUser.id,
          image_url: url
        });
      }
      if (ins.error) {
        ins = await supabaseClient.from("stories").insert({
          user_id: currentUser.id,
          url: url
        });
      }
      if (ins.error) throw ins.error;
    }
    haptic(12);
    await loadStories();
  } catch (err) {
    const msg = err.message || "";
    if (/schema cache|Could not find the table/i.test(msg)) {
      alert("Stories table not set up yet.\n\nIn Supabase → SQL, run the CREATE TABLE stories script, then try again.");
    } else {
      alert(msg || "Could not post story.");
    }
  }
});
document.getElementById("storyViewerClose")?.addEventListener("click", closeStoryViewer);
document.getElementById("storyNext")?.addEventListener("click", storyNext);
document.getElementById("storyPrev")?.addEventListener("click", storyPrev);
document.getElementById("storyLikeBtn")?.addEventListener("click", (e) => { e.stopPropagation(); toggleStoryLike(); });
document.getElementById("storyReplySend")?.addEventListener("click", (e) => { e.stopPropagation(); sendStoryReply(); });
document.getElementById("storyReplyInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); sendStoryReply(); }
});
document.getElementById("storyReplyInput")?.addEventListener("focus", () => {
  if (state.storyTimer) { clearTimeout(state.storyTimer); state.storyTimer = null; }
});


/* ========== INIT ========== */
async function initializeAuth() {
  try {
    const user = await getTwynUser();
    if (!user) {
      showAuth();
      authMode = "login";
      updateAuthMode();
      return;
    }
    currentUser = user;
    await ensureProfile();
    await loadCurrentProfile();
    await ensureTommyyVerified();
    showApp();
    await loadTwynData();
    startPresenceHeartbeat();
    if (!hasFinishedOnboarding()) {
      showOnboarding();
    }
    if (state.settings.notifPush) {
      if (typeof Notification !== "undefined" && Notification.permission === "denied") {
        state.settings.notifPush = false;
        saveSettingsToStorage();
      } else {
        enablePushNotifications({ silent: true }).catch(() => {});
      }
    }
  } catch (err) {
    console.error(err);
    currentUser = null;
    authMode = "login";
    updateAuthMode();
    showAuth();
  }
}


function linkifyMentions(text) {
  if (!text) return "";
  const escaped = escapeHTML(text);
  return escaped.replace(/@([a-zA-Z0-9_]{2,20})/g, (m, u) => {
    return `<span class="mention" data-mention="${escapeAttribute(u.toLowerCase())}">@${escapeHTML(u)}</span>`;
  });
}

async function resolveMentionUserIds(text) {
  if (!text) return [];
  const tags = [...new Set((String(text).match(/@([a-zA-Z0-9_]{2,20})/g) || []).map((t) => t.slice(1).toLowerCase()))];
  if (!tags.length) return [];
  try {
    const { data } = await supabaseClient
      .from("profiles")
      .select("id, username")
      .in("username", tags);
    return (data || []).map((p) => p.id).filter((id) => id && String(id) !== String(currentUser?.id));
  } catch {
    return [];
  }
}

async function notifyMentions(text, contextLabel) {
  const ids = await resolveMentionUserIds(text);
  for (const uid of ids) {
    sendPushToUser(uid, "Twyn", `${state.profile.name || "Someone"} mentioned you ${contextLabel}`);
  }
}

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}
function escapeAttribute(value) {
  return escapeHTML(String(value ?? "")).replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}



function lockBodyScroll(lock) {
  document.body.style.overflow = lock ? "hidden" : "";
  document.body.style.touchAction = lock ? "none" : "";
}
document.getElementById("editProfileBtn")?.addEventListener("click", () => {
  setTimeout(() => {
    if (!document.getElementById("profileModal")?.classList.contains("hidden")) {
      lockBodyScroll(true);
    }
  }, 0);
}, true);
document.getElementById("closeProfile")?.addEventListener("click", () => lockBodyScroll(false));
document.getElementById("profileBackdrop")?.addEventListener("click", () => lockBodyScroll(false));
document.getElementById("saveProfile")?.addEventListener("click", () => {
  setTimeout(() => {
    if (document.getElementById("profileModal")?.classList.contains("hidden")) {
      lockBodyScroll(false);
    }
  }, 300);
});

document.getElementById("settingsInvite")?.addEventListener("click", () => shareInviteLink());
document.getElementById("obShareInvite")?.addEventListener("click", () => shareInviteLink());


document.getElementById("msgActReply")?.addEventListener("click", () => {
  if (activeMsgId) setReplyTo(activeMsgId);
  closeMsgActions();
});
document.getElementById("msgActEdit")?.addEventListener("click", () => {
  if (activeMsgId) startEditMessage(activeMsgId);
});
document.getElementById("msgActDelete")?.addEventListener("click", () => {
  if (activeMsgId) deleteChatMessage(activeMsgId);
});
document.getElementById("msgActCancel")?.addEventListener("click", closeMsgActions);
document.getElementById("msgActionBackdrop")?.addEventListener("click", closeMsgActions);
document.getElementById("chatReplyCancel")?.addEventListener("click", clearReplyTo);

// Back button (must work)

document.getElementById("openLoungeBtn")?.addEventListener("click", () => openLounge());
document.getElementById("loungeBackBtn")?.addEventListener("click", () => {
  closeLounge();
});
document.getElementById("loungeSendBtn")?.addEventListener("click", () => sendLoungeMessage());
document.getElementById("loungeInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendLoungeMessage();
});
document.getElementById("dailyPromptPost")?.addEventListener("click", () => {
  const prompt = getDailyPrompt();
  goToPage("createPage");
  const ta = document.getElementById("postText");
  if (ta) {
    ta.value = prompt + "\n\n";
    ta.focus();
  }
});
document.getElementById("chatInput")?.addEventListener("input", () => {
  broadcastTyping();
});
document.getElementById("chatMessages")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-react-emoji]");
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();
  toggleMessageReaction(btn.dataset.msgId, btn.dataset.reactEmoji);
});
document.getElementById("storyReactBar")?.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-story-react]");
  if (!btn) return;
  e.stopPropagation();
  sendStoryEmojiToDm(btn.dataset.storyReact);
});


document.getElementById("chatBackBtn")?.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  clearReplyTo();
  editingMessageId = null;
  const sendBtn = document.getElementById("sendMessageBtn");
  if (sendBtn) sendBtn.textContent = "Send";
  const input = document.getElementById("chatInput");
  if (input) input.value = "";
  closeChatUI();
  renderConversations();
});

// Double-tap: theirs → reply | mine → edit/delete sheet
(function setupChatDoubleTap() {
  const box = document.getElementById("chatMessages");
  if (!box || box.dataset.dblTapBound === "1") return;
  box.dataset.dblTapBound = "1";
  let lastTap = 0;
  let lastId = null;
  box.addEventListener("click", (e) => {
    if (e.target.closest("audio, a, button, input")) return;
    const bubble = e.target.closest(".chat-bubble");
    if (!bubble) return;
    const id = bubble.dataset.msgId;
    if (!id) return;
    const now = Date.now();
    if (lastId === id && now - lastTap < 350) {
      lastTap = 0;
      lastId = null;
      const mine = bubble.dataset.mine === "1";
      if (mine) {
        activeMsgId = id;
        const sheet = document.getElementById("msgActionSheet");
        document.getElementById("msgActReply")?.classList.add("hidden");
        document.getElementById("msgActEdit")?.classList.remove("hidden");
        document.getElementById("msgActDelete")?.classList.remove("hidden");
        sheet?.classList.remove("hidden");
      } else {
        setReplyTo(id);
        haptic(10);
      }
    } else {
      lastTap = now;
      lastId = id;
    }
  });
})();

document.getElementById("storyDeleteBtn")?.addEventListener("click", async () => {
  if (!currentUser || !state.activeStoryId) return;
  if (!confirm("Delete this story?")) return;
  try {
    const { error } = await supabaseClient
      .from("stories")
      .delete()
      .eq("id", state.activeStoryId)
      .eq("user_id", currentUser.id);
    if (error) throw error;
    closeStoryViewer();
    await loadStories();
  } catch (err) {
    alert(err.message || "Could not delete story");
  }
});


updateAuthMode();
initializeAuth();