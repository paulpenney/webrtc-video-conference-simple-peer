/**
 * Socket.io socket
 */
let socket;
/**
 * The stream object used to send media
 */
let localStream = null;
/**
 * All peer connections
 */
let peers = {};

// redirect if not https
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
 * UserMedia constraints
 */
let constraints = {
    audio: true,
    video: {
      width: {
        ideal: 1920, // Set ideal width to 1920 pixels
      },
      height: {
        ideal: 1080, // Set ideal height to 1080 pixels
      },
      frameRate: {
        ideal: 30, // Set ideal frame rate to 30 fps
      },
    },
  };
  

constraints.video.facingMode = {
  ideal: "user",
};

// enabling the camera at startup
navigator.mediaDevices
  .getDisplayMedia(constraints)
  .then((stream) => {
    console.log("Received local stream");

    localStream = stream;

    // Draw the video stream onto the canvas
    const localCanvas = document.getElementById("localCanvas");
    const localContext = localCanvas.getContext("2d");
    const localVideo = document.createElement("video");
    localVideo.srcObject = stream;
    localVideo.play();

    function drawFrame() {
      localContext.drawImage(localVideo, 0, 0, 1920, 1080);
      requestAnimationFrame(drawFrame);
    }

    drawFrame();

    init();
  })
  .catch((e) => alert(`getusermedia error ${e.name}`));

/**
 * initialize the socket connections
 */
function init() {
  socket = io();

  socket.on("initReceive", (socket_id) => {
    console.log("INIT RECEIVE " + socket_id);
    socket.emit("initSend", socket_id); // Tell the client to start sending data
    addPeer(socket_id, true);
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
    if (peers[data.socket_id]) {
      peers[data.socket_id].signal(data.signal);
    } else {
      console.error(`Peer with socket ID ${data.socket_id} does not exist`);
    }
  });
}

/**
 * Remove a peer with given socket_id.
 * Removes the video element and deletes the connection
 * @param {String} socket_id
 */
function removePeer(socket_id) {
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
    stream: localStream,
    config: configuration,
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
  });
}

/**
 * Switches the camera between user and environment.
 */
function switchMedia() {
  if (constraints.video.facingMode.ideal === "user") {
    constraints.video.facingMode.ideal = "environment";
  } else {
    constraints.video.facingMode.ideal = "user";
  }

  const tracks = localStream.getTracks();

  tracks.forEach(function (track) {
    track.stop();
  });

  navigator.mediaDevices.getDisplayMedia(constraints).then((stream) => {
    for (let socket_id in peers) {
      for (let index in peers[socket_id].streams[0].getTracks()) {
        for (let index2 in stream.getTracks()) {
          if (peers[socket_id].streams[0].getTracks()[index].kind === stream.getTracks()[index2].kind) {
            peers[socket_id].replaceTrack(
              peers[socket_id].streams[0].getTracks()[index],
              stream.getTracks()[index2],
              peers[socket_id].streams[0]
            );
            break;
          }
        }
      }
    }

    localStream = stream;

    // Update the canvas with the new stream
    const localCanvas = document.getElementById("localCanvas");
    const localContext = localCanvas.getContext("2d");
    const localVideo = document.createElement("video");
    localVideo.srcObject = stream;
    localVideo.play();

    function drawFrame() {
      localContext.drawImage(localVideo, 0, 0, 1920, 1080);
      requestAnimationFrame(drawFrame);
    }

    drawFrame();

    updateButtons();
  });
}

/**
 * Enable/disable microphone
 */
function toggleMute() {
  for (let index in localStream.getAudioTracks()) {
    localStream.getAudioTracks()[index].enabled = !localStream.getAudioTracks()[index].enabled;
    muteButton.innerText = localStream.getAudioTracks()[index].enabled ? "Unmuted" : "Muted";
  }
}
/**
 * Enable/disable video
 */
function toggleVid() {
  for (let index in localStream.getVideoTracks()) {
    localStream.getVideoTracks()[index].enabled = !localStream.getVideoTracks()[index].enabled;
    vidButton.innerText = localStream.getVideoTracks()[index].enabled ? "Video Enabled" : "Video Disabled";
  }
}

/**
 * updating text of buttons
 */
function updateButtons() {
  for (let index in localStream.getVideoTracks()) {
    vidButton.innerText = localStream.getVideoTracks()[index].enabled ? "Video Enabled" : "Video Disabled";
  }
  for (let index in localStream.getAudioTracks()) {
    muteButton.innerText = localStream.getAudioTracks()[index].enabled ? "Unmuted" : "Muted";
  }
}
