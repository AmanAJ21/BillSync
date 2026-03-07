import { paymentMethodService } from '../services/PaymentMethodService';
import logger from '../logger';

/**
 * Utility to create default payment method from environment variables
 * Used for testing/development auto-payments
 */

/**
 * Parse card expiry date from environment variable
 * Format: MM/YY
 * 
 * @param expiryDate - Expiry date string (MM/YY)
 * @returns Object with month and year
 */
function parseExpiryDate(expiryDate: string): { month: number; year: number } {
  const [month, year] = expiryDate.split('/');
  const yearNum = parseInt(year);
  
  // Handle 2-digit year
  // 00-99 all map to 2000-2099
  const fullYear = 2000 + yearNum;
  
  return {
    month: parseInt(month),
    year: fullYear,
  };
}

/**
 * Get last 4 digits of card number
 * 
 * @param cardNumber - Full card number
 * @returns Last 4 digits
 */
function getCardLast4(cardNumber: string): string {
  const cleanNumber = cardNumber.replace(/\s/g, '');
  return cleanNumber.slice(-4);
}

/**
 * Detect card brand from card number
 * 
 * @param cardNumber - Card number
 * @returns Card brand
 */
function detectCardBrand(cardNumber: string): string {
  const cleanNumber = cardNumber.replace(/\s/g, '');
  
  // Visa
  if (cleanNumber.startsWith('4')) {
    return 'Visa';
  }
  
  // Mastercard
  if (cleanNumber.startsWith('5')) {
    return 'Mastercard';
  }
  
  // American Express
  if (cleanNumber.startsWith('3')) {
    return 'American Express';
  }
  
  // Discover
  if (cleanNumber.startsWith('6')) {
    return 'Discover';
  }
  
  return 'Unknown';
}

/**
 * Ensure user has a default payment method for auto-payment
 * If no payment method exists, creates one from environment variables
 * 
 * @param userId - User ID
 * @returns True if payment method exists or was created, false otherwise
 */
export async function ensureDefaultPaymentMethod(userId: string): Promise<boolean> {
  try {
    // Check if user already has payment methods
    const existingMethods = await paymentMethodService.getUserPaymentMethods(userId);
    
    if (existingMethods.length > 0) {
      logger.debug({ userId, count: existingMethods.length }, 'User already has payment methods');
      return true;
    }
    
    // Check if environment variables are configured
    const cardNumber = process.env.CARD_NUMBER;
    const expiryDate = process.env.CARD_EXPIRE_DATE;
    
    if (!cardNumber || !expiryDate) {
      logger.warn({ userId }, 'No payment method found and environment variables not configured');
      return false;
    }
    
    // Parse expiry date
    const { month, year } = parseExpiryDate(expiryDate);
    
    logger.debug({ userId, month, year }, 'Parsed expiry date from environment');
    
    // Get card details
    const cardLast4 = getCardLast4(cardNumber);
    const cardBrand = detectCardBrand(cardNumber);
    
    logger.debug({ userId, cardLast4, cardBrand }, 'Detected card details');
    
    // Create default payment method
    const paymentMethod = await paymentMethodService.addPaymentMethod(userId, {
      type: 'card',
      cardLast4,
      cardBrand,
      expiryMonth: month,
      expiryYear: year,
      isDefault: true,
    });
    
    logger.info({ 
      userId, 
      cardLast4, 
      cardBrand, 
      expiryMonth: month, 
      expiryYear: year,
      paymentMethodId: paymentMethod._id 
    }, 'Created default payment method from environment variables');
    
    return true;
  } catch (error) {
    logger.error({ 
      error, 
      userId,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined
    }, 'Error ensuring default payment method');
    return false;
  }
}

/**
 * Get card details from environment variables
 * Used for displaying card info in UI
 * 
 * @returns Card details or null if not configured
 */
export function getEnvCardDetails(): {
  cardLast4: string;
  cardBrand: string;
  expiryMonth: number;
  expiryYear: number;
} | null {
  const cardNumber = process.env.CARD_NUMBER;
  const expiryDate = process.env.CARD_EXPIRE_DATE;
  
  if (!cardNumber || !expiryDate) {
    return null;
  }
  
  const { month, year } = parseExpiryDate(expiryDate);
  const cardLast4 = getCardLast4(cardNumber);
  const cardBrand = detectCardBrand(cardNumber);
  
  return {
    cardLast4,
    cardBrand,
    expiryMonth: month,
    expiryYear: year,
  };
}
