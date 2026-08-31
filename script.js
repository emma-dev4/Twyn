/* =========================================================
   TWYN — COMPLETE SCRIPT.JS
   V5 — Avatar upload + Working Settings + Messages
   ========================================================= */

let authMode = "signup";
let currentUser = null;
let selectedAvatar = null;          // data URL for new avatar
let activeChatUserId = null;        // currently open conversation

const state = {
  posts: [],
  people: [],
  followers: [],
  notifications: [],
  conversations: [],                // messaging
  messages: {},                     // { userId: [messages] }
  settings: {
    notifPush: true,
    notifLikes: true,
    notifComments: true,
    privateAccount: false
  },
  profile: {
    name: "Twyn User",
    username: "twynuser",
    bio: "Building. Creating. Sharing.",
    avatar_url: null,
    cover_url: null
  },
  activeCategory: "typ",
  openComments: new Set(),
  openReplies: new Set()
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

/* ELEMENTS */
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

/* AUTH FORM */
if (authForm) {
  authForm.addEventListener("submit", async event => {
    event.preventDefault();
    const email = authEmail?.value.trim();
    const password = authPassword?.value || "";
    const name = authName?.value.trim() || "";
    if (!email || !password) { setAuthMessage("Enter your email and password.", "error"); return; }
    if (authMode === "signup" && !name) { setAuthMessage("Enter your display name.", "error"); return; }
    if (password.length < 6) { setAuthMessage("Password must be at least 6 characters.", "error"); return; }

    authSubmit.disabled = true;
    setAuthMessage(authMode === "signup" ? "Creating your account..." : "Logging you in...");

    try {
      if (authMode === "signup") {
        const result = await twynSignUp(email, password, name);
        if (!result?.success) { setAuthMessage(result?.error || "Unable to create your account.", "error"); return; }
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
        setAuthMessage("");
        return;
      }
      const result = await twynLogin(email, password);
      if (!result?.success) { setAuthMessage(result?.error || "Unable to log in.", "error"); return; }
      currentUser = result.user;
      await ensureProfile();
      await loadCurrentProfile();
      showApp();
      await loadTwynData();
      setAuthMessage("");
    } catch (error) {
      console.error("Twyn auth error:", error);
      setAuthMessage(error?.message || "Something went wrong. Try again.", "error");
    } finally {
      authSubmit.disabled = false;
    }
  });
}

/* PROFILE ENSURE + LOAD */
async function ensureProfile() {
  if (!currentUser) return null;
  const { data: existingProfile, error: profileError } = await supabaseClient
    .from("profiles").select("id").eq("id", currentUser.id).maybeSingle();
  if (profileError) { console.error("Profile check error:", profileError); return null; }
  if (existingProfile) return existingProfile;

  const metadata = currentUser.user_metadata || {};
  const displayName = metadata.display_name || (currentUser.email ? currentUser.email.split("@")[0] : "Twyn User");
  const baseUsername = metadata.username || createUsername(displayName);
  const username = `${baseUsername}_${currentUser.id.slice(0, 6)}`;

  const { data, error } = await supabaseClient.from("profiles").insert({
    id: currentUser.id, username, display_name: displayName, bio: "Building. Creating. Sharing."
  }).select().single();

  if (error) {
    if (error.code === "23505") return null;
    console.error("Profile creation error:", error);
    return null;
  }
  return data;
}

async function loadCurrentProfile() {
  if (!currentUser) return;
  const { data, error } = await supabaseClient.from("profiles").select("*").eq("id", currentUser.id).maybeSingle();
  if (error) { console.error("Profile load error:", error); return; }
  if (!data) {
    await ensureProfile();
    const retry = await supabaseClient.from("profiles").select("*").eq("id", currentUser.id).maybeSingle();
    if (retry.error || !retry.data) return;
    setProfileState(retry.data);
    return;
  }
  setProfileState(data);
}

function setProfileState(data) {
  state.profile = {
    name: data.display_name || "Twyn User",
    username: data.username || "twynuser",
    bio: data.bio || "",
    avatar_url: data.avatar_url || null,
    cover_url: data.cover_url || null
  };
  updateProfileUI();
}

/* LOAD ALL */
async function loadTwynData() {
  loadSettingsFromStorage();
  await Promise.all([loadPosts(), loadPeople(), loadFollowers()]);
  await loadNotifications();
  await loadConversations();
  renderCategorySelector();
  renderFeed();
  renderProfile();
  renderFriends();
  renderInbox();
  renderConversations();
}

/* POSTS */
async function loadPosts() {
  const { data, error } = await supabaseClient.from("posts").select(`
    id, user_id, content, image_url, world, created_at,
    profiles (username, display_name, avatar_url),
    likes (user_id),
    comments (id, user_id, content, created_at, parent_id, profiles (username, display_name, avatar_url)),
    saved_posts (user_id)
  `).order("created_at", { ascending: false });

  if (error) {
    const fallback = await supabaseClient.from("posts").select(`
      id, user_id, content, image_url, world, created_at,
      profiles (username, display_name, avatar_url),
      likes (user_id),
      comments (id, user_id, content, created_at, profiles (username, display_name, avatar_url)),
      saved_posts (user_id)
    `).order("created_at", { ascending: false });
    if (fallback.error) { console.error("Posts error:", fallback.error); return; }
    processPosts(fallback.data || []);
    return;
  }
  processPosts(data || []);
}

function processPosts(data) {
  state.posts = data.map(post => {
    const likes = post.likes || [];
    const comments = post.comments || [];
    const savedPosts = post.saved_posts || [];
    const liked = likes.some(item => item.user_id === currentUser?.id);
    const saved = savedPosts.some(item => item.user_id === currentUser?.id);
    const displayName = post.profiles?.display_name || "Twyn User";
    return {
      id: post.id, userId: post.user_id, user: displayName,
      username: post.profiles?.username || "twynuser",
      avatar: displayName.charAt(0).toUpperCase() || "T",
      avatarUrl: post.profiles?.avatar_url || null,
      text: post.content || "", image: post.image_url || null,
      world: post.world || "general",
      likes: likes.length, comments: comments.length, commentData: comments,
      shares: 0, saves: savedPosts.length, reach: 0, liked, saved,
      time: formatPostTime(post.created_at)
    };
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

/* PROFILE UI */
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

  document.getElementById("profileName") && (document.getElementById("profileName").textContent = name);
  document.getElementById("profileUsername") && (document.getElementById("profileUsername").textContent = `@${username}`);
  document.getElementById("profileBio") && (document.getElementById("profileBio").textContent = bio);
  setAvatar(document.getElementById("profileAvatar"));
  setAvatar(document.getElementById("createAvatar"));
  setAvatar(document.querySelector(".mini-avatar"));
  setAvatar(document.getElementById("editAvatarPreview"));

  document.getElementById("createName") && (document.getElementById("createName").textContent = name);
  document.getElementById("createUsername") && (document.getElementById("createUsername").textContent = `@${username}`);

  const editName = document.getElementById("editName");
  const editUsername = document.getElementById("editUsername");
  const editBio = document.getElementById("editBio");
  if (editName) editName.value = name;
  if (editUsername) editUsername.value = username;
  if (editBio) editBio.value = bio;
}

/* NAVIGATION */
document.querySelectorAll("[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    const target = button.dataset.page;
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    document.getElementById(target)?.classList.add("active");
    document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
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

/* CATEGORY SELECTOR */
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
  selector.innerHTML = TWYN_CATEGORIES.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("");
  selector.value = state.activeCategory;
  selector.onchange = e => { state.activeCategory = e.target.value; renderFeed(); };
}

/* FEED */
function renderFeed() {
  if (!feed) return;
  feed.innerHTML = "";
  let posts = state.posts;
  if (state.activeCategory && state.activeCategory !== "typ") {
    posts = posts.filter(p => String(p.world || "general").toLowerCase() === state.activeCategory.toLowerCase());
  }
  if (!posts.length) {
    feed.innerHTML = `<div class="empty-state"><strong>No posts here yet</strong><span>Be the first person to post.</span></div>`;
    return;
  }
  posts.forEach(p => feed.appendChild(createPostElement(p)));
}

function createPostElement(post) {
  const article = document.createElement("article");
  article.className = "post";
  article.dataset.id = post.id;
  const showCategory = post.world && !["typ", "general", "all"].includes(post.world);
  article.innerHTML = `
    <div class="post-header">
      <div class="user-info">
        <div class="avatar">${post.avatarUrl ? `<img src="${escapeAttribute(post.avatarUrl)}" alt="">` : escapeHTML(post.avatar)}</div>
        <div class="user-details">
          <strong>${escapeHTML(post.user)}</strong>
          <span>@${escapeHTML(post.username)} · ${escapeHTML(post.time)}</span>
        </div>
      </div>
      <button class="post-menu" data-action="menu" data-id="${escapeAttribute(post.id)}" type="button">•••</button>
    </div>
    ${showCategory ? `<div class="post-category">${escapeHTML(getCategoryName(post.world))}</div>` : ""}
    ${post.text ? `<div class="post-text">${escapeHTML(post.text)}</div>` : ""}
    ${post.image ? `<img class="post-media" src="${escapeAttribute(post.image)}" alt="Post media" loading="lazy">` : ""}
    <div class="post-actions">
      <button class="post-action ${post.liked ? "liked" : ""}" data-action="like" data-id="${escapeAttribute(post.id)}" type="button">
        ${post.liked ? "♥" : "♡"} <span>${post.likes}</span>
      </button>
      <button class="post-action" data-action="comment" data-id="${escapeAttribute(post.id)}" type="button">💬 <span>${post.comments}</span></button>
      <button class="post-action" data-action="share" data-id="${escapeAttribute(post.id)}" type="button">↗ <span>${post.shares}</span></button>
      <button class="post-action ${post.saved ? "saved" : ""}" data-action="save" data-id="${escapeAttribute(post.id)}" type="button">${post.saved ? "✓" : "♧"}</button>
      <span class="post-time">${post.reach.toLocaleString()} reach</span>
    </div>
    <div class="comments-container ${state.openComments.has(String(post.id)) ? "" : "hidden"}" data-comments-for="${escapeAttribute(post.id)}">
      <div class="comments-list">${renderCommentsHTML(post)}</div>
      <div class="comment-form">
        <input type="text" class="comment-input" placeholder="Write a comment..." maxlength="500" data-comment-input="${escapeAttribute(post.id)}">
        <button type="button" class="comment-submit" data-action="submit-comment" data-id="${escapeAttribute(post.id)}">Post</button>
      </div>
    </div>`;
  return article;
}

function getCategoryName(id) {
  return TWYN_CATEGORIES.find(c => c.id === id)?.name || "TYP";
}

function renderCommentsHTML(post) {
  const comments = post.commentData || [];
  if (!comments.length) return `<div class="no-comments">No comments yet. Be the first.</div>`;
  const topLevel = comments.filter(c => !c.parent_id);
  return topLevel.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map(c => renderSingleComment(c, post, comments)).join("");
}

function renderSingleComment(comment, post, all) {
  const profile = comment.profiles || {};
  const name = profile.display_name || "Twyn User";
  const username = profile.username || "twynuser";
  const avatar = name.charAt(0).toUpperCase();
  const likes = comment.likes || [];
  const likedByMe = likes.some(l => l.user_id === currentUser?.id);
  const replies = all.filter(c => String(c.parent_id) === String(comment.id));
  const replyKey = `reply-${comment.id}`;

  return `
    <div class="comment" data-comment-id="${escapeAttribute(comment.id)}">
      <div class="comment-avatar">${profile.avatar_url ? `<img src="${escapeAttribute(profile.avatar_url)}" alt="">` : escapeHTML(avatar)}</div>
      <div class="comment-body">
        <div class="comment-author"><strong>${escapeHTML(name)}</strong><span>@${escapeHTML(username)}</span></div>
        <div class="comment-text">${escapeHTML(comment.content)}</div>
        <div class="comment-meta">
          <span class="comment-time">${formatPostTime(comment.created_at)}</span>
          <button class="comment-like-btn ${likedByMe ? "liked" : ""}" data-action="like-comment" data-comment-id="${escapeAttribute(comment.id)}" data-post-id="${escapeAttribute(post.id)}" type="button">
            ${likedByMe ? "♥" : "♡"} ${likes.length || ""}
          </button>
          <button class="comment-reply-btn" data-action="toggle-reply" data-comment-id="${escapeAttribute(comment.id)}" data-post-id="${escapeAttribute(post.id)}" type="button">Reply</button>
        </div>
        <div class="reply-form ${state.openReplies.has(replyKey) ? "" : "hidden"}">
          <input type="text" class="reply-input" placeholder="Write a reply..." maxlength="500" data-reply-input="${escapeAttribute(comment.id)}">
          <button type="button" class="reply-submit" data-action="submit-reply" data-comment-id="${escapeAttribute(comment.id)}" data-post-id="${escapeAttribute(post.id)}">Reply</button>
        </div>
        ${replies.length ? `<div class="replies">${replies.sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).map(r => renderSingleComment(r, post, all)).join("")}</div>` : ""}
      </div>
    </div>`;
}

/* FEED CLICK HANDLER */
if (feed) {
  feed.addEventListener("click", async e => {
    const button = e.target.closest("[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const id = button.dataset.id || button.dataset.postId;
    const post = state.posts.find(p => String(p.id) === String(id));

    if (action === "like" && post) {
      if (!currentUser) return alert("Please log in first.");
      button.disabled = true;
      try {
        if (post.liked) {
          await supabaseClient.from("likes").delete().eq("user_id", currentUser.id).eq("post_id", post.id);
          post.liked = false; post.likes = Math.max(0, post.likes - 1);
        } else {
          await supabaseClient.from("likes").insert({ user_id: currentUser.id, post_id: post.id });
          post.liked = true; post.likes++;
        }
        renderFeed(); renderProfile(); await loadNotifications();
      } catch (err) { console.error(err); alert(err.message || "Unable to like"); }
      finally { button.disabled = false; }
      return;
    }

    if (action === "comment" && post) {
      const key = String(post.id);
      if (state.openComments.has(key)) state.openComments.delete(key);
      else { state.openComments.add(key); await loadPostComments(post); }
      renderFeed();
      return;
    }

    if (action === "submit-comment" && post) { await submitComment(post, button); return; }
    if (action === "share" && post) {
      post.shares++;
      const url = `${location.origin}${location.pathname}#post-${post.id}`;
      try {
        if (navigator.share) await navigator.share({ title: "Twyn", url });
        else if (navigator.clipboard) { await navigator.clipboard.writeText(url); alert("Link copied"); }
        else prompt("Copy link", url);
      } catch {}
      renderFeed();
      return;
    }
    if (action === "save" && post) {
      if (!currentUser) return alert("Please log in first.");
      button.disabled = true;
      try {
        if (post.saved) {
          await supabaseClient.from("saved_posts").delete().eq("user_id", currentUser.id).eq("post_id", post.id);
          post.saved = false; post.saves = Math.max(0, post.saves - 1);
        } else {
          await supabaseClient.from("saved_posts").insert({ user_id: currentUser.id, post_id: post.id });
          post.saved = true; post.saves++;
        }
        renderFeed();
      } catch (err) { alert(err.message || "Unable to save"); }
      finally { button.disabled = false; }
      return;
    }
    if (action === "menu" && post) { showPostMenu(post); return; }

    if (action === "like-comment") {
      const commentId = button.dataset.commentId;
      const target = state.posts.find(p => String(p.id) === String(button.dataset.postId));
      if (target) await toggleCommentLike(target, commentId, button);
      return;
    }
    if (action === "toggle-reply") {
      const key = `reply-${button.dataset.commentId}`;
      state.openReplies.has(key) ? state.openReplies.delete(key) : state.openReplies.add(key);
      renderFeed();
      return;
    }
    if (action === "submit-reply") {
      const target = state.posts.find(p => String(p.id) === String(button.dataset.postId));
      if (target) await submitReply(target, button.dataset.commentId, button);
    }
  });
}

async function loadPostComments(post) {
  const { data, error } = await supabaseClient.from("comments").select(`
    id, post_id, user_id, content, created_at, parent_id,
    profiles (username, display_name, avatar_url)
  `).eq("post_id", post.id).order("created_at", { ascending: true });
  if (error) {
    const fb = await supabaseClient.from("comments").select(`
      id, post_id, user_id, content, created_at, profiles (username, display_name, avatar_url)
    `).eq("post_id", post.id).order("created_at", { ascending: true });
    post.commentData = fb.data || [];
  } else post.commentData = data || [];
  post.comments = post.commentData.length;
}

async function submitComment(post, button) {
  if (!currentUser) return alert("Please log in first.");
  const input = button.closest(".post")?.querySelector(`[data-comment-input="${CSS.escape(String(post.id))}"]`);
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  button.disabled = true; button.textContent = "Posting...";
  try {
    const { data, error } = await supabaseClient.from("comments").insert({
      post_id: post.id, user_id: currentUser.id, content
    }).select(`id, post_id, user_id, content, created_at, parent_id, profiles (username, display_name, avatar_url)`).single();
    if (error) throw error;
    if (!post.commentData) post.commentData = [];
    post.commentData.push(data);
    post.comments = post.commentData.length;
    state.openComments.add(String(post.id));
    input.value = "";
    renderFeed();
    await loadNotifications();
  } catch (err) { alert(err.message || "Unable to comment"); }
  finally { button.disabled = false; button.textContent = "Post"; }
}

async function toggleCommentLike(post, commentId, button) {
  if (!currentUser) return alert("Please log in first.");
  const comment = (post.commentData || []).find(c => String(c.id) === String(commentId));
  if (!comment) return;
  if (!comment.likes) comment.likes = [];
  const already = comment.likes.some(l => l.user_id === currentUser.id);
  button.disabled = true;
  try {
    if (already) {
      await supabaseClient.from("comment_likes").delete().eq("user_id", currentUser.id).eq("comment_id", commentId);
      comment.likes = comment.likes.filter(l => l.user_id !== currentUser.id);
    } else {
      await supabaseClient.from("comment_likes").insert({ user_id: currentUser.id, comment_id: commentId });
      comment.likes.push({ user_id: currentUser.id });
    }
  } catch {
    // optimistic even if table missing
    if (already) comment.likes = comment.likes.filter(l => l.user_id !== currentUser.id);
    else comment.likes.push({ user_id: currentUser.id });
  }
  renderFeed();
  button.disabled = false;
}

async function submitReply(post, parentId, button) {
  if (!currentUser) return alert("Please log in first.");
  const input = button.closest(".post")?.querySelector(`[data-reply-input="${CSS.escape(String(parentId))}"]`);
  if (!input) return;
  const content = input.value.trim();
  if (!content) return;
  button.disabled = true; button.textContent = "Replying...";
  try {
    let data;
    const payload = { post_id: post.id, user_id: currentUser.id, content, parent_id: parentId };
    const res = await supabaseClient.from("comments").insert(payload)
      .select(`id, post_id, user_id, content, created_at, parent_id, profiles (username, display_name, avatar_url)`).single();
    if (res.error) {
      delete payload.parent_id;
      const retry = await supabaseClient.from("comments").insert(payload)
        .select(`id, post_id, user_id, content, created_at, profiles (username, display_name, avatar_url)`).single();
      if (retry.error) throw retry.error;
      data = retry.data;
    } else data = res.data;
    if (!post.commentData) post.commentData = [];
    post.commentData.push(data);
    post.comments = post.commentData.length;
    state.openReplies.delete(`reply-${parentId}`);
    state.openComments.add(String(post.id));
    input.value = "";
    renderFeed();
    await loadNotifications();
  } catch (err) { alert(err.message || "Unable to reply"); }
  finally { button.disabled = false; button.textContent = "Reply"; }
}

function showPostMenu(post) {
  const isOwner = currentUser && String(post.userId) === String(currentUser.id);
  let text = "Post options:\n\n1 — Post Analysis\n2 — Copy Link\n";
  if (isOwner) text += "3 — Delete Post\n";
  text += "0 — Cancel";
  const choice = prompt(text);
  if (choice === "1") openAnalysis(post);
  else if (choice === "2") copyPostLink(post);
  else if (choice === "3" && isOwner) deletePost(post);
}

async function copyPostLink(post) {
  const url = `${location.origin}${location.pathname}#post-${post.id}`;
  try {
    if (navigator.clipboard) { await navigator.clipboard.writeText(url); alert("Link copied"); return; }
  } catch {}
  prompt("Copy this link:", url);
}

async function deletePost(post) {
  if (!currentUser || String(post.userId) !== String(currentUser.id)) return;
  if (!confirm("Delete this post?")) return;
  const { error } = await supabaseClient.from("posts").delete().eq("id", post.id).eq("user_id", currentUser.id);
  if (error) return alert(error.message);
  state.posts = state.posts.filter(p => String(p.id) !== String(post.id));
  renderFeed(); renderProfile();
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

/* CREATE POST */
let selectedImage = null;
if (postText) postText.addEventListener("input", () => {
  if (characterCount) characterCount.textContent = `${postText.value.length} / 500`;
});
if (imageInput) {
  imageInput.addEventListener("change", e => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return alert("Please choose an image.");
    if (file.size > 5 * 1024 * 1024) return alert("Image must be < 5MB.");
    const reader = new FileReader();
    reader.onload = ev => {
      selectedImage = ev.target.result;
      if (createPreview) createPreview.innerHTML = `<img src="${escapeAttribute(selectedImage)}" alt="Preview">`;
    };
    reader.readAsDataURL(file);
  });
}

function createPostCategorySelector() {
  let sel = document.getElementById("postCategory");
  if (sel) return sel;
  sel = document.createElement("select");
  sel.id = "postCategory";
  sel.className = "post-category-select";
  const opts = [{ id: "general", name: "General (no tag)" }, ...TWYN_CATEGORIES.filter(c => c.id !== "typ" && c.id !== "general")];
  sel.innerHTML = opts.map(c => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join("");
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
  btn.disabled = true; btn.textContent = "Posting...";
  try {
    const { data, error } = await supabaseClient.from("posts").insert({
      user_id: currentUser.id, content: text, image_url: selectedImage, world: category
    }).select().single();
    if (error) throw error;
    state.posts.unshift({
      id: data.id, userId: currentUser.id, user: state.profile.name, username: state.profile.username,
      avatar: state.profile.name.charAt(0).toUpperCase(), avatarUrl: state.profile.avatar_url,
      text: data.content || "", image: data.image_url || null, world: data.world || category,
      likes: 0, comments: 0, commentData: [], shares: 0, saves: 0, reach: 0, liked: false, saved: false, time: "now"
    });
    if (postText) postText.value = "";
    selectedImage = null;
    if (imageInput) imageInput.value = "";
    if (createPreview) createPreview.innerHTML = "";
    if (characterCount) characterCount.textContent = "0 / 500";
    renderFeed(); renderProfile();
    document.querySelector('[data-page="homePage"]')?.click();
  } catch (err) { alert(err.message || "Unable to post"); }
  finally { btn.disabled = false; btn.textContent = "Post"; }
});

/* FRIENDS */
document.querySelectorAll(".friend-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".friend-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    renderFriends(tab.dataset.tab);
  });
});

