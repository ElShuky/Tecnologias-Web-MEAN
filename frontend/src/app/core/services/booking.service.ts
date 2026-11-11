import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/api-response.model';
import { BlocksData, Booking, CreateBookingRequest } from '../models/booking.model';

@Injectable({ providedIn: 'root' })
export class BookingService {
  private readonly http = inject(HttpClient);

  getBlocks(slug: string, serviceId: string, date: string): Observable<ApiResponse<BlocksData>> {
    const params = new HttpParams().set('fecha', date);
    return this.http.get<ApiResponse<BlocksData>>(
      `/api/negocios/${encodeURIComponent(slug)}/servicios/${encodeURIComponent(serviceId)}/bloques`,
      { params },
    );
  }

  create(data: CreateBookingRequest): Observable<ApiResponse<Booking>> {
    return this.http.post<ApiResponse<Booking>>('/api/reservas', data);
  }

  listMine(): Observable<ApiResponse<Booking[]>> {
    return this.http.get<ApiResponse<Booking[]>>('/api/reservas/cliente');
  }

  listBusiness(
    businessId: string,
    filter: { fecha?: string; semana?: string } = {},
  ): Observable<ApiResponse<Booking[]>> {
    let params = new HttpParams();
    if (filter.fecha) params = params.set('fecha', filter.fecha);
    if (filter.semana) params = params.set('semana', filter.semana);
    return this.http.get<ApiResponse<Booking[]>>(
      `/api/gestion/negocios/${encodeURIComponent(businessId)}/reservas`,
      { params },
    );
  }

  cancel(id: string): Observable<ApiResponse<Booking>> {
    return this.http.patch<ApiResponse<Booking>>(
      `/api/reservas/${encodeURIComponent(id)}/cancelar`,
      {},
    );
  }
}
