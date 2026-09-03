import { normalizeVocabularyForm } from "../library/VocabularyNormalizer.js";
import {
  ADJECTIVE_TERMS,
  CATEGORY_CONTEXTS,
  FREQUENCY_TERMS,
  MONTHS,
  NATURAL_FALLBACK_TEMPLATES,
  SEASONS,
  TARGET,
  VISUAL_TERMS,
  WEEKDAYS,
} from "./SentenceTemplateCatalog.js";
import {
  CURATED_TERM_TEMPLATES,
  DIRECTION_TEMPLATES,
  VERB_TEMPLATES,
} from "./SentenceCuratedTemplates.js";
import { SENTENCE_CONTEXT_OVERRIDES } from "./SentenceContextOverrides.js";
import { genericSourceTemplates } from "./SentenceGenericTemplates.js";

function categoryTemplates(category) {
  const context = CATEGORY_CONTEXTS.get(category);
  if (!context) return NATURAL_FALLBACK_TEMPLATES;
  const [scene, section, clause] = context;
  return [
    `During ${scene}, the speaker explained the ${TARGET}.`,
    `The notes contain more detail about the ${TARGET} in ${section}.`,
    `The speaker gave a practical example involving the ${TARGET} while ${clause}.`,
  ];
}

function calendarTemplates(normalizedTerm) {
  if (WEEKDAYS.has(normalizedTerm)) {
    return [
      `The class is scheduled for ${TARGET}.`,
      `We usually meet on ${TARGET}.`,
      `${TARGET} works best for the appointment.`,
    ];
  }
  if (MONTHS.has(normalizedTerm)) {
    return [
      `The course begins in ${TARGET}.`,
      `Our booking is confirmed for ${TARGET}.`,
      `The museum reopens in ${TARGET}.`,
    ];
  }
  if (SEASONS.has(normalizedTerm)) {
    return [
      `The park is busiest in ${TARGET}.`,
      `We usually travel during ${TARGET}.`,
      `The course runs through the ${TARGET}.`,
    ];
  }
  if (["morning", "afternoon", "evening"].includes(normalizedTerm)) {
    return [
      `The appointment is in the ${TARGET}.`,
      `We have a class every ${TARGET}.`,
      `The service is quieter in the ${TARGET}.`,
    ];
  }
  if (FREQUENCY_TERMS.has(normalizedTerm)) {
    return [
      `The team checks the equipment ${TARGET}.`,
      `The service is reviewed ${TARGET}.`,
      `The report is sent ${TARGET}.`,
    ];
  }
  return null;
}

function visualTemplates() {
  return [
    `The object in the diagram is ${TARGET}.`,
    `She selected a ${TARGET} design.`,
    `The picture shows a ${TARGET} object.`,
  ];
}

function adjectiveTemplates() {
  return [
    `The speaker described it as ${TARGET}.`,
    `The notes say that it is ${TARGET}.`,
    `The reviewer considered it ${TARGET}.`,
  ];
}