async function loadPeople() {
  if (!currentUser) return;
  const { data, error } = await supabaseClient.from("profiles")
    .select("id, username, display_name, avatar_url").neq("id", currentUser.id).limit(100);
  if (error) return console.error(error);
  const { data: followingData } = await supabaseClient.from("follows")
    .select("following_id").eq("follower_id", currentUser.id);
  const followingIds = new Set((followingData || []).map(i => i.following_id));
  state.people = (data || []).map(p => {
    const name = p.display_name || "Twyn User";
    return {
      id: p.id, name, username: p.username || "twynuser",
      avatar: name.charAt(0).toUpperCase(), avatarUrl: p.avatar_url || null,
      following: followingIds.has(p.id)
    };
  });
}

async function loadFollowers() {
  if (!currentUser) return;
  const { data, error } = await supabaseClient.from("follows").select("follower_id").eq("following_id", currentUser.id);
  state.followers = error ? [] : (data || []);
}

function renderFriends(type = "followers") {
  if (!friendsContent) return;
  friendsContent.innerHTML = "";
  let people = [];
  if (type === "following") people = state.people.filter(p => p.following);
  else if (type === "recommended") people = state.people.filter(p => !p.following);
  else {
    const ids = new Set(state.followers.map(f => f.follower_id));
    people = state.people.filter(p => ids.has(p.id));
  }
  if (!people.length) {
    friendsContent.innerHTML = `<div class="empty-state"><strong>No people here yet</strong><span>Start connecting.</span></div>`;
    return;
  }
  people.forEach(person => {
    const card = document.createElement("div");
    card.className = "person-card";
    card.innerHTML = `
      <div class="avatar">${person.avatarUrl ? `<img src="${escapeAttribute(person.avatarUrl)}" alt="">` : escapeHTML(person.avatar)}</div>
      <div class="person-info"><strong>${escapeHTML(person.name)}</strong><span>@${escapeHTML(person.username)}</span></div>
      <button class="follow-btn ${person.following ? "following" : ""}" type="button">${person.following ? "Following" : "Follow"}</button>`;
    card.querySelector(".follow-btn")?.addEventListener("click", async e => {
      if (!currentUser) return;
      e.target.disabled = true;
      try {
        if (person.following) {
          await supabaseClient.from("follows").delete().eq("follower_id", currentUser.id).eq("following_id", person.id);
          person.following = false;
        } else {
          await supabaseClient.from("follows").insert({ follower_id: currentUser.id, following_id: person.id });
          person.following = true;
        }
        e.target.textContent = person.following ? "Following" : "Follow";
        e.target.classList.toggle("following", person.following);
        await loadFollowers(); await loadFollowCounts();
      } catch (err) { alert(err.message || "Unable to follow"); }
      finally { e.target.disabled = false; }
    });
    friendsContent.appendChild(card);
  });
}

