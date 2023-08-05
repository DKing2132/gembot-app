import { User } from '@prisma/client';
import { ValidatorResult } from './ValidatorResult';

export type BuyOrderValidatorResult = {
  user?: User;
} & ValidatorResult;
