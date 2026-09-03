var params = new URLSearchParams(window.location.search);
var action = params.get("action");
var room = params.get("room");
var peer = null;

var connections = [];
var hostName = "";
var connectionIds = [];

function sendUserList() {

    var users = [];

    if (hostName !== "") {
        users.push({
            name: hostName,
            peerId: peer.id
        });
    }

    for (var i = 0; i < connections.length; i++) {

        users.push({
            name: connections[i].name || "Unknown",
            peerId: connections[i].peerId
        });

    }

    var message = {
        type: "relay_event",
        room: room,
        peerEvent: "user_list",
        users: users
    };

    /*
     * Send to this relay's Main.html.
     */
    notifyMain(message);

    /*
     * Send the complete list to connected relays.
     */
    broadcast(message);
}

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

function notifyClient(peerEvent, role, detail, name, peerId) {
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
        peerId: peerId || ""
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
        return;
    }

    connectionIds.push(connection.peer);

    connections.push({
        connection: connection,
        name: "",
        peerId: connection.peer
    });
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
    setLobby("Lobby: " + room + "\nUsers connected: " + connections.length);
}

function broadcast(data, exceptConnection) {
    for (var i = 0; i < connections.length; i++) {
        var connection = connections[i].connection;

        if (connection === exceptConnection) {
            continue;
        }

        if (connection.open) {
            try {
                connection.send(data);
            } catch (error) {}
        }
    }
}

function setupConnection(connection) {
    addConnection(connection);

    var user = findConnection(connection);

    connection.on("open", function() {
        updateLobbyDisplay();

        if (action === "join") {
            notifyClient("connected", "joiner", "", "", peer.id);
        }
    });

    connection.on("data", function(data) {
        if (!data) {
            return;
        }

        if (data.type === "set_name") {

                if (action === "create") {
                    hostName = data.name || "";
                    sendUserList();
                    return;
                }

                else if (action === "join") {
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

        if (data.type === "user_disconnect") {
            if (action === "create") {
                var disconnectedUser = removeConnection(connection);

                var leftEvent = {
                    type: "relay_event",
                    room: room,
                    peerEvent: "user_left",
                    role: "joiner",
                    detail: "",
                    name: disconnectedUser && disconnectedUser.name
                        ? disconnectedUser.name
                        : "Unknown",
                    peerId: connection.peer
                };

                updateLobbyDisplay();
                notifyMain(leftEvent);
                broadcast(leftEvent);
            }
            
            sendUserList();
            return;
        }

        if (data.type === "signal_send") {
            if (action === "create") {
                broadcast({
                    type: "signal_data",
                    room: room,
                    payload: data.payload
                }, connection);
            }

            else if (action === "join") {
                broadcast({
                    type: "signal_data",
                    room: room,
                    payload: data.payload
                }, connection);
            }

            return;
        }

        if (data.type === "chat_send") {
            if (user) {
                user.name = data.name || user.name || "";
            }

            var message = {
                type: "chat",
                room: room,
                name: data.name || (user ? user.name : "") || "Unknown",
                text: data.text || "",
                senderId: data.senderId || ""
            };

            broadcast(message, connection);
            notifyMain(message);

            return;
        }

        if (data.type === "chat") {

            notifyMain(data);

            return;

        }
        if (data.type === "relay_event" && (data.peerEvent === "user_list" || data.peerEvent === "user_joined" || data.peerEvent === "user_left")) {
            notifyMain(data);
            return;
        }

        if (data.type === "relay_event" && (data.peerEvent === "user_list" || data.peerEvent === "user_joined" || data.peerEvent === "user_left")) {
            notifyMain(data);
            return;
        }

        broadcast(data, connection);
        notifyMain(data);
    });

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
                name: oldUser && oldUser.name
                    ? oldUser.name
                    : "Unknown",
                peerId: connection.peer
            };

            notifyMain(leftEvent);
            broadcast(leftEvent);
        }

        else if (action === "join") {
            notifyClient(
                "user_left",
                null,
                "",
                "",
                connection.peer
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

    if (data.type === "set_name") {
        if (action === "create") {
            hostName = data.name || "";
            return;
        }

        else if (action === "join") {
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

    if (data.type === "signal_send") {
        if (action === "create") {
            broadcast({
                type: "signal_data",
                room: room,
                payload: data.payload
            });

            return;
        }

        else if (action === "join") {
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

    if (data.type === "chat_send") {
        var message = {
            type: "chat",
            room: room,
            name: data.name || hostName || "Unknown",
            text: data.text || "",
            senderId: data.senderId || ""
        };

        broadcast(message);
        notifyMain(message);

        return;
    }

    if (data.type === "user_disconnect") {
        if (action === "join") {
            if (connections.length > 0) {
                var hostConnection = connections[0].connection;

                if (hostConnection.open) {
                    hostConnection.send({
                        type: "user_disconnect"
                    });
                }
            }
        }

        return;
    }

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

        if (action === "join" && connections.length > 0) {
            var hostConnection = connections[0].connection;

            if (hostConnection.open) {
                try {
                    hostConnection.send({
                        type: "user_disconnect"
                    });
                } catch (error) {}
            }
        }

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

