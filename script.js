/* =========================================================
   TWYN — COMPLETE SCRIPT.JS
   V16 — Verified + Cover + Light mode
   ========================================================= */

let authMode = "signup";
let currentUser = null;
let selectedAvatar = null;
let selectedCover = null;
let selectedImage = null;
let activeChatUserId = null;
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
  feedPage: 0,
  feedHasMore: true,
  isLoadingMore: false
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

function setProfileState(data) {
  state.profile = {
    name: data.display_name || "Twyn User",
    username: data.username || "twynuser",
    bio: data.bio || "",
    avatar_url: data.avatar_url || null,
    cover_url: data.cover_url || null,
    is_verified: !!data.is_verified
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
    profileName.innerHTML = `${escapeHTML(name)}${verifiedBadge(state.profile.is_verified)}`;
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
}

/* ========== LOAD EVERYTHING ========== */
async function loadTwynData() {
  loadSettingsFromStorage();
  showFeedSkeleton(4);
  showProfileSkeleton();
  showFriendsSkeleton();

  await loadPosts({ reset: true });
  await Promise.all([loadPeople(), loadFollowers()]);
  await loadNotifications();
  await loadConversations();

  renderCategorySelector();
  renderFeed();
  renderProfile();
  renderFriends();
  renderInbox();
  renderConversations();
  setupRealtime();
}

/* ========== POSTS ========== */
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
        profiles!user_id (username, display_name, avatar_url, is_verified),
        likes (user_id),
        comments (
          id, user_id, content, created_at, parent_id,
          profiles!user_id (username, display_name, avatar_url, is_verified)
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
          profiles!user_id (username, display_name, avatar_url, is_verified),
          likes (user_id),
          comments (id, user_id, content, created_at, profiles!user_id (username, display_name, avatar_url, is_verified)),
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

    processPosts(data || [], reset);

    if (!data || data.length < PAGE_SIZE) state.feedHasMore = false;
    else state.feedPage += 1;
  } catch (err) {
    console.error("loadPosts error:", err);
  } finally {
    state.isLoadingMore = false;
    updateLoadMoreUI();
  }
}

function processPosts(data, reset = false) {
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
      isVerified: !!post.profiles?.is_verified,
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
  article.dataset.id = post.id;
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
          <strong>${escapeHTML(post.user)}${verifiedBadge(post.isVerified)}</strong>
          <span>@${escapeHTML(post.username)} · ${escapeHTML(post.time)}</span>
        </div>
      </div>
      <button class="post-menu" data-action="menu" data-id="${escapeAttribute(post.id)}" type="button">•••</button>
    </div>
    ${showCategory ? `<div class="post-category">${escapeHTML(getCategoryName(post.world))}</div>` : ""}
    ${post.text ? `<div class="post-text">${escapeHTML(post.text)}</div>` : ""}
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
  return article;
}

function getCategoryName(id) {
  return TWYN_CATEGORIES.find((c) => c.id === id)?.name || "TYP";
}

/* ========== COMMENTS ========== */
function renderCommentsHTML(post) {
  const comments = post.commentData || [];
  if (!comments.length) return `<div class="no-comments">No comments yet. Be the first.</div>`;
  const topLevel = comments.filter((c) => !c.parent_id);
  return topLevel
    .slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    .map((c) => renderSingleComment(c, post, comments))
    .join("");
}

function renderSingleComment(comment, post, allComments) {
  const profile = comment.profiles || {};
  const name = profile.display_name || "Twyn User";
  const username = profile.username || "twynuser";
  const avatar = name.charAt(0).toUpperCase();
  const isVerified = !!profile.is_verified;
  const likes = comment.likes || [];
  const likedByMe = likes.some((l) => l.user_id === currentUser?.id);
  const replies = allComments.filter((c) => String(c.parent_id) === String(comment.id));
  const replyKey = `reply-${comment.id}`;

  return `
    <div class="comment" data-comment-id="${escapeAttribute(comment.id)}">
      <div class="comment-avatar">
        ${profile.avatar_url
          ? `<img src="${escapeAttribute(profile.avatar_url)}" alt="${escapeAttribute(name)}">`
          : escapeHTML(avatar)}
      </div>
      <div class="comment-body">
        <div class="comment-author">
          <strong>${escapeHTML(name)}${verifiedBadge(isVerified)}</strong>
          <span>@${escapeHTML(username)}</span>
        </div>
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
        ${replies.length
          ? `<div class="replies">${replies
              .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
              .map((r) => renderSingleComment(r, post, allComments))
              .join("")}</div>`
          : ""}
      </div>
    </div>
  `;
}

