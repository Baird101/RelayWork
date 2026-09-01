var params =
new URLSearchParams(
location.search
);

var action =
params.get("action");

var room =
params.get("room");

var peerConnection =
null;

var outboundQueue =
[];

var peer =
null;

/* ============================================================
UI
============================================================ */

function setStatus(msg) {

 
document.getElementById(
    "status"
).innerHTML =
    msg;
 

}

function setLobby(msg) {

 
document.getElementById(
    "lobby"
).textContent =
    msg;
 

}

/* ============================================================
MAIN PAGE COMMUNICATION
============================================================ */

function notifyClient(extra) {

 
extra =
    extra || {};


if (
    window.opener &&
    !window.opener.closed
) {

    window.opener.postMessage(

        Object.assign(

            {

                type:
                    "relay_event",

                room:
                    room

            },

            extra

        ),

        "*"

    );

}
 

}

function notifySignal(payload) {

 
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
                payload

        },

        "*"

    );

}
 

}

/* ============================================================
SIGNAL QUEUE
============================================================ */

function forwardSignal(payload) {

 
if (
    peerConnection &&
    peerConnection.open
) {

    peerConnection.send(
        payload
    );

}

else {

    outboundQueue.push(
        payload
    );

}
 

}

function flushSignalQueue() {

 
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
RECEIVE SIGNAL FROM MAIN PAGE
============================================================ */

window.addEventListener(

 
"message",

function(event) {

    var msg =
        event.data;


    if (
        !msg ||
        msg.room !== room
    ) {

        return;

    }


    if (
        msg.type ===
        "signal_send"
    ) {

        forwardSignal(
            msg.payload
        );

    }

}
 

);

/* ============================================================
ERROR
============================================================ */

function relayError(
type,
message
) {

 
setStatus(
    "ERROR"
);


setLobby(

    "Lobby: " +
    room +
    "\n\n" +
    type +
    "\n" +
    message

);


notifyClient({

    peerEvent:
        "error",

    errorType:
        type,

    detail:
        message

);
 

}

/* ============================================================
CREATE HOST
============================================================ */

function runSignalCreate() {

 
setStatus(
    '<span class="spinner">↻</span> Creating lobby...'
);


setLobby(
    "Lobby: " +
    room +
    "\nConnecting to PeerJS..."
);


/*
 * IMPORTANT:
 *
 * Give PeerJS debug level 2 so we can catch
 * connection problems.
 */

peer =
    new Peer(

        room,

        {

            debug:
                2

        }

    );


/*
 * PeerJS successfully connected
 * to its signaling server.
 */

peer.on(

    "open",

    function(id) {

        setStatus(
            "Lobby created"
        );


        setLobby(

            "Lobby: " +
            room +
            "\n\n" +
            "Waiting for another user..."

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
 * Another browser connected
 * to this lobby.
 */

peer.on(

    "connection",

    function(conn) {

        peerConnection =
            conn;


        setLobby(

            "Lobby: " +
            room +
            "\n\n" +
            "Connecting to player..."

        );


        conn.on(

            "open",

            function() {

                setStatus(
                    "Connected"
                );


                setLobby(

                    "Lobby: " +
                    room +
                    "\n\n" +
                    "Connected!"

                );


                notifyClient({

                    peerEvent:
                        "connected_as_host",

                    role:
                        "host"

                });


                flushSignalQueue();

            }

        );


        conn.on(

            "data",

            function(data) {

                notifySignal(
                    data
                );

            }

        );


        conn.on(

            "close",

            function() {

                peerConnection =
                    null;

            }

        );


        conn.on(

            "error",

            function(err) {

                relayError(

                    "connection-error",

                    err.message ||
                    "Peer connection error."

                );

            }

        );

    }

);


/*
 * PeerJS errors.
 */

peer.on(

    "error",

    function(err) {

        /*
         * The room already exists.
         *
         * This browser should become
         * the JOINER instead.
         */

        if (
            err.type ===
            "unavailable-id"
        ) {

            setStatus(
                '<span class="spinner">↻</span> Joining lobby...'
            );


            setLobby(

                "Lobby: " +
                room +
                "\n\n" +
                "Lobby already exists.\n" +
                "Joining it..."

            );


            try {

                peer.destroy();

            }

            catch (e) {}


            peer =
                null;


            setTimeout(

                function() {

                    runSignalJoin();

                },

                500

            );


            return;

        }


        relayError(

            err.type ||
            "peer-error",

            err.message ||
            "Unknown PeerJS error."

        );

    }

);


peer.on(

    "disconnected",

    function() {

        setLobby(

            "Lobby: " +
            room +
            "\n\n" +
            "Disconnected from PeerJS."

        );

    }

);
 

}

/* ============================================================
JOIN EXISTING HOST
============================================================ */

function runSignalJoin() {

 
setStatus(
    '<span class="spinner">↻</span> Joining lobby...'
);


setLobby(

    "Lobby: " +
    room +
    "\n\n" +
    "Connecting to host..."

);


peer =
    new Peer({

        debug:
            2

    });


peer.on(

    "open",

    function() {

        setLobby(

            "Lobby: " +
            room +
            "\n\n" +
            "Found PeerJS server.\n" +
            "Connecting to host..."

        );


        var conn =
            peer.connect(

                room,

                {

                    reliable:
                        true

                }

            );


        peerConnection =
            conn;


        var timeout =
            setTimeout(

                function() {

                    if (
                        !conn.open
                    ) {

                        try {

                            peer.destroy();

                        }

                        catch (e) {}


                        peer =
                            null;


                        relayError(

                            "peer-unavailable",

                            "The lobby exists in the system, but the host could not be reached."

                        );

                    }

                },

                10000

            );


        conn.on(

            "open",

            function() {

                clearTimeout(
                    timeout
                );


                setStatus(
                    "Connected"
                );


                setLobby(

                    "Lobby: " +
                    room +
                    "\n\n" +
                    "Connected!"

                );


                notifyClient({

                    peerEvent:
                        "connected_as_joiner",

                    role:
                        "joiner"

                });


                flushSignalQueue();

            }

        );


        conn.on(

            "data",

            function(data) {

                notifySignal(
                    data
                );

            }

        );


        conn.on(

            "close",

            function() {

                peerConnection =
                    null;

            }

        );


        conn.on(

            "error",

            function(err) {

                clearTimeout(
                    timeout
                );


                relayError(

                    "connection-error",

                    err.message ||
                    "Connection to host failed."

                );

            }

        );

    }

);


peer.on(

    "error",

    function(err) {

        relayError(

            err.type ||
            "peer-error",

            err.message ||
            "Unknown PeerJS error."

        );

    }

);

}

/* ============================================================
START
============================================================ */

if (
!action ||
!room
) {

setStatus(
    "ERROR"
);


setLobby(
    "Missing action or room."
);

}

else if (
typeof Peer ===
"undefined"
) {

setStatus(
    "ERROR"
);


setLobby(
    "PeerJS failed to load."
);


notifyClient({

    peerEvent:
        "error",

    errorType:
        "peerjs-not-loaded",

    detail:
        "PeerJS library failed to load."

});

}

else if (
action ===
"create"
) {

runSignalCreate();
}

else if (
action ===
"join"
) {

runSignalJoin();

}

else {

setStatus(
    "ERROR"
);


setLobby(
    "Unknown action: " +
    action
);

}
