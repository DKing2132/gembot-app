import { ValidatorResult } from '../../types/validators/ValidatorResult';

export class FrequencyValidator {
  public static validateFrequency(frequency: number): ValidatorResult {
    if (frequency <= 0) {
      return {
        valid: false,
        message: 'Frequency must be greater than 0',
      };
    }

    return { valid: true };
  }
}
