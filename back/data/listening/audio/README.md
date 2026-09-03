# Local listening audio

Place episode MP3 files in this directory. MP3 files are ignored by Git and Docker build context; Docker Compose mounts this directory read-only into the application container.

The filename is stored in `listening_lessons.audio_file` and is resolved through the authenticated listening audio endpoint.
