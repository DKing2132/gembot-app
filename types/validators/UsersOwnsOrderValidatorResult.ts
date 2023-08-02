import { Order } from "@prisma/client";
import { ValidatorResult } from "./ValidatorResult";

export type UsersOwnsOrderValidatorResult = {
  order?: Order
} & ValidatorResult;