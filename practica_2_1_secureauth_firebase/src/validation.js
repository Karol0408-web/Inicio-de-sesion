export function isValidEmailFormat(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email.trim());
}

export function getPasswordRules(password) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password)
  };
}

export function isStrongPassword(password) {
  return Object.values(getPasswordRules(password)).every(Boolean);
}

export function getDomain(email) {
  return email.trim().toLowerCase().split("@")[1] || "";
}

export function updatePasswordUI(password) {
  const rules = getPasswordRules(password);
  const labels = {
    length: "Mínimo 8 caracteres",
    upper: "Una mayúscula",
    lower: "Una minúscula",
    number: "Un número",
    special: "Un carácter especial"
  };

  for (const [key, valid] of Object.entries(rules)) {
    const element = document.querySelector(`[data-rule="${key}"]`);
    if (element) {
      element.textContent = `${valid ? "✓" : "✗"} ${labels[key]}`;
      element.classList.toggle("valid", valid);
    }
  }
}

export async function validateDomain(domain) {
  const response = await fetch(`/api/validate-domain?domain=${encodeURIComponent(domain)}`);
  if (!response.ok) throw new Error("No fue posible validar el dominio.");
  return response.json();
}