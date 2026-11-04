import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiErrorResponse } from '../models/api-response.model';

/**
 * Interceptor HTTP para capturar y estandarizar respuestas de error de la API.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  return next(req).pipe(
    catchError((error: unknown) => {
      let standardizedError: ApiErrorResponse;

      if (error instanceof HttpErrorResponse) {
        if (error.error && typeof error.error === 'object' && error.error.error?.code) {
          standardizedError = error.error as ApiErrorResponse;
        } else {
          standardizedError = {
            success: false,
            error: {
              code: `HTTP_${error.status || 500}`,
              message: error.message || 'Error en la comunicación con el servidor',
            },
          };
        }
      } else {
        standardizedError = {
          success: false,
          error: {
            code: 'UNKNOWN_CLIENT_ERROR',
            message: 'Ocurrió un error inesperado en el cliente',
          },
        };
      }

      return throwError(() => standardizedError);
    }),
  );
};
