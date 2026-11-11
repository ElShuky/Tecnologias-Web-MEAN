export type UserRole = 'cliente' | 'admin' | 'superadmin';

export interface AuthUser {
  id: string;
  nombre: string;
  correo: string;
  rol: UserRole;
  negocioId?: string;
}

export interface AuthData {
  token: string;
  usuario: AuthUser;
}

export interface LoginRequest {
  correo: string;
  password: string;
}

export interface RegisterRequest {
  nombre: string;
  correo: string;
  password: string;
}
