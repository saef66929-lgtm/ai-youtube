import React from 'react';
import { HomePage } from './pages/HomePage';
import { LanguageProvider } from './i18n';

export default function App() {
  return (
    <LanguageProvider>
      <HomePage />
    </LanguageProvider>
  );
}
