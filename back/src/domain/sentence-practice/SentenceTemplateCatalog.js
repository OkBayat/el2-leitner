export const TARGET = "{{target}}";
export const NATURAL_FALLBACK_TEMPLATES = [
  `The speaker explained the ${TARGET} during the discussion.`,
  `The notes contain more detail about the ${TARGET}.`,
  `The class included a practical example involving the ${TARGET}.`,
  `The group compared the ${TARGET} with another example.`,
  `The handout has a short section on the ${TARGET}.`,
  `The lecturer returned to the ${TARGET} later.`,
];

export const CATEGORY_CONTEXTS = new Map([
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
  ["Spelling traps and accepted variants", ["the spelling exercise", "the accepted-answer notes", "the teacher checks the written response"]],
  ["Irregular plurals and word forms", ["the grammar lesson", "the word-form notes", "the teacher explains the correct form"]],
]);

export const WEEKDAYS = new Set(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);
export const MONTHS = new Set([
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
]);
export const SEASONS = new Set(["spring", "summer", "autumn", "winter"]);
export const FREQUENCY_TERMS = new Set(["overnight", "daily", "weekly", "monthly", "annually", "frequently"]);
export const VISUAL_TERMS = new Set(["coloured", "spotted", "striped"]);

export const ADJECTIVE_TERMS = new Set([
  "non-refundable", "full-time", "international", "primary", "secondary", "intermediate",
  "advanced", "introductory", "post-secondary", "renewable", "reliable",
  "environmentally friendly", "chemical-free", "contaminated", "non-renewable", "biodegradable",
  "endangered", "furnished", "unfurnished", "unemployed", "freelance", "reasonable",
  "satisfactory", "dangerous", "safe", "satisfied", "disappointed", "efficient", "luxurious",
  "expensive", "cheap", "memorable", "fully booked", "self-catering", "ancient", "necessary",
  "comfortable", "convenient", "voluntary", "temporary", "extinct", "confident", "vegetarian",
  "vegan", "unhealthy", "overweight", "gluten-free", "dairy-free", "fresh", "frozen", "organic",
  "indigenous", "straight", "sufficient", "distinct", "different", "nuclear", "professional",
  "sustainable", "pleased", "impressed", "surprised", "uncertain", "cognitive", "electronic",
  "short", "local", "average", "dead", "modern", "slow", "strong", "natural", "calming", "awake",
  "separate", "successful", "cancelled", "in stock", "out of stock", "second-hand", "overdue",
]);
