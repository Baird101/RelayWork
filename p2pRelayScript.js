```javascript
var params =
    new URLSearchParams(
        location.search
    );

var action =
    params.get("action");

var room =
    params.get("room");

var returnTo =
    params.get("returnTo");


var popupMode =
    !returnTo;


var peerConnection =
    null;


var outboundQueue =
    [];


var connected =
    false;


/* ============================================================
   UI
   ============================================================ */

function setStatus(msg) {

    document.getElementById(
        "status"
    ).innerHTML = msg;

}


function setLobby(msg) {

    document.getElementById(
        "lobby"
    ).textContent = msg;

}


/* ============================================================
   SEND MESSAGE TO MAIN PAGE
   ============================================================ */

function notifyClient(extraParams) {

    extraParams =
        extraParams || {};


    if (
        popupMode &&
        window.opener
    ) {

        window.opener.postMessage(

            Object.assign(

                {
                    type:
                        "relay_event",

                    room:
                        room
                },

                extraParams

            ),

            "*"

        );

        return;

    }


    if (!returnTo) {

        return;

    }


    var dest =
        new URL(
            returnTo
        );


    dest.searchParams.set(
        "room",
        room
    );


    for (
        var k in extraParams
    ) {

        dest.searchParams.set(
            k,
            extraParams[k]
        );

    }


    setTimeout(

        function() {

            location.href =
                dest.toString();

        },

        400

    );

}


/* ============================================================
   SEND SIGNALING DATA TO MAIN PAGE
   ============================================================ */

function notifySignal(payload) {

    if (
        popupMode &&
        window.opener
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
   FORWARD SIGNAL TO OTHER USER
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


/* ============================================================
   FLUSH WAITING SIGNALS
   ============================================================ */

function flushSignalQueue() {

    while (
        peerConnection &&
        peerConnection.open &&
        outboundQueue.length > 0
    ) {

        peerConnection.send(
            outboundQueue.shift()
        );

    }

}


/* ============================================================
   RECEIVE MESSAGES FROM MAIN PAGE
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
   CREATE ROOM
   ============================================================ */

function runCreate() {

    setStatus(
        '<span class="spinner">↻</span>'
    );


    setLobby(
        "Lobby: " +
        room +
        "\nCreating lobby..."
    );


    var peer =
        new Peer(room);


    peer.on(
        "open",

        function() {

            setLobby(
                "Lobby: " +
                room +
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


    peer.on(
        "connection",

        function(conn) {

            peerConnection =
                conn;


            conn.on(
                "open",

                function() {

                    connected =
                        true;


                    setStatus(
                        ""
                    );


                    setLobby(
                        "Lobby: " +
                        room +
                        "\nConnected!"
                    );


                    /*
                     * Tell the main page that it is
                     * the HOST and can begin WebRTC.
                     */

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

                    connected =
                        false;

                    peerConnection =
                        null;

                    notifyClient({

                        peerEvent:
                            "disconnected"

                    });

                }
            );


            conn.on(
                "error",

                function(err) {

                    notifyClient({

                        peerEvent:
                            "error",

                        detail:
                            err.message ||
                            err.type ||
                            "connection_error"

                    });

                }
            );

        }
    );


    peer.on(
        "error",

        function(err) {

            notifyClient({

                peerEvent:
                    "error",

                detail:
                    err.message ||
                    err.type ||
                    "unknown_error",

                errorType:
                    err.type ||
                    ""

            });

        }
    );

}


/* ============================================================
   JOIN EXISTING ROOM
   ============================================================ */

function runJoin() {

    setStatus(
        '<span class="spinner">↻</span>'
    );


    setLobby(
        "Lobby: " +
        room +
        "\nConnecting..."
    );


    var peer =
        new Peer();


    peer.on(
        "open",

        function() {

            var conn =
                peer.connect(
                    room
                );


            peerConnection =
                conn;


            var timer =
                setTimeout(

                    function() {

                        if (
                            !connected
                        ) {

                            notifyClient({

                                peerEvent:
                                    "error",

                                detail:
                                    "connection_timeout"

                            });


                            peer.destroy();

                        }

                    },

                    10000

                );


            conn.on(
                "open",

                function() {

                    clearTimeout(
                        timer
                    );


                    connected =
                        true;


                    setStatus(
                        ""
                    );


                    setLobby(
                        "Lobby: " +
                        room +
                        "\nConnected!"
                    );


                    /*
                     * Tell the main page that it is
                     * the JOINER and can begin WebRTC.
                     */

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

                    connected =
                        false;

                    peerConnection =
                        null;


                    notifyClient({

                        peerEvent:
                            "disconnected"

                    });

                }
            );


            conn.on(
                "error",

                function(err) {

                    clearTimeout(
                        timer
                    );


                    notifyClient({

                        peerEvent:
                            "error",

                        detail:
                            err.message ||
                            err.type ||
                            "connection_error",

                        errorType:
                            err.type ||
                            ""

                    });

                }
            );

        }
    );


    peer.on(
        "error",

        function(err) {

            notifyClient({

                peerEvent:
                    "error",

                detail:
                    err.message ||
                    err.type ||
                    "unknown_error",

                errorType:
                    err.type ||
                    ""

            });

        }
    );

}


/* ============================================================
   CHECK PARAMETERS
   ============================================================ */

if (
    !action ||
    !room
) {

    setStatus(
        "Missing parameters."
    );

}

else if (
    action === "create"
) {

    runCreate();

}

else if (
    action === "join"
) {

    runJoin();

}

else {

    setStatus(
        "Unknown action."
    );

}
```
