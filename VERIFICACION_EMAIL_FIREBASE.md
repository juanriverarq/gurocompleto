# 📧 Guía para Verificar Email Firebase desde la Base de Datos

## 🎯 Descripción General

Esta guía te muestra todas las formas disponibles para verificar el estado de verificación de emails en el sistema Guro, que usa Firebase Authentication + Laravel.

### Campo Clave en la BD

- **`email_verified_at`**: Campo timestamp en la tabla `users`
  - `NULL` = Email NO verificado
  - `TIMESTAMP` = Email verificado (fecha y hora de verificación)

---

## 📋 Métodos Disponibles

### 1. 🎨 Comando Artisan (Método Recomendado)

#### Ver estadísticas generales
```bash
cd backend
php artisan email:check-verification
```

**Output:**
- Total de usuarios
- Emails verificados/no verificados
- Usuarios por proveedor (email, google, firebase)
- Lista de usuarios no verificados
- Opción interactiva para marcar como verificados

#### Verificar usuario específico
```bash
php artisan email:check-verification usuario@ejemplo.com
```

**Output:**
- Información completa del usuario
- Estado de verificación
- Opción para marcar como verificado si no lo está

---

### 2. 📜 Script PHP Directo

```bash
cd backend

# Ver estadísticas generales
php check_email_verification.php

# Verificar usuario específico
php check_email_verification.php usuario@ejemplo.com
```

---

### 3. 🗄️ Consultas SQL Directas

Conecta a tu base de datos MySQL/PostgreSQL:

#### Ver todos los usuarios y su estado
```sql
SELECT 
    id,
    name,
    email,
    firebase_uid,
    provider,
    CASE 
        WHEN email_verified_at IS NOT NULL THEN 'Verificado'
        ELSE 'No verificado'
    END as estado,
    email_verified_at,
    created_at
FROM users
ORDER BY created_at DESC;
```

#### Ver solo usuarios verificados
```sql
SELECT id, name, email, firebase_uid, email_verified_at, provider
FROM users
WHERE email_verified_at IS NOT NULL;
```

#### Ver solo usuarios NO verificados
```sql
SELECT id, name, email, firebase_uid, provider, created_at
FROM users
WHERE email_verified_at IS NULL;
```

#### Estadísticas de verificación
```sql
SELECT 
    COUNT(*) as total_usuarios,
    SUM(CASE WHEN email_verified_at IS NOT NULL THEN 1 ELSE 0 END) as verificados,
    SUM(CASE WHEN email_verified_at IS NULL THEN 1 ELSE 0 END) as no_verificados,
    ROUND(SUM(CASE WHEN email_verified_at IS NOT NULL THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as porcentaje_verificados
FROM users;
```

#### Verificar usuario específico
```sql
SELECT 
    id, 
    name, 
    email, 
    firebase_uid, 
    CASE 
        WHEN email_verified_at IS NOT NULL THEN 'Verificado'
        ELSE 'No verificado'
    END as estado_verificacion,
    email_verified_at,
    provider,
    user_type,
    status
FROM users
WHERE email = 'usuario@ejemplo.com';
```

#### Marcar email como verificado manualmente (SQL)
```sql
UPDATE users 
SET email_verified_at = NOW() 
WHERE email = 'usuario@ejemplo.com';
```

---

### 4. 💻 Laravel Tinker (Interactivo)

```bash
cd backend
php artisan tinker
```

Luego ejecuta estos comandos:

```php
// Buscar usuario por email
$user = User::where('email', 'usuario@ejemplo.com')->first();

// Verificar si el email está verificado
$user->hasVerifiedEmail(); // Retorna: true o false

// Ver la fecha de verificación
$user->email_verified_at; // Retorna: timestamp o null

// Marcar email como verificado manualmente
$user->markEmailAsVerified();

// Ver todos los usuarios verificados
User::whereNotNull('email_verified_at')->get(['id', 'name', 'email']);

// Ver usuarios NO verificados
User::whereNull('email_verified_at')->get(['id', 'name', 'email']);

// Contar usuarios verificados
User::whereNotNull('email_verified_at')->count();

// Contar usuarios NO verificados
User::whereNull('email_verified_at')->count();

// Buscar por firebase_uid
$user = User::where('firebase_uid', 'abc123xyz')->first();
if ($user && $user->hasVerifiedEmail()) {
    echo "Email verificado ✓";
} else {
    echo "Email NO verificado ✗";
}

// Ver usuarios por proveedor
User::where('provider', 'google')->count(); // Google
User::where('provider', 'email')->count(); // Email/Contraseña
User::where('provider', 'firebase')->count(); // Firebase

// Marcar TODOS los emails como verificados (usar con precaución)
User::whereNull('email_verified_at')->update(['email_verified_at' => now()]);
```

---

### 5. 🌐 Endpoint API (Desde Frontend/Postman)

#### Endpoint
```
POST https://guro.co/api/auth/check-email-verification
```

#### Headers
```
Authorization: Bearer {FIREBASE_ID_TOKEN}
Content-Type: application/json
```

#### Body (Opcional)
```json
{
  "email": "usuario@ejemplo.com"
}
```

Si no envías `email`, verificará el usuario autenticado (del token).

