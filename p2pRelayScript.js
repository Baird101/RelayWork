var params =
    new URLSearchParams(location.search);

var action =
    params.get("action");

var room =
    params.get("room");

var returnTo =
    params.get("returnTo");


/*
 * We only have ONE room.
 */

var fullAmount =
    parseInt(
        params.get("fullAmount") || "9999",
        10
    );


var popupMode =
    !returnTo;


/* ============================================================
   RELAY STATE
   ============================================================ */


/*
 * The PeerJS peer representing the lobby.
 *
 * Only the lobby creator gets Peer(room).
 */

var lobbyPeer =
    null;


/*
 * Every browser connected to this relay.
 *
 * connections[id] = PeerJS DataConnection
 */

var connections =
    {};


/*
 * The host's connection.
 */

var hostConnection =
    null;


/*
 * Number of users currently connected.
 */

var joined =
    0;


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
   NOTIFY CLIENT
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


    bounce(
        extraParams
    );

}


/* ============================================================
   SEND SIGNAL TO CLIENT
   ============================================================ */

function notifySignal(
    targetConnection,
    payload
) {

    if (
        !targetConnection ||
        !targetConnection.open
    ) {

        return;

    }


    targetConnection.send(
        payload
    );

}


/* ============================================================
   BOUNCE
   ============================================================ */

function bounce(extraParams) {

    extraParams =
        extraParams || {};


    if (
        !returnTo
    ) {

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
   LOBBY STATUS
   ============================================================ */

function updateLobby() {

    setLobby(

        "Lobby: " +
        room +
        "\nUsers connected: " +
        joined

    );

}


/* ============================================================
   SEND EVENT TO HOST CLIENT
   ============================================================ */

function tellHost(
    event
) {

    if (
        hostConnection &&
        hostConnection.open
    ) {

        notifyClient(
            event
        );

    }

}


/* ============================================================
   ROUTE SIGNAL
   ============================================================

   A client sends:

   {
       from: "...",
       to: "...",
       kind: "...",
       ...
   }

   The relay looks at "to" and sends the
   signal to that specific browser.
   ============================================================ */

function routeSignal(
    sender,
    payload
) {

    if (
        !payload
    ) {

        return;

    }


    var targetId =
        payload.to;


    /*
     * We REQUIRE a destination.
     */

    if (
        !targetId
    ) {

        return;

    }


    var target =
        connections[
            targetId
        ];


    if (
        !target
    ) {

        return;

    }


    /*
     * Make sure the relay itself is
     * the source of the message.
     *
     * This prevents a client from
     * pretending to be another relay
     * connection.
     */

    payload.relayFrom =
        sender.id;


    notifySignal(
        target,
        payload
    );

}


/* ============================================================
   CONNECTION CLOSED
   ============================================================ */

function removeConnection(
    conn
) {

    if (
        !conn
    ) {

        return;

    }


    var id =
        conn.id;


    if (
        connections[id]
    ) {

        delete connections[id];

        joined--;

        if (
            joined < 0
        ) {

            joined =
                0;

        }

        updateLobby();

    }


    /*
     * If the host disappears, the
     * lobby is effectively dead.
     */

    if (
        conn ===
        hostConnection
    ) {

        hostConnection =
            null;


        for (
            var peerId in connections
        ) {

            try {

                connections[
                    peerId
                ].send({

                    kind:
                        "host_left"

                });

            }

            catch (err) {}

        }

    }

}


/* ============================================================
   SET UP A CLIENT CONNECTION
   ============================================================ */

function setupConnection(
    conn,
    role
) {

    if (
        !conn
    ) {

        return;

    }


    /*
     * Use PeerJS's connection ID
     * as our relay ID.
     */

    connections[
        conn.peer
    ] =
        conn;


    joined++;


    updateLobby();


    /*
     * OPEN
     */

    conn.on(
        "open",

        function() {

            /*
             * HOST
             *
             * The first connection is
             * special because it tells
             * the relay who the host is.
             */

            if (
                role ===
                "host"
            ) {

                hostConnection =
                    conn;


                notifyClient({

                    peerEvent:
                        "room_created",

                    role:
                        "host",

                    peerId:
                        "host"

                });

            }


            /*
             * JOINER
             */

            else {

                /*
                 * Tell this joiner who
                 * its signaling target is.
                 */

                notifyClient({

                    peerEvent:
                        "connected_as_joiner",

                    role:
                        "joiner",

                    peerId:
                        "host"

                });


                /*
                 * Tell the host about
                 * this new player.
                 */

                if (
                    hostConnection &&
                    hostConnection.open
                ) {

                    notifyClient({

                        peerEvent:
                            "connected_as_host",

                        role:
                            "host",

                        peerId:
                            conn.peer

                    });

                }

            }

        }

    );


    /*
     * SIGNAL DATA
     */

    conn.on(
        "data",

        function(data) {

            /*
             * Anything arriving here is
             * a WebRTC signaling message.
             */

            routeSignal(
                conn,
                data
            );

        }

    );


    /*
     * ERROR
     */

    conn.on(
        "error",

        function(err) {

            /*
             * Only report errors to
             * the affected client.
             */

            try {

                notifyClient({

                    peerEvent:
                        "error",

                    detail:
                        err.message

                });

            }

            catch (e) {}

        }

    );


    /*
     * CLOSE
     */

    conn.on(
        "close",

        function() {

            removeConnection(
                conn
            );

        }

    );

}


/* ============================================================
   CREATE LOBBY
   ============================================================ */

function runSignalCreate() {

    setStatus(
        '<span class="spinner">↻</span>'
    );


    setLobby(
        "Creating lobby..."
    );


    /*
     * The lobby creator owns the
     * PeerJS room ID.
     */

    lobbyPeer =
        new Peer(
            room
        );


    lobbyPeer.on(
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


    lobbyPeer.on(
        "open",

        function() {

            /*
             * The creator itself counts
             * as one lobby user.
             */

            joined =
                1;


            updateLobby();


            setStatus(
                "Lobby created"
            );


            /*
             * Wait forever for new
             * players.
             */

            lobbyPeer.on(
                "connection",

                function(conn) {

                    setupConnection(
                        conn,
                        "joiner"
                    );

                }

            );

        }

    );

}


/* ============================================================
   JOIN LOBBY
   ============================================================ */

function runSignalJoin() {

    setStatus(
        '<span class="spinner">↻</span>'
    );


    setLobby(
        "Connecting to lobby..."
    );


    /*
     * Every joiner gets their own
     * PeerJS ID.
     */

    lobbyPeer =
        new Peer();


    lobbyPeer.on(
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


    lobbyPeer.on(
        "open",

        function() {

            /*
             * Connect to the lobby creator.
             */

            var conn =
                lobbyPeer.connect(
                    room
                );


            conn.on(
                "open",

                function() {

                    /*
                     * The relay itself keeps
                     * this connection open.
                     */

                    setupConnection(
                        conn,
                        "joiner"
                    );

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


/* ============================================================
   OLD NON-POPUP MODE
   ============================================================

   These are kept so your existing relay
   page doesn't break if you use
   returnTo somewhere else.
   ============================================================ */

function runCreate() {

    runSignalCreate();

}


function runJoin() {

    runSignalJoin();

}


/* ============================================================
   START
   ============================================================ */

if (
    !action ||
    !room
) {

    setStatus(
        "Missing params."
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

    notifyClient({

        peerEvent:
            "error",

        detail:
            "unknown_action"

    });

}
