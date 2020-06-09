var WebSocket = require('ws'),
    ProtoBuf = require("protobufjs"),
    ByteBuffer = require("bytebuffer");
    Moniter = require("./monitor");

var cwd = process.cwd();
var size = 20;
var host = "ws://49.233.252.136:8090/chat";
var sleep = 10;
var index = 0;
var builder = ProtoBuf.loadProtoFile(__dirname + '/auth.proto');
var Auth = builder.build('Auth');
var AuthReq = Auth.AuthReq;
var mointer = new Moniter();

const rawHeaderLen = 16;
const packetOffset = 0, headerOffset = 4, verOffset = 6, opOffset = 8, seqOffset = 12;
const opAuth = 1, opAuthReply = 2, opHeartbeat = 3, opHeartbeatReply = 4, opMessage = 5, opMessageReply = 6;

var ab2str = function (buf) {
    return String.fromCharCode.apply(null, new Uint8Array(buf));
}

var mergeArrayBuffer = function (ab1, ab2) {
    var u81 = new Uint8Array(ab1),
        u82 = new Uint8Array(ab2),
        res = new Uint8Array(ab1.byteLength + ab2.byteLength);
    res.set(u81, 0);
    res.set(u82, ab1.byteLength);
    return res.buffer;
};


setInterval(function () {
    if (index < size) {
        uid = index;
        cid = index;
        init(uid, cid);
        index++;
    }
}, sleep);

console.log("Start Test WebSocket Bench....");

init = function (uid, cid) {
    var ws = new WebSocket(host);
    ws.binaryType = 'arraybuffer';

    var heartbeat = function () {
        var headerBuf = new ArrayBuffer(rawHeaderLen);
        var headerView = new DataView(headerBuf, 0);
        headerView.setInt32(packetOffset, rawHeaderLen);
        headerView.setInt16(headerOffset, rawHeaderLen);
        headerView.setInt16(verOffset, 1);
        headerView.setInt32(opOffset, opHeartbeat);
        headerView.setInt32(seqOffset, 1);
        ws.send(headerBuf);
    }

    ws.onopen = function () {
        // Auth
        var req = new AuthReq();
        req.uid = index;
        req.room_id = '1001';
        req.platform = 'ios';

        var headerBuf = new ArrayBuffer(rawHeaderLen);
        var headerView = new DataView(headerBuf, 0);
        var bodyBuf = req.toArrayBuffer();
        headerView.setInt32(packetOffset, rawHeaderLen + bodyBuf.byteLength);
        headerView.setInt16(headerOffset, rawHeaderLen);
        headerView.setInt16(verOffset, 1);
        headerView.setInt32(opOffset, opAuth);
        headerView.setInt32(seqOffset, 1);
        ws.send(mergeArrayBuffer(headerBuf, bodyBuf));
        console.log(index+' Connected');
        mointer.connection();
    };

    ws.onmessage = function (evt) {
        var data = evt.data;
        var dataView = new DataView(data, 0);
        var packetLen = dataView.getInt32(packetOffset);
        var headerLen = dataView.getInt16(headerOffset);
        var ver = dataView.getInt16(verOffset);
        var op = dataView.getInt32(opOffset);
        var seq = dataView.getInt32(seqOffset);

        switch (op) {
            case opAuthReply:
                heartbeat();
                setInterval(heartbeat, 30 * 1000);
                break;
            case opMessageReply:
                var packetView = dataView;
                var msg = data;
                var msgBody;
                for (var offset=0; offset<msg.byteLength; offset+=packetLen) {
                    packetLen = packetView.getInt32(offset);
                    headerLen = packetView.getInt16(offset+headerOffset);
                    msgBody = msg.slice(offset+headerLen, offset+packetLen);
                    console.log(ab2str(msgBody));
                }
                mointer.receiveMsg();
                break;
        }
    };

    ws.onclose = function (error) {
        console.log(error.toString() + ';  Connection Closed');
        mointer.disconnection();
    };

    ws.onerror = function (error) {
        console.log("Connection Error: " + error.toString());
        mointer.errors();
    };
}

process.on('SIGINT', function () {
    console.log("\nGracefully stoping worker from SIGINT (Ctrl+C)");
    console.log("Receive Msg: "+mointer.results.receiveMsg);
});