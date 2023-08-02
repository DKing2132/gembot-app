import { UserValidatorResult } from '../../types/validators/UserValidatorResult';
import { prisma } from '../constants';

export class UserValidator {
  public static async validateUserExists(
    userId: string
  ): Promise<UserValidatorResult> {
    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return {
        valid: false,
        message: 'User does not exist',
      };
    }

    return {
      valid: true,
      user,
    };
  }
}
