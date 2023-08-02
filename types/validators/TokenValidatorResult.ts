import { Token } from "@uniswap/sdk";
import { ValidatorResult } from "./ValidatorResult";

export type TokenValidatorResult = {
  depositedToken?: Token;
  desiredToken?: Token;
} & ValidatorResult;