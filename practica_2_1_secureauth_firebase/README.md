# Práctica 2.1 — SecureAuth

Módulo de inicio de sesión seguro para una aplicación web con Firebase Authentication.

## Requisitos cubiertos

1. Validación del formato del correo.
2. Validación del dominio mediante DNS desde el servidor.
3. Política de contraseña:
   - mínimo 8 caracteres
   - mayúsculas
   - minúsculas
   - números
   - caracteres especiales
4. La aplicación nunca guarda la contraseña en texto plano.
5. Firebase Authentication administra las credenciales y el almacenamiento seguro de contraseñas.
6. Verificación del correo electrónico.
7. MFA mediante SMS.
8. Dashboard protegido.
9. Configuración de Firebase separada mediante `.env`.
10. `.env` excluido de Git.

## 1. Crear el proyecto Firebase

En Firebase Console:

- Crea un proyecto.
- Registra una aplicación Web.
- Copia la configuración de Firebase.
- Ve a Authentication > Sign-in method.
- Activa Email/Password.
- Configura la verificación de correo.
- Habilita Multi-factor Authentication / Identity Platform según la configuración de tu proyecto.
- Activa SMS MFA.
- Configura las regiones SMS permitidas.
- Agrega `localhost` como dominio autorizado si tu proyecto no lo incluye.

## 2. Crear el proyecto local

```bash
npm install
```

Copia:

```text
.env.example
```

como:

```text
.env
```

y coloca los valores de tu aplicación Firebase.

Ejemplo:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=mi-proyecto.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=mi-proyecto
VITE_FIREBASE_STORAGE_BUCKET=mi-proyecto.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
PORT=3000
```

No subas `.env` a Git.

## 3. Ejecutar

```bash
npm run dev
```

Abre:

```text
http://localhost:5173
```

El servidor de validación DNS corre en el puerto 3000 y Vite hace proxy durante el desarrollo si se configura; si usas el proyecto tal como está, puedes ejecutar Vite en el puerto 3000 con:

```bash
npm run dev:server
```

y servir el frontend desde el mismo servidor para una prueba simple.

## 4. Flujo de la práctica

Registro:

```text
Correo
  ↓
Formato válido
  ↓
Dominio validado por DNS
  ↓
Política de contraseña
  ↓
Firebase Authentication
  ↓
Correo de verificación
  ↓
Registro de segundo factor
```

Inicio de sesión:

```text
Correo
  ↓
Contraseña
  ↓
Firebase Authentication
  ↓
¿MFA registrado?
  ├── No → Configurar MFA
  └── Sí → Solicitar código SMS
                ↓
              MFA ✓
                ↓
            Dashboard
```

## Nota sobre las API keys de Firebase

La configuración web de Firebase puede estar en el cliente y las API keys de Firebase son públicas por diseño. No deben confundirse con secretos de servidor. La protección real se realiza mediante Firebase Authentication, reglas de seguridad, App Check y restricciones de APIs.

Aun así, este proyecto usa `.env` para separar la configuración por entorno y evitar publicar accidentalmente configuraciones locales.

## Demostración para el profesor

Prueba:

- correo mal formado → rechazado
- dominio inexistente → rechazado
- contraseña `12345678` → rechazada
- contraseña `Hola123!` → aceptada
- usuario no verificado → no entra al dashboard
- usuario sin MFA → obligado a configurar MFA
- usuario con MFA → correo + contraseña + SMS
- intento directo a `/dashboard.html` sin sesión → redirigido al login
- contraseña no aparece en Firestore ni en el código de la aplicación

## Consideración

La validación DNS confirma que el dominio existe/configura registros DNS. No demuestra que una dirección de correo individual exista. La verificación de propiedad del correo se realiza mediante el correo de verificación de Firebase.
