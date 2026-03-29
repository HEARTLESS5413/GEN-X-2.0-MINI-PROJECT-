import { create } from 'zustand';

export type CallPhase = 'idle' | 'outgoing' | 'incoming' | 'active' | 'ended';
export type CallType = 'AUDIO' | 'VIDEO';

interface CallUser {
  id: string;
  username: string;
  name: string;
  avatar: string | null;
}

interface CallState {
  phase: CallPhase;
  callId: string | null;
  callType: CallType;
  remoteUser: CallUser | null;
  isCaller: boolean;
  isMuted: boolean;
  isCameraOff: boolean;
  isScreenSharing: boolean;
  isMinimized: boolean;
  duration: number;
  remoteCameraOff: boolean;

  // Actions
  startOutgoing: (user: CallUser, type: CallType) => void;
  setIncoming: (callId: string, caller: CallUser, type: CallType) => void;
  setActive: (callId: string) => void;
  setCallId: (callId: string) => void;
  endCall: () => void;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleScreenShare: () => void;
  toggleMinimize: () => void;
  tickDuration: () => void;
  switchToVideo: () => void;
  setRemoteCameraOff: (off: boolean) => void;
  reset: () => void;
}

const initialState = {
  phase: 'idle' as CallPhase,
  callId: null as string | null,
  callType: 'AUDIO' as CallType,
  remoteUser: null as CallUser | null,
  isCaller: false,
  isMuted: false,
  isCameraOff: false,
  isScreenSharing: false,
  isMinimized: false,
  duration: 0,
  remoteCameraOff: false,
};

export const useCallStore = create<CallState>((set) => ({
  ...initialState,

  startOutgoing: (user, type) => set({
    phase: 'outgoing',
    remoteUser: user,
    callType: type,
    isCaller: true,
    isMuted: false,
    isCameraOff: false,
    isScreenSharing: false,
    isMinimized: false,
    duration: 0,
    remoteCameraOff: false,
  }),

  setIncoming: (callId, caller, type) => set({
    phase: 'incoming',
    callId,
    remoteUser: caller,
    callType: type,
    isCaller: false,
    isMuted: false,
    isCameraOff: false,
    isScreenSharing: false,
    isMinimized: false,
    duration: 0,
    remoteCameraOff: false,
  }),

  setActive: (callId) => set({ phase: 'active', callId, duration: 0 }),
  setCallId: (callId) => set({ callId }),
  endCall: () => set({ phase: 'ended' }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  toggleCamera: () => set((s) => ({ isCameraOff: !s.isCameraOff })),
  toggleScreenShare: () => set((s) => ({ isScreenSharing: !s.isScreenSharing })),
  toggleMinimize: () => set((s) => ({ isMinimized: !s.isMinimized })),
  tickDuration: () => set((s) => ({ duration: s.duration + 1 })),
  switchToVideo: () => set({ callType: 'VIDEO' }),
  setRemoteCameraOff: (off) => set({ remoteCameraOff: off }),
  reset: () => set(initialState),
}));
