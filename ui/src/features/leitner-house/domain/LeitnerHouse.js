export class InvalidLeitnerHouseError extends Error {
  constructor(value) {
    super(`Invalid Leitner house: ${value}`);
    this.name = 'InvalidLeitnerHouseError';
    this.code = 'INVALID_LEITNER_HOUSE';
  }
}

export function parseLeitnerHouse(value) {
  const house = Number(value);
  return Number.isInteger(house) && house >= 1 && house <= 5 ? house : null;
}

export function requireLeitnerHouse(value) {
  const house = parseLeitnerHouse(value);
  if (house === null) throw new InvalidLeitnerHouseError(value);
  return house;
}
