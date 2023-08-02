import { User } from "@prisma/client";
import { ValidatorResult } from "./ValidatorResult";

export type SellOrderValidatorResult = {
  user?: User;
} & ValidatorResult;
