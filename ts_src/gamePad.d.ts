declare module "*/gamepad" {
    function newGamePad(name: string): number | null;
    function destroyGamePad(fd: number): number | null;
    function setButtonState(fd: number, button: number, pressed: boolean): number | null;
    function updateStick(fd: number, rightStick: boolean, x: number, y: number): number | null;

    const BTN_A: number,
        BTN_B: number,
        BTN_X: number,
        BTN_Y: number,
        BTN_TL: number,
        BTN_TR: number,
        BTN_TL2: number,
        BTN_TR2: number,
        BTN_START: number,
        BTN_SELECT: number,
        BTN_THUMBL: number,
        BTN_THUMBR: number,
        BTN_DPAD_UP: number,
        BTN_DPAD_DOWN: number,
        BTN_DPAD_LEFT: number,
        BTN_DPAD_RIGHT: number;
}
