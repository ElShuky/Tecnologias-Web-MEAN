import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/api-response.model';
import {
  Business,
  BusinessPersonalization,
  BusinessRubro,
  CreateBusinessRequest,
} from '../models/business.model';
import {
  BusinessServiceItem,
  ServiceAvailability,
  ServiceForm,
  ServiceFormField,
  ServicePayload,
} from '../models/service.model';

@Injectable({ providedIn: 'root' })
export class BusinessService {
  private readonly http = inject(HttpClient);

  list(search = '', rubro = ''): Observable<ApiResponse<Business[]>> {
    let params = new HttpParams();
    if (search.trim()) params = params.set('search', search.trim());
    if (rubro.trim()) params = params.set('rubro', rubro.trim());
    return this.http.get<ApiResponse<Business[]>>('/api/negocios', { params });
  }

  listRubros(): Observable<ApiResponse<BusinessRubro[]>> {
    return this.http.get<ApiResponse<BusinessRubro[]>>('/api/negocios/rubros');
  }

  getForManagement(businessId: string): Observable<ApiResponse<Business>> {
    return this.http.get<ApiResponse<Business>>(`/api/negocios/gestion/${businessId}`);
  }

  create(data: CreateBusinessRequest): Observable<ApiResponse<Business>> {
    return this.http.post<ApiResponse<Business>>('/api/negocios', data);
  }

  getPublic(slug: string): Observable<ApiResponse<Business>> {
    return this.http.get<ApiResponse<Business>>(`/api/negocios/${encodeURIComponent(slug)}`);
  }

  listServices(slug: string): Observable<ApiResponse<BusinessServiceItem[]>> {
    return this.http.get<ApiResponse<BusinessServiceItem[]>>(
      `/api/negocios/${encodeURIComponent(slug)}/servicios`,
    );
  }

  getService(slug: string, serviceId: string): Observable<ApiResponse<BusinessServiceItem>> {
    return this.http.get<ApiResponse<BusinessServiceItem>>(
      `/api/negocios/${encodeURIComponent(slug)}/servicios/${encodeURIComponent(serviceId)}`,
    );
  }

  uploadImage(
    businessId: string,
    type: 'logo' | 'portada',
    file: File,
  ): Observable<ApiResponse<{ tipo: string; url: string }>> {
    const formData = new FormData();
    formData.append('imagen', file);
    return this.http.post<ApiResponse<{ tipo: string; url: string }>>(
      `/api/negocios/gestion/${encodeURIComponent(businessId)}/imagenes/${type}`,
      formData,
    );
  }

  getPersonalization(): Observable<ApiResponse<BusinessPersonalization>> {
    return this.http.get<ApiResponse<BusinessPersonalization>>('/api/personalizacion');
  }

  updatePersonalization(
    data: Partial<BusinessPersonalization>,
  ): Observable<ApiResponse<BusinessPersonalization>> {
    return this.http.put<ApiResponse<BusinessPersonalization>>('/api/personalizacion', data);
  }

  listManagedServices(businessId: string): Observable<ApiResponse<BusinessServiceItem[]>> {
    return this.http.get<ApiResponse<BusinessServiceItem[]>>(
      `/api/gestion/negocios/${encodeURIComponent(businessId)}/servicios`,
    );
  }

  createService(
    businessId: string,
    data: ServicePayload,
  ): Observable<ApiResponse<BusinessServiceItem>> {
    return this.http.post<ApiResponse<BusinessServiceItem>>(
      `/api/gestion/negocios/${encodeURIComponent(businessId)}/servicios`,
      data,
    );
  }

  updateService(
    businessId: string,
    serviceId: string,
    data: Partial<ServicePayload>,
  ): Observable<ApiResponse<BusinessServiceItem>> {
    return this.http.patch<ApiResponse<BusinessServiceItem>>(
      `/api/gestion/negocios/${encodeURIComponent(businessId)}/servicios/${encodeURIComponent(serviceId)}`,
      data,
    );
  }

  deactivateService(
    businessId: string,
    serviceId: string,
  ): Observable<ApiResponse<BusinessServiceItem>> {
    return this.http.delete<ApiResponse<BusinessServiceItem>>(
      `/api/gestion/negocios/${encodeURIComponent(businessId)}/servicios/${encodeURIComponent(serviceId)}`,
    );
  }

  getServiceAvailability(
    businessId: string,
    serviceId: string,
  ): Observable<ApiResponse<ServiceAvailability[]>> {
    return this.http.get<ApiResponse<ServiceAvailability[]>>(
      `/api/gestion/negocios/${encodeURIComponent(businessId)}/servicios/${encodeURIComponent(serviceId)}/disponibilidad`,
    );
  }

  saveServiceAvailability(
    businessId: string,
    serviceId: string,
    data: { dias: number[]; horaInicio: string; horaFin: string },
  ): Observable<ApiResponse<ServiceAvailability>> {
    return this.http.put<ApiResponse<ServiceAvailability>>(
      `/api/gestion/negocios/${encodeURIComponent(businessId)}/servicios/${encodeURIComponent(serviceId)}/disponibilidad`,
      data,
    );
  }

  getServiceForm(serviceId: string): Observable<ApiResponse<ServiceForm>> {
    return this.http.get<ApiResponse<ServiceForm>>(
      `/api/servicios/${encodeURIComponent(serviceId)}/formulario`,
    );
  }

  getManagedServiceForm(serviceId: string): Observable<ApiResponse<ServiceForm>> {
    return this.http.get<ApiResponse<ServiceForm>>(
      `/api/gestion/servicios/${encodeURIComponent(serviceId)}/formulario`,
    );
  }

  saveServiceForm(
    serviceId: string,
    campos: ServiceFormField[],
  ): Observable<ApiResponse<ServiceForm>> {
    return this.http.put<ApiResponse<ServiceForm>>(
      `/api/servicios/${encodeURIComponent(serviceId)}/formulario`,
      { campos },
    );
  }
}
