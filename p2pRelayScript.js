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


/* ============================================================
   MULTIPLE CONNECTIONS
   ============================================================ */

var connections =
    [];

var myName =
    "";

var myPeerId =
    "";


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

                peerId:
                    data.peerId,

                name:
                    data.name,

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
   SEND DATA TO MAIN PAGE
   ============================================================ */

function notifyMain(data) {

    if (
        window.opener &&
        !window.opener.closed
    ) {

        window.opener.postMessage(

            data,

            "*"

        );

    }

}


/* ============================================================
   FIND CONNECTION
   ============================================================ */

function findConnection(
    peerId
) {

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


/* ============================================================
   REMOVE CONNECTION
   ============================================================ */

function removeConnection(
    connection
) {

    for (
        var i = connections.length - 1;
        i >= 0;
        i--
    ) {

        if (
            connections[i] ===
            connection
        ) {

            connections.splice(
                i,
                1
            );

        }

    }

}


/* ============================================================
   BROADCAST TO EVERYONE
   ============================================================ */

function broadcast(
    data,
    exceptPeerId
) {

    for (
        var i = connections.length - 1;
        i >= 0;
        i--
    ) {

        var connection =
            connections[i];


        if (
            !connection ||
            !connection.open
        ) {

            continue;

        }


        if (
            exceptPeerId &&
            connection.peer ===
            exceptPeerId
        ) {

            continue;

        }


        try {

            connection.send(
                data
            );

        }

        catch (err) {

            /*
             * Remove broken connections.
             */

            removeConnection(
                connection
            );

        }

    }

}


/* ============================================================
   SEND SIGNAL
   ============================================================ */

function sendSignal(
    data
) {

    /*
     * WebRTC signaling is no longer needed here.
     *
     * The PeerJS data channel itself is the chat connection.
     *
     * So this function simply broadcasts the data.
     */

    broadcast(
        data
    );

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
            msg.room !==
            room
        ) {

            return;

        }


        /* ====================================================
           SET NAME
           ==================================================== */

        if (
            msg.type ===
            "set_name"
        ) {

            myName =
                msg.name ||
                "Unknown";


            return;

        }


        /* ====================================================
           CHAT MESSAGE
           ==================================================== */

        if (
            msg.type ===
            "chat_send"
        ) {

            var chatMessage = {

                type:
                    "chat",

                name:
                    msg.name ||
                    "Unknown",

                text:
                    msg.text ||
                    "",

                senderId:
                    msg.senderId ||
                    ""

            };


            /*
             * Send to every other person.
             */

            broadcast(

                chatMessage,

                msg.senderId

            );


            return;

        }

    }

);


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
     * "main" is the permanent lobby ID.
     */

    peer =
        new Peer(
            room
        );


    peer.on(

        "open",

        function(id) {

            myPeerId =
                id;


            setStatus(
                "Lobby created!"
            );


            setLobby(

                "Lobby: " +
                id +
                "\nWaiting for users..."

            );


            notifyClient({

                peerEvent:
                    "connected",

                role:
                    "host",

                peerId:
                    id

            });

        }

    );


    /* ========================================================
       USER CONNECTS
       ======================================================== */

    peer.on(

        "connection",

        function(connection) {

            /*
             * IMPORTANT:
             *
             * Do NOT overwrite one global
             * connection anymore.
             *
             * Add every user to the array.
             */

            connections.push(
                connection
            );


            connection.on(

                "open",

                function() {

                    setStatus(
                        "Connected!"
                    );


                    setLobby(

                        "Lobby: " +
                        room +
                        "\nUsers connected: " +
                        connections.length

                    );


                    /*
                     * Tell the main page that
                     * the relay is ready.
                     */

                    notifyClient({

                        peerEvent:
                            "connected",

                        role:
                            "host",

                        peerId:
                            connection.peer

                    });


                    /*
                     * Tell everyone else
                     * that somebody joined.
                     */

                    broadcast(

                        {

                            type:
                                "relay_event",

                            peerEvent:
                                "user_joined",

                            name:
                                "A user"

                        },

                        connection.peer

                    );

                }

            );


            connection.on(

                "data",

                function(data) {

                    /*
                     * Forward chat messages
                     * to everybody else.
                     */

                    if (
                        data &&
                        data.type ===
                        "chat"
                    ) {

                        broadcast(

                            data,

                            connection.peer

                        );

                    }

                }

            );


            connection.on(

                "close",

                function() {

                    removeConnection(
                        connection
                    );


                    setLobby(

                        "Lobby: " +
                        room +
                        "\nUsers connected: " +
                        connections.length

                    );


                    broadcast(

                        {

                            type:
                                "relay_event",

                            peerEvent:
                                "user_left",

                            peerId:
                                connection.peer

                        }

                    );

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


                    removeConnection(
                        connection
                    );

                }

            );

        }

    );


    /* ========================================================
       PEERJS ERRORS
       ======================================================== */

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
     * Every user gets their own random PeerJS ID.
     */

    peer =
        new Peer();


    peer.on(

        "open",

        function(id) {

            myPeerId =
                id;


            setLobby(

                "Your ID: " +
                id +
                "\nConnecting to lobby..."

            );


            var connection =
                peer.connect(
                    room,
                    {
                        reliable:
                            true
                    }
                );


            connections.push(
                connection
            );


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
                            "connected",

                        role:
                            "joiner",

                        peerId:
                            id

                    });

                }

            );


            connection.on(

                "data",

                function(data) {

                    /*
                     * Forward data to
                     * the main chat page.
                     */

                    notifyMain(
                        data
                    );

                }

            );


            connection.on(

                "close",

                function() {

                    removeConnection(
                        connection
                    );


                    notifyClient({

                        peerEvent:
                            "user_left"

                    });

                }

            );


            connection.on(

                "error",

                function(error) {

                    removeConnection(
                        connection
                    );


                    notifyClient({

                        peerEvent:
                            "error",

                        detail:
                            error.message ||
                            "Connection error.",

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