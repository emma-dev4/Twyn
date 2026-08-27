/* =========================================================
   TWYN — V2 + REAL SUPABASE DATA
   ========================================================= */

/* =========================================================
   AUTH STATE
   ========================================================= */

let authMode = "signup";
let currentUser = null;


/* =========================================================
   STATE
   ========================================================= */

const state = {

  posts: [],

  people: [],

  profile: {
    name: "Twyn User",
    username: "twynuser",
    bio: "Building. Creating. Sharing.",
    avatar_url: null,
    cover_url: null
  }

};


/* =========================================================
   ELEMENTS
   ========================================================= */

const authScreen =
  document.getElementById("authScreen");

const twynApp =
  document.getElementById("twynApp");

const authForm =
  document.getElementById("authForm");

const authTitle =
  document.getElementById("authTitle");

const authSubtitle =
  document.getElementById("authSubtitle");

const authSubmit =
  document.getElementById("authSubmit");

const authSwitchBtn =
  document.getElementById("authSwitchBtn");

const authSwitchText =
  document.getElementById("authSwitchText");

const authMessage =
  document.getElementById("authMessage");

const nameField =
  document.getElementById("nameField");

const authName =
  document.getElementById("authName");

const authEmail =
  document.getElementById("authEmail");

const authPassword =
  document.getElementById("authPassword");

const feed =
  document.getElementById("feed");

const profileFeed =
  document.getElementById("profileFeed");

const friendsContent =
  document.getElementById("friendsContent");

const postText =
  document.getElementById("postText");

const characterCount =
  document.getElementById("characterCount");

const imageInput =
  document.getElementById("imageInput");

const createPreview =
  document.getElementById("createPreview");

const analysisModal =
  document.getElementById("analysisModal");

const profileModal =
  document.getElementById("profileModal");


/* =========================================================
   AUTH UI
   ========================================================= */

function showAuth() {

  authScreen.classList.remove("hidden");

  twynApp.style.display = "none";

}


function showApp() {

  authScreen.classList.add("hidden");

  twynApp.style.display = "block";

}


/* =========================================================
   AUTH MESSAGE
   ========================================================= */

function setAuthMessage(
  message,
  type = ""
) {

  authMessage.textContent = message;

  authMessage.className =
    "auth-message";

  if (type) {

    authMessage.classList.add(type);

  }

}


/* =========================================================
   AUTH MODE
   ========================================================= */

function updateAuthMode() {

  if (authMode === "signup") {

    authTitle.textContent =
      "Welcome to Twyn";

    authSubtitle.textContent =
      "Create your account and join Twyn.";

    nameField.classList.remove("hidden");

    authName.required = true;

    authSubmit.textContent =
      "Create account";

    authSwitchText.textContent =
      "Already have an account?";

    authSwitchBtn.textContent =
      "Log in";

  } else {

    authTitle.textContent =
      "Welcome back";

    authSubtitle.textContent =
      "Log in to continue to Twyn.";

    nameField.classList.add("hidden");

    authName.required = false;

    authSubmit.textContent =
      "Log in";

    authSwitchText.textContent =
      "Don't have an account?";

    authSwitchBtn.textContent =
      "Create account";

  }

}


/* =========================================================
   SWITCH LOGIN / SIGNUP
   ========================================================= */

authSwitchBtn.addEventListener(
  "click",
  () => {

    authMode =
      authMode === "signup"
        ? "login"
        : "signup";

    setAuthMessage("");

    authForm.reset();

    updateAuthMode();

  }
);


/* =========================================================
   SIGN UP / LOGIN
   ========================================================= */

