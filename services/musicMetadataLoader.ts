type MusicMetadataModule = {
  parseBlob: (file: Blob) => Promise<{
    common?: Record<string, unknown>;
    format?: Record<string, unknown>;
  }>;
};

const MUSIC_METADATA_SPECIFIER =
  "https://esm.sh/music-metadata-browser@^2.5.5?bundle&target=es2022";

let cachedModulePromise: Promise<MusicMetadataModule> | null = null;

export const loadMusicMetadata = async (): Promise<MusicMetadataModule> => {
  if (!cachedModulePromise) {
    cachedModulePromise = import(/* @vite-ignore */ MUSIC_METADATA_SPECIFIER)
      .then((mod) => {
        const candidate =
          (mod as MusicMetadataModule).parseBlob
            ? (mod as MusicMetadataModule)
            : (mod as { default?: MusicMetadataModule }).default;

        if (candidate && typeof candidate.parseBlob === "function") {
          return candidate;
        }
        throw new Error("music-metadata-browser: parseBlob not available.");
      })
      .catch((error) => {
        cachedModulePromise = null;
        throw error;
      });
  }

  return cachedModulePromise;
};
