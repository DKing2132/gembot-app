import { ValidatorResult } from '../../types/validators/ValidatorResult';
import { unitOfTimes } from '../constants';

export class UnitOfTimeValidator {
  public static validateUnitOfTime(unitOfTime: string): ValidatorResult {
    if (!unitOfTimes.includes(unitOfTime)) {
      return {
        valid: false,
        message: `Unit of time must be one of ${unitOfTimes.join(', ')}`,
      };
    }

    return { valid: true };
  }
}