authForm.addEventListener(
  "submit",
  async event => {

    event.preventDefault();

    const email =
      authEmail.value.trim();

    const password =
      authPassword.value;

    const name =
      authName.value.trim();

    if (!email || !password) {

      setAuthMessage(
        "Enter your email and password.",
        "error"
      );

      return;

    }

    if (
      authMode === "signup" &&
      !name
    ) {

      setAuthMessage(
        "Enter your display name.",
        "error"
      );

      return;

    }

    authSubmit.disabled = true;

    setAuthMessage(
      authMode === "signup"
        ? "Creating your account..."
        : "Logging you in..."
    );

    try {

      if (authMode === "signup") {

        const result =
          await twynSignUp(
            email,
            password
          );

        if (!result.success) {

          setAuthMessage(
            result.error,
            "error"
          );

          return;

        }

        /*
         * Store display name in Supabase Auth metadata.
         * Your database trigger uses this when creating
         * the public profile.
         */

        if (result.user) {

          await supabaseClient.auth.updateUser({
            data: {
              display_name: name,
              username: createUsername(name)
            }
          });

        }

        /*
         * Email confirmation may be enabled.
         */

        if (!result.session) {

          setAuthMessage(
            "Account created. Check your email to confirm your account.",
            "success"
          );

          return;

        }

        currentUser =
          result.user;

        await loadCurrentProfile();

        showApp();

        await loadTwynData();

        setAuthMessage("");

      } else {

        const result =
          await twynLogin(
            email,
            password
          );

        if (!result.success) {

          setAuthMessage(
            result.error,
            "error"
          );

          return;

        }

        currentUser =
          result.user;

        await loadCurrentProfile();

        showApp();

        await loadTwynData();

        setAuthMessage("");

      }

    } catch (error) {

      console.error(
        "Twyn auth error:",
        error
      );

      setAuthMessage(
        "Something went wrong. Try again.",
        "error"
      );

    } finally {

      authSubmit.disabled = false;

    }

  }
);


/* =========================================================
   LOGOUT
   ========================================================= */

document
  .getElementById("logoutBtn")
  .addEventListener(
    "click",
    async () => {

      const result =
        await twynLogout();

      if (!result.success) {

        alert(result.error);

        return;

      }

      currentUser = null;

      state.posts = [];
      state.people = [];

      showAuth();

      authForm.reset();

      authMode = "login";

      updateAuthMode();

      setAuthMessage(
        "You've been logged out."
      );

    }
  );


/* =========================================================
   CHECK EXISTING SESSION
   ========================================================= */

async function initializeAuth() {

  try {

    const user =
      await getTwynUser();

    if (!user) {

      showAuth();

      return;

    }

    currentUser =
      user;

    await loadCurrentProfile();

    showApp();

    await loadTwynData();

  } catch (error) {

    console.error(
      "Auth initialization error:",
      error
    );

    showAuth();

  }

}


/* =========================================================
   CREATE USERNAME
   ========================================================= */

function createUsername(name) {

  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 20)
    || "twynuser";

}


/* =========================================================
   LOAD CURRENT PROFILE
   ========================================================= */

async function loadCurrentProfile() {

  if (!currentUser) return;

  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

  if (error) {

    console.error(
      "Profile load error:",
      error
    );

    /*
     * If the trigger has not created the profile yet,
     * create a fallback profile.
     */

    if (error.code === "PGRST116") {

      const emailName =
        currentUser.email
          ? currentUser.email.split("@")[0]
          : "twynuser";

      const username =
        createUsername(emailName);

      const {
        data: newProfile,
        error: insertError
      } =
        await supabaseClient
          .from("profiles")
          .insert({
            id: currentUser.id,
            username:
              username +
              "_" +
              currentUser.id
                .slice(0, 6),
            display_name:
              currentUser.user_metadata
                ?.display_name ||
              emailName,
            bio:
              "Building. Creating. Sharing."
          })
          .select()
          .single();

      if (insertError) {

        console.error(
          "Profile creation error:",
          insertError
        );

        return;

      }

      state.profile = {

        name:
          newProfile.display_name,

        username:
          newProfile.username,

        bio:
          newProfile.bio || "",

        avatar_url:
          newProfile.avatar_url,

        cover_url:
          newProfile.cover_url

      };

      updateProfileUI();

      return;

    }

    return;

  }

  state.profile = {

    name:
      data.display_name,

    username:
      data.username,

    bio:
      data.bio || "",

    avatar_url:
      data.avatar_url,

    cover_url:
      data.cover_url

  };

  updateProfileUI();

}


/* =========================================================
   LOAD ALL TWYN DATA
   ========================================================= */

async function loadTwynData() {

  await Promise.all([
    loadPosts(),
    loadPeople(),
    loadSavedPosts()
  ]);

  renderFeed();

  renderProfile();

  renderFriends();

}


/* =========================================================
   LOAD POSTS
   ========================================================= */

