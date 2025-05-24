#include "../node_modules/nan/nan.h"

using namespace std;
using namespace Nan;
using namespace v8;

typedef struct node_Reg {
    const char *name;
    Nan::NAN_METHOD_RETURN_TYPE (*node_CFunction)(Nan::NAN_METHOD_ARGS_TYPE/* info*/);
} node_Reg;

template <typename T>
struct node_AltReg {
    const char *name;
    T value;
};

void node_registerMethods(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target, const node_Reg *lib){
    for(size_t i = 0; lib[i].name != NULL; i++)
        Nan::Set(
            target,
            New<String>(lib[i].name).ToLocalChecked(),
            GetFunction(New<FunctionTemplate>(lib[i].node_CFunction)).ToLocalChecked()
        );
}

template <typename T1, typename T2>
void node_registerProps(Nan::ADDON_REGISTER_FUNCTION_ARGS_TYPE target, const struct node_AltReg<T2> *reg){
    for(size_t i = 0; reg[i].name != NULL; i++)
        Nan::Set(
            target,
            New<String>(reg[i].name).ToLocalChecked(),
            New<T1, T2>(reg[i].value)
        );
}
