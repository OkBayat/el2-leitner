const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const FINAL_REVIEW_DELAY_DAYS = 14;

function normalizedIso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function normalizedDay(value) {
  if (!value) return null;
  const day = String(value).slice(0, 10);
  return DAY_PATTERN.test(day) ? day : null;
}

function addDays(day, amount) {
  const normalized = normalizedDay(day);
  if (!normalized) return null;
  const [year, month, date] = normalized.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date + amount)).toISOString().slice(0, 10);
}

function reviewFingerprint(event) {
  return JSON.stringify([
    event?.at ?? null,
    event?.day ?? null,
    event?.term ?? null,
    event?.answer ?? null,
    Boolean(event?.correct),
    event?.mode ?? null,
    event?.previousBox ?? null,
    event?.newBox ?? null,
    event?.mistakeNumber ?? null
  ]);
}

function isSuccessfulPromotion(event, previousBox, newBox) {
  return Boolean(
    event?.correct === true &&
    event?.promoted === true &&
    Number(event?.previousBox) === previousBox &&
    Number(event?.newBox) === newBox
  );
}

export function applyBoxFiveReviewPolicyToWord(word, event) {
  const next = { ...word };
  const reviewedAt = normalizedIso(event?.at);
  const reviewDay = normalizedDay(event?.day);
  if (!reviewedAt || !reviewDay) return next;

  if (isSuccessfulPromotion(event, 4, 5)) {
    next.box = 5;
    next.due = addDays(reviewDay, FINAL_REVIEW_DELAY_DAYS);
    next.lastReviewed = reviewedAt;
    next.lastPromotedDay = reviewDay;
    next.blockedUntil = null;
    next.masteredAt = null;
    return next;
  }

  if (isSuccessfulPromotion(event, 5, 5)) {
    next.box = 5;
    next.due = null;
    next.lastReviewed = reviewedAt;
    next.lastPromotedDay = reviewDay;
    next.blockedUntil = null;
    next.masteredAt = reviewedAt;
  }

  return next;
}

function cursorPosition(history, cursor) {
  if (!cursor) return null;
  const length = Number(cursor.historyLength);
  const fingerprint = cursor.lastReviewFingerprint || null;
  if (!Number.isSafeInteger(length) || length < 0 || length > history.length) return null;
  if (length === 0 && !fingerprint) return 0;
  if (length > 0 && reviewFingerprint(history[length - 1]) === fingerprint) return length;
  if (!fingerprint) return null;
  for (let index = history.length - 1; index >= 0; index -= 1) {
    if (reviewFingerprint(history[index]) === fingerprint) return index + 1;
  }
  return null;
}

function appendedReviewEvents(state) {
  const history = Array.isArray(state?.history) ? state.history : [];
  if (!history.length) return [];
  const position = cursorPosition(history, state?.persistenceCursor);
  if (position !== null) return history.slice(position);

  // Older clients did not send a persistence cursor. Only inspect their last
  // event; snapshot matching below prevents an old lifecycle event from being
  // replayed during an unrelated full-state write.
  return [history.at(-1)];
}

function eventMatchesCurrentWordSnapshot(word, event) {
  if (!word || !event || String(word.id || "") !== String(event.wordId || "")) return false;
  if (!isSuccessfulPromotion(event, 4, 5) && !isSuccessfulPromotion(event, 5, 5)) return false;

  const reviewedAt = normalizedIso(event.at);
  const reviewDay = normalizedDay(event.day);
  if (!reviewedAt || !reviewDay) return false;
  if (normalizedIso(word.lastReviewed) !== reviewedAt) return false;
  if (normalizedDay(word.lastPromotedDay) !== reviewDay) return false;
  if (Number(word.box) !== Number(event.newBox)) return false;

  const introducedOn = normalizedDay(word.introducedOn);
  if (isSuccessfulPromotion(event, 5, 5) && introducedOn && reviewDay <= introducedOn) return false;
  if (isSuccessfulPromotion(event, 4, 5) && introducedOn && reviewDay < introducedOn) return false;
  return true;
}

export function applyBoxFiveReviewPolicyToState(state) {
  if (!state || !Array.isArray(state.words)) return state;
  const wordsById = new Map(state.words.map((word, index) => [String(word?.id || ""), index]));

  for (const event of appendedReviewEvents(state)) {
    const index = wordsById.get(String(event?.wordId || ""));
    if (index === undefined) continue;
    const word = state.words[index];
    if (!eventMatchesCurrentWordSnapshot(word, event)) continue;
    state.words[index] = applyBoxFiveReviewPolicyToWord(word, event);
  }
  return state;
}