async function loadPosts() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("posts")
      .select(`
        id,
        user_id,
        content,
        image_url,
        world,
        created_at,
        profiles (
          username,
          display_name,
          avatar_url
        ),
        likes (
          user_id
        ),
        comments (
          id
        ),
        saved_posts (
          user_id
        )
      `)
      .order(
        "created_at",
        {
          ascending: false
        }
      );

  if (error) {

    console.error(
      "Posts load error:",
      error
    );

    return;

  }

  state.posts =
    (data || []).map(
      post => {

        const likes =
          post.likes || [];

        const comments =
          post.comments || [];

        const saved =
          (post.saved_posts || [])
            .some(
              item =>
                item.user_id ===
                currentUser?.id
            );

        const liked =
          likes.some(
            item =>
              item.user_id ===
              currentUser?.id
          );

        return {

          id:
            post.id,

          userId:
            post.user_id,

          user:
            post.profiles?.display_name ||
            "Twyn User",

          username:
            post.profiles?.username ||
            "twynuser",

          avatar:
            (
              post.profiles?.display_name ||
              "T"
            )
              .charAt(0)
              .toUpperCase(),

          avatarUrl:
            post.profiles?.avatar_url ||
            null,

          text:
            post.content,

          image:
            post.image_url,

          world:
            post.world,

          likes:
            likes.length,

          comments:
            comments.length,

          shares:
            0,

          saves:
            (post.saved_posts || []).length,

          reach:
            0,

          liked,

          saved,

          time:
            formatPostTime(
              post.created_at
            )

        };

      }
    );

}


/* =========================================================
   LOAD PEOPLE
   ========================================================= */

async function loadPeople() {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("profiles")
      .select(
        "id, username, display_name, avatar_url"
      )
      .neq(
        "id",
        currentUser?.id
      )
      .limit(50);

  if (error) {

    console.error(
      "People load error:",
      error
    );

    return;

  }

  const {
    data: followingData,
    error: followingError
  } =
    await supabaseClient
      .from("follows")
      .select("following_id")
      .eq(
        "follower_id",
        currentUser?.id
      );

  if (followingError) {

    console.error(
      "Following load error:",
      followingError
    );

  }

  const followingIds =
    new Set(
      (followingData || [])
        .map(
          item =>
            item.following_id
        )
    );

  state.people =
    (data || []).map(
      person => ({

        id:
          person.id,

        name:
          person.display_name,

        username:
          person.username,

        avatar:
          (
            person.display_name ||
            "T"
          )
            .charAt(0)
            .toUpperCase(),

        avatarUrl:
          person.avatar_url,

        following:
          followingIds.has(
            person.id
          )

      })
    );

}


/* =========================================================
   LOAD SAVED POSTS
   ========================================================= */

async function loadSavedPosts() {

  /*
   * Saved status is already loaded with posts.
   * This function exists so the data pipeline stays
   * easy to extend later.
   */

}


/* =========================================================
   FORMAT POST TIME
   ========================================================= */

function formatPostTime(
  timestamp
) {

  const date =
    new Date(timestamp);

  const seconds =
    Math.floor(
      (Date.now() - date.getTime()) /
      1000
    );

  if (seconds < 60) {

    return "now";

  }

  const minutes =
    Math.floor(
      seconds / 60
    );

  if (minutes < 60) {

    return `${minutes}m`;

  }

  const hours =
    Math.floor(
      minutes / 60
    );

  if (hours < 24) {

    return `${hours}h`;

  }

  const days =
    Math.floor(
      hours / 24
    );

  if (days < 7) {

    return `${days}d`;

  }

  return date.toLocaleDateString();

}


/* =========================================================
   PROFILE UI
   ========================================================= */

function updateProfileUI() {

  const name =
    state.profile.name ||
    "Twyn User";

  const username =
    state.profile.username ||
    "twynuser";

  const bio =
    state.profile.bio ||
    "";

  const avatar =
    name
      .charAt(0)
      .toUpperCase() ||
    "T";

  document.getElementById(
    "profileName"
  ).textContent =
    name;

  document.getElementById(
    "profileUsername"
  ).textContent =
    `@${username}`;

  document.getElementById(
    "profileBio"
  ).textContent =
    bio;

  document.getElementById(
    "profileAvatar"
  ).textContent =
    avatar;

  document.getElementById(
    "createAvatar"
  ).textContent =
    avatar;

  document.getElementById(
    "createName"
  ).textContent =
    name;

  document.getElementById(
    "createUsername"
  ).textContent =
    `@${username}`;

  const miniAvatar =
    document.querySelector(
      ".mini-avatar"
    );

  if (miniAvatar) {

    miniAvatar.textContent =
      avatar;

  }

  document.getElementById(
    "editName"
  ).value =
    name;

  document.getElementById(
    "editUsername"
  ).value =
    username;

  document.getElementById(
    "editBio"
  ).value =
    bio;

}


