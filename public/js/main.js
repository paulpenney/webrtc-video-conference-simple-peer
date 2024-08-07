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
  // Using From https://www.metered.ca/tools/openrelay/
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
      max: 1920,
    },
    height: {
      max: 1080,
    },
    frameRate: {
      max: 15,
    },
  },
};

/////////////////////////////////////////////////////////

constraints.video.facingMode = {
  ideal: "user",
};

// enabling the camera at startup
navigator.mediaDevices
  .getUserMedia(constraints)
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
      localContext.drawImage(localVideo, 0, 0, localCanvas.width, localCanvas.height);
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
    addPeer(socket_id, false);

    socket.emit("initSend", socket_id);
  });

  socket.on("initSend", (socket_id) => {
    console.log("INIT SEND " + socket_id);
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
    peers[data.socket_id].signal(data.signal);
  });
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

  peers[socket_id].on("icecandidate", (event) => {
    if (event.candidate) {
      console.log("ICE Candidate:", event.candidate);
      socket.emit("signal", {
        signal: { candidate: event.candidate },
        socket_id: socket_id,
      });
    }
  });

  peers[socket_id].on("error", (error) => {
    console.error("RTC Peer Connection Error:", error);
  });

  peers[socket_id].on("stream", (stream) => {
    let newCanvas = document.createElement("canvas");
    newCanvas.id = socket_id;
    newCanvas.className = "vid";
    videos.appendChild(newCanvas);

    const context = newCanvas.getContext("2d");
    const video = document.createElement("video");
    video.srcObject = stream;
    video.play();

    function drawFrame() {
      context.drawImage(video, 0, 0, newCanvas.width, newCanvas.height);
      requestAnimationFrame(drawFrame);
    }

    drawFrame();
  });
}

/**
 * Opens an element in Picture-in-Picture mode
 * @param {HTMLVideoElement} el video element to put in pip mode
 */
function openPictureMode(el) {
  console.log("opening pip");
  el.requestPictureInPicture();
}

/**
 * Switches the camera between user and environment. It will just enable the camera 2 cameras not supported.
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

  navigator.mediaDevices.getUserMedia(constraints).then((stream) => {
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
      localContext.drawImage(localVideo, 0, 0, localCanvas.width, localCanvas.height);
      requestAnimationFrame(drawFrame);
    }

    drawFrame();

    updateButtons();
  });
}

/**
 * Enable screen share
 */
function setScreen() {
  navigator.mediaDevices.getDisplayMedia().then((stream) => {
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
      localContext.drawImage(localVideo, 0, 0, localCanvas.width, localCanvas.height);
      requestAnimationFrame(drawFrame);
    }

    drawFrame();

    socket.emit("removeUpdatePeer", "");
  });
  updateButtons();
}

/**
 * Disables and removes the local stream and all the connections to other peers.
 */
function removeLocalStream() {
  if (localStream) {
    const tracks = localStream.getTracks();

    tracks.forEach(function (track) {
      track.stop();
    });
  }

  for (let socket_id in peers) {
    removePeer(socket_id);
  }
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
