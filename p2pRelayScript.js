var params = new URLSearchParams(location.search);

var action =
    params.get("action");

var room =
    params.get("room") || "main";


/*
 * ============================================================
 * VARIABLES
 * ============================================================
 */

var peer =
    null;

var hostConnection =
    null;

var connections =
    [];

var isHost =
    action === "create";

var joined =
    0;


/*
 * ============================================================
 * UI
 * ============================================================
 */

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


/*
 * ============================================================
 * SEND MESSAGE BACK TO THE MAIN PAGE
 * ============================================================
 */

function notifyClient(data) {

    data = data || {};

    data.type =
        "relay_event";

    data.room =
        room;


    if (window.opener) {

        window.opener.postMessage(
            data,
            "*"
        );

    }

}


/*
 * ============================================================
 * SEND SIGNAL THROUGH THE RELAY
 *
 * This is only used while establishing WebRTC.
 * ============================================================
 */

function sendSignal(payload) {

    if (
        hostConnection &&
        hostConnection.open
    ) {

        hostConnection.send({

            type:
                "signal",

            payload:
                payload

        });

    }

}


/*
 * ============================================================
 * UPDATE HOST LOBBY
 * ============================================================
 */

function updateHostLobby() {

    setLobby(
        "Lobby: " +
        room +
        "\nUsers connected: " +
        (connections.length + 1)
    );

}


/*
 * ============================================================
 * BROADCAST TO EVERY USER
 * ============================================================
 */

function broadcast(data, except) {

    var i;
    var conn;


    for (
        i = 0;
        i < connections.length;
        i++
    ) {

        conn =
            connections[i];


        if (
            conn === except
        ) {

            continue;

        }


        if (
            conn &&
            conn.open
        ) {

            conn.send(
                data
            );

        }

    }

}


/*
 * ============================================================
 * REMOVE CONNECTION
 * ============================================================
 */

function removeConnection(conn) {

    var i =
        connections.indexOf(
            conn
        );


    if (
        i !== -1
    ) {

        connections.splice(
            i,
            1
        );

    }


    if (isHost) {

        updateHostLobby();

    }

}


/*
 * ============================================================
 * HOST
 * ============================================================
 */

function startHost() {

    isHost =
        true;


    setStatus(
        '<span class="spinner">↻</span> Creating lobby...'
    );


    peer =
        new Peer(room);


    peer.on(
        "error",
        function(err) {

            setStatus(
                "Error: " +
                err.message
            );

            notifyClient({

                peerEvent:
                    "error",

                detail:
                    err.message

            });

        }
    );


    peer.on(
        "open",
        function() {

            joined =
                1;


            updateHostLobby();


            setStatus(
                "Lobby created"
            );


            notifyClient({

                peerEvent:
                    "room_created",

                role:
                    "host"

            });


            /*
             * A new user connects to the host.
             */

            peer.on(
                "connection",
                function(conn) {

                    setupHostConnection(
                        conn
                    );

                }
            );

        }
    );

}


/*
 * ============================================================
 * SET UP A USER CONNECTING TO THE HOST
 * ============================================================
 */

function setupHostConnection(conn) {

    connections.push(
        conn
    );


    updateHostLobby();


    conn.on(
        "open",
        function() {

            /*
             * Tell the main page that
             * the host is ready.
             */

            notifyClient({

                peerEvent:
                    "user_connected",

                role:
                    "host"

            });


            /*
             * Tell this user how many
             * people are currently here.
             */

            conn.send({

                type:
                    "lobby_count",

                count:
                    connections.length + 1

            });

        }
    );


    conn.on(
        "data",
        function(data) {

            handleHostData(
                conn,
                data
            );

        }
    );


    conn.on(
        "close",
        function() {

            removeConnection(
                conn
            );

        }
    );


    conn.on(
        "error",
        function() {

            removeConnection(
                conn
            );

        }
    );

}


/*
 * ============================================================
 * HOST RECEIVES DATA
 * ============================================================
 */

function handleHostData(
    conn,
    data
) {

    if (
        !data
    ) {

        return;

    }


    /*
     * WebRTC signaling.
     */

    if (
        data.type ===
        "signal"
    ) {

        /*
         * The host normally doesn't need
         * signaling once the connection
         * is established.
         */

        return;

    }


    /*
     * CHAT MESSAGE
     */

    if (
        data.type ===
        "chat"
    ) {

        /*
         * Send the message to everybody
         * EXCEPT the sender.
         */

        broadcast(
            data,
            conn
        );

    }


    /*
     * USER HELLO
     */

    else if (
        data.type ===
        "hello"
    ) {

        /*
         * Tell everyone else that this
         * person joined.
         */

        broadcast(
            data,
            conn
        );

    }

}


/*
 * ============================================================
 * JOINER
 * ============================================================
 */

function startJoiner() {

    isHost =
        false;


    setStatus(
        '<span class="spinner">↻</span> Connecting...'
    );


    setLobby(
        "Lobby: " +
        room +
        "\nConnecting to host..."
    );


    peer =
        new Peer();


    peer.on(
        "error",
        function(err) {

            setStatus(
                "Error: " +
                err.message
            );


            notifyClient({

                peerEvent:
                    "error",

                detail:
                    err.message

            });

        }
    );


    peer.on(
        "open",
        function() {

            /*
             * Connect directly to the
             * lobby creator.
             */

            hostConnection =
                peer.connect(room);


            hostConnection.on(
                "open",
                function() {

                    setStatus(
                        "Connected"
                    );


                    setLobby(
                        "Lobby: " +
                        room
                    );


                    notifyClient({

                        peerEvent:
                            "connected_as_joiner",

                        role:
                            "joiner"

                    });


                    /*
                     * Tell the host our
                     * name later through
                     * the main page.
                     */

                }
            );


            hostConnection.on(
                "data",
                function(data) {

                    /*
                     * Forward everything
                     * from the host to
                     * the main page.
                     */

                    if (
                        window.opener
                    ) {

                        window.opener.postMessage({

                            type:
                                "relay_data",

                            room:
                                room,

                            data:
                                data

                        }, "*");

                    }

                }
            );


            hostConnection.on(
                "close",
                function() {

                    setStatus(
                        "Disconnected"
                    );

                }
            );


            hostConnection.on(
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


/*
 * ============================================================
 * MESSAGES FROM THE MAIN CHAT PAGE
 * ============================================================
 */

window.addEventListener(
    "message",
    function(event) {

        var msg =
            event.data;


        if (
            !msg
        ) {

            return;

        }


        if (
            msg.room !== room
        ) {

            return;

        }


        /*
         * JOINER → HOST
         */

        if (
            msg.type ===
            "chat_send"
        ) {

            if (
                hostConnection &&
                hostConnection.open
            ) {

                hostConnection.send(
                    msg.data
                );

            }

        }


        /*
         * JOINER HELLO → HOST
         */

        else if (
            msg.type ===
            "hello_send"
        ) {

            if (
                hostConnection &&
                hostConnection.open
            ) {

                hostConnection.send(
                    msg.data
                );

            }

        }


        /*
         * HOST → EVERYONE
         *
         * This isn't normally needed because
         * the host itself receives chat directly,
         * but it allows the main page to tell
         * the relay to broadcast something.
         */

        else if (
            msg.type ===
            "broadcast"
        ) {

            if (isHost) {

                broadcast(
                    msg.data
                );

            }

        }

    }
);


/*
 * ============================================================
 * START
 * ============================================================
 */

if (
    action === "create"
) {

    startHost();

}

else if (
    action === "join"
) {

    startJoiner();

}

else {

    setStatus(
        "Missing action."
    );

}var params =
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
