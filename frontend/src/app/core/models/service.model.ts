export type ServiceFormFieldType =
  | 'texto_corto'
  | 'texto_largo'
  | 'numero'
  | 'fecha'
  | 'si_no'
  | 'seleccion_unica'
  | 'seleccion_multiple';

export interface ServiceFormField {
  id?: string;
  etiqueta: string;
  tipo: ServiceFormFieldType;
  obligatorio: boolean;
  textoAyuda?: string;
  opciones?: string[];
  activo?: boolean;
  orden?: number;
}

export interface ServiceForm {
  servicioId: string;
  campos: ServiceFormField[];
}

export interface BusinessServiceItem {
  id: string;
  nombre: string;
  descripcion: string;
  duracionMin: number;
  precio: number;
  activo: boolean;
}

export interface ServicePayload {
  nombre: string;
  descripcion: string;
  duracionMin: number;
  precio: number;
  activo?: boolean;
}
