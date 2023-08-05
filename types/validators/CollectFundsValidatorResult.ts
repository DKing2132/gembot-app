import { Link, User } from '@prisma/client';
import { ValidatorResult } from './ValidatorResult';

export type CollectFundsValidatorResult = {
  user?: User;
  link?: Link;
} & ValidatorResult;
