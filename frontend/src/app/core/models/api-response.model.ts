/**
 * Detalle individual de error (usado comúnmente en validación de campos).
 */
export interface ApiErrorDetail {
  field?: string;
  message: string;
  value?: unknown;
}

/**
 * Cuerpo estándar de un objeto de error retornado por la API REST.
 */
export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: ApiErrorDetail[];
}

/**
 * Estructura estándar de respuesta fallida de la API REST.
 */
export interface ApiErrorResponse {
  success: false;
  error: ApiErrorPayload;
}

/**
 * Metadatos para respuestas paginadas.
 */
export interface ApiPaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages?: number;
}

/**
 * Estructura estándar de respuesta exitosa de la API REST.
 */
export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
  meta?: ApiPaginationMeta;
}

/**
 * Tipo unión representativo de cualquier respuesta proveniente del backend.
 */
export type ApiResult<T> = ApiResponse<T> | ApiErrorResponse;
