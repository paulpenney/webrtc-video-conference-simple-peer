/**
 * Socket.io socket
 */
let socket;
/**
 * All peer connections
 */
let peers = {};
let videoElement;

/**
 * Redirect if not https
 */
if (location.href.substr(0, 5) !== "https") location.href = "https" + location.href.substr(4, location.href.length - 4);

//////////// CONFIGURATION //////////////////

/**
 * RTCPeerConnection configuration
 */

const configuration = {
  iceServers: [
    {
      urls: "stun:openrelay.metered.ca:80",
    },
    {
      urls: "turn:openrelay.metered.ca:80",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
    {
      urls: "turn:openrelay.metered.ca:443?transport=tcp",
      username: "openrelayproject",
      credential: "openrelayproject",
    },
  ],
};

/**
 * Initialize the socket connections
 */
function init() {
  socket = io();

  socket.on("initSend", (socket_id) => {
    console.log("INIT SEND " + socket_id);
    addPeer(socket_id, false);
  });

  socket.on("removePeer", (socket_id) => {
    console.log("removing peer " + socket_id);
    removePeer(socket_id);
  });

  socket.on("disconnect", () => {
    console.log("GOT DISCONNECTED");
    for (let socket_id in peers) {
      removePeer(socket_id);
    }
  });

  socket.on("signal", (data) => {
    console.log(`Received signal from ${data.socket_id}`);
    if (peers[data.socket_id]) {
      peers[data.socket_id].signal(data.signal);
    } else {
      console.error(`Peer with socket ID ${data.socket_id} does not exist`);
    }
  });

  socket.emit("initReceive", ""); // Tell the server we're ready to receive the stream
}

/**
 * Remove a peer with given socket_id.
 * Removes the video element and deletes the connection
 * @param {String} socket_id
 */
function removePeer(socket_id) {
  let canvasEl = document.getElementById(socket_id);
  if (canvasEl) {
    canvasEl.parentNode.removeChild(canvasEl);
  }
  if (peers[socket_id]) peers[socket_id].destroy();
  delete peers[socket_id];
}

/**
 * Creates a new peer connection and sets the event listeners
 * @param {String} socket_id
 *                 ID of the peer
 * @param {Boolean} am_initiator
 *                  Set to true if the peer initiates the connection process.
 *                  Set to false if the peer receives the connection.
 */
function addPeer(socket_id, am_initiator) {
  console.log("Adding peer:", socket_id);
  peers[socket_id] = new SimplePeer({
    initiator: am_initiator,
    config: configuration,
    trickle: false, // Ensures all ICE candidates are sent at once, reduces signaling traffic
  });

  peers[socket_id].on("signal", (data) => {
    socket.emit("signal", {
      signal: data,
      socket_id: socket_id,
    });
  });

  peers[socket_id].on("error", (error) => {
    console.error("RTC Peer Connection Error:", error);
  });

  peers[socket_id].on("connect", () => {
    console.log("Peer connected:", socket_id);
  });

  peers[socket_id].on("stream", (stream) => {
    console.log("Stream received from peer:", socket_id);
    const newCanvas = document.createElement("canvas");
    newCanvas.id = socket_id;
    newCanvas.className = "vid";
    newCanvas.width = 1920;
    newCanvas.height = 1080;
    document.querySelector(".container").appendChild(newCanvas);

    const context = newCanvas.getContext("2d");
    videoElement = document.createElement("video");
    videoElement.srcObject = stream;
    videoElement.play().catch((error) => {
      console.error("Error playing video:", error);
    });

    function drawFrame() {
      context.drawImage(videoElement, 0, 0, newCanvas.width, newCanvas.height);
      requestAnimationFrame(drawFrame);
    }

    drawFrame();
  });
}

// Initialize the client
init();

document.getElementById('startButton').addEventListener('click', () => {
  if (videoElement) {
    videoElement.play().catch((error) => {
      console.error("Error playing video:", error);
    });
  }
});
