```javascript
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


/*
 * Connections to the PeerJS lobby.
 *
 * HOST:
 *   One connection for every joiner.
 *
 * JOINER:
 *   One connection to the host.
 */
var connections =
    [];


/*
 * Host's name.
 */
var hostName =
    "";


/* ============================================================
   UI
   ============================================================ */

function setStatus(text) {

    var element =
        document.getElementById("status");

    if (element) {

        element.textContent =
            text;

    }

}


function setLobby(text) {

    var element =
        document.getElementById("lobby");

    if (element) {

        element.textContent =
            text;

    }

}


/* ============================================================
   SEND EVENT TO MAIN PAGE
   ============================================================ */

function notifyClient(
    peerEvent,
    role,
    detail,
    name,
    peerId
) {

    if (
        !window.opener ||
        window.opener.closed
    ) {

        return;

    }


    window.opener.postMessage(

        {

            type:
                "relay_event",

            room:
                room,

            peerEvent:
                peerEvent,

            role:
                role || null,

            detail:
                detail || "",

            name:
                name || "",

            peerId:
                peerId || ""

        },

        "*"

    );

}


/* ============================================================
   SEND DATA TO MAIN PAGE
   ============================================================ */

function notifyMain(data) {

    if (
        !window.opener ||
        window.opener.closed
    ) {

        return;

    }


    window.opener.postMessage(
        data,
        "*"
    );

}


/* ============================================================
   ADD CONNECTION
   ============================================================ */

function addConnection(
    connection
) {

    connections.push({

        connection:
            connection,

        name:
            "",

        peerId:
            connection.peer

    });

}


/* ============================================================
   FIND CONNECTION
   ============================================================ */

function findConnection(
    connection
) {

    for (
        var i = 0;
        i < connections.length;
        i++
    ) {

        if (
            connections[i].connection ===
            connection
        ) {

            return connections[i];

        }

    }


    return null;

}


/* ============================================================
   REMOVE CONNECTION
   ============================================================ */

function removeConnection(
    connection
) {

    for (
        var i = 0;
        i < connections.length;
        i++
    ) {

        if (
            connections[i].connection ===
            connection
        ) {

            var user =
                connections[i];


            connections.splice(
                i,
                1
            );


            return user;

        }

    }


    return null;

}


/* ============================================================
   SEND TO A SPECIFIC CONNECTION
   ============================================================ */

function sendToConnection(
    connection,
    data
) {

    if (
        !connection ||
        !connection.open
    ) {

        return false;

    }


    try {

        connection.send(
            data
        );

        return true;

    }

    catch (error) {

        return false;

    }

}


/* ============================================================
   SET UP ONE PEERJS CONNECTION
   ============================================================ */

function setupConnection(
    connection
) {

    addConnection(
        connection
    );


    var user =
        findConnection(
            connection
        );


    /* ========================================================
       CONNECTION OPEN
       ======================================================== */

    connection.on(

        "open",

        function() {

            setStatus(
                "Connected users: " +
                connections.length
            );


            setLobby(

                "Lobby: " +
                room +
                "\nSignaling connections: " +
                connections.length

            );


            /*
             * JOINER:
             *
             * The connection to the host relay
             * is ready.
             *
             * Tell the main page that it can
             * begin WebRTC signaling.
             */

            if (
                action ===
                "join"
            ) {

                notifyClient(

                    "connected_as_joiner",

                    "joiner",

                    "",

                    "",

                    peer.id

                );

            }


            /*
             * HOST:
             *
             * Tell the host main page that
             * another player has connected
             * to the signaling relay.
             */

            if (
                action ===
                "create"
            ) {

                notifyClient(

                    "connected_as_host",

                    "host",

                    "",

                    "",

                    connection.peer

                );

            }

        }

    );


    /* ========================================================
       DATA
       ======================================================== */

    connection.on(

        "data",

        function(data) {

            if (!data) {

                return;

            }


            /* =================================================
               SET NAME
               ================================================= */

            if (
                data.type ===
                "set_name"
            ) {

                if (user) {

                    user.name =
                        data.name ||
                        "";

                }


                /*
                 * JOINER:
                 *
                 * Forward the name to the host.
                 */

                if (
                    action ===
                    "join"
                ) {

                    if (
                        connections.length > 0
                    ) {

                        sendToConnection(

                            connections[0].connection,

                            {

                                type:
                                    "set_name",

                                name:
                                    data.name ||
                                    ""

                            }

                        );

                    }

                }


                /*
                 * HOST:
                 *
                 * A joiner has given us its
                 * name.
                 *
                 * Forward the event to the
                 * host's main page.
                 */

                if (
                    action ===
                    "create"
                ) {

                    notifyClient(

                        "user_joined",

                        "joiner",

                        "",

                        data.name ||
                        "Unknown",

                        connection.peer

                    );

                }


                return;

            }


            /* =================================================
               SIGNAL SEND
               ================================================= */

            if (
                data.type ===
                "signal_send"
            ) {

                /*
                 * JOINER → HOST
                 *
                 * Send the WebRTC offer/candidates
                 * to the host main page.
                 */

                if (
                    action ===
                    "join"
                ) {

                    notifyClient(

                        "signal_data",

                        "joiner",

                        "",

                        "",

                        connection.peer

                    );


                    /*
                     * The joiner's main page sent
                     * signaling data to this relay.
                     *
                     * Forward it to the host relay's
                     * main page.
                     */

                    notifyMain({

                        type:
                            "signal_data",

                        room:
                            room,

                        payload:
                            data.payload,

                        peerId:
                            connection.peer

                    });


                    return;

                }


                /*
                 * HOST → JOINER
                 *
                 * The host main page supplied
                 * signaling data.
                 *
                 * data.peerId identifies which
                 * joiner should receive it.
                 */

                if (
                    action ===
                    "create"
                ) {

                    var target =
                        data.peerId;


                    var targetConnection =
                        null;


                    for (
                        var i = 0;
                        i < connections.length;
                        i++
                    ) {

                        if (
                            connections[i].peerId ===
                            target
                        ) {

                            targetConnection =
                                connections[i].connection;

                            break;

                        }

                    }


                    if (
                        targetConnection
                    ) {

                        sendToConnection(

                            targetConnection,

                            {

                                type:
                                    "signal_data",

                                room:
                                    room,

                                payload:
                                    data.payload

                            }

                        );

                    }


                    return;

                }

            }


            /* =================================================
               NORMAL DATA
               ================================================= */

            /*
             * We don't normally need this anymore.
             *
             * Actual game/chat data should travel
             * over WebRTC after signaling finishes.
             */

            return;

        }

    );


    /* ========================================================
       CONNECTION CLOSED
       ======================================================== */

    connection.on(

        "close",

        function() {

            var oldUser =
                removeConnection(
                    connection
                );


            setStatus(
                "Connected users: " +
                connections.length
            );


            setLobby(

                "Lobby: " +
                room +
                "\nSignaling connections: " +
                connections.length

            );


            /*
             * Tell the host that a joiner
             * disappeared.
             */

            if (
                action ===
                "create"
            ) {

                notifyClient(

                    "user_left",

                    "joiner",

                    "",

                    oldUser
                        ? oldUser.name
                        : "",

                    connection.peer

                );

            }


            /*
             * If the joiner's relay connection
             * closes, tell its main page.
             */

            if (
                action ===
                "join"
            ) {

                notifyClient(

                    "relay_closed",

                    "joiner",

                    "",

                    "",

                    connection.peer

                );

            }

        }

    );


    /* ========================================================
       CONNECTION ERROR
       ======================================================== */

    connection.on(

        "error",

        function(error) {

            notifyClient(

                "error",

                null,

                error.message ||
                "Connection error.",

                "",

                connection.peer

            );

        }

    );

}


/* ============================================================
   RECEIVE MESSAGE FROM MAIN PAGE
   ============================================================ */

window.addEventListener(

    "message",

    function(event) {

        /*
         * Only accept messages from our
         * parent main page.
         */

        if (
            !window.opener ||
            event.source !==
            window.opener
        ) {

            return;

        }


        var data =
            event.data || {};


        if (
            data.room &&
            data.room !==
            room
        ) {

            return;

        }


        /* ====================================================
           SET NAME
           ==================================================== */

        if (
            data.type ===
            "set_name"
        ) {

            if (
                action ===
                "create"
            ) {

                hostName =
                    data.name ||
                    "";

                return;

            }


            if (
                action ===
                "join"
            ) {

                if (
                    connections.length > 0
                ) {

                    sendToConnection(

                        connections[0].connection,

                        {

                            type:
                                "set_name",

                            name:
                                data.name ||
                                ""

                        }

                    );

                }

                return;

            }

        }


        /* ====================================================
           SIGNAL SEND
           ==================================================== */

        if (
            data.type ===
            "signal_send"
        ) {

            /*
             * HOST:
             *
             * Send signaling information to
             * the correct joiner's relay.
             */

            if (
                action ===
                "create"
            ) {

                var target =
                    data.peerId;


                var targetConnection =
                    null;


                for (
                    var i = 0;
                    i < connections.length;
                    i++
                ) {

                    if (
                        connections[i].peerId ===
                        target
                    ) {

                        targetConnection =
                            connections[i].connection;

                        break;

                    }

                }


                if (
                    targetConnection
                ) {

                    sendToConnection(

                        targetConnection,

                        {

                            type:
                                "signal_data",

                            room:
                                room,

                            payload:
                                data.payload

                        }

                    );

                }


                return;

            }


            /*
             * JOINER:
             *
             * Send signaling information
             * through the PeerJS connection
             * to the host.
             */

            if (
                action ===
                "join"
            ) {

                if (
                    connections.length > 0
                ) {

                    sendToConnection(

                        connections[0].connection,

                        {

                            type:
                                "signal_send",

                            room:
                                room,

                            payload:
                                data.payload

                        }

                    );

                }


                return;

            }

        }


        /* ====================================================
           CLOSE RELAY
           ==================================================== */

        if (
            data.type ===
            "close_relay"
        ) {

            /*
             * This is mainly intended for
             * JOINER relays.
             *
             * The host relay stays alive so
             * additional people can join.
             */

            if (
                action ===
                "join"
            ) {

                try {

                    if (peer) {

                        peer.destroy();

                    }

                }

                catch (error) {}


                try {

                    window.close();

                }

                catch (error) {}

            }


            return;

        }

    }

);


/* ============================================================
   CREATE LOBBY
   ============================================================ */

function createLobby() {

    setStatus(
        "Connecting to PeerJS..."
    );


    setLobby(
        "Creating lobby: " +
        room
    );


    try {

        /*
         * The room ID IS the PeerJS ID.
         *
         * Therefore there can only be one
         * host relay for this room.
         */

        peer =
            new Peer(
                room
            );

    }

    catch (error) {

        notifyClient(

            "error",

            null,

            error.message ||
            "Could not start PeerJS."

        );

        return;

    }


    /* ========================================================
       PEER OPEN
       ======================================================== */

    peer.on(

        "open",

        function(id) {

            setStatus(
                "Lobby created!"
            );


            setLobby(

                "Lobby: " +
                id +
                "\nWaiting for users..."

            );


            notifyClient(

                "room_created",

                "host",

                "",

                "",

                id

            );

        }

    );


    /* ========================================================
       NEW USER CONNECTION
       ======================================================== */

    peer.on(

        "connection",

        function(connection) {

            setupConnection(
                connection
            );

        }

    );


    /* ========================================================
       PEER ERROR
       ======================================================== */

    peer.on(

        "error",

        function(error) {

            if (
                error.type ===
                "unavailable-id"
            ) {

                setStatus(
                    "Lobby already exists."
                );


                setLobby(
                    "Joining existing lobby..."
                );


                notifyClient(

                    "lobby_exists",

                    "joiner",

                    error.message ||
                    "Lobby already exists.",

                    "",

                    ""

                );


                return;

            }


            notifyClient(

                "error",

                null,

                error.message ||
                "PeerJS error.",

                "",
                ""

            );

        }

    );


    /* ========================================================
       DISCONNECTED
       ======================================================== */

    peer.on(

        "disconnected",

        function() {

            setStatus(
                "Reconnecting to PeerJS..."
            );


            notifyClient(

                "disconnected",

                null,

                "PeerJS disconnected."

            );


            setTimeout(

                function() {

                    if (
                        peer &&
                        !peer.destroyed &&
                        peer.disconnected
                    ) {

                        try {

                            peer.reconnect();

                        }

                        catch (error) {}

                    }

                },

                1000

            );

        }

    );

}


/* ============================================================
   JOIN EXISTING LOBBY
   ============================================================ */

function joinLobby() {

    setStatus(
        "Joining lobby..."
    );


    setLobby(
        "Connecting to " +
        room
    );


    try {

        /*
         * Joiners get their own temporary
         * PeerJS ID.
         */

        peer =
            new Peer();

    }

    catch (error) {

        notifyClient(

            "error",

            null,

            error.message ||
            "Could not start PeerJS."

        );

        return;

    }


    /* ========================================================
       PEER OPEN
       ======================================================== */

    peer.on(

        "open",

        function(id) {

            setLobby(

                "Connected to PeerJS.\n" +
                "Joining " +
                room +
                "..."

            );


            /*
             * Connect this temporary relay
             * to the permanent host relay.
             */

            var connection =
                peer.connect(

                    room,

                    {

                        reliable:
                            true

                    }

                );


            setupConnection(
                connection
            );

        }

    );


    /* ========================================================
       PEER ERROR
       ======================================================== */

    peer.on(

        "error",

        function(error) {

            notifyClient(

                "error",

                null,

                error.message ||
                "PeerJS error.",

                "",
                ""

            );

        }

    );


    /* ========================================================
       DISCONNECTED
       ======================================================== */

    peer.on(

        "disconnected",

        function() {

            setStatus(
                "Reconnecting to PeerJS..."
            );


            notifyClient(

                "disconnected",

                null,

                "PeerJS disconnected."

            );


            setTimeout(

                function() {

                    if (
                        peer &&
                        !peer.destroyed &&
                        peer.disconnected
                    ) {

                        try {

                            peer.reconnect();

                        }

                        catch (error) {}

                    }

                },

                1000

            );

        }

    );

}


/* ============================================================
   START
   ============================================================ */

if (
    typeof Peer ===
    "undefined"
) {

    setStatus(
        "PeerJS failed to load."
    );


    setLobby(
        "The PeerJS library could not be loaded."
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
        "Missing action or room."
    );

}

else if (
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
```
