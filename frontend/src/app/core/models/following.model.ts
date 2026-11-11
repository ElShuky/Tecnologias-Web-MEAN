import { BusinessServiceItem } from './service.model';

export interface FollowedBusiness {
  id: string;
  nombre: string;
  rubro: string;
  slug: string;
  descripcion: string;
  servicios: Pick<
    BusinessServiceItem,
    'id' | 'nombre' | 'descripcion' | 'duracionMin' | 'precio'
  >[];
}

export interface FollowingState {
  negocioId: string;
  siguiendo: boolean;
}
