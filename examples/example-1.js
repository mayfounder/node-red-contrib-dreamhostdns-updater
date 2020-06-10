[
    {
        "id": "d5747ce0.7212",
        "type": "ip",
        "z": "a87e478c.69f738",
        "name": "ip",
        "https": false,
        "timeout": "5000",
        "internalIPv4": true,
        "internalIPv6": true,
        "publicIPv4": true,
        "publicIPv6": true,
        "x": 290,
        "y": 360,
        "wires": [
            [
                "26635b25.5f9794"
            ]
        ]
    },
    {
        "id": "952aee8d.45e3c",
        "type": "debug",
        "z": "a87e478c.69f738",
        "name": "",
        "active": false,
        "tosidebar": true,
        "console": false,
        "tostatus": false,
        "complete": "false",
        "x": 670,
        "y": 360,
        "wires": []
    },
    {
        "id": "1ce91a58.142296",
        "type": "inject",
        "z": "a87e478c.69f738",
        "name": "",
        "topic": "",
        "payload": "",
        "payloadType": "date",
        "repeat": "3600",
        "crontab": "",
        "once": false,
        "onceDelay": 0.1,
        "x": 150,
        "y": 360,
        "wires": [
            [
                "d5747ce0.7212"
            ]
        ]
    },
    {
        "id": "26635b25.5f9794",
        "type": "Dreamhost DNS Updater",
        "z": "a87e478c.69f738",
        "name": "Dreamhost DNS Updater",
        "domain": "domain.com",
        "subdomain": "sub",
        "x": 470,
        "y": 360,
        "wires": [
            [
                "952aee8d.45e3c"
            ]
        ]
    }
]
