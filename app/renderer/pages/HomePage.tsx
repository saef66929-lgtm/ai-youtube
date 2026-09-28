import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { StatusCard } from '../components/StatusCard';
import { HardwareCard } from '../components/HardwareCard';
import { DiagnosticsPanel } from '../components/DiagnosticsPanel';
import { LogsViewer } from '../components/LogsViewer';
import { engineApi, EngineStatusData, AppConfigData, HardwareProfile } from '../services/engineApi';
import { useTranslation } from '../i18n';

export const HomePage: React.FC = () => {
  const { strings, isRtl } = useTranslation();
  const tBanner = strings.banner;
  const tFooter = strings.footer;

  const [statusData, setStatusData] = useState<EngineStatusData>({
    appName: 'AI YouTube',
    status: 'Application Ready',
    engine: {
      name: 'Python Sidecar',
      status: 'Not Connected',
    },
    hardware: 'Not Scanned Yet',
  });

  const [hardwareProfile, setHardwareProfile] = useState<HardwareProfile | null>(null);
  const [isScanningHardware, setIsScanningHardware] = useState<boolean>(false);
  const [config, setConfig] = useState<AppConfigData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const isElectron = engineApi.isElectron();
  const platform = window.electronAPI?.platform || 'desktop';

  const refreshStatus = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await engineApi.getStatus();
      setStatusData(data);
      const cfg = await engineApi.getConfig();
      if (cfg) setConfig(cfg);
    } catch (err) {
      console.error('Failed to fetch status:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadHardwareProfile = useCallback(async () => {
    try {
      const profile = await engineApi.getHardwareProfile();
      if (profile && profile.scanned) {
        setHardwareProfile(profile);
      } else {
        // Run initial scan if not scanned yet
        handleRescanHardware();
      }
    } catch (err) {
      console.error('Failed to load hardware profile:', err);
    }
  }, []);

  const handleRescanHardware = async () => {
    setIsScanningHardware(true);
    try {
      const profile = await engineApi.scanHardware();
      if (profile) {
        setHardwareProfile(profile);
        setStatusData((prev) => ({
          ...prev,
          hardware: profile.overall_status || 'Ready',
        }));
      }
    } catch (err) {
      console.error('Failed to scan hardware:', err);
    } finally {
      setIsScanningHardware(false);
    }
  };

  useEffect(() => {
    refreshStatus();
    loadHardwareProfile();

    // Listen to real-time status changes if running in Electron
    if (window.electronAPI?.onEngineStatusChanged) {
      const unsubscribe = window.electronAPI.onEngineStatusChanged((state: any) => {
        let engineStatusText: 'Connected' | 'Starting' | 'Not Connected' | 'Stopped' = 'Not Connected';
        if (state.status === 'connected') engineStatusText = 'Connected';
        else if (state.status === 'starting') engineStatusText = 'Starting';
        else if (state.status === 'stopped') engineStatusText = 'Stopped';

        setStatusData((prev) => ({
          ...prev,
          engine: {
            ...prev.engine,
            status: engineStatusText,
            host: state.host,
            port: state.port,
            pid: state.pid,
            uptimeSeconds: state.uptimeSeconds,
          },
          lastError: state.lastError,
        }));
      });

      return () => {
        unsubscribe();
      };
    }

    // Polling fallback
    const interval = setInterval(refreshStatus, 4000);
    return () => clearInterval(interval);
  }, [refreshStatus, loadHardwareProfile]);

  const handleStartEngine = async () => {
    setIsLoading(true);
    try {
      await engineApi.startEngine();
      await refreshStatus();
      await loadHardwareProfile();
    } finally {
      setIsLoading(false);
    }
  };

  const handleStopEngine = async () => {
    setIsLoading(true);
    try {
      await engineApi.stopEngine();
      await refreshStatus();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen bg-[#090a0f] text-zinc-100 flex flex-col font-sans selection:bg-rose-500/30 ${isRtl ? 'font-arabic' : ''}`}>
      <Header isElectron={isElectron} platform={platform} />

      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {/* Banner with Stage 1 Focus */}
        <div className="bg-gradient-to-r from-zinc-900 via-zinc-900 to-zinc-950 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-red-600/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl">
            <span className="text-xs uppercase tracking-widest font-mono text-rose-400 font-semibold">
              {tBanner.badge}
            </span>
            <h2 className="text-2xl font-bold text-white mt-1">
              {tBanner.title}
            </h2>
            <p className="text-sm text-zinc-400 mt-2 leading-relaxed">
              {tBanner.description}
            </p>
          </div>
        </div>

        {/* Primary Stage Status Card */}
        <StatusCard
          data={statusData}
          isLoading={isLoading}
          onRefresh={refreshStatus}
          onStartEngine={handleStartEngine}
          onStopEngine={handleStopEngine}
          isElectron={isElectron}
        />

        {/* Real Hardware Diagnostics Card (Stage 1 Core) */}
        <HardwareCard
          profile={hardwareProfile}
          isScanning={isScanningHardware}
          onRescan={handleRescanHardware}
        />

        {/* Folder Structure & Security Boundaries */}
        <DiagnosticsPanel config={config} />

        {/* Real Logs Viewer */}
        <LogsViewer engineStatus={statusData.engine.status} />
      </main>

      <footer className="border-t border-zinc-800/80 bg-zinc-950/80 px-6 py-4 text-center text-xs text-zinc-500 font-mono">
        {tFooter.copyright}
      </footer>
    </div>
  );
};
