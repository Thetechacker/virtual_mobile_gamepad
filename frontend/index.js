function asPixels(px){
    return px.toFixed(2).toString() + "px";
}

function makeDot(diameter, color){
    const dotElement = document.createElement("div");

    dotElement.style.width = asPixels(diameter);
    dotElement.style.height = dotElement.style.width;

    dotElement.style.boxSizing = "border-box";

    dotElement.style.position = "absolute";

    dotElement.style.top = asPixels(0);
    dotElement.style.left = dotElement.style.top;

    dotElement.style.backgroundColor = color;

    dotElement.style.borderRadius = "50%";

    return dotElement;
}

function toggleFullScreen(){
    if(!document.fullscreenElement){
        document.documentElement.requestFullscreen();
    } else if(document.exitFullscreen){
        document.exitFullscreen();
    }
}

function translateMatrixToCartesian(x, y, width, height){
    return { x: x - (width / 2), y: (height / 2) - y };
}

function translateCartesianToMatrix(x, y, matrixWidth, matrixHeight){
    return { x: (matrixWidth / 2) + x, y: (matrixHeight / 2) - y };
}

function getRelativeCoords(clientX, clientY, element){
    const rect = element.getBoundingClientRect();

    return { x: clientX - rect.left, y: clientY - rect.top };
}

function bounds(min, max, n){
    return (n < min) ? min : (n > max) ? max : n;
}

const infoBar = document.getElementById("infoBar");
const dbgElement = document.getElementById("debug");
const gamePadStatus = document.getElementById("gamePadStatus");
const gamePadId = document.getElementById("gamePadId");

const server = new WebSocket("ws://" + (new URL(document.URL).hostname || "localhost") + ":8077");

function updateElementPosition(element, relativeX, relativeY, offset){
    element.style.left = asPixels(relativeX - offset);
    element.style.top = asPixels(relativeY - offset);
}

function isPointInsideCircle(x, y, circleCenterX, circleCenterY, circleRadius, allowBounds){
    const t = ((x - circleCenterX) ** 2) + ((y - circleCenterY) ** 2),
        radiusSquared = (circleRadius ** 2);

    return (t < radiusSquared) || (allowBounds && (t == radiusSquared));
}

class AnalogStick {
    analogStickElement = document.createElement("div");
    onupdate = null;

    #pointerElement = null;
    #absolutePointerElement = null;
    #boxSize = null;

    #circleRadius = null;
    #pointerRadius = null;

