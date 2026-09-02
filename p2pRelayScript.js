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

var connections =
    [];

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
   CONNECTION STORAGE
   ============================================================ */

function addConnection(connection) {

    connections.push({

        connection:
            connection,

        name:
            "",

        peerId:
            connection.peer

    });

}


function findConnection(connection) {

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


function findConnectionByPeerId(peerId) {

    for (
        var i = 0;
        i < connections.length;
        i++
    ) {

        if (
            connections[i].peerId ===
            peerId
        ) {

            return connections[i];

        }

    }


    return null;

}


function removeConnection(connection) {

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
   SEND TO ALL CONNECTED PEERJS USERS
   ============================================================ */

function broadcast(
    data,
    exceptConnection
) {

    for (
        var i = 0;
        i < connections.length;
        i++
    ) {

        var connection =
            connections[i].connection;


        if (
            connection ===
            exceptConnection
        ) {

            continue;

        }


        if (
            !connection.open
        ) {

            continue;

        }


        try {

            connection.send(
                data
            );

        }

        catch (error) {

            /*
             * Ignore one failed connection.
             * It will be removed by PeerJS
             * when its close event fires.
             */

        }

    }

}


/* ============================================================
   SEND CHAT FROM THIS RELAY TO ITS MAIN PAGE
   ============================================================ */

function makeChatMessage(data, user) {

    return {

        type:
            "chat",

        room:
            room,

        name:
            data.name ||
            (
                user
                ? user.name
                : ""
            ) ||
            hostName ||
            "Unknown",

        text:
            data.text ||
            "",

        senderId:
            data.senderId ||
            ""

    };

}


/* ============================================================
   HANDLE CHAT ARRIVING FROM A PEERJS CONNECTION
   ============================================================ */

function handlePeerChat(
    connection,
    data
) {

    var user =
        findConnection(
            connection
        );


    if (user) {

        if (data.name) {

            user.name =
                data.name;

        }

    }


    var message =
        makeChatMessage(
            data,
            user
        );


    /*
     * HOST RELAY
     *
     * A joiner sent us this message.
     *
     * Send it to every OTHER joiner.
     */
    if (
        action ===
        "create"
    ) {

        broadcast(
            message,
            connection
        );


        /*
         * Also give it to the host's
         * own Main.html.
         */
        notifyMain(
            message
        );

        return;

    }


    /*
     * JOINER RELAY
     *
     * A message coming from the host
     * must be displayed by this joiner's
     * Main.html.
     */
    if (
        action ===
        "join"
    ) {

        notifyMain(
            message
        );

        return;

    }

}


/* ============================================================
   HANDLE A CONNECTION
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
       OPEN
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
                "\nUsers connected: " +
                connections.length
            );


            /*
             * This relay is a JOINER.
             *
             * Tell its Main.html that its
             * connection to the host relay
             * is actually open.
             */
            if (
                action ===
                "join"
            ) {

                notifyClient(

                    "connected",

                    "joiner",

                    "",

                    "",

                    peer.id

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
                 * A JOINER RELAY has sent
                 * its name to the HOST RELAY.
                 */
                if (
                    action ===
                    "create"
                ) {

                    var joinedName =
                        data.name ||
                        "Unknown";


                    /*
                     * Tell the host.
                     */
                    notifyClient(

                        "user_joined",

                        "host",

                        "",

                        joinedName,

                        connection.peer

                    );


                    /*
                     * Tell all OTHER joiners.
                     *
                     * The joining user itself is
                     * excluded because it already
                     * knows that it joined.
                     */
                    broadcast(

                        {

                            type:
                                "relay_event",

                            room:
                                room,

                            peerEvent:
                                "user_joined",

                            role:
                                "joiner",

                            detail:
                                "",

                            name:
                                joinedName,

                            peerId:
                                connection.peer

                        },

                        connection

                    );

                }


                return;

            }


            /* =================================================
               CHAT
               ================================================= */

            if (
                data.type ===
                "chat_send"
            ) {

                handlePeerChat(
                    connection,
                    data
                );

                return;

            }


            /* =================================================
               NORMAL DATA
               ================================================= */

            /*
             * HOST:
             * Forward normal data from one
             * joiner to every other joiner,
             * then give it to the host page.
             */
            if (
                action ===
                "create"
            ) {

                broadcast(
                    data,
                    connection
                );

                notifyMain(
                    data
                );

                return;

            }


            /*
             * JOINER:
             * Anything received from the host
             * goes to this joiner's Main.html.
             */
            if (
                action ===
                "join"
            ) {

                notifyMain(
                    data
                );

                return;

            }

        }
    );


    /* ========================================================
       CLOSE
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
                "\nUsers connected: " +
                connections.length
            );


            var oldName =
                oldUser
                ? oldUser.name
                : "";


            /*
             * HOST:
             *
             * Tell the host page that a
             * joiner left.
             *
             * Also tell the remaining joiners.
             */
            if (
                action ===
                "create"
            ) {

                notifyClient(

                    "user_left",

                    "host",

                    "",

                    oldName,

                    connection.peer

                );


                broadcast(

                    {

                        type:
                            "relay_event",

                        room:
                            room,

                        peerEvent:
                            "user_left",

                        role:
                            "joiner",

                        detail:
                            "",

                        name:
                            oldName,

                        peerId:
                            connection.peer

                    }

                );

                return;

            }


            /*
             * JOINER:
             *
             * The host connection disappeared.
             */
            if (
                action ===
                "join"
            ) {

                notifyClient(

                    "user_left",

                    null,

                    "Host connection closed.",

                    "",

                    connection.peer

                );

            }

        }
    );


    /* ========================================================
       ERROR
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
         * own Main.html.
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


        /*
         * Ignore messages for another room.
         */
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

            /*
             * HOST
             */
            if (
                action ===
                "create"
            ) {

                hostName =
                    data.name ||
                    "";

                return;

            }


            /*
             * JOINER
             *
             * Forward the name to the host relay.
             */
            if (
                action ===
                "join"
            ) {

                if (
                    connections.length ===
                    0
                ) {

                    return;

                }


                var hostConnection =
                    connections[0].connection;


                if (
                    hostConnection &&
                    hostConnection.open
                ) {

                    hostConnection.send(

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
           CHAT SEND
           ==================================================== */

        if (
            data.type ===
            "chat_send"
        ) {

            var message =
                makeChatMessage(
                    data,
                    null
                );


            /*
             * HOST:
             *
             * Send the message to every
             * connected joiner.
             */
            if (
                action ===
                "create"
            ) {

                broadcast(
                    message
                );


                /*
                 * Also send it to the host's
                 * Main.html.
                 */
                notifyMain(
                    message
                );

                return;

            }


            /*
             * JOINER:
             *
             * Send the message through the
             * single host connection.
             */
            if (
                action ===
                "join"
            ) {

                if (
                    connections.length ===
                    0
                ) {

                    notifyClient(

                        "error",

                        "joiner",

                        "Not connected to host.",

                        "",

                        ""

                    );

                    return;

                }


                var host =
                    connections[0].connection;


                if (
                    !host ||
                    !host.open
                ) {

                    notifyClient(

                        "error",

                        "joiner",

                        "Host connection is not open.",

                        "",

                        ""

                    );

                    return;

                }


                try {

                    host.send(
                        data
                    );

                }

                catch (error) {

                    notifyClient(

                        "error",

                        "joiner",

                        error.message ||
                        "Could not send message.",

                        "",

                        ""

                    );

                }


                /*
                 * The sender's Main.html already
                 * displays its own message.
                 *
                 * DO NOT notifyMain(message)
                 * here or it will be duplicated.
                 */

                return;

            }

        }


        /* ====================================================
           OTHER DATA
           ==================================================== */

        if (
            action ===
            "create"
        ) {

            broadcast(
                data
            );

            notifyMain(
                data
            );

            return;

        }


        if (
            action ===
            "join"
        ) {

            if (
                connections.length ===
                0
            ) {

                return;

            }


            var host =
                connections[0].connection;


            if (
                host &&
                host.open
            ) {

                try {

                    host.send(
                        data
                    );

                }

                catch (error) {}

            }

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
       NEW USER
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
       ERROR
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
         * Every joiner gets a unique
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
             * Connect to the permanent
             * host relay.
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
       ERROR
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