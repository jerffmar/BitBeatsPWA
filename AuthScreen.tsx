
import React, { useState } from 'react';
import { Disc, ArrowRight, Lock, User as UserIcon, Loader } from 'lucide-react';
import { login, register } from './services/auth';
import { User } from './types';

interface AuthScreenProps {
  onLogin: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLogin }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const result = isRegistering 
        ? await register(username, password)
        : await login(username, password);

      if (result.success && result.user) {
        onLogin(result.user);
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-brand-500/10 border border-brand-500/20 mb-6 shadow-xl shadow-brand-500/10">
            <Disc size={40} className="text-brand-500 animate-spin-slow" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">BitBeats</h1>
          <p className="text-gray-400">Decentralized Duty-Free Streaming</p>
        </div>

        <div className="bg-dark-surface/50 backdrop-blur-xl border border-white/5 p-8 rounded-2xl shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            {isRegistering ? 'Create Identity' : 'Access Vault'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Username</label>
              <div className="relative">
                <UserIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50 transition-all placeholder-gray-600"
                  placeholder="Enter your handle"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-1 ml-1">Password</label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/50 transition-all placeholder-gray-600"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm text-center">
                {error}
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-brand-500/20 flex items-center justify-center gap-2 mt-4 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {loading ? <Loader size={20} className="animate-spin" /> : (
                <>
                  {isRegistering ? 'Initialize Node' : 'Connect'}
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button 
              onClick={() => { setError(''); setIsRegistering(!isRegistering); }}
              className="text-sm text-gray-500 hover:text-brand-400 transition-colors"
            >
              {isRegistering ? 'Already have an ID? Login' : "Don't have an identity? Join the Swarm"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