#### Response (Exitoso)
```json
{
  "success": true,
  "user": {
    "id": 1,
    "name": "Juan Pérez",
    "email": "juan@ejemplo.com",
    "firebase_uid": "abc123xyz",
    "provider": "google",
    "email_verified": true,
    "email_verified_at": "2025-01-10T14:30:00.000000Z",
    "user_type": "MASTER",
    "status": "active",
    "created_at": "2025-01-01T10:00:00.000000Z",
    "last_login_at": "2025-01-14T09:15:00.000000Z"
  }
}
```

#### Ejemplo con cURL
```bash
curl -X POST https://guro.co/api/auth/check-email-verification \
  -H "Authorization: Bearer YOUR_FIREBASE_ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email": "usuario@ejemplo.com"}'
```

#### Ejemplo con JavaScript (Frontend)
```javascript
import { getAuth } from 'firebase/auth';
import axios from 'axios';

const checkEmailVerification = async (email) => {
  const auth = getAuth();
  const idToken = await auth.currentUser.getIdToken();
  
  try {
    const response = await axios.post(
      'https://guro.co/api/auth/check-email-verification',
      { email }, // Opcional, si no se envía verifica el usuario autenticado
      {
        headers: {
          'Authorization': `Bearer ${idToken}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Email verificado:', response.data.user.email_verified);
    console.log('Fecha verificación:', response.data.user.email_verified_at);
    return response.data;
  } catch (error) {
    console.error('Error verificando email:', error.response?.data);
    throw error;
  }
};

// Uso
checkEmailVerification('usuario@ejemplo.com');
```

---

## 🔍 Casos de Uso Comunes

### 1. Verificar si un usuario específico tiene email verificado
```bash
# Opción 1: Artisan
php artisan email:check-verification usuario@ejemplo.com

# Opción 2: Tinker
php artisan tinker
>>> User::where('email', 'usuario@ejemplo.com')->first()->hasVerifiedEmail()
```

### 2. Ver todos los usuarios sin verificar
```bash
# Opción 1: Artisan (muestra automáticamente si hay menos de 20)
php artisan email:check-verification

# Opción 2: SQL
SELECT * FROM users WHERE email_verified_at IS NULL;
```

### 3. Marcar un email como verificado manualmente
```bash
# Opción 1: Artisan (interactivo)
php artisan email:check-verification usuario@ejemplo.com
# Luego responder 'yes' cuando pregunte

# Opción 2: Tinker
php artisan tinker
>>> User::where('email', 'usuario@ejemplo.com')->first()->markEmailAsVerified()
```

### 4. Ver estadísticas generales
```bash
php artisan email:check-verification
```

---

## 🚨 Notas Importantes

### Verificación Automática
El sistema verifica automáticamente los emails en estos casos:

1. **Login con Google**: El email se marca como verificado automáticamente
   ```php
   // Ver: AuthController.php línea 156
   'email_verified_at' => now(),
   ```

2. **Sincronización con Firebase**: Cuando Firebase confirma que el email está verificado

### Verificación Manual
Solo usa la verificación manual cuando:
- Un usuario reporta problemas de acceso
- Necesitas verificar emails para testing
- Migraste usuarios de otro sistema

### Seguridad
- El campo `email_verified_at` es un timestamp, no un booleano
- Firebase maneja la verificación real del email
- Laravel solo sincroniza el estado con Firebase

---

## 🛠️ Troubleshooting

### El campo email_verified_at está NULL pero el usuario usa Google
**Solución:**
```bash
php artisan tinker
>>> $user = User::where('email', 'usuario@gmail.com')->first();
>>> $user->markEmailAsVerified();
```

### Necesito verificar todos los usuarios de Google
```bash
php artisan tinker
>>> User::where('provider', 'google')->whereNull('email_verified_at')->update(['email_verified_at' => now()]);
```

### El comando Artisan no existe
**Solución:** Asegúrate de ejecutar desde la carpeta `backend`:
```bash
cd /Users/mac/Documents/GUROFINAL/backend
php artisan email:check-verification
```

---

## 📊 Resumen Rápido

| Método | Comando | Cuándo Usarlo |
|--------|---------|---------------|
| Artisan | `php artisan email:check-verification` | Verificación rápida y estadísticas |
| Artisan específico | `php artisan email:check-verification email@x.com` | Verificar un usuario |
| Script PHP | `php check_email_verification.php` | Sin Artisan disponible |
| SQL | Ver queries arriba | Acceso directo a BD |
| Tinker | `php artisan tinker` | Testing y debugging interactivo |
| API | `POST /api/auth/check-email-verification` | Desde frontend/app móvil |

---

## 📝 Archivos Relacionados

- **Migración**: `backend/database/migrations/2025_07_06_171149_create_users_table.php`
- **Modelo**: `backend/app/Models/User.php`
- **Controlador**: `backend/app/Http/Controllers/Api/AuthController.php`
- **Comando**: `backend/app/Console/Commands/CheckEmailVerification.php`
- **Script**: `backend/check_email_verification.php`
- **Rutas**: `backend/routes/api.php`

---

## 🎯 Conclusión

Ahora tienes **6 métodos diferentes** para verificar el estado de emails en tu sistema:

1. ✅ Comando Artisan (más fácil)
2. ✅ Script PHP directo
3. ✅ Consultas SQL
4. ✅ Laravel Tinker (más flexible)
5. ✅ Endpoint API (desde frontend)
6. ✅ phpMyAdmin/Adminer (visual)

**Recomendación:** Para uso diario, usa el comando Artisan. Para debugging profundo, usa Tinker.
