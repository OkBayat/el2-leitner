import { ValidationError } from "../errors.js";
import { cleanVocabularyForms, normalizeVocabularyForm } from "../library/VocabularyNormalizer.js";

export const SENTENCE_CORPUS_SOURCE = "ielts-listening-core-1500";
export const SENTENCE_CORPUS_VERSION = "2026-09-02.3";
export const SENTENCES_PER_SOURCE_ITEM = 3;
export const EXPECTED_SENTENCE_SOURCE_ITEMS = 1_500;

const TARGET = "{{target}}";
const MAX_SENTENCE_LENGTH = 1_000;

const SAFE_TEMPLATES = [
  `You can hear “${TARGET}” clearly in this audio clip.`,
  `The missing expression in this sentence is “${TARGET}”.`,
  `Type “${TARGET}” after listening to the pronunciation.`,
  `The speaker repeats “${TARGET}” before moving to the next question.`,
  `The exact answer required in this blank is “${TARGET}”.`,
  `Listen once more and enter “${TARGET}” in the empty space.`,
];

const CATEGORY_CONTEXTS = new Map([
  ["Calendar and time", ["the booking call", "the date-and-time section", "the caller confirms the schedule"]],
  ["Money, banking and payments", ["the payment discussion", "the financial-details section", "the customer confirms the transaction"]],
  ["School subjects and disciplines", ["the course-planning meeting", "the subject list", "the student describes the course choice"]],
  ["University and study", ["the university conversation", "the student handbook", "the tutor explains the study arrangements"]],
  ["Business, marketing and management", ["the business meeting", "the management report", "the presenter explains the business plan"]],
  ["Health, medicine and nutrition", ["the health consultation", "the health-information section", "the adviser discusses medicine or nutrition"]],
  ["Geography and natural features", ["the field trip", "the geography notes", "the lecturer describes the landscape"]],
  ["Environment, climate and energy", ["the environmental lecture", "the climate-and-energy report", "the researcher discusses the environment"]],
  ["Animals and biology", ["the wildlife documentary", "the biology notes", "the researcher describes the living world"]],
  ["Plants and agriculture", ["the agriculture lesson", "the plant notes", "the farmer explains the growing process"]],
  ["Countries, continents and languages", ["the international course call", "the location-or-language field", "the student gives international details"]],
  ["Buildings and architecture", ["the architecture tour", "the building notes", "the guide describes the structure"]],
  ["Accommodation and housing", ["the accommodation call", "the property details", "the tenant asks about the accommodation"]],
  ["City, public places and services", ["the city-information call", "the public-services guide", "the caller asks about the town"]],
  ["Work and employment", ["the employment interview", "the work-details section", "the applicant discusses the position"]],
  ["Descriptions, quality and evaluation", ["the customer-feedback interview", "the evaluation notes", "the customer gives an opinion"]],
  ["Tourism and hospitality", ["the travel call", "the visitor-information guide", "the guest discusses the trip"]],
  ["High-value common verbs", ["the instruction session", "the action-word list", "the speaker explains what to do"]],
  ["High-value common adjectives", ["the description exercise", "the evaluation notes", "the customer describes the arrangement"]],
  ["Hobbies and leisure", ["the leisure-centre call", "the weekend programme", "the participant discusses a hobby"]],
  ["Sports and physical activity", ["the fitness consultation", "the sports programme", "the participant discusses exercise"]],
  ["Shapes, colours and visual description", ["the visual-description task", "the design notes", "the speaker describes the object"]],
  ["Numbers, measurement and quantities", ["the measurement explanation", "the diagram notes", "the engineer describes the quantity"]],
  ["Transport and travel", ["the journey announcement", "the transport notes", "the passenger asks about the journey"]],
  ["Equipment, tools and technology", ["the equipment demonstration", "the tool list", "the technician explains how the equipment is used"]],
  ["Arts, media and events", ["the cultural programme", "the arts-and-media guide", "the caller asks about the event"]],
  ["Materials and manufacturing", ["the manufacturing lecture", "the materials section", "the production process is described"]],
  ["General IELTS answer words", ["the listening recording", "the candidate's notes", "the speaker develops the next point"]],
  ["Personal details and form completion", ["the form-completion call", "the personal-details form", "the caller confirms the information"]],
  ["Directions and map language", ["the route explanation", "the map notes", "the guide gives the next direction"]],
  ["Buildings and rooms", ["the building tour", "the floor-plan notes", "the receptionist explains the building"]],
  ["Government and society", ["the public lecture", "the society report", "the issue is discussed"]],
  ["Shopping and consumer services", ["the customer-service call", "the shopping information", "the customer asks about the purchase"]],
  ["Library and information services", ["the library enquiry", "the information-services guide", "the student asks for help"]],
  ["Food, cooking and catering", ["the catering discussion", "the menu notes", "the customer discusses the meal"]],
  ["Safety and emergencies", ["the safety briefing", "the emergency instructions", "the officer gives the next safety step"]],
  ["Academic core for Parts 3 and 4", ["the academic lecture", "the student's notes", "the lecturer develops the main point"]],
  ["Research and academic process", ["the research meeting", "the methodology section", "the supervisor explains the study design"]],
  ["Discussion, opinion and evaluation", ["the seminar discussion", "the evaluation notes", "the proposal is evaluated"]],
  ["Psychology and human behaviour", ["the psychology seminar", "the behaviour notes", "the lecturer explains human behaviour"]],
  ["Science and technology", ["the technology demonstration", "the technical notes", "the scientific process is explained"]],
  ["Recent Cambridge 19-21 answer words", ["the listening recording", "the answer sheet", "the speaker moves to the next question"]],
  ["Spelling traps and accepted variants", ["the spelling exercise", "the accepted-answer notes", "the speaker checks every letter"]],
  ["Irregular plurals and word forms", ["the grammar example", "the word-form notes", "the lecturer explains the form"]],
]);

