import { ValidationError } from "../errors.js";

export const LEITNER_HOUSE_INTERVAL_DAYS = Object.freeze({
  1: 1,
  2: 2,
  3: 3,
  4: 7,
  5: 14
});

export function parseLeitnerHouse(value) {
  const house = Number(value);
  if (!Number.isInteger(house) || house < 1 || house > 5) {
    throw new ValidationError(
      "INVALID_LEITNER_HOUSE",
      "Leitner house must be an integer between 1 and 5."
    );
  }
  return house;
}

export function belongsToActiveLeitnerHouse(word, house) {
  return Number(word?.box) === house && !word?.masteredAt;
}
