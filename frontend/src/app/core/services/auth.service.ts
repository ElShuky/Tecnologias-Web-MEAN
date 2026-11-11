import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiResponse } from '../models/api-response.model';
import { AuthData, AuthUser, LoginRequest, RegisterRequest, UserRole } from '../models/auth.model';

const SESSION_KEY = 'agendame.session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly session = signal<AuthData | null>(this.readSession());
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly currentUser = () => this.session()?.usuario ?? null;

  login(credentials: LoginRequest): Observable<ApiResponse<AuthData>> {
    return this.http
      .post<ApiResponse<AuthData>>('/api/auth/login', credentials)
      .pipe(tap((response) => this.saveSession(response.data)));
  }

  register(data: RegisterRequest): Observable<ApiResponse<AuthUser>> {
    return this.http.post<ApiResponse<AuthUser>>('/api/auth/registro', data);
  }

  logout(): void {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(SESSION_KEY);
    this.session.set(null);
    void this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return this.session() !== null;
  }

  token(): string | null {
    return this.session()?.token ?? null;
  }

  redirectByRole(role: UserRole): void {
    const destination =
      role === 'cliente' ? '/reservas' : role === 'admin' ? '/panel/admin' : '/panel/superadmin';
    void this.router.navigate([destination]);
  }

  private saveSession(data: AuthData): void {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
    localStorage.setItem(SESSION_KEY, JSON.stringify(data));
    this.session.set(data);
  }

  private readSession(): AuthData | null {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY);
      if (!raw) {
        return null;
      }
      const data = JSON.parse(raw) as AuthData;
      if (!data.token || !data.usuario?.rol) {
        sessionStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return data;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  }
}
