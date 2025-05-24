import * as _config from "../config.json";
import { Logger, findMissingMapKey } from "./ts_labs/src/utils";
import { WebSocketServer, WebSocket } from "ws";
import { Server as HttpServer } from "node:http";
import { createServer as createHttpServer } from "http-server";
import * as gamePad from "../build/Release/gamepad";

interface Config {
    host: string,
    wsPort: number,
    httpPort: number
}

const config: Config = _config;

const gamePadButtonMap: StringObject<number> = {
    "LT": gamePad.BTN_TL,
    "LB": gamePad.BTN_TL2,
    "RT": gamePad.BTN_TR,
    "RB": gamePad.BTN_TR2,
    "LSB": gamePad.BTN_THUMBL,
    "RSB": gamePad.BTN_THUMBR,
    "VIEW": gamePad.BTN_SELECT,
    "MENU": gamePad.BTN_START,
    "A": gamePad.BTN_A,
    "B": gamePad.BTN_B,
    "X": gamePad.BTN_X,
    "Y": gamePad.BTN_Y
};

const maxWebSockets: number = 4;

const wsLogger: Logger = new Logger("WebSocketServer", true),
    httpLogger: Logger = new Logger("HTTPServer", false);

const server: WebSocketServer = new WebSocketServer({
    host: config.host,
    port: config.wsPort
}),
    httpServer: HttpServer = (createHttpServer({
    root: "frontend/",
}) as any).server;

const wSockets: Map<number, WebSocket> = new Map<number, WebSocket>();

server.on("close", () => wsLogger.warn("ws:close"));
server.on("error", (err) => wsLogger.error("ws:error", err));
server.on("listening", () => {
    wsLogger.info("listening", server.address());
});

server.on("connection", (ws, req) => {
    let address: string = (req.socket.remoteFamily as string) + ':' + (req.socket.remoteAddress as string) + ':' + (req.socket.remotePort)?.toString();

    wsLogger.info("connection", address);

    if(wSockets.size >= maxWebSockets)
        ws.close();
    else {
        const id: number = findMissingMapKey(wSockets);
        const gamePadName: string = "GamePad " + (id + 1).toString();

        const gamePadFD: number = gamePad.newGamePad(gamePadName) as number;

        wSockets.set(id, ws);

        ws.send(JSON.stringify({ event: "gamePadId", id }));

        ws.on("close", (code, reason) => {
            wsLogger.warn("ws:close", address, code, reason);

            gamePad.destroyGamePad(gamePadFD);

            wSockets.delete(id);
        });

        ws.on("error", (err) => wsLogger.error("ws:error", address, err));
        ws.on("message", (data, isBinary) => {
            (isBinary);
            // logger.log("ws:data", address, isBinary, data);

            const resObj = JSON.parse(data.toString("ascii"));

            // logger.debug(resObj);

            if(resObj.event === "analogStick")
                gamePad.updateStick(gamePadFD, resObj.which === "right", parseFloat(resObj.x), parseFloat(resObj.y));
            else if((resObj.event === "buttonPressed") && gamePadButtonMap.hasOwnProperty(resObj.which))
                gamePad.setButtonState(gamePadFD, gamePadButtonMap[resObj.which], true);
            else if((resObj.event === "buttonReleased") && gamePadButtonMap.hasOwnProperty(resObj.which))
                gamePad.setButtonState(gamePadFD, gamePadButtonMap[resObj.which], false);
        });
    }
});

httpServer.on("listening", () => httpLogger.info("listening", httpServer.address()));

httpServer.listen(config.httpPort, config.host);
