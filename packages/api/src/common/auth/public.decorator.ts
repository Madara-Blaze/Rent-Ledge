import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Mark a route as not requiring authentication (login, signup, health). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
