#include "VirtualCam.h"
#include <initguid.h>
#include <streams.h>
#include <windows.h>

// Globals required by DirectShow BaseClasses
CFactoryTemplate g_Templates[] = {{L"OpenClaw AvatarCam", &CLSID_OpenClawCam,
                                   CVCam::CreateInstance, NULL, &sudFilter}};
int g_cTemplates = sizeof(g_Templates) / sizeof(g_Templates[0]);

STDAPI DllRegisterServer() { return AMovieDllRegisterServer2(TRUE); }

STDAPI DllUnregisterServer() { return AMovieDllRegisterServer2(FALSE); }

extern "C" BOOL WINAPI DllEntryPoint(HINSTANCE, ULONG, LPVOID);

BOOL APIENTRY DllMain(HANDLE hModule, DWORD ul_reason_for_call,
                      LPVOID lpReserved) {
  return DllEntryPoint((HINSTANCE)(hModule), ul_reason_for_call, lpReserved);
}
