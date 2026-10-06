import { onAuthStateChanged, multiFactor, signOut, reload } from "firebase/auth";
import { auth } from "./firebase.js";

const email = document.getElementById("user-email");
const emailStatus = document.getElementById("email-status");
const mfaStatus = document.getElementById("mfa-status");
const uid = document.getElementById("user-uid");

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/";
    return;
  }

  await reload(user);

  if (!user.emailVerified) {
    window.location.href = "/verify-email.html";
    return;
  }

  const factors = multiFactor(user).enrolledFactors;
  if (factors.length === 0) {
    window.location.href = "/mfa.html";
    return;
  }

  email.textContent = user.email;
  emailStatus.textContent = user.emailVerified ? "✓ Verificado" : "✗ No verificado";
  mfaStatus.textContent = `✓ Activo (${factors.length} factor(es))`;
  uid.textContent = user.uid;
});

document.getElementById("logout").addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "/";
});