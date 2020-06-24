var WebSocket = require('ws'),
    ProtoBuf = require("protobufjs"),
    ByteBuffer = require("bytebuffer"),
    Program = require('commander'),
    Moniter = require("./monitor");

var cwd = process.cwd();
var host = "ws://127.0.0.1:8090/chat";
var index = 0;
var builder = ProtoBuf.loadProtoFile(__dirname + '/auth.proto');
var AuthReq = builder.build('Req');
var monitor = new Moniter();

const rawHeaderLen = 16;
const packetOffset = 0, headerOffset = 4, verOffset = 6, opOffset = 8, seqOffset = 12;
const opAuth = 1, opAuthReply = 2, opHeartbeat = 3, opHeartbeatReply = 4, opMessage = 5, opMessageReply = 6;

Program
    .version('0.0.1')
    .usage('[Option] <server>')
    .option('-a, --amount <n>', 'Total number of persistent connection, Default to 100', parseInt)
    .option('-s, --sleep <n>', 'Connection sleep time, Default to 10', parseInt)
    .option('-r, --room <type>', 'Connect room, Default to 1000')
    .option('-p, --platform <type>', 'Connect platform, Default to ios')
    .parse(process.argv);

var server = Program.args[0];

if (!Program.amount) {
    Program.amount = 100;
}

if (!Program.sleep) {
    Program.sleep = 10;
}

if (!Program.room) {
    Program.room = '1000';
}

if (!Program.platform) {
    Program.platform = 'ios';
}

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
    if (index < Program.amount) {
        uid = index;
        cid = index;
        init(uid, cid);
        index++;
    }
}, Program.sleep);

console.log("Start Test WebSocket Bench....");

// setInterval(function () {
//     console.log("\n-------------------------------------------");
//     console.log("\nConnection: " + monitor.results.connection);
//     console.log("\nConnection Closed: " + monitor.results.disconnection);
//     console.log("\nConnection Error: " + monitor.results.errors);
//     console.log("\nReceive Msg: " + monitor.results.receiveMsg);
//     console.log("\nMsg Count: " + monitor.messageCounter);
//     console.log("\n");
//     monitor.reset();
// }, 1000);

init = function (uid, cid) {
    var ws = new WebSocket(server);
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
        req.uid = uid+'';
        req.room = Program.room;
        req.platform = Program.platform;

        var headerBuf = new ArrayBuffer(rawHeaderLen);
        var headerView = new DataView(headerBuf, 0);
        var bodyBuf = req.toArrayBuffer();
        headerView.setInt32(packetOffset, rawHeaderLen + bodyBuf.byteLength);
        headerView.setInt16(headerOffset, rawHeaderLen);
        headerView.setInt16(verOffset, 1);
        headerView.setInt32(opOffset, opAuth);
        headerView.setInt32(seqOffset, 1);
        ws.send(mergeArrayBuffer(headerBuf, bodyBuf));
        // console.log(cid + ' Connected');
        monitor.connection();
    };

    ws.onmessage = function (evt) {
        var data = evt.data;
        var op = -1;
        if(data.byteLength >= 16) {
            var dataView = new DataView(data, 0);
            var packetLen = dataView.getInt32(packetOffset);
            var headerLen = dataView.getInt16(headerOffset);
            var ver = dataView.getInt16(verOffset);
            op = dataView.getInt32(opOffset);
            var seq = dataView.getInt32(seqOffset);
        }


        switch (op) {
            case opAuthReply:
                heartbeat();
                setInterval(heartbeat, 30 * 1000);
                break;
            case opHeartbeatReply:
                // 心跳
                monitor.heartbeat();
                break;
            case opMessageReply:
                var packetView = dataView;
                var msg = data;
                var msgBody;
                for (var offset = 0; offset < msg.byteLength; offset += packetLen) {
                    packetLen = packetView.getInt32(offset);
                    headerLen = packetView.getInt16(offset + headerOffset);
                    msgBody = msg.slice(offset + headerLen, offset + packetLen);
                    console.log(cid+' receive msg: '+ab2str(msgBody));
                    monitor.receiveMsg();
                }
                break;
            default:
                console.log('receive empty package');
        }
    };

    ws.onclose = function (error) {
        console.error('Connection Closed' , error);
        monitor.disconnection();
    };

    ws.onerror = function (error) {
        console.error("Connection Error", error);
        monitor.errors();
    };
}

process.on('SIGINT', function () {
    console.log("\nGracefully stoping worker from SIGINT (Ctrl+C)");
    console.log("\nRoom: " + Program.room);
    console.log("\nPlatform: " + Program.platform);
    console.log("\nAmount: " + Program.amount);
    console.log("\nConnection: " + monitor.results.connection);
    console.log("\nConnection Closed: " + monitor.results.disconnection);
    console.log("\nConnection Error: " + monitor.results.errors);
    console.log("\nReceive Msg: " + monitor.results.receiveMsg);
    console.log("\nHeartbeat: " + monitor.results.heartbeat);
    console.log("\nMsg Count: " + monitor.messageCounter);
    setTimeout(function () {
        process.exit();
    }, 3000);
});