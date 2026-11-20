const MINUTES_PER_HOUR = 60
const MILLISECOND_DIGITS = 3

const pad = (value: number, digits = 2): string => String(value).padStart(digits, '0')

const offsetOf = (date: Date): string => {
  const minutes = -date.getTimezoneOffset()
  const absolute = Math.abs(minutes)
  return `${minutes < 0 ? '-' : '+'}${pad(Math.floor(absolute / MINUTES_PER_HOUR))}:${pad(absolute % MINUTES_PER_HOUR)}`
}

export const localIsoTime = (time: number | string): string => {
  const date = new Date(time)
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), MILLISECOND_DIGITS)}`
  return `${day}T${clock}${offsetOf(date)}`
}