/* =========================================================
   NAVIGATION
   ========================================================= */

document
  .querySelectorAll("[data-page]")
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const target =
          button.dataset.page;

        document
          .querySelectorAll(".page")
          .forEach(page => {

            page.classList.remove(
              "active"
            );

          });

        const targetPage =
          document.getElementById(
            target
          );

        if (targetPage) {

          targetPage.classList.add(
            "active"
          );

        }

        document
          .querySelectorAll(".nav-item")
          .forEach(item => {

            item.classList.remove(
              "active"
            );

          });

        const navButton =
          document.querySelector(
            `.nav-item[data-page="${target}"]`
          );

        if (navButton) {

          navButton.classList.add(
            "active"
          );

        }

        window.scrollTo({
          top: 0,
          behavior: "smooth"
        });

        if (
          target === "profilePage"
        ) {

          renderProfile();

        }

      }
    );

  });


/* =========================================================
   TOP PROFILE
   ========================================================= */

document
  .getElementById("topProfileBtn")
  .addEventListener(
    "click",
    () => {

      document
        .querySelector(
          '[data-page="profilePage"]'
        )
        .click();

    }
  );


/* =========================================================
   FEED
   ========================================================= */

function renderFeed() {

  feed.innerHTML = "";

  if (!state.posts.length) {

    feed.innerHTML = `

      <div class="empty-state">

        <strong>
          No posts yet
        </strong>

        Be the first person to post on Twyn.

      </div>

    `;

    return;

  }

  state.posts.forEach(
    post => {

      feed.appendChild(
        createPostElement(post)
      );

    }
  );

}


/* =========================================================
   CREATE POST ELEMENT
   ========================================================= */

function createPostElement(post) {

  const article =
    document.createElement(
      "article"
    );

  article.className =
    "post";

  article.innerHTML = `

    <div class="post-header">

      <div class="user-info">

        <div class="avatar">
          ${escapeHTML(post.avatar)}
        </div>

        <div class="user-details">

          <strong>
            ${escapeHTML(post.user)}
          </strong>

          <span>
            @${escapeHTML(post.username)}
            · ${escapeHTML(post.time)}
          </span>

        </div>

      </div>

      <button
        class="post-menu"
        data-action="menu"
        data-id="${post.id}"
        type="button"
      >
        •••
      </button>

    </div>

    <div class="post-text">
      ${escapeHTML(post.text)}
    </div>

    ${
      post.image
        ?
        `<img
          class="post-media"
          src="${escapeHTML(post.image)}"
          alt="Post media"
        >`
        :
        ""
    }

    <div class="post-actions">

      <button
        class="post-action ${post.liked ? "liked" : ""}"
        data-action="like"
        data-id="${post.id}"
        type="button"
      >
        ${post.liked ? "♥️" : "♡"}
        <span>${post.likes}</span>
      </button>

      <button
        class="post-action"
        data-action="comment"
        data-id="${post.id}"
        type="button"
      >
        ○
        <span>${post.comments}</span>
      </button>

      <button
        class="post-action"
        data-action="share"
        data-id="${post.id}"
        type="button"
      >
        ↗️
        <span>${post.shares}</span>
      </button>

      <button
        class="post-action ${post.saved ? "saved" : ""}"
        data-action="save"
        data-id="${post.id}"
        type="button"
      >
        ${post.saved ? "✓" : "♧"}
      </button>

      <span class="post-time">
        ${post.reach.toLocaleString()} reach
      </span>

    </div>

  `;

  return article;

}


/* =========================================================
   POST ACTIONS
   ========================================================= */

