import type { User } from '../users/user.model.js';

declare module '@nestjs/authentication' {
  interface AuthenticationTypes {
    user: User;
  }
}
