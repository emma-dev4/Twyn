/* =========================================================
   TWYN — SUPABASE CONNECTION + AUTH
   ========================================================= */

const SUPABASE_URL = "https://zzcyrznqxunmgivpqryi.supabase.co";
  

const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_e3I2Yv5RX525vbQ_9W_Wpg_0c9vQklI";

const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
  );


/* =========================================================
   SIGN UP
   ========================================================= */

async function twynSignUp(
  email,
  password,
  name
) {

  try {

    const username =
      name
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 20)
        || "twynuser";

    const {
      data,
      error
    } =
      await supabaseClient.auth.signUp({

        email: email,

        password: password,

        options: {

          data: {

            display_name:
              name,

            username:
              username

          }

        }

      });

    if (error) {

      console.error(
        "Twyn signup error:",
        error
      );

      return {

        success: false,

        error:
          error.message

      };

    }

    return {

      success: true,

      user:
        data.user,

      session:
        data.session

    };

  } catch (error) {

    console.error(
      "Twyn signup exception:",
      error
    );

    return {

      success: false,

      error:
        "Could not connect to Twyn. Check your internet connection and Supabase settings."

    };

  }

}


/* =========================================================
   LOGIN
   ========================================================= */

async function twynLogin(
  email,
  password
) {

  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth.signInWithPassword({

        email: email,

        password: password

      });

    if (error) {

      console.error(
        "Twyn login error:",
        error
      );

      return {

        success: false,

        error:
          error.message

      };

    }

    return {

      success: true,

      user:
        data.user,

      session:
        data.session

    };

  } catch (error) {

    console.error(
      "Twyn login exception:",
      error
    );

    return {

      success: false,

      error:
        "Could not connect to Twyn."

    };

  }

}


/* =========================================================
   GET CURRENT USER
   ========================================================= */

async function getTwynUser() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth.getUser();

    if (error) {

      console.error(
        "Get Twyn user error:",
        error
      );

      return null;

    }

    return data.user || null;

  } catch (error) {

    console.error(
      "Get Twyn user exception:",
      error
    );

    return null;

  }

}


/* =========================================================
   GET CURRENT SESSION
   ========================================================= */

async function getTwynSession() {

  try {

    const {
      data,
      error
    } =
      await supabaseClient.auth.getSession();

    if (error) {

      console.error(
        "Get Twyn session error:",
        error
      );

      return null;

    }

    return data.session || null;

  } catch (error) {

    console.error(
      "Get Twyn session exception:",
      error
    );

    return null;

  }

}


/* =========================================================
   LOGOUT
   ========================================================= */

async function twynLogout() {

  try {

    const {
      error
    } =
      await supabaseClient.auth.signOut();

    if (error) {

      return {

        success: false,

        error:
          error.message

      };

    }

    return {

      success: true

    };

  } catch (error) {

    console.error(
      "Twyn logout error:",
      error
    );

    return {

      success: false,

      error:
        "Could not log out."

    };

  }

}


/* =========================================================
   AUTH STATE LISTENER
   ========================================================= */

supabaseClient.auth.onAuthStateChange(
  (event, session) => {

    console.log(
      "Twyn auth event:",
      event
    );

  }
);


console.log(
  "Twyn Supabase client initialized."
);