/* ========== FEED CLICK HANDLER ========== */
if (feed) {
  feed.addEventListener("click", async (event) => {
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
        }
        renderFeed();
        renderProfile();
        await loadNotifications();
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
      if (state.openComments.has(key)) state.openComments.delete(key);
      else {
        state.openComments.add(key);
        await loadPostComments(post);
      }
      renderFeed();
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
      renderFeed();
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
        }
        renderFeed();
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
      renderFeed();
      return;
    }

    if (action === "submit-reply") {
      const target = state.posts.find((p) => String(p.id) === String(button.dataset.postId));
      if (target) await submitReply(target, button.dataset.commentId, button);
    }
  });
}

if (profileFeed) {
  profileFeed.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action='menu']");
    if (!button) return;
    const post = state.posts.find((p) => String(p.id) === String(button.dataset.id));
    if (post) openPostMenu(post);
  });
}

async function loadPostComments(post) {
  const { data, error } = await supabaseClient
    .from("comments")
    .select(`
      id, post_id, user_id, content, created_at, parent_id,
      profiles!user_id (username, display_name, avatar_url, is_verified)
    `)
    .eq("post_id", post.id)
    .order("created_at", { ascending: true });

  if (error) {
    const fallback = await supabaseClient
      .from("comments")
      .select(`
        id, post_id, user_id, content, created_at,
        profiles!user_id (username, display_name, avatar_url, is_verified)
      `)
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });
    post.commentData = fallback.data || [];
  } else {
    post.commentData = data || [];
  }
  post.comments = post.commentData.length;
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
      .select(`id, post_id, user_id, content, created_at, parent_id, profiles!user_id (username, display_name, avatar_url, is_verified)`)
      .single();
    if (error) throw error;
    if (!post.commentData) post.commentData = [];
    post.commentData.push(data);
    post.comments = post.commentData.length;
    state.openComments.add(String(post.id));
    input.value = "";
    renderFeed();
    await loadNotifications();
  } catch (err) {
    alert(err.message || "Unable to comment");
  } finally {
    button.disabled = false;
    button.textContent = "Post";
  }
}