function renderProfile() {
  if (!profileFeed) return;
  updateProfileUI();
  const myPosts = state.posts.filter(p => String(p.userId) === String(currentUser?.id));
  document.getElementById("postCount") && (document.getElementById("postCount").textContent = myPosts.length);
  loadFollowCounts();
  profileFeed.innerHTML = "";
  if (!myPosts.length) {
    profileFeed.innerHTML = `<div class="empty-state"><strong>No posts yet</strong><span>Your posts will appear here.</span></div>`;
    return;
  }
  myPosts.forEach(p => profileFeed.appendChild(createPostElement(p)));
}

async function loadFollowCounts() {
  if (!currentUser) return;
  const { count: followers } = await supabaseClient.from("follows").select("*", { count: "exact", head: true }).eq("following_id", currentUser.id);
  const { count: following } = await supabaseClient.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", currentUser.id);
  document.getElementById("followerCount") && (document.getElementById("followerCount").textContent = followers || 0);
  document.getElementById("followingCount") && (document.getElementById("followingCount").textContent = following || 0);
}

/* ========== EDIT PROFILE + AVATAR ========== */
document.getElementById("editProfileBtn")?.addEventListener("click", () => {
  selectedAvatar = null;
  updateProfileUI();
  profileModal?.classList.remove("hidden");
});
document.getElementById("closeProfile")?.addEventListener("click", () => profileModal?.classList.add("hidden"));
profileModal?.querySelector(".modal-backdrop")?.addEventListener("click", () => profileModal.classList.add("hidden"));

