/**
 * Utilidades para validación y formateo de números de teléfono
 */

// Códigos de país comunes para América Latina
const COUNTRY_CODES = {
    'CO': '57',  // Colombia
    'MX': '52',  // México
    'AR': '54',  // Argentina
    'CL': '56',  // Chile
    'PE': '51',  // Perú
    'EC': '593', // Ecuador
    'VE': '58',  // Venezuela
    'BO': '591', // Bolivia
    'PY': '595', // Paraguay
    'UY': '598', // Uruguay
    'CR': '506', // Costa Rica
    'PA': '507', // Panamá
    'GT': '502', // Guatemala
    'HN': '504', // Honduras
    'SV': '503', // El Salvador
    'NI': '505', // Nicaragua
    'CU': '53',  // Cuba
    'DO': '1809', // República Dominicana
    'PR': '1787', // Puerto Rico
    'US': '1',   // Estados Unidos
    'CA': '1',   // Canadá
    'ES': '34',  // España
    'BR': '55',  // Brasil
};

// Código de país por defecto (configurable)
const DEFAULT_COUNTRY_CODE = '57'; // Colombia por defecto

class PhoneUtils {
    
    /**
     * Detecta si un número ya tiene código de país
     */
    static hasCountryCode(phone) {
        // Limpiar el número
        const cleaned = phone.replace(/[^\d]/g, '');
        
        // Si empieza con +, definitivamente tiene código de país
        if (phone.startsWith('+')) return true;
        
        // Si tiene más de 10 dígitos, probablemente tiene código de país
        if (cleaned.length > 10) return true;
        
        // Verificar si empieza con algún código de país conocido
        for (const code of Object.values(COUNTRY_CODES)) {
            if (cleaned.startsWith(code)) return true;
        }
        
        return false;
    }
    
    /**
     * Limpia y formatea un número de teléfono
     */
    static cleanPhone(phone) {
        if (!phone) return null;
        
        // Remover todos los caracteres no numéricos excepto el +
        let cleaned = phone.toString().replace(/[^\d+]/g, '');
        
        // Si empieza con +, removerlo para procesamiento
        if (cleaned.startsWith('+')) {
            cleaned = cleaned.substring(1);
        }
        
        return cleaned;
    }
    
    /**
     * Formatea un número con código de país
     */
    static formatWithCountryCode(phone, countryCode = DEFAULT_COUNTRY_CODE) {
        const cleaned = this.cleanPhone(phone);
        if (!cleaned) return null;
        
        // Si ya tiene código de país, devolverlo tal como está
        if (this.hasCountryCode(phone)) {
            return cleaned;
        }
        
        // Agregar código de país por defecto
        return `${countryCode}${cleaned}`;
    }
    
    /**
     * Convierte a formato JID de WhatsApp
     */
    static toWhatsAppJID(phone, countryCode = DEFAULT_COUNTRY_CODE) {
        const formatted = this.formatWithCountryCode(phone, countryCode);
        if (!formatted) return null;
        
        return formatted.includes('@') ? formatted : `${formatted}@s.whatsapp.net`;
    }
    
    /**
     * Valida si un número de teléfono es válido
     */
    static isValid(phone) {
        const cleaned = this.cleanPhone(phone);
        if (!cleaned) return false;
        
        // Debe tener al menos 7 dígitos y máximo 15 (estándar E.164)
        if (cleaned.length < 7 || cleaned.length > 15) return false;
        
        // Solo debe contener dígitos
        return /^\d+$/.test(cleaned);
    }
    
    /**
     * Detecta automáticamente el código de país basado en patrones
     */
    static detectCountryCode(phone) {
        const cleaned = this.cleanPhone(phone);
        if (!cleaned) return DEFAULT_COUNTRY_CODE;
        
        // Patrones específicos por país
        const patterns = {
            '57': /^(3\d{9}|[1-8]\d{6,7})$/,     // Colombia: móviles 3XXXXXXXXX o fijos
            '52': /^(1\d{10}|[2-9]\d{7,8})$/,    // México
            '54': /^(9\d{10}|[1-9]\d{7,9})$/,    // Argentina
            '56': /^([2-9]\d{7,8})$/,             // Chile
            '51': /^(9\d{8}|[1-7]\d{6,7})$/,     // Perú
            '1': /^[2-9]\d{9}$/,                  // Estados Unidos/Canadá
        };
        
        // Verificar patrones
        for (const [code, pattern] of Object.entries(patterns)) {
            if (pattern.test(cleaned)) {
                return code;
            }
        }
        
        // Si no encuentra patrón, usar código por defecto
        return DEFAULT_COUNTRY_CODE;
    }
    
    /**
     * Formatea un número de teléfono con auto-detección de país
     */
    static smartFormat(phone) {
        if (!phone) return null;
        
        const cleaned = this.cleanPhone(phone);
        if (!cleaned) return null;
        
        // Si ya tiene código de país, devolverlo
        if (this.hasCountryCode(phone)) {
            return cleaned;
        }
        
        // Auto-detectar código de país
        const countryCode = this.detectCountryCode(cleaned);
        return `${countryCode}${cleaned}`;
    }
    
    /**
     * Obtiene información del número
     */
    static getPhoneInfo(phone) {
        const cleaned = this.cleanPhone(phone);
        const hasCountryCode = this.hasCountryCode(phone);
        const formatted = this.smartFormat(phone);
        const isValid = this.isValid(phone);
        
        return {
            original: phone,
            cleaned,
            formatted,
            hasCountryCode,
            isValid,
            jid: this.toWhatsAppJID(phone),
            length: cleaned ? cleaned.length : 0
        };
    }
    
    /**
     * Configura el código de país por defecto
     */
    static setDefaultCountryCode(code) {
        DEFAULT_COUNTRY_CODE = code;
    }
    
    /**
     * Obtiene el código de país por defecto
     */
    static getDefaultCountryCode() {
        return DEFAULT_COUNTRY_CODE;
    }
    
    /**
     * Lista todos los códigos de país disponibles
     */
    static getAvailableCountryCodes() {
        return COUNTRY_CODES;
    }
}

module.exports = PhoneUtils;