async function toggleCommentLike(post, commentId, button) {
  if (!currentUser) return alert("Please log in first.");
  const comment = (post.commentData || []).find((c) => String(c.id) === String(commentId));
  if (!comment) return;
  if (!comment.likes) comment.likes = [];
  const already = comment.likes.some((l) => l.user_id === currentUser.id);
  button.disabled = true;
  try {
    if (already) {
      await supabaseClient.from("comment_likes").delete().eq("user_id", currentUser.id).eq("comment_id", commentId);
      comment.likes = comment.likes.filter((l) => l.user_id !== currentUser.id);
    } else {
      await supabaseClient.from("comment_likes").insert({ user_id: currentUser.id, comment_id: commentId });
      comment.likes.push({ user_id: currentUser.id });
    }
  } catch {
    if (already) comment.likes = comment.likes.filter((l) => l.user_id !== currentUser.id);
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

  button.disabled = true;
  button.textContent = "Replying...";
  try {
    let data;
    const payload = { post_id: post.id, user_id: currentUser.id, content, parent_id: parentId };
    const res = await supabaseClient
      .from("comments")
      .insert(payload)
      .select(`id, post_id, user_id, content, created_at, parent_id, profiles!user_id (username, display_name, avatar_url, is_verified)`)
      .single();
    if (res.error) {
      delete payload.parent_id;
      const retry = await supabaseClient
        .from("comments")
        .insert(payload)
        .select(`id, post_id, user_id, content, created_at, profiles!user_id (username, display_name, avatar_url, is_verified)`)
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
    state.openComments.add(String(post.id));
    input.value = "";
    renderFeed();
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
      isVerified: !!p.is_verified,
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
    card.querySelector(".follow-btn")?.addEventListener("click", async (e) => {
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
    el.addEventListener("click", () => searchPanel?.classList.add("hidden"));
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

  const myIds = state.posts
    .filter((p) => String(p.userId) === String(currentUser.id))
    .map((p) => p.id);

  if (!myIds.length) {
    state.notifications = [];
    updateNotificationBadge();
    renderInbox();
    return;
  }

  const notifs = [];

  try {
    const { data: likes } = await supabaseClient
      .from("likes")
      .select(`id, user_id, post_id, created_at, profiles!user_id (username, display_name, avatar_url)`)
      .in("post_id", myIds)
      .neq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(40);
    (likes || []).forEach((l) => {
      if (!state.settings.notifLikes) return;
      notifs.push({
        id: `like-${l.id}`,
        type: "like",
        user: l.profiles?.display_name || "Someone",
        postId: l.post_id,
        time: formatPostTime(l.created_at),
        created_at: l.created_at
      });
    });
  } catch {}

  try {
    const { data: comments } = await supabaseClient
      .from("comments")
      .select(`id, user_id, post_id, content, created_at, profiles!user_id (username, display_name, avatar_url)`)
      .in("post_id", myIds)
      .neq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(40);
    (comments || []).forEach((c) => {
      if (!state.settings.notifComments) return;
      notifs.push({
        id: `comment-${c.id}`,
        type: "comment",
        user: c.profiles?.display_name || "Someone",
        text: c.content,
        postId: c.post_id,
        time: formatPostTime(c.created_at),
        created_at: c.created_at
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
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🔔</div>
        <strong>No activity yet</strong>
        <span>When someone likes or comments on your posts, it will show up here.</span>
      </div>`;
    return;
  }
  list.innerHTML = state.notifications
    .map((n) => {
      const icon = n.type === "like" ? "♥" : "💬";
      const cls = n.type === "like" ? "like-icon" : "comment-icon";
      const text =
        n.type === "like"
          ? `<strong>${escapeHTML(n.user)}</strong> liked your post`
          : `<strong>${escapeHTML(n.user)}</strong> commented: “${escapeHTML((n.text || "").slice(0, 55))}${(n.text || "").length > 55 ? "…" : ""}”`;
      return `
        <div class="notification">
          <div class="notification-icon ${cls}">${icon}</div>
          <div>${text}<span>${escapeHTML(n.time)}</span></div>
        </div>`;
    })
    .join("");
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
      .select("id, sender_id, receiver_id, content, media_url, media_type, created_at")
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
  document.getElementById("inboxHeading")?.classList.add("hidden");
  document.getElementById("inboxTabs")?.classList.add("hidden");
  document.getElementById("conversationsList")?.classList.add("hidden");
  document.getElementById("chatView")?.classList.remove("hidden");
}

function closeChatUI() {
  activeChatUserId = null;
  stopRecording(true);
  document.body.classList.remove("chat-open");
  document.getElementById("inboxHeading")?.classList.remove("hidden");
  document.getElementById("inboxTabs")?.classList.remove("hidden");
  document.getElementById("conversationsList")?.classList.remove("hidden");
  document.getElementById("chatView")?.classList.add("hidden");
}

async function openChat(userId) {
  activeChatUserId = userId;
  const person = state.people.find((p) => String(p.id) === String(userId));
  if (!person) return;

  openChatUI();

  const header = document.getElementById("chatHeader");
  if (header) {
    header.innerHTML = `
      <div class="avatar" style="width:34px;height:34px;font-size:13px">
        ${person.avatarUrl
          ? `<img src="${escapeAttribute(person.avatarUrl)}" alt="">`
          : escapeHTML(person.avatar)}
      </div>
      <div>
        <div style="display:inline-flex;align-items:center;gap:4px">${escapeHTML(person.name)}${verifiedBadge(person.isVerified)}</div>
        <div style="font-size:12px;color:var(--muted);font-weight:400">@${escapeHTML(person.username)}</div>
      </div>
    `;
  }

  if (!state.messages[userId]) {
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
  container.innerHTML = msgs
    .map((m) => {
      const mine = m.sender_id === currentUser.id;
      let body = "";
      if (m.media_type === "image" && m.media_url) {
        body = `<img src="${escapeAttribute(m.media_url)}" alt="Photo">${m.content ? `<div>${escapeHTML(m.content)}</div>` : ""}`;
      } else if (m.media_type === "audio" && m.media_url) {
        body = `<audio controls src="${escapeAttribute(m.media_url)}"></audio>${m.content ? `<div>${escapeHTML(m.content)}</div>` : ""}`;
      } else {
        body = escapeHTML(m.content || "");
      }
      return `<div class="chat-bubble ${mine ? "mine" : "theirs"}">
        ${body}
        <time>${formatPostTime(m.created_at)}</time>
      </div>`;
    })
    .join("");
  container.scrollTop = container.scrollHeight;
}

document.getElementById("chatBackBtn")?.addEventListener("click", () => {
  closeChatUI();
  renderConversations();
});

document.getElementById("sendMessageBtn")?.addEventListener("click", () => sendChatMessage());
document.getElementById("chatInput")?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") sendChatMessage();
});

async function sendChatMessage({ mediaUrl = null, mediaType = null } = {}) {
  if (!currentUser || !activeChatUserId) return;
  const input = document.getElementById("chatInput");
  const content = input?.value.trim() || "";
  if (!content && !mediaUrl) return;

  const temp = {
    id: "temp-" + Date.now(),
    sender_id: currentUser.id,
    receiver_id: activeChatUserId,
    content,
    media_url: mediaUrl,
    media_type: mediaType,
    created_at: new Date().toISOString()
  };

  if (!state.messages[activeChatUserId]) state.messages[activeChatUserId] = [];
  state.messages[activeChatUserId].push(temp);
  if (input) input.value = "";
  renderChatMessages(activeChatUserId);

  try {
    const payload = {
      sender_id: currentUser.id,
      receiver_id: activeChatUserId,
      content
    };
    if (mediaUrl) {
      payload.media_url = mediaUrl;
      payload.media_type = mediaType;
    }

    const { data, error } = await supabaseClient.from("messages").insert(payload).select().single();
    if (error) throw error;

    const arr = state.messages[activeChatUserId];
    const idx = arr.findIndex((m) => m.id === temp.id);
    if (idx !== -1) arr[idx] = data;
    await loadConversations();
  } catch (err) {
    console.error("Message send error:", err);
    alert(err.message || "Unable to send message. Did you add media_url / media_type columns?");
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

["settingNotifPush", "settingNotifLikes", "settingNotifComments", "settingPrivate", "settingLightMode"].forEach((id) => {
  document.getElementById(id)?.addEventListener("change", (e) => {
    const key = {
      settingNotifPush: "notifPush",
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
  renderFeed();
  renderProfile();
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
      loadPostComments(post).then(() => renderFeed());
    } else renderFeed();
    if (newRow.user_id !== currentUser?.id) loadNotifications();
  } else if (eventType === "DELETE") {
    post.comments = Math.max(0, post.comments - 1);
    if (state.openComments.has(String(postId))) {
      loadPostComments(post).then(() => renderFeed());
    } else renderFeed();
  }
}

async function handleRealtimeNewPost(payload) {
  const newPost = payload.new;
  if (!newPost || newPost.user_id === currentUser?.id) return;

  const { data } = await supabaseClient
    .from("posts")
    .select(`
      id, user_id, content, image_url, world, created_at,
      profiles!user_id (username, display_name, avatar_url, is_verified),
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
    isVerified: !!data.profiles?.is_verified,
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
  if (!msg) return;
  const otherUserId = msg.sender_id === currentUser?.id ? msg.receiver_id : msg.sender_id;
  if (!state.messages[otherUserId]) state.messages[otherUserId] = [];
  const exists = state.messages[otherUserId].some((m) => String(m.id) === String(msg.id));
  if (!exists) state.messages[otherUserId].push(msg);
  if (String(activeChatUserId) === String(otherUserId)) {
    renderChatMessages(otherUserId);
  }
  loadConversations().then(() => {
    if (!activeChatUserId) renderConversations();
  });
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