export function templatesFor(item) {
  const normalizedTerm = normalizeVocabularyForm(item.answerText);
  const curated = SENTENCE_CONTEXT_OVERRIDES.get(normalizedTerm)
    ?? CURATED_TERM_TEMPLATES.get(normalizedTerm);
  if (curated) return curated;

  const verbTemplates = VERB_TEMPLATES.get(normalizedTerm);
  if (verbTemplates) return verbTemplates;

  const importedSourceTemplates = genericSourceTemplates(item.category);
  if (importedSourceTemplates) return importedSourceTemplates;

  if (item.category === "Directions and map language") {
    const directionTemplates = DIRECTION_TEMPLATES.get(normalizedTerm);
    if (directionTemplates) return directionTemplates;
  }

  if (item.category === "Calendar and time") {
    const templates = calendarTemplates(normalizedTerm);
    if (templates) return templates;
  }

  if (ADJECTIVE_TERMS.has(normalizedTerm)) return adjectiveTemplates();

  if (item.category === "School subjects and disciplines") {
    return [
      `She chose ${TARGET} as her main subject.`,
      `The university offers a course in ${TARGET}.`,
      `The lecture introduced a key idea from ${TARGET}.`,
    ];
  }

  if (item.category === "Health, medicine and nutrition") {
    if (item.sourceItemNumber >= 297 && item.sourceItemNumber <= 325) {
      return [
        `The meal plan contains ${TARGET}.`,
        `The nutritionist explained the role of ${TARGET}.`,
        `The food guide provides more information about ${TARGET}.`,
      ];
    }
    if (item.sourceItemNumber === 295 || (item.sourceItemNumber >= 326 && item.sourceItemNumber <= 357)) {
      return [
        `The health lecture included a section on ${TARGET}.`,
        `The clinic provides information about ${TARGET}.`,
        `The patient asked a question about ${TARGET}.`,
      ];
    }
  }

  if (item.category === "Geography and natural features") {
    return [
      `The field-trip notes describe the ${TARGET}.`,
      `The guide pointed out the ${TARGET} on the map.`,
      `The documentary showed the effects of the ${TARGET}.`,
    ];
  }

  if (item.category === "Plants and agriculture") {
    return [
      `The diagram labels the ${TARGET}.`,
      `The botanist examined the ${TARGET}.`,
      `The lesson explains the role of the ${TARGET}.`,
    ];
  }

  if (item.category === "Countries, continents and languages") {
    if (item.sourceItemNumber >= 498 && item.sourceItemNumber <= 527) {
      return [
        `The documentary was filmed in ${TARGET}.`,
        `The course includes a case study from ${TARGET}.`,
        `They plan to travel to ${TARGET} next year.`,
      ];
    }
    if (item.sourceItemNumber >= 532 && item.sourceItemNumber <= 546) {
      return [
        `The guide speaks ${TARGET}.`,
        `The course is taught in ${TARGET}.`,
        `The form is available in ${TARGET}.`,
      ];
    }
  }

  if (item.category === "Accommodation and housing" && item.sourceItemNumber >= 558 && item.sourceItemNumber <= 569) {
    return [
      `They rented a ${TARGET} near the station.`,
      `The property listing describes the ${TARGET}.`,
      `A family recently moved into the ${TARGET}.`,
    ];
  }

  if (item.category === "City, public places and services") {
    return [
      `The map includes the ${TARGET}.`,
      `The guide explained how to reach the ${TARGET}.`,
      `The route goes past the ${TARGET}.`,
    ];
  }

  if (item.category === "Work and employment" && (
    (item.sourceItemNumber >= 691 && item.sourceItemNumber <= 698)
    || (item.sourceItemNumber >= 700 && item.sourceItemNumber <= 702)
    || (item.sourceItemNumber >= 704 && item.sourceItemNumber <= 705)
    || (item.sourceItemNumber >= 709 && item.sourceItemNumber <= 718)
    || (item.sourceItemNumber >= 721 && item.sourceItemNumber <= 723)
  )) {
    return [
      `The interviewer spoke with the ${TARGET}.`,
      `The company hired the ${TARGET} last month.`,
      `The ${TARGET} described a typical working day.`,
    ];
  }

  if (item.category === "Tourism and hospitality" && item.sourceItemNumber >= 773 && item.sourceItemNumber <= 799) {
    return [
      `The brochure contains information about the ${TARGET}.`,
      `The guest asked about the ${TARGET}.`,
      `The travel guide mentioned the ${TARGET}.`,
    ];
  }

  if (item.category === "Shapes, colours and visual description" || VISUAL_TERMS.has(normalizedTerm)) {
    return visualTemplates();
  }

  if (item.category === "Transport and travel" && (
    item.sourceItemNumber === 869
    || (item.sourceItemNumber >= 871 && item.sourceItemNumber <= 895)
    || (item.sourceItemNumber >= 901 && item.sourceItemNumber <= 930)
  )) {
    return [
      `They travelled by ${TARGET}.`,
      `The company operates the ${TARGET} on this route.`,
      `The transport guide includes information about the ${TARGET}.`,
    ];
  }

  if (item.category === "Equipment, tools and technology") {
    return [
      `The technician checked the ${TARGET}.`,
      `Please put the ${TARGET} beside the other equipment.`,
      `The instructions explain how to use the ${TARGET}.`,
    ];
  }

  if (item.category === "Arts, media and events") {
    return [
      `We visited the ${TARGET} on Saturday.`,
      `The guide gave us information about the ${TARGET}.`,
      `The city is promoting the ${TARGET} this month.`,
    ];
  }

  if (item.category === "Library and information services") {
    return [
      `The librarian explained how to use the ${TARGET}.`,
      `The student asked about the ${TARGET}.`,
      `The library guide contains information about the ${TARGET}.`,
    ];
  }

  if (item.category === "Food, cooking and catering") {
    if (item.sourceItemNumber >= 1147 && item.sourceItemNumber <= 1149) {
      return [
        `We ordered ${TARGET} at the restaurant.`,
        `The hotel serves ${TARGET} from seven o'clock.`,
        `The waiter brought ${TARGET} to our table.`,
      ];
    }
    if (item.sourceItemNumber >= 1150 && item.sourceItemNumber <= 1153) {
      return [
        `We ordered a ${TARGET} at the restaurant.`,
        `The menu includes a ${TARGET}.`,
        `The waiter brought a ${TARGET} to our table.`,
      ];
    }
    if (item.sourceItemNumber >= 1156 && item.sourceItemNumber <= 1173) {
      return [
        `The recipe includes the ${TARGET}.`,
        `The chef added the ${TARGET} slowly.`,
        `The customer asked whether the dish contained the ${TARGET}.`,
      ];
    }
    if (item.sourceItemNumber >= 1174 && item.sourceItemNumber <= 1178) {
      return [
        `The menu includes the ${TARGET}.`,
        `The customer asked about the ${TARGET}.`,
        `The restaurant introduced the ${TARGET} this week.`,
      ];
    }
  }

  if (item.category === "Buildings and rooms") {
    return [
      `The ${TARGET} is on the ground floor.`,
      `Please wait beside the ${TARGET}.`,
      `The floor plan shows the ${TARGET} near the entrance.`,
    ];
  }

  if (item.category === "Materials and manufacturing") {
    return [
      `The frame is made of ${TARGET}.`,
      `The factory uses ${TARGET} for this product.`,
      `The designer chose ${TARGET} because it is durable.`,
    ];
  }

  return categoryTemplates(item.category);
}
