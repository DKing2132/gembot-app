import { Link } from '@prisma/client';
import { ValidatorResult } from './ValidatorResult';

export type LinkValidatorResult = {
  link?: Link;
} & ValidatorResult;
