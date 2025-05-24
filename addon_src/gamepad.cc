#define _DEFAULT_SOURCE

#define UINPUT_DEVICE "/dev/uinput"

#define MAX_ABS 32768

#include "../node_modules/nan/nan.h"

#include "local_node.h"

#include <unistd.h>
#include <fcntl.h>
#include <linux/uinput.h>

using namespace std;
using namespace Nan;
using namespace v8;

struct uinput_setup setup = {
    .id = {
        .bustype = BUS_USB,
        .vendor  = 0x07C0,
        .product = 0xB727,
        .version = 2
    }
};

static int setup_abs(int fd, unsigned chan, int min, int max){
    if(ioctl(fd, UI_SET_ABSBIT, chan))
        return -1;

    struct uinput_abs_setup s = {
        .code = chan,
        .absinfo = { .minimum = min, .maximum = max }
    };

    if(ioctl(fd, UI_ABS_SETUP, &s))
        return -2;

    return 0;
}

int syncGamePad(int fd){
    struct input_event syncEvent;

    memset(&syncEvent, 0, sizeof syncEvent);

    syncEvent.type = EV_SYN;
    syncEvent.code = SYN_REPORT;
    syncEvent.value = 0;

    return write(fd, &syncEvent, sizeof syncEvent);
}

NAN_METHOD(mod_newGamePad){
    Isolate *isolate = info.GetIsolate();

    if((info.Length() < 1) || !info[0]->IsString()){
        info.GetReturnValue().SetNull();

        return;
    }

    String::Utf8Value _arg1(isolate, info[0]);
    std::string arg1(*_arg1);

    size_t arg1_len = arg1.length();

    struct uinput_setup nSetup = setup;

    memcpy(&nSetup.name, arg1.c_str(), (arg1_len > UINPUT_MAX_NAME_SIZE) ? UINPUT_MAX_NAME_SIZE : arg1_len);

    int retInt = open(UINPUT_DEVICE, O_WRONLY | O_NONBLOCK);

    if(retInt < 0){
        retInt = -1;

        goto ret;
    }

    ioctl(retInt, UI_SET_EVBIT, EV_KEY);

    ioctl(retInt, UI_SET_KEYBIT, BTN_A);
    ioctl(retInt, UI_SET_KEYBIT, BTN_B);
    ioctl(retInt, UI_SET_KEYBIT, BTN_X);
    ioctl(retInt, UI_SET_KEYBIT, BTN_Y);
    ioctl(retInt, UI_SET_KEYBIT, BTN_TL);
    ioctl(retInt, UI_SET_KEYBIT, BTN_TR);
    ioctl(retInt, UI_SET_KEYBIT, BTN_TL2);
    ioctl(retInt, UI_SET_KEYBIT, BTN_TR2);
    ioctl(retInt, UI_SET_KEYBIT, BTN_START);
    ioctl(retInt, UI_SET_KEYBIT, BTN_SELECT);
    ioctl(retInt, UI_SET_KEYBIT, BTN_THUMBL);
    ioctl(retInt, UI_SET_KEYBIT, BTN_THUMBR);
    ioctl(retInt, UI_SET_KEYBIT, BTN_DPAD_UP);
    ioctl(retInt, UI_SET_KEYBIT, BTN_DPAD_DOWN);
    ioctl(retInt, UI_SET_KEYBIT, BTN_DPAD_LEFT);
    ioctl(retInt, UI_SET_KEYBIT, BTN_DPAD_RIGHT);

    ioctl(retInt, UI_SET_EVBIT, EV_ABS);

    setup_abs(retInt, ABS_X, -MAX_ABS, MAX_ABS);
    setup_abs(retInt, ABS_Y, -MAX_ABS, MAX_ABS);
    setup_abs(retInt, ABS_RX, -MAX_ABS, MAX_ABS);
    setup_abs(retInt, ABS_RY, -MAX_ABS, MAX_ABS);

    if(ioctl(retInt, UI_DEV_SETUP, &nSetup)){
        retInt = -2;

        goto err;
    }

    if(ioctl(retInt, UI_DEV_CREATE)){
        retInt = -3;

        goto err;
    }

    goto ret;

    err:
        close(retInt);

    ret:
        info.GetReturnValue().Set(Nan::New<Integer>(retInt));
}

