import {
  onAuthStateChanged,
  sendEmailVerification,
  reload,
  signOut
} from "firebase/auth";
import { auth } from "./firebase.js";

const text = document.getElementById("verify-text");
const message = document.getElementById("verify-message");

function show(msg, type = "error") {
  message.textContent = msg;
  message.className = `message ${type}`;
}

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "/";
    return;
  }
  text.textContent = `Enviamos un enlace de verificación a ${user.email}.`;
});

document.getElementById("resend").addEventListener("click", async () => {
  try {
    await sendEmailVerification(auth.currentUser);
    show("Correo de verificación reenviado.", "success");
  } catch (error) {
    show(error.message);
  }
});

document.getElementById("refresh").addEventListener("click", async () => {
  try {
    await reload(auth.currentUser);
    if (!auth.currentUser.emailVerified) {
      show("El correo todavía no aparece como verificado.");
      return;
    }
    window.location.href = "/mfa.html";
  } catch (error) {
    show(error.message);
  }
});

document.getElementById("logout").addEventListener("click", () => signOut(auth));