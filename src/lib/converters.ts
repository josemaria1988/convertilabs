export const MILLIMETERS_PER_INCH = 25.4;
export const LITERS_PER_US_GALLON = 3.785411784;
export const LITERS_PER_UK_GALLON = 4.54609;

export function inchesToMillimeters(inches: number): number {
  return inches * MILLIMETERS_PER_INCH;
}

export function litersToUsGallons(liters: number): number {
  return liters / LITERS_PER_US_GALLON;
}

export function litersToUkGallons(liters: number): number {
  return liters / LITERS_PER_UK_GALLON;
}

export function calculateCubicMeters(
  lengthMeters: number,
  widthMeters: number,
  heightMeters: number
): number {
  return lengthMeters * widthMeters * heightMeters;
}