    constructor(
        boxSize = 250,
        boxBorderSize = 4,
        pointerDiameter = 20,
        boxBorderColor = "white",
        circleBorderColor = "magenta",
        pointerColor = "red",
        absolutePointerColor = "green"
    ){
        this.#boxSize = boxSize;

        this.#circleRadius = (this.#boxSize / 2);
        this.#pointerRadius = (pointerDiameter / 2);

        this.analogStickElement.style.position = "relative";

        const box = document.createElement("div");
        const circle = document.createElement("div");

        this.#pointerElement = makeDot(pointerDiameter, pointerColor);
        this.#absolutePointerElement = makeDot(pointerDiameter, absolutePointerColor);

        box.style.width = asPixels(boxSize);
        box.style.height = box.style.width;

        box.style.boxSizing = "border-box";

        box.style.border = asPixels(boxBorderSize);
        box.style.borderStyle = "solid";
        box.style.borderColor = boxBorderColor;

        circle.style.width = box.style.width;
        circle.style.height = circle.style.width;

        circle.style.boxSizing = "border-box";

        circle.style.position = "absolute";

        circle.style.border = box.style.border;
        circle.style.borderStyle = box.style.borderStyle;
        circle.style.borderColor = circleBorderColor;

        circle.style.borderRadius = "50%";

        this.analogStickElement.appendChild(circle);
        this.analogStickElement.appendChild(box);
        this.analogStickElement.appendChild(this.#absolutePointerElement);
        this.analogStickElement.appendChild(this.#pointerElement);

        this.resetStick();

        this.analogStickElement.ontouchstart = (ev) => {
            const touch = this.getTouch(ev);

            this.updateAnalogStick(ev.type, touch.clientX, touch.clientY);
        }

        this.analogStickElement.ontouchmove = this.analogStickElement.ontouchstart;

        this.analogStickElement.ontouchend = (ev) => this.resetStick(ev.type);
    }

    getTouch(ev){
        return Array.from(ev.touches).find(touch => (touch.target === this.analogStickElement) || (touch.target.parentElement === this.analogStickElement));
    }

    resetStick(eventType){
        const rect = this.analogStickElement.getBoundingClientRect();

        this.updateAnalogStick(eventType, rect.left + (this.#boxSize / 2), rect.top + (this.#boxSize / 2));
    }

    updateAnalogStick(eventType, clientX, clientY){
        const { x: relativeX, y: relativeY } = getRelativeCoords(clientX, clientY, this.analogStickElement);
        const { x: cX, y: cY } = translateMatrixToCartesian(relativeX, relativeY, this.#boxSize, this.#boxSize);

        let cnPointerX = null,
            cnPointerY = null;

        if(isPointInsideCircle(cX, cY, 0, 0, this.#circleRadius, true)){
            updateElementPosition(this.#pointerElement, relativeX, relativeY, this.#pointerRadius);

            const { x: transX, y: transY } = translateMatrixToCartesian(relativeX, relativeY, this.#boxSize, this.#boxSize);

            cnPointerX = transX;
            cnPointerY = transY;
        } else {
            const d = Math.sqrt(((cX - 0) ** 2) + ((cY - 0) ** 2));

            cnPointerX = 0 + (this.#circleRadius * ((cX - 0) / d));
            cnPointerY = 0 + (this.#circleRadius * ((cY - 0) / d));

            const { x: transX, y: transY } = translateCartesianToMatrix(cnPointerX, cnPointerY, this.#boxSize, this.#boxSize);

            updateElementPosition(this.#pointerElement, transX, transY, this.#pointerRadius);
        }

        const r = Math.sqrt((cnPointerX ** 2) + (cnPointerY ** 2)),
            theta = Math.atan2(cnPointerX, cnPointerY);

        const a = r * Math.cos(theta - (Math.PI / 4)),
            b = r * Math.sin(theta - (Math.PI / 4));

        const u = bounds(this.#circleRadius * -1, this.#circleRadius, a + b),
            v = bounds(this.#circleRadius * -1, this.#circleRadius, a - b);

        const { x: transX, y: transY } = translateCartesianToMatrix(u, v, this.#boxSize, this.#boxSize);

        updateElementPosition(this.#absolutePointerElement, transX, transY, this.#pointerRadius);

        if(this.onupdate !== null)
            this.onupdate(
                eventType,
                (u / this.#circleRadius).toFixed(3),
                (v / this.#circleRadius).toFixed(3),
                (cnPointerX / this.#circleRadius).toFixed(3),
                (cnPointerY / this.#circleRadius).toFixed(3),
                ((relativeX - this.#circleRadius) / this.#circleRadius).toFixed(3),
                ((relativeY - this.#circleRadius) / (this.#circleRadius * -1)).toFixed(3)
            );
    };
}

function makeButtonPanel(buttonSize = 62.5, buttonBorderSize = 5){
    const buttons = [ "A", "B", "X", "Y" ];

    const buttonPanel = document.createElement("ul");

    buttonPanel.style.listStyleType = "none";

    for(let i = 0; i < buttons.length; i++){
        const button = buttons[i];

        const buttonElement = document.createElement("li");

        buttonElement.id = button.toLowerCase();
        buttonElement.classList.add("button");

        buttonElement.style.height = asPixels(buttonSize);
        buttonElement.style.width = buttonElement.style.height;
        buttonElement.style.lineHeight = buttonElement.style.width;

        buttonElement.style.boxSizing = "border-box";

        buttonElement.style.border = asPixels(3);
        buttonElement.style.borderColor = "white";
        buttonElement.style.borderStyle = "solid";

        if((i + 1) < buttons.length)
            buttonElement.style.borderBottom = "0";

        buttonElement.style.textAlign = "center";

        buttonElement.style.fontWeight = "bold";

        buttonElement.textContent = button;

        buttonPanel.appendChild(buttonElement);
    }

    return buttonPanel;
}

function makeButton(text){
    const width = 70, height = 50;

    const button = document.createElement("div");

    button.id = text.toLowerCase();
    button.classList.add("button");

    button.style.height = asPixels(height);
    button.style.width = asPixels(width);
    button.style.lineHeight = button.style.height;

    button.style.boxSizing = "border-box";

    button.style.border = asPixels(3);
    button.style.borderStyle = "solid";
    button.style.borderColor = "white";

    button.style.fontWeight = "bold";

    button.style.textAlign = "center";

    button.textContent = text;

    return button;
}

const container = document.createElement("div"),
    topPanel = document.createElement("div"),
    bottomPanel = document.createElement("div");
const leftStick = new AnalogStick(), rightStick = new AnalogStick();
const buttonPanel = makeButtonPanel();

const leftTrigger = makeButton("LT"), leftTriggerB = makeButton("LB");
const rightTrigger = makeButton("RT"), rightTriggerB = makeButton("RB");

const viewButton = makeButton("View"), menuButton = makeButton("Menu");

const leftStickBtn = makeButton("LSB"), rightStickBtn = makeButton("RSB");

container.style.position = "absolute";

container.style.bottom = "0";

container.style.width = "100%";

topPanel.style.overflow = "hidden";
bottomPanel.style.overflow = topPanel.style.overflow;

bottomPanel.style.padding = asPixels(20);

leftTrigger.style.float = "left";
leftTriggerB.style.float = leftTrigger.style.float;

leftTrigger.style.marginLeft = asPixels(20);
leftTriggerB.style.marginLeft = leftTrigger.style.marginLeft;

viewButton.style.float = "left";
viewButton.style.marginLeft = asPixels(20);

menuButton.style.float = "right";
menuButton.style.marginRight = asPixels(20);

leftStickBtn.style.float = "left";
leftStickBtn.style.marginLeft = asPixels(20);

rightStickBtn.style.float = "right";
rightStickBtn.style.marginRight = asPixels(20);

rightTrigger.style.float = "right";
rightTriggerB.style.float = rightTrigger.style.float;

rightTrigger.style.marginRight = asPixels(20);
rightTriggerB.style.marginRight = rightTrigger.style.marginRight;

leftStick.analogStickElement.style.float = "left";
rightStick.analogStickElement.style.float = "right";

rightStick.analogStickElement.style.marginRight = asPixels(20);

buttonPanel.style.float = "right";

topPanel.appendChild(leftTrigger);
topPanel.appendChild(leftTriggerB);

topPanel.appendChild(rightTrigger);
topPanel.appendChild(rightTriggerB);

topPanel.appendChild(viewButton);
topPanel.appendChild(menuButton);

bottomPanel.appendChild(buttonPanel);
bottomPanel.appendChild(leftStick.analogStickElement);
bottomPanel.appendChild(rightStick.analogStickElement);
bottomPanel.appendChild(leftStickBtn);
bottomPanel.appendChild(rightStickBtn);

container.appendChild(topPanel);
container.appendChild(bottomPanel);

document.body.appendChild(container);

for(const button of container.getElementsByClassName("button")){
    button.addEventListener("touchstart", (ev) => { ev.target.style.backgroundColor = "#535355"; });
    button.addEventListener("touchend", (ev) => { ev.target.style.backgroundColor = null; });
}

gamePadStatus.className = "connecting";

server.onclose = (ev) => {
    console.warn("ws:close", ev);

    gamePadStatus.classList = "disconnected";
};

server.onerror = (ev) => console.error("ws:error", ev);
server.onopen = (ev) => {
    function sendObject(obj){
        return server.send(JSON.stringify(obj));
    }

    function onButtonPressed(ev){
        sendObject({ event: "buttonPressed", which: ev.target.id.toUpperCase() });
    }

    function onButtonReleased(ev){
        sendObject({ event: "buttonReleased", which: ev.target.id.toUpperCase() });
    }

    console.info("ws:open", ev);

    gamePadStatus.classList = "connected";

    leftStick.onupdate = (eventType, x, y) => sendObject({ event: "analogStick", which: "left", x, y });
    rightStick.onupdate = (eventType, x, y) => sendObject({ event: "analogStick", which: "right", x, y });

    for(const button of container.getElementsByClassName("button")){
        button.addEventListener("touchstart", onButtonPressed);
        button.addEventListener("touchend", onButtonReleased);
    }
}

server.onmessage = (ev) => {
    console.log("ws:message", ev);

    const data = JSON.parse(ev.data);

    if(data.event === "gamePadId")
        gamePadId.textContent = (data.id + 1).toString();
};

infoBar.onclick = (ev) => toggleFullScreen();
