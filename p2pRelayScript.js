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
 * Every connected user gets
 * their own entry here.
 */
var connections =
    [];


/*
 * The host is not stored in
 * connections because the host
 * is this relay itself.
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
                "\nUsers connected: " +
                connections.length

            );


            /* =================================================
               JOINER RELAY
               ================================================= */

            if (
                action ===
                "join"
            ) {

                /*
                 * This relay is the joiner's relay.
                 *
                 * Tell the joiner's MAIN page that
                 * its connection to the host is ready.
                 */

                notifyClient(

                    "connected",

                    "joiner",

                    "",

                    "",

                    peer.id

                );

            }


            /* =================================================
               HOST RELAY
               ================================================= */

            if (
                action ===
                "create"
            ) {

                /*
                 * A new PeerJS connection has opened.
                 *
                 * This means somebody successfully
                 * joined the host's lobby.
                 *
                 * IMPORTANT:
                 * Tell the HOST main page immediately.
                 */

                notifyClient(

                    "user_joined",

                    "host",

                    "",

                    user
                        ? user.name
                        : "",

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
                 * If this is a joiner connection,
                 * notify the host that the name
                 * is now known.
                 */

                if (
                    action ===
                    "create"
                ) {

                    notifyClient(

                        "user_joined",

                        "host",

                        "",

                        user
                            ? user.name
                            : data.name || "",

                        connection.peer

                    );

                }


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
                        data.name ||
                        user.name ||
                        "";

                }


                var message = {

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
                        "Unknown",

                    text:
                        data.text ||
                        "",

                    senderId:
                        data.senderId ||
                        ""

                };


                /*
                 * Send the message to all
                 * OTHER PeerJS connections.
                 */

                broadcast(
                    message,
                    connection
                );


                /*
                 * Also send the message to
                 * this relay's own main page.
                 *
                 * This is important for the host.
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
                "\nUsers connected: " +
                connections.length

            );


            /*
             * Tell the host that somebody left.
             */

            if (
                action ===
                "create"
            ) {

                notifyClient(

                    "user_left",

                    "host",

                    "",

                    oldUser
                        ? oldUser.name
                        : "",

                    connection.peer

                );

            }


            /*
             * Also tell a joiner's main page
             * if its host connection closes.
             */

            if (
                action ===
                "join"
            ) {

                notifyClient(

                    "user_left",

                    null,

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
         * Only accept messages from
         * our parent MAIN page.
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

            /*
             * HOST:
             * Store the host's name.
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
             * JOINER:
             *
             * The joiner's name needs to travel
             * through the PeerJS connection to
             * the host.
             */

            if (
                action ===
                "join"
            ) {

                /*
                 * Find the connection from this
                 * joiner relay to the host.
                 */

                if (
                    connections.length > 0
                ) {

                    var hostConnection =
                        connections[0].connection;


                    if (
                        hostConnection.open
                    ) {

                        hostConnection.send({

                            type:
                                "set_name",

                            name:
                                data.name ||
                                ""

                        });

                    }

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

            var message = {

                type:
                    "chat",

                room:
                    room,

                name:
                    data.name ||
                    hostName ||
                    "Unknown",

                text:
                    data.text ||
                    "",

                senderId:
                    data.senderId ||
                    ""

            };


            /*
             * Broadcast to every PeerJS
             * connection.
             */

            broadcast(
                message
            );


            /*
             * Send the message back to
             * this relay's own MAIN page.
             *
             * This is what lets the host
             * see their own chat message.
             */

            notifyMain(
                message
            );


            return;

        }


        /* ====================================================
           OTHER DATA
           ==================================================== */

        broadcast(
            data
        );


        notifyMain(
            data
        );

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
         * Every joiner gets a unique PeerJS ID.
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
             * permanent host relay.
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