feed.addEventListener(
  "click",
  async event => {

    const button =
      event.target.closest(
        "[data-action]"
      );

    if (!button) return;

    const id =
      button.dataset.id;

    const post =
      state.posts.find(
        item =>
          String(item.id) ===
          String(id)
      );

    if (!post) return;


    /* =========================
       LIKE
       ========================= */

    if (
      button.dataset.action ===
      "like"
    ) {

      if (!currentUser) {

        alert(
          "Please log in first."
        );

        return;

      }

      if (post.liked) {

        const {
          error
        } =
          await supabaseClient
            .from("likes")
            .delete()
            .eq(
              "user_id",
              currentUser.id
            )
            .eq(
              "post_id",
              post.id
            );

        if (error) {

          console.error(
            "Unlike error:",
            error
          );

          alert(
            error.message
          );

          return;

        }

        post.liked = false;
        post.likes--;

      } else {

        const {
          error
        } =
          await supabaseClient
            .from("likes")
            .insert({
              user_id:
                currentUser.id,
              post_id:
                post.id
            });

        if (error) {

          console.error(
            "Like error:",
            error
          );

          alert(
            error.message
          );

          return;

        }

        post.liked = true;
        post.likes++;

      }

      renderFeed();

    }


    /* =========================
       COMMENT
       ========================= */

    if (
      button.dataset.action ===
      "comment"
    ) {

      if (!currentUser) {

        alert(
          "Please log in first."
        );

        return;

      }

      const comment =
        prompt(
          "Write a comment:"
        );

      if (
        !comment ||
        !comment.trim()
      ) {

        return;

      }

      const {
        error
      } =
        await supabaseClient
          .from("comments")
          .insert({
            post_id:
              post.id,
            user_id:
              currentUser.id,
            content:
              comment.trim()
          });

      if (error) {

        console.error(
          "Comment error:",
          error
        );

        alert(
          error.message
        );

        return;

      }

      post.comments++;

      renderFeed();

    }


    /* =========================
       SHARE
       ========================= */

    if (
      button.dataset.action ===
      "share"
    ) {

      post.shares++;

      const shareUrl =
        window.location.href;

      if (
        navigator.clipboard
      ) {

        navigator.clipboard
          .writeText(
            shareUrl
          )
          .catch(() => {});

      }

      alert(
        "Post link copied."
      );

      renderFeed();

    }


    /* =========================
       SAVE
       ========================= */

    if (
      button.dataset.action ===
      "save"
    ) {

      if (!currentUser) {

        alert(
          "Please log in first."
        );

        return;

      }

      if (post.saved) {

        const {
          error
        } =
          await supabaseClient
            .from("saved_posts")
            .delete()
            .eq(
              "user_id",
              currentUser.id
            )
            .eq(
              "post_id",
              post.id
            );

        if (error) {

          console.error(
            "Unsave error:",
            error
          );

          alert(
            error.message
          );

          return;

        }

        post.saved = false;

        post.saves =
          Math.max(
            0,
            post.saves - 1
          );

      } else {

        const {
          error
        } =
          await supabaseClient
            .from("saved_posts")
            .insert({
              user_id:
                currentUser.id,
              post_id:
                post.id
            });

        if (error) {

          console.error(
            "Save error:",
            error
          );

          alert(
            error.message
          );

          return;

        }

        post.saved = true;

        post.saves++;

      }

      renderFeed();

    }


    /* =========================
       MENU
       ========================= */

    if (
      button.dataset.action ===
      "menu"
    ) {

      showPostMenu(post);

    }

  }
);


/* =========================================================
   POST MENU
   ========================================================= */

function showPostMenu(post) {

  const choice =
    prompt(
      "Post options:\n\n" +
      "1 — Post Analysis\n" +
      "2 — Copy Link\n" +
      "3 — Cancel"
    );

  if (choice === "1") {

    openAnalysis(post);

  }

  if (choice === "2") {

    navigator.clipboard
      ?.writeText(
        window.location.href
      )
      .catch(() => {});

    alert(
      "Post link copied."
    );

  }

}


/* =========================================================
   POST ANALYSIS
   ========================================================= */

function calculatePulse(post) {

  const engagement =
    post.likes +
    post.comments * 2 +
    post.shares * 3 +
    post.saves * 2;

  const ratio =
    engagement /
    Math.max(
      post.reach,
      1
    );

  if (ratio >= 0.10) {

    return "HP";

  }

  if (ratio >= 0.04) {

    return "RP";

  }

  return "LP";

}


