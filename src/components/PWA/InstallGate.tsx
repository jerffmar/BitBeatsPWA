import React, { useEffect, useState } from 'react';
import { Download } from 'lucide-react';

const InstallGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isStandalone, setIsStandalone] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const checkStandalone = () =>
      setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);
    checkStandalone();
    window.addEventListener('resize', checkStandalone);
    window.addEventListener('DOMContentLoaded', checkStandalone);

    const handler = (e: any) => setInstallPrompt(e);
    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('resize', checkStandalone);
      window.removeEventListener('DOMContentLoaded', checkStandalone);
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  if (isStandalone) return <>{children}</>;

  return (
    <div className="fixed inset-0 bg-zinc-900 flex flex-col items-center justify-center z-50">
      <div className="bg-zinc-800 rounded-lg p-8 shadow-lg text-center max-w-sm">
        <Download className="mx-auto mb-4 w-10 h-10 text-indigo-400" />
        <h2 className="text-xl font-bold mb-2">Install BitBeats</h2>
        <p className="mb-4 text-zinc-300">
          To use all features, please install this app to your device.
        </p>
        <button
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold px-6 py-2 rounded"
          onClick={() => installPrompt?.prompt()}
          disabled={!installPrompt}
        >
          {installPrompt ? 'Install App' : 'Add to Home Screen'}
        </button>
      </div>
    </div>
  );
};

export default InstallGate;
