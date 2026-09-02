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

var peerConnections =
    [];

var outboundQueue =
    [];


/* ============================================================
   UI
   ============================================================ */

function setStatus(text) {

    var element =
        document.getElementById("status");

    if (element) {

        element.innerHTML =
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
   SEND EVENT TO MAIN CHAT
   ============================================================ */

function notifyClient(
    peerEvent,
    role,
    detail,
    errorType
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

            errorType:
                errorType || ""

        },

        "*"

    );

}


/* ============================================================
   SEND SIGNAL TO MAIN CHAT
   ============================================================ */

function notifySignal(
    payload
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
                "signal_data",

            room:
                room,

            payload:
                payload

        },

        "*"

    );

}


/* ============================================================
   SEND SIGNAL TO OTHER USER
   ============================================================ */

function sendSignal(
    payload
) {

    if (
        peerConnections.length ===
        0
    ) {

        outboundQueue.push(
            payload
        );

        return;

    }


    /*
     * Send the signal to every connected
     * relay peer.
     */

    for (
        var i = 0;
        i < peerConnections.length;
        i++
    ) {

        var connection =
            peerConnections[i];

        if (
            connection &&
            connection.open
        ) {

            connection.send(
                payload
            );

        }

    }

}


/* ============================================================
   FLUSH SIGNAL QUEUE
   ============================================================ */

function flushQueue() {

    if (
        peerConnections.length ===
        0
    ) {

        return;

    }


    while (
        outboundQueue.length >
        0
    ) {

        var payload =
            outboundQueue.shift();


        for (
            var i = 0;
            i < peerConnections.length;
            i++
        ) {

            var connection =
                peerConnections[i];

            if (
                connection &&
                connection.open
            ) {

                connection.send(
                    payload
                );

            }

        }

    }

}


/* ============================================================
   RECEIVE SIGNAL FROM MAIN CHAT
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


        if (
            msg.type ===
            "signal_send"
        ) {

            sendSignal(
                msg.payload
            );

        }

    }

);


/* ============================================================
   VALIDATE
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


/* ============================================================
   CREATE LOBBY
   ============================================================ */

function createLobby() {

    setStatus(
        '<span class="spinner">↻</span> Connecting to PeerJS...'
    );


    setLobby(
        "Creating lobby: " +
        room
    );


    /*
     * "main" is the permanent lobby ID.
     */

    try {

        peer =
            new Peer(
                room
            );

    }

    catch (error) {

        setStatus(
            "Could not start PeerJS."
        );


        setLobby(
            error.message ||
            "Unknown error."
        );


        notifyClient(
            "error",
            null,
            error.message,
            "constructor-error"
        );


        return;

    }


    /*
     * PeerJS connected to its server.
     */

    peer.on(

    "connection",

    function(connection) {

        peerConnections.push(
            connection
        );


        connection.on(

            "open",

            function() {

                setStatus(
                    "User connected!"
                );


                setLobby(

                    "Lobby: " +
                    room +
                    "\n" +
                    peerConnections.length +
                    " users connected."

                );


                notifyClient(
                    "connected_as_host",
                    "host"
                );


                flushQueue();

            }

        );


        connection.on(

            "data",

            function(data) {

                notifySignal(
                    data
                );

            }

        );


        connection.on(

            "close",

            function() {

                var index =
                    peerConnections.indexOf(
                        connection
                    );


                if (
                    index !== -1
                ) {

                    peerConnections.splice(
                        index,
                        1
                    );

                }

            }

        );


        connection.on(

            "error",

            function(error) {

                notifyClient(

                    "error",

                    null,

                    error.message ||
                    "Connection error.",

                    error.type || ""

                );

            }

        );

    }

);

    /*
     * Another browser connected.
     */

    peer.on(

        "connection",

        function(connection) {

            peerConnection =
                connection;


            connection.on(

                "open",

                function() {

                    setStatus(
                        "User connected!"
                    );


                    setLobby(
                        "Lobby: " +
                        room +
                        "\nUser connected."
                    );


                    notifyClient(
                        "connected_as_host",
                        "host"
                    );


                    flushQueue();

                }

            );


            connection.on(

                "data",

                function(data) {

                    notifySignal(
                        data
                    );

                }

            );


            connection.on(

                "close",

                function() {

                    peerConnection =
                        null;

                }

            );


            connection.on(

                "error",

                function(error) {

                    notifyClient(

                        "error",

                        null,

                        error.message ||
                        "Connection error.",

                        error.type || ""

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

        function(error) {

            /*
             * This means somebody already created
             * the permanent "main" lobby.
             */

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


                /*
                 * Tell the main page to open
                 * a JOIN relay.
                 */

                notifyClient(
                    "lobby_exists",
                    "joiner",
                    error.message,
                    error.type
                );


                return;

            }


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


            notifyClient(

                "error",

                null,

                error.message,

                error.type

            );

        }

    );


    peer.on(

        "disconnected",

        function() {

            setStatus(
                "Disconnected"
            );


            setLobby(
                "PeerJS disconnected."
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
        "Connecting to lobby: " +
        room
    );


    try {

        /*
         * Joiners use a random ID.
         */

        peer =
            new Peer();

    }

    catch (error) {

        setStatus(
            "Could not start PeerJS."
        );


        setLobby(
            error.message ||
            "Unknown error."
        );


        notifyClient(
            "error",
            null,
            error.message,
            "constructor-error"
        );


        return;

    }


    peer.on(

        "open",

        function(id) {

            setLobby(
                "Connected to PeerJS.\n" +
                "Joining " +
                room +
                "..."
            );


            var connection =
                peer.connect(
                    room,
                    {
                        reliable:
                            true
                    }
                );


            peerConnection =
                connection;


            var timeout =
                setTimeout(

                    function() {

                        if (
                            !connection.open
                        ) {

                            setStatus(
                                "Could not join lobby."
                            );


                            setLobby(
                                "The lobby could not be reached."
                            );


                            notifyClient(

                                "error",

                                null,

                                "host_not_found",

                                "peer-unavailable"

                            );

                        }

                    },

                    10000

                );


            connection.on(

                "open",

                function() {

                    clearTimeout(
                        timeout
                    );


                    setStatus(
                        "Connected!"
                    );


                    setLobby(
                        "Connected to lobby."
                    );


                    notifyClient(
                        "connected_as_joiner",
                        "joiner"
                    );


                    flushQueue();

                }

            );


            connection.on(

                "data",

                function(data) {

                    notifySignal(
                        data
                    );

                }

            );


            connection.on(

                "close",

                function() {

                    peerConnection =
                        null;

                }

            );


            connection.on(

                "error",

                function(error) {

                    clearTimeout(
                        timeout
                    );


                    notifyClient(

                        "error",

                        null,

                        error.message ||
                        "Connection error.",

                        error.type || ""

                    );

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


            notifyClient(

                "error",

                null,

                error.message,

                error.type

            );

        }

    );

}