const avatarInput = document.getElementById("avatarInput");
if (avatarInput) {
  avatarInput.addEventListener("change", e => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return alert("Please choose an image.");
    if (file.size > 3 * 1024 * 1024) return alert("Avatar must be under 3MB.");
    const reader = new FileReader();
    reader.onload = ev => {
      selectedAvatar = ev.target.result;
      const preview = document.getElementById("editAvatarPreview");
      if (preview) preview.innerHTML = `<img src="${escapeAttribute(selectedAvatar)}" alt="Preview">`;
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
  try {
    const updates = {
      display_name: newName,
      username: newUsername,
      bio: newBio,
      updated_at: new Date().toISOString()
    };
    if (selectedAvatar) updates.avatar_url = selectedAvatar;

    const { data, error } = await supabaseClient.from("profiles").update(updates)
      .eq("id", currentUser.id).select().single();
    if (error) throw error;

    state.profile.name = data.display_name;
    state.profile.username = data.username;
    state.profile.bio = data.bio || "";
    if (data.avatar_url) state.profile.avatar_url = data.avatar_url;

    await supabaseClient.auth.updateUser({ data: { display_name: data.display_name, username: data.username } });

    state.posts.forEach(p => {
      if (String(p.userId) === String(currentUser.id)) {
        p.user = data.display_name;
        p.username = data.username;
        p.avatar = data.display_name.charAt(0).toUpperCase();
        if (data.avatar_url) p.avatarUrl = data.avatar_url;
      }
    });

    selectedAvatar = null;
    updateProfileUI();
    renderProfile();
    renderFeed();
    profileModal?.classList.add("hidden");
  } catch (err) {
    console.error(err);
    alert(err.message || "Unable to update profile.");
  } finally {
    btn.disabled = false;
  }
});

/* SEARCH */
document.getElementById("searchBtn")?.addEventListener("click", () => {
  searchPanel?.classList.toggle("hidden");
  if (!searchPanel?.classList.contains("hidden")) document.getElementById("searchInput")?.focus();
});
document.getElementById("searchInput")?.addEventListener("input", e => {
  const q = e.target.value.toLowerCase().trim();
  const results = document.getElementById("searchResults");
  if (!results) return;
  results.innerHTML = "";
  if (!q) return;
  const people = state.people.filter(p => p.name.toLowerCase().includes(q) || p.username.toLowerCase().includes(q));
  if (!people.length) {
    results.innerHTML = `<div class="empty-state">No results found.</div>`;
    return;
  }
  people.forEach(p => {
    const el = document.createElement("div");
    el.className = "search-result";
    el.innerHTML = `
      <div class="avatar">${p.avatarUrl ? `<img src="${escapeAttribute(p.avatarUrl)}" alt="">` : escapeHTML(p.avatar)}</div>
      <div><strong>${escapeHTML(p.name)}</strong><span>@${escapeHTML(p.username)}</span></div>`;
    el.addEventListener("click", () => searchPanel?.classList.add("hidden"));
    results.appendChild(el);
  });
});

/* NOTIFICATIONS */
async function loadNotifications() {
  if (!currentUser) {
    state.notifications = [];
    updateNotificationBadge();
    renderInbox();
    return;
  }
  const myIds = state.posts.filter(p => String(p.userId) === String(currentUser.id)).map(p => p.id);
  if (!myIds.length) {
    state.notifications = [];
    updateNotificationBadge();
    renderInbox();
    return;
  }
  const notifs = [];
  try {
    const { data: likes } = await supabaseClient.from("likes")
      .select(`id, user_id, post_id, created_at, profiles (username, display_name, avatar_url)`)
      .in("post_id", myIds).neq("user_id", currentUser.id).order("created_at", { ascending: false }).limit(40);
    (likes || []).forEach(l => {
      if (!state.settings.notifLikes) return;
      notifs.push({
        id: `like-${l.id}`, type: "like", user: l.profiles?.display_name || "Someone",
        postId: l.post_id, time: formatPostTime(l.created_at), created_at: l.created_at
      });
    });
  } catch {}
  try {
    const { data: comments } = await supabaseClient.from("comments")
      .select(`id, user_id, post_id, content, created_at, profiles (username, display_name, avatar_url)`)
      .in("post_id", myIds).neq("user_id", currentUser.id).order("created_at", { ascending: false }).limit(40);
    (comments || []).forEach(c => {
      if (!state.settings.notifComments) return;
      notifs.push({
        id: `comment-${c.id}`, type: "comment", user: c.profiles?.display_name || "Someone",
        text: c.content, postId: c.post_id, time: formatPostTime(c.created_at), created_at: c.created_at
      });
    });
  } catch {}
  notifs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  state.notifications = notifs.slice(0, 50);
  updateNotificationBadge();
  renderInbox();
}

function updateNotificationBadge() {
  const badge = document.querySelector(".notification-badge");
  if (!badge) return;
  const count = state.notifications.length;
  badge.textContent = count > 99 ? "99+" : String(count);
  badge.style.display = count > 0 ? "grid" : "none";
}

function renderInbox() {
  const list = document.getElementById("activityList");
  if (!list) return;
  if (!state.notifications.length) {
    list.innerHTML = `<div class="notification"><div class="notification-icon">🔔</div><div><strong>No activity yet</strong><span>Likes and comments on your posts will show here.</span></div></div>`;
    return;
  }
  list.innerHTML = state.notifications.map(n => {
    const icon = n.type === "like" ? "♥" : "💬";
    const cls = n.type === "like" ? "like-icon" : "comment-icon";
    const text = n.type === "like"
      ? `<strong>${escapeHTML(n.user)}</strong> liked your post`
      : `<strong>${escapeHTML(n.user)}</strong> commented: “${escapeHTML((n.text || "").slice(0, 55))}${(n.text || "").length > 55 ? "…" : ""}”`;
    return `<div class="notification"><div class="notification-icon ${cls}">${icon}</div><div>${text}<span>${escapeHTML(n.time)}</span></div></div>`;
  }).join("");
}

/* INBOX TABS */
document.querySelectorAll(".inbox-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".inbox-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const panel = tab.dataset.inbox;
    document.getElementById("activityPanel")?.classList.toggle("hidden", panel !== "activity");
    document.getElementById("messagesPanel")?.classList.toggle("hidden", panel !== "messages");
    if (panel === "messages") {
      renderConversations();
      document.getElementById("chatView")?.classList.add("hidden");
    }
  });
});

