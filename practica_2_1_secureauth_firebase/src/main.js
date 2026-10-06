import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  getMultiFactorResolver,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier
} from "firebase/auth";
import { auth } from "./firebase.js";
import {
  isValidEmailFormat,
  isStrongPassword,
  getPasswordRules,
  getDomain,
  updatePasswordUI,
  validateDomain
} from "./validation.js";

const $ = (id) => document.getElementById(id);
const loginMessage = $("login-message");
const registerMessage = $("register-message");
let loginResolver = null;
let loginRecaptcha = null;
let loginVerificationId = null;

function showMessage(element, message, type = "error") {
  element.textContent = message;
  element.className = `message ${type}`;
}

function setTab(tab) {
  document.querySelectorAll(".tab").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });
  $("login-panel").classList.toggle("hidden", tab !== "login");
  $("register-panel").classList.toggle("hidden", tab !== "register");
}

document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => setTab(btn.dataset.tab));
});

$("register-password").addEventListener("input", (e) => {
  updatePasswordUI(e.target.value);
});

$("register-email").addEventListener("blur", async (e) => {
  const email = e.target.value.trim();
  const status = $("domain-status");
  if (!email) return;
  if (!isValidEmailFormat(email)) {
    status.textContent = "✗ El formato del correo no es válido.";
    status.className = "field-status invalid";
    return;
  }

  status.textContent = "Comprobando dominio...";
  status.className = "field-status checking";

  try {
    const result = await validateDomain(getDomain(email));
    status.textContent = result.exists
      ? `✓ Dominio válido: ${result.domain}`
      : `✗ El dominio no tiene registros DNS de correo o no existe.`;
    status.className = `field-status ${result.exists ? "valid" : "invalid"}`;
  } catch {
    status.textContent = "⚠ No fue posible comprobar el dominio.";
    status.className = "field-status invalid";
  }
});

$("register-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("register-email").value.trim().toLowerCase();
  const password = $("register-password").value;
  const confirm = $("register-confirm").value;

  if (!isValidEmailFormat(email)) {
    showMessage(registerMessage, "Introduce un correo electrónico válido.");
    return;
  }

  const domain = getDomain(email);
  try {
    const domainResult = await validateDomain(domain);
    if (!domainResult.exists) {
      showMessage(registerMessage, "El dominio del correo no existe o no tiene registros DNS válidos.");
      return;
    }
  } catch {
    showMessage(registerMessage, "No se pudo validar el dominio. Inténtalo nuevamente.");
    return;
  }

  if (!isStrongPassword(password)) {
    showMessage(registerMessage, "La contraseña no cumple todos los requisitos de seguridad.");
    return;
  }

  if (password !== confirm) {
    showMessage(registerMessage, "Las contraseñas no coinciden.");
    return;
  }

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await sendEmailVerification(credential.user);
    window.location.href = "/verify-email.html";
  } catch (error) {
    showMessage(registerMessage, firebaseError(error));
  }
});

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = $("login-email").value.trim().toLowerCase();
  const password = $("login-password").value;

  if (!isValidEmailFormat(email)) {
    showMessage(loginMessage, "Introduce un correo válido.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    // If MFA is not enrolled, the user can authenticate the first factor.
    // We redirect to verification/enrollment before allowing dashboard access.
    const user = auth.currentUser;
    await user.reload();

    if (!user.emailVerified) {
      window.location.href = "/verify-email.html";
      return;
    }

    if (!user.multiFactor || user.multiFactor.enrolledFactors.length === 0) {
      window.location.href = "/mfa.html";
      return;
    }

    // An enrolled MFA user normally does not reach this point on a password-only
    // login; Firebase throws auth/multi-factor-auth-required and is handled below.
    window.location.href = "/dashboard.html";
  } catch (error) {
    if (error.code === "auth/multi-factor-auth-required") {
      await startMfaLogin(error);
      return;
    }
    showMessage(loginMessage, firebaseError(error));
  }
});

async function startMfaLogin(error) {
  loginResolver = getMultiFactorResolver(auth, error);

  const hint = loginResolver.hints.find(
    (item) => item.factorId === PhoneMultiFactorGenerator.FACTOR_ID
  );

  if (!hint) {
    showMessage(loginMessage, "No se encontró un segundo factor compatible.");
    return;
  }

  $("login-form").classList.add("hidden");

  const mfaBox = document.createElement("div");
  mfaBox.id = "login-mfa-box";
  mfaBox.innerHTML = `
    <h3>Segundo factor requerido</h3>
    <p class="muted">Se enviará un código al teléfono terminado en ${hint.phoneNumber.slice(-4)}.</p>
    <div id="login-recaptcha"></div>
    <button id="send-login-code" class="primary-btn">Enviar código SMS</button>
    <div id="login-code-area" class="hidden">
      <label for="login-mfa-code">Código SMS</label>
      <input id="login-mfa-code" inputmode="numeric" maxlength="6">
      <button id="verify-login-code" class="primary-btn">Verificar segundo factor</button>
    </div>
  `;
  $("login-panel").appendChild(mfaBox);

  loginRecaptcha = new RecaptchaVerifier(auth, "login-recaptcha", { size: "normal" });

  $("send-login-code").addEventListener("click", async () => {
    try {
      const provider = new PhoneAuthProvider(auth);
      const options = {
        multiFactorHint: hint,
        session: loginResolver.session
      };
      loginVerificationId = await provider.verifyPhoneNumber(options, loginRecaptcha);
      $("login-code-area").classList.remove("hidden");
      showMessage(loginMessage, "Código enviado. Revisa tu teléfono.", "success");
    } catch (err) {
      showMessage(loginMessage, firebaseError(err));
      try { loginRecaptcha.clear(); } catch {}
    }
  });

  $("login-panel").addEventListener("click", async (event) => {
    if (event.target.id !== "verify-login-code") return;
    const code = $("login-mfa-code").value.trim();

    if (!/^\d{6}$/.test(code)) {
      showMessage(loginMessage, "El código debe contener 6 dígitos.");
      return;
    }

    try {
      const credential = PhoneAuthProvider.credential(loginVerificationId, code);
      const assertion = PhoneMultiFactorGenerator.assertion(credential);
      await loginResolver.resolveSignIn(assertion);
      window.location.href = "/dashboard.html";
    } catch (err) {
      showMessage(loginMessage, firebaseError(err));
    }
  }, { once: false });
}

$("reset-password").addEventListener("click", async () => {
  const email = $("login-email").value.trim().toLowerCase();
  if (!isValidEmailFormat(email)) {
    showMessage(loginMessage, "Primero escribe un correo válido.");
    return;
  }

  try {
    await sendPasswordResetEmail(auth, email);
    showMessage(loginMessage, "Si la cuenta existe, recibirás instrucciones para restablecer la contraseña.", "success");
  } catch (error) {
    showMessage(loginMessage, firebaseError(error));
  }
});

function firebaseError(error) {
  const messages = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/user-not-found": "Correo o contraseña incorrectos.",
    "auth/wrong-password": "Correo o contraseña incorrectos.",
    "auth/email-already-in-use": "Ese correo ya está registrado.",
    "auth/weak-password": "La contraseña no cumple la política.",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos.",
    "auth/invalid-verification-code": "El código de verificación no es válido.",
    "auth/code-expired": "El código ha expirado. Solicita uno nuevo.",
    "auth/quota-exceeded": "Se alcanzó un límite temporal del servicio.",
    "auth/operation-not-allowed": "El método de autenticación no está habilitado en Firebase."
  };
  return messages[error.code] || `Error de autenticación: ${error.message}`;
}