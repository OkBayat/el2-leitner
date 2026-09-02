import { TARGET } from "./SentenceTemplateCatalog.js";

export const SENTENCE_CONTEXT_OVERRIDES = new Map([
  ["balanced diet", [`A ${TARGET} includes foods from several groups.`, `The nutritionist recommended a ${TARGET}.`, `Regular exercise is easier to maintain with a ${TARGET}.`]],
  ["food pyramid", [`The diagram shows the ${TARGET}.`, `Students used the ${TARGET} to compare food groups.`, `The lesson explains each level of the ${TARGET}.`]],
  ["vitamin", [`The doctor recommended a ${TARGET}.`, `This fruit contains an important ${TARGET}.`, `The label lists each ${TARGET} in the supplement.`]],
  ["physician", [`The ${TARGET} examined the patient.`, `Please make an appointment with a ${TARGET}.`, `The ${TARGET} reviewed the test results.`]],
  ["nursery", [`The hospital has a ${TARGET} on the first floor.`, `She works in the children's ${TARGET}.`, `Parents can visit the ${TARGET} during the afternoon.`]],
  ["frequently", [`The buses run ${TARGET} throughout the day.`, `She ${TARGET} visits the library after class.`, `This question appears ${TARGET} in the survey.`]],
  ["sailing", [`They went ${TARGET} around the island.`, `The club offers beginner ${TARGET} lessons.`, `Strong winds cancelled the ${TARGET} trip.`]],
]);
