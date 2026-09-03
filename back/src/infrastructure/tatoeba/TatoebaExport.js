export const TATOEBA_SOURCE_KEY = "tatoeba";
export const TATOEBA_SENTENCES_URL = "https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2";
export const TATOEBA_AUDIO_URL = "https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences_with_audio.tsv.bz2";
export const TATOEBA_AUDIO_DOWNLOAD_BASE_URL = "https://tatoeba.org/audio/download";
export const TATOEBA_MINIMUM_ENGLISH_AUDIO_RECORDINGS = 849_774;

function positiveId(value, field) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid Tatoeba ${field}: ${value}`);
  }
  return parsed;
}

export function parseTatoebaSentenceLine(line) {
  const firstTab = line.indexOf("\t");
  const secondTab = firstTab < 0 ? -1 : line.indexOf("\t", firstTab + 1);
  if (firstTab <= 0 || secondTab <= firstTab + 1) {
    throw new Error("Invalid Tatoeba sentence export row.");
  }

  return {
    sentenceId: positiveId(line.slice(0, firstTab), "sentence id"),
    languageCode: line.slice(firstTab + 1, secondTab),
    text: line.slice(secondTab + 1)
  };
}

export function parseTatoebaAudioLine(line) {
  const columns = line.split("\t");
  if (columns.length < 2) throw new Error("Invalid Tatoeba audio export row.");
  return {
    sentenceId: positiveId(columns[0], "audio sentence id"),
    audioId: positiveId(columns[1], "audio id"),
    contributor: columns[2]?.trim() || null,
    license: columns[3]?.trim() || null,
    attributionUrl: columns.slice(4).join("\t").trim() || null
  };
}

export function isReusableTatoebaAudio(audio) {
  return Boolean(audio?.license?.trim());
}

export function tatoebaAudioDownloadUrl(audioId) {
  return `${TATOEBA_AUDIO_DOWNLOAD_BASE_URL}/${positiveId(audioId, "audio id")}`;
}