NAN_METHOD(mod_destroyGamePad){
    Local<Context> context = info.GetIsolate()->GetCurrentContext();

    if((info.Length() < 1) || !info[0]->IsNumber()){
        info.GetReturnValue().SetNull();

        return;
    }

    int fd = info[0]->NumberValue(context).FromJust();

    info.GetReturnValue().Set(ioctl(fd, UI_DEV_DESTROY));

    close(fd);
}

NAN_METHOD(mod_setButtonState){
    Isolate *isolate = info.GetIsolate();
    Local<Context> context = isolate->GetCurrentContext();

    struct input_event buttonEvent;

    int retCode = 0;

    if((info.Length() < 3) || !info[0]->IsNumber() || !info[1]->IsNumber() || !info[2]->IsBoolean()){
        info.GetReturnValue().SetNull();

        return;
    }

    int fd = info[0]->NumberValue(context).FromJust();
    int button = info[1]->NumberValue(context).FromJust();
    bool pressed = info[2]->BooleanValue(isolate);

    memset(&buttonEvent, 0, sizeof buttonEvent);

    buttonEvent.type = EV_KEY;
    buttonEvent.code = button;
    buttonEvent.value = pressed;

    if(write(fd, &buttonEvent, sizeof buttonEvent) < 0)
        retCode = -1;

    if(syncGamePad(fd) < 0)
        retCode = -2;

    info.GetReturnValue().Set(retCode);
}

NAN_METHOD(mod_updateStick){
    Isolate *isolate = info.GetIsolate();
    Local<Context> context = isolate->GetCurrentContext();

    struct input_event ev[2];

    int retCode = 0;

    if((info.Length() < 4) || !info[0]->IsNumber() || !info[1]->IsBoolean() || !info[2]->IsNumber() || !info[3]->IsNumber()){
        info.GetReturnValue().SetNull();

        return;
    }

    int fd = info[0]->NumberValue(context).FromJust();

    bool rightStick = info[1]->BooleanValue(isolate);

    double x = info[2]->NumberValue(context).FromJust();
    double y = info[3]->NumberValue(context).FromJust();

    memset(&ev, 0, sizeof ev);

    ev[0].type = EV_ABS;
    ev[0].code = rightStick ? ABS_RX : ABS_X;
    ev[0].value = (MAX_ABS * x);

    ev[1].type = EV_ABS;
    ev[1].code = rightStick ? ABS_RY : ABS_Y;
    ev[1].value = (MAX_ABS * y) * -1;

    if(write(fd, &ev, sizeof ev) < 0)
        retCode = -1;

    if(syncGamePad(fd) < 0)
        retCode = -2;

    info.GetReturnValue().Set(Nan::New<Integer>(retCode));
}

static const node_Reg gamePadLib[] = {
    { "newGamePad", mod_newGamePad },
    { "destroyGamePad", mod_destroyGamePad },
    { "setButtonState", mod_setButtonState },
    { "updateStick", mod_updateStick },

    { NULL, NULL }
};

static const struct node_AltReg<int> altReg[] = {
    { "BTN_A", BTN_A },
    { "BTN_B", BTN_B },
    { "BTN_X", BTN_X },
    { "BTN_Y", BTN_Y },
    { "BTN_TL", BTN_TL },
    { "BTN_TR", BTN_TR },
    { "BTN_TL2", BTN_TL2 },
    { "BTN_TR2", BTN_TR2 },
    { "BTN_START", BTN_START },
    { "BTN_SELECT", BTN_SELECT },
    { "BTN_THUMBL", BTN_THUMBL },
    { "BTN_THUMBR", BTN_THUMBR },
    { "BTN_DPAD_UP", BTN_DPAD_UP },
    { "BTN_DPAD_DOWN", BTN_DPAD_DOWN },
    { "BTN_DPAD_LEFT", BTN_DPAD_LEFT },
    { "BTN_DPAD_RIGHT", BTN_DPAD_RIGHT },

    { NULL, 0 }
};

NAN_MODULE_INIT(Init){
    node_registerMethods(target, gamePadLib);
    node_registerProps<Number>(target, altReg);
}

NODE_MODULE(gamePad, Init);
