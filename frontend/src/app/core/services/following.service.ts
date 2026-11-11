import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/api-response.model';
import { FollowedBusiness, FollowingState } from '../models/following.model';

@Injectable({ providedIn: 'root' })
export class FollowingService {
  private readonly http = inject(HttpClient);

  list(): Observable<ApiResponse<FollowedBusiness[]>> {
    return this.http.get<ApiResponse<FollowedBusiness[]>>('/api/seguimientos');
  }

  getState(businessId: string): Observable<ApiResponse<FollowingState>> {
    return this.http.get<ApiResponse<FollowingState>>(
      `/api/seguimientos/${encodeURIComponent(businessId)}`,
    );
  }

  follow(businessId: string): Observable<ApiResponse<FollowingState>> {
    return this.http.post<ApiResponse<FollowingState>>(
      `/api/seguimientos/${encodeURIComponent(businessId)}`,
      {},
    );
  }

  unfollow(businessId: string): Observable<ApiResponse<FollowingState>> {
    return this.http.delete<ApiResponse<FollowingState>>(
      `/api/seguimientos/${encodeURIComponent(businessId)}`,
    );
  }
}
