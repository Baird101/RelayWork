var params = new URLSearchParams(window.location.search);
var action = params.get("action");
var room = params.get("room");
var peer = null;

var connections = [];
var hostName = "";
var connectionIds = [];

function setStatus(text) {
    var element = document.getElementById("status");

    if (element) {
        element.textContent = text;
    }
}

function setLobby(text) {
    var element = document.getElementById("lobby");

    if (element) {
        element.textContent = text;
    }
}

function notifyClient(peerEvent, role, detail, name, peerId, timestamp) {
    if (!window.opener || window.opener.closed) {
        return;
    }

    window.opener.postMessage({
        type: "relay_event",
        room: room,
        peerEvent: peerEvent,
        role: role || null,
        detail: detail || "",
        name: name || "",
        peerId: peerId || "",
        timestamp: timestamp || null
    }, "*");
}

function notifyMain(data) {
    if (!window.opener || window.opener.closed) {
        return;
    }

    window.opener.postMessage(data, "*");
}

function addConnection(connection) {
    if (connectionIds.indexOf(connection.peer) !== -1) {
        return null;
    }

    connectionIds.push(connection.peer);

    var user = {
        connection: connection,
        name: "",
        peerId: connection.peer
    };

    connections.push(user);

    return user;
}

function findConnection(connection) {
    for (var i = 0; i < connections.length; i++) {
        if (connections[i].connection === connection) {
            return connections[i];
        }
    }

    return null;
}

function removeConnection(connection) {
    for (var i = 0; i < connections.length; i++) {
        if (connections[i].connection === connection) {
            var user = connections[i];

            connections.splice(i, 1);

            var idIndex = connectionIds.indexOf(connection.peer);

            if (idIndex !== -1) {
                connectionIds.splice(idIndex, 1);
            }

            return user;
        }
    }

    return null;
}

function updateLobbyDisplay() {
    setStatus("Connected users: " + connections.length);
    setLobby(
        "Lobby: " +
        room +
        "\nUsers connected: " +
        connections.length
    );
}

function broadcast(data, exceptConnection) {
    for (var i = 0; i < connections.length; i++) {
        var connection = connections[i].connection;

        if (connection === exceptConnection) {
            continue;
        }

        if (!connection.open) {
            continue;
        }

        try {
            connection.send(data);
        } catch (error) {}
    }
}

function sendUserList() {
    if (action !== "create") {
        return;
    }

    var users = [];

    if (hostName !== "") {
        users.push({
            name: hostName,
            peerId: peer.id
        });
    }

    for (var i = 0; i < connections.length; i++) {
        if (connections[i].name !== "") {
            users.push({
                name: connections[i].name,
                peerId: connections[i].peerId
            });
        }
    }

    var message = {
        type: "relay_event",
        room: room,
        peerEvent: "user_list",
        users: users
    };

    notifyMain(message);
    broadcast(message);
}

