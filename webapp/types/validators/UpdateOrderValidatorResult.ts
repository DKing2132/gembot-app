import { UpdateOrderFields } from '../OrderFields';
import { ValidatorResult } from './ValidatorResult';

export type UpdateOrderValidatorResult = {
  fieldToUpdate?: UpdateOrderFields;
  value?: string | number;
  removeIsNativeETH?: boolean;
} & ValidatorResult;
