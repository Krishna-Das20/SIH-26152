export interface UserAccount {
  id: string;
  name: string;
  email: string;
  image?: string;
  passwordHash?: string;
  role: 'analyst' | 'admin' | 'investigator';
  createdAt: string;
}

export interface AuthSessionUser {
  id: string;
  name: string;
  email: string;
  image?: string;
  role: string;
}
