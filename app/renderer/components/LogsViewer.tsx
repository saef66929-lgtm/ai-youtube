import React, { useState, useEffect } from 'react';
import { Terminal, CheckCircle } from 'lucide-react';
import { useTranslation } from '../i18n';

interface LogsViewerProps {
  engineStatus: string;
}

export const LogsViewer: React.FC<LogsViewerProps> = ({ engineStatus }) => {
  const { strings } = useTranslation();
  const t = strings.logs;

  const [logs, setLogs] = useState<string[]>([
    `[${new Date().toISOString().substring(0, 19).replace('T', ' ')}] [INFO] [App]: ${t.stage0Init}`,
    `[${new Date().toISOString().substring(0, 19).replace('T', ' ')}] [INFO] [App]: ${t.configLoaded}`,
    `[${new Date().toISOString().substring(0, 19).replace('T', ' ')}] [INFO] [App]: ${t.statusReady}`,
    `[${new Date().toISOString().substring(0, 19).replace('T', ' ')}] [INFO] [App]: ${t.hardwareStage1}`,
  ]);

  useEffect(() => {
    if (engineStatus === 'Connected') {
      setLogs((prev) => [
        ...prev,
        `[${new Date().toISOString().substring(0, 19).replace('T', ' ')}] [INFO] [Sidecar]: Handshake received on 127.0.0.1:8765`,
        `[${new Date().toISOString().substring(0, 19).replace('T', ' ')}] [INFO] [Sidecar]: Python Sidecar loopback API active`,
      ]);
    }
  }, [engineStatus]);

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center space-x-2 rtl:space-x-reverse text-white font-semibold text-sm">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>{t.title}</span>
        </div>
        <div className="flex items-center space-x-2 rtl:space-x-reverse text-xs text-zinc-500 font-mono">
          <span className="flex items-center space-x-1 rtl:space-x-reverse text-emerald-400">
            <CheckCircle className="w-3.5 h-3.5" />
            <span>{t.utf8Badge}</span>
          </span>
        </div>
      </div>

      <div className="bg-zinc-950 border border-zinc-800/80 rounded-lg p-3 font-mono text-xs text-zinc-300 max-h-48 overflow-y-auto space-y-1 dir-ltr text-start">
        {logs.map((log, index) => {
          let color = 'text-zinc-300';
          if (log.includes('[ERROR]')) color = 'text-rose-400';
          else if (log.includes('[WARN]')) color = 'text-amber-400';
          else if (log.includes('Connected') || log.includes('Ready') || log.includes('متاح')) color = 'text-emerald-300';

          return (
            <div key={index} className={`leading-relaxed ${color}`}>
              {log}
            </div>
          );
        })}
      </div>
    </div>
  );
};