function openAnalysis(post) {

  const engagement =
    post.likes +
    post.comments +
    post.shares +
    post.saves;

  const pulse =
    calculatePulse(post);

  document.getElementById(
    "pulseStatus"
  ).textContent =
    pulse;

  document.getElementById(
    "analysisEngagement"
  ).textContent =
    engagement.toLocaleString();

  document.getElementById(
    "analysisReach"
  ).textContent =
    post.reach.toLocaleString();

  document.getElementById(
    "analysisLikes"
  ).textContent =
    post.likes.toLocaleString();

  document.getElementById(
    "analysisComments"
  ).textContent =
    post.comments.toLocaleString();

  const description = {

    HP:
      "This post is performing strongly.",

    RP:
      "This post is gaining momentum.",

    LP:
      "This post is currently receiving lower engagement."

  };

  document.getElementById(
    "pulseDescription"
  ).textContent =
    description[pulse];

  analysisModal
    .classList
    .remove("hidden");

}


document
  .getElementById("closeAnalysis")
  .addEventListener(
    "click",
    () => {

      analysisModal
        .classList
        .add("hidden");

    }
  );


analysisModal
  .querySelector(".modal-backdrop")
  .addEventListener(
    "click",
    () => {

      analysisModal
        .classList
        .add("hidden");

    }
  );


/* =========================================================
   CREATE POST
   ========================================================= */

postText.addEventListener(
  "input",
  () => {

    characterCount.textContent =
      `${postText.value.length} / 500`;

  }
);


let selectedImage = null;


imageInput.addEventListener(
  "change",
  event => {

    const file =
      event.target.files[0];

    if (!file) return;

    const reader =
      new FileReader();

    reader.onload =
      event => {

        selectedImage =
          event.target.result;

        createPreview.innerHTML =
          `
            <img
              src="${selectedImage}"
              alt="Preview"
            >
          `;

      };

    reader.readAsDataURL(file);

  }
);


/* =========================================================
   PUBLISH POST — REAL SUPABASE
   ========================================================= */

document
  .getElementById("publishBtn")
  .addEventListener(
    "click",
    async () => {

      if (!currentUser) {

        alert(
          "Please log in first."
        );

        return;

      }

      const text =
        postText.value.trim();

      if (
        !text &&
        !selectedImage
      ) {

        alert(
          "Write something or add a photo first."
        );

        return;

      }

      const publishBtn =
        document.getElementById(
          "publishBtn"
        );

      publishBtn.disabled = true;

      publishBtn.textContent =
        "Posting...";

      try {

        /*
         * For now, images are stored as a data URL.
         * Next step can move images into Supabase Storage.
         */

        const {
          data,
          error
        } =
          await supabaseClient
            .from("posts")
            .insert({
              user_id:
                currentUser.id,

              content:
                text,

              image_url:
                selectedImage,

              world:
                null
            })
            .select()
            .single();

        if (error) {

          console.error(
            "Create post error:",
            error
          );

          alert(
            error.message
          );

          return;

        }

        /*
         * Add the newly-created post to local state
         * immediately so the UI feels instant.
         */

        state.posts.unshift({

          id:
            data.id,

          userId:
            currentUser.id,

          user:
            state.profile.name,

          username:
            state.profile.username,

          avatar:
            state.profile.name
              .charAt(0)
              .toUpperCase(),

          text:
            data.content,

          image:
            data.image_url,

          world:
            data.world,

          likes: 0,

          comments: 0,

          shares: 0,

          saves: 0,

          reach: 0,

          liked: false,

          saved: false,

          time:
            "now"

        });

        postText.value = "";

        selectedImage = null;

        imageInput.value = "";

        createPreview.innerHTML =
          "";

        characterCount.textContent =
          "0 / 500";

        renderFeed();

        document
          .querySelector(
            '[data-page="homePage"]'
          )
          .click();

      } finally {

        publishBtn.disabled = false;

        publishBtn.textContent =
          "Post";

      }

    }
  );


/* =========================================================
   FRIENDS
   ========================================================= */

document
  .querySelectorAll(".friend-tab")
  .forEach(tab => {

    tab.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(
            ".friend-tab"
          )
          .forEach(item => {

            item.classList.remove(
              "active"
            );

          });

        tab.classList.add(
          "active"
        );

        renderFriends(
          tab.dataset.tab
        );

      }
    );

  });


