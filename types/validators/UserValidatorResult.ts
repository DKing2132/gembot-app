import { User } from '@prisma/client';
import { ValidatorResult } from './ValidatorResult';

export type UserValidatorResult = {
  user?: User;
} & ValidatorResult;