function setupConnection(connection) {
    var user = addConnection(connection);

    if (!user) {
        return;
    }

    connection.on("open", function() {
        updateLobbyDisplay();

        if (action === "join") {
            notifyClient(
                "connected",
                "joiner",
                "",
                "",
                peer.id
            );
        }

        if (action === "create") {
            /*
             * Tell the new joiner what the current
             * user list is.
             *
             * At this point their name may not be
             * known yet, so do NOT add them as
             * "Unknown".
             */
            sendUserList();
        }
    });

    connection.on("data", function(data) {
        if (!data) {
            return;
        }

        /*
         * JOINER RELAY:
         *
         * A name sent by this Main window needs
         * to be forwarded to the host relay.
         */
        if (data.type === "set_name") {
            if (action === "join") {
                if (connection.open) {
                    connection.send({
                        type: "set_name",
                        name: data.name || ""
                    });
                }

                return;
            }

            /*
             * HOST RELAY:
             *
             * This is the name belonging to this
             * particular connection.
             */
            if (action === "create") {
                user.name = data.name || "";

                sendUserList();

                /*
                 * Tell everyone that this user
                 * has joined now that we know
                 * their actual name.
                 */
                var joinedEvent = {
                    type: "relay_event",
                    room: room,
                    peerEvent: "user_joined",
                    role: "joiner",
                    detail: "",
                    name: user.name,
                    peerId: user.peerId,
                    timestamp: Date.now()
                };

                notifyMain(joinedEvent);
                broadcast(joinedEvent, connection);

                return;
            }
        }

        /*
         * CHAT
         *
         * Joiner -> host
         */
        if (data.type === "chat_send") {
            if (action === "join") {
                if (connection.open) {
                    connection.send({
                        type: "chat_send",
                        room: room,
                        name: data.name || "",
                        text: data.text || "",
                        senderId: data.senderId || ""
                    });
                }

                return;
            }

            /*
             * Host receives a chat from one
             * of the joiners.
             */
            if (action === "create") {
                if (user) {
                    if (data.name) {
                        user.name = data.name;
                    }
                }

                var message = {
                    type: "chat",
                    room: room,
                    name: data.name || (user ? user.name : "") || "Unknown",
                    text: data.text || "",
                    senderId: data.senderId || "",
                    timestamp: data.timestamp || Date.now()
                };

                /*
                 * Send the message to every OTHER
                 * relay. This is what allows
                 * joiner A to talk to joiner B.
                 */
                broadcast(message, connection);

                /*
                 * Also show it to the host Main.
                 */
                notifyMain(message);

                return;
            }
        }

        /*
         * CHAT RECEIVED FROM HOST
         *
         * A joiner relay does not rebroadcast it.
         * It simply gives it to its Main.html.
         */
        if (data.type === "chat") {
            if (action === "join") {
                notifyMain(data);
            }

            return;
        }

        /*
         * USER LIST RECEIVED FROM HOST
         *
         * Joiner relays simply pass the authoritative
         * list to their Main.html.
         */
        if (
            data.type === "relay_event" &&
            data.peerEvent === "user_list"
        ) {
            notifyMain(data);
            return;
        }

        /*
         * Other relay events.
         */
        if (
            data.type === "relay_event" &&
            (
                data.peerEvent === "user_joined" ||
                data.peerEvent === "user_left"
            )
        ) {
            notifyMain(data);
            return;
        }

        /*
         * SIGNAL DATA
         */
        if (data.type === "signal_send") {
            if (action === "create") {
                broadcast({
                    type: "signal_data",
                    room: room,
                    payload: data.payload
                }, connection);
            }

            else if (action === "join") {
                if (connection.open) {
                    connection.send({
                        type: "signal_send",
                        room: room,
                        payload: data.payload
                    });
                }
            }

            return;
        }
    });

    /*
     * THIS IS THE ONLY PLACE THAT HANDLES
     * A CONNECTION LEAVING.
     *
     * Do NOT also use user_disconnect.
     */
    connection.on("close", function() {
        var oldUser = removeConnection(connection);

        updateLobbyDisplay();

        if (action === "create") {
            var leftEvent = {
                type: "relay_event",
                room: room,
                peerEvent: "user_left",
                role: "joiner",
                detail: "",
                name: oldUser && oldUser.name ? oldUser.name : "Unknown",
                peerId: connection.peer,
                timestamp: Date.now()
            };

            notifyMain(leftEvent);
            broadcast(leftEvent);

            sendUserList();
        }

        else if (action === "join") {
            /*
             * The joiner's connection to the host
             * closed. Tell this Main window.
             */
            notifyClient(
                "user_left",
                null,
                "",
                oldUser && oldUser.name
                    ? oldUser.name
                    : "",
                connection.peer,
                Date.now()
            );
        }
    });

    connection.on("error", function(error) {
        notifyClient(
            "error",
            null,
            error.message || "Connection error.",
            "",
            connection.peer
        );
    });
}