function renderFriends(
  type = "followers"
) {

  friendsContent.innerHTML =
    "";

  let people =
    state.people;

  if (
    type === "following"
  ) {

    people =
      state.people.filter(
        person =>
          person.following
      );

  }

  if (
    type === "followers"
  ) {

    /*
     * Followers are loaded separately below.
     * For now show people available on Twyn.
     */

    people =
      state.people;

  }

  if (
    type === "recommended"
  ) {

    people =
      state.people.filter(
        person =>
          !person.following
      );

  }

  if (!people.length) {

    friendsContent.innerHTML = `

      <div class="empty-state">

        <strong>
          No people here yet
        </strong>

        Start connecting with people on Twyn.

      </div>

    `;

    return;

  }

  people.forEach(
    person => {

      const card =
        document.createElement(
          "div"
        );

      card.className =
        "person-card";

      card.innerHTML = `

        <div class="avatar">
          ${escapeHTML(person.avatar)}
        </div>

        <div class="person-info">

          <strong>
            ${escapeHTML(person.name)}
          </strong>

          <span>
            @${escapeHTML(person.username)}
          </span>

        </div>

        <button
          class="follow-btn ${
            person.following
              ? "following"
              : ""
          }"
          type="button"
        >
          ${
            person.following
              ? "Following"
              : "Follow"
          }
        </button>

      `;

      card
        .querySelector(
          ".follow-btn"
        )
        .addEventListener(
          "click",
          async event => {

            if (!currentUser) {

              return;

            }

            const button =
              event.target;

            if (
              person.following
            ) {

              const {
                error
              } =
                await supabaseClient
                  .from("follows")
                  .delete()
                  .eq(
                    "follower_id",
                    currentUser.id
                  )
                  .eq(
                    "following_id",
                    person.id
                  );

              if (error) {

                alert(
                  error.message
                );

                return;

              }

              person.following =
                false;

            } else {

              const {
                error
              } =
                await supabaseClient
                  .from("follows")
                  .insert({
                    follower_id:
                      currentUser.id,
                    following_id:
                      person.id
                  });

              if (error) {

                alert(
                  error.message
                );

                return;

              }

              person.following =
                true;

            }

            button.textContent =
              person.following
                ? "Following"
                : "Follow";

            button.classList.toggle(
              "following",
              person.following
            );

          }
        );

      friendsContent.appendChild(
        card
      );

    }
  );

}


/* =========================================================
   PROFILE
   ========================================================= */

function renderProfile() {

  updateProfileUI();

  const myPosts =
    state.posts.filter(
      post =>
        post.userId ===
        currentUser?.id
    );

  document.getElementById(
    "postCount"
  ).textContent =
    myPosts.length;

  const followerCount =
    document.getElementById(
      "followerCount"
    );

  const followingCount =
    document.getElementById(
      "followingCount"
    );

  if (followerCount) {

    loadFollowCounts();

  }

  profileFeed.innerHTML =
    "";

  if (!myPosts.length) {

    profileFeed.innerHTML = `

      <div class="empty-state">

        <strong>
          No posts yet
        </strong>

        Your posts will appear here.

      </div>

    `;

    return;

  }

  myPosts.forEach(
    post => {

      profileFeed.appendChild(
        createPostElement(post)
      );

    }
  );

}


/* =========================================================
   FOLLOW COUNTS
   ========================================================= */

async function loadFollowCounts() {

  if (!currentUser) return;

  const {
    count: followers,
    error: followersError
  } =
    await supabaseClient
      .from("follows")
      .select(
        "*",
        {
          count: "exact",
          head: true
        }
      )
      .eq(
        "following_id",
        currentUser.id
      );

  if (followersError) {

    console.error(
      followersError
    );

  }

  const {
    count: following,
    error: followingError
  } =
    await supabaseClient
      .from("follows")
      .select(
        "*",
        {
          count: "exact",
          head: true
        }
      )
      .eq(
        "follower_id",
        currentUser.id
      );

  if (followingError) {

    console.error(
      followingError
    );

  }

  const followerElement =
    document.getElementById(
      "followerCount"
    );

  const followingElement =
    document.getElementById(
      "followingCount"
    );

  if (followerElement) {

    followerElement.textContent =
      followers || 0;

  }

  if (followingElement) {

    followingElement.textContent =
      following || 0;

  }

}


/* =========================================================
   EDIT PROFILE
   ========================================================= */

