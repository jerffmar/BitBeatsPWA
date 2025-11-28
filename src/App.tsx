import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './layouts/AppLayout';
import AlbumDetails from './pages/AlbumDetails';
import UploadPage from './pages/UploadPage';
import InstallGate from './components/PWA/InstallGate';

const App: React.FC = () => (
  <BrowserRouter>
    <InstallGate>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Navigate to="/library" replace />} />
          <Route path="/library" element={<AlbumDetails />} />
          <Route path="/upload" element={<UploadPage />} />
        </Routes>
      </AppLayout>
    </InstallGate>
  </BrowserRouter>
);

export default App;
