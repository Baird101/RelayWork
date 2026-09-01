var params =
    new URLSearchParams(
        window.location.search
    );

var action =
    params.get("action");

var room =
    params.get("room");

var peer =
    null;

var peerConnection =
    null;

var outboundQueue =
    [];


/* ============================================================
   UI
   ============================================================ */

function setStatus(text) {

    var element =
        document.getElementById(
            "status"
        );

    if (element) {

        element.innerHTML =
            text;

    }

}


function setLobby(text) {

    var element =
        document.getElementById(
            "lobby"
        );

    if (element) {

        element.textContent =
            text;

    }

}


/* ============================================================
   SEND EVENT TO MAIN PAGE
   ============================================================ */

function notifyClient(data) {

    if (
        window.opener &&
        !window.opener.closed
    ) {

        window.opener.postMessage(

            {

                type:
                    "relay_event",

                room:
                    room,

                peerEvent:
                    data.peerEvent,

                role:
                    data.role,

                detail:
                    data.detail,

                errorType:
                    data.errorType

            },

            "*"

        );

    }

}


/* ============================================================
   SEND SIGNAL TO MAIN PAGE
   ============================================================ */

function notifySignal(data) {

    if (
        window.opener &&
        !window.opener.closed
    ) {

        window.opener.postMessage(

            {

                type:
                    "signal_data",

                room:
                    room,

                payload:
                    data

            },

            "*"

        );

    }

}


/* ============================================================
   SEND SIGNAL TO OTHER PEER
   ============================================================ */

function sendSignal(data) {

    if (
        peerConnection &&
        peerConnection.open
    ) {

        peerConnection.send(
            data
        );

    }

    else {

        outboundQueue.push(
            data
        );

    }

}


/* ============================================================
   FLUSH QUEUE
   ============================================================ */

function flushQueue() {

    if (
        !peerConnection ||
        !peerConnection.open
    ) {

        return;

    }


    while (
        outboundQueue.length > 0
    ) {

        peerConnection.send(

            outboundQueue.shift()

        );

    }

}


/* ============================================================
   RECEIVE MESSAGE FROM MAIN PAGE
   ============================================================ */

window.addEventListener(

    "message",

    function(event) {

        var msg =
            event.data;


        if (!msg) {

            return;

        }


        if (
            msg.room !== room
        ) {

            return;

        }


        if (
            msg.type ===
            "signal_send"
        ) {

            sendSignal(
                msg.payload
            );

        }

    }

);


/* ============================================================
   VALIDATE
   ============================================================ */

if (
    typeof Peer ===
    "undefined"
) {

    setStatus(
        "PeerJS failed to load."
    );


    setLobby(
        "The PeerJS library was not loaded."
    );

}

else if (
    !action ||
    !room
) {

    setStatus(
        "Missing parameters."
    );


    setLobby(
        "action or room is missing."
    );

}

else {

    setStatus(
        '<span class="spinner">↻</span> Starting...'
    );


    setLobby(
        "Room: " +
        room
    );


    if (
        action ===
        "create"
    ) {

        createLobby();

    }

    else if (
        action ===
        "join"
    ) {

        joinLobby();

    }

    else {

        setStatus(
            "Unknown action."
        );

    }

}


/* ============================================================
   CREATE LOBBY
   ============================================================ */

function createLobby() {

    setStatus(
        '<span class="spinner">↻</span> Creating lobby...'
    );


    setLobby(
        "Creating: " +
        room
    );


    /*
     * This is the important part.
     *
     * "main" becomes the PeerJS ID.
     */

    peer =
        new Peer(
            room
        );


    /*
     * PeerJS successfully connected
     * to the PeerServer.
     */

    peer.on(

        "open",

        function(id) {

            setStatus(
                "Lobby created!"
            );


            setLobby(
                "Lobby: " +
                id +
                "\nWaiting for another user..."
            );


            notifyClient({

                peerEvent:
                    "room_created",

                role:
                    "host"

            });

        }

    );


    /*
     * Somebody connects to the host.
     */

    peer.on(

        "connection",

        function(connection) {

            peerConnection =
                connection;


            connection.on(

                "open",

                function() {

                    setStatus(
                        "Connected!"
                    );


                    setLobby(
                        "Lobby: " +
                        room +
                        "\nUser connected."
                    );


                    notifyClient({

                        peerEvent:
                            "connected_as_host",

                        role:
                            "host"

                    });


                    flushQueue();

                }

            );


            connection.on(

                "data",

                function(data) {

                    notifySignal(
                        data
                    );

                }

            );


            connection.on(

                "close",

                function() {

                    peerConnection =
                        null;

                }

            );


            connection.on(

                "error",

                function(error) {

                    notifyClient({

                        peerEvent:
                            "error",

                        detail:
                            error.message ||
                            "Connection error."

                    });

                }

            );

        }

    );


    /*
     * PeerJS errors.
     */

    peer.on(

        "error",

        function(error) {

            setStatus(
                "PeerJS error"
            );


            setLobby(

                "Type: " +
                error.type +
                "\n" +
                "Message: " +
                error.message

            );


            notifyClient({

                peerEvent:
                    "error",

                detail:
                    error.message,

                errorType:
                    error.type

            });

        }

    );


    peer.on(

        "disconnected",

        function() {

            setStatus(
                "Disconnected from PeerJS"
            );


            setLobby(
                "The PeerJS signaling server disconnected."
            );

        }

    );

}


/* ============================================================
   JOIN EXISTING LOBBY
   ============================================================ */

function joinLobby() {

    setStatus(
        '<span class="spinner">↻</span> Joining lobby...'
    );


    setLobby(
        "Connecting to: " +
        room
    );


    /*
     * Joiners get a random PeerJS ID.
     */

    peer =
        new Peer();


    peer.on(

        "open",

        function(id) {

            setLobby(
                "Your ID: " +
                id +
                "\nConnecting to lobby..."
            );


            var connection =
                peer.connect(
                    room
                );


            peerConnection =
                connection;


            connection.on(

                "open",

                function() {

                    setStatus(
                        "Connected!"
                    );


                    setLobby(
                        "Connected to lobby."
                    );


                    notifyClient({

                        peerEvent:
                            "connected_as_joiner",

                        role:
                            "joiner"

                    );


                    flushQueue();

                }

            );


            connection.on(

                "data",

                function(data) {

                    notifySignal(
                        data
                    );

                }

            );


            connection.on(

                "close",

                function() {

                    peerConnection =
                        null;

                }

            );


            connection.on(

                "error",

                function(error) {

                    setStatus(
                        "Connection error"
                    );


                    setLobby(
                        error.message
                    );


                    notifyClient({

                        peerEvent:
                            "error",

                        detail:
                            error.message,

                        errorType:
                            error.type

                    });

                }

            );

        }

    );


    peer.on(

        "error",

        function(error) {

            setStatus(
                "PeerJS error"
            );


            setLobby(

                "Type: " +
                error.type +
                "\n" +
                "Message: " +
                error.message

            );


            notifyClient({

                peerEvent:
                    "error",

                detail:
                    error.message,

                errorType:
                    error.type

            });

        }

    );


    peer.on(

        "disconnected",

        function() {

            setStatus(
                "Disconnected from PeerJS"
            );

        }

    );

}
