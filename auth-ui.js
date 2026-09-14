(() => {
  "use strict";

  const API_BASE = "/alive/api";
  const PROMPTED_KEY = "alive-auth-prompted";

  const ui = {
    overlay: document.querySelector("#auth-overlay"),
    accountButton: document.querySelector("#account-button"),
    accountAvatar: document.querySelector("#account-avatar"),
    accountLabel: document.querySelector("#account-label"),
    close: document.querySelector("#auth-close"),
    forms: document.querySelector("#auth-forms"),
    summary: document.querySelector("#account-summary"),
    loginTab: document.querySelector("#login-tab"),
    registerTab: document.querySelector("#register-tab"),
    loginForm: document.querySelector("#login-form"),
    registerForm: document.querySelector("#register-form"),
    loginAccount: document.querySelector("#login-account"),
    loginPassword: document.querySelector("#login-password"),
    remember: document.querySelector("#remember-login"),
    registerName: document.querySelector("#register-name"),
    registerAccount: document.querySelector("#register-account"),
    registerPassword: document.querySelector("#register-password"),
    registerConfirm: document.querySelector("#register-confirm"),
    registerTerms: document.querySelector("#register-terms"),
    message: document.querySelector("#auth-message"),
    guest: document.querySelector("#guest-button"),
    summaryAvatar: document.querySelector("#summary-avatar"),
    summaryName: document.querySelector("#summary-name"),
    summaryAccount: document.querySelector("#summary-account"),
    continueButton: document.querySelector("#continue-button"),
    logoutButton: document.querySelector("#logout-button"),
  };

  let session = null;

  async function api(path, options = {}) {
    const init = {
      method: options.method || "GET",
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    };
    if (options.body !== undefined) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }

    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, init);
    } catch {
      throw new Error("无法连接账号服务器，请检查后端服务是否已经启动。");
    }

    const data = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) throw new Error(data?.message || "请求失败，请稍后再试。");
    return data;
  }

  function publishSession() {
    window.ALIVE_USER = session;
    window.dispatchEvent(new CustomEvent("alive:auth-changed", { detail: { user: session } }));
  }

  function renderAccountState() {
    if (session) {
      const initial = session.displayName.trim().charAt(0).toUpperCase() || "A";
      ui.accountAvatar.textContent = initial;
      ui.accountLabel.textContent = session.displayName;
      ui.summaryAvatar.textContent = initial;
      ui.summaryName.textContent = session.displayName;
      ui.summaryAccount.textContent = `@${session.username}`;
    } else {
      ui.accountAvatar.textContent = "?";
      ui.accountLabel.textContent = "登录 / 创建账号";
    }
  }

  function switchMode(mode) {
    const login = mode === "login";
    ui.loginTab.classList.toggle("active", login);
    ui.registerTab.classList.toggle("active", !login);
    ui.loginTab.setAttribute("aria-selected", String(login));
    ui.registerTab.setAttribute("aria-selected", String(!login));
    ui.loginForm.hidden = !login;
    ui.registerForm.hidden = login;
    hideMessage();
    requestAnimationFrame(() => (login ? ui.loginAccount : ui.registerName).focus());
  }

  function renderOverlayContent(mode = "login") {
    ui.forms.hidden = Boolean(session);
    ui.summary.hidden = !session;
    ui.overlay.setAttribute("aria-labelledby", session ? "summary-name" : "auth-title");
    if (!session) switchMode(mode);
  }

  function openAuth(mode = "login") {
    renderOverlayContent(mode);
    ui.overlay.hidden = false;
    document.body.classList.add("auth-open");
    requestAnimationFrame(() => (session ? ui.continueButton : mode === "register" ? ui.registerName : ui.loginAccount).focus());
  }

  function closeAuth() {
    ui.overlay.hidden = true;
    document.body.classList.remove("auth-open");
    hideMessage();
    ui.accountButton.focus();
  }

  function showMessage(text, type = "error") {
    ui.message.textContent = text;
    ui.message.dataset.type = type;
    ui.message.hidden = false;
  }

  function hideMessage() {
    ui.message.hidden = true;
    ui.message.textContent = "";
  }

  function setSubmitting(form, submitting) {
    const button = form.querySelector("[type='submit']");
    button.disabled = submitting;
    button.textContent = submitting ? "正在连接…" : form === ui.loginForm ? "登录账号" : "创建并登录";
  }

  async function handleLogin(event) {
    event.preventDefault();
    hideMessage();
    const username = ui.loginAccount.value.trim().toLowerCase();
    const password = ui.loginPassword.value;
    if (!username || !password) {
      showMessage("请输入账号和密码。");
      return;
    }

    setSubmitting(ui.loginForm, true);
    try {
      const data = await api("/auth/login", {
        method: "POST",
        body: { username, password, remember: ui.remember.checked },
      });
      session = data.user;
      ui.loginPassword.value = "";
      renderAccountState();
      renderOverlayContent();
      publishSession();
    } catch (error) {
      showMessage(error.message);
      ui.loginPassword.select();
    } finally {
      setSubmitting(ui.loginForm, false);
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    hideMessage();
    const displayName = ui.registerName.value.trim();
    const username = ui.registerAccount.value.trim().toLowerCase();
    const password = ui.registerPassword.value;

    if (displayName.length < 2) {
      showMessage("显示名称至少需要 2 个字符。");
      return;
    }
    if (!/^[a-z0-9_]{4,20}$/.test(username)) {
      showMessage("账号需要使用 4–20 位字母、数字或下划线。");
      return;
    }
    if (password.length < 8) {
      showMessage("密码至少需要 8 位。");
      return;
    }
    if (password !== ui.registerConfirm.value) {
      showMessage("两次输入的密码不一致。");
      return;
    }
    if (!ui.registerTerms.checked) {
      showMessage("请确认使用该账号保存游戏数据。");
      return;
    }

    setSubmitting(ui.registerForm, true);
    try {
      const data = await api("/auth/register", {
        method: "POST",
        body: { username, displayName, password },
      });
      session = data.user;
      ui.registerForm.reset();
      renderAccountState();
      renderOverlayContent();
      publishSession();
    } catch (error) {
      showMessage(error.message);
    } finally {
      setSubmitting(ui.registerForm, false);
    }
  }

  function togglePassword(button) {
    const input = button.parentElement.querySelector("input");
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    button.textContent = visible ? "显示" : "隐藏";
    button.setAttribute("aria-label", visible ? "显示密码" : "隐藏密码");
  }

  function trapFocus(event) {
    if (event.code !== "Tab" || ui.overlay.hidden) return;
    const focusable = [...ui.overlay.querySelectorAll("button:not([disabled]), input:not([disabled])")]
      .filter((element) => !element.closest("[hidden]"));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  async function logout() {
    ui.logoutButton.disabled = true;
    try {
      await api("/auth/logout", { method: "POST" });
      session = null;
      renderAccountState();
      renderOverlayContent("login");
      showMessage("已经退出账号。", "success");
      publishSession();
    } catch (error) {
      showMessage(error.message);
    } finally {
      ui.logoutButton.disabled = false;
    }
  }

  async function restoreSession() {
    try {
      const data = await api("/auth/me");
      session = data.authenticated ? data.user : null;
    } catch {
      session = null;
    }
    renderAccountState();
    publishSession();

    let prompted = false;
    try {
      prompted = sessionStorage.getItem(PROMPTED_KEY) === "true";
      if (!prompted) sessionStorage.setItem(PROMPTED_KEY, "true");
    } catch {
      // Session storage is optional.
    }
    if (!session && !prompted) requestAnimationFrame(() => openAuth("login"));
  }

  ui.accountButton.addEventListener("click", () => openAuth("login"));
  ui.close.addEventListener("click", closeAuth);
  ui.guest.addEventListener("click", closeAuth);
  ui.continueButton.addEventListener("click", closeAuth);
  ui.loginTab.addEventListener("click", () => switchMode("login"));
  ui.registerTab.addEventListener("click", () => switchMode("register"));
  ui.loginForm.addEventListener("submit", handleLogin);
  ui.registerForm.addEventListener("submit", handleRegister);
  ui.logoutButton.addEventListener("click", logout);
  document.querySelectorAll("[data-toggle-password]").forEach((button) => button.addEventListener("click", () => togglePassword(button)));
  document.querySelector("[data-demo-help]").addEventListener("click", () => showMessage("当前版本暂不支持找回密码，请联系管理员或创建新账号。"));
  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape" && !ui.overlay.hidden) {
      event.preventDefault();
      closeAuth();
      return;
    }
    trapFocus(event);
  });

  restoreSession();
})();
