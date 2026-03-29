'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { useCallStore } from '@/store/callStore';
import { useAuthStore } from '@/store/authStore';
import { getSocket } from '@/lib/socket';
import { UPLOADS_URL } from '@/lib/api';
import './CallUI.css';

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export default function CallProvider() {
  const { user } = useAuthStore();
  const store = useCallStore();
  const { phase, callId, callType, remoteUser, isCaller, isMuted, isCameraOff, isScreenSharing, isMinimized, duration, remoteCameraOff } = store;

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidate[]>([]);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const ringtoneRef = useRef<HTMLAudioElement | null>(null);
  const outgoingToneRef = useRef<HTMLAudioElement | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; x: number; y: number } | null>(null);
  const floatingRef = useRef<HTMLDivElement>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const [remoteAudioLevel, setRemoteAudioLevel] = useState(0);
  const [localAudioLevel, setLocalAudioLevel] = useState(0);

  // =========== SOCKET LISTENERS ===========
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleIncoming = (data: any) => {
      const cur = useCallStore.getState();
      if (cur.phase !== 'idle') {
        socket.emit('rejectCall', { callId: data.callId });
        return;
      }
      store.setIncoming(data.callId, data.caller, data.type);
      playRingtone();
      // Auto-timeout after 30s
      timeoutRef.current = setTimeout(() => {
        const s = useCallStore.getState();
        if (s.phase === 'incoming') {
          socket.emit('rejectCall', { callId: data.callId });
          stopAllSounds();
          store.reset();
        }
      }, 30000);
    };

    const handleCallInitiated = ({ callId: cid }: any) => {
      store.setCallId(cid);
      playOutgoingTone();
      // Auto-timeout for outgoing
      timeoutRef.current = setTimeout(() => {
        const s = useCallStore.getState();
        if (s.phase === 'outgoing') {
          socket.emit('endCall', { callId: cid });
          fullCleanup();
        }
      }, 30000);
    };

    const handleCallAccepted = async ({ callId: cid }: any) => {
      stopAllSounds();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      store.setActive(cid);
      startTimer();
      // Caller creates and sends offer
      try {
        const pc = pcRef.current;
        if (pc) {
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          const s = useCallStore.getState();
          socket.emit('webrtcOffer', { targetUserId: s.remoteUser?.id, offer });
        }
      } catch (err) { console.error('Offer error:', err); }
    };

    const handleCallRejected = () => {
      stopAllSounds();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      fullCleanup();
    };

    const handleCallEnded = () => {
      stopAllSounds();
      fullCleanup();
    };

    const handleOffer = async ({ from, offer }: any) => {
      try {
        const pc = pcRef.current;
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(offer));
          for (const c of pendingCandidatesRef.current) {
            await pc.addIceCandidate(c);
          }
          pendingCandidatesRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtcAnswer', { targetUserId: from, answer });
        }
      } catch (err) { console.error('Answer error:', err); }
    };

    const handleAnswer = async ({ answer }: any) => {
      try {
        const pc = pcRef.current;
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          for (const c of pendingCandidatesRef.current) {
            await pc.addIceCandidate(c);
          }
          pendingCandidatesRef.current = [];
        }
      } catch (err) { console.error('Set answer error:', err); }
    };

    const handleIce = async ({ candidate }: any) => {
      try {
        const pc = pcRef.current;
        if (pc && pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          pendingCandidatesRef.current.push(new RTCIceCandidate(candidate));
        }
      } catch (err) { console.error('ICE error:', err); }
    };

    socket.on('incomingCall', handleIncoming);
    socket.on('callInitiated', handleCallInitiated);
    socket.on('callAccepted', handleCallAccepted);
    socket.on('callRejected', handleCallRejected);
    socket.on('callEnded', handleCallEnded);
    socket.on('webrtcOffer', handleOffer);
    socket.on('webrtcAnswer', handleAnswer);
    socket.on('webrtcIceCandidate', handleIce);

    // Remote camera off/on signal
    const handleRemoteCameraToggle = ({ cameraOff }: any) => {
      store.setRemoteCameraOff(cameraOff);
    };
    socket.on('remoteCameraToggle', handleRemoteCameraToggle);

    return () => {
      socket.off('incomingCall', handleIncoming);
      socket.off('callInitiated', handleCallInitiated);
      socket.off('callAccepted', handleCallAccepted);
      socket.off('callRejected', handleCallRejected);
      socket.off('callEnded', handleCallEnded);
      socket.off('webrtcOffer', handleOffer);
      socket.off('webrtcAnswer', handleAnswer);
      socket.off('webrtcIceCandidate', handleIce);
      socket.off('remoteCameraToggle', handleRemoteCameraToggle);
    };
  }, []);

  // =========== SOUND SYSTEM ===========
  const ringCtxRef = useRef<AudioContext | null>(null);
  const ringIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const outCtxRef = useRef<AudioContext | null>(null);
  const outIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const playRingtone = () => {
    stopAllSounds(); // always clean up first
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 440;
      osc.type = 'sine';
      gain.gain.value = 0;
      osc.start();
      const ring = () => {
        try {
          gain.gain.setValueAtTime(0.3, ctx.currentTime);
          gain.gain.setValueAtTime(0, ctx.currentTime + 0.4);
          gain.gain.setValueAtTime(0.3, ctx.currentTime + 0.5);
          gain.gain.setValueAtTime(0, ctx.currentTime + 0.9);
        } catch {}
      };
      ring();
      ringCtxRef.current = ctx;
      ringIntervalRef.current = setInterval(ring, 2000);
    } catch {}
  };

  const playOutgoingTone = () => {
    stopAllSounds(); // always clean up first
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 480;
      osc.type = 'sine';
      gain.gain.value = 0;
      osc.start();
      const pattern = () => {
        try {
          gain.gain.setValueAtTime(0.15, ctx.currentTime);
          gain.gain.setValueAtTime(0, ctx.currentTime + 1);
        } catch {}
      };
      pattern();
      outCtxRef.current = ctx;
      outIntervalRef.current = setInterval(pattern, 3000);
    } catch {}
  };

  const stopAllSounds = () => {
    // Stop ringtone
    if (ringIntervalRef.current) { clearInterval(ringIntervalRef.current); ringIntervalRef.current = null; }
    if (ringCtxRef.current) { try { ringCtxRef.current.close(); } catch {} ringCtxRef.current = null; }
    // Stop outgoing tone
    if (outIntervalRef.current) { clearInterval(outIntervalRef.current); outIntervalRef.current = null; }
    if (outCtxRef.current) { try { outCtxRef.current.close(); } catch {} outCtxRef.current = null; }
    // Legacy refs cleanup
    try { (ringtoneRef.current as any)?.stop?.(); } catch {}
    try { (outgoingToneRef.current as any)?.stop?.(); } catch {}
    ringtoneRef.current = null;
    outgoingToneRef.current = null;
  };

  // =========== TIMER ===========
  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      useCallStore.getState().tickDuration();
    }, 1000);
  };

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  // =========== PEER CONNECTION ===========
  const setupPC = useCallback((targetUserId: string) => {
    const socket = getSocket();
    if (!socket) return null;
    const pc = new RTCPeerConnection(ICE_SERVERS);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket.emit('webrtcIceCandidate', { targetUserId, candidate: e.candidate });
      }
    };

    pc.ontrack = (e) => {
      if (e.streams[0]) {
        // Always attach to video ref if it exists
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = e.streams[0];
        }
        // Always attach audio to the dedicated audio element
        if (remoteAudioRef.current) {
          remoteAudioRef.current.srcObject = e.streams[0];
          remoteAudioRef.current.play().catch(() => {});
        }
        // Set up audio analyser for remote stream
        setupRemoteAudioAnalyser(e.streams[0]);

        // Detect when remote user disables their video track
        const videoTrack = e.streams[0].getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.onmute = () => store.setRemoteCameraOff(true);
          videoTrack.onunmute = () => store.setRemoteCameraOff(false);
          // Check initial state
          if (!videoTrack.enabled || videoTrack.muted) {
            store.setRemoteCameraOff(true);
          }
        }
      }
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
        fullCleanup();
      }
    };

    pcRef.current = pc;
    return pc;
  }, []);

  // =========== AUDIO LEVEL ANALYSIS ===========
  const setupRemoteAudioAnalyser = useCallback((stream: MediaStream) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      // DON'T connect analyser to destination — the <audio> element handles playback
      remoteAnalyserRef.current = analyser;
    } catch (err) {
      console.error('Remote analyser error:', err);
    }
  }, []);

  const setupLocalAudioAnalyser = useCallback((stream: MediaStream) => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const ctx = audioCtxRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.5;
      source.connect(analyser);
      localAnalyserRef.current = analyser;
    } catch (err) {
      console.error('Local analyser error:', err);
    }
  }, []);

  // Audio level polling loop
  useEffect(() => {
    if (phase !== 'active') {
      setRemoteAudioLevel(0);
      setLocalAudioLevel(0);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const poll = () => {
      if (remoteAnalyserRef.current) {
        const data = new Uint8Array(remoteAnalyserRef.current.frequencyBinCount);
        remoteAnalyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
        setRemoteAudioLevel(avg / 255); // 0-1
      }
      if (localAnalyserRef.current) {
        const data = new Uint8Array(localAnalyserRef.current.frequencyBinCount);
        localAnalyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((sum, v) => sum + v, 0) / data.length;
        setLocalAudioLevel(avg / 255); // 0-1
      }
      animFrameRef.current = requestAnimationFrame(poll);
    };
    animFrameRef.current = requestAnimationFrame(poll);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [phase]);

  // =========== CALL ACTIONS ===========
  const initiateCall = useCallback(async (targetUser: any, type: 'AUDIO' | 'VIDEO') => {
    const socket = getSocket();
    if (!socket) return;
    const cur = useCallStore.getState();
    if (cur.phase !== 'idle') return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'VIDEO',
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // Set up local audio analyser for speaking detection
      setupLocalAudioAnalyser(stream);

      const pc = setupPC(targetUser.id);
      if (pc) stream.getTracks().forEach(t => pc.addTrack(t, stream));

      store.startOutgoing(targetUser, type);
      socket.emit('callUser', { receiverId: targetUser.id, type });
    } catch (err) {
      console.error('Media error:', err);
      alert('Could not access camera/mic. Please allow permissions.');
    }
  }, [setupPC]);

  const acceptCall = useCallback(async () => {
    const socket = getSocket();
    if (!socket) return;
    const s = useCallStore.getState();
    if (s.phase !== 'incoming' || !s.remoteUser) return;

    stopAllSounds();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: s.callType === 'VIDEO',
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;

      // Set up local audio analyser for speaking detection
      setupLocalAudioAnalyser(stream);

      const pc = setupPC(s.remoteUser.id);
      if (pc) stream.getTracks().forEach(t => pc.addTrack(t, stream));

      socket.emit('acceptCall', { callId: s.callId });
      store.setActive(s.callId!);
      startTimer();
    } catch (err) {
      console.error('Media error:', err);
      alert('Could not access camera/mic.');
    }
  }, [setupPC]);

  const rejectCall = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    const s = useCallStore.getState();
    if (s.callId) socket.emit('rejectCall', { callId: s.callId });
    stopAllSounds();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    store.reset();
  }, []);

  const endCall = useCallback(() => {
    const socket = getSocket();
    if (!socket) return;
    const s = useCallStore.getState();
    if (s.callId) socket.emit('endCall', { callId: s.callId });
    fullCleanup();
  }, []);

  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(t => { t.enabled = !t.enabled; });
      store.toggleMute();
    }
  }, []);

  const toggleCamera = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(t => { t.enabled = !t.enabled; });
      store.toggleCamera();
      // Signal the remote user about camera state
      const socket = getSocket();
      const s = useCallStore.getState();
      if (socket && s.remoteUser) {
        socket.emit('cameraToggle', { targetUserId: s.remoteUser.id, cameraOff: s.isCameraOff });
      }
    }
  }, []);

  const toggleScreenShare = useCallback(async () => {
    const s = useCallStore.getState();
    const pc = pcRef.current;
    if (!pc) return;

    if (!s.isScreenSharing) {
      try {
        const screen = await navigator.mediaDevices.getDisplayMedia({ video: true });
        screenStreamRef.current = screen;
        const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (videoSender && screen.getVideoTracks()[0]) {
          await videoSender.replaceTrack(screen.getVideoTracks()[0]);
        }
        screen.getVideoTracks()[0].onended = () => stopScreenShare();
        store.toggleScreenShare();
      } catch {}
    } else {
      stopScreenShare();
    }
  }, []);

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
    }
    // Restore camera
    const pc = pcRef.current;
    if (pc && localStreamRef.current) {
      const camTrack = localStreamRef.current.getVideoTracks()[0];
      if (camTrack) {
        const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (videoSender) videoSender.replaceTrack(camTrack);
      }
    }
    const s = useCallStore.getState();
    if (s.isScreenSharing) store.toggleScreenShare();
  };

  const switchToVideo = useCallback(async () => {
    const s = useCallStore.getState();
    if (s.callType === 'VIDEO') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      const pc = pcRef.current;
      if (pc && stream.getVideoTracks()[0]) {
        pc.addTrack(stream.getVideoTracks()[0], localStreamRef.current || stream);
        if (localStreamRef.current) {
          localStreamRef.current.addTrack(stream.getVideoTracks()[0]);
        }
        if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      }
      store.switchToVideo();
    } catch {}
  }, []);

  const fullCleanup = () => {
    stopAllSounds();
    if (localStreamRef.current) { localStreamRef.current.getTracks().forEach(t => t.stop()); localStreamRef.current = null; }
    if (screenStreamRef.current) { screenStreamRef.current.getTracks().forEach(t => t.stop()); screenStreamRef.current = null; }
    if (pcRef.current) { pcRef.current.close(); pcRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch {} audioCtxRef.current = null; }
    remoteAnalyserRef.current = null;
    localAnalyserRef.current = null;
    pendingCandidatesRef.current = [];
    if (remoteAudioRef.current) { remoteAudioRef.current.srcObject = null; }
    useCallStore.getState().reset();
  };

  // Expose initiateCall globally
  useEffect(() => {
    (window as any).__callProvider = { initiateCall, acceptCall, rejectCall, endCall, toggleMute, toggleCamera, toggleScreenShare, switchToVideo };
    return () => { delete (window as any).__callProvider; };
  }, [initiateCall, acceptCall, rejectCall, endCall, toggleMute, toggleCamera, toggleScreenShare, switchToVideo]);

  // Ensure local video is bound when phase/callType change
  useEffect(() => {
    if (phase === 'active' && localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [phase, callType, isCameraOff]);

  // =========== DRAG HANDLING ===========
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    const el = floatingRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragRef.current = { startX: clientX - rect.left, startY: clientY - rect.top, x: rect.left, y: rect.top };

    const handleDragMove = (ev: MouseEvent | TouchEvent) => {
      if (!dragRef.current || !el) return;
      const cx = 'touches' in ev ? (ev as TouchEvent).touches[0].clientX : (ev as MouseEvent).clientX;
      const cy = 'touches' in ev ? (ev as TouchEvent).touches[0].clientY : (ev as MouseEvent).clientY;
      const x = cx - dragRef.current.startX;
      const y = cy - dragRef.current.startY;
      el.style.left = `${Math.max(0, Math.min(window.innerWidth - el.offsetWidth, x))}px`;
      el.style.top = `${Math.max(0, Math.min(window.innerHeight - el.offsetHeight, y))}px`;
      el.style.right = 'auto';
      el.style.bottom = 'auto';
    };

    const handleDragEnd = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };

    window.addEventListener('mousemove', handleDragMove);
    window.addEventListener('mouseup', handleDragEnd);
    window.addEventListener('touchmove', handleDragMove);
    window.addEventListener('touchend', handleDragEnd);
  };

  // =========== RENDER NOTHING IF IDLE ===========
  // Hidden audio element for remote audio playback (always present when not idle)
  if (phase === 'idle') return <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />;

  const avatar = remoteUser?.avatar ? `${UPLOADS_URL}${remoteUser.avatar}` : null;
  const initial = remoteUser?.name?.[0]?.toUpperCase() || '?';

  // =========== INCOMING CALL MODAL ===========
  if (phase === 'incoming') {
    return (
      <div className="call-overlay">
        <div className="call-incoming-modal">
          <div className="call-incoming-pulse"></div>
          <div className="call-incoming-pulse call-incoming-pulse-2"></div>
          {avatar ? (
            <img src={avatar} alt="" className="call-avatar-lg" />
          ) : (
            <div className="call-avatar-fallback-lg">{initial}</div>
          )}
          <h2 className="call-incoming-name">{remoteUser?.username}</h2>
          <p className="call-incoming-type">
            Incoming {callType === 'VIDEO' ? 'Video' : 'Audio'} Call
          </p>
          <div className="call-incoming-actions">
            <button className="call-btn-accept" onClick={acceptCall}>
              <span>📞</span>
              <span>Accept</span>
            </button>
            <button className="call-btn-reject" onClick={rejectCall}>
              <span>📵</span>
              <span>Decline</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========== MINIMIZED FLOATING WINDOW ===========
  if (isMinimized) {
    return (
      <div className="call-floating-mini" ref={floatingRef} onMouseDown={handleDragStart} onTouchStart={handleDragStart}>
        <div className="call-floating-mini-inner">
          {callType === 'VIDEO' && phase === 'active' ? (
            <video ref={remoteVideoRef} autoPlay playsInline className="call-floating-video" />
          ) : (
            <div className="call-floating-avatar">
              {avatar ? <img src={avatar} alt="" /> : <span>{initial}</span>}
            </div>
          )}
          <div className="call-floating-info">
            <span className="call-floating-name">{remoteUser?.username}</span>
            <span className="call-floating-dur">{phase === 'active' ? formatDuration(duration) : 'Calling...'}</span>
          </div>
          <div className="call-floating-btns">
            <button className="call-mini-btn call-mini-expand" onClick={() => store.toggleMinimize()}>⬆</button>
            <button className="call-mini-btn call-mini-end" onClick={endCall}>📵</button>
          </div>
        </div>
      </div>
    );
  }

  // =========== FULL SCREEN CALL UI ===========
  return (
    <div className="call-overlay">
      {/* Hidden audio element ensures remote audio always plays even in audio-only call */}
      <audio ref={remoteAudioRef} autoPlay playsInline style={{ display: 'none' }} />
      <div className="call-fullscreen">
        {/* Remote Video / Camera Off */}
        {callType === 'VIDEO' && phase === 'active' && (
          <>
            <video ref={remoteVideoRef} autoPlay playsInline className="call-remote-video" style={{ display: remoteCameraOff ? 'none' : 'block' }} />
            {remoteCameraOff && (
              <div className="call-remote-cam-off">
                {avatar ? (
                  <img src={avatar} alt="" className="call-camoff-avatar" />
                ) : (
                  <div className="call-camoff-avatar-fb">{initial}</div>
                )}
                <p className="call-camoff-text">{remoteUser?.username}&apos;s camera is off</p>
              </div>
            )}
          </>
        )}

        {callType === 'AUDIO' && phase === 'active' && (
          <div className="call-audio-bg">
            {/* Remote user's audio visualisation */}
            <div className="call-audio-label">🔊 {remoteUser?.username}</div>
            <div className="call-audio-wave">
              {[0.6, 0.8, 1.0, 1.2, 1.0, 0.8, 0.6].map((scale, i) => (
                <span
                  key={`r-${i}`}
                  style={{
                    height: `${Math.max(6, remoteAudioLevel * 80 * scale)}px`,
                    opacity: remoteAudioLevel > 0.02 ? 0.6 + remoteAudioLevel * 0.4 : 0.15,
                    transition: 'height 0.08s ease, opacity 0.08s ease',
                  }}
                />
              ))}
            </div>
            {/* Local user's audio visualisation */}
            <div className="call-audio-label" style={{ marginTop: 24 }}>🎙️ You {isMuted ? '(Muted)' : ''}</div>
            <div className="call-audio-wave call-audio-wave-local">
              {[0.6, 0.8, 1.0, 1.2, 1.0, 0.8, 0.6].map((scale, i) => (
                <span
                  key={`l-${i}`}
                  style={{
                    height: `${Math.max(6, (isMuted ? 0 : localAudioLevel) * 80 * scale)}px`,
                    opacity: !isMuted && localAudioLevel > 0.02 ? 0.6 + localAudioLevel * 0.4 : 0.15,
                    transition: 'height 0.08s ease, opacity 0.08s ease',
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Top bar */}
        <div className="call-top-bar">
          <div className="call-top-info">
            {avatar ? (
              <img src={avatar} alt="" className="call-top-avatar" />
            ) : (
              <div className="call-top-avatar-fb">{initial}</div>
            )}
            <div>
              <h3>{remoteUser?.username}</h3>
              <p>
                {phase === 'outgoing' ? 'Ringing...' : phase === 'active' ? formatDuration(duration) : callType === 'VIDEO' ? 'Video Call' : 'Audio Call'}
              </p>
            </div>
          </div>
          <button className="call-minimize-btn" onClick={() => store.toggleMinimize()}>⬇</button>
        </div>

        {/* Outgoing / Ringing */}
        {phase === 'outgoing' && (
          <div className="call-ringing-center">
            <div className="call-ringing-ring" />
            <div className="call-ringing-ring call-ringing-ring-2" />
            {avatar ? (
              <img src={avatar} alt="" className="call-avatar-lg" />
            ) : (
              <div className="call-avatar-fallback-lg">{initial}</div>
            )}
            <h2>{remoteUser?.username}</h2>
            <p className="call-ringing-text">Calling...</p>
          </div>
        )}

        {/* Local PiP — always visible during active video call */}
        {callType === 'VIDEO' && phase === 'active' && (
          <div className="call-local-pip">
            <video ref={localVideoRef} autoPlay playsInline muted className="call-local-video" />
            {isCameraOff && (
              <div className="call-cam-off">
                <span>📷</span>
                <span>Camera Off</span>
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="call-controls-bar">
          <button className={`call-ctrl-btn ${isMuted ? 'call-ctrl-active' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? '🔇' : '🎙️'}
          </button>

          {callType === 'VIDEO' && (
            <button className={`call-ctrl-btn ${isCameraOff ? 'call-ctrl-active' : ''}`} onClick={toggleCamera} title="Camera">
              {isCameraOff ? '📷' : '🎥'}
            </button>
          )}

          {callType === 'AUDIO' && phase === 'active' && (
            <button className="call-ctrl-btn" onClick={switchToVideo} title="Switch to Video">
              🎥
            </button>
          )}

          {phase === 'active' && (
            <button className={`call-ctrl-btn ${isScreenSharing ? 'call-ctrl-active' : ''}`} onClick={toggleScreenShare} title="Screen Share">
              🖥️
            </button>
          )}

          <button className="call-end-btn" onClick={endCall}>
            📵 End Call
          </button>
        </div>
      </div>
    </div>
  );
}