const TERM_TEMPLATES = new Map([
  ["surname", [`My ${TARGET} is Bayat.`, `Please write your ${TARGET} exactly as it appears on your passport.`, `The receptionist asked me to spell my ${TARGET}.`]],
  ["first name", [`My ${TARGET} is Mohammad.`, `What is your ${TARGET}?`, `Please enter your ${TARGET} on the registration form.`]],
  ["middle name", [`I do not use a ${TARGET} on official forms.`, `Please enter your ${TARGET} if you have one.`, `The application has a separate box for a ${TARGET}.`]],
  ["full name", [`Please state your ${TARGET} for the recording.`, `I wrote my ${TARGET} at the top of the form.`, `The receptionist checked my ${TARGET} against my passport.`]],
  ["initials", [`Please write your ${TARGET} in the two small boxes.`, `His ${TARGET} appear beside his signature.`, `The form asks for both your name and your ${TARGET}.`]],
  ["title", [`Please select your ${TARGET}, such as Mr, Ms or Dr.`, `The registration form has a drop-down list for your ${TARGET}.`, `She entered “Dr” as her ${TARGET}.`]],
  ["age", [`The application form asks for your ${TARGET}.`, `You must be over eighteen years of ${TARGET} to apply.`, `The receptionist confirmed my ${TARGET} before making the booking.`]],
  ["date of birth", [`Please enter your ${TARGET} in day-month-year order.`, `The receptionist checked my ${TARGET} against my passport.`, `The form requires both your name and your ${TARGET}.`]],
  ["nationality", [`The application asks for your ${TARGET}.`, `She wrote “Canadian” in the box marked ${TARGET}.`, `The receptionist confirmed my ${TARGET} during the call.`]],
  ["address", [`Please write your current ${TARGET} on the form.`, `The parcel was delivered to the wrong ${TARGET}.`, `The receptionist repeated my ${TARGET} to check it was correct.`]],
  ["postcode", [`Please enter the ${TARGET} for your home address.`, `The receptionist asked me to repeat my ${TARGET}.`, `The delivery form will not continue without a valid ${TARGET}.`]],
  ["postal code", [`Please enter the ${TARGET} for your home address.`, `The receptionist asked me to repeat my ${TARGET}.`, `The delivery form will not continue without a valid ${TARGET}.`]],
  ["email address", [`Please enter your ${TARGET} in lowercase letters.`, `The confirmation was sent to my ${TARGET}.`, `The receptionist asked me to spell my ${TARGET}.`]],
  ["telephone number", [`Please leave a ${TARGET} where we can contact you.`, `The receptionist repeated my ${TARGET} to confirm every digit.`, `I wrote my home ${TARGET} on the application.`]],
  ["mobile number", [`Please enter your ${TARGET} in the contact section.`, `The confirmation message was sent to my ${TARGET}.`, `The receptionist checked each digit of my ${TARGET}.`]],
  ["emergency contact", [`Please name one ${TARGET} on the registration form.`, `My sister is listed as my ${TARGET}.`, `The form asks for an ${TARGET} and a telephone number.`]],
  ["membership number", [`Please quote your ${TARGET} when you call us.`, `My ${TARGET} is printed on the front of the card.`, `The receptionist used my ${TARGET} to find the account.`]],
  ["registration number", [`Please enter your ${TARGET} at the top of the form.`, `The receptionist used my ${TARGET} to find the booking.`, `Your ${TARGET} appears in the confirmation email.`]],
  ["reference number", [`Please quote your ${TARGET} when you contact customer service.`, `The ${TARGET} appears at the top of the letter.`, `The adviser used my ${TARGET} to locate the application.`]],
  ["passport number", [`Please enter your ${TARGET} exactly as it appears in the document.`, `The booking form requires a valid ${TARGET}.`, `The agent checked my ${TARGET} before issuing the ticket.`]],
  ["identification", [`Please bring photographic ${TARGET} to the appointment.`, `The receptionist asked to see my ${TARGET}.`, `A passport can be used as proof of ${TARGET}.`]],
  ["signature", [`Please put your ${TARGET} at the bottom of the form.`, `The bank compared the ${TARGET} with the one on file.`, `The document is not valid without your ${TARGET}.`]],
  ["marital status", [`The application includes a question about your ${TARGET}.`, `Please select your ${TARGET} from the list.`, `The interviewer did not ask about my ${TARGET}.`]],
]);

