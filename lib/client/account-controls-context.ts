'use client';
import {createContext} from 'react';
export type AccountControlsProps = {isOwner: boolean; role: string; method: string; refresh: () => Promise<unknown>};
export const AccountControlsContext = createContext<AccountControlsProps|null>(null);
