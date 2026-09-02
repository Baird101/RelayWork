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

* EVERY connection gets its own
* entry in this array.
*
* This is what allows:
*
* User 1
* User 2
* User 3
* User 4
* User 5
* ...
*
* to all be connected at once.
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
data
) {


for (
    var i = 0;
    i < connections.length;
    i++
) {

    var connection =
        connections[i].connection;


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
RECEIVE MESSAGES FROM MAIN PAGE
============================================================ */

window.addEventListener(

    "message",

    function(event) {

        if (
            !window.opener ||
            event.source !== window.opener
        ) {

            return;

        }


        var data =
            event.data || {};


        if (
            data.type === "chat_send"
        ) {

            /*
             * Broadcast the chat message
             * to all connected peers.
             */

            broadcast(
                {

                    type:
                        "chat",

                    room:
                        data.room,

                    name:
                        data.name || "Unknown",

                    text:
                        data.text || "",

                    senderId:
                        data.senderId || ""

                }
            );

        }

    }

);


/* ============================================================
SET UP CONNECTION
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
   CONNECTION OPENED
   ======================================================== */

connection.on(

    "open",

    function() {

        setStatus(
            "Connected users: " +
            connections.length
        );


        /*
         * Tell the joiner that
         * this connection is ready.
         * 
         * For creators, this is ignored.
         */

        if (
            action === "join"
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
           CHAT MESSAGE
           ================================================= */

        if (
            data.type ===
            "chat_send"
        ) {

            /*
             * Remember who this connection belongs to.
             */

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
                    data.name || "Unknown",

                text:
                    data.text || "",

                senderId:
                    data.senderId || ""

            };


            /*
             * Send the message to all
             * connected peers.
             */

            broadcast(
                message
            );


            /*
             * Also send to our main page
             * so they can see it.
             */

            if (
                window.opener &&
                !window.opener.closed
            ) {

                window.opener.postMessage(
                    message,
                    "*"
                );

            }


            return;

        }


        /* =================================================
           RELAYED CHAT MESSAGE
           ================================================= */

        if (
            data.type ===
            "chat"
        ) {

            /*
             * Update user name if not already set.
             */

            if (user && !user.name) {

                user.name =
                    data.name || "";

            }


            /*
             * Broadcast to all other connected peers.
             */

            broadcast(
                data
            );


            /*
             * Also send to our main page.
             */

            if (
                window.opener &&
                !window.opener.closed
            ) {

                window.opener.postMessage(
                    data,
                    "*"
                );

            }


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

        var user =
            removeConnection(
                connection
            );


        setStatus(
            "Connected users: " +
            connections.length
        );


        notifyClient(

            "user_left",

            null,

            "",

            user
                ? user.name
                : ""

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
            "Connection error."

        );

    }

);


}

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
     * The FIRST person creates
     * the permanent "main" ID.
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
   NEW USER
   ======================================================== */

peer.on(

    "connection",

    function(connection) {

        /*
         * IMPORTANT:
         *
         * DO NOT overwrite a single
         * peerConnection variable.
         *
         * Every connection is kept
         * in the connections array.
         */

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
         * Someone already owns "main".
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


            notifyClient(

                "lobby_exists",

                "joiner",

                error.message,

                "",

                ""

            );


            return;

        }


        notifyClient(

            "error",

            null,

            error.message ||
            "PeerJS error."

        );

    }

);


peer.on(

    "disconnected",

    function() {

        setStatus(
            "Disconnected from PeerJS."
        );

    }

);


}

/* ============================================================
JOIN LOBBY
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
     * Joiners get a random PeerJS ID.
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
   JOINER PEER OPEN
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
         * main lobby.
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
   JOINER ERROR
   ======================================================== */

peer.on(

    "error",

    function(error) {

        notifyClient(

            "error",

            null,

            error.message ||
            "PeerJS error."

        );

    }

);


peer.on(

    "disconnected",

    function() {

        setStatus(
            "Disconnected."
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
action === "create"
) {


createLobby();


}

else if (
action === "join"
) {


joinLobby();


}

else {


setStatus(
    "Unknown action."
);


}