function categoryTemplates(category) {
  const context = CATEGORY_CONTEXTS.get(category);
  if (!context) return SAFE_TEMPLATES;
  const [scene, section, clause] = context;
  return [
    `During ${scene}, the speaker clearly says “${TARGET}”.`,
    `The notes include “${TARGET}” in ${section}.`,
    `Listen for “${TARGET}” when ${clause}.`,
  ];
}

function countCaseInsensitiveOccurrences(text, needle) {
  const haystack = text.toLocaleLowerCase("en");
  const target = needle.toLocaleLowerCase("en");
  if (!target) return 0;
  let count = 0;
  let offset = 0;
  while (offset <= haystack.length - target.length) {
    const index = haystack.indexOf(target, offset);
    if (index < 0) break;
    count += 1;
    offset = index + target.length;
  }
  return count;
}

function instantiateTemplate(template, answerText) {
  if (template.split(TARGET).length !== 2) {
    throw new Error("Sentence templates must contain exactly one target marker.");
  }
  return template.replace(TARGET, answerText);
}

function sentenceFor({ template, answerText, variantNumber }) {
  const candidates = [template, ...SAFE_TEMPLATES.slice(variantNumber - 1), ...SAFE_TEMPLATES];
  for (const candidate of candidates) {
    const sentenceText = instantiateTemplate(candidate, answerText);
    if (countCaseInsensitiveOccurrences(sentenceText, answerText) !== 1) continue;
    if (sentenceText.length > MAX_SENTENCE_LENGTH) {
      throw new ValidationError(
        "SENTENCE_TOO_LONG",
        `Generated sentence for “${answerText}” exceeds ${MAX_SENTENCE_LENGTH} characters.`
      );
    }
    return sentenceText;
  }
  throw new Error(`Could not generate an unambiguous sentence for “${answerText}”.`);
}

