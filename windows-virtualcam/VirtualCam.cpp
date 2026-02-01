#include "VirtualCam.h"
#include <initguid.h>
#include <streams.h>
#include <windows.h>

// Define Filter GUIDs (Generate new ones for production)
// {C03C28ED-B733-4D78-90A0-210459733475}
DEFINE_GUID(CLSID_OpenClawCam, 0xc03c28ed, 0xb733, 0x4d78, 0x90, 0xa0, 0x21,
            0x4, 0x59, 0x73, 0x34, 0x75);

const int VIDEO_WIDTH = 1280;
const int VIDEO_HEIGHT = 720;
const int HEADER_SIZE = 20;

// Setup Filter Info
const AMOVIESETUP_MEDIATYPE sudPinTypes = {&MEDIATYPE_Video,
                                           &MEDIASUBTYPE_RGB32};

const AMOVIESETUP_PIN sudPins = {L"Output",   FALSE, TRUE, FALSE,       FALSE,
                                 &CLSID_NULL, NULL,  1,    &sudPinTypes};

const AMOVIESETUP_FILTER sudFilter = {&CLSID_OpenClawCam, L"OpenClaw AvatarCam",
                                      MERIT_DO_NOT_USE, 1, &sudPins};

CUnknown *WINAPI CVCam::CreateInstance(LPUNKNOWN lpunk, HRESULT *phr) {
  CUnknown *punk = new CVCam(lpunk, phr);
  if (!punk)
    *phr = E_OUTOFMEMORY;
  return punk;
}

CVCam::CVCam(LPUNKNOWN lpunk, HRESULT *phr)
    : CSource(NAME("OpenClaw Camera"), lpunk, CLSID_OpenClawCam) {
  CVCamStream *pStream = new CVCamStream(phr, this, L"Capture");
  if (!pStream)
    *phr = E_OUTOFMEMORY;
}

STDMETHODIMP CVCam::QueryInterface(REFIID riid, void **ppv) {
  if (riid == _uuidof(IAMStreamConfig) || riid == _uuidof(IKsPropertySet)) {
    return m_paStreams[0]->QueryInterface(riid, ppv);
  }
  return CSource::QueryInterface(riid, ppv);
}

// Stream Implementation

CVCamStream::CVCamStream(HRESULT *phr, CSource *p_ms, LPCWSTR p_name)
    : CSourceStream(NAME("OpenClaw Stream"), phr, p_ms, p_name),
      m_hMapFile(NULL), m_pMapAddress(NULL) {
  m_width = VIDEO_WIDTH;
  m_height = VIDEO_HEIGHT;
}

CVCamStream::~CVCamStream() {
  if (m_pMapAddress)
    UnmapViewOfFile(m_pMapAddress);
  if (m_hMapFile)
    CloseHandle(m_hMapFile);
}

HRESULT CVCamStream::OnThreadCreate() {
  // Open Memory Mapped File
  // Electron writes to: %TEMP%\openclaw_avatar.raw
  char tmpPath[MAX_PATH];
  GetTempPathA(MAX_PATH, tmpPath);
  strcat_s(tmpPath, "openclaw_avatar.raw");

  // Open file for reading
  HANDLE hFile =
      CreateFileA(tmpPath, GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE,
                  NULL, OPEN_EXISTING, FILE_ATTRIBUTE_NORMAL, NULL);

  if (hFile != INVALID_HANDLE_VALUE) {
    m_hMapFile = CreateFileMapping(hFile, NULL, PAGE_READONLY, 0, 0, NULL);
    if (m_hMapFile) {
      m_pMapAddress = MapViewOfFile(m_hMapFile, FILE_MAP_READ, 0, 0, 0);
    }
    CloseHandle(hFile); // Handle not needed after mapping? Actually yes,
                        // mapping keeps ref.
  }
  return S_OK;
}

HRESULT CVCamStream::OnThreadDestroy() {
  if (m_pMapAddress) {
    UnmapViewOfFile(m_pMapAddress);
    m_pMapAddress = NULL;
  }
  if (m_hMapFile) {
    CloseHandle(m_hMapFile);
    m_hMapFile = NULL;
  }
  return S_OK;
}

HRESULT CVCamStream::GetMediaType(int iPosition, CMediaType *pmt) {
  if (iPosition < 0)
    return E_INVALIDARG;
  if (iPosition > 0)
    return VFW_S_NO_MORE_ITEMS;

  VIDEOINFOHEADER *pvi =
      (VIDEOINFOHEADER *)pmt->AllocFormatBuffer(sizeof(VIDEOINFOHEADER));
  ZeroMemory(pvi, sizeof(VIDEOINFOHEADER));

  pvi->bmiHeader.biSize = sizeof(BITMAPINFOHEADER);
  pvi->bmiHeader.biWidth = m_width;
  pvi->bmiHeader.biHeight = m_height;
  pvi->bmiHeader.biPlanes = 1;
  pvi->bmiHeader.biBitCount = 32;
  pvi->bmiHeader.biCompression = BI_RGB;
  pvi->bmiHeader.biSizeImage = m_width * m_height * 4;
  pvi->AvgTimePerFrame = 333333; // ~30FPS

  pmt->SetType(&MEDIATYPE_Video);
  pmt->SetFormatType(&FORMAT_VideoInfo);
  pmt->SetTemporalCompression(FALSE);
  pmt->SetSubtype(&MEDIASUBTYPE_RGB32);
  pmt->SetSampleSize(pvi->bmiHeader.biSizeImage);

  return S_OK;
}

HRESULT CVCamStream::CheckMediaType(const CMediaType *pMediaType) {
  if (*pMediaType->Type() != MEDIATYPE_Video)
    return E_INVALIDARG;
  if (*pMediaType->Subtype() != MEDIASUBTYPE_RGB32)
    return E_INVALIDARG;
  return S_OK;
}

HRESULT CVCamStream::DecideBufferSize(IMemAllocator *pAlloc,
                                      ALLOCATOR_PROPERTIES *pProp) {
  ALLOCATOR_PROPERTIES Actual;
  pProp->cBuffers = 1;
  pProp->cbBuffer = m_width * m_height * 4;
  return pAlloc->SetProperties(pProp, &Actual);
}

HRESULT CVCamStream::FillBuffer(IMediaSample *pms) {
  BYTE *pData;
  pms->GetPointer(&pData);
  long length = pms->GetSize();

  // Default: Clear to Green
  // memset(pData, 0, length); // Actually we want transparent or key color?

  if (m_pMapAddress) {
    // Shared Memory Layout: Header(20) + Bytes
    // We only want the bytes.
    // Also: DirectShow RGB is Bottom-Up. Electron/GL is likely Bottom-Up.
    // IF source is also Bottom-Up, straight copy works.
    // IF source is Top-Down, we might need to flip.

    // Check if shm is valid (check magic?)
    // int32* header = (int32*)m_pMapAddress;

    // Copy Frame
    // Skip header
    BYTE *src = (BYTE *)m_pMapAddress + HEADER_SIZE;
    CopyMemory(pData, src, min(length, (VIDEO_WIDTH * VIDEO_HEIGHT * 4)));

    // Timestamp handling (optional but good for sync)
    REFERENCE_TIME rtStart = m_iFrameNumber * 333333;
    REFERENCE_TIME rtStop = rtStart + 333333;
    pms->SetTime(&rtStart, &rtStop);
    m_iFrameNumber++;
    return S_OK;
  } else {
    // Retry mapping if failed initially?
    // For MVP, just return S_OK with black frame
    return S_OK;
  }
}
