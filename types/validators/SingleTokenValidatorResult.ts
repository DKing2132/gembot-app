import { Token } from "@uniswap/sdk";
import { ValidatorResult } from "./ValidatorResult";

export type SingleTokenValidatorResult = {
  token?: Token;
} & ValidatorResult;
