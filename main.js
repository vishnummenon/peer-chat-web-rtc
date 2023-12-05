const APP_ID = "dded9a53a25a45338e675aeb5a46dc50";

const token = null;

const uid = Math.floor(Math.random() * 10000).toString();

let client, channel;

const queryString = window.location.search;
const urlParams = new URLSearchParams(queryString);

const roomId = urlParams.get('room');

if (!roomId) {
    window.location = 'lobby.html';
}

let localStream, remoteStream, peerConnection;

const servers = {
    iceServers: [
        {
            urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302']
        }
    ]
};

const handleUserJoined = async (memberId) => {
    createOffer(memberId);
};

const handleMessageFromPeer = async (message, memberId) => {
    message = JSON.parse(message.text);

    if (message.type === 'offer') {
        createAnswer(memberId, message.offer);
    }

    if (message.type === 'answer') {
        addAnswer(message.answer);
    }

    if (message.type === 'candidate') {
        if (peerConnection) {
            peerConnection.addIceCandidate(message.candidate);
        }
    }
};

const handleUserLeft = (memberId) => {
    document.getElementById('user-2').style.display = 'none';
    document.getElementById('user-1').classList.remove('smallFrame');
};

const constraints = {
    video: {
        width: {min: 640, ideal: 1920, max: 1920},
        height: {min: 480, ideal: 1080, max: 1080}
    },
    audio: true
};

const init = async () => {
    // https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API

    client = await AgoraRTM.createInstance(APP_ID);
    await client.login({uid, token});
    
    channel = client.createChannel('main');
    await channel.join();

    channel.on('MemberJoined', handleUserJoined);

    channel.on('MemberLeft', handleUserLeft)

    client.on('MessageFromPeer', handleMessageFromPeer);

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    document.getElementById('user-1').srcObject = localStream;
};

const createPeerConnection = async (memberId) => {

    peerConnection = new RTCPeerConnection(servers);
    remoteStream = new MediaStream()
    document.getElementById('user-2').srcObject = remoteStream;
    document.getElementById('user-2').style.display = 'block';

    document.getElementById('user-1').classList.add('smallFrame');

    if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        document.getElementById('user-1').srcObject = localStream;
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream)
    });

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => remoteStream.addTrack(track))
    };

    peerConnection.onicecandidate = async (event) => {
        if (event.candidate) {
            client.sendMessageToPeer({text: JSON.stringify({'type': 'candidate', 'candidate': event.candidate})}, memberId);
        }
    };

};

const createOffer = async (memberId) => {
    await createPeerConnection(memberId);
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    client.sendMessageToPeer({text: JSON.stringify({'type': 'offer', 'offer': offer})}, memberId);
};

const createAnswer = async (memberId, offer) => {
    await createPeerConnection(memberId);

    await peerConnection.setRemoteDescription(offer);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    client.sendMessageToPeer({text: JSON.stringify({'type': 'answer', 'answer': answer})}, memberId);
};

const addAnswer = async (answer) => {
    if (!peerConnection.currentRemoteDescription) {
        await peerConnection.setRemoteDescription(answer);
    }
};

const leaveChannel = async () => {
    await channel.leave();
    await client.logout();
};

const toggleCamera = async () => {
    const videoTrack = localStream.getTracks().find(track => track.kind === 'video');
    if (videoTrack.enabled) {
        videoTrack.enabled = false;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255,80,80)';
    } else {
        videoTrack.enabled = true;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(179,102,249, 0.9)';
    }
};

const toggleMic = async () => {
    const audioTrack = localStream.getTracks().find(track => track.kind === 'audio');
    if (audioTrack.enabled) {
        audioTrack.enabled = false;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255,80,80)';
    } else {
        audioTrack.enabled = true;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(179,102,249, 0.9)';
    }
};

window.addEventListener('beforeunload', leaveChannel);

window.onload = () => {
    const cameraButton = document.getElementById('camera-btn');
    cameraButton.addEventListener('click', toggleCamera);

    const micButton = document.getElementById('mic-btn');
    micButton.addEventListener('click', toggleMic);
};

init();