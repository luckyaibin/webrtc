var me;//以GeoJSON的格式存储当前位置和ID等
var ws;
var opened;
var marker;
var markers = {};
var chatItems = [];
var chatInput;


function meUpdated() {
    var memsg = JSON.stringify(me);
    sessionStorage.setItem("t38.me", memsg);
    sendMe(memsg);
}

function sendMe(memsg) {
    if (!memsg) {
        var msg = {
            "type": "Position", //发送消息: 当前的位置和 信息
            "geojson": me
         }
        memsg = JSON.stringify(msg);
    }
    if (!opened) {
        return;
    }
    console.log("浏览器发送ws消息:",memsg)
    ws.send(memsg);
}

function calcNearby() {
    console.info("calcNearby() ......")
    var connected;
    for (id in markers) {
        pmarker = markers[id];
        var meters = distance(pmarker, marker);
        var layerName = "l:" + id;
        var sourceName = "s:" + id;
        if (meters < 500) {
            var data = {
                "type": "Feature", //Feature 表示发送经纬度，Message表示发送消息
                "properties": {},
                "geometry": {
                    "type": "LineString",
                    "coordinates": [
                        me.geometry.coordinates,
                        pmarker.person.geometry.coordinates,
                    ]
                }
            }
            if (map.getSource(sourceName)) {
                map.getSource(sourceName).setData(data);
            } else {
                map.addSource(sourceName, { type: 'geojson', data: data });
                map.addLayer({
                    "id": layerName,
                    "type": "line",
                    "source": sourceName,
                    "layout": {
                        "line-join": "round",
                        "line-cap": "round"
                    },
                    "paint": {
                        "line-color": "#aa6600",
                        "line-width": 3
                    }
                });
            }
            pmarker.getElement().style.borderColor = "#aa6600";
            pmarker.connected = true;
            connected = true;
        } else {
            if (map.getLayer(layerName)) {
                map.removeLayer(layerName);
            }
            if (map.getSource(sourceName)) {
                map.removeSource(sourceName);
            }
            pmarker.getElement().style.borderColor = null;
            pmarker.connected = false;
        }
    }
    if (connected) {
        marker.getElement().style.borderColor = "#aa6600";
        document.getElementById('marker-dot').style.color = "#aa6600";
    } else {
        marker.getElement().style.borderColor = null;
        document.getElementById('marker-dot').style.color = null;
    }
}

function openWS() {
    ws = new WebSocket("ws://" + location.host + "/ws");
    ws.onopen = function () {
        opened = true;
        meUpdated();
    }
    ws.onclose = function () {
        opened = false;
        setTimeout(function () { openWS() }, 1000)
    }
    ws.onmessage = function (e) {
        var msg = JSON.parse(e.data);
        if (msg.id == me.properties.id) { //忽略自己是发给服务器然后又经服务器转发回来的消息
            return;
        }
        console.log("浏览器收到服务器ws消息:",msg)
        switch (msg.command) {
            case "set":
                if (!markers[msg.id]) {
                    markers[msg.id] = makeMarker(false, msg.object);
                    markers[msg.id].addTo(map);
                } else {
                    markers[msg.id].setLngLat(msg.object.geometry.coordinates);

                    markers[msg.id].getElement().
                        querySelector(".marker-name").innerText =
                        msg.object.properties.name ?
                            msg.object.properties.name :
                            'Anonymous';
                }
                markers[msg.id].person = msg.object;
                break;
            case "del":
                if (markers[msg.id]) {
                    if (markers[msg.id].connected) {
                        var layerName = "l:" + id;
                        var sourceName = "s:" + id;
                        if (map.getLayer(layerName)) {
                            map.removeLayer(layerName);
                        }
                        if (map.getSource(sourceName)) {
                            map.removeSource(sourceName);
                        }
                    }
                    markers[msg.id].remove(map);
                    delete markers[msg.id];
                }
                break;
            default:
                if (msg.type == "Message") {
                    chatItems.push(msg);
                    chatUpdate();
                }
                break;
        }
        calcNearby();
    }
}


function makeMarker(isme, person) {
    // add self marker
    var el = document.createElement('div');
    el.className = 'marker';
    el.style.backgroundColor = person.properties.color;
    if (isme) {
        var ed = document.createElement('input');
        ed.value = person.properties.name ? person.properties.name : '';
        ed.type = 'text';
        ed.placeholder = 'enter your name';
        ed.id = 'name';
        ed.autocomplete = 'off';
        ed.maxLength = 28;
        ed.onkeypress = ed.onchange = ed.onkeyup = function (ev) {
            person.properties.name = ed.value.trim();
            meUpdated()
            if (ev.charCode == 13) {
                this.blur();
            }
        }
        el.appendChild(ed);
        el.style.zIndex = 10000;
        el.style.cursor = "move";
        var dot = document.createElement('div');
        dot.id = "marker-dot";
        el.appendChild(dot);
    } else {
        var ed = document.createElement('div');
        ed.className = 'marker-name';
        ed.innerText =
            person.properties.name ? person.properties.name : 'Anonymous';
        el.appendChild(ed);
    }
    var marker = new mapboxgl.Marker({
        element: el,
        draggable: isme
    })
    marker.setLngLat(person.geometry.coordinates);
    return marker
}


