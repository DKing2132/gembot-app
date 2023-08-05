import { LinkOrderBody } from '../../types/requests/LinkOrderBody';
import { LinkValidatorResult } from '../../types/validators/LinkValidatorResult';
import { ValidatorResult } from '../../types/validators/ValidatorResult';
import { prisma } from '../constants';
import { UserValidator } from './UserValidator';
import { WalletValidator } from './WalletValidator';

export class LinkValidator {
  public static async validateLink(
    userId: string,
    linkOrderBody: LinkOrderBody
  ): Promise<ValidatorResult> {
    const userValidation = await UserValidator.validateUserExists(userId);
    if (!userValidation.valid) {
      return {
        valid: false,
        message: userValidation.message,
      };
    }

    const walletValidation = WalletValidator.validateWalletAddress(
      linkOrderBody.walletAddress
    );
    if (!walletValidation.valid) {
      return {
        valid: false,
        message: walletValidation.message,
      };
    }

    return {
      valid: true,
    };
  }

  public static async validateHasLink(
    userId: string
  ): Promise<LinkValidatorResult> {
    const link = await prisma.link.findUnique({
      where: {
        userId: userId,
      },
    });

    if (!link) {
      return {
        valid: false,
        message: 'User does not have a linked wallet',
      };
    }

    return {
      valid: true,
      link: link,
    };
  }
}
