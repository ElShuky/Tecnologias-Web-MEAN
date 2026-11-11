import { ServiceFormFieldType } from './service.model';

export interface TimeBlock {
  hora: string;
  horaFin: string;
  ocupado: boolean;
  seleccionable: boolean;
}

export interface BlocksData {
  fecha: string;
  servicioId: string;
  bloques: TimeBlock[];
}

export interface BookingAnswerInput {
  campoId: string;
  valor: string | number | boolean | string[];
}

export interface BookingAnswer {
  campoId: string;
  etiqueta: string;
  tipo: ServiceFormFieldType;
  valor: string | number | boolean | string[];
}

export interface CreateBookingRequest {
  negocioId: string;
  servicioId: string;
  fecha: string;
  hora: string;
  notas: string;
  respuestas?: BookingAnswerInput[];
}

export interface Booking {
  id: string;
  negocioId: string;
  servicioId: string;
  clienteId: string;
  negocioNombre?: string;
  servicioNombre?: string;
  clienteNombre?: string;
  clienteCorreo?: string;
  fecha: string;
  hora: string;
  estado: 'confirmada' | 'cancelada';
  notas: string;
  respuestas?: BookingAnswer[];
  creadoEn?: string;
  actualizadoEn?: string;
}
