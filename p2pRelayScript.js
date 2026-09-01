var params = new URLSearchParams(location.search);

var action = params.get("action");
var room = params.get("room");

var popupMode = !params.get("returnTo");

var peerConnection = null;
var outboundQueue = [];

var notified = false;


/* ============================================================
   UI
   ============================================================ */

function setStatus(msg) {

    document.getElementById("status").innerHTML =
        msg;

}


function setLobby(msg) {

    document.getElementById("lobby").textContent =
        msg;

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

    }

}


/* ============================================================
   SEND SIGNAL TO MAIN PAGE
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
   SEND SIGNAL THROUGH PEERJS
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
   START
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
        "Unknown action."
    );

}


/* ============================================================
   CREATE / HOST
   ============================================================ */

function runSignalCreate() {

    setStatus(
        '<span class="spinner">↻</span>'
    );


    setLobby(
        "Lobby: " +
        room +
        "\nConnecting to PeerJS..."
    );


    var peer =
        new Peer(
            room
        );


    peer.on(
        "open",
        function(id) {

            setStatus(
                ""
            );


            setLobby(
                "Lobby: " +
                room +
                "\nLobby created"
            );


            notifyClient({

                peerEvent:
                    "room_created",

                role:
                    "host"

            });


            peer.on(
                "connection",
                function(conn) {

                    peerConnection =
                        conn;


                    conn.on(
                        "open",
                        function() {

                            setLobby(
                                "Lobby: " +
                                room +
                                "\nConnected"
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

                            notifyClient({

                                peerEvent:
                                    "error",

                                detail:
                                    err.message

                            });

                        }
                    );

                }
            );

        }
    );


    peer.on(
        "error",
        function(err) {

            /*
             * "main" already exists.
             *
             * Become a joiner instead.
             */

            if (
                err.type ===
                "unavailable-id"
            ) {

                setStatus(
                    '<span class="spinner">↻</span>'
                );


                setLobby(
                    "Lobby: " +
                    room +
                    "\nJoining existing lobby..."
                );


                try {

                    peer.destroy();

                }

                catch (e) {}


                setTimeout(
                    function() {

                        runSignalJoin();

                    },
                    300
                );


                return;

            }


            setLobby(
                "Lobby: " +
                room +
                "\nError: " +
                err.message
            );


            notifyClient({

                peerEvent:
                    "error",

                detail:
                    err.message,

                errorType:
                    err.type

            });

        }
    );

}


/* ============================================================
   JOIN / CLIENT
   ============================================================ */

function runSignalJoin() {

    setStatus(
        '<span class="spinner">↻</span>'
    );


    setLobby(
        "Lobby: " +
        room +
        "\nJoining existing lobby..."
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


                            setLobby(
                                "Lobby: " +
                                room +
                                "\nHost not found."
                            );


                            notifyClient({

                                peerEvent:
                                    "error",

                                detail:
                                    "host_not_found"

                            });

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
                        ""
                    );


                    setLobby(
                        "Lobby: " +
                        room +
                        "\nConnected"
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


                    notifyClient({

                        peerEvent:
                            "error",

                        detail:
                            err.message

                    });

                }
            );

        }
    );


    peer.on(
        "error",
        function(err) {

            /*
             * This is expected if the host
             * disappeared before we connected.
             */

            setLobby(
                "Lobby: " +
                room +
                "\nError: " +
                err.message
            );


            notifyClient({

                peerEvent:
                    "error",

                detail:
                    err.message,

                errorType:
                    err.type

            });

        }
    );

}
