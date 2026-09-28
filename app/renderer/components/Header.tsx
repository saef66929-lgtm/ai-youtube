import React from 'react';
import { Terminal, Shield, Laptop, Globe } from 'lucide-react';
import { useTranslation, Language } from '../i18n';

interface HeaderProps {
  isElectron: boolean;
  platform: string;
}

export const Header: React.FC<HeaderProps> = ({ isElectron, platform }) => {
  const { language, setLanguage, strings } = useTranslation();
  const t = strings.header;
  const common = strings.common;

  return (
    <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur px-6 py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div className="flex items-center space-x-3 rtl:space-x-reverse">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-red-600 via-rose-500 to-amber-500 flex items-center justify-center shadow-lg shadow-red-950/30 shrink-0">
          <Terminal className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <h1 className="text-xl font-bold tracking-tight text-white">{common.appName}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-red-950/60 text-red-400 border border-red-800/40 font-mono">
              {common.stageBadge}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            {common.stageDescription}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-400 font-mono">
        {/* Language Selector: 🇮🇶 العربية / 🇺🇸 English */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5 shadow-sm">
          <button
            type="button"
            onClick={() => setLanguage('ar')}
            className={`flex items-center space-x-1.5 rtl:space-x-reverse px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              language === 'ar'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>🇮🇶</span>
            <span>العربية</span>
          </button>
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`flex items-center space-x-1.5 rtl:space-x-reverse px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              language === 'en'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>🇺🇸</span>
            <span>English</span>
          </button>
        </div>

        <div className="flex items-center space-x-1.5 rtl:space-x-reverse px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800">
          <Laptop className="w-3.5 h-3.5 text-zinc-400" />
          <span>{isElectron ? `${t.electronShell} (${platform})` : t.webPreview}</span>
        </div>

        <div className="flex items-center space-x-1.5 rtl:space-x-reverse px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800">
          <Shield className="w-3.5 h-3.5 text-emerald-400" />
          <span>{t.loopbackSecure}</span>
        </div>
      </div>
    </header>
  );
};
