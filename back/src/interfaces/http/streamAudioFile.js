export function streamAudioFile({ res, next, absolutePath, contentType }) {
  res.type(contentType);
  res.sendFile(
    absolutePath,
    { acceptRanges: true, cacheControl: false, lastModified: false },
    (error) => {
      if (error && !res.headersSent) next(error);
    },
  );
}
