var params =
    new URLSearchParams(
        window.location.search
    );


var action =
    params.get("action");


var room =
    params.get("room");


console.log(
    "Relay loaded: action=" +
    action +
    ", room=" +
    room
);


/* ============================================================
   TELL MAIN PAGE THAT RELAY LOADED
   ============================================================ */

if (
    window.opener &&
    !window.opener.closed
) {

    console.log(
        "Relay: Sending relay_ready message"
    );

    window.opener.postMessage(

        {

            type:
                "relay_ready",

            room:
                room

        },

        "*"

    );

}


var peer =
    null;

/*
 * Every connected user gets
 * their own entry here.
 */
var connections =
    [];


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
   SEND CHAT/SIGNAL TO MAIN PAGE
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
   BROADCAST
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

        /*
         * Don't send back to the
         * connection that sent it.
         */
        if (
            connection ===
            exceptConnection
        ) {

            continue;

        }

        if (
            connection.open
        ) {

            try {

                connection.send(
                    data
                );

            }

            catch (error) {}

        }

    }

}


/* ============================================================
   SET UP ONE CONNECTION
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


            /*
            * The PeerJS connection is now open.
            * We no longer need the relay popup.
            */
            if (
                window.opener &&
                !window.opener.closed
            ) {

                window.opener.postMessage(

                    {
                        type:
                            "relay_connected",

                        room:
                            room

                    },

                    "*"

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

            if (
                data.type ===
                "set_name"
            ) {

                if (user) {

                    user.name =
                        data.name || "";

                }


                notifyClient(

                    "user_joined",

                    "host",

                    "",

                    data.name || "Someone",

                    connection.peer

                );


                return;

            }
            /* =================================================
               CHAT SEND
               ================================================= */

            if (
                data.type ===
                "chat_send"
            ) {

                if (user) {

                    user.name =
                        data.name || "";

                }


                var message = {

                    type:
                        "chat",

                    room:
                        room,

                    name:
                        data.name ||
                        "Unknown",

                    text:
                        data.text ||
                        "",

                    senderId:
                        data.senderId ||
                        ""

                };


                /*
                 * Send to EVERY OTHER
                 * connected user.
                 */
                broadcast(
                    message,
                    connection
                );


                /*
                 * Send it to this relay's
                 * own main page too.
                 */
                notifyMain(
                    message
                );


                return;

            }


            /* =================================================
               NORMAL RELAY MESSAGE
               ================================================= */

            broadcast(
                data,
                connection
            );


            notifyMain(
                data
            );

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


            notifyClient(

                "user_left",

                null,

                "",

                oldUser
                    ? oldUser.name
                    : "",

                connection.peer

            );

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


        if (
            data.type ===
            "chat_send"
        ) {

            /*
             * Create the message object.
             */
            var message = {

                type:
                    "chat",

                room:
                    room,

                name:
                    data.name ||
                    "Unknown",

                text:
                    data.text ||
                    "",

                senderId:
                    data.senderId ||
                    ""

            };

            /*
             * Broadcast to everyone.
             */
            broadcast(
                message
            );

            /*
             * Also send it back to
             * our own main page.
             */
            notifyMain(
                message
            );

            return;

        }

        if (data.type === "set_name") {

            window.hostName =
                data.name || "";


            /*
            * Tell the host relay about this user's name.
            */
            broadcast(

                {

                    type:
                        "relay_user_name",

                    room:
                        room,

                    name:
                        data.name ||
                        "",

                    peerId:
                        peer.id

                }

            );

            return;

        }

    }

);


/* ============================================================
   CREATE LOBBY
   ============================================================ */

function createLobby() {

    console.log(
        "createLobby called for room: " +
        room
    );

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

        console.error(
            "Error creating Peer:",
            error
        );

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

            console.log(
                "Peer opened with ID: " +
                id
            );

            setStatus(
                "Lobby created!"
            );


            setLobby(

                "Lobby: " +
                id +
                "\nWaiting for users..."

            );


            console.log(
                "Sending room_created event"
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

            /*
             * PeerJS can temporarily lose its
             * connection to the signaling server.
             *
             * Try to reconnect instead of
             * permanently dying.
             */

            setStatus(
                "Reconnecting to PeerJS..."
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
         * Every joiner gets a
         * completely unique ID.
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
             * Connect this relay to the
             * permanent main lobby.
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
