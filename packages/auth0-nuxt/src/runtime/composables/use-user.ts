import { useState } from '#imports';
import type { UserClaims } from '@auth0/auth0-server-js';

export const useUser = () => useState<UserClaims | undefined>('auth0_user', () => undefined);