/* ========== MESSAGING ========== */
async function loadConversations() {
  if (!currentUser) {
    state.conversations = [];
    return;
  }
  // People you can message: followers + following
  const followerIds = new Set(state.followers.map(f => f.follower_id));
  const contacts = state.people.filter(p => p.following || followerIds.has(p.id));

  // Try to load real messages if table exists
  try {
    const { data } = await supabaseClient.from("messages")
      .select("id, sender_id, receiver_id, content, created_at")
      .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
      .order("created_at", { ascending: false })
      .limit(200);

    const byUser = {};
    (data || []).forEach(m => {
      const other = m.sender_id === currentUser.id ? m.receiver_id : m.sender_id;
      if (!byUser[other]) byUser[other] = [];
      byUser[other].push(m);
    });
    state.messages = byUser;

    state.conversations = contacts.map(p => {
      const msgs = byUser[p.id] || [];
      const last = msgs[0];
      return {
        user: p,
        lastMessage: last ? last.content : "Start a conversation",
        lastTime: last ? formatPostTime(last.created_at) : "",
        unread: 0
      };
    }).sort((a, b) => {
      const ta = state.messages[a.user.id]?.[0]?.created_at || 0;
      const tb = state.messages[b.user.id]?.[0]?.created_at || 0;
      return new Date(tb) - new Date(ta);
    });
  } catch {
    // table may not exist yet — still show contacts
    state.conversations = contacts.map(p => ({
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
    list.innerHTML = `<div class="empty-state"><strong>No conversations yet</strong><span>Follow people or get followed to start messaging.</span></div>`;
    return;
  }
  list.innerHTML = state.conversations.map(c => `
    <div class="conversation-item" data-user-id="${escapeAttribute(c.user.id)}">
      <div class="avatar">${c.user.avatarUrl ? `<img src="${escapeAttribute(c.user.avatarUrl)}" alt="">` : escapeHTML(c.user.avatar)}</div>
      <div class="conversation-info">
        <strong>${escapeHTML(c.user.name)}</strong>
        <span>${escapeHTML(c.lastMessage)}</span>
      </div>
      <span style="color:var(--muted);font-size:11px">${escapeHTML(c.lastTime)}</span>
    </div>`).join("");

  list.querySelectorAll(".conversation-item").forEach(item => {
    item.addEventListener("click", () => openChat(item.dataset.userId));
  });
}

async function openChat(userId) {
  activeChatUserId = userId;
  const person = state.people.find(p => String(p.id) === String(userId));
  if (!person) return;

  document.getElementById("chatView")?.classList.remove("hidden");
  const header = document.getElementById("chatHeader");
  if (header) {
    header.innerHTML = `
      <div class="avatar" style="width:32px;height:32px;font-size:13px">
        ${person.avatarUrl ? `<img src="${escapeAttribute(person.avatarUrl)}" alt="">` : escapeHTML(person.avatar)}
      </div>
      <span>${escapeHTML(person.name)}</span>`;
  }

  // load messages for this user if needed
  if (!state.messages[userId]) {
    try {
      const { data } = await supabaseClient.from("messages")
        .select("*")
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`)
        .order("created_at", { ascending: true });
      state.messages[userId] = data || [];
    } catch {
      state.messages[userId] = [];
    }
  }

  renderChatMessages(userId);
}

function renderChatMessages(userId) {
  const container = document.getElementById("chatMessages");
  if (!container) return;
  const msgs = state.messages[userId] || [];
  if (!msgs.length) {
    container.innerHTML = `<div class="empty-state" style="padding:40px 10px"><span>No messages yet. Say hi!</span></div>`;
    return;
  }
  container.innerHTML = msgs.map(m => {
    const mine = m.sender_id === currentUser.id;
    return `<div class="chat-bubble ${mine ? "mine" : "theirs"}">
      ${escapeHTML(m.content)}
      <time>${formatPostTime(m.created_at)}</time>
    </div>`;
  }).join("");
  container.scrollTop = container.scrollHeight;
}

document.getElementById("sendMessageBtn")?.addEventListener("click", sendChatMessage);
document.getElementById("chatInput")?.addEventListener("keydown", e => {
  if (e.key === "Enter") sendChatMessage();
});

async function sendChatMessage() {
  if (!currentUser || !activeChatUserId) return;
  const input = document.getElementById("chatInput");
  const content = input?.value.trim();
  if (!content) return;

  const temp = {
    id: "temp-" + Date.now(),
    sender_id: currentUser.id,
    receiver_id: activeChatUserId,
    content,
    created_at: new Date().toISOString()
  };

  if (!state.messages[activeChatUserId]) state.messages[activeChatUserId] = [];
  state.messages[activeChatUserId].push(temp);
  input.value = "";
  renderChatMessages(activeChatUserId);

  try {
    const { data, error } = await supabaseClient.from("messages").insert({
      sender_id: currentUser.id,
      receiver_id: activeChatUserId,
      content
    }).select().single();
    if (error) throw error;
    // replace temp
    const arr = state.messages[activeChatUserId];
    const idx = arr.findIndex(m => m.id === temp.id);
    if (idx !== -1) arr[idx] = data;
    await loadConversations();
    renderConversations();
  } catch (err) {
    console.error("Message send error (table may be missing):", err);
    // keep optimistic message
  }
}

/* ========== SETTINGS ========== */
function loadSettingsFromStorage() {
  try {
    const raw = localStorage.getItem("twyn_settings");
    if (raw) Object.assign(state.settings, JSON.parse(raw));
  } catch {}
  // apply to UI
  const map = {
    settingNotifPush: "notifPush",
    settingNotifLikes: "notifLikes",
    settingNotifComments: "notifComments",
    settingPrivate: "privateAccount"
  };
  Object.entries(map).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!state.settings[key];
  });
}

function saveSettingsToStorage() {
  localStorage.setItem("twyn_settings", JSON.stringify(state.settings));
}

["settingNotifPush", "settingNotifLikes", "settingNotifComments", "settingPrivate"].forEach(id => {
  document.getElementById(id)?.addEventListener("change", e => {
    const key = {
      settingNotifPush: "notifPush",
      settingNotifLikes: "notifLikes",
      settingNotifComments: "notifComments",
      settingPrivate: "privateAccount"
    }[id];
    state.settings[key] = e.target.checked;
    saveSettingsToStorage();
    if (key === "notifLikes" || key === "notifComments") loadNotifications();
  });
});

document.getElementById("openSettingsBtn")?.addEventListener("click", () => {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.getElementById("settingsPage")?.classList.add("active");
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
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

/* LOGOUT */
document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  const btn = document.getElementById("logoutBtn");
  btn.disabled = true;
  try {
    const result = await twynLogout();
    if (!result?.success) return alert(result?.error || "Unable to log out.");
    currentUser = null;
    state.posts = []; state.people = []; state.followers = [];
    state.notifications = []; state.conversations = []; state.messages = {};
    state.openComments = new Set(); state.openReplies = new Set();
    state.activeCategory = "typ";
    state.profile = { name: "Twyn User", username: "twynuser", bio: "Building. Creating. Sharing.", avatar_url: null, cover_url: null };
    updateNotificationBadge();
    showAuth();
    authForm?.reset();
    authMode = "login";
    updateAuthMode();
    setAuthMessage("You've been logged out.");
  } catch (err) { alert(err.message || "Unable to log out."); }
  finally { btn.disabled = false; }
});

/* INIT */
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
    showApp();
    await loadTwynData();
  } catch (err) {
    console.error(err);
    currentUser = null;
    showAuth();
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

updateAuthMode();
initializeAuth();
