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

* Every PeerJS connection gets
* an entry here.
  */
  var connections =
  [];

/*

* The host's name.
*
* Only used by the host relay.
  */
  var hostName =
  "";

/*

* Prevent duplicate handling of
* the same connection.
  */
  var connectionIds =
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


/*
 * Do not add the same connection
 * more than once.
 */

if (
    connectionIds.indexOf(
        connection.peer
    ) !== -1
) {

    return;

}


connectionIds.push(
    connection.peer
);


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


        var idIndex =
            connectionIds.indexOf(
                connection.peer
            );


        if (
            idIndex !== -1
        ) {

            connectionIds.splice(
                idIndex,
                1
            );

        }


        return user;

    }

}


return null;


}

/* ============================================================
UPDATE UI
============================================================ */

function updateLobbyDisplay() {


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
SEND SIGNAL TO ONE JOINER
============================================================ */

function sendSignalToConnection(
connection,
payload
) {


if (
    !connection ||
    !connection.open
) {

    return;

}


try {

    connection.send({

        type:
            "signal_data",

        room:
            room,

        payload:
            payload

    });

}

catch (error) {}


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

        updateLobbyDisplay();


        /*
         * IMPORTANT:
         *
         * Only a JOINER relay tells its
         * main page that its connection
         * to the host relay is ready.
         *
         * The HOST relay stays alive.
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
           SIGNALING DATA
           ================================================= */

        if (
            data.type ===
            "signal_send"
        ) {

            /*
             * A JOINER sends its WebRTC signaling
             * data to the HOST relay.
             *
             * The host relay forwards it to
             * every other connection.
             */

            if (
                action ===
                "create"
            ) {

                broadcast(

                    {

                        type:
                            "signal_data",

                        room:
                            room,

                        payload:
                            data.payload

                    },

                    connection

                );

            }


            /*
             * A HOST's main page sends signaling
             * data through its relay.
             *
             * Send it to every connected joiner.
             */

            else if (
                action ===
                "join"
            ) {

                /*
                 * This case is normally not used
                 * because a joiner is connected to
                 * the host, but forwarding it makes
                 * the relay symmetric.
                 */

                broadcast(

                    {

                        type:
                            "signal_data",

                        room:
                            room,

                        payload:
                            data.payload

                    },

                    connection

                );

            }


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
             * A JOINER has announced its name
             * to the HOST relay.
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


                /*
                 * Tell all OTHER joiners.
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
                            data.name ||
                            "Unknown",

                        peerId:
                            connection.peer

                    },

                    connection

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
             * Send to everyone else.
             */

            broadcast(

                message,

                connection

            );


            /*
             * Send to this relay's
             * own main page.
             */

            notifyMain(
                message
            );


            return;

        }


        /* =================================================
           NORMAL DATA
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


        updateLobbyDisplay();


        /*
         * The HOST needs to know when a
         * JOINER leaves.
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
         * A JOINER's connection closing
         * means its host connection died.
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

        /*
         * Do not immediately destroy the relay.
         */

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
         *
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
         * Send the name through the
         * PeerJS connection to the host.
         */

        if (
            action ===
            "join"
        ) {

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
       SIGNAL SEND
       ==================================================== */

    if (
        data.type ===
        "signal_send"
    ) {

        /*
         * HOST:
         *
         * Send the host's WebRTC signal
         * to every joiner.
         */

        if (
            action ===
            "create"
        ) {

            broadcast(

                {

                    type:
                        "signal_data",

                    room:
                        room,

                    payload:
                        data.payload

                }

            );

            return;

        }


        /*
         * JOINER:
         *
         * Send the joiner's WebRTC signal
         * through the connection to the host.
         */

        if (
            action ===
            "join"
        ) {

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
                            "signal_send",

                        room:
                            room,

                        payload:
                            data.payload

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
         * Send back to the host's
         * main page.
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

    /*
     * The host owns the room ID.
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


        /*
         * Tell the host's main page that
         * its relay successfully owns the room.
         */

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

        /*
         * This should NOT normally happen for
         * a real host unless another host is
         * already using the room ID.
         */

        if (
            error.type ===
            "unavailable-id"
        ) {

            setStatus(
                "Lobby already exists."
            );


            setLobby(
                "Another relay already owns " +
                room
            );


            notifyClient(

                "lobby_exists",

                "joiner",

                error.message ||
                "Lobby already exists.",

                "",

                ""

            );


            /*
             * Important:
             *
             * Do NOT call peer.destroy()
             * here.
             *
             * The main page will close this
             * temporary relay and open a join
             * relay.
             */

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
         * The HOST should attempt to reconnect
         * because it owns the lobby ID.
         */

        setStatus(
            "Reconnecting to PeerJS..."
        );


        setLobby(
            "Lobby: " +
            room +
            "\nReconnecting..."
        );


        try {

            if (
                peer &&
                !peer.destroyed
            ) {

                peer.reconnect();

            }

        }

        catch (error) {}

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
     * Joiners receive their own unique
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

        setStatus(
            "Connecting to lobby..."
        );


        setLobby(

            "Connected to PeerJS.\n" +
            "Joining " +
            room +
            "..."

        );


        /*
         * Connect the temporary JOINER
         * relay to the permanent HOST relay.
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

        /*
         * unavailable-id should never be
         * a problem for a joiner because
         * the joiner has a random PeerJS ID.
         */

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


        /*
         * The temporary relay can reconnect
         * if PeerJS briefly disconnects.
         */

        try {

            if (
                peer &&
                !peer.destroyed
            ) {

                peer.reconnect();

            }

        }

        catch (error) {}

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
