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

* IMPORTANT:
*
* There is NO longer a single
* "peerConnection".
*
* The host can have:
*
* ```
  connections[0]
  ```
* ```
  connections[1]
  ```
* ```
  connections[2]
  ```
* ```
  ...
  ```
*
* So any number of users can be
* connected at once.
  */

var connections =
[];

/* ============================================================
UI
============================================================ */

function setStatus(text) {

```
var element =
    document.getElementById("status");

if (element) {

    element.textContent =
        text;

}
```

}

function setLobby(text) {

```
var element =
    document.getElementById("lobby");

if (element) {

    element.textContent =
        text;

}
```

}

/* ============================================================
SEND EVENT TO MAIN PAGE
============================================================ */

function notifyClient(
peerEvent,
role,
detail,
name
) {

```
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
            name || ""

    },

    "*"

);
```

}

/* ============================================================
SEND DATA TO MAIN PAGE
============================================================ */

function notifyClientData(data) {

```
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
```

}

/* ============================================================
REMOVE CONNECTION
============================================================ */

function removeConnection(
connection
) {

```
var index =
    connections.indexOf(
        connection
    );


if (
    index !== -1
) {

    connections.splice(
        index,
        1
    );

}
```

}

/* ============================================================
BROADCAST
============================================================ */

function broadcast(
data,
except
) {

```
for (
    var i = 0;
    i < connections.length;
    i++
) {

    var connection =
        connections[i];


    if (
        connection === except
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
```

}

/* ============================================================
SET UP CONNECTION
============================================================ */

function setupConnection(
connection
) {

```
/*
 * Add this user to the list.
 */

connections.push(
    connection
);


connection.on(

    "open",

    function() {

        setStatus(
            "Connected users: " +
            connections.length
        );


        /*
         * Tell the main page that
         * this connection is ready.
         */

        notifyClient(
            "connected",
            action === "create"
                ? "host"
                : "joiner"
        );


        /*
         * For the host, this means
         * a NEW person joined.
         *
         * The joiner does not need
         * this notification because
         * they already know they joined.
         */

        if (
            action === "create"
        ) {

            notifyClient(
                "user_joined",
                "host"
            );

        }

    }

);


connection.on(

    "data",

    function(data) {

        /*
         * Data arriving here is a
         * chat message from a user.
         */

        if (
            data &&
            data.type === "chat_send"
        ) {

            var message = {

                type:
                    "chat",

                name:
                    data.name,

                text:
                    data.text,

                fromRelay:
                    true

            };


            /*
             * Send to EVERY other user.
             */

            broadcast(
                message,
                connection
            );


            /*
             * Also send it back to the
             * sender's main page through
             * the popup.
             *
             * The main page ignores this
             * because it already displayed
             * its own message.
             */

            notifyClientData(
                message
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


        setStatus(
            "Connected users: " +
            connections.length
        );


        notifyClient(
            "user_left",
            null
        );

    }

);


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
```

}

/* ============================================================
HOST / CREATE LOBBY
============================================================ */

function createLobby() {

```
setStatus(
    "Connecting to PeerJS..."
);


setLobby(
    "Creating lobby: " +
    room
);


try {

    /*
     * The permanent lobby ID
     * is "main".
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


/*
 * PeerJS server accepted
 * our "main" ID.
 */

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
            "host"
        );

    }

);


/*
 * THIS IS THE IMPORTANT PART.
 *
 * Every user who connects gets
 * their own DataConnection.
 */

peer.on(

    "connection",

    function(connection) {

        setupConnection(
            connection
        );

    }

);


/*
 * Another person may already
 * own the "main" ID.
 */

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
                error.message
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
```

}

/* ============================================================
JOIN EXISTING LOBBY
============================================================ */

function joinLobby() {

```
setStatus(
    "Joining lobby..."
);


setLobby(
    "Connecting to " +
    room
);


try {

    /*
     * Joiners get their own random
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


peer.on(

    "open",

    function() {

        setLobby(
            "Connected to PeerJS.\n" +
            "Joining " +
            room +
            "..."
        );


        /*
         * Connect to the permanent
         * "main" peer.
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
```

}

/* ============================================================
START
============================================================ */

if (
typeof Peer ===
"undefined"
) {

```
setStatus(
    "PeerJS failed to load."
);

setLobby(
    "The PeerJS library could not be loaded."
);
```

}

else if (
!action ||
!room
) {

```
setStatus(
    "Missing parameters."
);

setLobby(
    "Missing action or room."
);
```

}

else if (
action === "create"
) {

```
createLobby();
```

}

else if (
action === "join"
) {

```
joinLobby();
```

}

else {

```
setStatus(
    "Unknown action."
);
```

}
