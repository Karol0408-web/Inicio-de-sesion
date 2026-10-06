import {
  onAuthStateChanged,
  multiFactor,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  signOut,
  reload
} from "firebase/auth";
import { auth } from "./firebase.js";

const message = document.getElementById("mfa-message");
let verificationId = null;

function show(msg, type = "error") {
  message.textContent = msg;
  message.className = `message ${type}`;
}

// Inicializador seguro para reCAPTCHA
function initRecaptcha() {
  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "normal",
      callback: () => {
        // reCAPTCHA resuelto correctamente
      },
      "expired-callback": () => {
        show("El reCAPTCHA expiró, por favor inténtalo de nuevo.");
      }
    });
  }
  return window.recaptchaVerifier;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/";
    return;
  }

  try {
    await reload(user);

    if (!user.emailVerified) {
      window.location.href = "/verify-email.html";
      return;
    }

    if (multiFactor(user).enrolledFactors.length > 0) {
      window.location.href = "/dashboard.html";
      return;
    }

    // Inicializamos reCAPTCHA de manera segura solo en este punto
    initRecaptcha();

  } catch (error) {
    console.error("Error validando el estado del usuario:", error);
    show("Error al validar sesión: " + error.message);
  }
});

document.getElementById("send-code").addEventListener("click", async () => {
  const phone = document.getElementById("phone-number").value.trim();

  if (!/^\+\d{10,15}$/.test(phone)) {
    show("Usa formato internacional, por ejemplo +523312345678.");
    return;
  }

  try {
    const user = auth.currentUser;
    show("Obteniendo sesión de verificación...", "success");

    const session = await multiFactor(user).getSession();
    const recaptcha = initRecaptcha();

    const provider = new PhoneAuthProvider(auth);
    
    show("Enviando SMS...", "success");
    verificationId = await provider.verifyPhoneNumber(
      { phoneNumber: phone, session },
      recaptcha
    );

    document.getElementById("mfa-code-area").classList.remove("hidden");
    show("Código enviado. Revisa tu teléfono.", "success");
  } catch (error) {
    console.error("Error al enviar SMS:", error);
    show(`Error (${error.code || "auth/internal-error"}): ${error.message}`);
    
    // Si falla reCAPTCHA, lo limpiamos para permitir reintentar sin recargar la página
    if (window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch (e) {}
      window.recaptchaVerifier = null;
    }
  }
});

document.getElementById("finish-enroll").addEventListener("click", async () => {
  const code = document.getElementById("verification-code").value.trim();
  const displayName = document.getElementById("factor-name").value.trim() || "Teléfono principal";

  if (!/^\d{6}$/.test(code)) {
    show("El código debe contener 6 dígitos.");
    return;
  }

  try {
    show("Verificando código y activando MFA...", "success");
    const credential = PhoneAuthProvider.credential(verificationId, code);
    const assertion = PhoneMultiFactorGenerator.assertion(credential);

    await multiFactor(auth.currentUser).enroll(assertion, displayName);
    show("MFA activado correctamente. Redirigiendo...", "success");

    setTimeout(() => {
      window.location.href = "/dashboard.html";
    }, 800);
  } catch (error) {
    console.error("Error al enrolar MFA:", error);
    show(error.message);
  }
});

document.getElementById("logout-mfa").addEventListener("click", () => signOut(auth));