[
    {
        "id": "ea6f2dacd66ef24a",
        "type": "amazon-echo-hub",
        "z": "7f709876.1686a8",
        "port": "80",
        "processinput": "1",
        "discovery": true,
        "x": 410,
        "y": 100,
        "wires": [
            [
                "88318a147da7dbf5",
                "c2cd7547330d91bd"
            ]
        ]
    },
    {
        "id": "88318a147da7dbf5",
        "type": "amazon-echo-device",
        "z": "7f709876.1686a8",
        "name": "Schreibtisch",
        "topic": "zigbee.0.842e14fffe26f649",
        "x": 630,
        "y": 80,
        "wires": [
            [
                "91da829a82a0f4d6"
            ]
        ]
    },
    {
        "id": "52d472db1d187e60",
        "type": "ioBroker out",
        "z": "7f709876.1686a8",
        "name": "To ioBroker",
        "topic": "0_userdata.0.AlexaToNodeRed.Input",
        "ack": "true",
        "autoCreate": "false",
        "stateName": "",
        "role": "",
        "payloadType": "",
        "readonly": "",
        "stateUnit": "",
        "stateMin": "",
        "stateMax": "",
        "x": 1050,
        "y": 100,
        "wires": []
    },
    {
        "id": "91da829a82a0f4d6",
        "type": "function",
        "z": "7f709876.1686a8",
        "name": "Move object to payload",
        "func": "const obj = msg;\nmsg.payload = JSON.stringify(obj);\nreturn msg;",
        "outputs": 1,
        "noerr": 0,
        "initialize": "",
        "finalize": "",
        "libs": [],
        "x": 850,
        "y": 100,
        "wires": [
            [
                "52d472db1d187e60"
            ]
        ]
    },
    {
        "id": "2b0b5004040e55e8",
        "type": "ioBroker in",
        "z": "7f709876.1686a8",
        "name": "From ioBroker",
        "topic": "0_userdata.0.AlexaToNodeRed.Output",
        "payloadType": "value",
        "onlyack": "",
        "func": "all",
        "gap": "",
        "fireOnStart": "false",
        "x": 110,
        "y": 100,
        "wires": [
            [
                "1a054ec26552080b"
            ]
        ]
    },
    {
        "id": "1a054ec26552080b",
        "type": "json",
        "z": "7f709876.1686a8",
        "name": "",
        "property": "payload",
        "action": "obj",
        "pretty": true,
        "x": 250,
        "y": 100,
        "wires": [
            [
                "ea6f2dacd66ef24a"
            ]
        ]
    },
    {
        "id": "c2cd7547330d91bd",
        "type": "amazon-echo-device",
        "z": "7f709876.1686a8",
        "name": "Buero Licht",
        "topic": "zigbee.0.group_914",
        "x": 630,
        "y": 120,
        "wires": [
            [
                "91da829a82a0f4d6"
            ]
        ]
    }
]