document
  .getElementById("editProfileBtn")
  .addEventListener(
    "click",
    () => {

      document.getElementById(
        "editName"
      ).value =
        state.profile.name;

      document.getElementById(
        "editUsername"
      ).value =
        state.profile.username;

      document.getElementById(
        "editBio"
      ).value =
        state.profile.bio;

      profileModal
        .classList
        .remove("hidden");

    }
  );


document
  .getElementById("closeProfile")
  .addEventListener(
    "click",
    () => {

      profileModal
        .classList
        .add("hidden");

    }
  );


profileModal
  .querySelector(".modal-backdrop")
  .addEventListener(
    "click",
    () => {

      profileModal
        .classList
        .add("hidden");

    }
  );


document
  .getElementById("saveProfile")
  .addEventListener(
    "click",
    async () => {

      if (!currentUser) return;

      const newName =
        document.getElementById(
          "editName"
        ).value.trim();

      const newUsername =
        document.getElementById(
          "editUsername"
        ).value
          .trim()
          .toLowerCase()
          .replace(
            /[^a-z0-9_]/g,
            ""
          );

      const newBio =
        document.getElementById(
          "editBio"
        ).value.trim();

      if (
        !newName ||
        !newUsername
      ) {

        alert(
          "Name and username are required."
        );

        return;

      }

      const {
        data,
        error
      } =
        await supabaseClient
          .from("profiles")
          .update({

            display_name:
              newName,

            username:
              newUsername,

            bio:
              newBio,

            updated_at:
              new Date()
                .toISOString()

          })
          .eq(
            "id",
            currentUser.id
          )
          .select()
          .single();

      if (error) {

        console.error(
          "Profile update error:",
          error
        );

        alert(
          error.message
        );

        return;

      }

      state.profile.name =
        data.display_name;

      state.profile.username =
        data.username;

      state.profile.bio =
        data.bio;

      state.posts.forEach(
        post => {

          if (
            post.userId ===
            currentUser.id
          ) {

            post.user =
              data.display_name;

            post.username =
              data.username;

            post.avatar =
              data.display_name
                .charAt(0)
                .toUpperCase();

          }

        }
      );

      updateProfileUI();

      renderProfile();

      renderFeed();

      profileModal
        .classList
        .add("hidden");

    }
  );


/* =========================================================
   SEARCH
   ========================================================= */

const searchPanel =
  document.getElementById(
    "searchPanel"
  );


document
  .getElementById("searchBtn")
  .addEventListener(
    "click",
    () => {

      searchPanel
        .classList
        .toggle("hidden");

      if (
        !searchPanel
          .classList
          .contains("hidden")
      ) {

        document
          .getElementById(
            "searchInput"
          )
          .focus();

      }

    }
  );


document
  .getElementById("searchInput")
  .addEventListener(
    "input",
    event => {

      const query =
        event.target.value
          .toLowerCase()
          .trim();

      const results =
        document.getElementById(
          "searchResults"
        );

      results.innerHTML =
        "";

      if (!query) return;

      const people =
        state.people.filter(
          person =>
            person.name
              .toLowerCase()
              .includes(query) ||

            person.username
              .toLowerCase()
              .includes(query)
        );

      if (!people.length) {

        results.innerHTML = `

          <div class="empty-state">
            No results found.
          </div>

        `;

        return;

      }

      people.forEach(
        person => {

          const result =
            document.createElement(
              "div"
            );

          result.className =
            "search-result";

          result.innerHTML = `

            <strong>
              ${escapeHTML(person.name)}
            </strong>

            <span>
              @${escapeHTML(person.username)}
            </span>

          `;

          results.appendChild(
            result
          );

        }
      );

    }
  );


/* =========================================================
   WORLDS
   ========================================================= */

document
  .querySelectorAll(".world-chip")
  .forEach(chip => {

    chip.addEventListener(
      "click",
      () => {

        document
          .querySelectorAll(
            ".world-chip"
          )
          .forEach(item => {

            item.classList.remove(
              "active"
            );

          });

        chip.classList.add(
          "active"
        );

      }
    );

  });


/* =========================================================
   HELPERS
   ========================================================= */

function escapeHTML(value) {

  const div =
    document.createElement(
      "div"
    );

  div.textContent =
    value ?? "";

  return div.innerHTML;

}


/* =========================================================
   START TWYN
   ========================================================= */

updateAuthMode();

initializeAuth();
