# Local streamed audio

This is the shared local directory for audio served through authenticated backend streaming endpoints. Docker Compose mounts it read-only into the application container; audio files are never served as static UI assets.

- BBC standalone episode MP3 filenames are stored in `listening_lessons.audio_file`.
- Learning Path M4A files use the managed lesson id from the course JSON, for example `gfi-unit-01.m4a`.

MP3 and M4A files are ignored by Git and the Docker build context. With `ng serve`, the Angular development proxy forwards `/api` requests to the backend, so both BBC and Learning Path audio use the same streaming boundary.
