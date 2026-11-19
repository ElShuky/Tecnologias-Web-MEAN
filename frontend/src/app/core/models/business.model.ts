export interface Business {
  id: string;
  nombre: string;
  rubro: string;
  slug: string;
  descripcion: string;
  enlacePublico: string;
  logoUrl?: string;
  portadaUrl?: string;
  personalizacion?: BusinessPersonalization;
}

export interface BusinessPersonalization {
  logo: string | null;
  portada: string | null;
  colorPrimario: string | null;
  colorSecundario: string | null;
}

export interface BusinessRubro {
  clave: string;
  nombre: string;
}

export interface CreateBusinessRequest {
  nombre: string;
  rubro: string;
  slug: string;
  descripcion: string;
  adminNombre: string;
  adminCorreo: string;
  adminPassword: string;
}
