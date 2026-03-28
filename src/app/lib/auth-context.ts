import { createContext, useContext } from 'react';
import type { AuthState } from './api';

const AuthContext = createContext<AuthState>({ authenticated: false });

export const AuthProvider = AuthContext.Provider;
export const useAuth = () => useContext(AuthContext);
