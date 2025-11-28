import React, { useState } from 'react';
import axios from 'axios';
import { UploadCloud, Loader2, CheckCircle2, XCircle } from 'lucide-react';

const UploadPage: React.FC = () => {
  const [form, setForm] = useState({
    title: '',
    artist: '',
    album: '',
    file: null as File | null,
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, files } = e.target;
    if (name === 'file' && files) {
      setForm(f => ({ ...f, file: files[0] }));
    } else {
      setForm(f => ({ ...f, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);
    setProgress(0);

    const data = new FormData();
    data.append('title', form.title);
    data.append('artist', form.artist);
    data.append('album', form.album);
    if (form.file) data.append('file', form.file);

    try {
      await axios.post('/api/upload', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: evt => {
          if (evt.total) setProgress(Math.round((evt.loaded / evt.total) * 100));
        }
      });
      setSuccess(true);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Upload failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto mt-12 bg-zinc-900 rounded-lg p-8 shadow-lg">
      <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
        <UploadCloud className="w-6 h-6" /> Upload Music
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          name="title"
          type="text"
          placeholder="Title"
          value={form.title}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded bg-zinc-800 text-white"
          required
        />
        <input
          name="artist"
          type="text"
          placeholder="Artist"
          value={form.artist}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded bg-zinc-800 text-white"
          required
        />
        <input
          name="album"
          type="text"
          placeholder="Album"
          value={form.album}
          onChange={handleChange}
          className="w-full px-3 py-2 rounded bg-zinc-800 text-white"
        />
        <input
          name="file"
          type="file"
          accept="audio/*"
          onChange={handleChange}
          className="w-full px-3 py-2 rounded bg-zinc-800 text-white"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 rounded text-white font-semibold flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
          {loading ? 'Uploading...' : 'Upload'}
        </button>
        {loading && (
          <div className="w-full bg-zinc-700 rounded h-2 mt-2">
            <div className="bg-indigo-500 h-2 rounded" style={{ width: `${progress}%` }} />
          </div>
        )}
        {success && (
          <div className="flex items-center gap-2 text-green-500 mt-2">
            <CheckCircle2 className="w-5 h-5" /> Upload successful!
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 text-red-500 mt-2">
            <XCircle className="w-5 h-5" /> {error}
          </div>
        )}
      </form>
    </div>
  );
};

export default UploadPage;
