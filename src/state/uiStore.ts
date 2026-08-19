import { create } from 'zustand';
import type { FabricationStatus } from '@/lib/schemas';

export type WorkspaceMode = 'design' | 'fabrication' | 'compare';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
export type EnvironmentId = 'studio' | 'warehouse' | 'night';
export type BackgroundId = 'graphite' | 'paper' | 'horizon';
export type FabFilter = 'all' | 'affected' | 'scan' | 'print' | FabricationStatus;
export type ConfigTab = 'build' | 'paint' | 'wheels' | 'stance' | 'components' | 'titanforge';

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export type DialogState =
  | { kind: 'none' }
  | { kind: 'vehicle-change'; targetVehicleId: string }
  | { kind: 'share' }
  | { kind: 'import' }
  | { kind: 'vehicle-authoring'; assetId: string }
  | { kind: 'snapshot' }
  | { kind: 'builds' }
  | { kind: 'summary' };

let toastSeq = 0;

export interface UiState {
  mode: WorkspaceMode;
  activeTab: ConfigTab;
  saveStatus: SaveStatus;

  selectedComponentId: string | null;
  hoveredComponentId: string | null;
  isolatedComponentId: string | null;
  ghostMode: boolean;
  explodeFactor: number;
  turntable: boolean;
  environment: EnvironmentId;
  background: BackgroundId;
  showGrid: boolean;
  reducedMotion: boolean;
  cameraPresetRequest: { presetId: string; nonce: number } | null;
  /** Compare mode: saved build id shown in the B pane (null = factory stock). */
  compareBuildId: string | null;
  fabFilter: FabFilter;
  /** When true, next viewport click places an annotation hotspot. */
  placingAnnotation: boolean;
  viewerStatus: { state: 'empty' | 'loading' | 'ready' | 'error'; message?: string };
  dialog: DialogState;
  toasts: Toast[];
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  trayOpen: boolean;

  setMode: (mode: WorkspaceMode) => void;
  setActiveTab: (tab: ConfigTab) => void;
  setSaveStatus: (s: SaveStatus) => void;
  select: (componentId: string | null) => void;
  hover: (componentId: string | null) => void;
  isolate: (componentId: string | null) => void;
  setGhostMode: (on: boolean) => void;
  setExplodeFactor: (f: number) => void;
  setTurntable: (on: boolean) => void;
  setEnvironment: (e: EnvironmentId) => void;
  setBackground: (b: BackgroundId) => void;
  setShowGrid: (on: boolean) => void;
  setReducedMotion: (on: boolean) => void;
  requestCameraPreset: (presetId: string) => void;
  setCompareBuildId: (id: string | null) => void;
  setFabFilter: (f: FabFilter) => void;
  setPlacingAnnotation: (on: boolean) => void;
  setViewerStatus: (s: UiState['viewerStatus']) => void;
  openDialog: (d: DialogState) => void;
  closeDialog: () => void;
  toast: (kind: Toast['kind'], message: string) => void;
  dismissToast: (id: number) => void;
  setLeftPanelOpen: (open: boolean) => void;
  setRightPanelOpen: (open: boolean) => void;
  setTrayOpen: (open: boolean) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  mode: 'design',
  activeTab: 'build',
  saveStatus: 'idle',
  selectedComponentId: null,
  hoveredComponentId: null,
  isolatedComponentId: null,
  ghostMode: false,
  explodeFactor: 0,
  turntable: false,
  environment: 'studio',
  background: 'graphite',
  showGrid: true,
  reducedMotion:
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  cameraPresetRequest: null,
  compareBuildId: null,
  fabFilter: 'all',
  placingAnnotation: false,
  viewerStatus: { state: 'empty' },
  dialog: { kind: 'none' },
  toasts: [],
  leftPanelOpen: true,
  rightPanelOpen: true,
  trayOpen: true,

  setMode: (mode) =>
    set({
      mode,
      // Entering compare always starts against the factory-stock reference.
      compareBuildId: null,
      activeTab: mode === 'fabrication' ? 'titanforge' : get().activeTab,
    }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  select: (selectedComponentId) => set({ selectedComponentId }),
  hover: (hoveredComponentId) => set({ hoveredComponentId }),
  isolate: (isolatedComponentId) => set({ isolatedComponentId }),
  setGhostMode: (ghostMode) => set({ ghostMode }),
  setExplodeFactor: (explodeFactor) => set({ explodeFactor }),
  setTurntable: (turntable) => set({ turntable }),
  setEnvironment: (environment) => set({ environment }),
  setBackground: (background) => set({ background }),
  setShowGrid: (showGrid) => set({ showGrid }),
  setReducedMotion: (reducedMotion) => set({ reducedMotion }),
  requestCameraPreset: (presetId) =>
    set({ cameraPresetRequest: { presetId, nonce: Date.now() + Math.random() } }),
  setCompareBuildId: (compareBuildId) => set({ compareBuildId }),
  setFabFilter: (fabFilter) => set({ fabFilter }),
  setPlacingAnnotation: (placingAnnotation) => set({ placingAnnotation }),
  setViewerStatus: (viewerStatus) => set({ viewerStatus }),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: { kind: 'none' } }),
  toast: (kind, message) => {
    const id = ++toastSeq;
    set({ toasts: [...get().toasts, { id, kind, message }] });
    setTimeout(() => get().dismissToast(id), 6000);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
  setLeftPanelOpen: (leftPanelOpen) => set({ leftPanelOpen }),
  setRightPanelOpen: (rightPanelOpen) => set({ rightPanelOpen }),
  setTrayOpen: (trayOpen) => set({ trayOpen }),
}));