window.addEventListener("message", function(event) {
    if (!window.opener || event.source !== window.opener) {
        return;
    }

    var data = event.data || {};

    if (data.room && data.room !== room) {
        return;
    }

    /*
     * HOST NAME
     *
     * This is the name belonging to this
     * relay's Main window.
     */
    if (data.type === "set_name") {
        if (action === "create") {
            hostName = data.name || "";

            sendUserList();

            return;
        }

        /*
         * JOINER NAME
         *
         * Forward it to the host relay.
         */
        if (action === "join") {
            if (connections.length > 0) {
                var hostConnection = connections[0].connection;

                if (hostConnection.open) {
                    hostConnection.send({
                        type: "set_name",
                        name: data.name || ""
                    });
                }
            }

            return;
        }
    }

    /*
     * HOST Main -> host relay
     */
    if (data.type === "chat_send") {
        if (action === "create") {
            var hostMessage = {
                type: "chat",
                room: room,
                name: data.name || hostName || "Unknown",
                text: data.text || "",
                senderId: data.senderId || "",
                timestamp: data.timestamp || Date.now()
            };

            /*
             * Send host messages to ALL joiners.
             */
            broadcast(hostMessage);

            /*
             * Host already displays its own message,
             * so do not send it back to itself.
             */

            return;
        }

        /*
         * JOINER Main -> joiner relay -> host relay
         */
        if (action === "join") {
            if (connections.length > 0) {
                var hostConnection = connections[0].connection;

                if (hostConnection.open) {
                    hostConnection.send({
                        type: "chat_send",
                        room: room,
                        name: data.name || "",
                        text: data.text || "",
                        senderId: data.senderId || "",
                        timestamp: data.timestamp || Date.now()
                    });
                }
            }

            return;
        }
    }

    /*
     * SIGNAL DATA
     */
    if (data.type === "signal_send") {
        if (action === "create") {
            broadcast({
                type: "signal_data",
                room: room,
                payload: data.payload
            });

            return;
        }

        if (action === "join") {
            if (connections.length > 0) {
                var hostConnection = connections[0].connection;

                if (hostConnection.open) {
                    hostConnection.send({
                        type: "signal_send",
                        room: room,
                        payload: data.payload
                    });
                }
            }

            return;
        }
    }

    /*
     * IMPORTANT:
     *
     * There is intentionally NO user_disconnect
     * handling here.
     *
     * PeerJS close() is the authoritative
     * disconnect event.
     */

    broadcast(data);
    notifyMain(data);
});

function createLobby() {
    setStatus("Connecting to PeerJS...");
    setLobby("Creating lobby: " + room);

    try {
        peer = new Peer(room);
    } catch (error) {
        notifyClient(
            "error",
            null,
            error.message || "Could not start PeerJS."
        );

        return;
    }

    peer.on("open", function(id) {
        setStatus("Lobby created!");

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
    });

    peer.on("connection", function(connection) {
        setupConnection(connection);
    });

    peer.on("error", function(error) {
        if (error.type === "unavailable-id") {
            setStatus("Lobby already exists.");

            setLobby(
                "Another relay already owns " +
                room
            );

            notifyClient(
                "lobby_exists",
                "joiner",
                error.message || "Lobby already exists.",
                "",
                ""
            );

            return;
        }

        notifyClient(
            "error",
            null,
            error.message || "PeerJS error.",
            "",
            ""
        );
    });

    peer.on("disconnected", function() {
        setStatus("Reconnecting to PeerJS...");

        setLobby(
            "Lobby: " +
            room +
            "\nReconnecting..."
        );

        try {
            if (peer && !peer.destroyed) {
                peer.reconnect();
            }
        } catch (error) {}
    });
}

function joinLobby() {
    setStatus("Joining lobby...");
    setLobby("Connecting to " + room);

    try {
        peer = new Peer();
    } catch (error) {
        notifyClient(
            "error",
            null,
            error.message || "Could not start PeerJS."
        );

        return;
    }

    peer.on("open", function(id) {
        setStatus("Connecting to lobby...");

        setLobby(
            "Connected to PeerJS.\n" +
            "Joining " +
            room +
            "..."
        );

        var connection = peer.connect(
            room,
            {
                reliable: true
            }
        );

        setupConnection(connection);
    });

    peer.on("error", function(error) {
        notifyClient(
            "error",
            null,
            error.message || "PeerJS error.",
            "",
            ""
        );
    });

    peer.on("disconnected", function() {
        setStatus("Reconnecting to PeerJS...");

        try {
            if (peer && !peer.destroyed) {
                peer.reconnect();
            }
        } catch (error) {}
    });
}

var parentCheckTimer = setInterval(function() {
    if (!window.opener || window.opener.closed) {
        clearInterval(parentCheckTimer);

        /*
         * Do NOT send user_disconnect here.
         *
         * Destroying the PeerJS connection will
         * cause the host's "close" handler to fire.
         */
        if (peer && !peer.destroyed) {
            try {
                peer.destroy();
            } catch (error) {}
        }

        try {
            window.close();
        } catch (error) {}
    }
}, 250);

if (typeof Peer === "undefined") {
    setStatus("PeerJS failed to load.");
    setLobby("The PeerJS library could not be loaded.");
}

else if (!action || !room) {
    setStatus("Missing parameters.");
    setLobby("Missing action or room.");
}

else if (action === "create") {
    createLobby();
}

else if (action === "join") {
    joinLobby();
}

else {
    setStatus("Unknown action.");
    setLobby("Unknown action.");
}