export function parseSentenceSource(sourceText) {
  if (typeof sourceText !== "string") {
    throw new ValidationError("INVALID_SENTENCE_SOURCE", "Sentence source must be plain text.");
  }

  const sectionStack = [];
  const items = [];
  const seenNumbers = new Set();

  for (const rawLine of sourceText.split(/\r?\n/u)) {
    const heading = rawLine.match(/^\s*(#{2,6})\s+(.+?)\s*$/u);
    if (heading) {
      const depth = heading[1].length - 2;
      sectionStack.splice(depth);
      sectionStack[depth] = heading[2].trim();
      continue;
    }

    const numbered = rawLine.match(/^\s*(\d+)[.)]\s+(.+?)\s*$/u);
    if (!numbered) continue;
    const sourceItemNumber = Number(numbered[1]);
    if (!Number.isSafeInteger(sourceItemNumber) || sourceItemNumber <= 0 || seenNumbers.has(sourceItemNumber)) {
      throw new ValidationError(
        "INVALID_SENTENCE_SOURCE_NUMBER",
        `Sentence source item number ${numbered[1]} is invalid or duplicated.`
      );
    }
    seenNumbers.add(sourceItemNumber);

    const rawForms = numbered[2].split(/\s+\/\s+/u).map((value) => value.trim()).filter(Boolean);
    const forms = cleanVocabularyForms(rawForms[0], rawForms.slice(1));
    const category = sectionStack.filter(Boolean).join(" / ") || "Uncategorized";
    items.push({
      sourceItemNumber,
      category,
      answerText: forms[0].form,
      acceptedForms: forms.map(({ form }) => form),
      normalizedForms: forms.map(({ form }) => normalizeVocabularyForm(form)),
    });
  }

  if (!items.length) {
    throw new ValidationError("EMPTY_SENTENCE_SOURCE", "No numbered vocabulary items were found for sentence practice.");
  }
  for (let index = 0; index < items.length; index += 1) {
    if (items[index].sourceItemNumber !== index + 1) {
      throw new ValidationError(
        "NON_SEQUENTIAL_SENTENCE_SOURCE",
        `Sentence source numbering must be continuous from 1; expected ${index + 1}, found ${items[index].sourceItemNumber}.`
      );
    }
  }
  return items;
}

export function buildSentenceCorpus(sourceText) {
  const items = parseSentenceSource(sourceText);
  const records = [];

  for (const item of items) {
    const templates = TERM_TEMPLATES.get(normalizeVocabularyForm(item.answerText))
      ?? categoryTemplates(item.category);
    const sentenceTexts = new Set();
    for (let index = 0; index < SENTENCES_PER_SOURCE_ITEM; index += 1) {
      const variantNumber = index + 1;
      let sentenceText = sentenceFor({
        template: templates[index % templates.length],
        answerText: item.answerText,
        variantNumber,
      });
      if (sentenceTexts.has(sentenceText)) {
        sentenceText = sentenceFor({
          template: SAFE_TEMPLATES[(index + 2) % SAFE_TEMPLATES.length],
          answerText: item.answerText,
          variantNumber,
        });
      }
      if (sentenceTexts.has(sentenceText)) {
        throw new Error(`Sentence variants for source item ${item.sourceItemNumber} are not unique.`);
      }
      sentenceTexts.add(sentenceText);
      records.push({ ...item, variantNumber, sentenceText });
    }
  }

  return {
    sourceItemCount: items.length,
    sentenceCount: records.length,
    records,
  };
}

export function splitSentenceAtAnswer(sentenceText, answerText) {
  const start = sentenceText.indexOf(answerText);
  if (start < 0 || sentenceText.indexOf(answerText, start + answerText.length) >= 0) {
    throw new Error(`Sentence must contain the answer “${answerText}” exactly once.`);
  }
  return {
    before: sentenceText.slice(0, start),
    after: sentenceText.slice(start + answerText.length),
  };
}