function distance(latA, lonA, latB, lonB) {
    if (arguments.length == 2) {
        var a = latA.getLngLat();
        var b = lonA.getLngLat();
        latA = a.lat;
        lonA = a.lng;
        latB = b.lat;
        lonB = b.lng;
    }

    // a = sin²(Δφ/2) + cos(φ1)⋅cos(φ2)⋅sin²(Δλ/2)
    // tanδ = √(a) / √(1−a)
    // see mathforum.org/library/drmath/view/51879.html for derivation

    var R = 6371e3;
    var φ1 = latA * Math.PI / 180, λ1 = lonA * Math.PI / 180;
    var φ2 = latB * Math.PI / 180, λ2 = lonB * Math.PI / 180;
    var Δφ = φ2 - φ1;
    var Δλ = λ2 - λ1;

    var a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2)
        + Math.cos(φ1) * Math.cos(φ2)
        * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;

    return d;
};


function chatUpdate() {
    var chatArea = document.getElementById("chat-area");
    chatArea.innerHTML = '';
    for (var i = chatItems.length - 1; i >= 0; i--) {
        var item = chatItems[i];
        if (!item.dist) {
            if (item.geojson.properties.id == me.properties.id) {
                item.dist = 0;
            } else {
                item.dist = distance(
                    item.geojson.geometry.coordinates[1],
                    item.geojson.geometry.coordinates[0],
                    me.geometry.coordinates[1],
                    me.geometry.coordinates[0]
                )
            }
        }
        var name = item.geojson.properties.name || "Anonymous";
        var el = document.createElement("div");
        el.innerHTML = "<div><b class='c1'></b> - <span class='c2'></span>" +
            "</div><div class='c3'></div>";
        el.style.marginBottom = "5px";
        el.querySelector(".c1").innerText = name
        el.querySelector(".c2").innerText = item.dist.toFixed(0) + "m";
        el.querySelector(".c3").innerText = item.text;
        chatArea.appendChild(el);
    }
}


chatInput = document.getElementById('chat-input');

// load me
me = JSON.parse(sessionStorage.getItem("t38.me"));
if (!me) { //不存在，就创建新的
    me = {//GeoJSON标准格式，properties可以随便填写任何内容
        type: "Feature",
        geometry: {
            type: "Point",
            coordinates: [
                104.082243 + (Math.random() * 0.01) - 0.005,
                30.545333 + (Math.random() * 0.01) - 0.005
            ]
        },
        properties: {
            id: (Math.random()).toString(16).slice(2),
            color: "rgba(" +
                Math.floor(Math.random() * 128 + 128) + "," +
                Math.floor(Math.random() * 128 + 128) + "," +
                Math.floor(Math.random() * 128 + 128) + "," +
                "1.0)",
            center:null,
        }
    };
    me.properties.center = me.geometry.coordinates;
    me.properties.zoom = 100;
    sessionStorage.setItem("t38.me", JSON.stringify(me));
}
// load the map
mapboxgl.accessToken = 'pk.eyJ1IjoidGlkd2FsbCIsImEiOiJjams3Z21yZDUxZXg1M2tuYzhhcHUyOWZnIn0.9KIyO_Az2Ui8_k13m7Fw_g';
var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/mapbox/streets-v9',
    center: me.properties.center,
    zoom: me.properties.zoom,
    keyboard: false
});
map.on("load", function () {
    // track map position and zoom
    var onmap = function () {
        me.properties.center = [map.getCenter().lng, map.getCenter().lat];
        me.properties.zoom = map.getZoom();
        meUpdated();
    }
    map.on("drag", onmap);
    map.on("zoom", onmap);

    marker = makeMarker(true, me);
    marker.addTo(map);
    marker.on("drag", function () {
        me.geometry.coordinates =
            [marker.getLngLat().lng, marker.getLngLat().lat];
        meUpdated();
        calcNearby();
    })

    chatInput.addEventListener('keypress', function (ev) {
        if (ev.charCode == 13) {
            var phrase = this.value.trim();
            if (opened && phrase != "") {
                var msg = {
                    "type": "Message", //发送消息: 当前的位置和 信息
                    "geojson": me,
                    "text": phrase
                }
                ws.send(JSON.stringify(msg))
                this.value = '';
            }
        }
    })

    openWS()
    setInterval(function () { sendMe() }, 10*1000)//10s同步一次本人信息给服务器
})

var resize = function () {
    var chat = document.getElementById("chat-area");
    chat.style.height =
        (document.body.offsetHeight - chatInput.offsetHeight - 11) + "px";
    chat.style.marginTop = "11px";
}
window.addEventListener("resize", resize);
resize();

var tracking = false;
var trackButton = document.getElementById("track-button");
trackButton.addEventListener("click", function () {
    navigator.geolocation.getCurrentPosition(function (position, error) {
        console.log("获取到当前位置:",position)
    });
})


function gotStream(stream) {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    var audioContext = new AudioContext();
    // Create an AudioNode from the stream
    var mediaStreamSource = audioContext.createMediaStreamSource(stream);
    // Connect it to destination to hear yourself
    // or any other node for processing!
    mediaStreamSource.connect(audioContext.destination);
}


 
var p2pButton = document.getElementById("p2p-button");
p2pButton.addEventListener("click", function () {


    navigator.mediaDevices.getUserMedia({audio:true}) 
    .then(function(mediaStream){
        console.log("获取媒体成功",mediaStream)
        var audioTracks = mediaStream.getAudioTracks
        
        for (t in audioTracks){
            console.log("音轨:",audioTracks)
        }
        gotStream(mediaStream)
    })
    .catch(function(err){
        console.error("获取媒体失败",err)
    })


    //生成一个peer连接,但还没开始链接
    var peer = new RTCPeerConnection({
        "iceServers": [  //ice服务器,可以设置stun,turn服务器
        {"url": "stun:stun.l.google.com:19302"}
        ]
    });
    console.log("peer is:",peer)
    if (peer!=null){
        var off = peer.createOffer()
        off.then()
    }
})