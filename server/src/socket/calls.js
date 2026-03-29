function callHandler(io, socket, prisma, onlineUsers) {
  // Initiate call
  socket.on('callUser', async ({ receiverId, type }) => {
    try {
      // Check if receiver is online
      const isReceiverOnline = onlineUsers.has(receiverId);

      const call = await prisma.call.create({
        data: {
          callerId: socket.userId,
          receiverId,
          type: type || 'VIDEO',
          status: 'RINGING'
        }
      });

      const caller = await prisma.user.findUnique({
        where: { id: socket.userId },
        select: { id: true, username: true, name: true, avatar: true }
      });

      if (isReceiverOnline) {
        io.to(`user:${receiverId}`).emit('incomingCall', {
          callId: call.id,
          caller,
          type: type || 'VIDEO'
        });
      }

      socket.emit('callInitiated', {
        callId: call.id,
        receiverOnline: isReceiverOnline
      });

      // Auto-timeout: mark as missed after 35 seconds if still ringing
      setTimeout(async () => {
        try {
          const c = await prisma.call.findUnique({ where: { id: call.id } });
          if (c && c.status === 'RINGING') {
            await prisma.call.update({
              where: { id: call.id },
              data: { status: 'MISSED', endedAt: new Date() }
            });
          }
        } catch {}
      }, 35000);

    } catch (error) {
      console.error('Call error:', error);
      socket.emit('callError', { error: 'Failed to initiate call' });
    }
  });

  // Accept call
  socket.on('acceptCall', async ({ callId }) => {
    try {
      const call = await prisma.call.update({
        where: { id: callId },
        data: { status: 'ACTIVE' }
      });

      const receiver = await prisma.user.findUnique({
        where: { id: socket.userId },
        select: { id: true, username: true, name: true, avatar: true }
      });

      io.to(`user:${call.callerId}`).emit('callAccepted', {
        callId,
        receiver
      });
    } catch (error) {
      console.error('Accept call error:', error);
    }
  });

  // Reject call
  socket.on('rejectCall', async ({ callId }) => {
    try {
      const call = await prisma.call.update({
        where: { id: callId },
        data: { status: 'REJECTED', endedAt: new Date() }
      });

      io.to(`user:${call.callerId}`).emit('callRejected', { callId });
    } catch (error) {
      console.error('Reject call error:', error);
    }
  });

  // End call
  socket.on('endCall', async ({ callId }) => {
    try {
      const call = await prisma.call.update({
        where: { id: callId },
        data: { status: 'ENDED', endedAt: new Date() }
      });

      const otherId = call.callerId === socket.userId ? call.receiverId : call.callerId;
      io.to(`user:${otherId}`).emit('callEnded', { callId });
    } catch (error) {
      console.error('End call error:', error);
    }
  });

  // WebRTC signaling
  socket.on('webrtcOffer', ({ targetUserId, offer }) => {
    io.to(`user:${targetUserId}`).emit('webrtcOffer', {
      from: socket.userId,
      offer
    });
  });

  socket.on('webrtcAnswer', ({ targetUserId, answer }) => {
    io.to(`user:${targetUserId}`).emit('webrtcAnswer', {
      from: socket.userId,
      answer
    });
  });

  socket.on('webrtcIceCandidate', ({ targetUserId, candidate }) => {
    io.to(`user:${targetUserId}`).emit('webrtcIceCandidate', {
      from: socket.userId,
      candidate
    });
  });

  // Camera toggle relay
  socket.on('cameraToggle', ({ targetUserId, cameraOff }) => {
    io.to(`user:${targetUserId}`).emit('remoteCameraToggle', {
      from: socket.userId,
      cameraOff
    });
  });
}

module.exports = callHandler;
