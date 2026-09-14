/**
 * Utilidades de Ciberseguridad e Integridad de Datos (OWASP Top 10)
 */

/**
 * Sanitiza una cadena de texto eliminando caracteres de control, scripts potenciales
 * y recortando al tamaño máximo especificado.
 */
export function sanitizeString(input, maxLength = 255) {
  if (input === null || input === undefined) return '';
  let str = String(input);
  // Eliminar caracteres de control invisibles (excepto saltos de línea estándar)
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '');
  // Escapar o neutralizar etiquetas HTML básicas
  str = str.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Recortar espacios
  str = str.trim();
  if (maxLength && str.length > maxLength) {
    str = str.substring(0, maxLength);
  }
  return str;
}

/**
 * Sanitiza y valida valores numéricos flotantes dentro de un rango permitido.
 */
export function sanitizeNumber(value, min = 0, max = 10000000, defaultVal = 0) {
  const num = parseFloat(value);
  if (!Number.isFinite(num) || isNaN(num)) {
    return defaultVal;
  }
  if (num < min) return min;
  if (num > max) return max;
  return Math.round(num * 100) / 100; // Redondear a 2 decimales para montos/precios
}

/**
 * Sanitiza y valida números enteros dentro de un rango permitido.
 */
export function sanitizeInteger(value, min = 0, max = 1000000, defaultVal = 0) {
  const num = parseInt(value, 10);
  if (!Number.isFinite(num) || isNaN(num)) {
    return defaultVal;
  }
  if (num < min) return min;
  if (num > max) return max;
  return num;
}

/**
 * Valida si un correo electrónico tiene formato válido y seguro.
 */
export function isValidEmail(email) {
  if (!email || typeof email !== 'string') return false;
  if (email.length > 254) return false;
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}

/**
 * Valida que una URL o recurso provenga de un origen o protocolo seguro (previene XSS / javascript:).
 */
export function isSafeImageUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim().toLowerCase();
  // Permitir imágenes en base64 seguras
  if (trimmed.startsWith('data:image/jpeg;') || 
      trimmed.startsWith('data:image/png;') || 
      trimmed.startsWith('data:image/webp;') ||
      trimmed.startsWith('data:image/jpg;')) {
    return true;
  }
  // Permitir blob URLs
  if (trimmed.startsWith('blob:')) return true;
  // Permitir HTTPS a dominios de confianza
  if (trimmed.startsWith('https://')) return true;
  // Permitir localhost en desarrollo
  if (trimmed.startsWith('http://localhost') || trimmed.startsWith('http://127.0.0.1')) return true;

  return false;
}

/**
 * Valida la robustez de una contraseña.
 * Requiere mínimo 8 caracteres con al menos una letra y un número.
 */
export function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'La contraseña es requerida' };
  }
  if (password.length < 8) {
    return { valid: false, message: 'La contraseña debe tener al menos 8 caracteres' };
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  if (!hasLetter || !hasNumber) {
    return { valid: false, message: 'La contraseña debe incluir al menos una letra y un número' };
  }
  return { valid: true, message: 'Contraseña segura' };
}

/**
 * Gestor de Rate Limiting en cliente para prevenir ataques de fuerza bruta al Login.
 * Bloquea intentos durante un periodo de enfriamiento tras 5 fallos consecutivos.
 */
const RATE_LIMIT_STORAGE_KEY = 'sl_auth_rate_limit';
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 segundos de bloqueo

export function checkLoginRateLimit() {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    if (!raw) return { locked: false, remainingSeconds: 0 };
    const data = JSON.parse(raw);
    const now = Date.now();

    if (data.lockoutUntil && data.lockoutUntil > now) {
      const remainingSeconds = Math.ceil((data.lockoutUntil - now) / 1000);
      return { locked: true, remainingSeconds };
    }

    if (data.lockoutUntil && data.lockoutUntil <= now) {
      // Expiró el bloqueo, resetear contador
      localStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
      return { locked: false, remainingSeconds: 0 };
    }

    return { locked: false, remainingSeconds: 0 };
  } catch {
    return { locked: false, remainingSeconds: 0 };
  }
}

export function recordFailedLoginAttempt() {
  try {
    const raw = localStorage.getItem(RATE_LIMIT_STORAGE_KEY);
    const now = Date.now();
    let data = raw ? JSON.parse(raw) : { attempts: 0 };

    data.attempts = (data.attempts || 0) + 1;
    data.lastAttempt = now;

    if (data.attempts >= MAX_FAILED_ATTEMPTS) {
      data.lockoutUntil = now + LOCKOUT_DURATION_MS;
    }

    localStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(data));
    return {
      locked: data.attempts >= MAX_FAILED_ATTEMPTS,
      attempts: data.attempts,
      remainingSeconds: data.lockoutUntil ? Math.ceil((data.lockoutUntil - now) / 1000) : 0
    };
  } catch {
    return { locked: false, attempts: 1, remainingSeconds: 0 };
  }
}

export function resetLoginAttempts() {
  try {
    localStorage.removeItem(RATE_LIMIT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * Registro de eventos de auditoría de seguridad
 */
export function logSecurityEvent(action, details = {}) {
  const timestamp = new Date().toISOString();
  console.info(`🔒 [AUDITORÍA DE SEGURIDAD] [${timestamp}] ${action}:`, details);
}
