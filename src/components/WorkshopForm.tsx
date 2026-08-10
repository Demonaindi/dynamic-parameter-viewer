export type WorkshopInfo = {
  razonSocial: string
  operador: string
  direccion: string
  ciudad: string
  provincia: string
  telefono: string
  email: string
  matricula: string
  vin: string
}

export const emptyWorkshop: WorkshopInfo = {
  razonSocial: '',
  operador: '',
  direccion: '',
  ciudad: '',
  provincia: '',
  telefono: '',
  email: '',
  matricula: '',
  vin: '',
}

export function loadWorkshop(): WorkshopInfo {
  try {
    const raw = localStorage.getItem('logueador-taller')
    if (raw) return { ...emptyWorkshop, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return emptyWorkshop
}

export function saveWorkshop(value: WorkshopInfo) {
  localStorage.setItem('logueador-taller', JSON.stringify(value))
}
