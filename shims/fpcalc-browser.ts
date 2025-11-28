// Shim for fpcalc-browser: returns a mock fingerprint and duration for any file.

export const calculate = async (file: File) => {
  await new Promise(res => setTimeout(res, 500));
  return {
    fingerprint: 'MOCKFINGERPRINT1234567890',
    duration: 180
  };
};
