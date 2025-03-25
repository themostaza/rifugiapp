const HEARTBEAT_INTERVAL = 10000; // 10 secondi
const HEARTBEAT_TIMEOUT = 30000; // 30 secondi

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data.type === 'START_HEARTBEAT') {
    startHeartbeat(event.data.bookingId);
  } else if (event.data.type === 'STOP_HEARTBEAT') {
    stopHeartbeat();
  }
});

let heartbeatInterval = null;

function startHeartbeat(bookingId) {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
  }

  // Invia subito un heartbeat
  sendHeartbeat(bookingId);

  // Avvia l'intervallo
  heartbeatInterval = setInterval(() => {
    sendHeartbeat(bookingId);
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }
}

async function sendHeartbeat(bookingId) {
  try {
    const response = await fetch(`/api/booking-hold?bookingId=${bookingId}`);
    const data = await response.json();
    console.log ('data', data)
    if (!data.valid) {
      // Se il booking non è più valido, ferma il heartbeat
      stopHeartbeat();
    }
  } catch (error) {
    console.error('Error sending heartbeat:', error);
    stopHeartbeat();
  }
} 