// Protects pages that require authentication

const protectedPages = ["map.html", "settings.html", "changePW.html", "changeUN.html"];

if (protectedPages.some(p => window.location.pathname.includes(p))) {
  if (!localStorage.getItem("authToken")) {
    window.location.href = "login.html";
  }
}

function ForgotPassword() {
    alert("Password reset link has been sent to your email (simulated).");
    window.location.href = "map.html";
}

function ChangePassword() {
    alert("Password changed successfully (simulated). Please log in again.");
    localStorage.clear();
    window.location.href = "login.html";
}

function ChangeUsername() {
    alert("Username changed successfully (simulated). Please log in again.");
    localStorage.clear();
    window.location.href = "settings.html";
}

// Frontend to Backend Connection
// ================== CONFIG ==================
const API_BASE = "";

// ================== SAVE AUTH ==================
function saveAuth(token, user) {
  localStorage.setItem("authToken", token);
  localStorage.setItem("authUser", JSON.stringify(user));
}

function clearAuth() {
  localStorage.removeItem("authToken");
  localStorage.removeItem("authUser");
}

// ================== LOGIN ==================
const loginForm = document.getElementById("loginForm");

if (loginForm) {
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;
    const msg = document.getElementById("loginMsg");

    msg.textContent = "Logging in.";
    msg.style.color = "white";

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Login failed");
      }

      saveAuth(data.token, data.user);

      msg.textContent = "Login successful!";
      msg.style.color = "lightgreen";

      setTimeout(() => {
        window.location.href = "map.html";
      }, 800);

    } catch (err) {
      msg.textContent = err.message;
      msg.style.color = "red";
    }
  });
}

// ================== REGISTER ==================
const registerForm = document.getElementById("registerForm");

if (registerForm) {
  registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("regEmail").value.trim();
    const username = document.getElementById("regUsername").value.trim();
    const password = document.getElementById("regPassword").value;
    const msg = document.getElementById("registerMsg");

    msg.textContent = "Creating account.";
    msg.style.color = "white";

    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, username, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Registration failed");
      }

      msg.textContent = "Registration successful! Redirecting.";
      msg.style.color = "lightgreen";

      setTimeout(() => {
        window.location.href = "login.html";
      }, 1200);

    } catch (err) {
      msg.textContent = err.message;
      msg.style.color = "red";
    }
  });
}

// ================== LOGOUT ==================
function LogOut() {
  clearAuth();
  window.location.href = "html/login.html";
}

function getToken() {
  return localStorage.getItem("authToken");
}

function setMsg(el, text, color = "white") {
  if (!el) return;
  el.textContent = text;
  el.style.color = color;
}

const changeUNForm = document.getElementById("changeUNForm");

if (changeUNForm) {
  changeUNForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const newUsername = document.getElementById("newUsername").value.trim();
    const msg = document.getElementById("changeUNMsg");

    setMsg(msg, "Updating username.");

    try {
      const res = await fetch(`${API_BASE}/api/user/username`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        },
        body: JSON.stringify({ newUsername })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Username update failed");

      // Update local stored user (optional but nice)
      const user = JSON.parse(localStorage.getItem("authUser") || "{}");
      user.username = data.username;
      localStorage.setItem("authUser", JSON.stringify(user));

      setMsg(msg, "Username updated!", "lightgreen");

      setTimeout(() => (window.location.href = "settings.html"), 900);
    } catch (err) {
      setMsg(msg, err.message, "red");
    }
  });
}

const changePWForm = document.getElementById("changePWForm");

if (changePWForm) {
  changePWForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const currentPassword = document.getElementById("currentPassword").value;
    const newPassword = document.getElementById("newPassword").value;
    const msg = document.getElementById("changePWMsg");

    setMsg(msg, "Updating password.");

    try {
      const res = await fetch(`${API_BASE}/api/user/password`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${getToken()}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });

      const data = await res.json();

      if (!res.ok) throw new Error(data.message || "Password update failed");

      setMsg(msg, "Password updated. Please login again.", "lightgreen");

      // force re-login for safety
      localStorage.clear();
      setTimeout(() => (window.location.href = "login.html"), 1200);
    } catch (err) {
      setMsg(msg, err.message, "red");
    }
  });
}

// Dynamic Welcome Text in Settings
// ================== DYNAMIC WELCOME ==================
const welcomeText = document.getElementById("welcomeText");

if (welcomeText) {
  const user = JSON.parse(localStorage.getItem("authUser") || "{}");

  if (user.username) {
    welcomeText.innerHTML = `Welcome to <strong>24AM Radar</strong>, ${user.username}.`;
  } else {
    welcomeText.textContent = "Welcome to 24AM Radar.";
  }
}