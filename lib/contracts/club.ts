import type { projectClubState } from '../club-view';
import type { AppUser } from '../auth';

/** Derived from the server projection: private State fields never enter this contract. */
export type ClubView = ReturnType<typeof projectClubState>;
export type LoginAccount = { accountId: string; username: string; usernameChangedAt: number | null };
export type ClubAuth = {
  method: AppUser['method']; username: string | null; passwordEnabled: boolean;
  isOwner: boolean; canChangeUsername: boolean; usernameChangedAt: number | null;
};
export type ClubData = ClubView & { loginAccounts: LoginAccount[]; auth: ClubAuth };
export type ClubEntry = { setup: true; user: { name: string; email: string } } | { join: true; user: { name: string } };
